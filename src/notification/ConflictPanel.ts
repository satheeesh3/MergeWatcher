import * as vscode from 'vscode';
import { Conflict } from '../models/Conflict';
import { RepoStatus, RepositoryStatus } from '../models/RepositoryStatus';
import { NotificationManager } from './NotificationManager';
import { formatElapsed } from '../utils/formatElapsed';

const REFRESH_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('refresh'),
  tooltip: 'Check Now'
};

const OPEN_FILE_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('go-to-file'),
  tooltip: 'Open File'
};

const STOP_WATCHING_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('circle-slash'),
  tooltip: 'Stop Watching This Repository (this session)'
};

const RESUME_WATCHING_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('debug-start'),
  tooltip: 'Resume Watching (this session)'
};

interface RepoItem extends vscode.QuickPickItem {
  repo: RepositoryStatus;
  /** Only set when this item's primary conflict should open on Enter. */
  primaryConflict?: Conflict;
}

const STATUS_ICON: Record<RepoStatus, string> = {
  synced: '$(check)',
  behind: '$(arrow-down)',
  conflict: '$(warning)',
  error: '$(error)',
  stopped: '$(circle-slash)'
};

const STATUS_LABEL: Record<RepoStatus, string> = {
  synced: 'Synced',
  behind: 'Behind',
  conflict: 'Conflict',
  error: 'Error',
  stopped: 'Stopped Watching'
};

function toItem(repo: RepositoryStatus): RepoItem {
  const branch = repo.branch ?? '—';
  const countSuffix = repo.status === 'conflict' && repo.conflicts.length > 1 ? ` (${repo.conflicts.length})` : '';

  let detail: string | undefined;
  if (repo.status === 'conflict') {
    const first = repo.conflicts[0];
    detail = `${first.file}   Local: ${first.localStart}-${first.localEnd}   Remote: ${first.remoteStart}-${first.remoteEnd}`;
    if (repo.conflicts.length > 1) {
      detail += `  (+${repo.conflicts.length - 1} more)`;
    }
  } else if (repo.status === 'behind') {
    detail = `${repo.behind} commit${repo.behind === 1 ? '' : 's'} behind`;
  } else if (repo.status === 'error') {
    detail = repo.note;
  }

  const buttons: vscode.QuickInputButton[] = [];
  if (repo.status === 'conflict') {
    buttons.push(OPEN_FILE_BUTTON);
  }
  if (repo.status === 'stopped') {
    buttons.push(RESUME_WATCHING_BUTTON);
  } else {
    buttons.push(STOP_WATCHING_BUTTON);
  }

  return {
    repo,
    primaryConflict: repo.conflicts[0],
    label: `${STATUS_ICON[repo.status]} ${repo.name}`,
    description: `${branch} · ${STATUS_LABEL[repo.status]}${countSuffix}`,
    detail,
    buttons
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarize(repos: RepositoryStatus[], lastCheckedAt: number | undefined): string {
  const conflictCount = repos.reduce((sum, r) => sum + r.conflicts.length, 0);
  const stoppedCount = repos.filter((r) => r.status === 'stopped').length;
  const watchedCount = repos.length - stoppedCount;
  const stoppedSuffix = stoppedCount > 0 ? ` (${stoppedCount} stopped)` : '';
  const checked = lastCheckedAt ? `Last checked: ${formatElapsed(lastCheckedAt)}` : 'Checking…';
  const headline = conflictCount > 0 ? `⚠ ${conflictCount} conflict${conflictCount === 1 ? '' : 's'}` : '✓ No conflicts';
  return `${headline} · ${watchedCount} repositories watched${stoppedSuffix} · ${checked}`;
}

export interface ConflictPanelCallbacks {
  onStopWatchingRepo: (rootPath: string, name: string) => void;
  onResumeWatchingRepo: (rootPath: string) => void;
  onRefresh: () => Promise<void>;
  getStatuses: () => RepositoryStatus[];
  getLastCheckedAt: () => number | undefined;
}

/**
 * Persistent, click-through view of every watched repository's current state.
 * Unlike the one-shot warning toast, this reflects live reality and stays open.
 */
export class ConflictPanel {
  constructor(private readonly notifications: NotificationManager, private readonly callbacks: ConflictPanelCallbacks) {}

  show(): void {
    const quickPick = vscode.window.createQuickPick<RepoItem>();
    quickPick.title = 'MergeWatcher  ·  Esc to close';
    quickPick.buttons = [REFRESH_BUTTON];
    quickPick.ignoreFocusOut = true;

    const render = () => {
      const statuses = this.callbacks.getStatuses();
      quickPick.placeholder = summarize(statuses, this.callbacks.getLastCheckedAt());
      quickPick.items = statuses.map(toItem);
    };

    render();
    quickPick.show();

    const tickTimer = setInterval(() => {
      quickPick.placeholder = summarize(this.callbacks.getStatuses(), this.callbacks.getLastCheckedAt());
    }, 5000);

    quickPick.onDidAccept(() => {
      const selected = quickPick.selectedItems[0];
      if (selected?.primaryConflict) {
        void this.notifications.viewDiff(selected.primaryConflict);
      }
    });

    const runBusy = async (message: string, action: () => Promise<void> | void) => {
      quickPick.busy = true;
      quickPick.placeholder = message;
      const MIN_VISIBLE_MS = 300;
      await Promise.all([action(), sleep(MIN_VISIBLE_MS)]);
      render();
      quickPick.busy = false;
    };

    quickPick.onDidTriggerButton((button) => {
      if (button === REFRESH_BUTTON) {
        void runBusy('Checking now…', () => this.callbacks.onRefresh());
      }
    });

    quickPick.onDidTriggerItemButton((event) => {
      const { repo, primaryConflict } = event.item;

      if (event.button === OPEN_FILE_BUTTON && primaryConflict) {
        void this.notifications.openFile(primaryConflict);
        return;
      }

      if (event.button === STOP_WATCHING_BUTTON) {
        void runBusy(`Stopping "${repo.name}"…`, () => this.callbacks.onStopWatchingRepo(repo.path, repo.name));
        return;
      }

      if (event.button === RESUME_WATCHING_BUTTON) {
        this.callbacks.onResumeWatchingRepo(repo.path);
        void runBusy(`Resuming "${repo.name}"… checking now`, () => this.callbacks.onRefresh());
      }
    });

    quickPick.onDidHide(() => {
      clearInterval(tickTimer);
      quickPick.dispose();
    });
  }
}

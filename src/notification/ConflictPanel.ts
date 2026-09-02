import * as vscode from 'vscode';
import { Conflict } from '../models/Conflict';
import { NotificationManager } from './NotificationManager';

const OPEN_FILE_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('go-to-file'),
  tooltip: 'Open File'
};

const STOP_WATCHING_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('circle-slash'),
  tooltip: 'Stop Watching This Repository (this session)'
};

interface ConflictItem extends vscode.QuickPickItem {
  conflict: Conflict;
}

function toItem(conflict: Conflict): ConflictItem {
  return {
    conflict,
    label: `$(warning) ${conflict.file}`,
    description: `${conflict.repository.name} · ${conflict.branch}`,
    detail: `Local: ${conflict.localStart}-${conflict.localEnd}   Remote: ${conflict.remoteStart}-${conflict.remoteEnd}`,
    buttons: [OPEN_FILE_BUTTON, STOP_WATCHING_BUTTON]
  };
}

/**
 * Shows a persistent, click-through list of the currently active conflicts.
 * Unlike the one-shot warning toast, this reflects live state: it stays open
 * and lets the user act on each conflict without losing the others.
 */
export class ConflictPanel {
  constructor(
    private readonly notifications: NotificationManager,
    private readonly onStopWatchingRepo: (repoPath: string, repoName: string) => void
  ) {}

  show(conflicts: Conflict[]): void {
    if (conflicts.length === 0) {
      void vscode.window.showInformationMessage('Git Conflict Watcher: no active conflicts.');
      return;
    }

    const quickPick = vscode.window.createQuickPick<ConflictItem>();
    quickPick.title = 'Git Conflict Watcher';
    quickPick.placeholder = 'Enter: View Diff  ·  $(go-to-file): Open File  ·  $(circle-slash): Stop Watching Repo';
    quickPick.items = conflicts.map(toItem);
    quickPick.ignoreFocusOut = true;

    quickPick.onDidAccept(() => {
      const selected = quickPick.selectedItems[0];
      if (selected) {
        void this.notifications.viewDiff(selected.conflict);
      }
    });

    quickPick.onDidTriggerItemButton((event) => {
      const item = event.item;
      if (event.button === OPEN_FILE_BUTTON) {
        void this.notifications.openFile(item.conflict);
        return;
      }

      if (event.button === STOP_WATCHING_BUTTON) {
        const { rootPath, name } = item.conflict.repository;
        this.onStopWatchingRepo(rootPath, name);
        quickPick.items = quickPick.items.filter((i) => i.conflict.repository.rootPath !== rootPath);
        if (quickPick.items.length === 0) {
          quickPick.hide();
        }
      }
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  }
}

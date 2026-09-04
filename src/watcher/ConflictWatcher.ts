import * as vscode from 'vscode';
import { RepositoryScanner } from '../git/RepositoryScanner';
import { RepositoryWatcher } from './RepositoryWatcher';
import { WatcherState } from './WatcherState';
import { Configuration } from '../config/Configuration';
import { NotificationManager } from '../notification/NotificationManager';
import { Logger } from '../utils/Logger';
import { ErrorHandler } from '../utils/ErrorHandler';
import { Conflict } from '../models/Conflict';
import { Repository } from '../models/Repository';
import { RepositoryStatus } from '../models/RepositoryStatus';
import { formatElapsed } from '../utils/formatElapsed';

export class ConflictWatcher {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private readonly state: WatcherState;
  private readonly notifications = new NotificationManager();
  private readonly statusBar: vscode.StatusBarItem;

  /** Repositories the user chose to stop watching for this session (in-memory only). */
  private readonly stoppedRepositories = new Set<string>();

  /** Live state for every discovered repository, recomputed every cycle; drives the status bar and panel. */
  private repositoryStatuses: RepositoryStatus[] = [];
  private lastCheckedAt: number | undefined;

  constructor(memento: vscode.Memento) {
    this.state = new WatcherState(memento);
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.updateStatusBar('idle');
    this.statusBar.show();
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    Logger.info('Git Conflict Watcher started.');
    this.updateStatusBar('watching');

    void this.runCycle();
    const intervalMs = Math.max(5, Configuration.intervalSeconds) * 1000;
    this.timer = setInterval(() => void this.runCycle(), intervalMs);
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.repositoryStatuses = [];
    Logger.info('Git Conflict Watcher stopped.');
    this.updateStatusBar('idle');
  }

  isRunning(): boolean {
    return this.running;
  }

  getRepositoryStatuses(): RepositoryStatus[] {
    return this.repositoryStatuses;
  }

  getLastCheckedAt(): number | undefined {
    return this.lastCheckedAt;
  }

  /** Stops watching a single repository for the remainder of this VS Code session. */
  stopWatchingRepo(rootPath: string, name: string): void {
    this.stoppedRepositories.add(rootPath);
    Logger.info(`Stopped watching "${name}" for this session.`);

    // Reflect it immediately rather than waiting for the next full cycle.
    this.repositoryStatuses = this.repositoryStatuses.map((s) =>
      s.path === rootPath ? this.stoppedStatus({ rootPath, name }, 'Stopped for this session.') : s
    );
    const conflictCount = this.repositoryStatuses.reduce((sum, s) => sum + s.conflicts.length, 0);
    this.updateStatusBar('watching', this.repositoryStatuses.length, conflictCount);
  }

  /** Resumes watching a single repository that was stopped for this session. */
  resumeWatchingRepo(rootPath: string): void {
    this.stoppedRepositories.delete(rootPath);
  }

  /** Resumes watching every repository stopped for this session (permanent exclusions in settings are unaffected). */
  resumeWatchingAll(): void {
    this.stoppedRepositories.clear();
    Logger.info('Resumed watching all repositories.');
  }

  async runCycle(): Promise<void> {
    if (!Configuration.enabled) {
      return;
    }

    try {
      const repositories = RepositoryScanner.findRepositories();

      if (repositories.length === 0) {
        this.repositoryStatuses = [];
        this.lastCheckedAt = Date.now();
        this.updateStatusBar('watching', 0, 0);
        return;
      }

      const remote = Configuration.remote;
      const toNotify: Conflict[] = [];

      // Each repo's fetch/diff is independent of the others, so run them concurrently
      // instead of one-at-a-time -- a full cycle is then bounded by the slowest single
      // repo rather than the sum of all of them.
      const statuses = await Promise.all(
        repositories.map(async (repository) => {
          const skipReason = this.skipReason(repository);
          if (skipReason) {
            return this.stoppedStatus(repository, skipReason);
          }

          const watcher = new RepositoryWatcher(repository, this.state);
          try {
            const result = await watcher.check(remote);
            if (result.notify) {
              toNotify.push(...result.status.conflicts);
            }
            return result.status;
          } catch (error) {
            ErrorHandler.handle(`[${repository.name}] check failed`, error);
            return this.errorStatus(repository, 'Check failed. See output log for details.');
          }
        })
      );

      this.repositoryStatuses = statuses;
      this.lastCheckedAt = Date.now();

      const conflictCount = statuses.reduce((sum, s) => sum + s.conflicts.length, 0);
      this.updateStatusBar('watching', statuses.length, conflictCount);

      if (toNotify.length > 0) {
        Logger.warn(`Detected ${toNotify.length} potential conflict(s).`);
        if (Configuration.notifyOnConflict) {
          for (const conflict of toNotify) {
            void this.notifications.notify(conflict);
          }
        }
      }
    } catch (error) {
      ErrorHandler.handle('Watcher cycle failed', error);
    }
  }

  private skipReason(repository: Repository): string | undefined {
    if (this.stoppedRepositories.has(repository.rootPath)) {
      return 'Stopped for this session.';
    }
    const excluded = Configuration.excludedRepositories;
    if (excluded.some((entry) => entry === repository.name || entry === repository.rootPath)) {
      return 'Excluded via gitConflictWatcher.excludedRepositories.';
    }
    return undefined;
  }

  private stoppedStatus(repository: Repository, note: string): RepositoryStatus {
    return {
      name: repository.name,
      path: repository.rootPath,
      branch: undefined,
      status: 'stopped',
      localCommit: undefined,
      remoteCommit: undefined,
      ahead: 0,
      behind: 0,
      conflicts: [],
      lastChecked: Date.now(),
      note
    };
  }

  private errorStatus(repository: Repository, note: string): RepositoryStatus {
    return {
      name: repository.name,
      path: repository.rootPath,
      branch: undefined,
      status: 'error',
      localCommit: undefined,
      remoteCommit: undefined,
      ahead: 0,
      behind: 0,
      conflicts: [],
      lastChecked: Date.now(),
      note
    };
  }

  private updateStatusBar(state: 'idle' | 'watching', repoCount = 0, conflictCount = 0): void {
    if (state === 'idle') {
      this.statusBar.text = '$(circle-slash) Git Conflict Watcher';
      this.statusBar.tooltip = 'Git Conflict Watcher is stopped. Click to start.';
      this.statusBar.command = 'gitConflictWatcher.start';
      return;
    }

    this.statusBar.command = 'gitConflictWatcher.showStatus';
    const checkedLabel = this.lastCheckedAt ? `Last checked: ${formatElapsed(this.lastCheckedAt)}` : 'Checking…';

    if (conflictCount > 0) {
      this.statusBar.text = `$(warning) Conflicts: ${conflictCount}`;
      this.statusBar.tooltip = `${conflictCount} potential conflict(s) · ${repoCount} repositories watched · ${checkedLabel}`;
    } else {
      this.statusBar.text = `$(check) No conflicts · ${repoCount} repo${repoCount === 1 ? '' : 's'}`;
      this.statusBar.tooltip = `${repoCount} repositories watched · ${checkedLabel}. Click for details.`;
    }
  }

  dispose(): void {
    this.stop();
    this.statusBar.dispose();
  }
}

import * as vscode from 'vscode';
import * as path from 'path';
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
import { mapWithConcurrency } from '../utils/mapWithConcurrency';

export class MergeWatcher {
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

  /** The currently in-flight cycle, if any -- late callers await this instead of returning early against stale data. */
  private cyclePromise: Promise<void> | undefined;
  /** Set when runCycle() is called while one is already in progress, so that call isn't silently dropped. */
  private rerunRequested = false;

  private readonly _onDidUpdate = new vscode.EventEmitter<void>();
  /** Fires whenever repositoryStatuses (or running state) changes, for views like the Activity Bar tree to refresh. */
  readonly onDidUpdate = this._onDidUpdate.event;

  constructor(memento: vscode.Memento) {
    this.state = new WatcherState(memento);
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.renderIdleStatus();
    this.statusBar.show();
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    Logger.info('Merge Watcher started.');
    this.renderWatchingStatus();

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
    Logger.info('Merge Watcher stopped.');
    this.renderIdleStatus();
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
    this.renderWatchingStatus();
  }

  /**
   * Resumes watching a single repository that was stopped for this session, and checks just
   * that repository -- not the whole workspace -- so resuming one repo among many doesn't
   * wait on a fetch for every other one too.
   */
  async resumeWatchingRepo(rootPath: string): Promise<void> {
    this.stoppedRepositories.delete(rootPath);
    await this.refreshSingleRepository(rootPath);
  }

  /** Resumes watching every repository stopped for this session (permanent exclusions in settings are unaffected). */
  resumeWatchingAll(): void {
    this.stoppedRepositories.clear();
    Logger.info('Resumed watching all repositories.');
  }

  /**
   * Runs a check cycle. If one is already running, this call queues one more run right after
   * it and waits for THAT to finish too -- so a manual Refresh/Resume triggered while a
   * background cycle happens to be in flight still resolves only once fresh results are ready,
   * instead of resolving immediately against stale data.
   */
  async runCycle(): Promise<void> {
    if (!Configuration.enabled) {
      return;
    }
    if (this.cyclePromise) {
      this.rerunRequested = true;
      return this.cyclePromise;
    }

    this.cyclePromise = this.runUntilSettled();
    try {
      await this.cyclePromise;
    } finally {
      this.cyclePromise = undefined;
    }
  }

  private async runUntilSettled(): Promise<void> {
    do {
      this.rerunRequested = false;
      await this.runOneCycle();
    } while (this.rerunRequested);
  }

  private async runOneCycle(): Promise<void> {
    try {
      const repositories = RepositoryScanner.findRepositories();

      if (repositories.length === 0) {
        this.repositoryStatuses = [];
        this.lastCheckedAt = Date.now();
        this.renderWatchingStatus();
        return;
      }

      const remote = Configuration.remote;
      const toNotify: Conflict[] = [];

      // Each repo's fetch/diff is independent of the others, so they can run concurrently
      // instead of one-at-a-time -- but capped, so a large workspace doesn't spawn dozens of
      // git processes at once on a low-resource machine.
      const statuses = await mapWithConcurrency(repositories, Configuration.maxConcurrentChecks, async (repository) => {
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
      });

      this.repositoryStatuses = statuses;
      this.lastCheckedAt = Date.now();
      this.renderWatchingStatus();

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

  /** Checks a single repository and merges its fresh status into repositoryStatuses in place. */
  private async refreshSingleRepository(rootPath: string): Promise<void> {
    const existing = this.repositoryStatuses.find((s) => s.path === rootPath);
    const repository: Repository = { rootPath, name: existing?.name ?? path.basename(rootPath) };

    const skipReason = this.skipReason(repository);
    let status: RepositoryStatus;
    let conflicts: Conflict[] = [];
    let notify = false;

    if (skipReason) {
      status = this.stoppedStatus(repository, skipReason);
    } else {
      const watcher = new RepositoryWatcher(repository, this.state);
      try {
        const result = await watcher.check(Configuration.remote);
        status = result.status;
        conflicts = result.status.conflicts;
        notify = result.notify;
      } catch (error) {
        ErrorHandler.handle(`[${repository.name}] check failed`, error);
        status = this.errorStatus(repository, 'Check failed. See output log for details.');
      }
    }

    const index = this.repositoryStatuses.findIndex((s) => s.path === rootPath);
    if (index >= 0) {
      this.repositoryStatuses = this.repositoryStatuses.map((s, i) => (i === index ? status : s));
    } else {
      this.repositoryStatuses = [...this.repositoryStatuses, status];
    }
    this.lastCheckedAt = Date.now();
    this.renderWatchingStatus();

    if (notify && conflicts.length > 0 && Configuration.notifyOnConflict) {
      for (const conflict of conflicts) {
        void this.notifications.notify(conflict);
      }
    }
  }

  private skipReason(repository: Repository): string | undefined {
    if (this.stoppedRepositories.has(repository.rootPath)) {
      return 'Stopped for this session.';
    }
    const excluded = Configuration.excludedRepositories;
    if (excluded.some((entry) => entry === repository.name || entry === repository.rootPath)) {
      return 'Excluded via mergeWatcher.excludedRepositories.';
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

  private renderIdleStatus(): void {
    this.statusBar.text = '$(circle-slash) Merge Watcher';
    this.statusBar.tooltip = 'Merge Watcher is stopped. Click to start.';
    this.statusBar.command = 'mergeWatcher.start';
    this._onDidUpdate.fire();
  }

  /** Renders the status bar from this.repositoryStatuses. "Watched" excludes stopped/excluded repos. */
  private renderWatchingStatus(): void {
    this.statusBar.command = 'mergeWatcher.showStatus';
    const checkedLabel = this.lastCheckedAt ? `Last checked: ${formatElapsed(this.lastCheckedAt)}` : 'Checking…';

    const stoppedCount = this.repositoryStatuses.filter((s) => s.status === 'stopped').length;
    const watchedCount = this.repositoryStatuses.length - stoppedCount;
    const conflictCount = this.repositoryStatuses.reduce((sum, s) => sum + s.conflicts.length, 0);
    const stoppedSuffix = stoppedCount > 0 ? ` (${stoppedCount} stopped)` : '';

    if (conflictCount > 0) {
      this.statusBar.text = `$(warning) Conflicts: ${conflictCount}`;
      this.statusBar.tooltip = `${conflictCount} potential conflict(s) · ${watchedCount} repositories watched${stoppedSuffix} · ${checkedLabel}`;
    } else {
      this.statusBar.text = `$(pass-filled) No conflicts · ${watchedCount} repo${watchedCount === 1 ? '' : 's'}`;
      this.statusBar.tooltip = `${watchedCount} repositories watched${stoppedSuffix} · ${checkedLabel}. Click for details.`;
    }
    this._onDidUpdate.fire();
  }

  dispose(): void {
    this.stop();
    this.statusBar.dispose();
    this._onDidUpdate.dispose();
  }
}

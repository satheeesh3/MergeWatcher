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

export class ConflictWatcher {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private readonly state: WatcherState;
  private readonly notifications = new NotificationManager();
  private readonly statusBar: vscode.StatusBarItem;

  /** Repositories the user chose to stop watching for this session (in-memory only). */
  private readonly stoppedRepositories = new Set<string>();

  /** Live conflict state, recomputed every cycle; drives both the status bar and the conflict panel. */
  private currentConflicts: Conflict[] = [];

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
    this.currentConflicts = [];
    Logger.info('Git Conflict Watcher stopped.');
    this.updateStatusBar('idle');
  }

  isRunning(): boolean {
    return this.running;
  }

  getCurrentConflicts(): Conflict[] {
    return this.currentConflicts;
  }

  /** Stops watching a single repository for the remainder of this VS Code session. */
  stopWatchingRepo(rootPath: string, name: string): void {
    this.stoppedRepositories.add(rootPath);
    this.currentConflicts = this.currentConflicts.filter((c) => c.repository.rootPath !== rootPath);
    Logger.info(`Stopped watching "${name}" for this session.`);
    this.updateStatusBar('watching', undefined, this.currentConflicts.length);
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
      const allRepositories = await RepositoryScanner.findRepositories();
      const repositories = allRepositories.filter((repo) => this.isWatchable(repo));

      if (repositories.length === 0) {
        this.currentConflicts = [];
        this.updateStatusBar('watching', 0, 0);
        return;
      }

      const remote = Configuration.remote;
      const allConflicts: Conflict[] = [];
      const toNotify: Conflict[] = [];

      for (const repository of repositories) {
        const watcher = new RepositoryWatcher(repository, this.state);
        try {
          const result = await watcher.check(remote);
          allConflicts.push(...result.conflicts);
          if (result.notify) {
            toNotify.push(...result.conflicts);
          }
        } catch (error) {
          ErrorHandler.handle(`[${repository.name}] check failed`, error);
        }
      }

      this.currentConflicts = allConflicts;
      this.updateStatusBar('watching', repositories.length, allConflicts.length);

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

  private isWatchable(repository: Repository): boolean {
    if (this.stoppedRepositories.has(repository.rootPath)) {
      return false;
    }
    const excluded = Configuration.excludedRepositories;
    return !excluded.some(
      (entry) => entry === repository.name || entry === repository.rootPath
    );
  }

  private updateStatusBar(state: 'idle' | 'watching', repoCount = 0, conflictCount = 0): void {
    if (state === 'idle') {
      this.statusBar.text = '$(circle-slash) Git Conflict Watcher';
      this.statusBar.tooltip = 'Git Conflict Watcher is stopped. Click to start.';
      this.statusBar.command = 'gitConflictWatcher.start';
      return;
    }

    if (conflictCount > 0) {
      this.statusBar.text = `$(warning) Git Conflicts: ${conflictCount}`;
      this.statusBar.tooltip = `${conflictCount} potential conflict(s). Click to view.`;
      this.statusBar.command = 'gitConflictWatcher.showConflicts';
    } else {
      this.statusBar.text = `$(check) Git Watcher: ${repoCount} repo${repoCount === 1 ? '' : 's'}`;
      this.statusBar.tooltip = 'No potential conflicts detected. Click to check now.';
      this.statusBar.command = 'gitConflictWatcher.checkNow';
    }
  }

  dispose(): void {
    this.stop();
    this.statusBar.dispose();
  }
}

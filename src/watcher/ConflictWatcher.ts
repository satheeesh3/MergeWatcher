import * as vscode from 'vscode';
import { RepositoryScanner } from '../git/RepositoryScanner';
import { RepositoryWatcher } from './RepositoryWatcher';
import { WatcherState } from './WatcherState';
import { Configuration } from '../config/Configuration';
import { NotificationManager } from '../notification/NotificationManager';
import { Logger } from '../utils/Logger';
import { ErrorHandler } from '../utils/ErrorHandler';
import { Conflict } from '../models/Conflict';

export class ConflictWatcher {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private readonly state: WatcherState;
  private readonly notifications = new NotificationManager();
  private readonly statusBar: vscode.StatusBarItem;

  constructor(memento: vscode.Memento) {
    this.state = new WatcherState(memento);
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = 'gitConflictWatcher.checkNow';
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
    Logger.info('Git Conflict Watcher stopped.');
    this.updateStatusBar('idle');
  }

  isRunning(): boolean {
    return this.running;
  }

  async runCycle(): Promise<void> {
    if (!Configuration.enabled) {
      return;
    }

    try {
      const repositories = await RepositoryScanner.findRepositories();
      if (repositories.length === 0) {
        this.updateStatusBar('watching', 0, 0);
        return;
      }

      const remote = Configuration.remote;
      const allConflicts: Conflict[] = [];

      for (const repository of repositories) {
        const watcher = new RepositoryWatcher(repository, this.state);
        try {
          const conflicts = await watcher.check(remote);
          allConflicts.push(...conflicts);
        } catch (error) {
          ErrorHandler.handle(`[${repository.name}] check failed`, error);
        }
      }

      this.updateStatusBar('watching', repositories.length, allConflicts.length);

      if (allConflicts.length > 0) {
        Logger.warn(`Detected ${allConflicts.length} potential conflict(s).`);
        if (Configuration.notifyOnConflict) {
          for (const conflict of allConflicts) {
            void this.notifications.notify(conflict);
          }
        }
      }
    } catch (error) {
      ErrorHandler.handle('Watcher cycle failed', error);
    }
  }

  private updateStatusBar(state: 'idle' | 'watching', repoCount = 0, conflictCount = 0): void {
    if (state === 'idle') {
      this.statusBar.text = '$(circle-slash) Git Conflict Watcher';
      this.statusBar.tooltip = 'Git Conflict Watcher is stopped. Click to check now.';
      return;
    }

    if (conflictCount > 0) {
      this.statusBar.text = `$(warning) Git Conflicts: ${conflictCount}`;
      this.statusBar.tooltip = `${conflictCount} potential conflict(s) across ${repoCount} repositor${repoCount === 1 ? 'y' : 'ies'}.`;
    } else {
      this.statusBar.text = `$(check) Git Watcher: ${repoCount} repo${repoCount === 1 ? '' : 's'}`;
      this.statusBar.tooltip = 'No potential conflicts detected. Click to check now.';
    }
  }

  dispose(): void {
    this.stop();
    this.statusBar.dispose();
  }
}

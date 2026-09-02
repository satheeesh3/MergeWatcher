import * as vscode from 'vscode';
import { ConflictWatcher } from './watcher/ConflictWatcher';
import { DiffContentProvider, DIFF_SCHEME } from './notification/DiffContentProvider';
import { NotificationManager } from './notification/NotificationManager';
import { ConflictPanel } from './notification/ConflictPanel';
import { Configuration } from './config/Configuration';
import { Logger } from './utils/Logger';

let watcher: ConflictWatcher | undefined;

export function activate(context: vscode.ExtensionContext): void {
  watcher = new ConflictWatcher(context.workspaceState);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(DIFF_SCHEME, new DiffContentProvider()),

    vscode.commands.registerCommand('gitConflictWatcher.start', () => {
      watcher?.start();
    }),

    vscode.commands.registerCommand('gitConflictWatcher.stop', () => {
      watcher?.stop();
    }),

    vscode.commands.registerCommand('gitConflictWatcher.checkNow', () => {
      void watcher?.runCycle();
    }),

    vscode.commands.registerCommand('gitConflictWatcher.showStatus', () => {
      if (!watcher) {
        return;
      }
      const panel = new ConflictPanel(new NotificationManager(), {
        onStopWatchingRepo: (rootPath, name) => watcher?.stopWatchingRepo(rootPath, name),
        onResumeWatchingRepo: (rootPath) => watcher?.resumeWatchingRepo(rootPath),
        onRefresh: async () => {
          await watcher?.runCycle();
        },
        getStatuses: () => watcher?.getRepositoryStatuses() ?? [],
        getLastCheckedAt: () => watcher?.getLastCheckedAt()
      });
      panel.show();
    }),

    vscode.commands.registerCommand('gitConflictWatcher.resumeWatchingAll', () => {
      watcher?.resumeWatchingAll();
    }),

    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('gitConflictWatcher')) {
        return;
      }
      if (!watcher) {
        return;
      }
      if (Configuration.enabled && !watcher.isRunning()) {
        watcher.start();
      } else if (!Configuration.enabled && watcher.isRunning()) {
        watcher.stop();
      } else if (watcher.isRunning()) {
        // Interval or remote changed; restart to apply.
        watcher.stop();
        watcher.start();
      }
    }),

    { dispose: () => watcher?.dispose() }
  );

  Logger.info('Git Conflict Watcher activated.');

  if (Configuration.enabled) {
    watcher.start();
  }
}

export function deactivate(): void {
  watcher?.dispose();
  watcher = undefined;
}

import * as vscode from 'vscode';
import { MergeWatcher } from './watcher/MergeWatcher';
import { DiffContentProvider, DIFF_SCHEME } from './notification/DiffContentProvider';
import { NotificationManager } from './notification/NotificationManager';
import { ConflictPanel } from './notification/ConflictPanel';
import { Configuration } from './config/Configuration';
import { Logger } from './utils/Logger';

let watcher: MergeWatcher | undefined;

export function activate(context: vscode.ExtensionContext): void {
  watcher = new MergeWatcher(context.workspaceState);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(DIFF_SCHEME, new DiffContentProvider()),

    vscode.commands.registerCommand('mergeWatcher.start', () => {
      watcher?.start();
    }),

    vscode.commands.registerCommand('mergeWatcher.stop', () => {
      watcher?.stop();
    }),

    vscode.commands.registerCommand('mergeWatcher.checkNow', () => {
      void watcher?.runCycle();
    }),

    vscode.commands.registerCommand('mergeWatcher.showStatus', () => {
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

    vscode.commands.registerCommand('mergeWatcher.resumeWatchingAll', () => {
      watcher?.resumeWatchingAll();
    }),

    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('mergeWatcher')) {
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

  Logger.info('MergeWatcher activated.');

  if (Configuration.enabled) {
    watcher.start();
  }
}

export function deactivate(): void {
  watcher?.dispose();
  watcher = undefined;
}

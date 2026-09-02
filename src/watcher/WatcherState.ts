import * as vscode from 'vscode';

const STATE_KEY = 'gitConflictWatcher.lastNotifiedCommit';

/** Tracks the remote commit each repository was last notified about, to avoid repeat notifications for the same commit. */
export class WatcherState {
  private lastNotifiedCommit: Record<string, string>;

  constructor(private readonly memento: vscode.Memento) {
    this.lastNotifiedCommit = this.memento.get<Record<string, string>>(STATE_KEY, {});
  }

  getLastNotifiedCommit(repoPath: string): string | undefined {
    return this.lastNotifiedCommit[repoPath];
  }

  async setLastNotifiedCommit(repoPath: string, commit: string): Promise<void> {
    this.lastNotifiedCommit[repoPath] = commit;
    await this.memento.update(STATE_KEY, this.lastNotifiedCommit);
  }
}

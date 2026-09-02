import * as vscode from 'vscode';

const STATE_KEY = 'gitConflictWatcher.lastRemoteCommit';

/** Tracks the last remote commit seen per repository so repeated fetches don't re-analyze unchanged remotes. */
export class WatcherState {
  private lastRemoteCommit: Record<string, string>;

  constructor(private readonly memento: vscode.Memento) {
    this.lastRemoteCommit = this.memento.get<Record<string, string>>(STATE_KEY, {});
  }

  getLastRemoteCommit(repoPath: string): string | undefined {
    return this.lastRemoteCommit[repoPath];
  }

  async setLastRemoteCommit(repoPath: string, commit: string): Promise<void> {
    this.lastRemoteCommit[repoPath] = commit;
    await this.memento.update(STATE_KEY, this.lastRemoteCommit);
  }
}

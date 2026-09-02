import { GitManager } from '../git/GitManager';
import { BranchManager } from '../git/BranchManager';
import { DiffAnalyzer } from '../conflict/DiffAnalyzer';
import { ConflictDetector } from '../conflict/ConflictDetector';
import { Repository } from '../models/Repository';
import { Conflict } from '../models/Conflict';
import { WatcherState } from './WatcherState';
import { Logger } from '../utils/Logger';
import { ErrorHandler } from '../utils/ErrorHandler';

/** Runs one check cycle (fetch, diff, detect) for a single repository. */
export class RepositoryWatcher {
  private readonly git: GitManager;
  private readonly branches: BranchManager;

  constructor(private readonly repository: Repository, private readonly state: WatcherState) {
    this.git = new GitManager(repository.rootPath);
    this.branches = new BranchManager(this.git);
  }

  async check(remote: string): Promise<Conflict[]> {
    const branch = await this.branches.getCurrentBranch();
    if (!branch) {
      Logger.info(`[${this.repository.name}] Not on a branch (detached HEAD); skipping.`);
      return [];
    }

    const hasRemote = await this.branches.hasRemoteBranch(remote, branch);
    if (!hasRemote) {
      Logger.info(`[${this.repository.name}] No ${remote}/${branch} tracking branch; skipping.`);
      return [];
    }

    try {
      await this.git.fetch(remote, branch);
    } catch (error) {
      ErrorHandler.handle(`[${this.repository.name}] fetch failed`, error);
      return [];
    }

    const remoteCommit = await this.git.getCommitHash(`${remote}/${branch}`);
    const previousCommit = this.state.getLastRemoteCommit(this.repository.rootPath);

    if (previousCommit === remoteCommit) {
      return [];
    }

    const localCommit = await this.git.getCommitHash('HEAD');
    if (remoteCommit === localCommit) {
      await this.state.setLastRemoteCommit(this.repository.rootPath, remoteCommit);
      return [];
    }

    const mergeBase = await this.git.mergeBase('HEAD', remoteCommit);
    const analyzer = new DiffAnalyzer(this.git);
    const diff = await analyzer.analyze(mergeBase, remoteCommit);

    const conflicts = ConflictDetector.detect(this.repository, branch, remoteCommit, diff);

    await this.state.setLastRemoteCommit(this.repository.rootPath, remoteCommit);

    return conflicts;
  }
}

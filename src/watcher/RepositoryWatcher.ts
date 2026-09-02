import { GitManager } from '../git/GitManager';
import { BranchManager } from '../git/BranchManager';
import { DiffAnalyzer } from '../conflict/DiffAnalyzer';
import { ConflictDetector } from '../conflict/ConflictDetector';
import { Repository } from '../models/Repository';
import { Conflict } from '../models/Conflict';
import { WatcherState } from './WatcherState';
import { Logger } from '../utils/Logger';
import { ErrorHandler } from '../utils/ErrorHandler';

export interface CheckResult {
  /** Current conflicts against the remote, recomputed fresh every cycle. */
  conflicts: Conflict[];
  /** True when these conflicts are for a remote commit not yet notified about. */
  notify: boolean;
}

const NO_CONFLICTS: CheckResult = { conflicts: [], notify: false };

/** Runs one check cycle (fetch, diff, detect) for a single repository. */
export class RepositoryWatcher {
  private readonly git: GitManager;
  private readonly branches: BranchManager;

  constructor(private readonly repository: Repository, private readonly state: WatcherState) {
    this.git = new GitManager(repository.rootPath);
    this.branches = new BranchManager(this.git);
  }

  async check(remote: string): Promise<CheckResult> {
    const branch = await this.branches.getCurrentBranch();
    if (!branch) {
      Logger.info(`[${this.repository.name}] Not on a branch (detached HEAD); skipping.`);
      return NO_CONFLICTS;
    }

    const hasRemote = await this.branches.hasRemoteBranch(remote, branch);
    if (!hasRemote) {
      Logger.info(`[${this.repository.name}] No ${remote}/${branch} tracking branch; skipping.`);
      return NO_CONFLICTS;
    }

    try {
      await this.git.fetch(remote, branch);
    } catch (error) {
      ErrorHandler.handle(`[${this.repository.name}] fetch failed`, error);
      return NO_CONFLICTS;
    }

    const remoteCommit = await this.git.getCommitHash(`${remote}/${branch}`);
    const localCommit = await this.git.getCommitHash('HEAD');

    if (remoteCommit === localCommit) {
      return NO_CONFLICTS;
    }

    const mergeBase = await this.git.mergeBase('HEAD', remoteCommit);
    const analyzer = new DiffAnalyzer(this.git);
    const diff = await analyzer.analyze(mergeBase, remoteCommit);

    const conflicts = ConflictDetector.detect(this.repository, branch, remoteCommit, diff);

    const lastNotifiedCommit = this.state.getLastNotifiedCommit(this.repository.rootPath);
    const notify = conflicts.length > 0 && lastNotifiedCommit !== remoteCommit;
    if (notify) {
      await this.state.setLastNotifiedCommit(this.repository.rootPath, remoteCommit);
    }

    return { conflicts, notify };
  }
}

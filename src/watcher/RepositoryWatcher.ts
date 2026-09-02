import { GitManager } from '../git/GitManager';
import { BranchManager } from '../git/BranchManager';
import { DiffAnalyzer } from '../conflict/DiffAnalyzer';
import { ConflictDetector } from '../conflict/ConflictDetector';
import { Repository } from '../models/Repository';
import { RepositoryStatus } from '../models/RepositoryStatus';
import { WatcherState } from './WatcherState';
import { ErrorHandler } from '../utils/ErrorHandler';

export interface CheckResult {
  /** Current state of the repository, recomputed fresh every cycle. */
  status: RepositoryStatus;
  /** True when status.conflicts are for a remote commit not yet notified about. */
  notify: boolean;
}

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
      return this.result('error', { note: 'Not on a branch (detached HEAD).' });
    }

    const hasRemote = await this.branches.hasRemoteBranch(remote, branch);
    if (!hasRemote) {
      return this.result('error', { branch, note: `No ${remote}/${branch} tracking branch.` });
    }

    try {
      await this.git.fetch(remote, branch);
    } catch (error) {
      ErrorHandler.handle(`[${this.repository.name}] fetch failed`, error);
      return this.result('error', { branch, note: 'Fetch failed. See output log for details.' });
    }

    const remoteCommit = await this.git.getCommitHash(`${remote}/${branch}`);
    const localCommit = await this.git.getCommitHash('HEAD');

    if (remoteCommit === localCommit) {
      return this.result('synced', { branch, localCommit, remoteCommit });
    }

    const mergeBase = await this.git.mergeBase('HEAD', remoteCommit);
    const analyzer = new DiffAnalyzer(this.git);
    const diff = await analyzer.analyze(mergeBase, remoteCommit);
    const conflicts = ConflictDetector.detect(this.repository, branch, remoteCommit, diff);

    const [ahead, behind] = await Promise.all([
      this.git.revListCount(`${remoteCommit}..${localCommit}`),
      this.git.revListCount(`${localCommit}..${remoteCommit}`)
    ]);

    const lastNotifiedCommit = this.state.getLastNotifiedCommit(this.repository.rootPath);
    const notify = conflicts.length > 0 && lastNotifiedCommit !== remoteCommit;
    if (notify) {
      await this.state.setLastNotifiedCommit(this.repository.rootPath, remoteCommit);
    }

    const status = conflicts.length > 0 ? 'conflict' : behind > 0 ? 'behind' : 'synced';

    return {
      status: {
        name: this.repository.name,
        path: this.repository.rootPath,
        branch,
        status,
        localCommit,
        remoteCommit,
        ahead,
        behind,
        conflicts,
        lastChecked: Date.now()
      },
      notify
    };
  }

  private result(
    status: RepositoryStatus['status'],
    extra: Partial<RepositoryStatus> = {}
  ): CheckResult {
    return {
      status: {
        name: this.repository.name,
        path: this.repository.rootPath,
        branch: undefined,
        status,
        localCommit: undefined,
        remoteCommit: undefined,
        ahead: 0,
        behind: 0,
        conflicts: [],
        lastChecked: Date.now(),
        ...extra
      },
      notify: false
    };
  }
}

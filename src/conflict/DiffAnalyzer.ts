import { GitManager } from '../git/GitManager';
import { ChangeRange } from '../models/ChangeRange';
import { DiffParser } from './DiffParser';

export interface DiffResult {
  local: ChangeRange[];
  remote: ChangeRange[];
}

export class DiffAnalyzer {
  constructor(private readonly git: GitManager) {}

  /**
   * Computes local changes (merge base -> working tree) and remote changes
   * (merge base -> remote commit), relative to the given merge base.
   */
  async analyze(mergeBase: string, remoteCommit: string): Promise<DiffResult> {
    const [localDiff, remoteDiff] = await Promise.all([
      this.git.diff(mergeBase),
      this.git.diff(mergeBase, remoteCommit)
    ]);

    return {
      local: DiffParser.parse(localDiff),
      remote: DiffParser.parse(remoteDiff)
    };
  }
}

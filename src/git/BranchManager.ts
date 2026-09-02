import { GitManager } from './GitManager';

export class BranchManager {
  constructor(private readonly git: GitManager) {}

  async getCurrentBranch(): Promise<string | undefined> {
    return this.git.getCurrentBranch();
  }

  async hasRemoteBranch(remote: string, branch: string): Promise<boolean> {
    return this.git.remoteRefExists(remote, branch);
  }
}

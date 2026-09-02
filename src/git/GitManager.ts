import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitManager {
  constructor(private readonly repoPath: string) {}

  private async run(args: string): Promise<string> {
    const { stdout } = await execAsync(`git ${args}`, {
      cwd: this.repoPath,
      maxBuffer: 1024 * 1024 * 10
    });
    return stdout.trim();
  }

  /** Returns true if the given directory is the root of a Git repository. */
  static async isRepository(dirPath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git rev-parse --is-inside-work-tree', { cwd: dirPath });
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  async getCurrentBranch(): Promise<string | undefined> {
    try {
      const branch = await this.run('rev-parse --abbrev-ref HEAD');
      return branch === 'HEAD' ? undefined : branch;
    } catch {
      return undefined;
    }
  }

  async fetch(remote: string, branch: string): Promise<void> {
    await this.run(`fetch ${remote} ${branch}`);
  }

  async remoteRefExists(remote: string, branch: string): Promise<boolean> {
    try {
      await this.run(`rev-parse --verify ${remote}/${branch}`);
      return true;
    } catch {
      return false;
    }
  }

  async getCommitHash(ref: string): Promise<string> {
    return this.run(`rev-parse ${ref}`);
  }

  async mergeBase(refA: string, refB: string): Promise<string> {
    return this.run(`merge-base ${refA} ${refB}`);
  }

  /** Unified diff (0 lines of context) between two refs, or a ref and the working tree if toRef is omitted. */
  async diff(fromRef: string, toRef?: string): Promise<string> {
    const target = toRef ? `${fromRef} ${toRef}` : fromRef;
    try {
      return await this.run(`diff --unified=0 --no-color ${target}`);
    } catch {
      return '';
    }
  }

  /** Returns the content of a file as it exists at the given commit. */
  async show(commit: string, filePath: string): Promise<string> {
    const posixPath = filePath.split('\\').join('/');
    return this.run(`show ${commit}:"${posixPath}"`);
  }

  /** Number of commits reachable from `range` (e.g. "a..b"). */
  async revListCount(range: string): Promise<number> {
    try {
      const out = await this.run(`rev-list --count ${range}`);
      return parseInt(out, 10) || 0;
    } catch {
      return 0;
    }
  }
}

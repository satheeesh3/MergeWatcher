import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 1024 * 1024 * 10;

export class GitManager {
  constructor(private readonly repoPath: string) {}

  /** Runs `git <args>` directly (no shell), which avoids spawning an extra shell process per call. */
  private async run(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, { cwd: this.repoPath, maxBuffer: MAX_BUFFER });
    return stdout.trim();
  }

  /** Returns true if the given directory is the root of a Git repository. */
  static async isRepository(dirPath: string): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: dirPath });
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  async getCurrentBranch(): Promise<string | undefined> {
    try {
      const branch = await this.run(['rev-parse', '--abbrev-ref', 'HEAD']);
      return branch === 'HEAD' ? undefined : branch;
    } catch {
      return undefined;
    }
  }

  /** Current branch name and HEAD commit, fetched concurrently (both are needed on every check). */
  async getBranchAndHead(): Promise<{ branch: string | undefined; commit: string } | undefined> {
    try {
      const [branch, commit] = await Promise.all([this.getCurrentBranch(), this.getCommitHash('HEAD')]);
      return { branch, commit };
    } catch {
      return undefined;
    }
  }

  async fetch(remote: string, branch: string): Promise<void> {
    await this.run(['fetch', remote, branch]);
  }

  async getCommitHash(ref: string): Promise<string> {
    return this.run(['rev-parse', ref]);
  }

  async mergeBase(refA: string, refB: string): Promise<string> {
    return this.run(['merge-base', refA, refB]);
  }

  /** Unified diff (0 lines of context) between two refs, or a ref and the working tree if toRef is omitted. */
  async diff(fromRef: string, toRef?: string): Promise<string> {
    const args = ['diff', '--unified=0', '--no-color', fromRef, ...(toRef ? [toRef] : [])];
    try {
      return await this.run(args);
    } catch {
      return '';
    }
  }

  /** Returns the content of a file as it exists at the given commit. */
  async show(commit: string, filePath: string): Promise<string> {
    const posixPath = filePath.split('\\').join('/');
    return this.run(['show', `${commit}:${posixPath}`]);
  }

  /** Number of commits reachable from `range` (e.g. "a..b"). */
  async revListCount(range: string): Promise<number> {
    try {
      const out = await this.run(['rev-list', '--count', range]);
      return parseInt(out, 10) || 0;
    } catch {
      return 0;
    }
  }
}

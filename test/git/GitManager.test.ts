import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { GitManager } from '../../src/git/GitManager';

function run(cmd: string, cwd: string): void {
  execSync(cmd, { cwd, stdio: 'ignore' });
}

suite('GitManager', () => {
  let repoPath: string;

  setup(() => {
    repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gcw-test-'));
    run('git init -q', repoPath);
    run('git config user.email "test@example.com"', repoPath);
    run('git config user.name "Test"', repoPath);
    fs.writeFileSync(path.join(repoPath, 'file.txt'), 'line1\nline2\n');
    run('git add file.txt', repoPath);
    run('git commit -q -m init', repoPath);
  });

  teardown(() => {
    fs.rmSync(repoPath, { recursive: true, force: true });
  });

  test('isRepository detects a git working tree', async () => {
    assert.strictEqual(await GitManager.isRepository(repoPath), true);
  });

  test('isRepository returns false for a non-repo directory', async () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'gcw-nonrepo-'));
    try {
      assert.strictEqual(await GitManager.isRepository(plain), false);
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
  });

  test('getCurrentBranch returns the checked-out branch', async () => {
    const git = new GitManager(repoPath);
    const branch = await git.getCurrentBranch();
    assert.ok(branch === 'main' || branch === 'master');
  });

  test('diff reports working-tree changes against HEAD', async () => {
    fs.writeFileSync(path.join(repoPath, 'file.txt'), 'line1\nline2\nline3\n');
    const git = new GitManager(repoPath);
    const diff = await git.diff('HEAD');
    assert.ok(diff.includes('file.txt'));
    assert.ok(diff.includes('@@'));
  });
});

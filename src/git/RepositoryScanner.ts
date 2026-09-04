import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Repository } from '../models/Repository';

export class RepositoryScanner {
  /**
   * Discovers Git repositories in the current workspace: each workspace
   * folder itself (if it is a repo), plus its immediate subdirectories
   * that are repos (covers a multi-repo folder like the HEB example).
   *
   * Uses a plain filesystem check (presence of a ".git" entry) rather than
   * spawning `git` per candidate folder — with a dozen+ repos, shelling out
   * for each one serially made discovery visibly slow on every poll cycle.
   */
  static findRepositories(): Repository[] {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const repos: Repository[] = [];
    const seen = new Set<string>();

    for (const folder of folders) {
      const rootPath = folder.uri.fsPath;
      this.addIfRepository(rootPath, repos, seen);

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(rootPath, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
          continue;
        }
        this.addIfRepository(path.join(rootPath, entry.name), repos, seen);
      }
    }

    return repos;
  }

  private static addIfRepository(dirPath: string, repos: Repository[], seen: Set<string>): void {
    if (seen.has(dirPath)) {
      return;
    }
    if (this.isRepository(dirPath)) {
      seen.add(dirPath);
      repos.push({ rootPath: dirPath, name: path.basename(dirPath) });
    }
  }

  /** A ".git" entry (directory for a normal clone, file for a worktree) is enough to treat a folder as a repo. */
  private static isRepository(dirPath: string): boolean {
    try {
      return fs.existsSync(path.join(dirPath, '.git'));
    } catch {
      return false;
    }
  }
}

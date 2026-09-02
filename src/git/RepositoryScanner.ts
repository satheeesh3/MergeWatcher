import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Repository } from '../models/Repository';
import { GitManager } from './GitManager';

export class RepositoryScanner {
  /**
   * Discovers Git repositories in the current workspace: each workspace
   * folder itself (if it is a repo), plus its immediate subdirectories
   * that are repos (covers a multi-repo folder like the HEB example).
   */
  static async findRepositories(): Promise<Repository[]> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const repos: Repository[] = [];
    const seen = new Set<string>();

    for (const folder of folders) {
      const rootPath = folder.uri.fsPath;
      await this.addIfRepository(rootPath, repos, seen);

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
        const childPath = path.join(rootPath, entry.name);
        await this.addIfRepository(childPath, repos, seen);
      }
    }

    return repos;
  }

  private static async addIfRepository(dirPath: string, repos: Repository[], seen: Set<string>): Promise<void> {
    if (seen.has(dirPath)) {
      return;
    }
    if (await GitManager.isRepository(dirPath)) {
      seen.add(dirPath);
      repos.push({ rootPath: dirPath, name: path.basename(dirPath) });
    }
  }
}

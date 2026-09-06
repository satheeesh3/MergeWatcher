import * as vscode from 'vscode';
import { GitManager } from '../git/GitManager';

export const DIFF_SCHEME = 'mergewatcher';

interface DiffUriParams {
  repoPath: string;
  commit: string;
  filePath: string;
}

export function buildDiffUri(params: DiffUriParams): vscode.Uri {
  const query = encodeURIComponent(JSON.stringify(params));
  const displayName = params.filePath.split(/[\\/]/).pop() ?? params.filePath;
  return vscode.Uri.parse(`${DIFF_SCHEME}:${displayName}?${query}`);
}

/** Serves the remote-commit version of a file's content for the diff view. */
export class DiffContentProvider implements vscode.TextDocumentContentProvider {
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const params: DiffUriParams = JSON.parse(decodeURIComponent(uri.query));
    const git = new GitManager(params.repoPath);
    try {
      return await git.show(params.commit, params.filePath);
    } catch (error) {
      return `Unable to load ${params.filePath} at ${params.commit}: ${error instanceof Error ? error.message : error}`;
    }
  }
}

import * as vscode from 'vscode';
import { GitManager } from '../git/GitManager';

export const DIFF_SCHEME = 'mergewatcher';

interface DiffUriParams {
  repoPath: string;
  commit: string;
  filePath: string;
}

export function buildDiffUri(params: DiffUriParams): vscode.Uri {
  // Uri.from keeps the query verbatim (Uri.parse would percent-decode it, so a second
  // decodeURIComponent could throw or corrupt paths containing '%'). Using the full
  // relative path keeps the language mode and makes same-named files distinguishable.
  const posixPath = params.filePath.split('\\').join('/');
  return vscode.Uri.from({
    scheme: DIFF_SCHEME,
    path: `/${posixPath}`,
    query: JSON.stringify(params)
  });
}

/** Serves the remote-commit version of a file's content for the diff view. */
export class DiffContentProvider implements vscode.TextDocumentContentProvider {
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const params: DiffUriParams = JSON.parse(uri.query);
    const git = new GitManager(params.repoPath);
    try {
      return await git.show(params.commit, params.filePath);
    } catch (error) {
      return `Unable to load ${params.filePath} at ${params.commit}: ${error instanceof Error ? error.message : error}`;
    }
  }
}

import * as vscode from 'vscode';
import * as path from 'path';
import { Conflict } from '../models/Conflict';
import { buildDiffUri } from './DiffContentProvider';
import { ErrorHandler } from '../utils/ErrorHandler';

export class NotificationManager {
  async notify(conflict: Conflict): Promise<void> {
    const who = conflict.remoteAuthor ?? 'Another developer';
    const message =
      `Potential Git Conflict in "${conflict.repository.name}" (${conflict.branch})\n` +
      `${conflict.file}\n` +
      `Local: ${conflict.localStart}-${conflict.localEnd}  Remote: ${conflict.remoteStart}-${conflict.remoteEnd}\n` +
      `${who} changed an area you are currently working on.`;

    const selection = await vscode.window.showWarningMessage(message, 'View Diff', 'Open File', 'Dismiss');

    if (selection === 'View Diff') {
      await this.viewDiff(conflict);
    } else if (selection === 'Open File') {
      await this.openFile(conflict);
    }
  }

  async viewDiff(conflict: Conflict): Promise<void> {
    try {
      const localUri = vscode.Uri.file(path.join(conflict.repository.rootPath, conflict.file));
      const remoteUri = buildDiffUri({
        repoPath: conflict.repository.rootPath,
        commit: conflict.remoteCommit,
        filePath: conflict.file
      });
      // Left = remote commit, right = local working file; title order matches the panes.
      const title = `${conflict.file} (Remote ${conflict.remoteCommit.substring(0, 7)} ↔ Local)`;
      const line = Math.max(0, conflict.localStart - 1);
      const options: vscode.TextDocumentShowOptions = {
        preview: true,
        // Jump straight to the conflicting lines instead of the top of the file.
        selection: new vscode.Range(line, 0, line, 0)
      };
      await vscode.commands.executeCommand('vscode.diff', remoteUri, localUri, title, options);
    } catch (error) {
      ErrorHandler.handle('Failed to open diff', error);
    }
  }

  async openFile(conflict: Conflict): Promise<void> {
    try {
      const localUri = vscode.Uri.file(path.join(conflict.repository.rootPath, conflict.file));
      const document = await vscode.workspace.openTextDocument(localUri);
      const editor = await vscode.window.showTextDocument(document);
      const line = Math.max(0, conflict.localStart - 1);
      const position = new vscode.Position(line, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      ErrorHandler.handle('Failed to open file', error);
    }
  }
}

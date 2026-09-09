import * as vscode from 'vscode';
import { RepositoryStatus } from '../models/RepositoryStatus';
import { STATUS_ICON, STATUS_LABEL } from '../models/statusPresentation';

export class RepositoryTreeItem extends vscode.TreeItem {
  constructor(public readonly repo: RepositoryStatus) {
    super(repo.name, vscode.TreeItemCollapsibleState.None);

    const branch = repo.branch ?? '—';
    const countSuffix = repo.status === 'conflict' && repo.conflicts.length > 1 ? ` (${repo.conflicts.length})` : '';
    this.description = `${branch} · ${STATUS_LABEL[repo.status]}${countSuffix}`;
    this.iconPath = STATUS_ICON[repo.status];
    this.contextValue = `repo-${repo.status}`;

    if (repo.status === 'conflict') {
      const first = repo.conflicts[0];
      const author = first.remoteAuthor ? `\nBy: ${first.remoteAuthor}` : '';
      this.tooltip = `${first.file}\nLocal: ${first.localStart}-${first.localEnd}   Remote: ${first.remoteStart}-${first.remoteEnd}${author}`;
      this.command = { command: 'mergeWatcher.treeViewDiff', title: 'View Diff', arguments: [this] };
    } else if (repo.status === 'behind') {
      this.tooltip = `${repo.behind} commit${repo.behind === 1 ? '' : 's'} behind`;
    } else if (repo.status === 'error' || repo.status === 'stopped') {
      this.tooltip = repo.note;
    }
  }
}

/** Persistent Activity Bar view mirroring the same live repository state as the status bar and panel. */
export class RepositoriesTreeProvider implements vscode.TreeDataProvider<RepositoryTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly getStatuses: () => RepositoryStatus[]) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: RepositoryTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): RepositoryTreeItem[] {
    return this.getStatuses().map((repo) => new RepositoryTreeItem(repo));
  }
}

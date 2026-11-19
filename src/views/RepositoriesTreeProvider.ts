import * as vscode from 'vscode';
import { Conflict } from '../models/Conflict';
import { RepositoryStatus } from '../models/RepositoryStatus';
import { STATUS_ICON, STATUS_LABEL } from '../models/statusPresentation';

export class RepositoryTreeItem extends vscode.TreeItem {
  constructor(public readonly repo: RepositoryStatus) {
    const hasConflicts = repo.status === 'conflict' && repo.conflicts.length > 0;
    super(repo.name, hasConflicts ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);

    const branch = repo.branch ?? '—';
    const countSuffix = repo.status === 'conflict' && repo.conflicts.length > 1 ? ` (${repo.conflicts.length})` : '';
    this.description = `${branch} · ${STATUS_LABEL[repo.status]}${countSuffix}`;
    this.iconPath = STATUS_ICON[repo.status];
    this.contextValue = `repo-${repo.status}`;

    if (repo.status === 'conflict') {
      const first = repo.conflicts[0];
      const author = first.remoteAuthor ? `\nBy: ${first.remoteAuthor}` : '';
      this.tooltip = `${first.file}\nLocal: ${first.localStart}-${first.localEnd}   Remote: ${first.remoteStart}-${first.remoteEnd}${author}`;
    } else if (repo.status === 'behind') {
      this.tooltip = `${repo.behind} commit${repo.behind === 1 ? '' : 's'} behind`;
    } else if (repo.status === 'error' || repo.status === 'stopped') {
      this.tooltip = repo.note;
    }
  }
}

/** One row per conflicting file, shown nested under its repository, spelling out who changed what lines. */
export class ConflictTreeItem extends vscode.TreeItem {
  constructor(public readonly conflict: Conflict) {
    super(conflict.file, vscode.TreeItemCollapsibleState.None);

    const author = conflict.remoteAuthor ?? 'another developer';
    this.description = `Local ${conflict.localStart}-${conflict.localEnd} ↔ Remote ${conflict.remoteStart}-${conflict.remoteEnd} · by ${author}`;
    this.tooltip = `${conflict.file}\nLocal: ${conflict.localStart}-${conflict.localEnd}   Remote: ${conflict.remoteStart}-${conflict.remoteEnd}\nBy: ${author}`;
    this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.red'));
    this.contextValue = 'conflict-item';
    this.command = { command: 'mergeWatcher.treeViewDiff', title: 'View Diff', arguments: [this] };
  }
}

export type RepositoriesTreeItem = RepositoryTreeItem | ConflictTreeItem;

/** Persistent Activity Bar view mirroring the same live repository state as the status bar and panel. */
export class RepositoriesTreeProvider implements vscode.TreeDataProvider<RepositoriesTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly getStatuses: () => RepositoryStatus[]) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: RepositoriesTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: RepositoriesTreeItem): RepositoriesTreeItem[] {
    if (!element) {
      return this.getStatuses().map((repo) => new RepositoryTreeItem(repo));
    }
    if (element instanceof RepositoryTreeItem) {
      return element.repo.conflicts.map((conflict) => new ConflictTreeItem(conflict));
    }
    return [];
  }
}

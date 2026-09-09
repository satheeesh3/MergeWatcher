import * as vscode from 'vscode';
import { RepoStatus } from './RepositoryStatus';

/**
 * Shared icon/label choices for repository status, used by both the Activity Bar tree
 * view and the QuickPick panel so the two surfaces always look consistent.
 */
export const STATUS_ICON: Record<RepoStatus, vscode.ThemeIcon> = {
  synced: new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green')),
  behind: new vscode.ThemeIcon('arrow-down', new vscode.ThemeColor('charts.blue')),
  conflict: new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.red')),
  error: new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red')),
  stopped: new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground'))
};

export const STATUS_LABEL: Record<RepoStatus, string> = {
  synced: 'Synced',
  behind: 'Behind',
  conflict: 'Conflict',
  error: 'Error',
  stopped: 'Stopped Watching'
};

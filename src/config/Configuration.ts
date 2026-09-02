import * as vscode from 'vscode';

export class Configuration {
  private static section(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('gitConflictWatcher');
  }

  static get enabled(): boolean {
    return this.section().get<boolean>('enabled', true);
  }

  static get intervalSeconds(): number {
    return this.section().get<number>('intervalSeconds', 30);
  }

  static get remote(): string {
    return this.section().get<string>('remote', 'origin');
  }

  static get notifyOnConflict(): boolean {
    return this.section().get<boolean>('notifyOnConflict', true);
  }
}

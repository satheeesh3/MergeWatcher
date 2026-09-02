import * as vscode from 'vscode';

export class Logger {
  private static channel: vscode.OutputChannel = vscode.window.createOutputChannel('Git Conflict Watcher');

  static info(message: string): void {
    this.write('INFO', message);
  }

  static warn(message: string): void {
    this.write('WARN', message);
  }

  static error(message: string): void {
    this.write('ERROR', message);
  }

  private static write(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    this.channel.appendLine(`[${timestamp}] [${level}] ${message}`);
  }
}

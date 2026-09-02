import { Logger } from './Logger';

export class ErrorHandler {
  static handle(context: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`${context}: ${message}`);
  }
}

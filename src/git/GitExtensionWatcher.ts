import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';

interface GitRepositoryState {
  readonly HEAD: { readonly commit?: string } | undefined;
  readonly onDidChange: vscode.Event<void>;
}

interface GitRepository {
  readonly rootUri: vscode.Uri;
  readonly state: GitRepositoryState;
}

interface GitAPI {
  readonly repositories: readonly GitRepository[];
  readonly onDidOpenRepository: vscode.Event<GitRepository>;
}

interface GitExtensionExports {
  getAPI(version: 1): GitAPI;
}

/**
 * Listens to VS Code's built-in Git extension and calls onChange (debounced) whenever a
 * repository's HEAD commit actually changes -- pull, commit, checkout, merge, reset -- so the
 * watcher refreshes promptly instead of only on its polling interval. Deliberately ignores
 * working-tree/staging churn (which also fires state.onDidChange) to avoid re-fetching every
 * repo on every file save.
 */
export function watchGitExtension(onChange: () => void, debounceMs = 1500): vscode.Disposable {
  const disposables: vscode.Disposable[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const scheduleRefresh = (reason: string) => {
    Logger.info(`[GitExtensionWatcher] ${reason}; scheduling refresh in ${debounceMs}ms`);
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      Logger.info('[GitExtensionWatcher] refresh firing now');
      onChange();
    }, debounceMs);
  };

  try {
    const ext = vscode.extensions.getExtension<GitExtensionExports>('vscode.git');
    if (!ext) {
      Logger.warn('[GitExtensionWatcher] built-in "vscode.git" extension not found; relying on the poll interval only.');
      return new vscode.Disposable(() => undefined);
    }

    const watchRepo = (repo: GitRepository) => {
      let lastCommit = repo.state.HEAD?.commit;
      Logger.info(`[GitExtensionWatcher] watching ${repo.rootUri.fsPath} (HEAD ${lastCommit ?? 'unknown'})`);
      disposables.push(
        repo.state.onDidChange(() => {
          const commit = repo.state.HEAD?.commit;
          if (commit !== lastCommit) {
            const from = lastCommit;
            lastCommit = commit;
            scheduleRefresh(`${repo.rootUri.fsPath} HEAD changed ${from ?? 'unknown'} -> ${commit ?? 'unknown'}`);
          }
        })
      );
    };

    const attach = (api: GitAPI) => {
      Logger.info(`[GitExtensionWatcher] git extension API ready; ${api.repositories.length} repositories currently known.`);
      api.repositories.forEach(watchRepo);
      disposables.push(api.onDidOpenRepository(watchRepo));
    };

    if (ext.isActive) {
      Logger.info('[GitExtensionWatcher] "vscode.git" already active.');
      attach(ext.exports.getAPI(1));
    } else {
      Logger.info('[GitExtensionWatcher] "vscode.git" not active yet; activating.');
      void ext.activate().then((exports) => attach(exports.getAPI(1)));
    }
  } catch (error) {
    Logger.warn(`[GitExtensionWatcher] failed to attach to "vscode.git": ${error instanceof Error ? error.message : error}`);
  }

  return new vscode.Disposable(() => {
    if (timer) {
      clearTimeout(timer);
    }
    disposables.forEach((d) => d.dispose());
  });
}

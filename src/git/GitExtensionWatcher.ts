import * as vscode from 'vscode';

interface GitRepositoryState {
  readonly HEAD: { readonly commit?: string } | undefined;
  readonly onDidChange: vscode.Event<void>;
}

interface GitRepository {
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

  const scheduleRefresh = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(onChange, debounceMs);
  };

  try {
    const ext = vscode.extensions.getExtension<GitExtensionExports>('vscode.git');
    if (!ext) {
      return new vscode.Disposable(() => undefined);
    }

    const watchRepo = (repo: GitRepository) => {
      let lastCommit = repo.state.HEAD?.commit;
      disposables.push(
        repo.state.onDidChange(() => {
          const commit = repo.state.HEAD?.commit;
          if (commit !== lastCommit) {
            lastCommit = commit;
            scheduleRefresh();
          }
        })
      );
    };

    const attach = (api: GitAPI) => {
      api.repositories.forEach(watchRepo);
      disposables.push(api.onDidOpenRepository(watchRepo));
    };

    if (ext.isActive) {
      attach(ext.exports.getAPI(1));
    } else {
      void ext.activate().then((exports) => attach(exports.getAPI(1)));
    }
  } catch {
    // Built-in Git extension unavailable or API mismatch; the timed poll still covers us.
  }

  return new vscode.Disposable(() => {
    if (timer) {
      clearTimeout(timer);
    }
    disposables.forEach((d) => d.dispose());
  });
}

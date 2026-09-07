# Merge Watcher

Automatically detects Git conflicts before pull/merge. No surprises.

The extension watches every Git repository in your workspace, follows the currently checked-out branch, periodically
fetches the corresponding remote branch, and compares local vs. remote changed line ranges since their common
merge base. If both sides touched overlapping lines in the same file, you get a warning before you ever run
`git pull`.

## Features

- Automatic discovery of Git repositories in the current workspace (including one level of subdirectories, for
  multi-repo folders).
- Live per-repository status (Synced / Behind / Conflict / Error / Stopped) shown in a status bar summary and a
  click-through panel — not just a one-shot toast.
- Warning notification, shown once per new remote commit, with **View Diff** (local vs. remote) and **Open File**
  actions.
- Conflict panel (click the status bar): lists every watched repository with a refresh button, and per-repository
  **Open File**, **Stop Watching** (this session), and **Resume Watching** actions.
- Repositories can be stopped for the current session from the panel, or permanently excluded via settings.
- Configurable polling interval, remote name, notification behavior, and concurrency (tunable down on
  lower-resource machines).

## Commands

- `Merge Watcher: Start Watching`
- `Merge Watcher: Stop Watching`
- `Merge Watcher: Check Now`
- `Merge Watcher: Show Status`
- `Merge Watcher: Resume Watching All Repositories`

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `mergeWatcher.enabled` | `true` | Enable or disable the watcher. |
| `mergeWatcher.intervalSeconds` | `30` | How often to fetch and check for conflicts. |
| `mergeWatcher.remote` | `"origin"` | The Git remote to compare against. |
| `mergeWatcher.notifyOnConflict` | `true` | Show a warning notification when a conflict is detected. |
| `mergeWatcher.excludedRepositories` | `[]` | Repository names or paths to permanently exclude from watching. |
| `mergeWatcher.maxConcurrentChecks` | `4` | How many repositories to check at once. Lower this on low-resource machines. |

## Development

```
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host, then open a folder containing one or more Git
repositories with a configured remote.

Run unit tests with:

```
npm test
```

Package a `.vsix` for local install/sharing with:

```
npx vsce package
code --install-extension mergewatcher-<version>.vsix
```

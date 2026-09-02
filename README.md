# Git Conflict Watcher

Proactively detects potential Git conflicts before you pull or merge remote changes.

The extension watches every Git repository in your workspace, follows the currently checked-out branch, periodically
fetches the corresponding remote branch, and compares local vs. remote changed line ranges since their common
merge base. If both sides touched overlapping lines in the same file, you get a warning before you ever run
`git pull`.

## Features

- Automatic discovery of Git repositories in the current workspace (including one level of subdirectories, for
  multi-repo folders).
- Configurable polling interval, remote name, and notifications.
- Status bar indicator showing watcher state and conflict count.
- Warning notification with **View Diff** (local vs. remote) and **Open File** actions.

## Commands

- `Git Conflict Watcher: Start Watching`
- `Git Conflict Watcher: Stop Watching`
- `Git Conflict Watcher: Check Now`

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `gitConflictWatcher.enabled` | `true` | Enable or disable the watcher. |
| `gitConflictWatcher.intervalSeconds` | `30` | How often to fetch and check for conflicts. |
| `gitConflictWatcher.remote` | `"origin"` | The Git remote to compare against. |
| `gitConflictWatcher.notifyOnConflict` | `true` | Show a warning notification when a conflict is detected. |

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

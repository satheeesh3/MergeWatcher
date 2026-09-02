# Changelog

All notable changes to the Git Conflict Watcher extension are documented here.

## [0.1.1]

### Changed
- Replaced the boolean "has conflicts" state with a full per-repository status model (`synced` / `behind` / `conflict` / `error` / `stopped`), including branch, ahead/behind counts, and last-checked time.
- The status bar always opens the conflict panel now, instead of only doing so when a conflict exists — clicking it while everything is clean no longer looks like a no-op.
- Status bar text no longer reads "Click to check now" on every idle cycle; it now shows a live "No conflicts · N repositories watched" summary.

### Added
- Conflict panel (status bar → QuickPick) now lists **every** watched repository, not just ones with conflicts, each with a status icon and a refresh button.
- Per-repository actions in the panel: Open File and View Diff (for conflicts), Stop Watching / Resume Watching (session-only).
- `gitConflictWatcher.excludedRepositories` setting to permanently exclude a repo by name or path.
- Repositories stopped for the session or excluded via settings still appear in the panel, marked "Stopped", instead of silently disappearing.

### Fixed
- The watcher now recomputes each repository's conflict state every cycle instead of only when the remote commit changes, so the status bar reflects live reality instead of being wiped back to "no conflicts" by the next no-op cycle.
- Notification de-duplication (one toast per new remote commit) is now tracked separately from the displayed state, so it no longer suppresses the panel/status bar from showing an unresolved conflict.

## [0.1.0]

### Added
- Initial MVP: automatic discovery of Git repositories in the workspace, current-branch tracking, periodic remote fetch, merge-base diffing, and overlapping-line-range conflict detection.
- Warning notification with View Diff and Open File actions when a conflict is detected.
- Start / Stop / Check Now commands and a basic status bar indicator.
- Settings: `enabled`, `intervalSeconds`, `remote`, `notifyOnConflict`.

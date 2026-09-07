# Changelog

All notable changes to the Merge Watcher extension (formerly "Git Conflict Watcher") are documented here.

## [0.1.12]

### Changed
- Display name is "Merge Watcher" (two words), not "MergeWatcher" — matches Marketplace naming conventions. Internal identifiers (package name `mergewatcher`, settings/commands `mergeWatcher.*`) are unaffected.

### Fixed
- Resume Watching triggered a full workspace refresh (re-fetching every repository) just to update the one repo being resumed, which made it noticeably slow on larger workspaces. It now checks only that single repository.
- The panel's busy spinner didn't actually block further clicks, so clicking Resume Watching (or anything else) again while an action was still in flight fired a second overlapping action, racing the UI state. Panel actions are now locked out until the current one finishes.
- `runCycle()` could resolve immediately against stale data if a manual Refresh/Resume happened to overlap a background cycle, instead of waiting for the queued rerun to actually finish.

## [0.1.8]

### Changed
- Renamed the extension from "Git Conflict Watcher" to "Merge Watcher". This changes the settings namespace (`gitConflictWatcher.*` → `mergeWatcher.*`) and all command IDs — if you had settings saved under the old keys, re-set them under the new names.

## [0.1.7]

### Changed
- `GitManager` now uses `execFile` instead of `exec`, invoking `git` directly instead of spawning an intermediate shell per command — roughly halves the OS process count per git operation.
- Folded the separate "does the remote tracking branch exist" check into the fetch attempt itself, removing one subprocess call per repository per cycle. `BranchManager` was a pure passthrough after this and has been removed.

### Added
- `gitConflictWatcher.maxConcurrentChecks` setting (default `4`) to cap how many repositories are checked at once — turn it down further on low-resource machines.

### Fixed
- Guard against a scheduled cycle starting while the previous one is still running (e.g. on a slow network), which could otherwise let cycles pile up and compound CPU/memory use.

## [0.1.6]

### Fixed
- The "N repositories watched" count included repositories the user had stopped watching, so stopping 2 of 12 still showed "12 watched" instead of 10. The status bar and panel now report the actually-watched count, with a "(N stopped)" suffix when applicable.

## [0.1.5]

### Added
- Visible busy feedback for Stop Watching / Resume Watching / Refresh in the panel — a placeholder message ("Stopping…", "Resuming… checking now", "Checking now…") with the busy spinner, held for a minimum duration so even the instant Stop Watching case is perceptible.
- "Esc to close" hint in the panel title.

## [0.1.4]

### Changed
- Collapsed the "stopped" repository row in the panel to a single line and renamed the label to "Stopped Watching", removing a redundant second detail line.

## [0.1.3]

### Fixed
- Stop Watching only updated in-memory state; the cached status list wasn't touched, so the panel kept showing the old status until the next full cycle happened to run. It now updates immediately.
- `runCycle` now checks repositories concurrently instead of one at a time, so a full refresh is bounded by the slowest single repository instead of the sum of all of them.

## [0.1.2]

### Fixed
- Repository discovery spawned a `git` subprocess per candidate folder, sequentially, on every poll cycle (~1s of blocking overhead for a 12-repo workspace). Replaced with a plain `fs.existsSync` check for a `.git` entry — no process spawn needed, ~1000x faster in testing.

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

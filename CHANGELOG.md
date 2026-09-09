# Changelog

All notable changes to Merge Watcher are documented here.

## [0.1.16]

### Improved

* Improved conflict monitoring and overall extension experience.

## [0.1.14]

### Added

* Conflict notifications and the status panel now show the actual commit author.

## [0.1.12]

### Improved

* Improved repository monitoring performance.
* Improved refresh and resume watching performance.
* Improved panel responsiveness and action handling.

## [0.1.7]

### Added

* Added a limit for concurrent repository checks to improve performance on larger workspaces.

### Improved

* Improved Git operations and repository monitoring efficiency.
* Prevented overlapping monitoring cycles from running simultaneously.

## [0.1.6]

### Fixed

* Fixed repository count when repositories are stopped from monitoring.

## [0.1.5]

### Added

* Added visual feedback when stopping, resuming, and refreshing repositories.
* Added **Esc to close** support in the conflict panel.

## [0.1.3]

### Improved

* Improved multi-repository checking performance.
* Repository status now updates immediately after stopping monitoring.

## [0.1.2]

### Improved

* Improved Git repository discovery performance.

## [0.1.1]

### Added

* Added live status tracking for each repository.
* Added **Synced, Behind, Conflict, Error, and Stopped** repository statuses.
* Added conflict panel showing all monitored repositories.
* Added **Open File**, **View Diff**, **Stop Watching**, and **Resume Watching** actions.
* Added support for permanently excluding repositories.

### Fixed

* Improved conflict status tracking and notification handling.

## [0.1.0]

### Added

* Initial release of Merge Watcher.
* Automatic Git repository detection.
* Remote branch monitoring.
* Potential conflict detection.
* Conflict notifications with **View Diff** and **Open File** actions.

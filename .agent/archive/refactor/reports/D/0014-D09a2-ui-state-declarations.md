# Agent D report 0014: D-09a2, shared UI variables moved to one classic file

Step: D-09a2 (the option recommended in report 0013, section 1). **Needs A's OK before it is applied**, because it changes where A's setters find their variables (nothing in `core/` is edited). Applies on `Xplayer-main_12` (D-0010 to D-0012 already in). No commit, no push.
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup` is not reachable from my environment.

## Changes

- New classic script `src/js/04a0-ui-state.js` (same pattern as B's `10a0-shuffle-state.js`), listed in `src/manifest.json` just before `04a`. It declares the 13 variables that other files read or assign by bare name:
  `hoveredSongIndex`, `selectedSongId`, `lastSelectedIndex`, `selectionHighlights` (were in 04a); `activeContextMenuSlot`, `currentContextSongId` (06a); `downloadNotifyIndex` (06b); `lastMouseX`, `lastMouseY` (06c); `notificationPanelOpen`, `notificationHistory` (06j); `isNavigatingHistory` (07-views); `VIRTUAL_SCROLL_THRESHOLD` (05a).
- The `let` lines were deleted from 04a, 06a, 06b, 06c, 06j and 07-views. Nothing else in those files changed.
- `05a`: `let VIRTUAL_SCROLL_THRESHOLD = (function ...` became `VIRTUAL_SCROLL_THRESHOLD = (function ...` (same computation, same place; the declaration with a placeholder `0` is in `04a0`). Nothing reads it between the two files at load.
- Initial values are unchanged (`-1`, `null`, `[]`, `0`, `false`). The setters in `core/state-ui.js` and `core/state-navigation.js` need no change: the names are still global `let` bindings, only declared one file earlier.
- `tools/change.log.txt`: entry added.

## Why it is safe

Classic scripts share one global scope, so every read and write by name resolves as before. The only difference is the file that holds the declaration. `dep-map`: load-time references stay at 28, forward references 0. `event-audit --strict` exits 0.
After this patch, D-09b can move `06c`, `06j`, `06d`, `06e`, `06h` without the module-scope problem for shared variables; D-09d (06a, 06b) and D-09g, D-09h, D-09i get the same benefit. A-16 moves these 13 lines into the state modules.

## Tests actually run

- `manifest`, `setters`, `ui-handlers`, `scroll`, `converted-modules`: 60 pass, 0 fail (1 skip written into a test).
- Full suite (`node --test tools/tests/*.test.js`): **307 tests, 305 pass, 0 fail, 2 skipped** (the same two skips as before).
- Not run: real Electron.

## Needs from other agents

- **A:** accept `04a0-ui-state.js` (or ask for a different name or place), and add one line to `core/SETTERS.md` saying the UI variables are declared there. I did not edit A's docs.
- Still open from report 0013: the two-line `ui/player-bar.js` change (section 3), needed before D-09b moves `06h` and before D-09d moves `06k`; and the `updateExternalScrollbar` implicit global (section 2), which I fix inside D-09b.

## For you (manual checks)

1. Open the app, click and ctrl/shift-click song rows (selection and keyboard selection still work), hover rows (highlight follows the mouse).
2. Right-click a song, a playlist; use the context menu items.
3. Open the notification panel, run a download or cover update (progress notification), clear notifications.
4. Back and forward buttons (history), Settings: the virtual scroll threshold slider shows the saved value.
5. Console: no `... is not defined` errors.

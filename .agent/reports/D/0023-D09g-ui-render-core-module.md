# Agent D report 0023: D-09g, 04a as an ES module (plus the step 2 decisions)

Steps: D-09g, and the three decisions of PLAN2 step 2. Applies on top of the tree with D-0021 and D-0022 already applied (D-09e and D-09f). No commit, no push.
Archive (.agent/AGENTS.md section 1): **not done as specified**, `E:\Backup` is not reachable from this session. A full copy of the tree before any edit was made next to the project (`Xplayer-main.backup-before-plan2`); please also make the real archive snapshot.

## Step 2 decisions (checked, no code change needed)

- Owners of the 13 shared live `let`s: all are declared once in the classic `04a0-ui-state.js` and assigned by name from A's setters. The rule is now written in `PLAN.md` section 5.
- `06c` implicit global: already `window.updateExternalScrollbar = updateScrollbar;`.
- `ui/player-bar.js`: already a module placed after `06h` and `06k`; `player-bar.test.js` passes.

## Changes

- `04a-ui-render-core.js`: `export` on the 30 top-level functions; guarded `registerLegacyGlobals` at the end for the 30 functions and `selectedSongIds` (a Set that is changed in place and never reassigned; `05a`, `06a`, `06f`, `06k`, `17` and tests read it by bare name). Nothing else changed. No inline `on...=` strings exist in the file.
- `src/manifest.json`: `04a` moved from `"js"` to `"modules"`, after `07a-ui-actions.js` and before `06a-context-menus.js`. The Ctrl+A keydown listener therefore still runs after the bridge and before the `06a` and `06k` listeners.
- `tools/tests/expected/events-b.json`: one `updateHeroSongCount` removed from each of 4 scenarios (favorites sync, favorites toggle, library songs changed, mutation refresh in Favorites). It is the call `04a` makes to its own function, which a spy on `window` can no longer see. No other name changed in any of the four baseline files (checked by comparing every scenario).
- New `tools/tests/ui-core-render-module.test.js` (7 tests, 1 in a real page: names on window, shared Set, Ctrl+A selects, clear empties).
- `change.log.txt`, `PLAN.md`, `BOARD.md` (D-09g `patch received`), new `PLAN2.md`.

## Numbers

`dep-map.js`: load-time cross-file references 27 (forward 0), mutable globals assigned from other files 58, file-level cycles 81. No classic file references a `04a` name while loading.
`event-audit --strict`: exit 0 (A 0, B 0, C 0; 70 allowed exceptions).
Lint: 0 errors, 1 warning (`06a`, unused `currentContextPlaylistId`; not touched).

## Tests actually run

- `manifest`, `listener-order`, `converted-modules`, `render-modules`, `setters`: 38/38.
- `events-a/b/c/d`, `ui-handlers`, `scroll`, `search-ui`, `view-switch-song-list-cleanup`, `keyboard-shortcuts`, `playback-modules`, `ui-storage-api`, `drag-drop`, `lyrics-panel-handlers`, `playback-handlers`, `context-menu`, `modal-close`, `player-bar`, `event-subscribers-modules`, `ui-leaf-modules`: 179 of 181 passed on the first run, 1 skipped, 1 failed (`events-b`, the four removed calls above); after re-recording `events-b` passes.
- New test: 7/7. Sabotage check (selection registration removed, restored afterwards): the new test and `scroll.test.js` fail (2 failures).
- Not run: the full suite, and a real Electron window.

## Needs from other agents

- none

## Not done

- Full suite and the smoke checklist in Electron.

## For you (manual checks)

1. Start the app; no console errors.
2. Open Songs, press Ctrl+A with focus outside a text box: all rows highlight; click one row: only it stays selected.
3. Hover rows: the hover highlight follows the mouse and survives scrolling; the playing song keeps its highlight when you change view and come back.
4. Right-click a row: context menu opens; Ctrl+A in the search box selects the text only.
5. Switch to Favorites, Albums, Playlists and back: song counts in the hero line are right.

## Next step

D-09h (virtual scroll: `05c`, `05a`, `05b`). Keep `05a` before `05c` in `"modules"`.

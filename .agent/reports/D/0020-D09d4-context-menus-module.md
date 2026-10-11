# Report 0020: D-09d part 4, `06a-context-menus.js` as an ES module (D-09d finished except the Electron run)

Step: last file of D-09d. **Applies on top of D-0016 to D-0019** (`D09-next`, `D09d-1-modal-close-cleanups`, `D09d-2-keyboard-player-bar-modules`, `D09d-3-modals-module`, in that order). Independent of the lint patch. No commit, no push.
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup` is not reachable from my environment. `.agent/BOARD.md` and `tools/change.log.txt` are not edited; please add the entries.

## Changes

- `06a-context-menus.js`: `export` on nine functions (`showContextMenu`, `closeContextMenu`, `showLeftPanelItemContextMenu`, `showSpecialItemContextMenu`, `showPlaylistContextMenu`, `showFolderContextMenu`, `showAlbumContextMenu`, `showArtistContextMenu`, `showSubheroContextMenu`) and on the constant `CONTEXT_MENU_TYPE_LABELS` (read by `06g`), and a guarded `registerLegacyGlobals` for those ten names. The file's six `registerActions` entries and its four `document` / `window` listeners are unchanged and still run while it loads. The other 18 top-level names (helpers, the three `let`s, `CONTEXT_MENU_ACTIONS`) are used by no other file and are now private. A scan found no assignment to an undeclared name except `currentContextSongId` and `activeContextMenuSlot`, which are global `let`s in `04a0-ui-state.js` (so the step I listed in report 0017 for them was not needed, as 0018 already noted).
- `src/manifest.json`: moved from `"js"` to `"modules"`, right after `06i-theme-switcher.js`, i.e. before `06c`, as report 0015 required.
- `tools/tests/converted-modules.test.js`: the nine functions in the registered list, `CONTEXT_MENU_TYPE_LABELS` in the registered constants (compared by value).
- `tools/tests/ui-handlers.test.js`: see "One test changed".
- New `tools/tests/context-menu.test.js` (5 tests) and `tools/tests/listener-order.test.js` (5 tests).

## Listener order: the plan's condition, now tested at run time

The plan said to keep the `mousedown` / drag listener order. Report 0018 argued it from a static scan. `listener-order.test.js` now records, in a real page, which file added each `document` / `window` listener (from the stack trace) and checks the order that has to hold: `keydown` = bridge, `04a`, `06a`, `06k`; `mousedown` = bridge, `06a`, `06k`; `click` = bridge, `06a`, `06d`, `09-folders-playlists`; `resize` = `06a`, `ui/layout`, `19-online-lyrics`. **Run on the classic version (before D-09d part 2: 5 pass) and on the finished module version (5 pass).** Sabotage check (restored afterwards): listing `06a` after `06k` in the manifest makes three of them fail.

## One test changed

`ui-handlers.test.js` "context menus: items call their function and then close the menu; play items close first" recorded `closeContextMenu()` through a replacement on `window` and expected it after each item's own call. The close is made by the context-menu file with its own `closeContextMenu`, which a replacement on `window` cannot see (the same effect as in 0019). The test now checks the same two facts by their effect: after each of the eight items is used the menu is gone, and when a "play" item's function runs the menu is already closed. The calls to the other functions are asserted as before. This version passes on the classic and on the module code.

## Proof that behavior did not change

- `context-menu.test.js` (right-click opens one menu and stores the song id, Escape closes it and clears the id, another right-click replaces the menu, a click outside closes it while a click on its padding does not, shrinking the window keeps it inside, Escape goes to an open notification panel first) was run on the classic `06a` (5 pass) and on the module (5 pass). Its first draft of the "replaces" test failed identically on both because of my click position; I fixed the position, not the app.
- Sabotage checks: see the listener-order paragraph above; the existing `converted-modules` checks fail if a registered name is missing.
- `lint-globals`: 918 -> 900 names (counts: classic 351, registered 549). `dep-map.js`: load-time references 27, forward 0 (unchanged). `event-audit --strict` exits 0.

## Tests actually run: whole D-09d series (state after parts 1 to 4, plus D-09c)

- **Full suite (`npm test`): 396 tests, 394 pass, 0 fail, 2 skipped, exit 0** (520 s). The same two skips as in every earlier run (`a tiny thumb nudge shows real rows only` and `storage getters fall back to empty arrays`).
- The count is the 328 tests of the original tree plus what the patches add: D-09c 17, part 1 26, part 2 10, part 3 5, part 4 10 (the other change in part 3, `modal-close`, is included in the 26).
- Not run: real Electron.

## What D-09d leaves

- **The planned real Electron run** (file:// module loading, keyboard shortcuts, every dialog, context menus, a download with its progress notification, the welcome dialog). Manual checks beyond the earlier lists: open a context menu on a song, a playlist, a folder, an album and an artist, and close each with Escape, an outside click and by using an item; press S, R, M, Ctrl+Up and Ctrl+Down; use the mouse back and forward buttons; start a download from "Add link" and watch the progress notification; start the app with an empty library and check the welcome dialog.
- Everything else in D-09: e (renderers `04b` to `04g`, `07a`), f (event subscribers), g (`04a`), h (virtual scroll), i (`07-views` and the full check).

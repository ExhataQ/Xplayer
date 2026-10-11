# Report 0018: D-09d part 2, `06k` and `ui/player-bar.js` as ES modules

Step: second part of D-09d. **Applies on top of D-0016 (D-09c, `D09-next.patch`) and D-0017 (D-09d part 1, `D09d-1-modal-close-cleanups.patch`)**: the manifest edit sits next to the lines D-09c changed. Independent of the lint patch. No commit, no push. Per your instruction I treat all files as mine, so this patch also edits `ui/player-bar.js`.
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup` is not reachable from my environment. `.agent/BOARD.md` and `tools/change.log.txt` are not edited; please add the entries.

## Correction to report 0017

0017 listed "move `activeContextMenuSlot` and `currentContextSongId` to `core/state-ui.js`" as a step still to do. It is not needed: both are already declared in `04a0-ui-state.js` (D-09a2 did that, after the survey in 0013 was written). `06a` only assigns them, which a module may do to a global `let`. The other top-level names in `06a` (`activeContextMenu`, `currentContextPlaylistId`, `contextMenuMouseDownOutside`, `CONTEXT_MENU_ACTIONS`) are used by no other file; `CONTEXT_MENU_TYPE_LABELS` is used by `06g` and gets registered when `06a` is converted.

## Changes

- `06k-keyboard-shortcuts.js`: `export` on `initMarqueeOnHover` and a guarded `registerLegacyGlobals({ initMarqueeOnHover })` at the end. Nothing else. (A scan found no assignment to an undeclared name, no `this`, no `arguments`.)
- `ui/player-bar.js`: becomes a module (`export {};` at the end, as `06e` did) and its header comment says why it must come after `06k`. The `typeof initMarqueeOnHover` guards stay as they were. This file ran while the page loaded and had to find `initMarqueeOnHover`; once `06k` is a module that function only exists after all classic scripts have run, so the marquee would have stopped silently. As a module placed after `06k` it runs in the same phase (before `DOMContentLoaded`) and the function exists. Its top-level `const`s (`playerTitle`, `playerArtist`, `playerCover`, `albumArtImage`) are used by no other file.
- `src/manifest.json`: both files moved from `"js"` to `"modules"`, right after `06j-notification-system.js`, `06k` first, then `player-bar`.
- `tools/tests/converted-modules.test.js`: `initMarqueeOnHover` added to the registered names.
- New `tools/tests/player-bar.test.js` (4 tests) and `tools/tests/keyboard-shortcuts.test.js` (6 tests).

## Listener order (the plan's condition)

A scan of every top-level `addEventListener` in manifest order shows that the only document-level `keydown` listeners are `04a`, `06a` and `06k`, and the only document-level `mousedown` listeners are `06a` and `06k`. After this patch the order is still `04a`, `06a` (classic), then `06k` (module). No module registers `keydown` or `mousedown` on `document`, so putting `06k` after `06j` changes nothing. `player-bar` registers only element listeners.

## Proof that behavior did not change

- `player-bar.test.js` (marquee flags set on the title and artist, the search button wired, hovering text wider than its box starts the scroll, right-click on title, artist and cover opens the context menu of the current song and only when there is one) and `keyboard-shortcuts.test.js` (S and R click their buttons, M mutes and unmutes, Ctrl+Up/Down move the volume by a tenth, plain arrows do nothing without a track, nothing fires while typing in an input, mouse buttons 3 and 4 call `goBack` / `goForward` only when allowed and leave other buttons alone, Home/End/PageUp/PageDown scroll `.content`) were run on the **classic version first: 10 pass; and after the conversion: 10 pass**.
- Sabotage check (restored afterwards): with `player-bar.js` listed before `06k`, 3 of the 4 player-bar tests fail (the marquee never starts).
- `lint-globals`: 931 -> 927 names (the four player-bar constants are no longer global). `dep-map.js`: load-time references 27, forward 0 (unchanged). `event-audit --strict` exits 0.

## Tests actually run

- `player-bar` 4/4, `keyboard-shortcuts` 6/6, `converted-modules` + `manifest` + `ui-leaf-modules` 28/28 on the converted tree.
- Full suite: run once at the end of D-09d (see the last report of the series).
- Not run: real Electron (planned after D-09d).

## Still to do for D-09d

Convert `06b` (part 3), then `06a` (part 4), then one real Electron run.

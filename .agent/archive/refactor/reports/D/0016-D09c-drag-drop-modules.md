# Agent D report 0016: D-09c, drag and drop as ES modules (06f, 06g)

Step: D-09c, the next unfinished item in the D-09 list (`.agent/PLAN.md`, line "D-09c Drag and drop: `06f`, `06g`. Keep the `mousedown`/drag listener order."). **Applies on top of D-0015 (D-09b)**, which is already in the tree this was made from. It does **not** depend on the lint patch (`D-lint-fixes.patch`); the two touch no common file. No commit, no push.
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup` is not reachable from my environment. `.agent/BOARD.md` and `tools/change.log.txt` are not edited; please add the entries.

## Why this step

Report 0013 (section on D-09c) found nothing blocking: each file is one top-level function (`initSongDragToLeftPanel`, `initLeftPanelDragAndDrop`), neither registers a listener or holds state while loading, neither assigns a global by bare name, and the only caller is the `DOMContentLoaded` handler in `99-player.js`, which runs after all modules. So the step is the same mechanical conversion as D-09b, with no logic edits. D-09d (`06a`, `06b`, `06k`) is the next step and needs a real Electron run, so it was not started.

## Changes

- `06f-drag-drop-songs.js`, `06g-drag-drop-left-panel.js`: `export` on the one function each, and a guarded `registerLegacyGlobals({ name })` at the end, the same pattern as `06h`. Nothing else changed.
- `src/manifest.json`: both files moved from `"js"` to `"modules"`, placed between `06e` and `06h` (their old relative order).
- `tools/tests/converted-modules.test.js`: the two names added to the registered list.
- New `tools/tests/drag-drop.test.js` (12 tests, real page) and `tools/tests/drag-drop-modules.test.js` (5 tests, 1 in a real page).

## Proof that behavior did not change

- `drag-drop.test.js` drives the real mouse. It covers song to Liked Songs (ghost and drag styling during the drag, cleared afterwards), song to a playlist (added once, a second drop adds nothing), a multi-selection drag ("2 items"), drop on empty left-panel space, drop over the song list (nothing changes), a press under the 5px threshold, a right-button press, window `blur` mid-drag (cancels and cleans up), pinned-item reorder (top and bottom half), pinning an unpinned item by dropping it on a pinned one, and a pinned-item drag that ends over the song list (no pin change). **It was written and run on the classic files first (12 pass), then run unchanged after the conversion (12 pass).**
- Sabotage check (restored afterwards): without the `06f` registration, 14 of the 17 new tests fail (start-up throws `ReferenceError`).
- Listener order: neither file registers a listener while loading, so the manifest move cannot change any order. The `mousedown`/drag listeners are still added when `99-player.js` calls the two init functions, in the same order as before.
- `lint-globals`: 928 global names before and after (classic 413 -> 411, `registerLegacyGlobals` 515 -> 517). `dep-map.js`: load-time cross-file references 27, forward 0 (unchanged from D-0015). `event-audit --strict` exits 0.

## Tests actually run

- Focused: `drag-drop` 12/12, `drag-drop-modules` 5/5, `converted-modules` + `manifest` 17/17.
- Full suite (`npm test`): **345 tests, 343 pass, 0 fail, 2 skipped, exit 0** (484 s). The 2 skips are the same ones as before this change (`a tiny thumb nudge shows real rows only` and `storage getters fall back to empty arrays`).
- Not run: real Electron (the plan asks for it after D-09d).

## Things I saw and did not change

These are in the files as they were; the tests pin the current behavior, so a later change will be visible.

1. Dropping a song on a left-panel item that cannot take songs (an album) is not a hover target, but the drop then counts as "dropped on the panel" and **likes the song**. `drag-drop.test.js` records this as current behavior.
2. In `06f`, `onMouseUp` removes the `mousemove` and `mouseup` listeners but not its `once` `blur` listener, so each finished drag leaves one until the window next loses focus. Harmless today (the leftover handler only clears the same shared styling), but it is a small leak per drag.
3. In `06f`, the `else` branch of the `mousemove` handler calls `leftPanel.classList.remove(...)` without the null check used elsewhere; `leftPanelElement` is always set after start-up.

## For you (manual checks)

1. Start the app; no console errors.
2. Drag a song onto Liked Songs and onto a playlist: ghost follows the cursor, the target highlights, a notification appears. Drag several selected songs: the ghost says "N items".
3. Drag a song over the queue panel: the insert line shows and the song lands where the line was.
4. Reorder pinned left-panel items; drop a playlist onto a folder; drag a playlist out of a folder.
5. Alt-tab in the middle of a drag: the ghost disappears and nothing is added.

## For D-09d

Unchanged from D-0015: insert `06a` in `"modules"` before `06c`, `06k` after `06d`, `04a` before `06a`. `06f` and `06g` are placed before `06h`, so none of that is affected.

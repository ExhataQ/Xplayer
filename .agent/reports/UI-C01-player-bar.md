# Report UI-C01: player bar (first Phase 2 patch from Agent C)

**Agent:** C
**Date:** 2026-10-17
**Status:** Ready for review. The manual checklist below is not done yet. Part of C-01 only: see "Not done, and why".

## What changed and why

Phase 1 is treated as finished, as instructed; no Phase 1 row on the board was edited. Agent C owns `views/playback/` and may not edit `adapter/`, `shell/`, `components/`, `index.html`, `src/js/` or `src/css/` (PLAN.md sections 2 and 5). The player bar's elements are built by the adapter and keep the engine's names, and the adapter API (`store`, `actions`, `events`, task A-04c) is not in the tree I was given. So the part of C-01 that can be done today without touching A's files is **styling**: one new stylesheet, `src/ui-next/views/playback/player-bar.css`, that adds or corrects and removes nothing from `shell.css`.

It does three things:

1. **Seek tooltip (defect fix).** The engine appends `.custom-tooltip.progress-tooltip` to `<body>` while the pointer is over the seek bar or the bar is dragged, and positions it with inline `left`, `top` and `transform` in viewport pixels, relying on the old stylesheet for `position`. ui-next does not load that stylesheet. Measured before the change, 1400x860 window, hovering the bar: `position: static`, box x -700, y 840, 1400 wide, 20 high, i.e. outside the visible window. After the change it is `position: fixed`, token-styled like the shared tooltip, above the bar and centered on the pointer, also at both ends of the bar and while dragging.
2. **Toggle marker.** An active shuffle or repeat button (the engine sets `.active`) also gets a 4 px dot under its glyph, so the state is not carried by the accent color alone (DIRECTION.md and PLAN.md rule 8 spirit). The play button never gets one.
3. **Nothing-loaded state.** With an empty queue, previous, next and the seek bar are dimmed (`--control-disabled-opacity`). The reason is in the engine: `15d` returns early when the queue is empty and `15f` `startSeek` returns without a duration. Play, shuffle and repeat stay normal. Controls stay clickable; only the look changes, because the engine decides what a click does.

## Changed files

New:
- `src/ui-next/views/playback/player-bar.css`
- `tools/tests/ui-next-player-bar.test.js` (8 tests: 2 static, 6 real browser)
- this report

Edited:
- `.agent/BOARD.md`: Phase 2 rows C-01, C-03, C-04, the Blockers section (requests R-C1 to R-C6) and the Reports table. Nothing under "Phase 0", "Phase 1" or "Decisions" and not the "Current phase" line.

## Excluded on purpose

- `src/ui-next/index.html`: the stylesheet is not linked. That file is A's (request R-C1). The test links it into its own copy of the page.
- `tools/CHANGELOG.md` (integration owner), `src/js/`, `src/css/`, `electron/`, `build/`.
- No archive snapshot made by me: the project folder is not reachable from here (same situation as P0-03). Snapshot before applying (AGENTS.md section 1).

## Checks

Environment: Linux sandbox, Node 22, Playwright 1.56 with its bundled headless Chromium, one run each, the fixture engine from `tools/tests/helpers/app-fixture.js` with a stubbed `electronAPI`. **Not run in Electron.**

| Command | Result |
|---|---|
| `node --test tools/tests/ui-next-player-bar.test.js` | 8 of 8 pass |
| same, with the stylesheet left out of the page (`XPLAYER_TEST_WITHOUT_PLAYER_BAR_CSS=1`) | 5 fail, 3 pass: the 5 behavior tests fail, the 2 static tests and the seek regression test pass. So the tests can fail |
| `node --test tools/tests/ui-next-shell.test.js` (includes gate 13, which scans every file under `src/ui-next/`) | 17 of 17 pass |
| `node --test tools/tests/ui-next-components.test.js` | 26 of 26 pass |
| `node --test tools/tests/ui-next-components-behavior.test.js` | 63 of 63 pass |
| `node --test tools/tests/ui-next-tokens.test.js` | 23 of 23 pass |

First run of the new browser tests had one failure, in my own test (it moved the pointer to the right edge of the bar, which is outside the element, so the engine never showed a tooltip). Fixed in the test; no stylesheet change was needed.

**Not run:** `tools/tests/lint.test.js` and the other files that need `acorn` (this checkout has no `node_modules` and the sandbox has no network); the full suite; Electron. Please run `npm test` on your machine, in particular `lint`, which has not seen `src/ui-next/views/`.

## Findings (verified in the fixture app, not only read in code)

1. **Seek tooltip off screen.** Fixed here (see above).
2. **The engine's old tooltip system is running in ui-next.** `06d` and `06e` still move `title` into `data-original-title` and append `.custom-tooltip` nodes on hover. Hovering Next gives one node with text "Next", `position: static`, box x -700, y 840, 1400 by 20 (a strip at the bottom edge, text centered on x = 0, so it is effectively not seen). The shared tooltip component (A-05) is not attached to any player control yet. Owner: A (A-08): switch the old system off in the new shell or restyle it. Not touched here.
3. **Queue toggle throws.** `toggleRightPanel()` reads `.queue-toggle-btn` without a guard; the adapter does not create it: `Cannot read properties of null (reading 'classList')`. Matters for C-03.
4. **Fullscreen viewer throws.** `openImageViewer()` needs `#image-viewer` and `#viewer-image` (they exist only in the old `build/music_player.html`): `Cannot set properties of null (setting 'src')`. It is also unreachable today: its trigger is a click on `#album-art-image`, which is in the hidden host, and a click on `#player-cover` runs `openTagsTab`. The old `fullscreen-viewer.css` is not loaded either. Matters for C-04.
5. **Space is taken from focused buttons.** `06k` calls `preventDefault()` on Space at document level and toggles play, so Space on a focused Next button toggles play instead of pressing Next (Enter works). Engine behavior; not changed. Needs a decision before the new bar can claim keyboard accessibility.
6. **Shortcut labels for tooltips (from `06k`, for C and A-08):** Space play and pause, S shuffle, R repeat, M mute, L lyrics, Left and Right 5 seconds (Shift: 30), Ctrl+Up and Ctrl+Down volume (10 percent). Previous and next have no keyboard shortcut in the renderer; none should be shown.
7. **The seek tooltip overlaps the transport row.** The engine places it 2 px above the bar, and the bar is 4 px under the buttons, so near the middle of the bar it covers the play button. It is transient and `pointer-events: none`. Moving it is not possible without overriding inline `top` or `transform` (L-05).
8. **Seek and volume have no keyboard or screen-reader semantics** (`.progress-container` and `#volume-slider` are plain `div`s, no role or value). Fixing that needs an element reference and a time source, both A's (R-C4).

## Requests to Agent A (also on the board)

| ID | Request | Needed for |
|---|---|---|
| R-C1 | Link `views/playback/player-bar.css` in `index.html`, after `adapter/legacy-icons.css`. Nothing in `shell.css` has to be removed. | C-01 takes effect |
| R-C2 | A-04c API as in PATCH-PLAN P5: `store` (current song, queue and index, playing, volume, muted, repeat mode, shuffle), `actions` (play or pause, next, previous, seek by fraction, set volume, toggle mute, toggle repeat, toggle shuffle, play from queue, remove from queue, add to queue) and allow-listed `events` (`playback:stateChanged`, `queue:changed`, `queue:indexChanged`, `queue:songsChanged`, `shuffle:changed`). Not in the tree I received. | all JS in C-01 to C-04 |
| R-C3 | A time source: one adapter-owned reader of `timeupdate`, `duration` and the buffered ranges (L-04), exposed as `onTime(callback)` with `{ currentTime, duration }`. It is not in P5's list. | C-02 waveform progress, seek value for screen readers |
| R-C4 | A way to give C the player's elements without id lookups in `views/` (gate 13): for example `data-part` attributes on the adapter's player nodes, or adapter functions that return them. | tooltips with state and shortcut on transport (C-01), seek and volume semantics |
| R-C5 | The elements the engine looks up for the queue and the viewer: either provide `.queue-toggle-btn`, `#image-viewer` and `#viewer-image` in the adapter, or confirm that C builds both surfaces from `store` and `actions` and never calls `toggleRightPanel()` or `openImageViewer()`. C recommends the second for the viewer (it is small) and a decision after a short map for the queue (it has manual and automatic sections, a display limit and shuffle refill, `10c`). | C-03, C-04 |
| R-C6 | Decide what happens to the engine's old tooltips (finding 2) and the engine `title` attributes it writes on the play button and the volume icon. | tooltips (A-08), C-01 follow-up |
| R-C7 | Icons: `zoom-in` for the viewer. More when C-03 starts. | C-04 |

## Not done, and why

- **Tooltips with state and shortcut on the transport buttons, queue button, seek and volume semantics, waveform host:** need R-C2, R-C3 and R-C4. Doing it with `getElementById` would break gate 13 and the adapter boundary, and doing it by editing the adapter is A's work.
- **C-02 (waveform):** waits for D15 as on the board. I did not write code that depends on the source.
- **C-03 and C-04:** not started; findings 3 and 4 and R-C5 are the preparation.

## Manual checklist (needs the real app; Electron not run)

1. Start with `--ui=next`, after R-C1 is applied. With no song loaded: the previous, next buttons and the seek bar look dimmed; play, shuffle, repeat look normal.
2. Click Play on any song. The dimmed controls return to normal.
3. Move the pointer slowly along the seek bar. A small time label follows the pointer above the bar, fully on screen, also at both ends. Press and drag: the label keeps following and shows the time under the pointer. Release: it disappears.
4. Click Repeat once. The icon turns amber and a small dot appears under it. Click again (repeat one): the dot and the small "1" show. Click again: both disappear. The same dot appears for Shuffle after you choose a shuffle mode.
5. Click at about 80 percent of the seek bar while playing: the song jumps there and keeps playing.
6. Switch themes (if you have the developer gallery open): the label and the dot use the theme's colors.

## Follow-ups

- C-01 second patch after R-C2 to R-C4: tooltips, seek and volume semantics, the queue button and lyrics button states.
- Short map of the queue panel (`10c`, `08d`, `renderRightPanelItem`) before C-03, as B-01 did for the list.
- Decision needed from you or A on finding 5 (Space on focused buttons), which is an engine change.

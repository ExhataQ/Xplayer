# Agent D report 0024: D-09h, virtual scroll as ES modules (05a, 05b, 05c)

Step: D-09h. Applies on top of D-0023 (D-09g). No commit, no push.
Archive (.agent/AGENTS.md section 1): **not done as specified**, `E:\Backup` is not reachable from this session. A full copy of the tree before the first edit was kept in the session only; please make the real archive snapshot.

## Changes

- `05c`, `05a`, `05b` (converted in that order, `scroll.test.js` after each): `export` on every top-level function; a guarded `registerLegacyGlobals` at the end of each file. Nothing else changed in the three files.
  - 05a also registers `ITEM_HEIGHT`, `DEFAULT/MIN/MAX_VIRTUAL_SCROLL_THRESHOLD`, `VIRTUAL_SCROLL_SETTLE_MS`, `virtualScrollState`.
  - 05b also registers `LEFT_ITEM_HEIGHT`, `LEFT_OVERSCAN_COUNT`, `leftPanelVirtualState`.
  - 05c also registers `SMART_LYRICS_ITEM_HEIGHT`, `smartLyricsVirtualState`.
  - The three state objects are `let` but are changed in place and never reassigned (the new test checks every source file), so the registered reference stays live.
- `VIRTUAL_SCROLL_THRESHOLD` stays declared in the classic `04a0-ui-state.js`; `05a` still assigns it at load (now when the module runs, before `DOMContentLoaded`). Nothing reads it earlier (`08e` reads it when Settings is drawn).
- `src/manifest.json`: moved from `"js"` to `"modules"`, in the order `04a`, `05a`, `05b`, `05c`, then `06a`. `05a` is before `05c`, which reads `ITEM_HEIGHT` while loading.
- `tools/tests/scroll.test.js`: the render log is built from the DOM (a `MutationObserver` on `#song-list`: a batch of added rows with a skeleton is `PH`, otherwise `REAL`) instead of a spy on `window.renderVisibleItems`, which cannot see calls made inside `05a`. The same test file passes (15 pass, 1 skipped) on the classic version of `05a` and on the module version, so the change is in the measurement, not in what is measured.
- `tools/tests/expected/events-a.json` and `events-b.json`: 5 `renderLeftPanelVisibleItems` entries removed from each (5 scenarios); `events-wiring.test.js`: 18 entries of the same name removed from 7 sequences (comment added). They are calls made inside `05b`, invisible to the spy. Compared scenario by scenario: nothing else changed; `events-c` and `events-d` are unchanged. `reapplySelectionState` (05a) was not in any baseline.
- New `tools/tests/ui-virtual-scroll-modules.test.js` (10 tests): manifest order, exports and registrations, state objects never reassigned, no work at load other than assignments, names on window, row heights, default threshold at start-up, `setVirtualScrollThreshold` updating the classic variable.
- `change.log.txt`, `PLAN.md`, `BOARD.md` (D-09h `patch received`), `PLAN2.md`.

## Numbers

`dep-map.js` before and after: mutable globals written from other files 58 and 58, file-level cycles 81 and 81, load-time cross-file references 27 (forward 0) and 27 (forward 0).
`event-audit --strict`: exit 0 (A 0, B 0, C 0; 70 allowed exceptions). Lint: 0 errors, 1 warning (`06a`, untouched).

## Tests actually run

- Full suite (`npm test`): **449 tests, 447 pass, 0 fail, 2 skipped** (513 s). The 2 skips are the two that were skipped before (`a tiny thumb nudge shows real rows only` and `storage getters fall back to empty arrays`).
- Sabotage check (restored afterwards): without the `leftPanelVirtualState` registration, 11 tests across `ui-virtual-scroll-modules` and `scroll` fail.
- Not run: real Electron.

## Needs from other agents

- none

## Not done

- Real Electron run (the plan asks for one after D-09i).

## For you (manual checks)

1. Start the app with a library larger than 200 songs; no console errors.
2. Scroll the main list with the wheel, then drag the scrollbar thumb fast to the bottom and back to the top: placeholders appear while moving and real rows are back when you stop.
3. Open Settings, change the virtual scroll threshold (for example to 100): the value shows in the slider, and a list with more than 100 songs switches to virtual scrolling. Restart: the value is kept.
4. Scroll the left panel with a long playlist list; pin, unpin and delete a playlist: the list redraws without gaps.
5. Open the Smart Lyrics finder with many results and scroll it.
6. Go to Settings and back to a song list, and leave the lyrics view: no empty placeholder rows.

## Next step

D-09i: `07-views`, then the full smoke checklist and a second real Electron run.

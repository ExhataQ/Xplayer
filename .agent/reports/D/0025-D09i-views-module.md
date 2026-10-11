# Agent D report 0025: D-09i, 07-views as an ES module

Step: D-09i. Applies on top of D-0024 (D-09h). No commit, no push.
Archive (.agent/AGENTS.md section 1): **not done as specified**, `E:\Backup` is not reachable from this session. An untouched copy of the tree was kept next to the working copy; please make the real archive snapshot.

## Changes

- `07-views.js`: `export` on the 36 top-level functions; a guarded `registerLegacyGlobals` at the end for the 36 functions plus `VIEWS` and `listProviders` (both are read by bare name elsewhere; `listProviders` by `search-ui.test.js`). `viewConfigs` and `viewHandlers` are used only inside the file. Nothing else changed.
- `isNavigatingHistory` stays declared in the classic `04a0-ui-state.js` (A's setter assigns it by name; `07-views` only reads it).
- `src/manifest.json`: moved from `"js"` to `"modules"`, after `07a-ui-actions.js`, before `04a-ui-render-core.js`. The file registers no listener and does nothing at load, and no classic file reads its names while loading (`dep-map`: forward load-time references 0).
- New `tools/tests/ui-views-module.test.js` (9 tests: manifest, exports and registration, no work at load, constants never reassigned, names and `VIEWS` values on window, switch/back/forward in a real page).
- `change.log.txt`, `PLAN.md`, `BOARD.md` (D-09i `patch received`), `PLAN2.md`.
- No call-sequence baseline changed: `events-a` to `events-d` pass as they are.

## Numbers

`dep-map.js` before and after: mutable globals written from other files 58 and 58, file-level cycles 81 and 81, load-time cross-file references 27 (forward 0) and 27 (forward 0). `event-audit --strict`: exit 0.

## Tests actually run

- `manifest`, `listener-order`, `converted-modules`, `render-modules`, `setters`, `legacy-bridge`, `startup-gate`: 56/56.
- `events-a/b/c/d`: 4/4. `events-wiring`, `ui-handlers`, `search-ui`, `view-switch`, `keyboard-shortcuts`: 53/53.
- `playback-modules`, `ui-storage-api`, `lyrics-panel-handlers`, `playback-handlers`, `modal-close`, `player-bar`, `scroll`: 97 pass, 1 skipped (the already-skipped tiny-thumb test).
- `ui-leaf-modules`, `ui-core-render-module`, `ui-virtual-scroll-modules`: 24/24.
- New test: 9/9. Sabotage check (`switchView` removed from the registration, restored afterwards): 3 failures.
- Not run: the full suite (`npm test`), `context-menu`, `drag-drop*` and `event-subscribers-modules` as a complete batch (they showed ok in a run that was cut off), lint (ESLint is not installed in this environment), real Electron.

## Needs from other agents

- none

## Not done

- Full suite, lint, and the full smoke checklist with a second real Electron run. D-09 is not closed until those are done.

## For you (manual checks)

1. Start the app; no console errors. Switch All Songs, Liked, Recents, Albums, Playlists, Settings and back.
2. Open an album and an artist, then Back and Forward (also from Settings and from search results).
3. Open Lyrics, scroll the song list first, leave Lyrics: the scroll position returns.
4. Search, open a search-history entry, press Clear in Recents and in Search History.
5. Click the subhero shuffle and play buttons: titles and active state update.

## Next step

Run the full suite and the smoke checklist in Electron; if clean, mark D-09i and D-09 `applied + verified`, then A-16.

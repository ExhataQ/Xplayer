# Plan 2: remaining work

> **FINISHED 2026-10-12. Archived.** Steps 1 to 8 are done (A-16 final flip, D-09g to D-09i, the full suite, the full smoke checklist and a real Electron run on the final tree, all by the human). Step 9 (optional cleanup) and the open questions moved to the live plan, `.agent/PLAN.md`:
> duplicate refreshes, the `recents:count-changed` rename and the `leftPanelVirtualState` helper are D-02 to D-04 there. The `08h` bug (step 1) was never fixed and is D-01. The 21 ESLint errors (step 1) are gone.
> Open questions answered: the browser tests do run in CI (`.github/workflows/test.yml`, Windows, `npm test`). `sandbox: true` (A-S4) and the archive snapshots are still unconfirmed and stay on the human list in `.agent/BOARD.md`.

Source: written by the human. Status values come from `BOARD.md` and were not re-verified when this file was saved. Steps are in order. Progress notes are appended under each step.

## 1. Lock down the current state

- Apply D-0022 (D-09e and D-09f: event subscribers and renderers as modules); run the full suite once. Only focused tests have run on it so far.
- Run the smoke checklist (PLAN section 6) in Electron. D-09d4 has a recorded run; D-09e and D-09f do not.
- Check the probable bug in `08h-panel-search.js` (lines 45 and 77): `getCachedEl('all-songs-count')`, but the element is `all-songs-count-display`. Clear the search box with the console open.
- Look at the 21 ESLint errors. Lint exits 0 despite them. Does not block D-09g unless the errors are in `04a`, `04a0` or the files around them.
- Close the A-15 records: reconcile BOARD and PLAN, tick the spike checkbox, resolve the leftover `vm` tests, record the folder layout decision, delete `tools/spike-modules/`, confirm the archive snapshots.

## 2. Decisions D-09g needs

- Assign owners for the 13 shared live `let` variables from the D-09a survey. `00-state.js` is single-owner, so write the rule down before any further D-09 file moves.
- Resolve the `06c` implicit global.
- Check that the load-time uses of `06h` and `06k` in `ui/player-bar.js` still hold once those files are modules.

Progress, step 2 (checked against the tree, nothing needed changing):
- Owners: the 13 live `let`s are declared once in the classic `04a0-ui-state.js` (hoveredSongIndex, selectedSongId, lastSelectedIndex, selectionHighlights, activeContextMenuSlot, currentContextSongId, downloadNotifyIndex, lastMouseX, lastMouseY, notificationPanelOpen, notificationHistory, isNavigatingHistory, VIRTUAL_SCROLL_THRESHOLD); A's setters in `core/state-ui.js` and `core/state-navigation.js` assign them by name. The rule is written in `PLAN.md` section 5 ("Shared live variables"); they move into the state modules in A-16.
- `06c`: `window.updateExternalScrollbar = updateScrollbar;` (no implicit global left).
- `ui/player-bar.js` is a module listed after `06h` and `06k`; `openImageViewer` is called from an arrow function and `initMarqueeOnHover` is a plain call at module run time. `player-bar.test.js` passes.

## 3. D-09g: `04a-ui-render-core.js` (done, patch D-0023)

Gate: D-09f and D-0012.

- Keep the capture `keydown` listener in `04a` ahead of the one in `06a`.
- Check the three remaining inline `on...=` strings in `04a` still resolve after conversion.
- Run `listener-order` and `converted-modules` tests.

## 4. D-09h: virtual scroll `05c`, `05a`, `05b` (done, patch D-0024)

Gate: D-09g. Keep `05a` before `05c` in `"modules"`. Run `scroll.test.js` and the placeholder checks. Highest regression risk.

## 5. D-09i: `07-views.js` (patch D-0025; Electron run still to do)

Gate: D-09h. Full smoke checklist and a second real Electron run before D-09 is closed.

## 6. Phase 3 leftovers: inline handlers

Count remaining `onclick=` strings in `build/music_player.html` and any file still using them. Decide: convert now, or leave until the flip. Remove any left behind by the flip.

## 7. A-16: the final flip

Status: done, see A report 0020. Differences from the text below: the live `let`s were not turned into getters; they stay module-private and are exposed with `registerLegacyState`. `ui/player-bar.js` and `core/storage.js` were already modules. `dep-map.js` is not yet an import-graph check.

Gate: D-09 closed.

- Convert the classic files still in the manifest: `00-state.js`, `01-sizes.js`, `02-ghost-list.js`, `core/state-playback-modes.js`, `03j-library-locations.js`, `ui/player-bar.js`, `core/legacy.js`, `api/desktop-api.js`, `99-player.js`. `core/storage.js` may stay classic if its load-order reason still holds (explicit decision).
- Flip Phase 1 state reads from bare variables to getters, then make the variables private.
- Point `manifest.json` at a single module entry; update `app-fixture.js`, `claude.md` ownership, PLAN status.
- Remove the generic `invoke` from `electron/preload.js`, and any `registerLegacyGlobals` entries nothing calls.
- Done when: no classic script remains except the `99-player.js` template; `dep-map.js` becomes an import-graph check.

## 8. Phase 6 verification

Full suite, full smoke checklist, one real Electron session on the final tree. Record dep-map numbers in the change log.

## 9. Optional cleanup, after the flip

- Remove the duplicate refreshes (PLAN "Known leftovers": `04i`, `04n`, `04k`, `04h`, `15e`) with re-recorded sequences in `tools/tests/expected/`.
- Rename `recents:count-changed` to camelCase in the same patch as the `04h` update and recorded sequences.
- Helper in `05b` for the ~10 repeated `leftPanelVirtualState` writes.
- Only when a bug or feature calls for it: song-row component, playlists/folders service/UI split, JSDoc `// @ts-check`.

## Open questions

- Does `sandbox: true` (A-S4) work? Needs one run on Windows.
- Do the browser tests run in CI or only locally?
- Archive: the D reports say the archive was not made because `E:\Backup` was unreachable; those snapshots still need to be made.

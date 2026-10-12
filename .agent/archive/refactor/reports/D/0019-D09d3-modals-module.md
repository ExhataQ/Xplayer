# Report 0019: D-09d part 3, `06b-modals.js` as an ES module

Step: third part of D-09d. **Applies on top of D-0016, D-0017 and D-0018** (`D09-next.patch`, `D09d-1-modal-close-cleanups.patch`, `D09d-2-keyboard-player-bar-modules.patch`, in that order). Independent of the lint patch. No commit, no push.
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup` is not reachable from my environment. `.agent/BOARD.md` and `tools/change.log.txt` are not edited; please add the entries.

## Changes

- `06b-modals.js`: `export` on 21 functions and one guarded `registerLegacyGlobals({ ... })` listing them. Nothing else changed in the file. Part 1 (D-0017) already removed the reassignments that would have broken in a module. A scan found no assignment to an undeclared name except `downloadNotifyIndex`, which is a global `let` declared in `04a0-ui-state.js` and may be assigned from a module.
- `src/manifest.json`: `06b` moved from `"js"` to `"modules"`, after `06e-tooltip-titles.js`. It registers no listener and runs nothing while loading (only declarations), so its position among the modules cannot matter.
- `tools/tests/converted-modules.test.js`: the 21 names added to the registered list.
- `tools/tests/ui-handlers.test.js`: the dialog test no longer asserts which function a click on the overlay calls (see "One test changed" below).
- `tools/tests/modal-close.test.js`: +1 test (create item and played data dialogs close from the overlay; played data also from Close).
- New `tools/tests/electron-injected-names.test.js` (5 tests).

## The 21 names, and one the survey missed

Which of the 27 top-level functions are used outside the file was recomputed with a search over `src`, `tools/tests`, `electron` and `build`. It gives the 20 names report 0013 listed, plus **`updateDownloadNotification`**: `electron/main.js` injects `if (typeof updateDownloadNotification === 'function') { updateDownloadNotification(...) }` into the page while a song downloads. Left unregistered, the guard would be false and the download progress would silently stop updating. `showDownloadNotification`, `removeDownloadNotification`, `addSongToQueueAndPlay`, `closeSongMetadataModal`, `closeOnOverlayClick`, `runModalCleanups`, the two cleanup lists and `downloadProgressActive` are used only inside the file and stay private.

I also checked all 13 UI modules converted so far (D-09b, D-09c, D-09d-2) against every name the `electron/` sources mention: no other name is missing from a registration.

Electron calls only three names by bare name (`electron/main.js`, `electron/window-manager.js`): `updateDownloadNotification`, `showWelcomeDialog` (both now registered by this patch) and `recalcLayoutWidths` (still a classic script). `electron-injected-names.test.js` runs the three snippets as Electron does, in the page's global scope, and fails if a name is not a global function.

## One test changed

`ui-handlers.test.js` ("dialogs: every button calls its function ...") replaced `window.closePlaylistModal` and the other close functions with spies and expected a click on the overlay to call them. In a module the dialog hands its **own** `closePlaylistModal` to `createModal`, so a replacement on `window` is never reached. Buttons still go through `07a`, which calls the global by name, so those assertions are unchanged and still pass. Only the four "overlay calls closeX()" assertions were removed; the overlay's `docClicks` check stays. The behavior they stood for (an overlay click closes the dialog) is now checked by its effect, for all seven dialogs, in `modal-close.test.js`, which passes on the classic and on the module version.

## Proof that behavior did not change

- `modal-close.test.js`: 26 tests; run on the classic `06b` (26 pass) and after the conversion (26 pass).
- `ui-handlers.test.js` with the change above: 25 pass on classic, and in the converted tree together with `ui-storage-api`, `converted-modules` and `manifest`: 54 pass.
- Sabotage check (restored afterwards): without `updateDownloadNotification` in the registration, `electron-injected-names` and two `converted-modules` checks fail.
- `lint-globals`: 927 -> 918 names (the 21 registered names stay global; the nine private names stop being global; counts: classic 379, registered 539). `dep-map.js`: load-time references 27, forward 0 (unchanged). `event-audit --strict` exits 0.

## Tests actually run

- Focused, as listed above. Full suite: run at the end of D-09d (last report of the series).
- Not run: real Electron.

## Still to do for D-09d

Convert `06a` (part 4), then one real Electron run.

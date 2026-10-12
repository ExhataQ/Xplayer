# Agent A report 0020: A-16 final flip

Steps: A-16 (PLAN2 section 7). Applies on top of: `Xplayer-main_13.zip` (contains D-09e to D-09i, reports 0022 to 0025).
Archive (.agent/AGENTS.md section 1): not done. `E:\Backup` is not reachable from this environment, so the snapshot could not be made or verified. The change is delivered as a patch against the zip; nothing was applied to your project.

## Changes

- `src/manifest.json`: now `{ "css": [...], "entry": "main.js" }`. `tools/lib/manifest.js` (new) reads it and follows the entry's imports.
- `src/js/main.js` (new): 114 `import` lines. The order is the old load order: `core/legacy`, `core/storage`, `api/desktop-api`, `core/build-data`, the shared state files, `core/startup`, the subscribers `04h` to `04v`, then the rest.
- 14 classic files became modules: `core/storage`, `api/desktop-api`, `00-state`, `00b-events`, `01-sizes`, `02-ghost-list`, `core/state-playback-modes`, `03j`, `04a0`, `08a`, `08e`, `10a0`, `11c`, `15a0`. `core/legacy.js` is a module too. Top-level declarations are exported and registered.
- `core/legacy.js`: new `registerLegacyState({ name: [get, set] })`. It defines window accessors so bare-name reads and writes of a module-private `let` keep working (about 95 shared variables).
- `99-player.js`: only `window.__buildData = { songs, placeholderImage }` (the build template). The DOMContentLoaded bootstrap moved verbatim to `core/startup.js`; the data lookup is `core/build-data.js` (`SONGS_DATA`, `PLACEHOLDER_IMAGE`).
- `electron/preload.js`: the generic `invoke` is removed.
- 155 `registerLegacyGlobals` entries that nothing outside their own file reads were removed from about 35 modules. The rule is `usedOutside` in `tools/tests/helpers/bridge-use.js`.
- Tooling: `tools/dep-map.js`, `tools/lint-globals.js`, `eslint.config.js`, `build/build_manifest.py`, `build/music_player.py`, `tools/tests/helpers/render-template.js`, `app-fixture.js`, `tools/event-allowlist.json` (start-up entries now name `core/startup.js`).
- Tests: `manifest.test.js` rewritten; nine module tests read the entry through `readManifest`; `converted-modules`, `event-subscribers-modules`, `ui-core-render-module`, `ui-views-module`, `ui-virtual-scroll-modules`, `playback-modules`, `lint`, `desktop-api`, `event-bus`, `storage-core`, `storage` and `scroll` adapted. vm-based tests load module files through `stripExports`.
- Docs: `claude.md`, `.agent/AGENTS.md`, `tools/tests/README.md`, `src/js/core/LEGACY.md`, `src/js/core/STORAGE.md`, `.agent/PLAN.md`, `PLAN2.md`, `BOARD.md`, `tools/change.log.txt`. Stale "classic script" comments in `src/js` were reworded.

## Numbers

`node tools/dep-map.js`, before then after: files 113 then 115; mutable globals written from other files 58 then 58; forward load-time references (would break if reordered) 0 then 0; file-level cycles 81 then 71 (reported as two groups, 2 and 69); load-time cross-file references 27 then 148. The 148 is higher because every module now calls `registerLegacyGlobals` while it loads, and dep-map counts that as a cross-file reference to `core/legacy.js`. None is forward.
`node tools/event-audit.js --strict`: exit 0, A 0 / B 0 / C 0, total 0 (70 allowed by `event-allowlist.json`).
`node tools/lint.js --summary`: 136 files, 0 errors, 1 warning (`no-unused-vars`), the same as before. The "21 errors" on the board could not be reproduced.
`node tools/lint-globals.js`: 1 classic file, 115 modules, 721 names.

## Tests actually run

- `node tools/tests/run.js` (whole suite, unit and browser, Chromium through Playwright): 459 tests, 457 pass, 0 fail, 2 skipped, about 505 s. The two skips were already skipped before: a timing-sensitive scroll test, and a storage test for `getPlaylists` that moved.
- Not run, and why: a real Electron session (no Electron binary here). npm was unreachable, so `acorn`, `playwright` and `eslint` were linked from `/opt`, and ESLint's `globals` package was replaced by a stand-in generated from Chromium's window properties. Re-run lint once with the real packages.

## Needs from other agents

- none

## Not done

- No real Electron run on the final tree (PLAN2 section 8). The main process calls renderer globals through `executeJavaScript` (for example `updateDownloadNotification`); those names are still registered, but this is only tested in Chromium.
- Modules still read each other's names by bare name through `window` (about 720 registered names). Replacing them with imports is a separate, later job. `dep-map.js` is not yet an import-graph check.
- `tools/spike-modules` is not deleted.
- Not done: the PLAN2 "state reads become getters" idea; state stays module-private with accessors instead.
- Pre-existing: an `ERR_FILE_NOT_FOUND` console message in the test page appears in the original tree too.

## For you (manual checks)

1. Build and start the app -> it opens with the library loaded, no blank window, no red errors in DevTools (the `ERR_FILE_NOT_FOUND` line was already there).
2. Play a song, pause, shuffle, repeat, seek -> the player bar, subhero buttons and lists react as before.
3. Open Settings, change a panel width and a setting, restart -> they persist.
4. Start a download, then check the notification updates -> it still shows progress (main process calls `updateDownloadNotification`).
5. Open the Metadata Editor and the lyrics sync editor -> both open and save.

## Next step

Your Electron run of the checklist above; after that, the optional cleanup in PLAN2 section 9 and replacing window reads with imports.

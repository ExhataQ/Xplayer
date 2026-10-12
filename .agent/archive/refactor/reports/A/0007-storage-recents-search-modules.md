# Agent A report 0007: storage, recents and search engine as modules

Steps: A-12. Applies on top of: report 0006 (A-11 patch applied).
Archive (.agent/AGENTS.md section 1): not done, nothing archived.

## Changes

- src/js/03-storage.js, 03a-recents.js, 03b-search-engine.js: now ES modules. Function bodies unchanged. `getStoredJson(key, fallback, storage)`, `getSearchResults(query, options, songs)` and `getRecentlyPlayedSongs(recent, library, isDeleted)` have an optional trailing dependency argument (the app passes none, and the defaults read the same globals as before); `getRecentCount(...args)` forwards them. Each file ends with a guarded `registerLegacyGlobals` call for the names classic code uses (7 functions, 3 constants).
- src/manifest.json: the three files moved from `js` to a new `modules` list.
- build/build_manifest.py, build/music_player.py, tools/tests/helpers/render-template.js: render `<script type="module">` tags after the classic ones; copy module files. `clean_for_share.py` uses the same renderer.
- src/js/package.json: `type: module`, so Node can import these files in tests. The renderer ignores it; the build does not copy it.
- tools/lib/strip-exports.js, tools/dep-map.js, tools/tests/setters.test.js, legacy-bridge.test.js: parse module files after removing `export`. dep-map puts modules last in load order.
- tools/tests/manifest.test.js: modules count as listed, are not also classic, and must have an export.
- tools/tests/storage.test.js, recents.test.js, search-engine.test.js: import the modules.
- tools/tests/converted-modules.test.js (new): real-page check.
- src/js/core/LEGACY.md: recipe for converting a file to a module. .agent/PLAN.md, BOARD.md, tools/change.log.txt updated.

## Numbers

`node tools/dep-map.js` before and after: load-time cross-file references 26 -> 26 (forward 0 -> 0); file-level cycles 73 -> 73.
`node tools/event-audit.js --strict`: exit 0, A/B/C 0, 68 allowed by fileExceptions.

## Tests actually run

- All 24 files in tools/tests: 155 tests, 153 passed, 0 failed, 2 skipped.
- Deliberate break: removing `getSearchResults` from the registration makes `converted-modules.test.js` fail (2 tests); restored.
- Not run: the manual check below, and an Electron run of the module build.

## Needs from other agents

- B, C, D: when you convert a file, follow the recipe in core/LEGACY.md and add the file to `modules` (one-line insert). Do not use its names at load time from classic files.

## Not done

- The still-classic `03e`-`03i` getters are tested through a small vm context in `storage.test.js` and `recents.test.js` (with a fake `localStorage`), because those files are converted in A-15, not A-12.
- The skipped `getPlaylists` test in `storage.test.js` was already skipped before and is unchanged.

## For you (manual checks)

1. Start the app, play two songs, open Recently played -> both appear, newest first.
2. Search for a song -> results show; delete a song then search for it -> it is gone.
3. Optional: `App\electron.exe tools\spike-modules\run-spike.js electron\MusicPlayerOutput` -> every line PASS. This confirms your Electron loads modules from file://.

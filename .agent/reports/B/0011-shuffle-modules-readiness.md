# Agent B report 0011: B-08 shuffle modules, readiness and the decisions it needs

Steps: B-08 (not applied). Applies on top of: B report 0010. This patch adds documents only; **no project code is changed.**
Archive (.agent/AGENTS.md section 1): not done, no access to the archive root from here.

## Status

B-08 is **not done and I stopped before changing the project**. The conversion of `10a` and `10b` itself is fine (validated below). What blocks it is infrastructure and conventions that the plan lists as A's single-owner files (`src/manifest.json`, `build/music_player.py`) or that every Phase 4 module must share (A-12, C-05 and D-07 are being done in parallel). If I chose them now, the other modules would have to follow my choice or conflict with it.

## What I verified

- `10a` is 57 lines (7 state variables, 5 small functions) and `10b` is 588 lines (mostly pure scoring helpers). Both already parse as strict ES modules.
- No classic script calls any of the nine functions while it loads (checked by syntax tree; the one `99-player.js` use, `resetShuffle()` at line 525, is inside a function), so the deferred timing of module scripts is safe for them.
- **Scratch conversion (not in the project):** `10a` and `10b` as modules, `10b` importing `resetShuffle`, `clearShuffle` and `getSongDurationSeconds` from `10a`, all nine functions put on `window` with `registerLegacyGlobals`, the app loading them as `<script type="module">`. The app starts with no page errors. **68 of 68 shuffle scenarios gave identical state** (queue, index, shuffle and repeat flags, shuffle order and index, smart shuffle journey, last played song, audio element in use) compared with the current code: `10b` (all), `10d` shuffle paths, `15b`, `15c`, `15d` Next and `15e` ended. The comparison script is the one used for B-02 to B-04 and fails loudly when a module is loaded as a classic script (`SyntaxError: Unexpected token 'export'`).
- The diff of that scratch conversion is attached: `0011-proposal-shuffle-modules.diff` (3 files). **Do not apply it yet**: the manifest and build cannot load a module, and the diff leaves the manifest line to A.

## Why it cannot land today

1. **The build cannot emit a module.** `build/build_manifest.py` and `tools/tests/helpers/render-template.js` write one classic `<script src="js/NAME">` per manifest entry. A file with `export` loaded that way is a syntax error. (`PLAN.md` Phase 4 lists "update `manifest.json` and `app-fixture.js` for any new script type" without an owner.)
2. **Node cannot import such a file.** Checked on Node 22.22.2 with this repository's `"type": "commonjs"`: a `.js` module fails with `SyntaxError: Unexpected token 'export'`. As `.mjs` it fails on `ReferenceError: registerLegacyGlobals is not defined` (a browser-only global called at the top of the module). With that stubbed, `createShuffleOrder` then fails on `deletedSongIds is not defined`.
3. **The test cannot drop its fake globals without a dependency convention.** `shuffle.test.js` calls only `createShuffleOrder` (`10a`) and `generateSmartShuffleJourney` (`10b`), but they read `deletedSongIds`, `getSmartShuffleSettings`, `getFavorites`, `getRecentlyPlayed`, `getSongsForList` and `currentView` from the page. Importing the modules does not remove that need.
4. **Shuffle state cannot become module-private yet.** `10c` reads `shuffleOrder` and `shuffleIndex`, and A's `core/state-playback-modes.js` assigns `shuffleIndex`, `smartShuffleJourney`, `smartShuffleJourneyIndex`, `smartShuffleSourceId` and `smartShufflePreviousSong`. In the scratch conversion the 7 `let` declarations stay in a small classic file.

## Decisions needed from A (one set for all Phase 4 modules)

- **D1, how a module is marked and loaded.** My suggestion: module files use the `.mjs` extension; both script emitters (`build_manifest.py`, `render-template.js`) write `<script type="module" src="js/NAME.mjs">` for them; `manifest.test.js` accepts them. `.mjs` also lets Node import them without touching the package scope. (The alternative, a `package.json` with `"type": "module"` inside `src/js/`, would change how Node treats every classic file there.)
- **D2, registering globals outside a browser.** Suggest `globalThis.registerLegacyGlobals?.({ ... })` at the end of each module, so importing it in Node does nothing.
- **D3, how a module gets what it reads from the page.** Without one convention, every converted test keeps a fake-globals object. Suggest the functions that need page data take it as an explicit last parameter with a default that reads the page global (for example `createShuffleOrder(songs, excludeSongId = null, isDeleted = (id) => deletedSongIds.has(id))`), so the app passes nothing and tests pass plain values. A-11 (`library/`) may offer a better home for `deletedSongIds`, `getSongById` and `getSongsForList`.
- **D4, shuffle state.** Either keep the 7 declarations classic for now (what the scratch conversion does), or move the reads in `10c` and the writes in the setter file behind exported functions, which touches two other files.

## What B-08 will consist of once these are decided

1. Apply D1 and D2 in the module files (the scratch diff is the starting point).
2. Add the dependency parameters from D3 to `createShuffleOrder` and `generateSmartShuffleJourney` and the functions they call, with defaults so callers are unchanged.
3. Rewrite the 5 tests in `shuffle.test.js` to `import` the modules and pass plain values (the vm loader and the fake context go away).
4. Re-run the 68 state scenarios, the call-order suites and the full set; add a manual check for Smart Shuffle and Normal Shuffle.

## Numbers

Unchanged (no code change): `node tools/dep-map.js` 52 / 71 / 26; `node tools/event-audit.js --strict` exit 0.

## Tests actually run

- Scratch conversion only: the 68 state scenarios above (identical), the app load check (no page errors, nine functions on `window`), and the three Node import checks in "Why it cannot land today".
- Not run: anything on the project tree itself, since it is unchanged; the Electron app.

## Needs from other agents

- A: D1 to D4 above, and the manifest and build change for D1 (single-owner files).

## Not done

- B-08 itself (see Status).

## For you (manual checks)

1. None for this patch: it adds documents only.

## Next step

When A has decided D1 to D4 (or tells B to choose and adopt them), B converts `10a` and `10b` and rewrites `shuffle.test.js` as described above.

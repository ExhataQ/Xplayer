# Agent D report 0022: D-09e, view renderers and shell actions as ES modules (04b to 04g, 07a)

Steps: D-09e (Agent D2 on the board split). Applies on top of the zip that already contains D-0017 (D-09d1) and D-0016 (D-09c). It touches no file D1 or D3 work on (`06a`, `06b`, `06k`, `07-views`, `04h` to `04v`, `05*`, `04a`), except two things that need merging: `src/manifest.json` and `tools/change.log.txt` (see below). No commit, no push.
Archive (.agent/AGENTS.md section 1): **not done as written**, `E:\Backup` is not reachable from my environment. I copied the whole tree before editing (session scratchpad, `archive-D2-1/Source`) and used it as the "before" in every comparison below. Snapshot number for the real archive: please assign one for D2.

## Changes

- `04b`, `04c`, `04d`, `04e`, `04f`, `04g`: `export` on every top-level function, and a guarded `registerLegacyGlobals({ ... })` at the end listing all of them (14 names: the ones report 0013 listed, which are all the functions in these files). No other edit.
- `07a-ui-actions.js`: `export` on `applyActionAttrs`, and a guarded registration of that one name. The three `registerActions({ ... })` calls still run at load (modules run after `core/legacy.js`, a classic script, and the action wrappers look their targets up when clicked). `ITEM_CONTEXT_MENUS` is used only inside this file, so it becomes private (lint-globals 932 -> 931).
- `src/manifest.json`: the seven files moved from `"js"` to `"modules"`, inserted as one block right after `06i-theme-switcher.js` and before `06a`. Nothing in them registers a listener or reads state at load, so their position cannot change any behavior; the block position keeps room for D1 to insert `06a` before `06c` and for D2 later to put `04a` before `06a`. Original CRLF and formatting kept.
- New `tools/tests/render-modules.test.js` (13 tests): manifest placement; each file exports exactly its functions and registers exactly those names; the renderers do nothing at load except declare and register; in a real page every name is a function on `window`, `applyActionAttrs` copies attributes, and every renderer runs on a library with no page error.
- `tools/change.log.txt`: entry added. `.agent/BOARD.md`: D-09e row.

## Proof that behavior did not change

- Ad hoc DOM comparison (script kept out of the repo): the same page, library, playlists, folder and favorites, on the unconverted copy and on the converted tree. After each of 26 steps (every renderer called directly, then `switchView` to eight views) I compared `#song-list`, the left panel list, the hero and the right panel. **All 26 snapshots are identical**, once the random playlist and folder ids are masked, and there were 0 page errors on both.
- Sabotage check (restored afterwards): removing `renderAlbumsView` from the `04c` registration makes 3 of the new tests fail (shape, names on window and start-up, renderers run).
- No pinned call-sequence baseline changed: `events-*.json` and `events-wiring.test.js` pass unchanged, so none of the spied names are called from inside these files.

## Numbers

`node tools/dep-map.js` before and after: mutable globals written from other files 58 and 58, file-level cycles 81 and 81, load-time cross-file references 27 and 27 (forward 0). `node tools/event-audit.js --strict`: exit 0. `lint-globals`: 932 -> 931 names (classic files 44 -> 37).

## Tests actually run

- Focused (manifest, converted-modules, ui-handlers, events-d, events-wiring, legacy-bridge, setters, lint): 86 of 86 pass.
- `render-modules`: 13 of 13 pass.
- Full suite (`node tools/tests/run.js`): **399 tests, 397 pass, 0 fail, 2 skipped** (517 s). The two skips are the ones named in report 0017. I did not re-run the suite on the unconverted copy, so I cannot give a before count for 399; the new file adds 13.
- Run in Chromium through Playwright, in a Linux container. Not run: real Electron.

## Needs from other agents

- **Human:** `src/manifest.json` and `tools/change.log.txt` will conflict with D1 and D3 patches. Keep both sides. After applying, check the `"modules"` order (`06i`, then my seven files, then `06c`; D1 puts `06a` before `06c`).
- **D1 / D3:** none. They do not touch these files.

## Not done

- D-09g (`04a`): waits for D1's D-09d3, because `04a`'s keydown listener must stay before `06a`'s.
- Real Electron run: D1's D-09d4 covers it for the whole group.

## For you (manual checks)

1. Start the app; open the console: no errors.
2. Open Playlists, Folders (open one), Albums (open one), Artists (open one), Favorites, Recent, History, Search History: each view shows its list and clicking an item opens it.
3. Right-click a playlist, folder, album and artist card: the context menu opens, with no browser menu.
4. Open the Lyrics view for a playing song and leave it: no error, the song list comes back.

## Next step

D-09g (D2) once D1 has applied D-09d3.

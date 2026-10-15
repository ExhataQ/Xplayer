# Agent A report 0002: move src/js into folders, docs after the move

Steps: A-03, A-04. Applies on top of: Xplayer-main_2.zip as received (2026-10-15), i.e. the tree with Phase 1 applied.
Archive (.agent/AGENTS.md section 1): NOT done as written. `E:\Backup\Programming\Music player` does not exist in the sandbox. A byte-identical copy of the received tree was made first, in the sandbox only. Your zip is the true pre-change state.

## Changes

- 92 files in `src/js/` moved into folders exactly as `.agent/PLAN.md` section 5 lists them (`core/`, `library/`, `playlists/`, `search/`, `playback/`, `lyrics/`, `ui/`, `ui/subscribers/`). No file is placed differently from the table. File names unchanged. `src/js/` now holds `main.js`, `99-player.js`, `package.json` and folders only.
- `src/js/main.js`: each import names its folder; order unchanged (114 imports, as before). No other file under `src/` changed (`10b` still imports its sibling `10a`; `core/build-data.js` still imports `../api/desktop-api.js`).
- `tools/event-allowlist.json`: `fileExceptions` file names now carry the folder (the keys are the same paths `dep-map` prints).
- `tools/lint-globals.js`: `WINDOW_PUBLISHED_GLOBALS` names `ui/06c-scrollbar-widget.js`.
- Tests that name a file (about 25 `tools/tests/*.test.js`, `tools/placeholder-test/placeholder-test.js`): file names carry the folder.
- Four tests needed more than a path edit:
  - `setters.test.js`: listed only the top level of `src/js`; now recursive.
  - `ui-storage-api.test.js`: same, and it had found no files; now recursive, matching on the base name.
  - `render-modules.test.js`: picked the `04*` files with `startsWith('04')`, which matched nothing once the names had a folder (the test would have passed on an empty list); now uses the base name.
  - `lint.test.js`: the scratch trees create the `ui/` folder; `listener-order.test.js`: the three needles carry the folder.
- `claude.md`: file-ownership list rewritten with the new paths, plus a short layout paragraph. `src/js/core/SETTERS.md`, `STORAGE.md`, `EVENTS.md`: file names carry the folder. `tools/tests/README.md` had no moved-file path left to change.
- `tools/change.log.txt`: one entry.
- Not touched: `tools/prompt.txt` (still stale, see report 0001), `.agent/PLAN.md`, `BOARD.md`, old reports, `package.json`, `build/` (it already copies subfolders; `output-dir.test.js` passes).

## Numbers

`node tools/dep-map.js` before -> after: 115 files; mutable globals written from other files 58 -> 58; file-level cycles 2, 69 -> 2, 69; load-time cross-file references 148 -> 148 (0 forward). (PLAN.md section 1 says 27 for the last one; the same command on the received tree prints 148, so the plan's figure was a different count. Before and after are equal, which is the check.)
`node tools/event-audit.js --strict`: exit 0, A 0 / B 0 / C 0, total 0 (70 allowed by fileExceptions), before and after.
`npm run lint:strict`: 136 files, 0 errors, 0 warnings, before and after.

## Tests actually run

- `node tools/tests/run.js unit`: 165 tests, 165 passed, 0 failed.
- `node tools/tests/run.js browser --concurrency=4` (Linux sandbox, 2 cores, Chromium): 287 tests, 286 passed, 0 failed, 1 skipped (the `scroll` skip). Total with unit: 452 tests, the count `tools/tests/README.md` section 12 gives for 58 files. The first browser run had 1 failure (`ui-storage-api`, fixed above); the numbers here are from the rerun after the fixes.
- `manifest.test`, `listener-order`, `event-subscribers-modules`, `window-contract`, `output-dir` are inside those runs and pass.
- Doc check: `claude.md` and `tools/tests/README.md`, 211 path-like names checked; 15 do not exist and none is a source file (`App/...` build output, `MusicPlayerOutput/songs.json`, `songs.json`, the module names `helpers/app-fixture` and `node:assert/strict`, and ratios such as `0/3`).
- Not run: baseline of the whole suite on the unmoved tree in the sandbox (only the unit, lint, dep-map and audit numbers were taken before the move; the browser count is compared with the README); the smoke checklist and a real Electron start (no Electron here). Those are Phase 3 and are yours.

## Needs from other agents

- none

## Not done

- Phase 3 (V-01 to V-05) is yours. A name filter that now matches nothing would not fail a test by itself; I checked every `readdirSync`, `startsWith` and regex on a file name under `tools/` and fixed the three that did. A short manual look at the "found N files" asserts is still worthwhile.
- `tools/prompt.txt` still describes the old layout (recommendation in report 0001: regenerate in short form now that the layout is final; needs your decision).
- `BOARD.md` not updated: your job after you apply and verify.

## For you (manual checks)

1. `git apply --check A-0002-move-src-js-into-folders.patch`, then `git apply`. Expect renames, not delete + add (`git status` shows `renamed:`; if your Git shows add/delete use `git add -A` first).
2. `npm test` on your machine -> same counts as before the move (README section 12: 58 files, 452 tests).
3. `node tools/dep-map.js` -> 115 files, 58, `2, 69`, 148.
4. Start the real app (`App/electron.exe` after `Source/build/music_player.py`) and go through `tools/smoke-checklist.md`; the first thing to look at is the console on start-up: any "Failed to load module" line names a path that was missed.

## Next step

Phase 3: V-01 to V-05 (you).

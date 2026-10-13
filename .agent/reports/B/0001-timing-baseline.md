# Agent B report 0001: test-timing baseline

Steps: B-01. Applies on top of: `Source-backup.zip` (uploaded snapshot of `Source`, 2026-10-12).
Archive (.agent/AGENTS.md section 1): not done. The archive root `E:\Backup\Programming\Music player` is not reachable from this session. No project file was modified: this patch only adds this report, and the work was done on an extracted copy of the uploaded zip, which was left untouched.

## Changes

- `.agent/reports/B/0001-timing-baseline.md`: this report (new file). No source, test, `package.json` or `change.log.txt` change; B-01 is measurement only.

## Numbers

Command: `node tools/tests/run.js --timing` (what `npm run test:timing` runs), one file after another, run once, started after all other test activity had stopped.

Environment (differs from the plan's baseline machine, so compare only with later runs from this same environment):

| Item | Value |
|---|---|
| OS / CPU / RAM | Linux sandbox, 1 vCPU, about 4 GB |
| Node | v22.22.2 |
| Playwright | 1.56.0 from a global install (the project pins `^1.63.0`); Chromium build 1194 |
| Project `node_modules` | not present: `acorn`, `acorn-walk`, `eslint`, `globals`, `jimp`, `music-metadata` are missing and there is no network |

Result: 55 files, 406 tests, 396 passed, 8 failed, 2 skipped, 643.6 s in total (18 unit files 26.1 s, 37 browser files 617.2 s).

```
seconds  kind     tests pass fail skip  file
   81.9  browser      1    1    0    0  events-b.test.js
   74.8  browser     16   14    1    1  scroll.test.js   <-- exit 1
   70.4  browser      1    1    0    0  events-c.test.js
   49.2  browser     12   12    0    0  events-wiring.test.js
   42.5  browser     26   26    0    0  modal-close.test.js
   23.9  browser     12   12    0    0  drag-drop.test.js
   23.3  unit        11   11    0    0  online-metadata.test.js
   22.7  browser     13   13    0    0  legacy-bridge.test.js
   22.7  browser     25   25    0    0  ui-handlers.test.js
   21.9  browser     12   12    0    0  lyrics-panel-handlers.test.js
   20.2  browser     12   12    0    0  ui-storage-api.test.js
   19.5  browser     10   10    0    0  metadata-editor.test.js
   14.9  browser      9    9    0    0  playback-handlers.test.js
   14.8  browser      6    6    0    0  view-switch-song-list-cleanup.test.js
   12.8  browser      1    1    0    0  events-a.test.js
   11.7  browser      6    6    0    0  keyboard-shortcuts.test.js
   11.0  browser      6    6    0    0  playback-modules.test.js
   10.3  browser      4    4    0    0  search-ui.test.js
   10.2  browser      5    5    0    0  listener-order.test.js
    9.3  browser      7    7    0    0  ui-leaf-modules.test.js
    9.0  browser      5    5    0    0  context-menu.test.js
    8.7  browser      4    4    0    0  player-bar.test.js
    7.7  browser      7    7    0    0  event-subscribers-modules.test.js
    7.7  browser      3    3    0    0  startup-gate.test.js
    7.4  browser      5    5    0    0  electron-injected-names.test.js
    7.3  browser      5    5    0    0  converted-modules.test.js
    6.6  browser     18   18    0    0  songs-store.test.js
    5.7  browser      3    3    0    0  scrollbar-publication.test.js
    4.0  browser      2    2    0    0  playback-settings.test.js
    3.2  browser      6    6    0    0  theme-switcher.test.js
    2.5  browser     11   11    0    0  desktop-api.test.js
    1.4  browser      5    5    0    0  app-fixture.test.js
    0.7  browser      1    1    0    0  events-d.test.js
    0.3  unit        14   14    0    0  main-process-safety.test.js
    0.2  unit         1    1    0    0  metadata-backend.test.js
    0.2  unit        13   13    0    0  search-engine.test.js
    0.2  unit         9    9    0    0  output-dir.test.js
    0.2  unit        11   11    0    0  language-detect.test.js
    0.2  unit        12   12    0    0  storage-core.test.js
    0.2  unit         6    6    0    0  shuffle.test.js
    0.2  unit        10   10    0    0  scan-folder-tags.test.js
    0.2  unit        13   13    0    0  manifest.test.js
    0.2  browser      1    0    1    0  drag-drop-modules.test.js   <-- exit 1
    0.2  unit        10   10    0    0  recents.test.js
    0.1  unit         1    0    1    0  lint.test.js   <-- exit 1
    0.1  unit         5    5    0    0  music-folders.test.js
    0.1  unit         7    7    0    0  lrc-parser.test.js
    0.1  unit         6    6    0    0  event-bus.test.js
    0.1  unit         4    3    0    1  storage.test.js
    0.1  unit         6    6    0    0  scanner.test.js
    0.1  unit         3    2    1    0  setters.test.js   <-- exit 1
    0.1  browser      1    0    1    0  ui-core-render-module.test.js   <-- exit 1
    0.1  browser      1    0    1    0  render-modules.test.js   <-- exit 1
    0.1  browser      1    0    1    0  ui-virtual-scroll-modules.test.js   <-- exit 1
    0.1  browser      1    0    1    0  ui-views-module.test.js   <-- exit 1
  643.6  total      406  396    8    2  55 files
```

Reading the failures (none come from the code under test):

- `drag-drop-modules`, `lint`, `setters` (1 of 3), `ui-core-render-module`, `render-modules`, `ui-virtual-scroll-modules`, `ui-views-module`: `Cannot find module 'acorn'`. Missing dependency in this environment. Six of these files stop at import, which is why the test count is 406 and not the plan's 459.
- `scroll.test.js`: 1 failure in the full run. The same file run alone with `node --test --test-reporter=spec` passed 15, failed 0, skipped 1 (72.0 s). The file marks one test as timing-sensitive in sandboxed environments; this is a timing flake on a 1 vCPU machine. B-02 needs 3 passes in a row because of this.
- `storage.test.js`: 1 skipped, same as the plan's baseline (2 skipped in total).

Facts the later steps rely on:

- Fixed sleeps: `waitForTimeout` appears 28 times in `scroll.test.js` and 5 times in `view-switch-song-list-cleanup.test.js` (counted with grep; matches the plan).
- Slowest five here: `events-b` 81.9 s, `scroll` 74.8 s, `events-c` 70.4 s, `events-wiring` 49.2 s, `modal-close` 42.5 s. This is the same five files as the plan's baseline, about 1.2x slower in this environment.
- `online-metadata.test.js`: 23.3 s as a unit test (the plan says 23 s).
- `events-d.test.js` takes 0.7 s for 1 test and `events-a.test.js` 12.8 s, so B-03 has little to gain on those two; the gain is in `events-b` and `events-c`.

## Tests actually run

- `node tools/tests/run.js --timing`, all 55 files: 396 passed, 8 failed, 2 skipped (causes above).
- `node --test --test-reporter=spec tools/tests/scroll.test.js`: 15 passed, 0 failed, 1 skipped.
- Not run, and why: `npm run lint`, `node tools/dep-map.js` and `node tools/event-audit.js --strict` need `acorn` or `eslint`, which are not installed here. The plan's lint and dep-map numbers are therefore not re-measured. The 8 failures above are not a baseline for the user's machine.

## Needs from other agents

- none

## Not done

- A baseline that is comparable with the plan's: it needs the project's own `node_modules` (run `npm install`). Because of the missing modules, 6 files were not exercised at all. Re-run `npm run test:timing` on the real machine before B-02 if before/after numbers are to be compared there; the table above is the reference for this sandbox only.

## For you (manual checks)

1. On your machine run `npm run test:timing` once and keep the table. Expect 55 files and about the plan's 542 s; this is your own "before" for B-02 to B-05 -> numbers close to the plan's baseline, 0 failures, 2 skipped.

## Next step

B-02 (replace the fixed sleeps in `scroll.test.js` and `view-switch-song-list-cleanup.test.js`), B-04 (mock the backoff in `online-metadata.test.js`) and B-03 (parallel sequence suites) can each start now: all three depend only on B-01.

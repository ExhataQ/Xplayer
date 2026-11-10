# Report: PC-03 Waveform scaling (first part)

**Task:** PC-03 | **Agent:** C | **Date:** 2026-10-21 | **Status:** In review (scaling done; bar design, on/off setting, load delay and saved cache not done)

## Summary
Loud music drew nearly every bar at full height. There were two causes in the code, and both are fixed.

## Findings
1. `computePeaks` took the single loudest sample in each slice and divided by the loudest slice. Loud, compressed music has a sharp peak near full scale in almost every slice, so every bar was full. *Read, and shown with a test using real samples.*
2. `drawWaveform` then took the maximum of the slices that share one bar, which pushed bars further toward full height. *Read.*

## Change
- `computePeaks` now uses each slice's average level (RMS) and stretches the track between its quiet floor (10th percentile) and loud ceiling (95th percentile), with a gentle curve. The stretch is limited so a flat track is not exaggerated. The numbers are named constants at the top of the new block in `waveform.js`.
- `drawWaveform` averages the slices in a bar instead of taking the maximum.
- Saved peaks from the old scaling are not reused: the cache key now starts with `v2:` (`PEAKS_VERSION`).

## Changed files
| File | Change |
|---|---|
| `src/ui-next/views/playback/waveform.js` | New scaling, bar averaging, cache version |
| `tools/tests/ui-next-waveform-scale.test.js` | New, plain Node unit test (6 tests) |
| `tools/tests/ui-next-waveform.test.js` | Two expectations updated for the new scaling (see Not run) |

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/ui-next-waveform-scale.test.js` | 6 passed, 0 failed |
| `node tools/tests/run.js --list` | New file is found as a unit test |
| `node tools/tests/run.js unit` | 242 passed, 5 failed, 1 skipped. The same 5 fail on the tree without my change (two scan and album-art tests, `drag-drop-modules`, `lint` because ESLint is not installed, `core/state-*.js setters`). I did not investigate them; they are not caused by this task |

## Not run
- The browser test `ui-next-waveform.test.js` (needs a browser). Its two changed expectations were worked out by running the new function in Node: `[0, 31, 255, 117]`, and "quiet third second" now allowed between 15 and 40.
- `node tools/lint.js` (ESLint is not installed here).
- Seeing it on screen. Please check a loud song and a quiet song and say whether the bars look right.

## Still to do in PC-03
- **Delay:** `seek-waveform.js` waits `LOAD_DELAY = 300` ms before starting, then decodes the whole track in the renderer. `setPeaksStore` exists but nothing in the app calls it, so peaks are never saved between sessions (DP10b).
- **Bar design:** smaller bars, better contrast (colors come from `--accent` and `--border-strong`).
- **Setting:** on/off, default off. No setting exists today.

## Manual checklist for the owner
1. Turn on the waveform (it is always on today) and play a loud, modern song. Expected: bars rise and fall, only some reach full height.
2. Play a quiet or acoustic song. Expected: it also uses the full height, with a similar amount of variation.
3. Play the same song twice. Expected: the second time it still looks the same.

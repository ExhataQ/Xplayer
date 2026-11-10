# Report: X2 Memory recording while you work

**Task:** X2 (REAL-APP-CHECK-PLAN.md) | **Agent:** C | **Date:** 2026-11-09 | **Status:** In review (needs the real app)

## Summary
A switch in Settings > About, **Memory recording**, writes one line every 30 seconds to `logs/perf.csv` in the data folder while the app is used: memory per kind of process, CPU, the page's JS heap, DOM nodes, images, the name of the open view, and whether something plays. **Copy summary** puts the totals (first, last and highest memory, change per hour, CPU, time playing, views seen) on the clipboard. It is off every time the app starts; `XPLAYER_PERF=1` starts it with the app. Nothing leaves the computer.

## Findings
- **What is recorded:** numbers from Electron's own process metrics and one read-only script per window (`performance.memory`, DOM node and image counts, the name of the open view, whether an audio element plays). The view name is cut down to letters, digits, `_` and `-`, so a page cannot write anything else into the file. *tested*
- **Cost:** one metrics call and one small script per window every 30 s. The timer does not keep the app alive, a slow or failing read is logged and skipped, and two samples never run at once. *tested*
- **Size:** the file rotates at 2 MB (`perf.1.csv`), which is about 20 days of continuous recording. *tested*
- **Off by default**, so a normal run does no extra work. The state is not saved between runs on purpose.

## Changed files
| File | Change |
|---|---|
| `electron/perf-recorder.js` | New: the recorder, the CSV line, the summary |
| `electron/memory-report.js` | The page script also reads the view and the playing state |
| `electron/main.js` | `perf-record` and `perf-summary` handlers; `readMemoryData` shared with Copy diagnostics; `XPLAYER_PERF=1` |
| `electron/preload.js`, `src/js/api/desktop-api.js` | `app.perfRecording(enable)`, `app.copyPerfSummary()` |
| `src/ui-next/shell/about-settings.js` | The row with Start / Stop recording and Copy summary |
| `tools/tests/perf-recorder.test.js` | New: 13 tests (line, recorder, rotation, summary, wiring, the buttons in a browser) |
| `tools/tests/desktop-api.test.js` | Two names added |
| `.agent/MANUAL-CHECKS-C.md` | New: every manual check of Agent C and X1, X2, in one place |

## Decisions made or needed
1. 30 seconds is the interval (`INTERVAL_MS` in `perf-recorder.js`). Say if you want shorter or longer.
2. Not saved between runs. If you want it on until switched off, say so (it needs a saved setting).

## Checks
| Command or step | Result |
|---|---|
| `node tools/tests/run.js perf-recorder memory-report desktop-api` | 33 of 33 pass |

## Not run
- **Real Electron:** the real process metrics, the windows' answers and the file on your disk. Stand-ins were used in the tests.
- **ESLint** (not installed).

## Environment
Linux sandbox, Node v22, headless Chromium, no Electron, no network.

## Manual checklist for the owner
1. Settings > About > **Memory recording**. **Expected:** it reads Start recording after each start of the app. Press it: Stop recording.
2. After a minute open `logs/perf.csv` in the data folder. **Expected:** a header and one line about every 30 seconds with plain numbers and a view name.
3. Use the app for a while, then **Copy summary** and paste. **Expected:** samples, length, total memory first, last and highest, change per hour, CPU, playing share, views.
4. **Stop recording.** **Expected:** no more lines.
5. Start with `XPLAYER_PERF=1`. **Expected:** the first line is there without pressing anything.

## Patch
`C-10-memory-readout.patch` (X1 and X2 together). No plan file is touched.

# Report: X1 Memory read-out in Copy diagnostics

**Task:** X1 (REAL-APP-CHECK-PLAN.md, Part "Small jobs") | **Agent:** C | **Date:** 2026-11-09 | **Status:** In review (needs the real app: the numbers only exist there)

## Summary
Settings > About > **Copy diagnostics** now also copies how much memory each part of the app uses, the JS memory and DOM size of each open window, the size of the songs list file and the covers folder, and how long the app has been running. It only reads. This is the tool for the real-app check: press it at each moment (M0 to M3) and paste the text.

## What the text shows
```
Memory (MB, working set per process)
  Total: 550 MB in 4 processes
  Browser: 140 MB, private 88, CPU 0.4%
  Page index.html: 300 MB, private 244, CPU 1.3%; JS heap 96 of 140, 5230 DOM nodes, 41 images
  GPU: 90 MB, CPU 0.0%
  Utility (Network Service): 20 MB
  Main process JS: heap 30, external 4, buffers 2

Data on disk
  songs list file: 2.4 MB
  covers: 1830 files, 310 MB

Running for: 3 h 12 min
```
(The numbers above are an example from the test, not a measurement.) It is placed between the data folder line and the last log lines.

## Findings
- **The numbers come from Electron itself:** `app.getAppMetrics()` for every process (working set; private bytes on Windows; CPU), `process.memoryUsage()` for the main process, and one short read-only script per open window (`performance.memory`, the DOM node count, the image count). `performance.memory` is a Chromium feature, so the JS heap line is Chromium's own estimate. *read, tested with stubs*
- **Nothing personal is added.** A window is named by its file name only (never the window title, which can hold a song name); sizes and counts only; no paths. *tested*
- **A failure cannot stop the copy.** The numbers are read inside a try; a window that throws or does not answer within 1.5 s shows its memory without the page line; a missing folder counts as 0. *tested*
- **"Working set" is not the same as Task Manager's default column.** Task Manager shows the *private* working set. The text shows both where Windows gives it (`private`). Compare like with like.

## How it works
- `electron/memory-report.js` (new): `collect({ app, pages, dirs, startedAt })` gathers; `formatMemoryReport(data)` writes the lines.
- `electron/main.js`: the `copy-diagnostics` handler became async, builds the page list from the open windows, and passes the text to `buildDiagnostics`.
- `electron/app-info.js`: `buildDiagnostics` takes an optional `memory` text.
- `src/ui-next/shell/about-settings.js`: the button's help text mentions the memory numbers.

## Changed files
| File | Change |
|---|---|
| `electron/memory-report.js` | New |
| `electron/main.js` | The handler, 14 lines |
| `electron/app-info.js` | Optional `memory` block |
| `src/ui-next/shell/about-settings.js` | Help text |
| `tools/tests/memory-report.test.js` | New: 7 tests |

## Decisions made or needed
1. The text holds numbers only; if you also want the number of songs, say so (it needs the songs list read, which is slower and larger than a file size).
2. X2 (a copy button for just the memory) and X3 (a start-up timing mark) are not built. This text has the running time, so a start-up time is only a stopwatch for now.

## Checks
| Command or step | Result |
|---|---|
| `node tools/tests/run.js memory-report logger desktop-api main-process-parse main-process-safety ui-next-about` | 45 of 45 pass (the formatting, the page that throws or never answers, missing folders, the diagnostics order, the handler keeps the try and uses the file name only) |

## Not run
- **Real Electron.** `getAppMetrics`, `executeJavaScript` on real windows and the clipboard were only tested with stubs. The smoke script (`npm run smoke`) still only checks that the copy answers `success`; it was not run here (no display).
- **ESLint** (not installed).

## Environment
Linux sandbox, Node v22, no Electron, no network.

## Manual checklist for the owner
1. Start the app, wait until the song list shows. Settings > About > **Copy diagnostics**, paste into a text file. **Expected:** the new "Memory" and "Data on disk" blocks, between the data folder line and the log lines, with one row per process.
2. Open the AI window or a popup and copy again. **Expected:** one more `Page ...` row; close it and copy again: the row is gone (a row that stays means the window is kept in memory).
3. Check the text for your song names or folder paths. **Expected:** none.
4. Do the moments M0 to M3 of the plan and paste each text.

## Patch
`C-10-memory-readout.patch`. No plan file is touched, so it does not depend on C-9.

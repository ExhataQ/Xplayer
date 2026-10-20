# UI-A04a / A-04b: engine contract v2 and seek/volume fix

**Owner:** A. **Status:** In review. **Patch:** `engine-contract-and-seek-fix.patch`.

## What the patch does

| File | Change |
|---|---|
| `src/js/playback/15f-controls-progress-seek.js` | `startSeek` finds the bar by `.progress-container` before pausing; returns if missing. Fixes D-1 |
| `src/js/playback/15g-controls-volume-fade.js` | `setVolume` reads `#volume-slider` by ID instead of `e.currentTarget`. Fixes D-2 |
| `tools/tests/seek-volume.test.js` | New. 4 real-browser tests, real mouse, real generated WAV |
| `.agent/ui-redesign/ENGINE-CONTRACT.md` | Replaced by v2 |
| `.agent/BOARD.md` | D10 tidied; D11 to D13 added; A-04a updated; A-04b added; A-04 dependencies and blocker note |
| `.agent/reports/UI-A04-engine-contract-and-seek-fix.md` | This report |

No change to HTML, CSS, `electron/`, or `build/`. `tools/CHANGELOG.md` is not touched (only A edits it, after integration and verification).

## Evidence

**Defects.** With real mouse input on the unmodified build, a click at 80% of the seek bar did not seek, left playback paused and threw `Cannot read properties of undefined (reading 'add')`. A click on the volume slider set the volume but threw `e.currentTarget.getBoundingClientRect is not a function`. Cause: both handlers are called through `data-action-mousedown`, where `e.currentTarget` is `document` (`core/LEGACY.md`, point 2).

**New test, `tools/tests/seek-volume.test.js`:**

| Test | Before patch | After patch |
|---|---|---|
| click on seek bar seeks, keeps playing, no page error | fail | pass |
| drag on seek bar follows the pointer | fail | pass |
| click on volume slider sets volume, no page error | fail | pass |
| `startSeek` does not pause when the bar is missing | fail | pass |

After patch: 4 of 4 passed in each of 4 consecutive runs. Before patch (fix reverted): 0 of 4.

**Full suite (`node tools/tests/run.js`, one core, headless Chromium):** 430 tests, 420 passed, 9 failed, 1 skipped. All 9 failures are `Cannot find module 'acorn'` and fail identically on the untouched baseline commit (`drag-drop-modules`, `lint`, `render-modules`, `setters`, `ui-core-render-module`, `ui-handlers` "inline event handlers", `ui-views-module`, `ui-virtual-scroll-modules`, `window-contract`). The sandbox has no network, so `acorn`, `acorn-walk`, `eslint` and `globals` could not be installed. Same cause as the P0-03 baseline note. **Those 9 files, including `lint`, did not run against the patch here: please run `npm test` after `npm i acorn acorn-walk eslint globals`.** The two edited source files and the new test pass a syntax check.

**Contract audit (earlier delivery):** 51 of 177 present selectors break boot when removed; 5 more break on first play; no tracked node was replaced in a 16-step real-audio scenario. Scripts were delivered separately as `xplayer-a03-probes.zip`.

## Not done, and why

- **D-3** (volume change during a new track's fade-in is overwritten when the fade ends) is outside the approved scope. Documented in ENGINE-CONTRACT.md section 6. The test clicks after the fade and says so.
- **Electron was not run.** All results are headless Chromium with the repo's fixture (stubbed `electronAPI`). The `currentTarget` rule is plain DOM behavior, but run the new test file and click the seek bar once in the real app.
- **Archive step** (AGENTS.md section 1) was not done by me: the project and archive folders are not reachable from my container. Snapshot before applying.
- **A-04 itself** (the adapter) is not started. It needs the A-03 shell markup to test against.

## How to apply

1. Snapshot the project.
2. From the Source folder (the one with `package.json`): `git apply --check engine-contract-and-seek-fix.patch`, then `git apply engine-contract-and-seek-fix.patch`.
3. `node --test tools/tests/seek-volume.test.js`, then `npm test`.
4. The patch uses CRLF line endings to match the existing files. If your git is set to convert line endings, apply with `git apply --ignore-whitespace`.

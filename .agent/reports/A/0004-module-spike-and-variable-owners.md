# Agent A report 0004: module spike and variable owners

Steps: A-04 (done), A-07 (done), A-07b (prepared, waits for B, C and D). Applies on top of the tree after `agent-folder-cleanup.patch`.
Archive (.agent/AGENTS.md section 1): not done, no `E:\Backup` here. Only tooling, docs and a new tools folder changed; no `src/` file changed.

## A-04: module-loading spike

I could run it myself: I installed Electron 44.5.1 (Chromium 152) in the sandbox and ran it under a virtual display. The app page was built with the real build helper (`tools/tests/helpers/app-fixture.js`), loaded with `loadFile` (file://) and the same webPreferences as `electron/window-manager.js` (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: false`). The preload script was not included, because none of the checks use `electronAPI`.

| Check | Result |
|---|---|
| 1 A `<script type="module">` runs | PASS (it runs while `document.readyState` is `interactive`) |
| 2 It imports a sibling file by relative path | PASS |
| 3 It reads a classic top-level `let` and classic functions by bare name (`playbackQueue`, `currentView`, `SONGS_DATA`, `emit`, `on`, `setCurrentView`) | PASS |
| 3b It assigns a classic top-level `let` directly (`currentView = ...`) | PASS |
| 3c It calls a core setter | PASS |
| 4 Order | PASS: `player.js` first, then the module, then `DOMContentLoaded` |
| 5a A module's own top-level `const` is not visible to classic code | PASS (as expected: it stays private) |
| 5b An inline `onclick="..."` can call a function the module put on `window` | PASS |

I also checked that the runner can fail: with a deliberately wrong variable name it printed FAIL and exited 1.

What this means for Plan 2: no fallback is needed. Modules work from file:// in Electron next to the classic scripts, and while some files are still classic they can share the old globals. Inline `onclick` handlers still need the `window` bridge (A-10); that is the only thing the check shows modules cannot do by themselves.

Limits, so nothing is overstated:
- It ran on Linux with Electron 44.5.1. Your `App\electron.exe` may be another version. Modules have been supported by Electron for years, so a difference is unlikely, but the check takes one minute: `App\electron.exe tools\spike-modules\run-spike.js electron\MusicPlayerOutput`. Every line should say PASS.
- It did not run the whole app startup with a module in it; it tested the four things the plan listed plus the four extras above.

The tool is in `tools/spike-modules/` (runner, two module files, README). It works on a temporary copy of the build folder and changes nothing in the project. It can be deleted when Phase 3 has started.

## A-07: replace writes in A's own files

Already done in report 1 (35 assignments). Rechecked now with `node tools/dep-map.js json`: no file owned by A writes a global it does not declare. The step is marked done.

## A-07b: variables that only one other agent uses

`00-state.js` and other A files declare 49 `let` variables. Counting every reference (reads and writes, setters in `core/` excluded):
- 9 are used only inside the file that declares them.
- 5 are used only by other A files.
- 24 are shared by two or more agents. They stay where they are.
- 11 are used by exactly one other agent. These can move:

| Owner | Variable | Declared in | Used in |
|---|---|---|---|
| B | `gaplessActiveElement` | `00-state` | `10c` |
| B | `gaplessAudioElement` | `00-state` | `10c`, `15e` |
| B | `queueDisplayLimit` | `00-state` | `10c`, `10d` |
| B | `queueDisplayPageSize` | `00-state` | `10c` |
| B | `repeatFunctionalityActive` | `00-state` | `10b`, `10c`, `10d`, `15b`, `15c`, `15d`, `15e` |
| B | `repeatVisualState` | `00-state` | `15b`, `15c` |
| B | `showRemainingTime` | `00-state` | `15a` |
| B | `wasPlaying` | `00-state` | `15f` |
| C | `advancedSettingsOpen` | `00-state` | `08e` |
| C | `lastRightPanelStateBeforeQueue` | `00-state` | `08a` |
| D | `isNavigatingHistory` | `00-state` | `07` |

None of the 11 is referenced from an inline `onclick`/`window.` lookup or from a test, so moving them does not touch the HTML or `tools/tests`.

Protocol (this is a change to how the plan said it, and the plan is updated):
1. The owner chooses the file (for `repeatFunctionalityActive` that is one of the B files above, probably the one that initialises it) and declares it there with the same initial value.
2. I delete the line from `00-state.js`. The two patches must be applied together: a variable declared in both files stops the app at load with `Identifier has already been declared`, and a variable declared in neither fails at the first use.
3. The setters in `core/state-*.js` (for example `setQueueDisplayLimit`) keep working after the move, because they refer to the variable by name when called. They should move next to the variable in a later cleanup, which is not part of this step.

I did not move any of them myself: the files are B's, C's and D's, and `07-views.js` is on the single-owner list in PLAN.md section 9.

## Tests actually run

- The spike runner itself, in Electron 44.5.1 (all PASS), and the failing control.
- `node tools/event-audit.js --strict`: exit 0.
- `node --test tools/tests/manifest.test.js`: 11 pass.
- Not run: the other tests; no `src/` file changed.

## Needs from other agents

- B (B-02 to B-04), C (C-01), D (D-01, D-02): in the report for your step, list which of the variables above you moved and into which file, and send the patch at the same time as A's `00-state.js` removal.

## For you

1. Optional: run `App\electron.exe tools\spike-modules\run-spike.js electron\MusicPlayerOutput` and check that every line says PASS.

## Next step

A-10 (handler bridge) can start now: A-04 passed.

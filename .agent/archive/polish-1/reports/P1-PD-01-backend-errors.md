# Report: PD-01 The tag backend fails clearly (and two latent bugs)

**Task:** PD-01 | **Agent:** D | **Date:** 2026-10-24 | **Status:** In review. The Node writer itself is NOT built (see "Not done").

## Summary
Tag reading and saving still go through Python and mutagen. On a computer where that cannot run, the app told the person "Python runtime not found" even when Python was installed and only mutagen was missing, started two processes per song to find out again, and showed a sheet full of "unreadable" with no reason. Now each song says what is wrong and what to do, the answer is instant after the first, and the sheet shows the reason. While testing this I found and fixed two bugs that were already in the zip.

## Findings
- Reproduced with the real code: Python present, mutagen missing -> every song said "Python runtime not found" (206 ms for 3 files, two processes each). *Run, here.*
- **Latent bug 1 (runner):** Node raises `error` and then `close(-2)` for a command that does not exist (checked on Node 22). The old runner moved to the next command on both, so it could answer "not found" before a working second command (`python` after a missing `python3`; `py` after a missing `python` on Windows) had answered. Reproduced against the original file with a PATH holding only a working `python`: original answered "Python runtime not found", the fix answers with the working Python. *Run, here.*
- **Latent bug 2 (sheet):** after a successful read, a tag the reader did not mention counted as "not read yet", so the sheet re-read the same files for ever. The Python reader returns every key, which hid it; a reader that omits empty tags would trigger it. The original code hangs on it. *Run, here.*
- The `songs-store` main-process suite already failed in this zip (`Cannot find module './ai/ipc'`): E's `ai/` folder was not copied by the test. Test-only fix.

## Changed files
| File | Change |
|---|---|
| `electron/metadata-editor.js` | `createPythonRunner` (injectable). Tells `no-python` / `no-mutagen` / `failed` apart, one clear message with the install command, answers at once for 30 s once Python or mutagen is known missing, guards the double advance. Other functions untouched |
| `electron/tag-service.js` | A failed song carries `reason` when the backend gave one |
| `src/ui-next/views/tools/tag-sheet-actions.js` | Keeps the reason a file could not be read (`problem`), reports it from `readTags()` and from `findTags()`; `rowFromRead` fills tags a successful read left out as empty |
| `src/ui-next/views/tools/tag-sheet.js` | "unreadable" cells carry the reason as a tooltip; the status line shows it once |
| `tools/tests/python-runner.test.js` | New, 13 tests (fake spawn, plus one with real processes) |
| `tools/tests/tag-service.test.js` | 2 tests |
| `tools/tests/songs-store.test.js` | The copy step includes subfolders |

## Messages
- No Python: "Tags cannot be read or saved yet: Python 3 was not found on this computer. Install Python 3 (python.org), then run: python -m pip install mutagen"
- No mutagen: "Tags cannot be read or saved yet: the Python package "mutagen" is not installed. Install it with: python -m pip install mutagen"
- Crash: the last line of the script's own error.

## Not done (and why)
**A Node tag writer.** There is no tag-writing library in the tree (only `music-metadata`, which reads), no network here, and no mutagen to produce expected results, so a candidate library cannot be verified and a hand-written writer cannot be checked against real files. A wrong writer corrupts people's music files. Needs, from the owner's machine: `npm view` of candidates (for example node-taglib-sharp, taglib-wasm; both named from memory, unverified), a folder of real test files (MP3, FLAC, M4A, OGG, Opus, WAV), and mutagen installed to generate expected results for the parity test. Python stays the fallback.

## Checks
| Command | Result |
|---|---|
| `node --test tools/tests/python-runner.test.js` | 13 passed |
| Mutations of the runner (no fail-fast, no double-advance guard, mutagen reported as no-python, crash remembered, retry wait ignored, any error as no-mutagen) | each made at least one test fail; two survivors found and fixed (a dead line removed; a missing "first fails, second works" test added) |
| Same real-process test against the ORIGINAL runner | fails (not ok), passes with the fix |
| `tag-service`, `metadata-backend`, `songs-store`, `find-tags-ipc` | 34 passed |
| `tag-sheet-finder` + `tag-sheet-actions` + `tag-sheet-model` | 35 passed; mutation (omitted tags not filled) fails exactly one test |
| Whole suite, non-UI files | no regression: my failing set is a subset of the baseline's (baseline also fails `songs-store`, fixed) |
| Whole suite, `ui-next-*` files | same failures on the untouched baseline and on my tree. Under load these browser tests time out, so pass counts vary by a couple between runs |

## Failing before my changes, on the untouched zip (not touched, not caused by this work)
`drag-drop-modules` (needs the `acorn` package, not installed here), `lint` (no ESLint here), `cancel-running-work` (2 tests), `events-b`, `events-c`, `events-wiring`, `render-modules`, `scroll`, `ui-core-render-module`, `ui-views-module`, `ui-virtual-scroll-modules`, `window-contract`, and the `ui-next` files `ai`, `appearance`, `lyrics-editors`, `lyrics-find`, `home-shell`, `notifications`, `playback`, `rail`, `search`, `settings-layout`, `settings`. Several pass when run alone with a longer timeout (`ui-next-metadata`: 19/19). Causes beyond the missing packages were not investigated.

## Environment
Node 22 in a container, no network, no Electron, Python 3 without mutagen, Playwright and a browser available. Baseline snapshot: `archive/D2/Source`.

## Manual checklist for the owner
1. On a computer without mutagen, open Metadata > Many songs, add songs, check some, press "Find tags online": the status line says mutagen is missing and gives the command.
2. Run `python -m pip install mutagen`, wait 30 seconds (or restart), repeat: it reads tags.
3. On Windows with only the `py` launcher (no `python` on PATH): tag reading works.

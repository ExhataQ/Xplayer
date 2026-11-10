# Report: Agent D, what was left (PD-04, PD-06, PD-08)

**Task:** PD-04, PD-06, PD-08 | **Agent:** none (owner's request: "start checking on E-D remaining, D first") | **Date:** 2026-11-09 | **Status:** In review

## Summary
The D rows of `.agent/E-D-REMAINING.md` were checked against the code. What a no-internet, no-Electron sandbox can verify was verified; the rest was turned into a short owner pass. One real bug family was found in the undo journal and fixed.

## What was found
- **PD-06, bug 1:** `executePlan` (`electron/ai/executor.js`) runs the plan and then calls `journal.record`. When the file could not be written (read-only folder, full disk) the exception escaped after the changes had been made: no result, no entry id.
- **PD-06, bug 2:** in the app the plan runs in the page (`adapter/ai-bridge.js` `runPlan`) and the main process records it (`ai:journal-record`). On a failed write the main process kept the entry in memory but answered `ok: false` without it, so the page got `entryId = null` and the notification showed an Undo button that did nothing.
- **PD-06, bug 3:** `markUndone` threw when the write failed, after the undo itself had worked, so a successful undo was reported as an error.
- **PD-04:** nothing wrong found by reading: the MusicBrainz fields the code reads match the documented JSON; the popularity source is the ListenBrainz endpoint. Not run live (no internet).
- **PD-08:** the CI job `real-tags` already exists with `XPLAYER_REQUIRE_REAL_TAGS=1`. The 9 failures reported earlier could not be reproduced: `node-taglib-sharp` is not installed here, so the tests are skipped.

## Changed files
| File | Change |
|---|---|
| `electron/ai/journal.js` | `record` throws `JOURNAL_NOT_SAVED` carrying the entry (kept in memory) when the write fails; `markUndone` no longer throws on a failed write; new `recordSafely` for the IPC handler |
| `electron/ai/ipc.js` | `ai:journal-record` uses `recordSafely`: `{ ok: false, error: 'not-saved', message, entry }` for a failed write |
| `electron/ai/executor.js` | `executePlan` keeps the way back when the journal cannot be written and says `journalSaved: false` (the field is absent when it worked) |
| `src/ui-next/adapter/ai-bridge.js` | `runPlan` takes the entry id from a `not-saved` answer and returns `journalSaved: false` |
| `src/ui-next/views/ai/apply-plan.js` | The notification says Undo lasts until the app closes; with no entry at all there is no Undo button, only a warning |
| `tools/dev/finder-report.js` (new) | Read-only report: runs the real finder on a spread of songs, both rules side by side |
| `tools/tests/journal-write-failure.test.js` (new), `finder-report.test.js` (new), `ai-apply-plan.test.js` | Tests for all of the above |
| `.agent/E-D-REMAINING.md` | D rows updated, "Owner pass for D", Closed table |
| `docs/DEVELOPMENT.md`, `CHANGELOG.md` | The new tool; the fix |

## Checks
| Command or step | Result |
|---|---|
| New tests on the unfixed code | 9 fail (they catch the bugs) |
| `node --test` on `journal-write-failure`, `finder-report`, `ai-apply-plan`, `ai-bridge`, `ai-core`, `tag-sheet-journal` | all pass |
| `node tools/dev/finder-report.js` offline, 1 song | fails cleanly in 11 s with the network error, writes nothing |
| `npm run test:unit` (sandbox, no Electron), compared with the unmodified zip | 958 tests, 924 pass, 8 fail: the same 8 as on the unmodified zip |
| `node --test tools/tests/tools-layout.test.js` (the guides name files that exist) | 10 pass, 0 fail |

## Follow-up: the first real run of `finder-report.js`
It failed on every song with `Cannot read properties of undefined (reading 'getPath')`. The finder's cache (`electron/online-metadata.js`, `cacheDir`) asks `require('electron').app.getPath('userData')`, and in plain Node with the electron package installed `require('electron')` is only the path of the program as a string. The call is reached only after the first answer from the internet, so the offline sandbox run had not shown it. The tool now answers that one request itself (a folder in the temp directory, so the app's own cache is not touched); `finder-report.test.js` reproduces the situation with a fake electron package in a separate process.

## Follow-up 2: what the live run showed
With the report working, the owner's run (11 of 20 songs shown) was read. No wrong pick; the three clear songs were right. Three things came out of it and were changed: (1) "No track in that release matches this song's title" was a plain error, counted like a dead connection: five such songs in a row would stop a whole run; it now carries the code `NO_MATCHING_TRACK` and the finder turns it into "none" with the reason. (2) "In My Life (Remastered 2009)" found nothing: a trailing remaster, mono or deluxe note is stripped and the search repeated (`stripVersionNote`, live, acoustic, remix versions are kept). (3) "Fuck You" and "The Sound of Silence (Acoustic Version)" found only compilations; the release search looked through only the top 8 recordings. The finder now asks for 25 (`recordingLimit`, up to MusicBrainz's 100; the editor's single search still uses 8). This one is a hypothesis: the report now prints what MusicBrainz offered so the next run shows whether it was right. Tests: `tag-finder.test.js` (+6), `online-metadata.test.js` (+1, code assertion), `finder-report.test.js` (+1).

## Not run
Electron, Windows, the internet (MusicBrainz, ListenBrainz), `node-taglib-sharp` (not installed in the sandbox).

## Manual checklist for the owner
"Owner pass for D" in `.agent/E-D-REMAINING.md` (6 steps, about 15 minutes).

# Board

FINAL STATE (closed 2026-10-12). Archived with the refactor plan; the live board is `.agent/BOARD.md`. Edited by the human only. Update it after each patch is applied and verified. Plan: `PLAN.md` and `PLAN2.md` in this folder. Reports: `reports/` in this folder. The finished event bus plan is in `.agent/archive/`.

Status values: `todo`, `in progress`, `patch received`, `applied + verified`, `blocked`.

## Next actions

All closed on 2026-10-12.

- [x] A-16 (final flip), D-09g, D-09h and D-09i are applied and verified (A report 0020, D reports 0023 to 0025).
- [x] The Playwright checks and `tools/smoke-checklist.md` were completed by the human, including a real Electron run on the final tree.
- [x] The 21 ESLint errors are gone: lint reports 0 errors and 1 warning (an unused `currentContextPlaylistId` in `06a`, carried to the cleanup plan).
- [x] Full test suite on the final tree: 459 tests in 55 files, 457 passed, 0 failed, 2 skipped.
- Carried to the next plan (`.agent/PLAN.md`): the duplicate refreshes, the `recents:count-changed` rename, the `leftPanelVirtualState` helper, the 08h search-clear bug, and moving `src/js` into folders.

## Agent A: Foundation and data

| ID   | Phase | Step                                       | Needs            | Status                        | Patch                         |
| ---- | ----- | ------------------------------------------ | ---------------- | ----------------------------- | ----------------------------- |
| A-01 | 0     | Add the analysis tool                      | -                | applied + verified            | A report 1                    |
| A-02 | 0     | Record test baselines                      | -                | applied + verified            | A report 1                    |
| A-03 | 0     | Add the smoke checklist                    | -                | applied + verified            | A report 1                    |
| A-04 | 0     | Module-loading spike                       | -                | applied + verified            | A report 0004 (Electron 44.5.1) |
| A-05 | 0.5   | Event bus check                            | -                | applied + verified            | First plan (A report 1)       |
| A-06 | 1     | Create the owner and setter files          | -                | applied + verified            | A report 1                    |
| A-07 | 1     | Replace writes in A's own files            | A-06             | applied + verified            | A-07b complete; report A 0019 |
| A-08 | 2     | Emit events from data changes              | A-07             | applied + verified            | First plan (A reports 2, 3)   |
| A-09 | 2     | Remove direct render calls from A's files  | -                | applied + verified            | First plan (A reports 2, 3)   |
| A-10 | 3     | Build the handler bridge                   | A-04             | applied + verified            |                               |
| A-11 | 4     | Split `99-player.js`                       | A-04, A-07       | applied + verified            |                               |
| A-12 | 4     | Convert storage, recents and search engine | A-10             | applied + verified            |                               |
| A-13 | 5     | Storage module                             | A-12             | applied + verified            |                               |
| A-14 | 5     | `api/` wrapper and preload                 | A-10             | applied + verified            |                               |
| A-15 | 6     | Convert core and library to modules        | A-13, A-14, A-11 | applied + verified            |                               |
| A-16 | 6     | Final flip                                 | B-10, C-07, D-09 | applied + verified            | A report 0020                 |
| A-S1 | side  | Safe downloads and delete                  | -                | applied + verified            |                               |
| A-S2 | side  | One place for settings files               | A-S1             | applied + verified            |                               |
| A-S3 | side  | Song list as data, not text                | A-S2             | partly done (`songs-data.js`) |                               |
| A-S4 | side  | IPC and window hardening                   | -                | applied + verified            |                               |
| A-S5 | side  | Safer tag writes                           | -                | applied + verified            |                               |
| A-S6 | side  | Tests for each fix                         | A-S1..S5         | applied + verified            |                               |

## Agent B: Playback

| ID   | Phase | Step                                    | Needs                  | Status             | Patch                                                                  |
| ---- | ----- | --------------------------------------- | ---------------------- | ------------------ | ---------------------------------------------------------------------- |
| B-01 | 1     | Review A's playback setters             | A-06                   | applied + verified |                                                                        |
| B-02 | 1     | Replace writes in `10c` and `10d`       | A-06, B-01             | applied + verified |                                                                        |
| B-03 | 1     | Replace writes in `10b`, `15b`, `15c`   | A-06                   | applied + verified |                                                                        |
| B-04 | 1     | Replace writes in the remaining B files | A-06                   | applied + verified |                                                                        |
| B-05 | 2     | Emit playback events                    | B-02                   | applied + verified | First plan (B 0001 to 0005)                                            |
| B-06 | 2     | Replace cross-subsystem render calls    | -                      | applied + verified | First plan (B 0001 to 0005)                                            |
| B-07 | 3     | Convert inline handlers                 | A-10                   | applied + verified |                                                                        |
| B-08 | 4     | Shuffle modules                         | A-10, B-03             | applied + verified | B report 0012                                                          |
| B-09 | 5     | Swap storage and API calls              | A-13, A-14             | applied + verified | B report 0012                                                          |
| B-10 | 6     | Convert playback to modules             | A-15, A-11, B-09, B-08 | applied + verified | B report 0012; song navigation conversion recorded in change log       |
| B-13 | —     | Song navigation module                  | —                      | applied + verified | `B-0013-song-navigation-module.patch`; tests passed and changes pushed |

## Agent C: Lyrics, metadata, panels

| ID   | Phase | Step                                           | Needs            | Status             | Patch                                                       |
| ---- | ----- | ---------------------------------------------- | ---------------- | ------------------ | ----------------------------------------------------------- |
| C-01 | 1     | Replace writes in the panel files              | A-06             | applied + verified |                                                             |
| C-02 | 2     | Emit lyrics and settings events                | -                | applied + verified | First plan (C 0001 to 0005)                                 |
| C-03 | 2     | Panels react to events                         | -                | applied + verified | First plan (C 0001 to 0005)                                 |
| C-04 | 3     | Convert inline handlers                        | A-10             | applied + verified | C migration commit 5bccad3                                  |
| C-05 | 4     | Lyrics leaf modules                            | A-10             | applied + verified | C migration commit 5bccad3                                  |
| C-06 | 5     | Swap storage and API calls                     | A-13, A-14       | applied + verified | C migration commit 5bccad3                                  |
| C-07 | 6     | Convert lyrics, metadata and panels to modules | A-15, C-05, C-06 | applied + verified | C migration commit 5bccad3; 293 passed, 0 failed, 2 skipped |

## Agent D: UI shell

| ID    | Phase | Step                                                                                                           | Needs                     | Status             | Patch                                                                                                                                                                          |
| ----- | ----- | -------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-01  | 1     | Replace writes in the smaller UI files                                                                         | A-06                      | applied + verified |                                                                                                                                                                                |
| D-02  | 1     | Replace writes in `07-views`                                                                                   | A-06                      | applied + verified |                                                                                                                                                                                |
| D-03  | 2     | Renderers subscribe to events                                                                                  | -                         | applied + verified | First plan (D 0001 to 0004)                                                                                                                                                    |
| D-04  | 2     | Remove D's own cross-subsystem calls                                                                           | -                         | applied + verified | First plan (D 0001 to 0004)                                                                                                                                                    |
| D-05  | 3     | Convert inline handlers                                                                                        | A-10                      | applied + verified | D-0007 (slice 1), D-0010 (slice 2: 96 -> 5 inline handlers), D-0011 (add-to-queue and right-panel actions), D-0012 (B and C call sites; 0 inline handlers left in the D files) |
| D-06  | 5     | Replace the one generic `invoke`                                                                               | A-14                      | applied + verified |                                                                                                                                                                                |
| D-07  | 4     | Theme switcher module                                                                                          | A-10                      | applied + verified |                                                                                                                                                                                |
| D-08  | 5     | Swap storage and API calls                                                                                     | A-13, A-14                | applied + verified |                                                                                                                                                                                |
| D-09  | 6     | Convert the UI shell to modules (nine steps below)                                                             | A-15, B-10, C-07, D-08    | applied + verified        | D-09a to D-09i all applied + verified; A-16 flip on top |
| D-09a | 6     | Pre-flight: list globals, load-time references, runtime reassignments and listener order per D file (no edits) | A-15, B-10, C-07, D-08    | applied + verified | D report 0013; survey files added                                                                                                                                              |
| D-09b | 6     | Leaf files `06c`, `06d`, `06e`, `06h`, `06j`                                                                   | D-09a                     | applied + verified | D reports 0014, 0015                                                                                                                                                           |
| D-09c | 6     | Drag and drop `06f`, `06g`                                                                                     | D-09b                     | applied + verified | D report 0016                                                                                                                                                                  |
| D-09d | 6     | `06a`, `06b`, `06k` (fix the `06b` function reassignments first; one real Electron run)                        | D-09c                     | applied + verified | D reports 0017 to 0020 (d1 to d4)                                                                                                                                              |
| D-09e | 6     | Renderers `04b` to `04g`, `07a`                                                                                | D-09d                     | applied + verified | D report 0022; focused tests and full suite passed after commit `4d479bc` (430 passed, 0 failed, 2 skipped)                                                                    |
| D-09f | 6     | Event subscribers `04h` to `04v` (decide the module registration rule first)                                   | D-09e                     | applied + verified | D report 0021; focused tests and full suite passed after commit `4d479bc` (430 passed, 0 failed, 2 skipped)                                                                    |
| D-09g | 6     | `04a`                                                                                                          | D-09f, D-0012 (D-05 done) | applied + verified               | D report 0023 |
| D-09h | 6     | Virtual scroll `05c`, `05a`, `05b`                                                                             | D-09g                     | applied + verified               | D report 0024 |
| D-09i | 6     | `07-views`, then the full smoke checklist and a second real Electron run                                       | D-09h                     | applied + verified               | D report 0025 |

D-05 does not have to finish before D-09a: an inline `on...=` string keeps working after its file becomes a module, because the module registers its names with `registerLegacyGlobals`. D-05 only has to finish (D-0012) before D-09g (`04a`), where the last strings are.

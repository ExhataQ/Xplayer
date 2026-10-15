# Plan 3 Board: Cleanup and Test Upgrade

This board tracks `.agent/PLAN.md`. The previous refactoring plan and its historical reports are archived in `.agent/archive/refactor/`.

Update this board manually after each patch is applied and verified. Do not mark a task complete merely because a patch was generated or received.

## Status definitions

- `todo` — not started.
- `in progress` — currently being worked on.
- `patch received` — patch received but not yet applied and verified.
- `applied + verified` — patch applied and the required checks passed.
- `blocked` — waiting on a dependency or an unresolved issue.

## Next actions

- [x] Phase 1 verification complete: B-01 to B-06 accepted with documented non-blocking exceptions; C-05 README checks passed on Windows.
- [x] B-01 to B-06 are applied + verified for project progression. The owner accepts the B-02 half-time target and B-05 shared-build optimization as waived; B-06's 18.7 s `test:quick` time and inaccessible cache-hit logs are recorded as non-blocking notes.
- [x] C: C-01 to C-05 are applied + verified. C-05 Windows checks are recorded in report `reports/C/0006-readme-b06-commands-ci.md`. B has no remaining work blocking Phase 2.
- [ ] D: 10 inline handlers listed in `INLINE_EXCEPTIONS` (`tools/tests/ui-handlers.test.js`) remain. D owns the conversion decision; C's test enforces that the count only goes down.
- [ ] Keep each patch small. Check its diff, run focused tests, and update this board and `tools/change.log.txt` after verification.
- [ ] Do not delete tests unless the report explains why the test is obsolete or identifies the remaining test that covers its behavior.
- [ ] Start Phase 2 only after every Phase 1 task is `applied + verified` and no other agent has a patch in flight.
- [ ] After Phase 2, run the full test suite, the smoke checklist and the real Electron application. Record the results before declaring the plan complete.
## Phase 1 — Parallel cleanup and improvements

### Agent A — Housekeeping and documentation

| ID   | Task                                                                                           | Dependencies | Status           | Notes                                                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------- | ------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Remove dead `tools/spike-modules/` and `tools/test-shuffle/` folders after checking references | None         | applied + verified | Folders removed; grep finds no references outside plan/history. `tools/placeholder-test/` kept. Lint and unit tests pass (report `reports/A/0001-housekeeping.md`).                  |
| A-02 | Triage `tools/prompt.txt` and check root documentation for stale file names                    | None         | applied + verified | Report only: 10 stale names in `prompt.txt`; `prompt.txt` not changed. Recommendation: regenerate in short form after Phase 2. Needs your decision before any deletion.                |

### Agent B — Test speed and infrastructure

**B status:** Accepted as complete for Phase 2/3. All implemented B changes passed their recorded checks; the scroll half-time target and shared fixture optimization are explicitly waived, and the quick-command timing/cache-log limitations are non-blocking. See `reports/B/0008-windows-verification.md`.

| ID   | Task                                                                                 | Dependencies | Status           | Notes                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------ | ------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Establish and record test-timing baseline                                            | None         | applied + verified | Real-machine before/current timing tables are recorded in `reports/B/0008-windows-verification.md`; both whole-suite runs had zero failures. |
| B-02 | Replace fixed sleeps in `scroll.test.js` and `view-switch-song-list-cleanup.test.js` | B-01         | applied + verified | Three scroll runs passed (15 passed, 1 skipped each); view-switch passed 6/6. The 0.84 baseline ratio misses the half-time target, explicitly waived by the owner as non-blocking. |
| B-03 | Parallelize independent sequence suites                                              | B-01         | applied + verified | Windows runs passed at default and one page, with no retries; events-b/c are below half their baseline. The B-03 commit changed no expected-sequence files. |
| B-04 | Mock the 700 ms backoff in `online-metadata.test.js`                                 | B-01         | applied + verified | On Node v24.14.0, 11/11 pass in 0.3 s (before: 23.4 s). |
| B-05 | Optimize fixture building and investigate modal-close test slowdown                  | B-01         | applied + verified | Modal-close passed 26/26 and improved from 33.5 s to 3.5 s. Shared fixture build explicitly waived: measured `buildApp(50)` average is 130.7 ms, below the ~200 ms threshold. |
| B-06 | Add fast test commands and CI support | B-04, B-05 | applied + verified | `test:quick`, three `test:fast` runs, and both checked GitHub Actions runs pass. `test:quick` takes 18.7 s (over the <10 s target); cache-hit log output was inaccessible. Both are recorded as non-blocking notes for Phase 2/3. |

### Agent C — Test consolidation and maintenance

| ID   | Task                                                        | Dependencies           | Status           | Notes                                                                                                                                                                                                                                 |
| ---- | ----------------------------------------------------------- | ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Remove dead or stale tests with documented justification    | None                   | applied + verified | Storage getter test unskipped, `typeof` guard removed (report 0001). In-file duplicates: scanned all 57 files for repeated test titles (none) and repeated assertion lines, and read every flagged site (all are before/after or different-scenario checks, nothing removed); not a line-by-line read of each file. `scroll` skip stays (timing-sensitive, B-02 owns it). Report `reports/C/0005-*`. |
| C-02 | Consolidate the window contract test                        | None                   | applied + verified | Added tools/tests/window-contract.test.js; focused test passed, 11/11. |
| C-03 | Consolidate the inline-handler static rule                  | None                   | applied + verified | One static test over `src/` and the page template; mutation checks done (report `reports/C/0002-inline-handler-rule.md`). 10 known inline handlers listed as exceptions (for D to convert).                                              |
| C-04 | Merge order checks and trim redundant tool tests            | None                   | applied + verified | Order checks merged, tool tests trimmed (report 0003); real-ESLint undefined-name test added in `lint.test.js` and shown to fail with `no-undef` off (report `reports/C/0005-*`). |
| C-05 | Review remaining fixed sleeps and update test documentation | C-02, C-03, C-04, B-06 | patch received | README updated for B-06: counts (58 files, 20 unit, 38 browser), new commands, shards, `--concurrency` and `SEQUENCE_PAGES`, CI workflow, section 11 historical note, and fresh section 12 numbers. Sleeps in C's six files re-checked: none left without a comment. Run the checks in report `reports/C/0006-*` on your machine before marking verified. |

### Agent D — Product-code leftovers

| ID   | Task                                                     | Dependencies | Status           | Notes                                                                                                                                                                                              |
| ---- | -------------------------------------------------------- | ------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | Fix the search-clear bug in `08h-panel-search.js`        | None         | applied + verified | Fixed; new `search-clear.test.js` (fails on old code). Manual check in report `reports/D/0001-search-clear.md` still to be done on the app.                                                       |
| D-02 | Remove duplicate left-panel refreshes                    | None         | applied + verified | Duplicates removed in 04k, 04h, 15e; 24 DOM states compared, identical. Manual checks in report `reports/D/0002-*` still to be done.                                                             |
| D-03 | Rename `recents:count-changed` to `recents:countChanged` | D-02         | applied + verified | Renamed in source, EVENTS.md and tests; no other user of the old name. Manual check in report `reports/D/0003-*`.                                                                                  |
| D-04 | Add a helper for left-panel list writes                  | D-02, D-03   | applied + verified | `refreshLeftPanelItems` added and used at 6 sites; 34 states compared, identical. Drag-and-drop checked only by tests; manual checks in report `reports/D/0004-*`.                                  |
| D-05 | Remove dead code and resolve applicable lint warnings    | None         | applied + verified | Dead code removed; lint 0 errors, 0 warnings with the real ESLint on the combined tree. Run `npm run lint:strict` on your machine to confirm (report `reports/D/0005-*`).                              |

## Phase 2 — Renderer folder move

Agent A performs this phase alone after all Phase 1 tasks are `applied + verified`.

| ID   | Task                                                                          | Dependencies               | Status | Notes                                                          |
| ---- | ----------------------------------------------------------------------------- | -------------------------- | ------ | -------------------------------------------------------------- |
| A-03 | Move renderer files into the folders specified in `.agent/PLAN.md`, section 5 | All Phase 1 tasks verified | blocked | Phase 1 not finished (see Next actions).                      |
| A-04 | Update and verify documentation after the move                                | A-03                       | blocked | Waits on A-03.                                                 |

Do not rename numbered JavaScript files or introduce folders outside the approved layout without documenting the reason and obtaining approval.

## Phase 3 — Final verification

These checks must be performed against the final tree, after Phase 2.

| ID   | Task                                                                    | Dependencies | Status | Notes                                             |
| ---- | ----------------------------------------------------------------------- | ------------ | ------ | ------------------------------------------------- |
| V-01 | Run the complete test suite                                             | A-03, A-04   | todo   | Record total, passed, failed and skipped counts   |
| V-02 | Run lint and the required dependency-map and event-audit checks         | A-03, A-04   | todo   | Record results and compare with the baseline      |
| V-03 | Complete `tools/smoke-checklist.md`                                     | A-03, A-04   | todo   | Record any failures                               |
| V-04 | Start and verify the actual Electron application                        | A-03, A-04   | todo   | A browser-only test does not satisfy this check   |
| V-05 | Record final timings and verification results in `tools/change.log.txt` | V-01 to V-04 | todo   | Do not claim success for checks that were not run |

## Completion rule

Plan 3 is complete only when all Phase 1 and Phase 2 tasks are `applied + verified`, all Phase 3 checks have been performed successfully, and the final results are documented.

The archived refactoring board is historical. Update only this active `.agent/BOARD.md` when tracking Plan 3 progress.

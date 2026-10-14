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

- [ ] Phase 1 remains open: B-03 timing/sequence checks, B-05 timing decision, and C-05 README reconciliation.
- [ ] B-06 is applied and locally verified: shard-runner tests 8/8 passed, lint checked 136 files with 0 errors and 0 warnings, and the user reports the test suite passes. GitHub Actions has not been confirmed here.
- [ ] B: B-03 remains open for the Windows timing measurements and manual checks listed in report `reports/B/0006-fast-commands-ci.md`. B-05 remains open until its Windows fixture-build measurement is recorded or the shared-build optimization is explicitly waived.
- [ ] C: C-01 to C-04 are applied + verified. C-05 remains open: update `tools/tests/README.md` sections 3 and 10 for the new commands and CI workflow, correct the concurrency and `SEQUENCE_PAGES` descriptions, and reconcile the historical timing note in section 11.
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

| ID   | Task                                                                                 | Dependencies | Status           | Notes                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------ | ------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Establish and record test-timing baseline                                            | None         | applied + verified | Recorded in `reports/B/0001-timing-baseline.md`. Sandbox numbers only (1 vCPU, missing modules); the real-machine table is still to be recorded by you.                                                                              |
| B-02 | Replace fixed sleeps in `scroll.test.js` and `view-switch-song-list-cleanup.test.js` | B-01         | applied + verified | Focused tests: scroll 15 passed, 1 skipped; view-switch 6 passed. Windows timing comparison pending. |
| B-03 | Parallelize independent sequence suites                                              | B-01         | in progress | Patch applied locally. Sequence-suite-specific verification and Windows timing comparison pending. Confirm events-b.json and events-c.json remain byte-identical. |
| B-04 | Mock the 700 ms backoff in `online-metadata.test.js`                                 | B-01         | applied + verified | File 23.3 s -> 0.3 s; 11 of 11 pass, same titles. Mutation check done. Still to run once on Node v24 (report `reports/B/0002-online-metadata-fast.md`).                                                                              |
| B-05 | Optimize fixture building and investigate modal-close test slowdown                  | B-01         | in progress      | `modal-close`: 42.5 s -> 4.7 s, 26 of 26 (done). Not done: shared fixture build (skipped, buildApp takes about 11 ms here; your Windows check is in the report). Before/after for 3 other browser files not measured. Keep open until those are recorded or waived. |
| B-06 | Add fast test commands and CI support | B-04, B-05 | applied + verified | Commit `532de76` pushed. Shard-runner tests 8/8 pass; lint: 136 files, 0 errors, 0 warnings; user reports tests pass. GitHub Actions and outstanding Windows measurements are tracked separately in Next actions. |

### Agent C — Test consolidation and maintenance

| ID   | Task                                                        | Dependencies           | Status           | Notes                                                                                                                                                                                                                                 |
| ---- | ----------------------------------------------------------- | ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Remove dead or stale tests with documented justification    | None                   | applied + verified | Storage getter test unskipped, `typeof` guard removed (report 0001). In-file duplicates: scanned all 57 files for repeated test titles (none) and repeated assertion lines, and read every flagged site (all are before/after or different-scenario checks, nothing removed); not a line-by-line read of each file. `scroll` skip stays (timing-sensitive, B-02 owns it). Report `reports/C/0005-*`. |
| C-02 | Consolidate the window contract test                        | None                   | applied + verified | Added tools/tests/window-contract.test.js; focused test passed, 11/11. |
| C-03 | Consolidate the inline-handler static rule                  | None                   | applied + verified | One static test over `src/` and the page template; mutation checks done (report `reports/C/0002-inline-handler-rule.md`). 10 known inline handlers listed as exceptions (for D to convert).                                              |
| C-04 | Merge order checks and trim redundant tool tests            | None                   | applied + verified | Order checks merged, tool tests trimmed (report 0003); real-ESLint undefined-name test added in `lint.test.js` and shown to fail with `no-undef` off (report `reports/C/0005-*`). |
| C-05 | Review remaining fixed sleeps and update test documentation | C-02, C-03, C-04, B-06 | in progress | Sleep replacements and file counts are done, but README sections 3 and 10 still describe the old commands/workflow. Correct the concurrency and `SEQUENCE_PAGES` descriptions and section 11 historical note before marking verified (report `reports/C/0005-*`). |

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

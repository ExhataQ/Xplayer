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

- [ ] Finish the outstanding Phase 1 tasks; do not start Phase 2 yet.
- [ ] B: run npm run test:timing on the Windows development machine to establish a comparable baseline before evaluating test-speed changes.
- [ ] B: complete B-02 and B-03; decide whether the remaining fixture-build optimization in B-05 is worthwhile.
- [ ] C: finish the remaining C-01 review, C-02, C-04's undefined-name lint regression check, and C-05.
- [ ] Run npm run lint:strict on the Windows development machine to verify the lint result reported by D-05.
- [ ] Keep tools/change.log.txt and this board updated as each remaining task is verified.
- [ ] Start Phase 2 only after all Phase 1 tasks are applied + verified and no patches are in flight.
- [ ] After Phase 2, run the full test suite, dependency-map and event-audit checks, smoke checklist, and actual Electron application. Record results before declaring the plan complete.

## Phase 1 — Parallel cleanup and improvements

### Agent A — Housekeeping and documentation

| ID   | Task                                                                                           | Dependencies | Status             | Notes                                                           |
| ---- | ---------------------------------------------------------------------------------------------- | ------------ | ------------------ | --------------------------------------------------------------- |
| A-01 | Remove dead `tools/spike-modules/` and `tools/test-shuffle/` folders after checking references | None         | applied + verified | Keep `tools/placeholder-test/`                                  |
| A-02 | Triage `tools/prompt.txt` and check root documentation for stale file names                    | None         | applied + verified | Do not delete `tools/prompt.txt` without explicit authorization |

### Agent B — Test speed and infrastructure

| ID   | Task                                                                                 | Dependencies | Status             | Notes                                                  |
| ---- | ------------------------------------------------------------------------------------ | ------------ | ------------------ | ------------------------------------------------------ |
| B-01 | Establish and record test-timing baseline                                            | None         | in progress        | Compare before and after using the same environment    |
| B-02 | Replace fixed sleeps in `scroll.test.js` and `view-switch-song-list-cleanup.test.js` | B-01         | todo               | Preserve behavioral coverage                           |
| B-03 | Parallelize independent sequence suites                                              | B-01         | todo               | Avoid shared-state and ordering regressions            |
| B-04 | Mock the 700 ms backoff in `online-metadata.test.js`                                 | B-01         | applied + verified | Keep retry behavior covered                            |
| B-05 | Optimize fixture building and investigate modal-close test slowdown                  | B-01         | in progress        | Measure changes                                        |
| B-06 | Add fast test commands and CI support                                                | B-04, B-05   | todo               | Coordinate changes to `package.json` with other agents |

### Agent C — Test consolidation and maintenance

| ID   | Task                                                        | Dependencies           | Status             | Notes                                       |
| ---- | ----------------------------------------------------------- | ---------------------- | ------------------ | ------------------------------------------- |
| C-01 | Remove dead or stale tests with documented justification    | None                   | in progress        | Preserve meaningful coverage                |
| C-02 | Consolidate the window contract test                        | None                   | todo               | Keep all necessary contract checks          |
| C-03 | Consolidate the inline-handler static rule                  | None                   | applied + verified | Preserve rule coverage                      |
| C-04 | Merge order checks and trim redundant tool tests            | None                   | in progress        | Keep required regression checks             |
| C-05 | Review remaining fixed sleeps and update test documentation | C-02, C-03, C-04, B-06 | todo               | Coordinate edits to `tools/tests/README.md` |

### Agent D — Product-code leftovers

| ID   | Task                                                     | Dependencies | Status             | Notes                                               |
| ---- | -------------------------------------------------------- | ------------ | ------------------ | --------------------------------------------------- |
| D-01 | Fix the search-clear bug in `08h-panel-search.js`        | None         | applied + verified | Add focused regression coverage                     |
| D-02 | Remove duplicate left-panel refreshes                    | None         | applied + verified | Verify affected refresh paths                       |
| D-03 | Rename `recents:count-changed` to `recents:countChanged` | D-02         | applied + verified | Update all relevant producers, consumers and tests  |
| D-04 | Add a helper for left-panel list writes                  | D-02, D-03   | applied + verified | Keep ownership and behavior clear                   |
| D-05 | Remove dead code and resolve applicable lint warnings    | None         | in pgogress        | Record lint results and avoid unrelated refactoring |

## Phase 2 — Renderer folder move

Agent A performs this phase alone after all Phase 1 tasks are `applied + verified`.

| ID   | Task                                                                          | Dependencies               | Status | Notes                                                          |
| ---- | ----------------------------------------------------------------------------- | -------------------------- | ------ | -------------------------------------------------------------- |
| A-03 | Move renderer files into the folders specified in `.agent/PLAN.md`, section 5 | All Phase 1 tasks verified | todo   | Update imports, manifest paths, tests, tools and documentation |
| A-04 | Update and verify documentation after the move                                | A-03                       | todo   | Check all documented paths against the final layout            |

Do not rename numbered JavaScript files or introduce folders outside the approved layout without documenting the reason and obtaining approval.

## Phase 3 — Final verification

These checks must be performed against the final tree, after Phase 2.

| ID   | Task                                                                    | Dependencies | Status | Notes                                             |
| ---- | ----------------------------------------------------------------------- | ------------ | ------ | ------------------------------------------------- |
| V-01 | Run the complete test suite                                             | A-03, A-04   | todo   | Record total, passed, failed and skipped counts   |
| V-02 | Run lint and the required dependency-map and event-audit checks         | A-03, A-04   | todo   | Record results and compare with the baseline      |
| V-03 | C                                                                       | A-03, A-04   | todo   | Record any failures                               |
| V-04 | Start and verify the actual Electron application                        | A-03, A-04   | todo   | A browser-only test does not satisfy this check   |
| V-05 | Record final timings and verification results in `tools/change.log.txt` | V-01 to V-04 | todo   | Do not claim success for checks that were not run |

## Completion rule

Plan 3 is complete only when all Phase 1 and Phase 2 tasks are `applied + verified`, all Phase 3 checks have been performed successfully, and the final results are documented.

The archived refactoring board is historical. Update only this active `.agent/BOARD.md` when tracking Plan 3 progress.

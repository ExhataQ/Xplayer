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

- [x] Phase 1 verification accepted for project progression. B-01 to B-06 and C-01 to C-05 have been applied and verified, with the documented non-blocking exceptions and waived targets retained below.
- [x] Phase 2 completed: A-03 and A-04 applied and verified. The renderer files were moved into the approved folders, paths and tests were updated, and the changes were committed and pushed.
- [x] Phase 3 final verification recorded in `tools/change.log.txt` on 2026-10-15. Full suite: 452 tests, 451 passed, 0 failed, 1 skipped. Strict lint passed with 136 files, 0 errors and 0 warnings. Dependency map and strict event audit completed.
- [ ] D: Review and decide how to handle the 10 inline handlers listed in `INLINE_EXCEPTIONS` in `tools/tests/ui-handlers.test.js`. C's test enforces that the count only goes down.
- [ ] Keep each patch small. Check its diff, run focused tests, and update this board and `tools/change.log.txt` after verification.
- [ ] Do not delete tests unless the report explains why the test is obsolete or identifies the remaining test that covers its behavior.
- [ ] Resolve or explain the dependency-map baseline discrepancy: `PLAN.md` reports 27 load-time cross-file references, while the before-and-after folder-move report records 148. The measured count remained 148 after the move; do not assume these baselines are comparable without checking their definitions or measurement context.
- [ ] Review the remaining product-code and documentation follow-ups listed in the task notes before starting any new broad refactor.

## Phase 1 — Parallel cleanup and improvements

### Agent A — Housekeeping and documentation

| ID | Task | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| A-01 | Remove dead `tools/spike-modules/` and `tools/test-shuffle/` folders after checking references | None | applied + verified | Folders removed; grep finds no references outside plan/history. `tools/placeholder-test/` kept. Lint and unit tests passed (report `reports/A/0001-housekeeping.md`). |
| A-02 | Triage `tools/prompt.txt` and check root documentation for stale file names | None | applied + verified | Report only: 10 stale names in `prompt.txt`; `prompt.txt` was not changed. Recommendation: regenerate in short form after Phase 2. Any deletion or regeneration remains a separate decision. |

### Agent B — Test speed and infrastructure

**B status:** Accepted as complete for project progression. All implemented B changes passed their recorded checks; the scroll half-time target and shared fixture optimization are explicitly waived, and the quick-command timing/cache-log limitations are non-blocking. See `reports/B/0008-windows-verification.md`.

| ID | Task | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| B-01 | Establish and record test-timing baseline | None | applied + verified | Real-machine before/current timing tables are recorded in `reports/B/0008-windows-verification.md`; both whole-suite runs had zero failures. |
| B-02 | Replace fixed sleeps in `scroll.test.js` and `view-switch-song-list-cleanup.test.js` | B-01 | applied + verified | Three scroll runs passed (15 passed, 1 skipped each); view-switch passed 6/6. The 0.84 baseline ratio misses the half-time target, explicitly waived by the owner as non-blocking. |
| B-03 | Parallelize independent sequence suites | B-01 | applied + verified | Windows runs passed at default and one page, with no retries; events-b/c are below half their baseline. The B-03 commit changed no expected-sequence files. |
| B-04 | Mock the 700 ms backoff in `online-metadata.test.js` | B-01 | applied + verified | On Node v24.14.0, 11/11 passed in 0.3 s (before: 23.4 s). |
| B-05 | Optimize fixture building and investigate modal-close test slowdown | B-01 | applied + verified | Modal-close passed 26/26 and improved from 33.5 s to 3.5 s. Shared fixture build explicitly waived: measured `buildApp(50)` average is 130.7 ms, below the ~200 ms threshold. |
| B-06 | Add fast test commands and CI support | B-04, B-05 | applied + verified | `test:quick`, three `test:fast` runs, and both checked GitHub Actions runs passed. `test:quick` takes 18.7 s (over the <10 s target); cache-hit log output was inaccessible. Both are recorded as non-blocking notes for Phase 2/3. |

### Agent C — Test consolidation and maintenance

| ID | Task | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| C-01 | Remove dead or stale tests with documented justification | None | applied + verified | Storage getter test unskipped, `typeof` guard removed (report 0001). In-file duplicates: scanned all 57 files for repeated test titles and repeated assertion lines; reviewed every flagged site. Nothing else was removed. `scroll` skip stays (timing-sensitive; B-02 owns it). See `reports/C/0005-*`. |
| C-02 | Consolidate the window contract test | None | applied + verified | Added `tools/tests/window-contract.test.js`; focused test passed, 11/11. |
| C-03 | Consolidate the inline-handler static rule | None | applied + verified | One static test over `src/` and the page template; mutation checks done (report `reports/C/0002-inline-handler-rule.md`). Ten known inline handlers remain listed as exceptions for D to review. |
| C-04 | Merge order checks and trim redundant tool tests | None | applied + verified | Order checks merged, tool tests trimmed (report 0003); real-ESLint undefined-name test added in `lint.test.js` and shown to fail with `no-undef` off (report `reports/C/0005-*`). |
| C-05 | Review remaining fixed sleeps and update test documentation | C-02, C-03, C-04, B-06 | applied + verified | README updated for B-06: counts (58 files, 20 unit, 38 browser), new commands, shards, `--concurrency`, `SEQUENCE_PAGES`, CI workflow, historical notes and section 12 timings. Sleeps in C's six files re-checked: none left without a comment. Windows checks recorded in `reports/C/0006-*`; see `reports/C/0006-*` and the 2026-10-15 change log. |

### Agent D — Product-code leftovers

| ID | Task | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| D-01 | Fix the search-clear bug in `08h-panel-search.js` | None | applied + verified | Fixed; new `search-clear.test.js` fails on old code. Manual check in report `reports/D/0001-search-clear.md` remains a follow-up unless separately confirmed. |
| D-02 | Remove duplicate left-panel refreshes | None | applied + verified | Duplicates removed in 04k, 04h, 15e; 24 DOM states compared, identical. Manual checks in report `reports/D/0002-*` remain a follow-up unless separately confirmed. |
| D-03 | Rename `recents:count-changed` to `recents:countChanged` | D-02 | applied + verified | Renamed in source, `EVENTS.md` and tests; no other user of the old name. Manual check documented in `reports/D/0003-*`. |
| D-04 | Add a helper for left-panel list writes | D-02, D-03 | applied + verified | `refreshLeftPanelItems` added and used at six sites; 34 states compared, identical. Drag-and-drop checked by tests; manual checks in `reports/D/0004-*` remain a follow-up unless separately confirmed. |
| D-05 | Remove dead code and resolve applicable lint warnings | None | applied + verified | Dead code removed; lint reported 0 errors and 0 warnings on the combined tree. Strict lint subsequently passed on the final tree. See `reports/D/0005-*`. |

## Phase 2 — Renderer folder move

Agent A performed this phase after the Phase 1 work was accepted for project progression.

| ID | Task | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| A-03 | Move renderer files into the folders specified in `.agent/PLAN.md`, section 5 | Phase 1 accepted for progression | applied + verified | The 92 loose renderer files were moved into `core/`, `library/`, `playlists/`, `search/`, `playback/`, `lyrics/`, `ui/` and `ui/subscribers/`. File names and load order were preserved. See `reports/A/0002-folder-move.md`. |
| A-04 | Update and verify documentation after the move | A-03 | applied + verified | Updated `main.js` paths, lint/event allowlist paths, affected tests and documentation. The folder-move report records before/after dependency-map measurements, strict event audit and lint results. Commit `0b1c6bc`. |

## Phase 3 — Final verification

These checks were performed against the post-move tree. Results were recorded in `tools/change.log.txt` on 2026-10-15.

| ID | Task | Dependencies | Status | Notes |
| --- | --- | --- | --- | --- |
| V-01 | Run the complete test suite | A-03, A-04 | applied + verified | 452 tests; 451 passed, 0 failed, 1 skipped; duration approximately 361.9 seconds. |
| V-02 | Run lint and the required dependency-map and event-audit checks | A-03, A-04 | applied + verified | `npm run lint:strict`: 136 files, 0 errors, 0 warnings. Dependency map: 115 files, 58 mutable globals assigned across files, cycles reported as 2 + 69, 148 load-time cross-file references, 0 forward references. `node tools/event-audit.js --strict`: 0 direct reaction calls; 70 allowlisted exceptions. Baseline discrepancy (27 vs. 148 references) remains documented for investigation. |
| V-03 | Complete `tools/smoke-checklist.md` | A-03, A-04 | applied + verified | Owner reported the manual smoke checklist completed and working, with no issues reported. |
| V-04 | Start and verify the actual Electron application | A-03, A-04 | applied + verified | Owner reported the actual Electron application started and worked, with no issues reported. |
| V-05 | Record final timings and verification results in `tools/change.log.txt` | V-01 to V-04 | applied + verified | Final verification results and the dependency-map baseline discrepancy were recorded on 2026-10-15. |

## Completion rule

Plan 3's Phase 2 and Phase 3 work is complete and committed. Phase 1 tasks are recorded as applied and verified for project progression, with explicit exceptions and follow-ups preserved above. The ten inline-handler exceptions and the dependency-map baseline discrepancy remain follow-up items; they do not invalidate the completed folder move or its recorded verification.

The archived refactoring board is historical. Update only this active `.agent/BOARD.md` when tracking Plan 3 progress.
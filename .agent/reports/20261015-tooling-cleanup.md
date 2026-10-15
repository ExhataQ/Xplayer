# Tooling and documentation cleanup: approved scope

Status: completed.

Approval received 2026-10-15. Preserve the current working tree, keep changes documentation-only, split the migration into independently verifiable patches, and do not combine it with the UI redesign.

## Decisions

- Add `.agent/CONTEXT.md` as a concise, accurate orientation to the current project layout and architecture.
- Keep `tools/prompt.txt` as a short, self-contained compatibility context with essential current information and a pointer to `.agent/CONTEXT.md`; do not reduce it to a pointer alone.
- Rename `tools/change.log.txt` to `tools/CHANGELOG.md` without changing the historical entries. Update active references.
- Detailed evidence belongs in distinct task report files. Task agents do not edit the shared changelog; only the designated integration owner updates it after integration and verification.
- Keep test files at their current paths and preserve discovery, grouping, commands, and CI behavior. Add a short explanation to `tools/tests/README.md` of the flat layout and existing test groups.
- Do not change any inline-handler exception or application behavior.
- Investigate the dependency-map discrepancy separately. Record commit and dependency versions under controlled conditions; do not change the baseline until evidence establishes its cause.
- Do not rewrite existing historical reports.

## Proposed layout

```text
.agent/
  AGENTS.md                    # existing canonical agent/workflow instructions
  BOARD.md                     # existing current status
  CONTEXT.md                   # new concise project orientation
  PLAN.md                      # existing active plan
  reports/
    TEMPLATE.md                # existing report template
    A/, B/, C/, D/              # existing historical reports, unchanged
    20261015-tooling-cleanup.md # this report; future reports use unique task IDs

tools/
  CHANGELOG.md                 # renamed from change.log.txt; history unchanged
  prompt.txt                   # retained path; contents replaced with concise context
  tests/
    README.md                  # add flat-layout and test-group clarification
    run.js                     # unchanged discovery behavior
    *.test.js                  # all existing test files stay at current paths
    helpers/                   # unchanged
    expected/                  # unchanged
  lib/                          # unchanged
  placeholder-test/             # unchanged
  existing scripts and audits   # unchanged paths and behavior
```

## Exact patch boundaries

### Patch 1: approved scope and future-report policy

- Add this report: `.agent/reports/20261015-tooling-cleanup.md`.
- No other files in this patch.
- Check the worktree diff and ensure this report accurately states the approved decisions.

### Patch 2: concise project context

- Add `.agent/CONTEXT.md`.
- Replace the contents of `tools/prompt.txt` with short standalone current context and a pointer to `.agent/CONTEXT.md`.
- Update only active guidance references if needed; do not edit old report contents.
- Verify key paths and architecture claims against the repository and search for obsolete flat-renderer claims in the replacement documents.

### Patch 3: change-record rename and conflict policy

- Rename `tools/change.log.txt` to `tools/CHANGELOG.md` with every historical entry preserved verbatim.
- Update active references/policies in `.agent/AGENTS.md`, `.agent/PLAN.md`, `.agent/BOARD.md`, `claude.md`, `.agent/reports/TEMPLATE.md`, `tools/tests/README.md`, and `tools/prompt.txt`.
- Do not rewrite historical reports or old changelog entries. Their old path mentions remain historical evidence.
- Verify all active references point to the new file, verify the old path is gone from the active docs, compare the renamed file contents byte-for-byte with the prior log, and inspect the rename diff.

### Patch 4: test-layout clarification

- Update `tools/tests/README.md` only, after its active changelog path is updated in Patch 3.
- Explain that test files remain flat because `tools/tests/run.js` intentionally discovers top-level `*.test.js`; document the current unit, browser, sequence-suite, and Python logic categories.
- Do not move tests or change discovery, package scripts, or CI.
- Verify `npm run test:list` still reports 58 files (20 unit, 38 browser) and run the focused README/test-runner checks.

### Separate dependency-map investigation (completed; baseline correction justified)

- Baseline commit: `bebc6a1`; current commit before these documentation patches: `2be1b937e3bb526cb5d75f98e2998f9fc1779031`.
- Both runs used Node `v24.13.1`, Acorn `8.18.0`, and acorn-walk `8.3.5`. The baseline lockfile and current lockfile both specify those exact parser versions. `npm ls acorn acorn-walk --depth=0` reported them from the installed dependency tree.
- Command: `node tools/dep-map.js`, run from each clean source snapshot with `SOURCE_ROOT` set to that snapshot and the same installed dependencies.
- Baseline output: `files: 115`; `Mutable globals assigned from other files: 58`; `File-level cycles: 2, 69`; `Load-time cross-file references: 148 (forward, would break if reordered: 0)`.
- Current output: `files: 115`; `Mutable globals assigned from other files: 58`; `File-level cycles: 2, 69`; `Load-time cross-file references: 148 (forward, would break if reordered: 0)`.
- Conclusion: 27 is an incorrect/stale recorded value for the metric implemented by `dep-map.js`, not a difference caused by the renderer folder move, Node version, or locked Acorn versions. The metric counts unique `(consumer file, global name)` pairs referenced at top level outside function bodies where the name is defined in another file. The baseline value and tool header have been corrected in a separate documentation/tool-description patch; post-patch `node tools/dep-map.js` still reports 148 references (0 forward). `node --test tools/tests/setters.test.js` passed 3/3 and `git diff --check` passed. No application behavior changed.
- The dependency correction patch changed only `.agent/PLAN.md`, `.agent/BOARD.md`, `tools/dep-map.js`, and this report.

## Change-log conflict-prevention policy

Every task/agent writes detailed changes, exact verification commands and outcomes, environment, skipped/unrun checks, follow-ups, and commit/PR information (when known) to its own report file with a unique task identifier. Task agents do not edit `tools/CHANGELOG.md`. The designated integration owner updates that shared summary once after integration and verification, linking to the evidence report. `.agent/BOARD.md` tracks current status; reports retain detailed evidence; the changelog is the concise integrated history. On a conflict, retain both task reports, inspect the diffs, resolve the summary explicitly, and rerun relevant checks; never silently overwrite or omit an entry.

## Verified starting state and limitations

- The worktree was clean at `2be1b937e3bb526cb5d75f98e2998f9fc1779031`.
- `npm run test:list` passed: 58 files, 20 unit, 38 browser.
- Initial `node tools/dep-map.js` could not run because `acorn` was not installed in the worktree. The controlled baseline/current comparison above then ran using the same locked dependency tree.
- Inline-handler exceptions remain unchanged: 03l-import-export.js (2), 03m-library-folder-render.js (1), 08d-panel-right-tabs.js (1), and 09-folders-playlists.js (6).
- No implementation patch has changed application behavior.

## Migration status

- Patch 1: report added; verified by diff inspection.
- Patch 2: complete. `.agent/CONTEXT.md` and the self-contained `tools/prompt.txt` were checked against repository paths and current architecture; obsolete flat-script claims were absent. Prompt content checks and `git diff --check` passed.
- Patch 3: complete. Renamed `tools/change.log.txt` to `tools/CHANGELOG.md`; SHA-256 matched the pre-rename historical file byte-for-byte. Updated active references and the report/change-log ownership policy in `.agent/AGENTS.md`, `.agent/PLAN.md`, `.agent/BOARD.md`, `claude.md`, `.agent/reports/TEMPLATE.md`, `tools/tests/README.md`, `tools/prompt.txt`, and `.agent/CONTEXT.md`. Historical reports were not rewritten. `git diff --check` passed; `npm run test:list` remained 58 files (20 unit, 38 browser); `node --test tools/tests/run-shards.test.js` passed 8/8.
- Patch 4: complete. `tools/tests/README.md` explains the deliberate flat test layout and existing execution groups; no tests moved and discovery behavior was unchanged. `npm run test:list` reported 58 files (20 unit, 38 browser); `node --test tools/tests/run-shards.test.js` passed 8/8; `npm run test:quick` passed all 165 unit tests and lint checked 136 files with 0 errors and 0 warnings.
- Dependency-map comparison and evidence-backed baseline correction: complete and verified.
- Final integration: added one dated summary to the top of `tools/CHANGELOG.md` as the integration owner. The prior log contents remain byte-for-byte intact after the new entry.

## Final verification

- `npm run test:list`: pass; 58 files, 20 unit and 38 browser.
- `node --test tools/tests/run-shards.test.js`: pass; 8/8.
- `npm run test:quick`: pass; 165 unit tests passed, 0 failed/skipped; ESLint checked 136 files, 0 errors and 0 warnings. Run under Node v24.13.1 with `NODE_PATH` set to the installed dependency tree at `E:\Programming\Music Player\Source\node_modules`.
- `node --test tools/tests/setters.test.js`: pass; 3/3.
- `node tools/dep-map.js`: pass; current tree reports 115 files, 58 mutable globals assigned from other files, cycles 2 and 69, 148 references, 0 forward.
- Controlled dependency-map comparison: baseline `bebc6a1` and pre-change current `2be1b937e3bb526cb5d75f98e2998f9fc1779031`, same Node/Acorn/acorn-walk versions; both report 148 references, 0 forward.
- `git diff --check`: pass. Active-doc search found no references to the retired `tools/change.log.txt` path. The old changelog contents were verified byte-for-byte after rename and again after adding the new top entry.
- Not run: full browser suite, full `npm test`, build, or Electron smoke test. The approved changes affect documentation and a dependency-map comment only; test discovery and application behavior are unchanged.

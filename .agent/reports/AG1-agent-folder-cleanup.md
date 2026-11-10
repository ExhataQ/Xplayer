# Report: AG1 clean up the .agent folder

**Task:** AG1 | **Agent:** none (owner's request) | **Date:** 2026-11-09 | **Status:** In review

## Summary
The owner asked to archive what is finished in `.agent/`: the dev plan (except two open things), `STATE-SIZE-LIST.md`, `TOOLTIP-TABLE.md`, `VISUALIZER-PLAN.md` and other finished self-generated files. Files were moved with `git mv` into `.agent/archive/`, every mention of a moved path was updated, and the two things the dev plan left open went to `PARKED.md`.

## Changed files
| File | Change |
|---|---|
| `.agent/DEV-PLAN.md` | Moved to `archive/dev-plan/` |
| `.agent/VISUALIZER-PLAN.md`, `reports/V-visualizer-built.md`, `reports/V0-visualizer-spike.md` | Moved to `archive/visualizer/` |
| `.agent/STATE-SIZE-LIST.md`, `.agent/TOOLTIP-TABLE.md`, reports `P2-B7`, `P2-B7b`, `P2-B8-step1` | Moved to `archive/polish-2/` |
| `.agent/PARKED.md` | Two new rows (retiring the old interface; release work and first-Windows-build checks); paths of the moved files updated |
| `.agent/archive/README.md` | New: what each archive folder holds |
| `.agent/AGENTS.md`, `.agent/CONTEXT.md`, `.agent/reports/README.md`, `docs/DEVELOPMENT.md`, `docs/AGENT-PROMPT.txt` | Say where the plans are now |
| `tools/dev/state-size-scan.js`, `tools/dev/tooltip-table.js` | The generated file's path (`OUT`) is its archive path, so `--check` and `--write` keep working |
| Comments in `electron/`, `src/`, `tools/tests/`, `.github/workflows/build.yml`, `tools/dev/bench-visualizer.js` | The path of a moved plan in a comment |

## Decisions made or needed
- Not archived, on purpose: `POLISH-PLAN.md` (B1, B4, B5, B6 have no work yet; most built items not yet seen in the app), `FORMATS-PLAN.md` (F1 to F3 not built), `LIST-COLUMNS-PLAN.md` (waits for the owner's answers), `REAL-APP-CHECK-PLAN.md` (not started), `E-D-REMAINING.md` (open rows), `AI-TAG-SHEET.md` (a guide that is still true), `PARKED.md`, `AGENTS.md`, `CONTEXT.md`.
- Which two things of the dev plan stay open was read from the plan itself: 6.6 (old interface) and phase 5 (release work), with the checks that wait for a first Windows build. Owner to correct.

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/tools-layout.test.js` (includes "the guides name files that exist") | 10 pass, 0 fail, the same as on the unmodified zip |
| `npm run test:unit` (sandbox, no Electron), compared with the unmodified zip | 947 tests, 913 pass, 8 fail: the same 8 as on the unmodified zip |
| `git grep` for the old paths of the moved files (outside `CHANGELOG.md` and the archive) | none left |
| `git apply --check` of the patch on the unmodified zip, then the result compared with the working tree | clean, identical |

## Not run
Electron and Windows (nothing here changes behaviour).

## Manual checklist for the owner
1. Open `.agent/`: only the open plans, `PARKED.md`, `E-D-REMAINING.md`, `AGENTS.md`, `CONTEXT.md`, `AI-TAG-SHEET.md`, `reports/` and `archive/` are left.
2. Read the two new rows at the top of `.agent/PARKED.md`: are they the two things the dev plan still had open?

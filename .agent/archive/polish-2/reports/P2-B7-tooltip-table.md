# Report: B7 Tooltip table for the owner

**Task:** B7 (POLISH-PLAN.md) | **Agent:** B | **Date:** 2026-11-05 | **Status:** In review (waiting for the owner's marks)

## Summary
B7 asks for one table of every tooltip, which the owner marks (keep, remove, new text) and the agent then applies. This patch adds the generator and the first table. **No tooltip was changed or removed.** The apply step starts when the owner hands the marked table back.

## Findings
Tooltip text is set in about ten different ways, which is why a hand-written list would go stale (all *read* from the code):
- New UI: `iconButton({ label, tooltip })` (`components/button.js`), `attachTooltip()` (`components/tooltip.js`), the rail (`shell/shell.js` view list), the player buttons (`views/playback/transport.js`, a table of `[name, () => ({ name, state, shortcut }), toggle]`), the panel header action (`LIBRARY_HEADER_ACTION`), title-bar buttons (adapter `aria-label`, tooltip added in `shell.js`).
- Engine: `title` and `data-original-title` in the page template, `setAttribute('title' | 'data-original-title')` and `.title =` in `src/js` (fixed names in `ui/06e-tooltip-titles.js`; state texts in `ui/07-views.js`, `playback/10d`, `15e`, `17-song-selection.js`), all moved into `data-tip` by `shell/tooltips.js`.
- Rules in `shell/tooltips.js` that add a description to engine controls (`.add-to-queue-btn`) or build a name (`.settings-theme-btn`).
- `title` given to `el()` in `views/tools/tag-sheet.js`.
- By design no tooltip: 11 `tooltip: false` buttons (close, dismiss, clear, scroll arrows) and the window buttons.

## Changed files
| File | Change |
|---|---|
| `tools/dev/tooltip-table.js` | New. Reads the source and writes `.agent/archive/polish-2/TOOLTIP-TABLE.md`. `--check` fails when the file is behind, `--stdout` prints it. No dependencies. |
| `.agent/archive/polish-2/TOOLTIP-TABLE.md` | New, generated: 114 rows in 7 groups, each with ID, control, name, state, description, shortcut, source and an empty Decision column. |
| `tools/tests/tooltip-table.test.js` | New unit test (4 tests). |
| `.agent/archive/polish-2/reports/P2-B7-tooltip-table.md` | This report. |

No existing file is modified. `CHANGELOG.md` is not touched (integration owner).

## Decisions made or needed
- **Owner: mark the table.** Write `keep`, `remove` or `new: <text>` in the Decision column; an empty cell means keep. Nothing is applied before that.
- **Owner: the engine rows.** 51 rows come from the engine and the old page template. Many repeat what the new UI shows (for example Play, Shuffle, Go back). When the old UI retires (phase 6.6) most of these go away, so marking them now may be wasted effort; the table does not split them by "visible in the new UI", because that needs a running app.
- IDs are a hash of group, control and text, so a row keeps its ID when only its source line moves.

## Checks
| Command or step | Result |
|---|---|
| `node tools/dev/tooltip-table.js` | Wrote 114 rows |
| `node tools/dev/tooltip-table.js --check` | Current |
| Two `--stdout` runs compared | Identical |
| `node --test tools/tests/tooltip-table.test.js` | 4 pass, 0 fail |
| `node tools/tests/run.js --list` | New test is classified as unit |

## Not run
- `npm run lint` / `lint:strict`: ESLint is not installed in this environment (`npm install` was not possible, no network). The new files follow the existing style but are **not linted**.
- The rest of the test suite: nothing existing was changed, so it was not run. `acorn` is also missing here, so tests that need it could not run anyway.
- The app itself (Electron): not run.
- **Archive step of AGENTS.md section 1** (`E:\Backup\...`): not possible here, the archive root is on the owner's machine. The patch only adds new files, and the uploaded zip is the pre-change state.

## Environment
Linux sandbox, Node v22.23.4, no browser, no ESLint, no network.

## Manual checklist for the owner
1. Open `.agent/archive/polish-2/TOOLTIP-TABLE.md` and read the group headings; spot-check a few rows against the app (for example hover the shuffle button in the player bar: name Shuffle, state On/Off, shortcut S).
2. Mark the Decision column and send the file back.
3. After that, to check the table is not behind: `node tools/dev/tooltip-table.js --check`.

## Open issues and follow-ups
- **Known gaps of a source reader:** texts built from data show as `{patterns}`; controls only visible in some states are all listed, with no "visible now" information; `tools/tests/README.md` has file counts (58 files, 20 unit) that this test makes stale by one, left alone on purpose.
- Applying the marks: edit the source at each row's Source, then run the generator again.
- Next in order: B2 (Add to playlist in the context menu).

## Patch
`P2-B7-tooltip-table.patch`: only the four new files above. It excludes `CHANGELOG.md`, the README test counts and any change to existing code.

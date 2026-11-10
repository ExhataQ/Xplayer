# Report: B7 apply (owner's marks) and the adapter budget

**Task:** B7 (second step) | **Agent:** B | **Date:** 2026-11-05 | **Status:** In review

## Applied from the marked table
| Row | Mark | Done |
|---|---|---|
| Player Shuffle | remove on/off text, keep Shuffle and S | Tooltip is "Shuffle" with shortcut S. It no longer stays open on a press (nothing changes in it). |
| Player Repeat | remove the mode, keep Repeat and R | Tooltip is "Repeat" with R. The button's accessible label still says the mode ("Repeat: all songs"). |
| App menu logo | remove | No tooltip. The button keeps its accessible name. |
| Player time (current) | remove | No tooltip. |
| Add to queue (rule) | remove description | The rule stays (it turns the engine's title into the shared tooltip), without "Plays right after the current song". |
| All rows marked keep | keep | Unchanged. |

## Not applied, needs the owner
- **Previous song / Next song** were marked "previous only no play" and "next only no play". I could not tell whether this means "show only the name Previous / Next (shorter text)" or "show the tooltip even when no song is loaded". Unchanged for now. Tell me which.
- **Engine row "Open your library"** (`.left-panel-header-title-group`): your note says these engine rows are mostly not in the real app. Nothing was removed. Say if the engine rows that are not in the real app should be taken out of the table (and the code) as a separate package.

## Adapter budget (DP14)
Plan bridges limit raised from 300 to 700 lines in `tools/checks/adapter-budget.js` (the freeze at 390 is gone); the test text in `ui-next-adapter-budget.test.js` follows. That test passes now.

## Other changes
- Tests follow the new texts: `ui-next-playback.test.js` (shuffle/repeat without a state; the repeat label cycle is checked on its aria-label), `ui-next-tooltips.test.js` (add to queue without a description). **These are browser tests and were not run here.**
- `.agent/archive/polish-2/TOOLTIP-TABLE.md` was made again from the source (111 rows). **Your marks in it are gone** (they are applied); your marked copy is the one in the zip you sent.

## Checks
| Step | Result |
|---|---|
| Unit run compared with the unchanged zip | same failures except the budget test, which now passes |
| Syntax check of changed JS | clean |
| Browser tests, lint | not run (no browser, no ESLint here) |

## Patch
In `P2-B2b-fix-and-B7-apply.patch`.

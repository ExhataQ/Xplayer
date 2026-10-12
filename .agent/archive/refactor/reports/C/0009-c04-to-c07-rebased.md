# Agent C report 0009: C-04 to C-07, rebased

Steps: C-04, C-05, C-06, C-07. This patch replaces `C-0008-c04-to-c07.patch` (do not apply both). Report 0008 in this patch is the full description of the work; this note says what changed when it was rebased.
Applies on top of: `Xplayer-main__1_.zip` uploaded on 2026-10-07 (A 0011 and A-S1 to A-S6, B 0010, D 0009 included).
Archive (.agent/AGENTS.md section 1): not done, `E:\Backup` is not reachable here. Take your own snapshot first.

## What changed in the rebase
- The old patch conflicted in three files only: `tools/change.log.txt`, `tools/tests/desktop-api.test.js`, `tools/tests/storage-core.test.js`. Their content is redone on the new versions. No source file of any agent conflicted.
- Checked against the new tree: no action is registered twice (D's `07a-ui-actions.js` and my files do not overlap), no forward load-time reference, `event-audit --strict` exits 0.

## Still needed from Agent A (unchanged)
`core/legacy.js`, `data-stop`: `event.stopPropagation()` -> `event.stopImmediatePropagation()` (line 124 in this zip). Until then `lyrics-panel-handlers.test.js` test 12 fails on purpose.

## Tests actually run (on the rebased tree)
- Full suite in groups: 68 tests (67 pass, 1 fail = test 12 above), 73 of 73, 77 pass with 2 skipped; plus `main-process-safety`, `startup-gate`, `theme-switcher`, `ui-handlers`, `ui-storage-api`: 52 of 52. Every test file in `tools/tests` was run.
- With A's line applied in a scratch copy: `lyrics-panel-handlers`, `legacy-bridge`, `ui-handlers`: 43 of 43.
- Old vs new real-click scenarios (73) on this zip versus the converted tree with A's line: see the result line at the end of this report.
- `dep-map`: mutable globals 52 -> 52, cycles 74 -> 75 (new parser file), load-time references 28 -> 28, forward 0.
- Not run: Electron, the smoke checklist.

## What is left for Agent C
Nothing, except:
- the `legacy.js` line (A) and the template's `#extended-info-content` inline `stopPropagation` (D or the template owner), which block two small things listed in report 0008;
- `08a`, `08e`, `11c` stay classic until A-16 (reason in report 0008). A-16 also waits on B-10 and D-09.

## Old vs new result
73 real-click scenarios, this zip versus the converted tree with A's line: 0 differences in what the user sees (the page has one more script element, for the new parser). 8 scenarios have no visible effect in either tree.

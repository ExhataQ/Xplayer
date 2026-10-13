# Agent D report 0003: rename recents:count-changed

Steps: D-03. Applies on top of: D-0002-duplicate-refreshes.patch.
Archive (.agent/AGENTS.md section 1): not done as written (`E:\` not reachable from the sandbox); the uploaded `Source-backup1.zip` stayed untouched as the snapshot.

## Changes

- `src/js/03e-recents-history.js`: emit `recents:countChanged`.
- `src/js/04h-recents-history-events.js`: listener renamed.
- `tools/tests/events-wiring.test.js` (line 300): the test's own listener renamed (one line).
- `src/js/core/EVENTS.md`: table row renamed; the sentence declaring the kebab-case exception (rule 1) and the "known inconsistency" paragraph removed, since nothing is inconsistent any more.
- `tools/change.log.txt`: entry appended.
- No recorded sequence in `tools/tests/expected/` or `events-wiring.test.js` contained the name, so nothing was re-recorded. The event has no other subscriber (`grep` over `src` and `tools`).

## Numbers

`node tools/tests/run.js --timing`, seconds: `events-b` 73.7, `events-wiring` 44.9, `listener-order` 9.4, `event-subscribers-modules` 8.3 (this run was on a busier machine than the earlier ones; no code path changed speed).
`node tools/dep-map.js`: unchanged (58 / 2 + 69 / 148, forward 0).
`node tools/event-audit.js --strict`: exit 0, A 0, B 0, C 0, total 0.

## Tests actually run

- `events-a`, `events-b`, `events-c`, `events-d`, `events-wiring`, `scroll`, `ui-virtual-scroll-modules`, `render-modules`, `listener-order`, `event-subscribers-modules`, `event-bus`, `recents`: pass.
- `grep -r "count-changed" src tools`: only `tools/change.log.txt` matches (this log entry and none else).
- Not run: the full suite, lint, scanner/metadata tests (see D-05 report).

## Needs from other agents

- none

## Not done

- `.agent/PLAN.md` and `.agent/BOARD.md` still say `recents:count-changed` in the step text; they are plan history (agent A's area), left as they are.

## For you (manual checks)

1. Play any song until it is saved to Recently played -> the Recent count in the UI still updates (if your build still shows it) and there is no error in DevTools.

## Next step

D-04 (left-panel list write helper).

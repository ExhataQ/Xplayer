# Agent A report 2: Plan 1 (event bus completion)

Applies on top of the current zip (folders slice and `a-setters-core.diff` already applied).

## Done

- **EB-A1:** `EVENTBUS-COMPLETION-PLAN.md` (the plan), `tools/event-audit.js` and `tools/event-allowlist.json` (the finish line), and a shared test harness `tools/tests/helpers/sequence-suite.js` with one suite per agent (`events-a/b/c/d.test.js`, `helpers/scenarios-<agent>.js`, `expected/events-<agent>.json`). The harness records call order from the unconverted code and refuses to overwrite a recorded sequence unless `EVENT_BASELINE=force`. `events-wiring.test.js` and `call-sequence-scenarios.js` are unchanged and frozen.
- **EB-A2:** `09-folders-playlists.js` `confirmDeleteFolder()` ended with a refresh (folders view, left panel, scrollbar) that repeated what `deleteFolder()` now does through `folder:listChanged`, even when the user pressed Cancel and nothing was deleted. Removed. Two scenarios were recorded on the old code first. The new recorded sequences are the old ones with only removals (10 -> 6 calls and 20 -> 16): nothing added, nothing reordered. Re-recorded with `EVENT_BASELINE=force` because this is a deliberate dedupe, not a pure move.

## Audit baseline (`node tools/event-audit.js`)

164 reaction calls from A, B and C files into D's functions: A 41, B 81, C 42. After this patch A's share is the figure above; B and C are untouched.

## Tests

`manifest`, `events-wiring`, `event-bus`, `recents`, `setters` and the four `events-*` suites pass (the b, c and d suites are empty skeletons and pass trivially). I did not rerun the browser tests that this patch cannot affect (`metadata-editor`, `scroll`, `search-ui`, `playback-settings`, `view-switch-song-list-cleanup`); run `tools/tests` once on your machine.

## Not done / needs a decision

- **EB-A3..A6** (03j, 03k, 09 split, 99-player boot) are next for A.
- `13-song-highlight` (27 calls, scroll/hover hot path): the plan asks B to decide whether it stays direct. I think it should, but B should confirm.
- The audit counts references, not runtime calls, and the allowlist is my judgment from the names. D reviews it (EB-D2).
- Archive per AGENTS.md and the `tools/change.log.txt` entry are still yours to do.

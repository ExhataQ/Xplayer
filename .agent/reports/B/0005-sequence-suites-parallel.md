# Agent B report 0005: sequence suites run in parallel pages, with a run-alone check

Steps: B-03. Applies on top of: patch `B-0004-scroll-waits-conditions.patch` (chain 0001 to 0004; only `tools/change.log.txt` is shared with 0004).
Archive (.agent/AGENTS.md section 1): not done. The archive root `E:\Backup\Programming\Music player` is not reachable from this session. Work was done on an extracted copy of the uploaded zip, which was left untouched. Take the snapshot yourself before applying.

## Changes

- `tools/tests/helpers/sequence-suite.js`:
  - The scenarios of one suite run in up to 4 pages at once (`pageCount`: at least 2, at most 4, the number of cores in between; `SEQUENCE_PAGES=<n>` overrides; `SEQUENCE_PAGES=1` is one after the other). Each page is its own browser context, as before. Recording a baseline (`EVENT_BASELINE`) always uses one page.
  - New rule: if pages ran in parallel and a scenario differs from its recorded sequence or has page errors, that scenario is run again alone and the alone result is the one that counts. A real regression also differs alone, so it still fails; a flip caused only by load passes, and `t.diagnostic` prints `N scenario(s) differed while P pages ran at once and were run again alone ...` with their names.
  - Comment at the top updated.
- `tools/change.log.txt`: one entry appended.
- Not changed: `events-a` to `events-d.test.js`, every `scenarios-*.js`, `call-sequence-scenarios.js` (its `measure` has no waits of its own), `expected/*.json` (compared with the snapshot, byte for byte).

## Why the retry rule exists (measured)

Running more than one page at a time changed a recorded order. `events-b`, this sandbox (1 vCPU):

| pages | result |
|---|---|
| 1 | pass, 76 s |
| 2 | pass 2 of 4 runs, fail 2 of 4 (the two failing runs where the scenario was recorded: "mutation refresh: artist view" and "mutation refresh: album view") |
| 4 | fail 4 of 5 runs; in the three runs where the failure was recorded it was "mutation refresh: album view" each time (an extra `updateActiveHighlight` before the last `updateSelectionHighlight`) |
| 8 | fail |

Both scenarios run `refreshCurrentViewAfterMutation()` followed by the scenario's own fixed wait (`AFTER_TIMERS`, 120 ms in `scenarios-b.js`), so the recorded order includes calls made by app timers up to that wait. The likely cause (not proven) is that app timers that start further timers run later when the CPU is shared while the scenario's single 120 ms timer does not, so an app call lands on the other side of the wait. With one page the order was stable in every run. Raising the default without the retry rule would have put intermittent "recorded sequence changed" failures in your suite, which look like a real regression. The retry rule keeps the speed and keeps the check meaningful.

## Numbers

Same sandbox as report 0001, `node --test tools/tests/events-X.test.js` wall time, default pages (2 here, because the sandbox has 1 core):

| suite | before (report 0001) | after (3 runs) | with 1 page (same environment) |
|---|---|---|---|
| events-a | 12.8 s | 9, 8, 8 s | not run |
| events-b | 81.9 s | 43, 48, 38 s | 73 s |
| events-c | 70.4 s | 38, 38, 40 s | 63 s |
| events-d | 0.7 s | 1, 1, 0 s | not run |

`events-b` is about 0.53 of its baseline and `events-c` about 0.55: close to the target of at most half, but not at it, on one core. The two pages overlap the idle start-up waits; more cores allow up to 4 pages and a larger gain, which could not be measured here. All 12 default runs passed; the retry fired once in them (events-b, "mutation refresh: album view").

## Tests actually run

- 12 default runs (events-a, b, c, d, three times each): all pass.
- `SEQUENCE_PAGES=1` for events-b and events-c: pass (so the recorded sequences are unchanged and also hold sequentially).
- Does a real regression still fail? On a copy of the tree, one recorded sequence in `expected/events-b.json` ("audio ended, repeat one: All Songs view, portable panel closed") was corrupted by adding an extra call. With default pages: fail (the run-alone check also differs, so it counts as a failure).
- Not run, and why: `events-wiring.test.js` (not a sequence suite, not touched), `npm run lint` (`eslint` not installed here).
- `src/`, `electron/`, `build/` and `expected/*.json` are identical to the snapshot.

## Needs from other agents

- C: `tools/tests/README.md` line 54 still calls `SEQUENCE_PAGES` "opt-in ... up to 3" and line 266 quotes timings measured with `SEQUENCE_PAGES=3`. The default is now up to 4 pages, with the run-alone check. Update those two places.
- D (`tools/tests/helpers/scenarios-b.js`): "mutation refresh: album view" and "mutation refresh: artist view" are the two that failed under load; 8 scenarios in the file end with `AFTER_TIMERS` and could behave the same. They pass alone, so this is not a defect of the code under test. If the scenarios waited for the app's timers to finish instead of a fixed 120 ms, the retry rule would hardly ever be needed. That changes what is recorded, so it is D's decision.

## Not done

- Faster than about 0.53 of the baseline on this one-core machine; the remaining time is page loads and in-page waits.
- Nothing was measured on a multi-core machine.

## For you (manual checks)

1. Apply the patch (after 0004) and run `node --test tools/tests/events-b.test.js` three times -> pass each time; a line `... were run again alone ...` may appear in the output of a run and is not a problem by itself. Then `$env:SEQUENCE_PAGES=1; node --test tools/tests/events-b.test.js` once -> pass (the sequential check).
2. Note the times. If the "run again alone" line shows up in nearly every run, or the same scenarios every time, tell me: the machine is too busy for 4 pages and the default should be lower.
3. Optional regression check: in a scratch copy add one extra call name to one array in `tools/tests/expected/events-b.json` and run the file -> it fails, naming that scenario.

## Next step

B-06 (`test:quick` / `test:fast`, `--shard`, CI) after you apply everything and send the new zip.

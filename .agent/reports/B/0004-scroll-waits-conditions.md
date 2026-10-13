# Agent B report 0004: scroll and view-switch tests wait for conditions, not for time

Steps: B-02. Applies on top of: patch `B-0003-modal-close-shared-page.patch` (chain 0001, 0002, 0003, then this).
Archive (.agent/AGENTS.md section 1): not done. The archive root `E:\Backup\Programming\Music player` is not reachable from this session. Work was done on an extracted copy of the uploaded zip, which was left untouched. Take the snapshot yourself before applying.

## Changes

- `tools/tests/scroll.test.js`: 20 of the 28 `waitForTimeout` calls are replaced; 8 stay and each has a comment.
  - After moving the mouse over a list (6 sites, one in the skipped test): `thumbReady(page)` waits until the scrollbar has the `visible` class (without it `.custom-scrollbar` has `pointer-events: none`, so a click cannot reach the thumb) and the thumb has a height. The left-panel test passes the left-panel ids.
  - After a scroll, a thumb release, a wheel burst or while the thumb is held (10 sites): `engineIdle(page)`, which is `waitForAppSettled(page, 2000, 600)`: no app timer shorter than 600 ms pending for two frames in a row. The 150 ms scroll settle and the 400 ms thumb-hold settle are such timers; the 750 ms scrollbar auto-hide is not (waiting for it would cost 750 ms every time).
  - After `setVirtualScrollThreshold` (2 sites), opening an artist or album view and building the smart-lyrics list (4 sites in all; the last two also call `engineIdle`): `reaches(page, fn)` waits for the state the next lines assert (virtual on/off and the row count; virtual mode with rows; the first lyrics row). If the state is not reached in 3 s it continues and the assertion that follows fails with its own message, so failure messages are the same as before.
  - Kept, with a comment each: 700 ms with the thumb held still (the window being observed: no placeholder may render), 40 ms between nudge moves in the skipped test, the random hold time before release (`pick([0, 60, 300])`), 25 ms and 16 ms between wheel events (the pace is the input: normal versus very fast wheel), 150 ms and 100 ms of holding the thumb before release in the detail-view and left-panel tests, 20 ms between left-panel wheel events.
- `tools/tests/view-switch-song-list-cleanup.test.js`: all 5 waits (150, 50, 150, 150, 150 ms) became `viewSettled(page)` (the same idle wait with a 2 s ceiling).
- `tools/tests/helpers/app-fixture.js`: `window.__pendingStartupTimers(limit = 900)` and `waitForAppSettled(page, maxMs = 3000, belowMs = 900)` take an optional limit. The defaults are the old values, so `gotoApp` and every existing caller behave as before.
- `tools/change.log.txt`: one entry appended.

## Numbers

Same sandbox as report 0001 (1 vCPU, Node 22.22.2).

| File | before | after | tests |
|---|---|---|---|
| `scroll.test.js` | 74.8 s (runner; 72.0 s standalone) | 67, 69, 66 s (three standalone runs) | 16: 15 pass, 1 skip (the one already skipped), 0 fail |
| `view-switch-song-list-cleanup.test.js` | 14.8 s | 15 s | 6 pass |

The done-when target for `scroll.test.js` (at most half its baseline) is NOT met: it is about 0.9 of the baseline here. Measured reasons, so the next step can be chosen with facts:

- Each test opens its own page of 3000 songs: one `gotoApp` takes 2.3 s here, 15 tests open one, about 34 s of the 66 s.
- After a thumb drag, `mouse.up()` itself takes 150 to 460 ms (the immediate re-render of a 3000-row list on one core), and then `engineIdle` takes 380 to 530 ms because the engine's own 400 ms thumb-hold timer is still running when the thumb is released. The old fixed 350 to 400 ms sleeps were approximating exactly that timer; waiting for the condition removes the guess but not the 400 ms.
- So replacing sleeps cannot reach half of this file. What can, and was not done: (a) several tests sharing one page (state resets in this file are fragile, see below), (b) tests of this file running in separate pages at the same time (a gain on a multi-core machine, none here; these tests are timing sensitive, see the 4-page failures in report 0005), (c) a controlled clock for the engine timers (changes what is measured).

## Tests actually run

- `node --test tools/tests/scroll.test.js`: 3 consecutive runs, 15 passed, 0 failed, 1 skipped each (done-when: 3 passes in a row).
- `node --test tools/tests/view-switch-song-list-cleanup.test.js`: 6 passed.
- Do the new waits still catch an engine fault? Mutation check on a separate copy of the tree (`SOURCE_ROOT=/tmp/...`), the working tree was never mutated:
  - the scroll settle (150 ms) no longer renders real rows: the new file fails 1 test and the original file from the snapshot fails 1 test too (which test each one failed was not recorded).
  - the thumb-hold settle (400 ms) no longer renders anything: the new file passes and the original file passes too. Neither version detects this; it was not detected before.
  So detection is the same as before on both.
- Not run, and why: `npm run lint` (`eslint` not installed here, no network); the skipped test ("a tiny thumb nudge ...") stays skipped, so its changed lines (`engineIdle` instead of 400 ms) were not executed; `app-fixture.test.js` was run after applying patches 0001 to 0005 to a fresh extract of the zip: 5 passed (together with `online-metadata` 11, `view-switch` 6, `modal-close` 26, `events-a` and `events-d`: all pass).
- `src/`, `electron/` and `build/` are identical to the snapshot.

## Needs from other agents

- none

## Not done

- The "at most half" target for `scroll.test.js` (see above for what would be needed).
- The skipped nudge test was converted but not run.

## For you (manual checks)

1. Apply the patch (after 0003) and run `node --test tools/tests/scroll.test.js` three times on your machine -> 15 pass, 1 skipped each time, and note the time against your own baseline from `npm run test:timing`. A faster machine has less rendering time, so the share of fixed engine timers is larger there; the ratio can differ from mine.
2. Optional: in a scratch copy comment out `renderVisibleItems(target, false);` in `scheduleVirtualScrollSettle` (`src/js/05a-lazy-load-main-list.js`, around line 467) and run the file -> at least one test fails. Restore the line.

## Next step

B-06 after you apply everything and send the new zip. Report 0005 (B-03) is independent of this one except for `tools/change.log.txt`; apply 0004 before 0005.

# Agent B report 0008: replace writes in 10b, 15b and 15c

Steps: B-03. Applies on top of: B report 0007.
Archive (.agent/AGENTS.md section 1): not done, no access to the archive root from here.

## Changes

- `src/js/10b-playback-smart-shuffle.js`: 10 direct writes now call setters: `setSmartShuffleSourceId`, `setSmartShufflePreviousSong`, `setSmartShuffleJourney`, `setSmartShuffleJourneyIndex`, `setShuffleMode`, `setIsShuffled`, and `setShuffleIndex`. Three places read `list[index++]` (the next song of the smart shuffle journey and of the normal shuffle order, twice). They now read `list[index]` and then call `setX(index + 1)` on the next line, which is the same order of reading and incrementing.
- `src/js/15b-controls-shuffle-btn.js`: 16 direct writes now call setters (`setIsShuffled`, `setShuffleMode`, `setRepeatMode`, `setRepeatFunctionalityActive`, `setRepeatVisualState`, `setPlaybackQueue`, `setCurrentQueueIndex`).
- `src/js/15c-controls-repeat-btn.js`: 10 direct writes now call setters (repeat mode, visual state, functionality flag, queue and index).
- `tools/tests/shuffle.test.js`: it loads `10a` and `10b` alone in a sandbox, so it now also loads `core/state-playback-modes.js` first, the same position as in the app. Without it the test fails with `setSmartShuffleSourceId is not defined`. No test logic changed.
- `tools/change.log.txt`: one entry.
- Everything except the three `list[index++]` reads is a mechanical replacement of `x = value;` by `setX(value);` in the same place, statement order unchanged. No comment was added.
- `10a-playback-shuffle.js` is not changed: it declares the smart-shuffle variables and `shuffleIndex`, and a file may write its own variables.

## Numbers

`node tools/dep-map.js` before and after: mutable globals written from other files **52 -> 52**, file-level cycles **70 -> 70**, load-time cross-file references **26 -> 26**. The headline numbers do not move yet (A-07 and the other agents' Phase 1 steps are not done). Counted from `node tools/dep-map.js json`: direct writes from B's files to variables declared elsewhere **61 -> 25** in this step (101 before B-02), B files with any such write **9 -> 6**; for the whole project 223 -> 147. What is left in B: `14` 1, `15a` 1, `15d` 8, `15e` 10, `15f` 2, `17` 3.
`node tools/event-audit.js --strict`: exit 0, A 0, B 0, C 0.

## Tests actually run

- `node --test tools/tests/shuffle.test.js setters.test.js manifest.test.js events-wiring.test.js event-bus.test.js`: 37 pass, 0 fail (`shuffle` failed before the test change, as explained above).
- `node --test tools/tests/events-a.test.js events-b.test.js events-c.test.js events-d.test.js` (Playwright, real browser): 4 pass, 0 fail.
- Before/after state comparison (a throwaway script, **not in this patch**): 99 scenarios drove `10b`, `10c`, `10d`, `14`, `15a`, `15b`, `15c`, `15d`, `15e`, `15f` and `17` in a real page on the original code and on the code after B-02 and B-03, with `Math.random` and `Date.now` pinned, comparing queue, index, shuffle and repeat flags, shuffle order and index, smart shuffle journey, last played song, list id and the audio element in use. **99 of 99 identical.** The 36 write sites changed in this step were all reached (checked with JS coverage), including the three `list[index++]` reads. The script gives the same result on two runs of the same code and fails on a deliberately wrong conversion. Limit: it compares the final state of each scenario, so a value that is set wrongly and then set again later in the same flow would not show.
- Over those 99 scenarios `queue:changed` fires 106 times instead of 63 and `queue:indexChanged` 164 instead of 80 (setters emit where the old code assigned silently). Nothing subscribes to them.
- Not run, and why: `scroll`, `search-ui` and the other suites were not re-run for this step; the full set is run at the end of B-04.

## Needs from other agents

- none

## Not done

- `15b` and `15c` still push into the queue in place (`playbackQueue.push(...)`). That is not a write; see report 0006, item 2.

## For you (manual checks)

1. Turn shuffle on and off with the shuffle button and the shuffle menu, in All Songs and in a playlist -> the next songs follow a shuffled order; turning it off goes back to list order from the current song.
2. Start Smart Shuffle on a list of more than 50 songs and press Next several times -> songs come one after another without repeats; on a short list Smart Shuffle shows its warning.
3. Click the repeat button through off, repeat all, repeat one, off, once with shuffle off and once with shuffle on -> the icon and tooltip follow, repeat one loops the song, and turning it off with shuffle on brings the shuffled queue back.
4. With repeat all on, let the last song of a list end -> it starts again from the first.

## Next step

B-04: replace the writes in `14`, `15a`, `15d`, `15e`, `15f` and `17`, and report which variables only B's files use.

# Agent B report 0007: replace writes in 10c and 10d

Steps: B-02. Applies on top of: B report 0006 (which is on top of `Source-backup__3_.zip`).
Archive (.agent/AGENTS.md section 1): not done, no access to the archive root from here.

## Changes

- `src/js/10c-playback-queue.js`: 9 direct writes now call setters: `setQueueDisplayLimit` (load more), `setCurrentQueueIndex` (remove last song, remove an earlier song, insert before the current one), `setPlaybackQueue` + `setCurrentQueueIndex` (queue cleanup), and `setGaplessActiveElement`, `setAudioElement`, `setGaplessAudioElement` (gapless swap). `x--`, `x++` and `x += n` became `setX(x - 1)`, `setX(x + 1)`, `setX(x + n)`.
- `src/js/10d-playback-song.js`: 31 direct writes now call setters: queue and index (all play-from-list, history, view-start and queue-creation paths), `setQueueDisplayLimit`, `setLastPlaybackListId`, `setIsManualPlay`, `setIsPrevNavigation`, `setNextSearchItemSlotId`, `setNextFavoriteSlotId`, `setIsShuffled`, `setShuffleMode`.
- `tools/change.log.txt`: one entry.
- Every change is a mechanical replacement of `x = value;` by `setX(value);` in the same place. The order of statements is unchanged. No code was added or moved, and no comment was added.

## Numbers

`node tools/dep-map.js` before and after: mutable globals written from other files **52 -> 52**, file-level cycles **70 -> 70**, load-time cross-file references **26 -> 26**. The three headline numbers do not move yet: each of those variables is still written from other files too (B's remaining files, `06k`, `07`, `08*`, `09`). Counted from `node tools/dep-map.js json`, direct writes from B's files to variables declared elsewhere went **101 -> 61** (the 40 in `10c` and `10d` are gone), and B files with any such write went **11 -> 9**.
`node tools/event-audit.js --strict`: exit 0, A 0, B 0, C 0.

## Tests actually run

- `node --test tools/tests/setters.test.js shuffle.test.js manifest.test.js events-wiring.test.js event-bus.test.js`: 37 pass, 0 fail.
- `node --test tools/tests/events-a.test.js events-b.test.js events-c.test.js events-d.test.js` (Playwright, real browser): 4 pass, 0 fail. These compare the order of UI calls with sequences recorded before the event bus work, so they would catch a reorder.
- A before/after state comparison (a throwaway script, **not in this patch**): 52 scenarios drove `10b`, `10c` and `10d` in a real page on the old and the new code, with `Math.random` and `Date.now` pinned, and compared queue, index, shuffle and repeat flags, last played song, list id, ghost slot ids and the audio element in use after each one. **52 of 52 identical.** All 40 changed write sites were reached (checked with JS coverage). The script gave the same result on two runs of the same code, and it did fail on a deliberately wrong conversion I tried. Limit: it compares the final state of each scenario, so a flag that is set wrongly and then set again later in the same flow would not show.
- The queue setters now emit `queue:changed` / `queue:indexChanged` where the old code assigned silently: 21 -> 47 and 26 -> 83 events over those 52 scenarios. Nothing subscribes to them, so nothing else changed.
- Not run, and why: `scroll`, `search-ui` and the other suites were not re-run for this step (none of them involve these files); the full set is run at the end of B-04.

## Needs from other agents

- none

## Not done

- In-place queue changes (`push`, `splice`) in `10c` and `10d` are not writes and stay as they are (see report 0006, item 2).

## For you (manual checks)

1. Play a song from All Songs, from a playlist, from a search result and from Liked Songs -> it plays, and the Queue tab shows that list with the right song current.
2. In the Queue tab, remove a song after the current one, one before it, and the playing one -> the queue and the highlight stay correct and the next song plays when you remove the current one.
3. Use the big play button in each view, with shuffle off, on, and with Smart Shuffle (list over 50 songs) -> playback starts with the expected song and the shuffle button state is right.
4. If gapless playback is enabled in settings, let a song end -> the next one starts with no gap and the controls keep working.
5. Scroll to the bottom of a long queue and press "load more" -> more songs appear.

## Next step

B-03: replace the writes in `10b`, `15b` and `15c`.

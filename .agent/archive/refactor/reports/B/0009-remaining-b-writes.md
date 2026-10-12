# Agent B report 0009: replace writes in the remaining B files

Steps: B-04 (this also closes B-02 and B-03 for the playback group). Applies on top of: B report 0008.
Archive (.agent/AGENTS.md section 1): not done, no access to the archive root from here.

## Changes

- `src/js/14-song-navigation.js`: 1 write, `setSearchQuery`.
- `src/js/15a-controls-time-play.js`: 1 write, `setShowRemainingTime(!showRemainingTime)`.
- `src/js/15d-controls-track-nav.js`: 8 writes, `setLastPlayedSong`, `setLastPlayedSongStartTime`, `setIsManualPlay`.
- `src/js/15e-controls-audio-events.js`: 10 writes, `setLastPlayedSong`, `setLastPlayedSongStartTime`, `setCurrentQueueIndex`, `setPlaybackHistoryStack`, `setHistoryNavigationIndex`, `setLyricsPreView`, `setLyricsPreScrollTop`.
- `src/js/15f-controls-progress-seek.js`: 2 writes, `setWasPlaying`.
- `src/js/17-song-selection.js`: 3 writes into the selection variables that `04a` declares: `setSelectionHighlights`, `setSelectedSongId`, `setLastSelectedIndex`.
- `13-song-highlight.js` and `16-context-menu-actions.js` have no direct writes and are unchanged.
- `tools/change.log.txt`: one entry.
- Every change is a mechanical replacement of `x = value;` by `setX(value);` in the same place; statement order is unchanged. No code was added or moved, and no comment was added.

## Numbers

`node tools/dep-map.js` before and after: mutable globals written from other files **52 -> 52**, file-level cycles **70 -> 70**, load-time cross-file references **26 -> 26**. The headline numbers cannot move yet, for two reasons (see "Needs from other agents"): the setter files in `core/` count as writers of the variables they wrap, and 22 variables are still assigned directly in other agents' files.
Counted from `node tools/dep-map.js json`: direct writes from B's files to variables declared in another file **101 -> 0** across B-02 to B-04 (25 in this step), B files with any such write **11 -> 0**; for the whole project 223 -> 122. Of the 52 variables, **30 are now written only by their setter file**. The only direct writes left in B's files are in `10a`, to variables it declares itself (`shuffleIndex` and the five smart-shuffle variables), which is allowed.
`node tools/event-audit.js --strict`: exit 0, A 0, B 0, C 0.

## Tests actually run

- Full set, `node --test` on all 22 files in `tools/tests/` with Playwright and a real browser, in four groups: **135 tests, 133 pass, 0 fail, 2 skipped**. The skips are old: an obsolete note in the storage test, and the timing-sensitive scroll test that skips itself in sandboxed environments.
- Before/after state comparison (a throwaway script, **not in this patch**): 99 scenarios drove `10b`, `10c`, `10d`, `14`, `15a` to `15f` and `17` in a real page on the original code and on the final code, with `Math.random` and `Date.now` pinned, comparing queue, index, shuffle and repeat flags, shuffle order and index, smart shuffle journey, last played song and its start time, list id, history stack and index, lyrics pre-view values, selection variables and the audio element in use. **99 of 99 identical.** JS coverage shows all 101 write sites of B-02 to B-04 were executed by these scenarios. The script gives the same result on two runs of the same code and fails on a deliberately wrong conversion. Limit: it compares the final state of each scenario, so a value set wrongly and then set again later in the same flow would not show.
- Over those 99 scenarios `queue:changed` fires 106 times instead of 63 and `queue:indexChanged` 169 instead of 80, because the queue setters emit where the old code assigned silently. Nothing subscribes to them. The other setters do not emit.
- Not run, and why: the Electron app itself.

## Needs from other agents

- A: the "mutable globals assigned from other files" line of `tools/dep-map.js` counts the setter files in `core/` as writers, so it cannot reach the Phase 1 done-when ("0 ... for the groups above") even when every other file is converted. Suggest `dep-map.js` ignores writers in `core/state-*.js`, or the done-when is reworded to "no writer outside the variable's own setter file". By that second measure 30 of the 52 variables are done today.
- A (A-07): variables used only by B's files, so A can move them out of `00-state.js` when A wants (the move must be one change with B moving the declaration into a B file, because a `let` declared in two scripts is a SyntaxError): `wasPlaying` (15f), `showRemainingTime` (15a), `queueDisplayLimit` (10c, 10d), `repeatVisualState` (15b, 15c), `repeatFunctionalityActive` (10b, 10c, 10d, 15b, 15c, 15d, 15e). B will do its half on request. `selectionHighlights` and `lastSelectedIndex` are NOT B-only: `04a` uses them heavily.
- D (D-01, D-02): B's variables that D's files still assign directly, all already in D's steps: `07-views`: `historyNavigationIndex`, `isManualPlay`, `isNavigatingHistory`, `isPrevNavigation`, `lyricsPreScrollTop`, `lyricsPreView`, `playbackHistoryStack`, `nextSearchItemSlotId`, `searchQuery`, `currentSearchSessionId`, `currentView`; `06b-modals`: `currentQueueIndex`; `06k-keyboard-shortcuts`: `currentQueueIndex`, `playbackQueue`; `04a`: `nextFavoriteSlotId`, `nextSearchItemSlotId`.
- C (C-01): `08e` and `08h` still assign `currentView`, `searchQuery`, `currentSearchSessionId`, `nextSearchItemSlotId`.
- Queue and index are set one after the other in 14 places, so a future subscriber of `queue:changed` would see a half-updated state, and 15 in-place `push`/`splice` calls emit nothing (report 0006, items 1 and 2). Not a problem until something subscribes.

## Not done

- B-05 and B-06 are already done by the event bus work (nothing to do here). B-07 to B-10 wait for A-10, A-13 and A-14 as the plan says.

## For you (manual checks)

1. Play songs and press Next and Previous, with shuffle off and on -> the right songs play; Previous restarts the song if it is past 3 seconds.
2. Let a song end with repeat off, repeat all and repeat one -> it stops, restarts the list, or loops, as the button says; when the last song ends in a lyrics view, the previous view comes back.
3. Click the time display on the player bar -> it switches between elapsed and remaining time.
4. Drag the progress bar while a song plays and while it is paused -> it seeks, and playback resumes only if it was playing.
5. Select songs with click, Ctrl-click and Shift-click, delete one, then clear the selection with Escape or by clicking elsewhere -> the highlights follow and nothing stays stuck.
6. Play a song found through search, then use "go to current song" -> the search view opens with the query and the song is in view.

## Next step

Hand B-02 to B-04 over for merge. After that B is waiting for A-10 (B-07), then A-13 and A-14 (B-09), as the plan says. If A asks, B moves the declarations of the B-only variables above (A-07).

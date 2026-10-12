# Agent A report 3: Plan 1, Agent A steps finished

Applies on top of `eventbus-plan1-a.diff` and the earlier patches. Audit for A: **0** reaction calls (from 41).

## Changes

- **EB-A3** `03j` `changeMusicFolder()`: the inline block was a copy of `resetLibraryAfterRebuild()` + the `library:rebuilt` subscriber (`04i`). It now calls `resetLibraryAfterRebuild(result.songs)`.
  - Recorded on the old code first, two scenarios (All Songs open, another view open).
  - Differences from the old behavior, both checked:
    1. The old copy called `updateAllCounts()` a second time after redrawing the left panel. Removed. I compared a DOM snapshot (left panel HTML, hero count, now-playing display, queue, play button) before and after in a real page: identical. The count element is rebuilt only by `closeFolder()` in `09`, which sets the count itself, so the second call had nothing to fix.
    2. The old copy reset the play button tooltip to "Play"; `rebuildLibraryFromFolders()` never did. Kept in `changeMusicFolder()` so that path behaves exactly as before (without it the tooltip could stay "Pause").
  - Re-recorded the sequences with `EVENT_BASELINE=force` because of (1); the new sequences equal the old ones minus exactly that one call.
- **EB-A4** `03k`: scan-covers-complete now emits `covers:scanCompleted`; the redraw (with its `typeof` guard) moved verbatim into `04i-library-rebuild-events.js`. Sequence unchanged. Sabotage check: removing the redraw from the subscriber fails the suite.
- **EB-A5** `09` `removeSongFromPlaylistAndRefresh()` emits `playlist:songRemovedFromView { songId, playlistId }`; the redraw moved verbatim into `04k-playlists-events.js`. It is a separate event from `playlist:songCountChanged` because `removeSongFromPlaylist()` has other callers that never redrew the playlist view. Sequence unchanged; sabotage check fails as expected.
- **EB-A5/A6 decisions, not conversions:** the remaining 30 calls in `09` (`openPlaylist`, `toggleFolderExpandedFromUI`, `closeFolder`) and `99-player.js` (`toggle*Filter`, first paint at start-up) are view handlers and start-up, not reactions to data. They are in `fileExceptions` in `tools/event-allowlist.json`, each with a reason. `tools/event-audit.js` now prints how many calls are excepted so they stay visible.
- `EVENTS.md` has the two new events; `EVENTBUS-COMPLETION-PLAN.md` marks A's steps done. `tools/agent-briefs-plan1.md` has the pasteable briefs for B, C and D.

## Audit

A 0, B 81, C 42 (123 left), plus 30 excepted calls for D to review. Before: 164.

## Tests run

`events-a` (6 scenarios in 3 steps of baseline/convert/sabotage), `events-wiring`, `manifest`, `music-folders`, `setters`, `recents`. Not run: the browser tests that these files cannot affect.

## Needs from other agents

- **D (EB-D2):** review the four `fileExceptions` entries. If D thinks any of those calls is a real reaction, tell A which one.
- **D:** `closeFolder()` redraws five lists in a row. If D has a single function for "redraw all left panel lists", that would be a simplification, but it is not event-bus work.

## Not done

Archive per AGENTS.md and the `tools/change.log.txt` entry are still yours (the log is empty in the zip, so I did not guess the format).

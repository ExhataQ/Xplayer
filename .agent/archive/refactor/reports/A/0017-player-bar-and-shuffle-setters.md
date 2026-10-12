# Agent A report 0017: player-bar arrow wrappers, shuffle setters, docs

Steps: unblocks B-10 (14-song-navigation.js to a module). Applies on top of: Xplayer-main (B report 0012 state).
Archive (.agent/AGENTS.md section 1): not done. The archive root (E:\Backup\...) is not reachable from this session; take the snapshot before applying.

## Changes

- ui/player-bar.js: the two `addEventListener('click', ...)` references to `navigateToCurrentSongInList` and `navigateToCurrentArtist` are now arrow functions that call them when clicked. Nothing is looked up while the file loads, so 14 can become a module. Same behaviour on click. `ui/player-bar.js` stays classic.
- core/state-playback-modes.js: added `setShuffleOrder(value)` and `setShuffleSourceId(value)`.
- core/SETTERS.md: rows for the two new setters; "Declared in" corrected to `10a0-shuffle-state.js` for the shuffle variables and `15a0-controls-state.js` for `wasPlaying` and `showRemainingTime`; "Still written directly from" now says 10a for the shuffle variables (10b no longer writes them) and nothing outside core for the two 15a0 variables.
- core/STORAGE.md: removed the stale "Still using localStorage" list (it still named 16 and four other files that already use core/storage.js).

## Needs from other agents

- B: in `10a-playback-shuffle.js` replace the direct writes (`shuffleOrder`, `shuffleSourceId`, and the other shuffle variables, which already have setters) with the setters, then convert `14-song-navigation.js` (B-10). The manifest line for 14 moves to "modules"; register `navigateToCurrentArtist` and `navigateToCurrentSongInList` with `registerLegacyGlobals` if anything else calls them by bare name.

## Not done

- Tests, dep-map and event-audit not run: `acorn` is not installed in this session, so `tools/dep-map.js` fails.

## Next step

B-10 for 14-song-navigation.js.

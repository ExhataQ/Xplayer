# Agent A report 0006: split 99-player.js

Steps: A-11. Applies on top of: Xplayer-main zip 0f9d42ae (commit 8e35a1e state).
Archive (.agent/AGENTS.md section 1): not done, nothing archived.

## Changes

- src/js/99-player.js: now only the two build placeholders and the `DOMContentLoaded` bootstrap (828 -> 328 lines).
- src/js/core/utils.js: escapeHtml, escapeHtmlAttr, generateLongId, generateConsistentId.
- src/js/library/songs.js: deletedSongIds, getActiveSongs, markSongAsDeleted, filterDeletedSongs, getActiveFavoritesCount.
- src/js/playback/session.js: saveCurrentPlaybackState, shouldSaveToRecentlyPlayed.
- src/js/ui/filters.js: playlists/albums/artists filter tags.
- src/js/ui/layout.js: left panel collapse/expand, window resize listener, initPanelResize, initTracklistScrollEffect.
- src/js/library/import-dropped.js: importDroppedFiles.
- src/js/ui/window-controls.js: close/minimize/maximize and the maximize icon.
- src/js/ui/player-bar.js: the load-time wiring for the search button, player title/artist/cover and album art.
- src/manifest.json: `core/utils.js` and `library/songs.js` after `core/state-ui.js`; the other six after `04v-right-panel-events.js`, in their old order.
- .agent/PLAN.md, .agent/BOARD.md, tools/change.log.txt: A-11 status and log.

Code was moved verbatim. No declaration was left behind in 00-state.js, and nothing was added to it.

## Numbers

`node tools/dep-map.js` before -> after: load-time cross-file references 26 -> 26 (forward: 0 -> 0); file-level cycles 71 -> 73 (new files that call across existing ones; no new load-time dependency).
`node tools/event-audit.js --strict`: exit 0, A/B/C 0, 68 allowed by fileExceptions.

## Tests actually run

- All 23 files in tools/tests: 149 tests, 147 passed, 0 failed, 2 skipped (includes the browser and call-sequence tests).
- Not run, and why: the manual app check below.

## Needs from other agents

- none

## Not done

- The plan also listed `debounce` and `getSongById` for `core/utils.js` / `library/songs.js`. They are state-ownership helpers in 00-state.js and the plan keeps them there for now.
- Load-time references were not moved into `DOMContentLoaded`: that would change listener timing, so they stay at load in `ui/player-bar.js`.
- `SONGS_DATA` and `PLACEHOLDER_IMAGE` stay in 99-player.js because they are build-time templates.

## For you (manual checks)

1. Start the app -> the library and loading screen behave as before.
2. Shrink the window, then grow it -> the left panel collapses and expands; drag its edge to resize.
3. Right-click the player title, artist, cover and album art -> the context menu opens; click the title -> jumps to the song.
4. Drag audio files onto the content area -> they import. Click Playlists/Albums/Artists tags -> the filters toggle.

# Agent D report 0002: duplicate left-panel refreshes

Steps: D-02. Applies on top of: D-0001-search-clear.patch (which applies on Source-backup1.zip).
Archive (.agent/AGENTS.md section 1): not done as written (`E:\` is not reachable from the sandbox). The uploaded `Source-backup1.zip` stayed untouched as the pre-change snapshot; all work was done on a copy.

## Changes

Removed calls (each one was checked against the rule "only a call whose effect is fully repeated next to it"):

- `src/js/04k-playlists-events.js`, `playlist:listChanged`: the block `if (leftPanelVirtualState.enabled) { currentItems = getLeftPanelItemsArray(); renderLeftPanelVisibleItems(false); }` after `renderLeftPanelMainList()`. In every mode `renderLeftPanelMainList()` ends with the same list rebuilt from the same data (virtual: `refreshLeftPanelLazy`; not virtual: `initLeftPanelLazyLoading`; folder open: it tears the virtual list down, so the block was skipped anyway).
- `src/js/04k-playlists-events.js`, `playlist:deleted`: `renderPlaylistsView()`, `renderLeftPanelMainList()`, `updateScrollbarById('left-panel-main-content')`. `deletePlaylistAndClose` emits `deleted` right after `deletePlaylist`, which already emitted `listChanged` (its only other emitter is nowhere: `grep "playlist:deleted"` finds one `emit`). Nothing changes between the two events. The notification stays.
- `src/js/04h-recents-history-events.js`, `history:cleared`: `showHeroSection(true)` and `updateHeroSection('Recents', 0, 'Playlist', 'History')`. `renderHistoryView()` right after makes both calls (plus `showHeroClearButton(false)`), with the same arguments because the history is already empty when the event is emitted.
- `src/js/15e-controls-audio-events.js`, repeat-one in `audio.onended`: `emit('playback:recentPanelChanged')` after `emit('playback:recentViewChanged')`. `saveToRecentlyPlayed()` just before it emits `recents:added`, whose subscriber redraws the same portable panel from the same data. The emit is kept, moved into an `else` of the save guard, so it still runs when nothing was saved (found by comparing the final DOM; a plain removal differed there).
- `src/js/03c-playlists.js`: comment above `emit('playlist:deleted')` said the subscriber repeats part of the refresh; it now says it only shows the notification.

Sites looked at and left alone:

- `04i` (`library:rebuilt`): the trailing `renderLeftPanelMainList()` repeats the one inside `renderPlaylistsView/renderAlbumLeftPanelItems/renderArtistLeftPanelItems` only when at least one of them has something to draw (each returns early on an empty list). With none of the three and the left panel not virtual (state reached by `teardownLeftPanelLazyLoading()`), removing it left the left panel un-rebuilt (virtual stayed off, list stale). That state is rare, but the call is not fully repeated, so it stays.
- `04n` (`data:imported`): same reasoning. With no playlists and no folders the trailing `renderLeftPanelMainList()` is the only refresh, and an import can change the Liked Songs count.
- `04k` `playlist:songRemovedFromView`: `renderLeftPanelMainList()` then `updateLeftPanelCounts()` also looks like a pair, but `updateLeftPanelCounts()` additionally calls `updateRecentCount()`, so it is not a repeat.
- `listChanged`'s own `renderLeftPanelMainList()` after `renderPlaylistsView()`: needed when the last playlist was deleted (`renderPlaylistsView` returns early on an empty list).

Recorded sequences changed (the other sequence suites pass unchanged):

- `tools/tests/expected/events-b.json`, "audio ended, repeat one: Recent view and portable panel open": `renderPortableRecentlyPlayed, renderRecentlyPlayed, renderPortableRecentlyPlayed` -> `renderPortableRecentlyPlayed, renderRecentlyPlayed`.
- `tools/tests/events-wiring.test.js`, "playlists: create, add a song, remove it, delete": two `renderLeftPanelVisibleItems` entries removed (one in the create reaction, one in the delete reaction).
- `tools/tests/events-wiring.test.js`, "history: clear while the History view is showing": the leading `showHeroSection, updateHeroSection` removed.
- `tools/tests/events-wiring.test.js`, "playlists: delete through the confirm flow": `renderLeftPanelVisibleItems` removed from the first half and the whole second half (`renderPlaylistsView, renderLeftPanelMainList, updateScrollbarById`) removed; now `renderPlaylistsView, renderLeftPanelMainList, updateScrollbarById, showNotification`.
- `tools/change.log.txt`: entry appended.

## Numbers

`node tools/tests/run.js --timing`, seconds, before -> after: `scroll` 68.3 -> 67.2 (16 tests, 15 pass, 1 skipped both times); `events-b` 67.9 -> 65.1; `events-a` 10.5 -> 10.5; `render-modules` 6.2 -> 6.0; `ui-virtual-scroll-modules` 4.4 -> 3.9; `events-wiring` 36.7 -> 37.3; `events-c` 56.2 -> 55.6; `events-d` 0.7.
`node tools/dep-map.js`: mutable globals written from other files 58 -> 58, file-level cycles 2 + 69 -> 2 + 69, load-time cross-file references 148 -> 148 (forward 0).
`node tools/event-audit.js --strict`: exit 0, A 0, B 0, C 0, total 0 (plus 70 allowed by fileExceptions).

## Tests actually run

- `events-a`, `events-b`, `events-c`, `events-d`, `events-wiring`, `scroll`, `ui-virtual-scroll-modules`, `render-modules`: all pass (`events-b` after re-recording its one sequence).
- Also run: `ui-handlers`, `drag-drop`, `drag-drop-modules`, `playback-handlers`, `listener-order`, `event-subscribers-modules`, `scrollbar-publication`, `recents`, `search-ui`, `search-clear`: all pass.
- Extra check (a scratch script, not part of this patch): 24 scenarios run on the old and the new tree and the final DOM compared (left-panel HTML and item list, virtual on/off, open folder, hero, song list, portable Recent panel, notifications, current view): playlist create and delete (last, one of two, open playlist, inside an open folder, pinned, virtual off), library rebuild (several states), history clear (History view and another view), repeat-one ended (panel open, panel closed, no queue item). After the fix in `15e` all 24 are identical; the first version of the `15e` change differed in one of them, and `04i` differed in one, which is why those two were changed or left alone as described above.
- Not run: the full suite, lint (see D-05 report), scanner and metadata tests (`jimp`, `music-metadata` not installable in this sandbox; nothing here touches them).

## Needs from other agents

- none

## Not done

- The nested duplicates that remain inside the render functions themselves (for example `renderPlaylistsView` ending with `renderLeftPanelMainList()` and `updateLeftPanelCounts()`, which then refresh the virtual list twice) are not touched: removing them changes functions with many other callers and is outside the listed sites.

## For you (manual checks)

1. Create two playlists, then delete one through its menu -> the left panel shows the other one, the "Playlist deleted" notification appears once, no flicker or error in DevTools.
2. Delete the last playlist -> it disappears from the left panel and the app goes to All Songs.
3. Play a song with repeat-one on, with the Recent view open and the Recently played side panel open; let the song end -> the song restarts, the song is at the top of both lists, no error.
4. Open the Recents history view, clear the history -> the header shows "Recents / 0" and the empty-history message, and the "Play history cleared" notification appears once.

## Next step

D-03 (rename `recents:count-changed`).

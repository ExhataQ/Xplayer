# Agent B report 0003: EB-B4

Patch: `B-0003-selection-counts-events.patch`. Applies on top of `B-0001` and `B-0002`.

## Done

- **EB-B4** `17-song-selection.js`: 24 of the 27 audited calls converted, 3 left on purpose (see "Not converted"). Audit for B: 54 -> 30.
- Public names and signatures are unchanged: `syncAllUIState()`, `onSongsChanged()`, `refreshCurrentViewAfterMutation()` and `updateLeftPanelCounts()` keep working for their callers in 06f, 06k, 09, 16, 20, 99, 03j, 04b and 04i, who are not touched.
- Subscriber code added to `src/js/04p-playback-events.js` (no new file, no manifest change). The DOM code moved verbatim.
- 19 scenarios added to `helpers/scenarios-b.js`, recorded on the unconverted code first. The 26 earlier scenarios were re-checked during that baseline step and still matched. After conversion all 45 recorded sequences reproduce exactly, including the calls D's own functions make internally (nested `updateHeroSongCount`, `updateScrollbarById`, `updateActiveHighlight`).

## Events added (rows in `EVENTS.md`, Agent B section)

| Event | Payload | Emitted by | What the subscriber does |
|---|---|---|---|
| `favorites:changed` | none | `syncAllUIState()` | Body moved unchanged: left-panel counts, all counts, Favorites view redraw or hero count for the current view, scrollbar. All 4 callers (toggle, menu toggle, two drag-drops) are favorite additions or removals. |
| `songs:changed` | none | `onSongsChanged()` | Body moved unchanged: counts, playlist/folder/album/artist left-panel lists, `refreshCurrentView()`. |
| `viewSongs:changed` | `{ count }` | `refreshCurrentViewAfterMutation()` | Per-view redraw and hero count, then the counts and scrollbar tail. `count` is `null` when the current view has no branch (Search, etc.). |
| `leftPanelCounts:changed` | none | `updateLeftPanelCounts()` virtual-list branch | `getLeftPanelItemsArray()`, set `currentItems`, `renderLeftPanelVisibleItems(false)`, same as the old inline code. |

## Order and state

- `refreshCurrentViewAfterMutation()` keeps the selection work in B: removing stale `.selected` classes and highlight elements, and `pruneSelectionSet(validIds)` in every branch. That happens before the emit, which is where it happened before each redraw. The only code that sat between prune and redraw was `virtualScrollState.currentSongs = ...` (a write into D's state); it now runs in the subscriber, still before the hero count.
- The old tail (`updateLeftPanelCounts`, `updateAllCounts`, two scrollbar updates) sat after the branch and before nothing but the 30 ms highlight timer being scheduled. It moved into the subscriber; the recorded sequences confirm the same order.
- The "viewSongs:changed" emit runs even when no view branch matched, so the tail still runs for Search and similar views, as before.
- `updateLeftPanelCounts()` still writes the text of the count elements itself (that DOM code was already in B's file); only the virtual-list refresh went through an event.

## Not converted

3 calls left in `refreshCurrentViewAfterMutation()`'s 30 ms timer: `updateSelectionHighlight()` and `updateActiveHighlight()` x2. They belong to the highlight functions that EB-B5 decides on for `13-song-highlight.js`. Converting them separately would split one subsystem across two designs. They stay direct until D rules on EB-B5, then follow the same decision.

## Tests I ran

- `events-b` (45 scenarios): passes after conversion.
- Sabotage check, done 5 times, one per new handler area: removing the Favorites redraw and hero count from `viewSongs:changed`, `renderArtistLeftPanelItems` + `refreshCurrentView` from `songs:changed`, `renderLeftPanelVisibleItems` from `leftPanelCounts:changed`, the scrollbar line from `favorites:changed`, and `reapplySelectionState` from `viewSongs:changed`. Every one made `events-b` fail. Restored, byte-identical, passes again.
- `events-b`, `manifest`, `events-wiring`, `search-ui`, `view-switch-song-list-cleanup`: 34 tests, 34 pass.
- `scroll`: 15 pass, 1 skipped. The skip is built into the test ("timing-sensitive in this sandboxed environment") and is not caused by this patch.
- `node tools/event-audit.js B`: 54 -> 30 (17: 27 -> 3).
- Not run: the other browser suites.

Not covered by a recorded sequence: `virtualScrollState.currentSongs = getActiveSongs()` in the All Songs branch of `viewSongs:changed`. It is a plain assignment, not a call, so the call-order harness cannot see it. It is unchanged code moved as-is; please check the All Songs view in the app (checklist item 3).

## Findings

- The four B sync functions had no logic of their own except selection pruning. The rest was a fixed sequence of D calls, which is why moving whole bodies kept the order exactly.
- `songs:changed` and the A event `library:rebuilt` are separate on purpose: `onSongsChanged()` is called after editing metadata, deleting a song and a keyboard delete, none of which rebuild the library.
- `favorites:changed` is emitted by `syncAllUIState()`, but nothing else emits a favorites event today (`saveFavorite`/`removeFavorite` live in A's files). If A later emits one from the setters, `syncAllUIState()` can be dropped from its 4 callers; I left that for Plan 2.
- No allowlist changes were needed.

## Not done / next

- **EB-B5**: written decision on `13-song-highlight.js` (27 calls, mostly `updateActiveHighlight`) is the last open item for B. It needs D's approval before any code changes, per the plan.
- The archive step from AGENTS.md (E:\ paths) was not possible in my environment; please archive before applying.

## Manual test checklist

1. Like a song from the song row, then unlike it, in All Songs, in Liked Songs, in a playlist and in an album. Counts in the left panel and hero stay right, and the Liked Songs view drops the song when unliked.
2. Drag songs onto Liked Songs in the left panel. The Liked Songs count goes up and the notification shows.
3. In All Songs view, delete a song (or edit its metadata). The list, hero count and left-panel count update, the selection is cleared of the deleted song, and scrolling a long list still works.
4. In the History view, delete an entry, then check the count. Repeat in a playlist, an album and an artist view.
5. Edit a song's title or album in the metadata editor. Playlists, albums and artists lists in the left panel refresh, and the current view redraws.
6. With many songs (virtual left panel on), add or remove a favorite. The left-panel list stays in place and the counts update.
7. Select several songs, then remove one from the playlist you are in. The selection highlight disappears for removed rows and the active-song highlight is still correct after about a second.

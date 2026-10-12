# Agent B report 0002: EB-B3

Patch: `B-0002-queue-song-start-context-events.patch`. Applies on top of `B-0001`.

## Done

- **EB-B3** `10c-playback-queue.js`, `10d-playback-song.js`, `16-context-menu-actions.js`. 10 reaction references handled: 6 converted, 4 allowlisted. Audit for B: 64 -> 54.
- Subscriber code added to the existing `src/js/04p-playback-events.js` (no new file, no new manifest line).
- 10 scenarios added to `helpers/scenarios-b.js`, recorded on the unconverted code first. The 16 scenarios from B-0001 were re-run during that baseline step and still matched. After conversion all 26 sequences reproduce exactly: no call added, removed or reordered.

## Converted

| Where | Event | Note |
|---|---|---|
| `10c` `removeFromQueue()` list redraw (3 refs: `renderRecentlyPlayed`, `renderSongsList` x2) | `queue:songsChanged` (new, no payload) | Emitted right after `updateQueueDisplay()`, same place as the old chain. The view checks moved into the subscriber unchanged. The Favorites view (and other views) redraw nothing, as before. |
| `10d` `playSongFromQueue()` `updateSubheroPlayButton(isCurrentViewPlaying())` | `playback:stateChanged { playing }` (reused) | `isCurrentViewPlaying()` is evaluated at the emit site, at the same point as before. |
| `10d` `playCurrentViewFromStart()` smart-shuffle refusal `updateSubheroShuffleButton()` | `shuffle:changed { isShuffled }` (reused) | Emitted after `isShuffled = false`, so the payload is the new value. |
| `16` `deleteHistoryEntry()` `renderPortableRecentlyPlayed()` | `playback:recentPanelChanged` (reused) | The "panel is open" check lives in the subscriber. |

## Allowlisted (needs D's review, EB-D2)

`renderRightPanelItem` -> `queries`. It is the 4 calls inside `updateQueueDisplay()` in 10c: it returns an HTML string that `updateQueueDisplay` puts into `#queue-list`, which is itself B's code. Nothing is redrawn by the call. **Side effect for C:** one C file also references it, so C's audit count drops by 1 (42 -> 41). D should confirm the call is a query in that file too.

## Tests I ran

- `events-b` (26 scenarios): passes after conversion.
- Sabotage check, done twice: removing the All Songs redraw from the `queue:songsChanged` handler, and emptying the `playback:stateChanged` handler (covers the 10d call). Both made `events-b` fail. Restored, byte-identical, passes again.
- `events-b`, `manifest`, `events-wiring`, `shuffle`, `recents`: 39 tests, 39 pass.
- `node tools/event-audit.js B`: 64 -> 54. Remaining: `13` (27, EB-B5 decision) and `17` (27, EB-B4).
- Not run: `scroll`, `search-ui`, `view-switch-song-list-cleanup` and the other browser suites; this patch does not touch what they cover.

Headless limits: `audioElement.play` is stubbed in the scenarios that start a song (`removeFromQueue` of the playing song, `playSongFromQueue`). The smart-shuffle refusal scenario needs no stub because the test app has 20 songs (limit is 50).

## Findings

- `removeFromQueue()` replaces the queue with `splice`, not through a setter, so `queue:changed` is not emitted. That is why a separate event was needed. When A-07/Plan 2 moves queue writes to setters, `queue:songsChanged` may be merged into `queue:changed`.
- `playSongFromQueue()` (10d) still has other direct UI calls that the audit does not count (they are in B's own files or on the allowlist). Not touched.
- No duplicate refreshes found in these three files.

## Not done / next

- EB-B4 (`17-song-selection.js`, 27 calls) is next, then the written EB-B5 decision on `13-song-highlight.js`.
- The archive step from AGENTS.md (E:\ paths) was not possible in my environment; please archive before applying.

## Manual test checklist

1. Play a song from All Songs, open the Queue tab, remove an upcoming song with its context menu. The queue updates and the All Songs list stays correct (playing marker intact).
2. Repeat step 1 from the Recent view and from a search result list. Each list redraws; in a playlist or Favorites view nothing visibly changes.
3. Remove the currently playing song from the queue. The next song starts, the subhero play button shows Pause, and the list redraws.
4. Start a song from any list. The subhero button switches to Pause.
5. In a list with 50 songs or fewer, choose Smart Shuffle from the shuffle dialog on Play. The warning appears and the subhero shuffle button is not highlighted.
6. Open the History view with the right-panel Recent tab open. Delete an entry from its context menu. The History view refreshes and the Recent tab updates; with the tab closed only the notification shows.

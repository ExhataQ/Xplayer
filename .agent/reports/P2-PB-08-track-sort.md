# Report: PB-08 Sort from the track list header

**Task:** PB-08 | **Agent:** B | **Date:** 2026-10-22 | **Status:** Done (owner chose DP13 option A)

## Summary
Clicking Title, Album or Time in the track list header sorts the list: ascending, then descending, then back to the list's own order.
A small arrow shows the sorted column. The sorting is done by the engine, inside the two functions that every list goes through, so the
rows on screen, the song a click reports, shift-select, the ghost lists and the play queue all read the same order.

## What the engine needed (Findings)
- The engine had no song sort at all. The board note about a "view-model sort seam (D22)" was wrong.
- Rows are identified by position, not by song, so sorting only what is drawn would make a click play a different song than the one shown.
- Two functions decide the order: `getSongsForList` (read by playback, shuffle, selection, the queue; 30 callers) and `renderSongsList`
  (draws rows; 21 callers, several pass raw arrays such as `SONGS_DATA` or a playlist's own songs). The sort is applied in both.
- For lists other than All Songs the engine stores the playing row's position in `activeSlotHighlights`. After a re-sort that value pointed at the old
  slot. `changeSongListSort` calls the existing `reapplyHighlightAfterFilter` so it follows the song (reproduced with a probe: stored `Playlist...-00001`
  stayed while the song moved; now it is the row position).
- Sorting 20,000 songs takes about 60 ms and `getSongsForList` is called on every click, so `applyListSort` remembers its last result and reuses it
  only while the songs, their order and the sorted field are unchanged (checked in one pass, no sorting). An edit made in place is noticed.
- History draws its own rows by position and removes entries by position; Recent and search results are not stable lists. They cannot be sorted
  (`isSongListSortable`), and the header buttons are disabled there.
- Nothing edits a playlist by a row position (removal uses the song id, drag and drop only adds), so a sorted playlist cannot be edited wrongly.

## Changed files
| File | Change |
|---|---|
| `src/js/library/03n-song-sort.js` | New engine module: `sortSongs`, `parseDuration`, per-list state, `isSongListSortable`, `applyListSort` (with cache). Published as globals |
| `src/js/main.js` | Imports the new module |
| `src/js/ui/07-views.js` | `getSongsForList` applies the sort; new `changeSongListSort` (store, redraw, re-mark the playing row) |
| `src/js/ui/04a-ui-render-core.js` | `renderSongsList` applies the sort to the array it is given |
| `src/ui-next/adapter/songsort-bridge.js` | New, 3 small functions (read, ask). Separate from `songlist-bridge.js`, which has a 40 line cap |
| `src/ui-next/views/library/song-list.js` | The three header labels are buttons; shows the state; cycles on click |
| `src/ui-next/views/library/song-list.css` | Button and arrow styles (tokens only) |
| `src/ui-next/views/library/song-sort.js` | Now only `nextSort` and `SORT_KEYS` (the sorting moved to the engine) |
| `tools/tests/engine-song-sort.test.js` | New: 13 tests (sorting, state, sortable lists, the draw and read paths agree, cache reuse and invalidation) |
| `tools/tests/song-sort.test.js` | Now tests the header click cycle (4 tests) |
| `tools/tests/ui-next-songlist.test.js` | 3 new browser tests (x2 library sizes) and a size cap for `songsort-bridge.js` |
| `.agent/BOARD.md` | PB-08 Done; DP13 decided; blocker note removed |

## Decisions
DP13 decided by the owner: option A. Also chosen by me, to confirm: the sort is kept in memory for the session only (not saved to disk);
a third click clears the sort; a sort changed while a song plays does not rebuild the running queue.

## Checks
| Command | Result |
|---|---|
| `node --test tools/tests/engine-song-sort.test.js` | 13 pass |
| `node --test tools/tests/song-sort.test.js` | 4 pass |
| `node --test tools/tests/ui-next-songlist.test.js` | 34 pass (28 before, plus 6 new) |
| Sort removed from `renderSongsList` | 2 fail (caught by the sort, leave, return test) |
| Sort removed from `getSongsForList` | 2 fail (caught by the rows, engine list and queue test) |
| Re-marking the playing row removed | 2 fail (caught by the stored highlight check) |
| Cache ignores in-place edits | 1 fail (caught) |
| Whole suite, 99 files plus the new ones | 11 files fail, the same 11 that fail on the original zip (sandbox: missing `acorn` and ESLint, 2 timing and layout tests) |
| `ui-next-library` | flaky: its "typing in Find" test fails in 2 of 8 runs on the tree before and after this change |
| Screenshots in the real new screen | arrow up and down on Title, brighter active column |

## Not run
Real Electron on Windows; a real library for the duration format; ESLint; the tests that need `acorn` (they also fail on the original zip, so they could
not catch a problem in the engine module layout: `window-contract`, `render-modules`, `ui-views-module`, `ui-handlers`).

## Manual checklist
1. Open All Songs. Click Title: A to Z with an up arrow. Click again: Z to A. Click a third time: back to the original order.
2. Click Time: check that 9:30 sorts before 10:00 and that songs with no length are last.
3. Sort descending, then double-click the third row: that song plays and Next goes to the song below it in the sorted list.
4. Play a song in a playlist, then click Title: the song stays marked in its new place.
5. Open History: the three headers are not clickable.
6. Open another playlist: it is not sorted. Come back to the first: it is still sorted.

## Open issues
Whether to save the sort across restarts. Whether Artist should be sortable too (it is not in the PB-08 scope).

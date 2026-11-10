# Report: PB-17 to PB-22 Song page, auto-load, Search filters, Recents, panel rows, rail marks

**Task:** PB-17, PB-18, PB-19, PB-20, PB-21, PB-22 | **Agent:** B | **Date:** 2026-10-24 | **Status:** In review

## Summary
- **PB-17:** one rule, `openSong(songId)` (`adapter/song-open.js`), used by Home song cards, Search and Recents. A song in an album opens that album, scrolls to the song and plays it (the queue is the album). A song in no album opens a new song page (`views/library/song-page.js`: header with cover, title, artist link, and a one-row list) and plays it. The song page works with the shell's back and forward.
- **PB-18:** `components/auto-load.js`. `autoLoad({ scroller, pageSize, loadPage, renderItem })` adds the next page when the end marker comes within one screen; `createPager` holds the paging rules without a DOM. Search uses it.
- **PB-19:** the Search panel has filter chips (Everything, Songs, Artists, Albums, Playlists). Everything shows 5 of each kind with "Show all n"; one kind pages through all matches. Artists and albums are results now (they open their pages). The chosen filter is kept while the app runs.
- **PB-20:** Recents shows the last 5 played playlists with "Load more (n left)", covers on every song row, covers on the songs under an expanded playlist.
- **PB-21:** Search and Recents rows use the Library's row size (72 px, 48 in compact), 44 px cover, gap and text. One row builder (`views/library/panel-rows.js`: `songRow`, `itemRow`) draws every kind. A missing cover shows `assets/default-cover.svg`.
- **PB-22:** `markRail()` in `shell/shell.js`. The open panel's item is always marked; the main view's item is marked too, except Library when the main view is only the library list under another panel (a playlist opened from Search), so one item shows instead of two.

## Findings
- Why two items were marked: PB-02 gave the open panel's item its own bar next to the main view's mark (DP2). With Search open and a playlist in the main view, Library showed a bar too. Reproduced, then fixed by the rule above. Home plus a panel still shows two marks, because both are really showing.
- The engine's album id comes from the album name only, so two artists with an album of the same name are one album.
- Opening a song in an album uses the engine's `switchToViewAndScroll` (opens the album and scrolls with the row highlighted) and `playSongFromList(songId, albumId)`; no engine change.
- Back and forward to a song page needed the song id in the history entry (`nav-history.js` compares it, `shell.js` stores it in `data-song`). The first try restored the wrong page; fixed and checked with the mouse back and forward buttons.
- The old main Search page and the history list have no entry point while PB-03 is paused (three tests skipped).

## Changed files
| File | Change |
|---|---|
| `components/auto-load.js` (new, 105 lines), `components/index.js` | auto-load component |
| `adapter/song-open.js` (new, 39 lines) | `openSong`, `albumOfSong`, `registerSongOpeners` |
| `adapter/panel-lists-bridge.js` (81 lines now) | `searchLibrary` returns songs, artists, albums, playlists; songs and played songs carry covers |
| `views/library/panel-rows.js`, `song-page.js`, `song-page.css` (new) | shared rows; the song page |
| `views/library/search-panel.js`, `recents-panel.js`, `panel-lists.css` | filters, auto-load, 5 plus Load more, Library-like rows |
| `shell/shell.js` | `song` view (no rail item), `markRail`, `openSong` in the panel context and for Home cards, song id in history |
| `shell/nav-history.js` | entries also compare the song id |
| `index.html` | link to `song-page.css` |
| Tests, new | `auto-load.test.js`, `song-open.test.js`; browser tests added to `ui-next-panel-lists.test.js` for PB-17, 19, 20, 21, 22 |
| Tests, changed | `panel-lists-bridge.test.js` (searchLibrary), `ui-next-home-shell.test.js` (a song card opens the album), `ui-next-panel-lists.test.js` (Library is not marked under Search) |
Earlier in this session (already reported): covers back to 44/32, expand buttons removed (PB-03 paused).

## Decisions made or needed
- DP9: the adapter files now total 81 + 39 lines (new `song-open.js`, grown bridge) and `auto-load.js` is a component. Please confirm the budget.
- Needed from A: review `shell.js` (`markRail`, the `song` view, history) and `nav-history.js` (one comparison).
- Needed from C: adopt `autoLoad` and `songRow` in the queue panel (request, B did not edit it).
- Chip counts and "played from" exact history are not done.

## Checks
| Command or step | Result |
|---|---|
| `node --test` on panel-lists-bridge, auto-load, song-open, library-create, ai-bridge, ai-apply-plan, ui-next-nav-history | 38 tests, 38 pass |
| `node --check` on the six edited browser tests | parse |
| Built app copy in headless Chromium, driven with Python Playwright, the steps of the new browser tests | chips shown; Everything shows "Show all 60 songs"; Songs filter loads 40 then 60 on scroll; filter kept after closing and reopening; Artists filter lists artists and opens the artist page with the panel kept; a song in an album opens "Album 2", plays "Song title number 3"; a song with no album opens its page with one row; Recents shows 5 playlists then Load more adds the rest; song rows have covers; panel rows are 72 px with 44 px covers like the Library; rail marks in the four situations; Home song cards open the song page or the album; mouse back and forward walk Settings, song page 6, song page 7; no page errors |
| Library create and sizes (340, 72, 44, 560, 340) | as before |

## Not run
- The Node browser tests (`ui-next-*.test.js`, including the new cases): Node `playwright` is not installed here. Run `node --test tools/tests/ui-next-*.test.js` on your machine.
- Real Electron, Windows, and a large library (search runs on every key press over the whole library; check typing speed with thousands of songs).
- The default cover file path (`../assets/default-cover.svg`) in the packaged app; the test copy has no `assets` folder.

## Environment
Linux sandbox, Node 22.22.2, Chromium via Python Playwright 1.56. No Electron, no `node_modules`.

## Manual checklist for the owner
1. Search for a song title and click the song: its album should open, the row should be in view, and it should play. Try a song with no album: a song page should open with one row.
2. On Home, click a song card: same rule. Use mouse back and forward: the pages come back in order.
3. In Search, use each chip. Artists and Albums open their pages. In Songs, scroll to the end: more songs load. Close and reopen the panel: the chip is still the same.
4. Open Recents: 5 playlists, a "Load more" button, covers on the song rows, and the arrow lists played songs with covers and times.
5. Compare a Library row with a Search row: same height and cover size.
6. Click Search, then open a playlist from it: only Search should be marked in the rail. Click Home: Home and Search are marked. Click Library: only Library.

## Open issues and follow-ups
- C: queue list should use `autoLoad` and `songRow` (PB-18).
- PB-03 (buttons to show panel results in the main view) is paused; the main Search page and the history list have no entry point. Decide whether to remove them or bring the buttons back.
- Recents still counts a playlist as played when one of its songs was (the engine does not record the list).

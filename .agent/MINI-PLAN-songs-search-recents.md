# Mini plan: song pages, auto-load, search filters, Recents, panel styles, rail marks

Written 2026-10-24 for the owner. Status: **built 2026-10-24, in review** (see `reports/P1-PB-17-22-song-pages-search-recents.md`). Owner is Agent B unless a line says otherwise.
Done in the same session: the Library list cover is back to 44 px (36 px became 32 px in compact), row height 72/48 and the wider panel stay; the "show in main view" buttons in Search and Recents are removed for now (PB-03 paused; the code path `mountSearchView(host, start)` stays).

## Order
1. PB-22 rail marks (small, fixes something visible now)
2. PB-21 panel item styles
3. PB-17 song page and the "open a song" rule
4. PB-18 auto-load component (needs nothing, but is used by 5 and 6)
5. PB-19 search filters and artist/album/playlist results
6. PB-20 Recents: covers, last 5 playlists, load more
Then PB-03 comes back only if you still want it after the song page exists.

## PB-17 Song page, and what "open a song" does
Goal: clicking a song anywhere (Home, Search, Recents, rows in lists, queue later) opens a page in the main view, styled like the playlist, album and artist pages.
Rule (your description):
- The song is in an album: open that album's page, select that song in it, and play it.
- The song has no album: open a **song page** (header with cover, title, artist, a one-row list holding only this song) and play it.
How it is built:
- One function `openSong(songId)` in a new adapter file (`adapter/song-open.js`), used by every caller, so the rule lives in one place. It finds the album with `getAlbums().find(a => a.songs.includes(id))`, then `openAlbum(album.id)`, then selects and plays the row. Without an album it opens the song page.
- The song page is a new main view, `views/library/song-page.js`, using the same header and list parts as the detail pages. It needs the engine's detail view to accept a "song" type; today `openDetailView(id, 'album' | 'artist')` in `ui/07-views.js` has only those two. Either extend it (engine change, smallest) or build the page in `ui-next` from the song list component (no engine change, more code). **Recommendation: build it in ui-next**, so the engine stays untouched.
- Selecting and scrolling to the song inside the album page: the album list is virtual, so scroll by index first, then select.
Known limits to check first:
- The engine's album id comes from the album name only (`generateConsistentId('a', name)`), so two artists with an album of the same name are one album. The rule above follows that.
- Today, clicking a song in the Search panel plays it from all songs. After PB-17 it opens the album or the song page and plays there. Songs in the Recents list do the same.
Questions for you:
1. Should the song start playing at once when its page opens, or only be selected? (You said play; I will play.)
2. In the album page, should the queue become the album, or just that song? (Recommendation: the album, in album order, starting at that song.)

## PB-18 Auto-load (load more while you scroll)
One shared component `components/auto-load.js`: an invisible marker at the end of a list; when it comes into view it asks for the next page. `autoLoad({ container, pageSize, loadPage })`, where `loadPage(offset, count)` returns the next items (or an empty array when finished). It shows nothing while idle, a small "Loading" row while it waits, and nothing at the end.
Used by: the Search panel results (PB-19), Recents (PB-20), and the queue. **The queue is Agent C's** (`views/playback/queue-panel.js`): B builds the component and a short request for C to adopt it, B does not edit the queue.
Tests: unit test of the paging logic with a fake observer; browser test that scrolling to the end loads the next page and stops at the end.

## PB-19 Search filters and more result types
- A row of filter chips above the results: **Everything**, Songs, Artists, Albums, Playlists. "Everything" shows a short section for each kind. A single kind shows a full list that auto-loads (PB-18).
- Artists and albums become results too (today only songs and playlists). Clicking an artist opens the artist page, an album opens the album page, a playlist opens the playlist, a song uses PB-17. Artists and albums come from `getArtists()` and `getAlbums()`.
- Bridge: extend `adapter/panel-lists-bridge.js` (`searchPanel(query, { kind, offset, count })`). It will pass the line budget (DP9) at about 110 lines; I will ask for a new limit in the report.
- The chosen filter is remembered for the session.
Question: should a filter you choose stay when you close and reopen the panel? (Recommendation: yes, kept until the app closes.)

## PB-20 Recents
- Songs in the Recents list get covers (the row has the same cover and text layout as the Library rows).
- The playlists section shows the **last 5 played playlists**, then a "Load more" button that adds 5 each time. (A button, not auto-load, as you described; the component from PB-18 is not needed here.)
- The expanded songs of a playlist also show covers.
- Still true: the engine does not record which list a song was played from, so a playlist counts as played when one of its songs was played. If you want exact history, the engine must store the list with each play (separate, small engine change; ask me to add it).

## PB-21 Left panel item styles
Search and Recents rows are my own markup (`.plist-row`) and do not match the Library rows exactly. Plan: make them use the same size, spacing, font sizes, hover and selected looks as the Library rows, with the same cover token, and the same inset from the panel wall. I will compare screenshots of Library, Search and Recents side by side before and after.
Need from you: what looks wrong to you (spacing, text size, cover size, hover, selected state)? A line or a screenshot is enough; without it I will match Library exactly.

## PB-22 Two rail items marked at once
Cause (found, reproduced): since PB-02 the rail shows a bar for the main view's item and a second bar for the open panel's item (DP2, "Home with a panel open"). With the Search panel open and the Library list in the main view, both Library and Search show the bar, which looks like a bug.
Proposed rule, smallest change: the **Library item is marked only when the Library panel is the open panel**. A main view that happens to be the library list (because a playlist opened from Search) does not mark Library. Home, Lyrics, Metadata and Settings are marked as before when they are the main view, and the open panel's item is always marked. So Home plus Search shows two marks (Home in the main view, Search as the panel), and Search plus a playlist shows one mark (Search).
This asks you to re-decide DP2 for the case "panel item plus library list". Alternative: show only one mark, the last item you clicked. Tell me which; the first is my recommendation.
Where: `shell/shell.js` (`showView`'s marking loop and `syncRailSelection`) and `shell/rail.css`. These are Agent A's files; I will list it as a review request.

## Needs from you before building
1. PB-17 questions 1 and 2 (play at once; queue becomes the album).
2. PB-21: what looks wrong.
3. PB-22: which rule.
4. PB-19: keep the filter between openings.

## Owner answers (2026-10-24)
1. The song plays at once. 2. The queue is the song's album when it opens in an album (the engine's own behavior); "use song rendering in the queue list" means the queue list uses the same song rows as Search (C adopts `songRow`). 3. PB-21: the problem was the cover size. 4. PB-22: a section is marked only when it is active. 5. The filter is kept. 6. Start.

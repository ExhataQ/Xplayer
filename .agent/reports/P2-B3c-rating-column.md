# Report: B3 Rating system, slice 2b (the Rating column of the song list)

**Task:** B3 (POLISH-PLAN.md) | **Agent:** B | **Date:** 2026-11-05 | **Status:** In review. Not seen in the app: I have no browser, and the column is mostly layout.

## What works after this patch (only while Settings > Library > Rating system is on)
- **A Rating column** in the song lists, its own column with a header "Rating", between Album and the Time/buttons part. Five stars per row; the filled ones are the rating.
- **Mouse:** pointing at a star previews what a click would set; a click sets it; a click on the star that is already the rating clears it. A click on the stars does not select the row, and a double click on them does not play the song.
- **Columns menu:** a **Rating** entry (checked by default), shown only while the system is on. The choice is saved with the other column choices.
- **Off:** with the system off, or the column unchecked, the rows and the header are exactly as before (four columns, no cells).
- **Narrow windows** drop the column without changing the saved choice, as they drop Album (below 640px of list width).
- Changes made anywhere (the song menu, the right panel, another row of the same song) show in the list at once.

## How it is done, and why
The rows are the engine's, and are built in several places (the main list, the loading rows, the search and history lists). Instead of changing every template, `views/library/song-rating-column.js` adds the cell to each row as it appears (the same way the new interface dresses the rows elsewhere), with one lookup for each batch of rows (`ratingsForSongIds`, one read of the saved ratings, not one per row). The grid has five columns only while the column is on (`data-rating-column='on'` on the list), and the cell is never `display: none` (the grid counts its children), as the hidden Album works. The stars are drawn from one number by the style (a star-shaped mask over a colour that changes at the rating), so a row costs one small element, not five buttons; only the colour moves, never the size (the B8 guard passes).

## Not done, and why
- **Keyboard in the list:** the cell is for the mouse. The keyboard has the song menu (Rate) and the stars in the right panel. Making each row's stars focusable would add a tab stop to every row; say if you want it.
- **Sorting by Rating:** the header cell is a plain label. The engine's sort (PB-08) would need a new key; easy to add after this is seen.
- **Song details** and **the Home playlists Top rated / Not rated** are still open in this task.

## Changed files
| File | Change |
|---|---|
| `src/ui-next/views/library/song-rating-column.js` | New: the cells, the mouse, the live updates. |
| `src/ui-next/views/library/song-list.js`, `song-list.css` | Rating in the column settings, the header cell, the columns menu entry, the grid and the stars style. |
| `src/ui-next/adapter/ratings-bridge.js`, `src/js/library/03h-ratings.js` | `ratingsForSongs` and the bulk `ratingsForSongIds`. Plan budget 618 of 700. |
| `tools/tests/rating-column.test.js` | New: 5 unit tests (the star under a click, the bulk lookup with one read, the grid rules, the settings and menu, the cell behaviour). |
| `.agent/archive/polish-2/TOOLTIP-TABLE.md`, `STATE-SIZE-LIST.md` | Made again. |

## Checks
| Step | Result |
|---|---|
| `node --test tools/tests/rating-column.test.js` | 5 pass |
| `node tools/tests/run.js unit`, compared with the zip you sent | same failures, none new |
| Size guard (`states-keep-size`) | passes |
| The app, the browser tests, lint | **not run** (no browser, no ESLint here) |

## Needs the owner
1. Turn the Rating system on and open a song list: a Rating column with a header; five stars per row.
2. Hover a row's stars and click: preview, set, clear. Select several rows by clicking elsewhere: the stars do not select or play.
3. Columns menu: a Rating entry hides and shows the column.
4. Scroll a long list quickly and open a search or history list: every row has its stars (the loading rows too); no row shows a gap where the cell should be.
5. Narrow the window: the column goes, the list keeps its layout.
6. The look: star size and colour, the faint empty stars on unrated rows.

If the grid looks wrong anywhere (a column pushed), send me a screenshot and the list it was on: that is the part I could only read.

## Patch
`P2-B3c-rating-column.patch`, made against `Source-backup (17)`.

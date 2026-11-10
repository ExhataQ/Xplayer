# Report: B3 Rating system, slice 2c (half stars, the Rating column's handle and placeholder, no right-panel stars, list layout) and Previous / Next

**Task:** B3 and the list work (POLISH-PLAN.md) | **Agent:** B | **Date:** 2026-11-05 | **Status:** In review. Not seen in the app (no browser here): the list layout is the part to look at.

## Done
1. **Tooltips:** Previous and Next say "Previous" and "Next" (the word "song" is gone from the tooltip; the button's spoken label is unchanged). The tooltip test follows.
2. **Rating removed from the right panel, completely:** the stars row, its module and style, the stars control and the engine lookup it used are deleted. (`ratingSystemOn`, the menu and the list column are untouched.) It can come back with the song details.
3. **Half stars:** a rating is 0.5 to 5 in half steps. The song menu lists ten ratings (5 stars down to 0.5 stars); the list stars fill by half a star (a click on the left half of a star sets the half, a click on the star that is the rating clears it); a half star in the file tag is read ("0.7" is 3.5 stars); the shuffle weights have half steps between the whole ones (0.5 stars 0.25, 3.5 stars 1.3, 4.5 stars 2 ...). Older whole-star ratings are unchanged. The Settings text says so.
4. **The Rating column in the list:** a **handle on its left edge** (like the Title and Album one) to make it wider, 88 to 240px, saved; drag, double click or Enter to reset, arrows (Shift for bigger steps), Home and End; "Reset column widths" resets both handles. It is a class of its own, so the tests that look for the Title and Album handle still find only that one.
5. **Placeholder:** a row that is still loading shows a bar in the Rating cell, like its other cells.
6. **List layout, the stray star:** every cell now has its own place in the grid: the right cell (time, buttons) is always the last column, the Rating cell is the fourth only while the column is on, and a Rating cell while the column is off is not drawn at all. So a row that arrives with a left-over star (or without one) can no longer push the others. A cell is also added only while the grid has its fifth column. **I could not find where the left-over star came from** (the engine builds each row as new HTML; nothing I found caches one with a cell); this makes the layout safe whatever the cause, and if it still happens, tell me what you did in order (hide it how: the columns menu or the Settings switch; then play from where).
7. **Rows in step with the header:** both use the same template and the same column positions now, as stated in 6. The deeper fix, one template for the header and every row, built once (so there is nothing left to be out of step), is step 1 of the new plan.
8. **The plan you asked for:** `.agent/LIST-COLUMNS-PLAN.md` (what the list is today, what goes wrong, the target, seven steps, six questions for you).
9. **Remembered:** `.agent/PARKED.md` lists what is waiting, including the measuring tools you told me to leave for now.

## Not done / needs the owner
- The questions at the end of the plan (especially: by "more rows", do you mean more rows visible at once, or more columns?).
- The left-over star: see 6.

## Changed files
| File | Change |
|---|---|
| `src/js/library/rating-rules.js`, `03h-ratings.js`, `ui/06a-context-menus.js`, `ui/16-context-menu-actions.js` | Half stars: rules, weights, tag reading, labels, ten menu rows, messages. `ratingOfId` removed. |
| `src/ui-next/views/library/song-rating-column.js`, `song-list.js`, `song-list.css` | Half star clicks, the handle, the placeholder, cells by name and a cell only while the column is on. |
| `src/ui-next/views/library/rating-settings.js` | Text. |
| `src/ui-next/views/playback/now-playing-rating.js` (deleted), `right-panel-content.js`, `player-bar.css`, `components/stars.js` (deleted), `components.css`, `components/index.js`, `adapter/ratings-bridge.js` | The right panel stars removed. |
| `src/ui-next/views/playback/transport.js`, `tools/tests/ui-next-playback.test.js` | Previous and Next. |
| `tools/tests/*` | Rules, store, menu and column tests for half stars, the handle, the placeholder and the cell places (11 + 8 + 9 + 7 tests of the rating files). |
| `.agent/LIST-COLUMNS-PLAN.md`, `PARKED.md`, `TOOLTIP-TABLE.md`, `STATE-SIZE-LIST.md` | New and regenerated. |

## Checks
| Step | Result |
|---|---|
| The four rating test files | pass (36) |
| `node tools/tests/run.js unit`, compared with the zip you sent | same failures, none new |
| The app, the browser tests, lint | **not run** (no browser, no ESLint here) |

## One mistake I made and caught
While removing the right panel style I cut `player-bar.css` and `components.css` from my block to the end of the file, which also took out the visualizer rules another agent had added after it. The unit suite showed it at once (a visualizer test failed); both files are restored and now differ from yours only by my removed blocks.

## Needs the owner (to look at)
1. Hide the Rating column in the columns menu, then play a song and scroll: no row with a star, no shifted time or buttons.
2. Show it again: stars in every row, including loading rows (a bar, then the stars).
3. Drag the left edge of the Rating column: it widens and the header and every row stay in line; double click resets.
4. Hover a row's stars and click on the left and right half of a star.
5. Right-click a song > Rate: ten rows, 5 stars down to 0.5 stars.

## Patch
`P2-B3d-rating-halves-resizer.patch`, on top of `P2-B3c-rating-column.patch` (made against `Source-backup (17)` with it applied).

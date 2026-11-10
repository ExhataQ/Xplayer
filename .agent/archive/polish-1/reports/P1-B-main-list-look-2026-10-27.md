# Report: main list look: bigger covers, air above and below the rows, uniform selection

**Task:** owner request, follows B-03 and PB-01 | **Agent:** B | **Date:** 2026-10-27 | **Status:** In review

## Summary
Three changes to the song list on the new screen.
1. **Bigger covers.** The comfortable row stays 56 px and the cover is 40 px (was 32), the old screen's size. The cover sits 8 px from the row's top and bottom (was 12) and has the 6 px control radius (`--radius-md`). Compact density is unchanged (36 px, no covers).
2. **Air above the first row and below the last row**: 12 px (`--space-3`) in the list, as the old screen had 15 px (`css/song-list.css`). Rows in normal flow get it from the list's padding. In a virtual list the engine sets the list height to rows x row height, so the list is `content-box` and the absolutely placed rows start at `top: var(--sl-list-pad)` (the old screen did the same with `top: 15px`).
3. **Uniform selection.** Selected rows read as one block again: square inner edges, rounded outer ends. See Findings.

## Findings
- **Regression of mine, now fixed.** The PB-01 fix of the same day also put `border-radius: var(--radius-sm) !important` on the selection layer. The engine rounds only the ends of a run of selected rows (inline `border-radius`, `ui/04a updateSelectionHighlight`), so that rule gave every selected row its own rounded corners and cut notches into a multi-row selection. Measured on a Shift-selected run of three rows: old screen 4/4/0/0, 0, 0/0/4/4; the new screen had 4 px on every row. The rule is removed.
- **The engine's `--radius-xs` did not exist on the new screen**, so its inline radii resolved to 0 and even a single selected row was square. `--radius-xs: 4px` is now a token (`tokens.css`), the old value. Computed radii on the new screen now equal the old screen's: top 4px 4px 0 0, middle 0, bottom 0 0 4px 4px, single row 4px.
- The engine reads the row height once from `--song-item-height` (`:root`, set from `--row-height`) and has its own default of 56; the token stays 56, so `window.ITEM_HEIGHT` is 56 and density changes still call `setSongItemHeight`.
- Hover, selection and playing highlights stay on their rows with the new height and padding (`ui-next-list-highlights.test.js`).

## Changed files
| File | Change |
|---|---|
| `src/ui-next/tokens.css` | `--row-height` stays 56 px (comment: cover 40 px); new `--radius-xs: 4px` |
| `src/ui-next/adapter/songlist-rows.css` | cover size and radius; list padding (`--sl-list-pad`) with `content-box` and `top` for the virtual list; the selection layer's radius rule removed (comment says why) |
| `tools/tests/ui-next-songlist.test.js` | none in the end (the row height is unchanged) |
| `tools/tests/ui-next-list-highlights.test.js` | the static check no longer wants a radius on the selection layer and now forbids one; two new tests per list size: row 56, cover 40 and air at both ends, and the radii of a multi-selection |

## Checks
Chromium through Playwright, Node v22.22.2, Linux sandbox.
| Command or step | Result |
|---|---|
| `ui-next-list-highlights.test.js` | 9 of 9 pass (30 songs and 400 songs: hover, row 56 / cover 40 / 8 px / 12 px air at both ends, multi-selection radii, selection follows scroll) |
| `ui-next-songlist.test.js` | 24 of 34, and the same ten tests fail as on the untouched backup |
| `ui-next-panel-lists.test.js`, `ui-next-listbar.test.js` | 8 of 8 and 2 of 7, as on the untouched backup |
| Measured by hand on 30 and 400 songs | row 56, cover 40 (8 px above and below), 12 px above the first row, 12 px below the last (scrolled to the end, also virtual), `ITEM_HEIGHT` 56, list height rows x 56 + 24 |
| Screenshots | multi-row selection is one block; top of the list shows the space under the header |

## Not run
Real Electron and Windows. Other lists that use the engine's rows (playlists, albums, folders, History) get the same row, cover and padding because they share the song list's styles; only Library, with 30 and 400 songs, was measured.

## Manual checklist for the owner
1. Library: covers are larger than before (40 px); row text still centred beside them.
2. First row: a little space under the column header. Scroll to the end: the same space under the last row.
3. Click a row, Shift-click three rows down, then Ctrl-click another row. Expected: one block for the run (square where rows touch), a separate rounded block for the single row.
4. Compact density (columns menu): unchanged, 36 px rows without covers.
5. A library of more than 200 songs (virtual scroll): fast scrolling, and the hover highlight on the right row.

## Open issues and follow-ups
- Jumping to a song (Locate) positions by row index; the 12 px offset is within the engine's overscan, as it was with the old 15 px.

## Revision
The first version used a 64 px row and a 48 px cover; the owner found that too big, so it is now 56 px and 40 px.

## Superseded (2026-10-28)
The selection corners described above (rounded outer ends, 4 px) were changed on request: the selection is one square block with no rounded corner anywhere. See `P1-B-selection-modifier-more-button.md`.

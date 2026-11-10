# Report: selection block, more button, no navigation while selecting

**Task:** owner request, follows PB-01 and the main list look | **Agent:** B | **Date:** 2026-10-28 | **Status:** In review

## Summary
Three fixes on the song list of the new screen.
1. **The more button (the three dots) touched the edge of the hover and selection highlight.** The row's right cell now keeps 8 px (`--sl-more-inset`, `--space-2`) from the highlight's right edge, so the glyph is 13 px from it (it was 5). The header's columns button takes the same inset, so it stays above the more buttons.
2. **Shift, Ctrl or Cmd on an artist or album name selects the row; it no longer opens the artist or album.** While a modifier is held the names also stop looking like links (no underline, no pointer cursor). A plain click still opens them. A double click on a name with a modifier does not play the song.
3. **Uniform selection: no rounded corner at all**, on the first and the last selected row and on a single selected row. The block is square.

## Findings
- The highlight is drawn from the row's left to its right edge (the 25 px side padding of the row) and the more button, 28 px wide, ended exactly on that edge. Measured: highlight right 1275, more button right 1275, glyph right 1270.
- The artist and album names carry their own action with `data-stop`, which stops the click before the row's `selectSongItem` can run (`core/legacy.js dispatch` walks the path from the name up and honours `data-stop`). So a Shift or Ctrl click on a name never reached the selection code. The fix stops that click in the capture phase (`views/library/select-modifier.js`) and sends the same click again on the row, with the same modifiers, so the engine's own selection code does the work (range with Shift, toggle with Ctrl or Cmd). Nothing in the engine or the dispatcher changed, and no adapter line was added.
- Selection corners: the engine rounds a run's outer ends with `var(--radius-xs)` (inline, `ui/04a updateSelectionHighlight`). That token is now 0 on the selection layer only (`songlist-rows.css`); hover and playing keep their corners. This supersedes the 4 px outer ends described in `P1-B-main-list-look-2026-10-27.md`.

## Changed files
| File | Change |
|---|---|
| `src/ui-next/views/library/select-modifier.js` | New: tracks the modifier (`<html data-select="on">`), redirects a modifier click or double click on a name to its row |
| `src/ui-next/views/library/song-list.js` | Starts and stops it with the song list, next to the input mode tracker |
| `src/ui-next/views/library/song-list.css` | `--sl-more-inset`; the header tail takes the same inset |
| `src/ui-next/adapter/songlist-rows.css` | The right cell's inset; names look inert while a modifier is held; `--radius-xs: 0` on the selection layer |
| `tools/tests/ui-next-list-select.test.js` | New, 5 tests (one static, four in the browser) |
| `tools/tests/ui-next-list-highlights.test.js` | The multi-selection test now expects square rows |

## Decisions made or needed
- **The more button moves away from the edge (to the left).** The request said "move it to right a bit"; the icon was touching the right edge, so moving it right would not help and I read it as "move it in from the edge". If you wanted something else, the value is `--sl-more-inset` in `views/library/song-list.css` (8 px now; 0 puts it back).
- **Cmd counts like Ctrl** (macOS), as in the engine.

## Checks
Chromium through Playwright, Node v22.22.2, Linux sandbox.
| Command or step | Result |
|---|---|
| `ui-next-list-select.test.js` | 5 of 5 pass; 0 of 5 on the tree without this change |
| `ui-next-list-highlights.test.js` | 9 of 9 pass |
| `ui-next-songlist.test.js` | 34 of 34 pass, the same as on the tree without this change |

## Not run
Real Electron and Windows; a real drag from a name with a modifier held (the drag handler ignores names, as before).

## Manual checklist for the owner
1. Hover a row and look at the three dots: clear space between the glyph and the highlight's edge. The columns button in the header is above them.
2. Click a title, then Shift-click an album name three rows down. Expected: the range is selected, the album page does not open.
3. Ctrl-click an artist name. Expected: that row is added to or taken out of the selection, nothing opens.
4. Hold Shift over a name. Expected: no underline, normal cursor. Release it: underline and pointer again.
5. Select three rows in a row. Expected: one square block, no rounded corner at the top or the bottom.
6. Click an album name with no key held. Expected: the album opens.

## Open issues and follow-ups
- Holding a modifier while the window is not focused: the state is cleared when the window loses focus and refreshed by the next key or pointer move.

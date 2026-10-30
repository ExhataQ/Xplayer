# Report: PB-01 List rendering (investigation and fix)

**Task:** PB-01 | **Agent:** B | **Date:** 2026-10-27 | **Status:** In review

## Summary
The board's four suspects were measured in a real browser (Chromium through Playwright) on the old and the new screen, with 30 songs (rows in normal flow) and 400 songs (virtual scroll). One was a real bug, and it is fixed: **the engine's hover, selection and playing highlights did not scroll with the list on the new screen.** After scrolling, the hover highlight was drawn `scrollTop` pixels below its row (a 520 px scroll: row at 368, highlight at 888); the old screen was exact. At scroll position 0 everything lined up, which is why it was easy to miss.

## Findings
| Suspect (board) | Result |
|---|---|
| (1) CSS removed the old list padding and the virtual rows' `top: 15px`; the engine positions highlights from row rectangles inside `.content` | **Real, but not the padding.** The engine appends its layers (`#active-hover-styles-set`, `#selection-styles-set`) to `.content` as `position: absolute` and places them from the row rectangle plus `scrollTop` (`ui/04a getItemPosition`). The old `.content` is `position: relative` (`css/song-list.css:18`); the new engine host was not, so the layers anchored to something that does not scroll. The list's own padding is 0 on purpose (rows start at the top of the scroller) and row and highlight tops matched at rest |
| (2) The custom scrollbar is hidden, so `dragging-scrollbar` never pauses hover | **Not reproduced.** With scrollbars switched on in the browser, a drag of the native thumb scrolled the list and the hover highlight was hidden for the whole drag (the pointer is over the scrollbar, outside the list rectangle the engine tests). `dragging-scrollbar` is never set, but nothing needs it |
| (3) Hover is recomputed after a scroll from the last mouse position | **Works** once (1) is fixed: after a wheel scroll and after a programmatic jump the highlight is on the row under the pointer, same top and 56 px high |
| (4) `.last-selected` and `:focus-visible` overlap hover | **No overlap seen.** A selected row, a hovered row and a keyboard-focused button in a row were drawn together and read apart: selection is a full fill, hover 60% of it (by design, `songlist-rows.css`). The focus ring only shows in keyboard mode (PB-12). (Corrected 2026-10-27: the first version of this fix also gave the selection layer a rounded corner on every row; that cut notches into a multi-row selection and was taken back, see `P1-B-main-list-look-2026-10-27.md`.) |
| Placeholders | **Same as the old screen.** After a 15 000 px jump: 1 blank frame, rows (skeletons) from about 33 ms, all rows real at about 290 ms on both screens (frame-by-frame sample). Not a regression, so not changed. The comment in `songlist-rows.css` says "about 150 ms"; it is nearer 290 ms |

## Changed files
| File | Change |
|---|---|
| `src/ui-next/adapter/engine-view.css` | `.view-host[data-engine] .content { position: relative; }` with the reason |
| `src/ui-next/adapter/songlist-rows.css` | (a rounded-corner rule on the selection layer was added here and removed again, see the correction above) |
| `tools/tests/ui-next-list-highlights.test.js` | New, 5 tests: a static check of the rule and the radii of the hover and playing layers, then for 30 and 400 songs: hover on the row under the pointer at rest, after a wheel scroll and after a jump; the selection highlight on its row after scrolling |
| `.agent/BOARD.md` | PB-01 row |

## Checks
| Command or step | Result |
|---|---|
| `ui-next-list-highlights.test.js` | 5 of 5 pass. With the CSS rule removed: 0 of 5 (every browser check and the static check fail) |
| `ui-next-songlist.test.js` | 24 of 34, identical to the untouched backup (the failing tests are the same ones) |
| `ui-next-panel-lists.test.js` | 8 of 8, same as the untouched backup |
| `ui-next-listbar.test.js` | 2 of 7, same as the untouched backup |
| Hand check by screenshot | selected, hovered and focused rows after a scroll |

## Not run
- Real Electron and Windows; the engine's own scrollbar (hidden on the new screen) and a real mouse drag of the native thumb on Windows.
- The playing highlight was not asserted separately (it shares the layer and the rule); the song needs audio to play, which the test fixture does not have.

## Environment
Linux container, Node v22.22.2, Chromium through Playwright (global install; set `NODE_PATH` to its `node_modules` and `PLAYWRIGHT_BROWSERS_PATH` to the browsers folder). Headless Chromium hides scrollbars unless `--hide-scrollbars` is ignored; the drag probe did that.

## Manual checklist for the owner
1. Library with many songs. Hover a row, scroll with the wheel without moving the mouse. Expected: the highlight stays on the row under the pointer.
2. Click a row, then scroll a little. Expected: the selected fill moves with the row.
3. Start a song, scroll the list. Expected: the playing tint stays on its row.
4. Drag the scrollbar thumb. Expected: no hover highlight while dragging.

## Open issues and follow-ups
- The other failing tests in `ui-next-songlist.test.js` (10 of 34, among them the Title sort and "no errors" checks) fail on the untouched backup too and were not investigated here.
- The placeholder wait (about 290 ms) is the engine's lazy load delay; the old screen has the same one.

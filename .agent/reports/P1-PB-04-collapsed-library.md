# Report: PB-04 Collapse for Library only, and the collapsed state

**Task:** PB-04 (also PB-21 round 2) | **Agent:** B | **Date:** 2026-10-28 | **Status:** In review

## Summary
Collapse was already limited to the Library. I read every place the collapsed state is handled, listed what breaks, and fixed two cases. Nothing was run in a browser, and DP8(a) (what the owner sees broken) is still open, so there may be more.

## Findings
| Case | Result |
|---|---|
| Only the Library can collapse | Already true: `registerPanel('library', { collapsible: true })`; Search and Recents register without it, so `buildPanelToggle` hides the arrow and `shown()` returns `expanded`. Covered by a new test. *read* |
| Library collapsed, switch to Search or Recents, then back | Search and Recents open expanded; the saved choice is untouched and the Library is a strip again. Works as designed. *read* |
| Resize handle in the strip | Hidden while compact (`panel-resizer.js`). *read* |
| A folder opened in the strip | **Broken:** the folder bar (back arrow and name) was hidden, so there was no way out except expanding the panel. **Fixed:** the bar stays in the strip as the arrow alone, the name stays for screen readers. |
| Rows in the strip | **Weak:** only covers show and nothing says which item is which. **Fixed:** hovering a row sets a tooltip with its name; it is removed again when the panel opens. |
| The plus (new playlist, folder) in the strip | Hidden on purpose (PB-06). Right click on empty space still offers both. Left as is. |
| Narrow window (under 1000 px) | A collapsible panel (Library) collapses itself; Search and Recents stay expanded at the saved width. Left as is; say if they should shrink too. |

## Round 2 of PB-21 (owner: placeholders wrong, no side padding)
- Rows in Library, Search and Recents had the cover flush with the row's left edge, so a hovered row had no room on the left. All three now use `--panel-row-pad-x` (8 px). The collapsed strip keeps `padding: 0`.
- The engine's own css made Library covers square (`.left-panel-main-list .main-item-cover-wrapper`), while Search and Recents are rounded. Library now sets the radius with a stronger selector, skeleton rows included.
- The Library's artist placeholder was a circle on a square tile (its wrapper's background showed in the corners); a real artist picture and Search's artist cover are square. The placeholder is square now.
- I could not see which placeholders the owner meant; these are the mismatches found in the code.

## Changed files
`views/library/library-panel.css`, `views/library/library-panel.js`, `views/library/panel-lists.css`, `adapter/default-covers.css`, `adapter/default-cover.js` (comment), `tools/tests/ui-next-panel-layout.test.js` (new), `.agent/BOARD.md`.

## Checks
| Command | Result |
|---|---|
| `node --test` on `ui-next-panel-layout`, `default-cover`, `source-runtime-assets`, `ui-next-queue-drag-open` | 12 of 12 pass |
| `node --check` on `library-panel.js` | passes |

## Not run
Every browser test (no Chromium here), including `ui-next-library` and `ui-next-panel-lists`.

## Manual checklist for the owner
1. Open Library, Search and Recents. Expected: the same gap between the panel edge and the covers, a highlighted row has room left of its cover.
2. Look at Library rows with no art: playlist, folder, album, artist, All Songs, Liked. Expected: rounded tiles, the artist tile square.
3. Collapse the Library with the arrow, open a folder in the strip. Expected: a back arrow shows under the header; pressing it returns to the list.
4. Hover a cover in the strip. Expected: a tooltip with its name; after expanding the panel, no tooltip.
5. Switch to Search while collapsed. Expected: it opens expanded with no collapse arrow.
6. Tell me what else looks wrong in the strip (DP8a).

## Open issues and follow-ups
- DP8(a) is not answered; this is a read of the code, not a reproduction.
- Search and Recents have no sort row, so their controls are shorter than the Library's.

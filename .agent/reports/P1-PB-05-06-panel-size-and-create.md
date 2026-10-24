# Report: PB-05 Wider panel, bigger covers, scroll bar on the wall; PB-06 Create button

**Task:** PB-05, PB-06 | **Agent:** B | **Date:** 2026-10-24 | **Status:** In review

## Summary
PB-05: the Library panel is wider (default 340 px, limit 560 px), rows are taller with bigger covers (72 px rows and 56 px covers; compact 48 and 36), and the list and its scroll bar now reach the panel's right wall with a full-width bar. PB-06: a plus button in the Library header (before the collapse arrow) opens the engine's "Create New" dialog; right click on empty panel space offers New playlist and New folder; playlist and folder creation are now plain functions in `adapter/library-create.js` that the panel and the AI organizer both call (PE-05 can use them as they are).

## Findings
- Why the scroll bar was not on the wall (*reproduced*): `.panel-host__body--library { padding: 0 }` lost to the shell's `.panel-host__body { padding: 16px }` (same specificity, shell.css wins), so the whole list sat 16 px inside the panel. The measured gap from the list to the panel edge was 17 px; it is 1 px (the border) now.
- The 8 px panel resize handle (`appearance.css`) sits over the panel's right edge, which is where the bar is. It is 4 px now so the bar stays easy to grab (*read*).
- The header slot B asked for in the PB-06 request did not exist. I added it inside the existing slot API (`registerPanel(..., { headerAction })`) instead of waiting; this touches A's `shell/panels.js` and `shell/shell.js` (about 20 lines). A: please review.
- `ai-bridge.js` already had its own create code for `create_playlist` and `create_folder` (same reuse and "not into the open folder" rules). It now calls the shared functions; behavior and undo data are unchanged.

## Changed files
| File | Change |
|---|---|
| `adapter/library-create.js` (new, 40 lines, counts in the DP9 budget) | `createPlaylistNamed`, `createFolderNamed` (trim, reuse by name, empty name refused, never filed into the open folder), `showCreateDialog` |
| `adapter/ai-bridge.js` | `create_playlist` and `create_folder` call the shared functions |
| `shell/panels.js` | `headerAction: { icon, label, onClick }` in the panel spec and in what `showPanel` returns |
| `shell/shell.js` | actions group in the panel header (plus, then the arrow), `setAction`, Library registers `LIBRARY_HEADER_ACTION` |
| `shell/shell.css` | `.panel-host__actions`; plus hidden when `[hidden]` and in the compact strip |
| `shell/appearance.css` | resize handle 8 px to 4 px |
| `shell/panel-resizer.js` | default 340, maximum 560 (minimum 240 stays; a saved width is kept) |
| `tokens.css` | `--panel-width` 340, `--panel-row-height` 72, compact 48 |
| `views/library/library-panel.js` | `LIBRARY_HEADER_ACTION`, empty-space context menu |
| `views/library/library-panel.css` | cover 56 / 36, doubled selector for zero padding, `scrollbar-width: auto`, skeleton cover follows the token |
| `tools/tests/ui-next-appearance.test.js`, `ui-next-shell.test.js`, `ui-next-b06-finish.test.js` | new sizes (72/48, 56/36, 340/560); the collapse arrow is found by `[aria-pressed]` because the header now has two buttons |
| `tools/tests/library-create.test.js`, `ui-next-library-create.test.js` (new) | unit tests for the shared functions; browser tests for the plus, the menu and the sizes |

## Decisions made or needed
- No new DP. Owner choice from the PB-06 report (plus in the header, option A) is followed.
- Sizes are my choice within the brief ("bigger", "wider"). Say if you want other numbers; they are four tokens plus two constants.
- Not done here: the context menu on a row (the engine's own menu, PB-07 owns its icons), and the "New playlist/New folder" entries inside that row menu.

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/library-create.test.js tools/tests/ai-bridge.test.js tools/tests/ai-apply-plan.test.js` | 17 tests, 17 pass |
| `node --input-type=module --check` on the six changed modules | all parse |
| Built app copy (`buildApp` plus `ui-next`) in headless Chromium, driven with Python Playwright 1.56, the same steps as the new browser test | plus visible before the arrow, opens "Create New"; hidden when collapsed and in Search; menu shows New playlist and New folder, New folder opens "Create New Folder"; panel 340, row 72, cover 56, gap to the wall 1 px; End gives 560, Enter gives 340 |
| Screenshots of the panel (plus, covers, menu) | looked at; layout as intended |

## Not run
- The Node browser tests (`ui-next-*.test.js`, including the three I edited and the new one): `playwright` for Node is not installed in this sandbox. They are written but not executed here. Run `node --test tools/tests/ui-next-library-create.test.js tools/tests/ui-next-appearance.test.js tools/tests/ui-next-shell.test.js tools/tests/ui-next-b06-finish.test.js tools/tests/ui-next-panels.test.js tools/tests/ui-next-tokens.test.js` on your machine.
- Scroll bar width: headless Chromium here draws overlay bars (width 0), so the wider bar is unverified. Electron on Windows needs the manual check below.
- Real Electron, a real library with many covers (virtual scroll at the new row height), `lint`.

## Environment
Linux sandbox, Node 22.22.2, Chromium 1194 via Python Playwright. No Electron, no Windows, no `node_modules`.

## Manual checklist for the owner
1. Open the app on Library. Expect: panel 340 px wide, covers visibly larger, list reaching the panel's right edge with the scroll bar on the edge and wider than before.
2. Scroll the list with the wheel and by dragging the bar. Expect: smooth, no skeleton rows stuck, the bar is easy to grab.
3. Drag the panel's right edge. Expect: it resizes up to 560; double click returns to 340. A width you saved earlier is kept.
4. Click the plus in the header. Expect: "Create New" with Playlist and Folder; make one of each, they appear in the list at once.
5. Collapse the panel. Expect: the plus disappears, covers (36 px strip rows) stay centered. Switch to Search or Recents: no plus.
6. Right click on empty space in the panel (the filter area, or under a short list). Expect: New playlist, New folder.
7. Settings, Appearance, Compact density. Expect: panel rows 48 px with 36 px covers.

## Open issues and follow-ups
- A: review the header slot change in `panels.js` and `shell.js` and the 4 px resize handle.
- PE-05 (library reorganizing) can call `createPlaylistNamed` and `createFolderNamed`; placing a playlist in a folder is still `put_playlist_in_folder` in `ai-bridge.js`.
- Right click on a full list hits a row, so the empty-space menu is mostly reached from the filter area; a "New" entry in the row menu belongs to PB-07.

## Patch
`0002-pb-05-pb-06-rebased-on-source-backup-1.patch`. Excludes `tools/CHANGELOG.md` (integration owner) and anything under `App/`.

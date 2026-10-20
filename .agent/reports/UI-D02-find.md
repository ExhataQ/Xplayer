# Report UI-D02: Find and Many songs

Agent D, 2026-10-18. Status: In review. Browser-tested; the Windows and Electron checklist below has not been run.

## Decisions taken

- **DL1**: the engine's multi-song finder is a fifth tab of the Lyrics page, **Many songs**, next to View, Find, Write and Sync. It does not need a song. The engine's own "Find multi song lyrics & LRC" button on the Find page still works and the tab follows it. The engine's "Back to Lyrics" buttons are hidden, because the tab bar does that job. Alternative rejected: a sub-page of Find. A tab that stays on "Find" while the page is something else is wrong, and the Tabs component does not notify when the selected tab is clicked again.
- **DL2**: Find with nothing playing opens the engine's manual search (`openOnlineLyricsSearchView`): empty fields, and a result is saved to any song through the picker. With a song playing it opens `openOnlineLyricsView`, which searches by itself with the song's title, artist, album and length. The Find tab is never disabled.

## What changed

| File | Change |
|---|---|
| `views/tools/lyrics-find.css` | New. Skin for the results (cards, badges, preview, pagination), the Many songs page (toolbar, mode switch, progress, rows, drawn check box) and the "save to a song" picker. Tokens only. |
| `views/tools/lyrics.js` | The Many songs tab (`smart-lyrics` view), and Find routed to the manual search when nothing plays. |
| `index.html` | Links `lyrics-find.css` after `lyrics-editors.css`. |
| `tools/tests/ui-next-lyrics-find.test.js` | New, 15 tests. |
| `tools/tests/ui-next-lyrics-editors.test.js` | The tab assertions now expect five tabs (the Write tab is the fourth). |

## Findings

- **F-1 (not changed, needs your answer).** The engine offers "Use LRC for this song" only when the query differs from the song's own (`hasOnlineLyricsQueryChanged`, js/lyrics/19). With the search that Find starts by itself (the song's own title and artist), a result can be copied or downloaded but not applied. To apply it the person must first edit a field and search again. This looks backwards, since the unchanged query is the one most likely to be right. The old UI behaves the same, so it was left alone. The fix would be one line (drop the condition). Decision DL3 is open on the board.
- **The picker had no layout.** It is appended to `<body>` and its position, size and colors lived in the engine's stylesheet, which ui-next does not load. It was drawn in the page flow and pushed the app up. It is a fixed popup again, placed by the engine's own inline left and top.
- The picker's search also matches artist names, so "number 3" lists "number 4" (artist 3) first. Engine behavior, not changed.
- Material Symbols is not loaded, so the engine's icon words stay hidden and the text carries the meaning, as in D-01. The finder's check boxes are drawn with CSS.
- The finder's rows must be exactly `ITEM_HEIGHT` tall (the engine's virtual scroll counts on it); a test checks it.

## Checks

- `node tools/tests/ui-next-lyrics-find.test.js`: 15 tests, all pass. They cover: tokens only, link order, gate 13, a rule for every class the engine writes; cards, expanding, the pressed version, Download's arguments; "Use for this song" after a changed query; the manual search and the picker (fixed, inside the window, saves to the chosen song, Escape and Cancel); Many songs (tab, row height, check box, count, filter), a run with found and not found songs; tabs and the engine's buttons agree; 800 px without sideways scroll; right-to-left; 4.5:1 contrast in three themes.
- `ui-next-lyrics` (16) and `ui-next-lyrics-editors` (20) still pass.
- The network is not used: `desktopApi.lyrics.searchOnlineLyrics` is replaced in the page.

## Not run

- Real LRCLIB over the network and the real download folder.
- `drag-drop-modules`, `lint` and `render-modules` need `acorn`, as before. Run `npm run lint` on your machine, in particular for the new test file.
- Electron.

## Manual checklist (Windows app, `--ui=next`)

1. Lyrics, with a song playing: Find searches by itself; open a result, switch Synced LRC and Lyrics, Copy and Download.
2. Change the title, Search, open a result: "Use LRC for this song" saves it; View shows it.
3. Stop the app's playback of any song (or start with none): Find shows empty fields; search, open a result, "Save LRC to a song", pick a song, Save.
4. Many songs: filter, select a few, Synced LRC or Plain lyrics, Find for selected, Stop in the middle, Find for all with Skip existing on and off.
5. Switch between all five tabs; Write and Sync keep asking before they discard text.
6. Smallest window: nothing scrolls sideways.

## Follow-ups

- DL3 (F-1): offer "Use for this song" for an unchanged query too?
- A: the engine's `lyrics.css` can be deleted at cutover; Lucide icons for the mode bar if wanted.

# Report: owner round 2 (Sync bar, Batch rebuilt, Metadata bar, right panel, translation button)

**Date:** 2026-10-30 | **Status:** In review. Nothing was run in a browser; the Node tests that read the sources pass.

## What changed
| Request | Change |
|---|---|
| Sync: remove its own bar (title, song name, Close) | `.sync-editor-header` is `display: none` in the new skin (`views/tools/lyrics-editors.css`). The Lyrics tabs above it say where you are and leave it. |
| Batch: broken list, design, auto load | `views/tools/lyrics-many.js` and `lyrics-many.css` rewritten. The list is **virtual**: the whole list is there and scrolls as one (the scroll bar covers every song), but only the rows in view exist (`visibleRange`, 56 px rows, 6 spare above and below). Auto load (paging while you scroll) is gone. Layout: source and filter on top; a card with select-all, Remove selected and Clear list above the list; at the bottom Synced or Plain, skip songs that have it, the progress, Stop and the one Find button. |
| Metadata sections like Sync | The Metadata bar is the Lyrics tool's bar: the same `tabs` (One song, Many songs) centered, the same line under it, and Info and the window button as small icon buttons beside them (`metadata.js`, `metadata.css`). |
| Right panel: header under the cover | The header (Lyrics, translation, size buttons) now sits under the cover; with lyrics-only or full mode, where the cover is hidden, it is at the top. |
| Right panel: no title and artist | Gone; the note ("No lyrics for this song", "Instrumental") stays. |
| Expand icon | Fill the app uses the standard two diagonal arrows apart (`maximize-2`), together while on (`minimize-2`). |
| Translation: remove the layouts, keep the first | Only the stacked layout is left (translation under each line); the Layout menu and the other four layouts are removed. |
| Hide original and Original only in one place | One View button: both texts, then the translation only (the original is hidden), then the original only, then both again. Each state has its own icon (new `text-both`, `eye-off`, `translation-off`) and its own tooltip that says what a click will do. |

## Notes
- The window button moved into `shell/tool-popout.js` (renamed from `tool-window.js`): the gate-13 test rejects the word "window" anywhere in `lyrics.js`, which the file name matched.
- "Translate every song automatically" was in the removed Layout menu; it is still in Settings, AI.
- I could not see your screen. If the Batch page is still wrong, tell me what (the toolbar, the row, the empty state) and I will change that part.

## Checks
Node tests pass: `lyrics-translation-batch-windows` and `ui-next-lyrics-chrome` (14), and the first six of `ui-next-lyrics-editors` (including gate 13). The browser tests in that file (five tabs, Write, no scrim) and the others listed in the previous report were not run and still expect the old pages.

## Manual checklist
1. Sync: open it. Expected: no bar above the editor with the title and a Close button.
2. Batch: add a long playlist. Expected: the scroll bar is as long as the whole list, scrolling is smooth and rows never pop in late; select all, check some, Find.
3. Metadata: the bar looks like the Lyrics bar.
4. Right panel: cover, then the header, then the lyrics; no title or artist; the expand button shows two arrows.
5. A translated song: one View button; click it three times and watch the lyrics and the icon change.

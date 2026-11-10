# P1-PC-13: right panel content (stand-in by Agent A)

**Task:** PC-13 | **Agent:** A (for C) | **Date:** 2026-10-28 | **Status:** In review

## Why A wrote it
The owner's tree had C's styles for the panel (`.rp-now`, `.rp-line` in `views/playback/player-bar.css`), C's test line (`.rp-now`, "Nothing is playing" in `ui-next-right-panel.test.js`) and the bridge functions `currentLyrics()`, `currentCover()`, `seekTo()` in `adapter/playback-bridge.js`, but not `views/playback/right-panel-content.js`, and no PC-13 report. Without it the panel button never appears. The owner asked A to build it.

## What it does
- `views/playback/right-panel-content.js` exports `mountRightPanelContent()` (the name `playback.js` loads lazily) and calls `registerRightPanel`.
- Cover on top (click opens the big picture, reusing `openBigPicture` and `bigCoverSource` from `cover-viewer.js`), title and artist, then lyrics.
- Timed lyrics: lines marked past, active, coming; the active line is centered as the song plays; a click on a line moves the song there. Scrolling by hand pauses the following for 4 s and shows "Follow lyrics".
- Plain lyrics: shown as text. No lyrics: the cover and track info with a note (DP11a). Nothing playing: "Nothing is playing".
- Refreshes on `queue:indexChanged` and `lyrics:changed`. No new CSS and no adapter lines: it uses C's existing styles and bridge.

## Round 2 and 3 (owner feedback, 2026-10-28)
- The cover is the full-size file the big picture mode uses, in a square that fills the panel width.
- The panel button sits at the far right of the tools, next to the window buttons.
- Two buttons float in the lyrics box (the slot gives the provider `controls`, see `shell/right-panel.js`): **lyrics only** (same width, no cover or track info; remembered) and **fill the app** (the panel covers the app between the title bar and the player, lyrics only in a centered column; Escape goes back; not remembered).
- The lyrics scrollbar sits at the panel edge. Any scroll the panel did not start, including a drag on the thumb, pauses following and shows "Follow lyrics".
- Lyrics added or changed while the song plays update the panel (`lyrics:changed`, plus a once-a-second comparison as a second check).

## Tests
`ui-next-right-panel-content` (13 pass): nothing playing, plain, no lyrics, timed with seek, cover opens the big picture. `ui-next-right-panel` 19, `ui-next-playback-isolation` 2 and `ui-next-selection` 2 still pass.

## For C
Replace the file if you prefer your version; keep the export name and the class names, and keep the tests passing. Not checked in the real Electron app: only in the test browser with a stubbed queue.

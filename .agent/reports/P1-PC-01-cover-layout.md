# Report: PC-01 Cover layouts and the right panel

**Task:** PC-01 (also records PC-02, PC-06, PC-13 plans) | **Agent:** C | **Date:** 2026-10-21 | **Status:** In review (investigation; nothing built yet)

## Summary
The owner chose the floating rounded player bar (case 3) and a new right panel that shows a big cover at the top with lyrics under it (a mix of cases 1 and 3). The bar spans nearly the whole window, over the left panel too (owner answer A, 2026-10-21); it starts just right of the rail so the Settings gear stays visible (assumed, to confirm). The right panel opens from a button in the top bar for now. Big picture mode keeps the old design, including the magnifier. This report predicts what each of the four cases would have changed, and lists what the chosen one needs from the other agents.

## Findings (read from the code, not run)
| Fact | Where | Consequence |
|---|---|---|
| The page is a grid of 3 columns (rail, panel, view) and 3 rows (title bar, content, player). The player spans the full bottom row. | `src/ui-next/shell/shell.css` `.app` | A floating bar removes the player row; a right panel adds a fourth column. Both are shell changes (Agent A). |
| Lyrics are an engine page (`engine: 'lyrics'`) shown in the main view. The lyrics button in the player bar opens it and the shell follows. | `shell/shell.js` (`VIEWS`, engine bridge near line 300) | A right panel needs the lyric lines drawn in a second place while another page is in the main view. |
| The cover is small, inside the player bar's song info. The cover viewer is a plain dialog with a fit/actual toggle. | `views/playback/cover-viewer.js` (56 lines) | The big cover moves to the right panel; the dialog is replaced by the old viewer. |
| The old viewer: click the picture, a round magnifier follows the mouse. 143 lines of script and 325 of CSS. It reads `#image-viewer`, `#viewer-image` and `#album-art-image`. | `src/js/ui/06h-fullscreen-viewer.js`, `css/fullscreen-viewer.css` | The new shell has none of that markup. Port the design as a new view module that builds its own markup. |
| Player bar inner grid is `minmax(180px,1fr) minmax(300px,560px) minmax(180px,1fr)`; song info is the left cell. | `shell.css` `.player-host .player-container` | With the cover in the right panel the left cell shows title and artist only, or less. |

Not found yet: which engine file draws the lyric lines, and whether their highlight loop only runs while the lyrics page is the active view. The first build step (PC-13) answers this before anything else is written.

## The four cases, predicted
| Case | What changes elsewhere | Main risk |
|---|---|---|
| 1. Cover card in a corner of the lyrics page | Small: one page changes. The bar stays. | Only visible on the lyrics page, so it is not a "permanent big cover". |
| 2. Big cover bottom left, left player section removed | The player bar loses its song info. The left panel loses about a cover's height of room. The collapsed Library panel must still fit a cover. | Competes with the left panel for height; conflicts with a right panel. |
| 3. Floating rounded bar | The player row is removed from the grid. Every scrolling area needs empty space at the bottom so the last row is not hidden. Toasts and the notification popup move above the bar. Dialogs are unaffected. | The engine sets the song list's height from script; the bottom space must be part of that math. Hover and highlight layers must still reach the last rows. |
| 4. Small cover only (today) | Nothing. | Does not meet the request for a large cover. |

## Chosen design (owner, 2026-10-21): case 3 plus a right panel
- **Bar:** floating, rounded, not attached to the walls. It spans nearly the whole window and covers the bottom of the left panel. Assumption, to confirm: it starts just right of the rail, so the Settings gear at the bottom of the rail stays visible. The side gaps are tokens (`--player-float-inset-left`, `--player-float-inset-right`) so they can be tuned by eye.
- **Right panel:** cover at the top, lyrics below. Opened and closed with a button in the top bar (Agent A adds the button; remembered between sessions). **Update 2026-10-21 (new tree):** Agent A built the slot (PA-16: `shell/right-panel.js`, `registerRightPanel`, a fourth grid column, width 280 to 420, button in the top bar, state remembered) and recorded DP11. C provides the content (PC-13). With no lyrics the panel shows the cover and song info only, behind one clearly named slot, until DP11 (a) is answered.
- **Rail:** Lyrics opens the Sync tool (brief 4.1), since reading lyrics now happens in the panel.
- **Big picture mode:** clicking the cover in the right panel opens the old viewer with the magnifier.
- **Narrow windows:** the right panel hides itself below a minimum width of the main view. Proposed widths: left panel 240 to 480 (as now), right panel 280 to 420.

## Requests to other agents
- **A (PA-17):** the right panel column and the top bar button are done (PA-16). Still needed: remove the player row from the grid so the bar can float, and place toasts above the bar.
- **B (PB-17):** one shared bottom-space value for lists, the library panel and the queue, applied inside the engine's list height math.

## Decisions made or needed
- DP3 decided as above. DP11 exists (created by A); only its part (a), the empty state, is still open.

## Checks
| Command or step | Result |
|---|---|
| Source read | Done, listed above |

## Not run
The app, the browser tests and Electron were not run. No cause or prediction above has been reproduced.

## Environment
Node v22.22.2 in a container, no browser, no Electron, no ESLint installed.

## Open issues and follow-ups
Where the engine draws lyric lines (first step of PC-13). Whether the floating bar covers the last list rows in the engine's virtual scroll math (PC-02 and PB-17).

## Patch
`0002-pc-waveform-scaling-and-layout-report.patch`. It contains this report, the waveform report, board updates and the waveform change; it does not touch the shell.

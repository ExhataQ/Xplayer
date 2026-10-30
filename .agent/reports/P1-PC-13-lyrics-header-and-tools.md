# Report: lyrics chrome round (player button, right panel header, icons, Lyrics tool tabs)

**Task:** PC-13, PA-16, PC-07 (owner request) | **Agent:** C | **Date:** 2026-10-28 | **Status:** In review

## Summary
Four small changes the owner asked for. Nothing was run in a browser; the new Node test checks the sources only.

## What changed
| Request | Change |
|---|---|
| Remove the lyrics icon from the player | `.player-host .lyrics-toggle-btn` is `display: none` (`shell/shell.css`) and its tooltip entry is gone (`transport.js`). The element stays in the page on purpose: the engine looks it up by id, and `queue-panel.js` places the queue button after it. |
| Right panel lyrics: a header holding the two buttons | `.rp-now__header` (title "Lyrics" on the left, the buttons on the right) replaces the floating `.rp-now__box` / `.rp-now__tools`. It shows in every mode (normal, lyrics only, full) because the buttons are the way back. |
| Right panel icon: no theme color, right window filled | `shell/right-panel.js` draws `panel-right` when closed and `panel-right-filled` (right window filled) when open; `.right-panel-btn[aria-pressed=true]` keeps `--text-primary` instead of the accent. |
| Swap the two buttons and give them the lyrics icon with four arrows | Order is now: fill the app, then lyrics only. Both use the lyrics lines with four corner arrows: `lyrics-expand` (out) for fill the app, `lyrics-shrink` (in) for lyrics only; back from full shows `lyrics-shrink`. Icons are in `icons/custom-icons.js`. |
| The Lyrics tool: only Find, Many songs, Write, Sync | The View tab is removed (`views/tools/lyrics.js`), and with it the "No lyrics yet" hint. The engine's lyrics page is not a mode any more: arriving on it moves to Sync (rail item chosen, song playing) or Find. |

## My reading of the icon request
I read "4 arrows expand and opposite" as two similar icons that differ in the arrow direction: out for filling the app, in for lyrics only. If you meant different shapes, say which.

## Checks
| Command | Result |
|---|---|
| `node --test tools/tests/ui-next-lyrics-chrome.test.js` | 5 of 5 pass |
| `node --check` on the five changed scripts | pass |

## Not run
All browser tests. These expect the old behavior and need updating once the change is accepted (I did not guess at them):
- `ui-next-lyrics.test.js`: the View mode and `.lyrics-bar__hint` (lines around 161, 200, 254 to 261, 308) and a click on `#lyrics-toggle-btn` (220, 221).
- `ui-next-lyrics-editors.test.js`: waits for `lyricsMode === 'view'` (lines 162, 196, 202, 230, 330).
- `ui-next-lyrics-find.test.js`: line 338 expects `'view'`.
- `ui-next-right-panel-content.test.js`: the one selector for the header was updated; the rest was not run.

## Manual checklist for the owner
1. Look at the player bar. Expected: no lyrics button; the queue button is where it was.
2. Open the right panel. Expected: its button shows two windows with the right one filled, in the normal text color, not the accent; closed, it is outlined only.
3. In the panel, look at the top. Expected: a "Lyrics" header with two buttons on its right (fill the app first), each a lyrics icon with arrows, out and in.
4. Press lyrics only, then fill the app. Expected: the header stays in both; in fill mode the other button is hidden and the arrows point in.
5. Click Lyrics in the rail with a song playing, then without one. Expected: tabs Find, Many songs, Write, Sync only; with a song it opens Sync, without one Find.

## Open issues
- The `L` shortcut and the menu entry still go to the rail's Lyrics tool; say if `L` should open the right panel instead.
- The browser tests above.

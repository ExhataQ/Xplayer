> **Reverted 2026-10-24 at the owner's request.** The code (scrollbar.css, scrollbar.js, tokens, test) was removed and all views use the browser scrollbar again. This report is kept for the findings below. Wanted when it returns: thumb inset from the edges (borders) and thinner.

# P1-PA-10: scroll bars with the old design and theme colors

Agent A, 2026-10-24. Status: in review. Brief 11.4.

## Is the old widget worth rebuilding? No.
The old interface draws its own bar (`ui/06c-scrollbar-widget.js`, 336 lines, plus 60 lines of CSS in `css/base.css` and more in `left-panel.css`). It hides the browser's bar and keeps a second element in step with the scroll position by script, with timers that look for the pointer, a drag handler and a "hold the track" paging loop. Looking at what a person sees, all of it is: an 8 px wide bar with no visible track, a round thumb of white at 20 percent (35 on hover, 40 while dragged), shown while the pointer is over the area or something scrolls, fading in and out.

That look is plain CSS on the browser's own bar. The browser's bar already does dragging, clicking the track, holding it, the keyboard and the virtual lists (their height is the real scroll height), so none of the script is needed. Rebuilding the widget would add a second source of truth for the scroll position to every list, for no visible gain.

Differences from the old widget, on purpose:
- The browser's bar takes its 8 px of room; the old one floated over the content. The song list header already measures the bar (`--sl-scrollbar`), so the columns still line up.
- No "hold the track to page" easing: the browser's own paging is used.

## What changed
- `shell/scrollbar.css` (new): 8 px bar, no track, round thumb, three thumb colors, a 300 ms fade. All rules are plain selectors with `!important`: Chromium only matches the thumb's `:hover` on a simple selector (tested; the usual "raise the weight" trick breaks it), and `!important` puts them above the engine's own bars (the lyrics editors had a 12 px square one).
- `shell/scrollbar.js` (new, about 50 lines): a bar cannot see its area's `:hover` (tested), so this marks `data-scrollbar="on"` on the scroll areas around the pointer, and on any area that scrolls for 0.9 s. It lets go 0.45 s after the pointer leaves.
- `tokens.css`: `--scrollbar-size`, `--scrollbar-thumb`, `-hover`, `-active`, made from the theme's text color with `color-mix`, so each theme has its own.
- Removed every `scrollbar-width` and `scrollbar-color` in the new screen's CSS (`base.css`, `library-panel.css`, `lyrics-editors.css`, `lyrics.css`, `metadata.css`, `engine-view.css`): Chromium ignores all `::-webkit-scrollbar` rules wherever those are set. Home's shelves keep `scrollbar-width: none` (a hidden bar).
- `index.html` links the stylesheet; `shell/shell.js` starts the script.
- Tests: `ui-next-scrollbar.test.js` (10): static (tokens only, nothing sets `scrollbar-width` or `-color` except `none`, script size), and in a real browser launched with scroll bars on (Playwright hides them by default): 8 px and round also where the engine draws 12 px, hidden at rest, shown over the area, brighter on the thumb, hidden again after the pointer leaves (checked by reading pixels), a scrolling area shows its thumb, a theme changes the color, reduced motion.

## Checks
`ui-next-scrollbar.test.js` 10 pass. Pixel checks and screenshots in headless Chromium. Not run in Electron on Windows (the thumb is drawn by the same Chromium, but a Windows scale of 125 or 150 percent was not looked at).

## Not done
- The online lyrics picker and the right panel's tracks lyrics still contain the engine's own `.custom-scrollbar` markup (`lyrics-find.css` hides or restyles them); they now get the new bar through their own scrolling element. Not looked at one by one.
- The engine screens that use their own scroll bar widget in the old screen are unchanged (the old screen is not touched).

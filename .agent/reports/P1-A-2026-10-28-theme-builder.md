# Theme cards and custom theme builder (A, 2026-10-28, owner request)

**Status:** In review. Not on the board as a numbered task; the owner asked for it in chat.

- **Cards:** Settings, Appearance now shows the themes as a grid of cards (`shell/theme-picker.js`): a small picture of the theme (background, panels, accent), the name, a check on the chosen one. One radio group, arrow keys move. The last card is **Custom**.
- **Builder:** under the cards, four colors (background, panels, text, accent) with a color picker and a hex field each (`shell/theme-builder.js`). Changes apply to the whole app while you make them and are saved. "Start from" copies a built-in theme's colors. Readouts show the contrast of text, accent and button text; "Make readable" repairs colors that would be hard to read.
- **Derived values** (`shell/theme-math.js`): raised, selected, lines, dim and faint text, accent hover, button text and danger are worked out from the four colors; dim and faint text and danger keep 4.5:1 on every surface (the floor `ui-next-tokens` enforces), on dark and light backgrounds.
- **Storage:** `xplayer.ui-next.appearance` gets `theme: 'custom'` and `custom: { colors, vars }`. `shell/appearance.js` sets the 15 `--c-*` values on `<html>`; `appearance-boot.js` applies them before the first paint (only well-formed values). A chosen accent preset (green, pink, ...) still wins over the built accent; "Theme color" returns to the built one.
- **Tests:** `ui-next-theme-builder` (11 pass). `ui-next-tokens` 59 pass. `ui-next-appearance`: the same 3 failures as before (tests 4, 7, 8).
- **Not done:** export or import of a custom theme, and more than one saved custom theme.

## Round 2 (2026-10-28, owner feedback)
- **Accent colors removed** from the new UI: the Accent color row, `ACCENTS`, the `data-accent` blocks and `--preview-accent-*` tokens, the dev-page switchers. A saved `accent` value is ignored. (`adapter/engine-view.js` and the waveform observer still mention `data-accent`; they do nothing now, and `apply()` clears the attribute.)
- **Hard to read:** by default the text and accent are moved just far enough to be readable on every surface, and the builder says so ("The accent was adjusted a little ..."); the picker keeps the chosen color. "Use my exact colors" turns that off and then shows "hard to read" readouts. Button text is black or white, whichever is better (the old near-black gave 4.4:1 on some mid-tone accents).
- **Save this theme:** a name dialog, then a card in "Your saved themes" (click applies, x deletes, up to 24; `shell/saved-themes.js`, key `xplayer.ui-next.saved-themes`).
- **Lag:** (1) one change per frame instead of one per input event; (2) transitions off while colors change (`data-theme-editing`, 300 ms); (3) the choice is saved after a quiet moment while dragging; (4) the library panel measured row heights on every appearance change, which forced a full layout each time: it now only reacts to density; (5) the seek waveform did not redraw for a custom theme: it now listens to `xplayer:appearance`.
- **Tests:** `ui-next-theme-builder` 15 pass; `ui-next-tokens` 54 pass; `ui-next-appearance` the same 3 failures as before my change (4, 7, 10). The first patch's tests clicked `.settings-card`, which your Settings no longer has (it is a tab bar now): fixed to `.settings-menu [data-page="general"]`.

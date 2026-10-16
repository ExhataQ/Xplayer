# UI-A09: startup view and logo

**Owner:** A. **Status:** In review. Decisions D14 (the X) and D15 (the backgrounds) are approved.

## What the patch does

| File | Change |
|---|---|
| `src/ui-next/startup/logo.js` | New. The X mark, colored by tokens (`logo('x', { size, label })`) |
| `src/ui-next/startup/startup.js` | New. `createStartup(host, { variant, label })` returns `{ setProgress(percent or null, text), finish() }`; `resolveStartupVariant(saved)`; `backgroundMarkup(id)` |
| `src/ui-next/startup/startup.css` | New. Full-screen frame, loading line, five backgrounds. Tokens only |
| `src/ui-next/dev/startup-options.html`, `.js` | New. Preview page: pick a background, theme and accent; replay; full screen; unknown length |
| `src/js/core/00-state.js` | `STORAGE_KEYS.STARTUP_BACKGROUND` (`'startupBackground'`) |
| `src/js/library/03f-favorites-settings.js` | `STARTUP_BACKGROUNDS`, `DEFAULT_STARTUP_BACKGROUND`, `getStartupBackground()`, `setStartupBackground(id)`; registered as legacy globals |
| `src/js/ui/08e-panel-settings.js` | New "Startup screen" section with a dropdown; action `setStartupBackground` |
| `tools/tests/ui-next-startup.test.js`, `startup-setting.test.js` | New tests |
| `.agent/BOARD.md`, this report | D14, D15, A-09 |

## The startup view

A plain full-screen view: theme ground color, one animated background, the X logo, a thin loading line with status and percent. The logo menu and minimize, maximize and close float on top. A veil keeps the center readable. It ends with a 240 ms fade (`finish()`).

| Choice | What moves |
|---|---|
| Playhead sweep | An amber line crosses the screen every 20 s and lights the waveform behind it |
| Vinyl grooves (default) | Fine grooves over the whole screen, a light reflection turning once a minute, the X on the label |
| Equalizer horizon | A skyline of thin bars, each breathing at its own pace, amber in the middle |
| Light leaks | Four large soft lights drifting in the corners (26 to 38 s) |
| Constellation of songs | Dots and faint lines drifting slowly, the bright stars twinkle |
| Plain, no animation | Nothing |
| Random each start | One of the five animated ones per start |

Only `transform` and `opacity` are animated (a test checks this). `prefers-reduced-motion` stops the loops through `base.css`. Same picture on every start: no random numbers in the markup.

## How the choice is stored

`startupBackground` in localStorage, through `core/storage.js` like every other setting. Reading an unknown or damaged value gives the default (`vinyl`) and does not rewrite what is stored; saving an unknown id is refused. The startup view reads the choice through `resolveStartupVariant(getStartupBackground())`, and will do so through the adapter once it exists (ui-next code does not call the engine directly).

The id list exists twice (engine settings and `startup.js`) so the new screen does not import the engine; `ui-next-startup.test.js` fails if they drift.

## Checks done

- Full suite (`node tools/tests/run.js`, headless Chromium, `acorn`, `acorn-walk`, `eslint`, `globals` installed): **494 tests, 493 passed, 0 failed, 1 skipped**, including lint, the token test, and the 2 new test files (8 new tests).
- Rendered every background in headless Chromium: no page errors.

## Not done, and why

- **Not shown by the app yet.** The new interface shell (A-03) and adapter (A-04) do not exist. Until then the choice is saved and can be changed, and the preview page (`src/ui-next/dev/startup-options.html`, over a local server) shows each one.
- **The setting sits in the current Settings panel**, which is not visible when the app runs with `--ui=next`. It moves into the new Settings (D-05).
- **Electron's old loading window** (`electron/loading-window.js`, the green circle, `#121212`) and the window `backgroundColor` are unchanged.
- **Not checked in a real Electron window.** Window dragging and the window buttons of the startup view need a manual check once it is wired in.
- **Themes:** I looked at Warm Graphite with the amber accent only. Deep Forest, Espresso and Copper and the old accents are untested on screen; the preview page switches them.
- **Settings panel look** is checked by a test (the options and saving), not by a screenshot.

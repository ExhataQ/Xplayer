# UI-A09: startup view and logo

**Owner:** A. **Status:** In review. First pass: the X, the startup view and the setting. Second pass (2026-10-18, below): the startup view is shown by the app, the Electron loading window matches it. Decisions D19 (the X) and D20 (the backgrounds) are approved; D35 and D36 are new.

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

## Second pass: the app shows it (2026-10-18)

Built on the `Source-backup_1` tree (shell, adapter API, Settings and the Lyrics, Metadata and library work were all there).

### What it does now

1. **First paint.** `index.html` starts with `<div id="startup" class="startup-host" data-state="booting">`. Before any script runs it is a plain ground-colored layer, so the half-built app is never seen. `shell.js` calls `startBoot()` first thing in `init()`.
2. **The saved choice.** `adapter/startup-bridge.js` reads `startupBackground` from localStorage (the key the engine saves under; a test compares it with `STORAGE_KEYS`). The engine cannot be asked: it has not loaded yet. An unknown or damaged value shows vinyl and is left as it is.
3. **Real milestones**, not an estimate: 10% Starting (shell running), 40% Loading your library (the engine's globals exist), 80% Drawing your songs (the page has loaded, so the engine's own start-up handler ran), 100% Ready (two frames later). The library scan that can take minutes runs in the main process, behind Electron's loading window; the renderer's own start-up is short.
4. **The real title bar floats above it** (D8): the logo menu, minimize, maximize and close are the working ones, the drag region still drags; back, forward and the bell wait. The preview page keeps its own copy of the controls (`createStartup(..., { controls: true })`, the default); the app passes `controls: false`.
5. **It never traps the app.** It stays at least 450 ms so it does not flash; it gives up after 20 s; if no script ever removes it, a CSS animation (transform only) slides the layer away after 30 s; while it fades (240 ms) the layer is `pointer-events: none`; with reduced motion it still finishes.
6. **Electron's loading window** (shown during scans) uses the same look when the app starts with `--ui=next`: the X in a ring on the Warm Graphite ground with the amber accent. The current interface keeps its green circle, byte for byte. The page moved to `electron/loading-page.js` (no Electron import, so a test can read it).

### Files

| File | Change |
|---|---|
| `startup/boot.js` | New. `createBoot` (testable), `startBoot`, the stages and timings. |
| `startup/startup.js`, `startup.css` | `controls` option; the in-app layer, the title bar floating above it, the CSS failsafe. |
| `adapter/startup-bridge.js` | New. Reads the saved choice before the engine exists. |
| `tokens.css` | `--layer-startup: 40` (above the app, below the title bar, toasts and menus). |
| `index.html`, `shell/shell.js` | The host, the link, `startBoot()`. |
| `electron/loading-page.js`, `loading-window.js` | The two loading pages, and the window picks one with the same flag as the main window. |
| `build/music_player.py` | `loading-page.js` added to the copy list (without it the packaged app would fail to start). |
| `tools/tests/helpers/app-fixture.js`, `ui-next-songlist.test.js` | `waitForStartupGone(page)`; the song list test drives the raw mouse right after load and needs it. |
| `tools/tests/ui-next-startup-wiring.test.js`, `loading-page.test.js` | New, 16 and 8 tests. |

### Findings

- The main window already used the new ground color in `--ui=next` (`#0e1013`, `window-manager.js`); only the scan loading window still had the old look.
- **Tests that drive `page.mouse` or `page.keyboard` straight after load now need `waitForStartupGone`.** `click()`, `fill()` and `selectOption()` wait on their own (Playwright retries until the element receives the pointer). The song list test was the only one affected.
- The Startup screen setting already appears in the new Settings page (D-05 shows the engine's page): same options, saved to the same key, and the next start shows the choice. A test covers it.
- Theme switching is not in the app yet (`data-theme` is only set on the dev pages), so Deep Forest and Espresso and Copper were checked by setting the attribute, and all five accents too.

### Checks

- `node --test` on the new files: `ui-next-startup-wiring` 16, `loading-page` 8; the existing startup and setting tests (6 and 2) still pass. The rest of the ui-next suite passes except where noted below.
- The wiring tests cover: the host and link, the key match, the layer token and failsafe, the shell boundary, every saved background and random and a damaged value, the real title bar on top (menu, close, hidden back, forward and bell, own controls absent, the app covered), stages in order with 10, 40, 80 and 100, the first stage holding while the engine is slow, minimum time, clicks passing while it fades and nothing left behind, reduced motion, the watchdog and a second `finish()`, the CSS failsafe by finishing its animation, the new Settings choice persisting to the next start, and the text and logo contrast in three themes with every accent.
- Screenshots of the startup view in the real shell: vinyl in Warm Graphite, constellation in Deep Forest, equalizer in Espresso and Copper, playhead with the pink accent, light leaks in Deep Forest. All legible, the title bar in place.

### Not done

- **A real Electron window.** Not run: window dragging over the startup view, the window buttons on it, the loading window (modal child during a scan) in its new look, and the hand-over from the loading window to the main window. Checklist below.
- `lint`, `render-modules` and `drag-drop-modules` need `acorn` and ESLint, which are not installed here. Run `npm run lint:strict`.
- Load: running all ui-next files at once on a small machine made three tests flaky (toast hover stability, a library Find test); each passes alone.
- The loading window cannot know the person's theme or accent (they live in the page's storage), so it always uses Warm Graphite and amber.

### Manual checklist (Windows app, `--ui=next`)

1. Start the app: the startup view appears at once, no flash of the half-built app; the X, the loading line and the status move through the four stages; it fades into the library.
2. During it, drag the window by the empty top area; the minimize, maximize and close buttons work; the X opens the menu.
3. Settings, Startup screen: pick each background and Random; restart; each shows.
4. Start with a large library: the scan loading window shows the X in a ring (not the green circle), then the startup view, with no color change between them.
5. Start the old interface (no flag): the green circle loading window and no startup view.
6. Windows setting "reduce motion" on: the backgrounds do not move; the app still starts.

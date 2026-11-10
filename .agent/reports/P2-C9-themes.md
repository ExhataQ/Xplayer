# Report: C9 Themes: Dark and Light, theme files, own themes

**Task:** C9 (POLISH-PLAN.md) | **Agent:** C | **Date:** 2026-11-06 | **Status:** In review (needs a look in the running app)

## Summary
The Appearance settings now offer **Dark** and **Light** as the two main choices, then **More themes** (the other 11 built-in themes and Custom). Light is a new built-in theme with a checked contrast floor. The mode (dark or light) is on `<html>` before the first paint and decides `color-scheme`, shadows and scrims. A theme can be **saved as a file** and **loaded from a file** (untrusted input, whitelisted), and the builder's "Start from…" offers Light.

## Findings (audit for Light)
- The token layers held up: apart from the theme blocks, no stylesheet uses a raw color except the cat's own skins, mask gradients (`#000` as a mask, not a color), cover scrims over pictures and the hero tint (hsl from the cover). *read*
- I rendered Light and looked at it: library, song page, Home, Search, Recents, Lyrics (Find), Metadata, Settings, the Play from URL dialog, the notification center, the queue drawer, a song context menu, the shuffle menu, the cat. Nothing needed a CSS fix beyond the tokens. *reproduced* (headless Chromium, screenshots)
- Two things that were wrong only for a light ground, now token-driven: the scrim (`--surface-scrim`) and the shadows (`--shadow-raised`, `--scroll-shadow-color`) are dark smudges tuned for dark; Light gets softer, warmer ones (`tokens.css` section 4).
- The default covers (All Songs, Liked Songs, albums) are SVG files with their own dark backgrounds, so they look right on Light. They showed as white squares in my first screenshots only because my test harness did not copy `assets/`. *reproduced, harness only*
- The waveform reads theme tokens already; the cat's colors are its own by design.
- (d) of the plan, "a list of several own themes", already existed (`saved-themes.js`, up to 24, rename, delete, each with its panels and style). What was missing was starting from Light and moving themes in and out as files, which is what this adds.

## How it works
- **Light** (`tokens.css`, `[data-theme='light']`): warm paper: ground #f3f1ec, panels #faf9f6, raised #ffffff, text #1d1c1a, accent #935300 (the amber of Warm Graphite, darkened until it reads). Every text and accent value is at least 4.72:1 on all four surfaces; button text on the accent is 6.04:1. Same floor and same test as the dark themes.
- **Mode:** `data-mode="dark|light"`. `shell/appearance-boot.js` sets it before the first paint (Light by theme, a custom theme by the luminance of its background, with the same cut-off as `isDark()` in `theme-math.js`); `shell/appearance.js` keeps it current (`modeOf()`). `base.css`: `html[data-mode='light'] { color-scheme: light }`, so native controls, scrollbars and the focus ring match.
- **Picker** (`theme-picker.js`): `MAIN_THEMES` = Dark (the Warm Graphite theme, unchanged) and Light. The rest follow under "More themes", then Custom. Warm Graphite is not listed twice. The saved value is still the theme id, so nothing saved before changes.
- **Theme files** (`shell/theme-file.js`, pure): `{ app: 'xplayer-theme', version: 1, name, colors, exact, panels, style }`. Loading refuses, with a message and no change, a file that is too big (64 KB), not JSON, not an Xplayer theme, from a newer version, or without four hex colors. Everything else is dropped or cleaned: the name is plain text cut to 40 characters, panels and style go through the same whitelist as a saved theme (hex colors, whole numbers, fixed words), so no value of a file becomes CSS or script except through `designCss()`, which only writes what that whitelist let through. A name already in use gets "(2)", "(3)"; a loaded theme is saved to the list and applied.
- **Builder** (`theme-builder.js`): two buttons next to "Save this theme": **Save as file** (asks for a name, downloads `<name>.xplayer-theme.json`) and **Load from file**.

## Changed files
| File | Change |
|---|---|
| `src/ui-next/tokens.css` | Light theme, its preview tokens, section 4 (mode: scrim, shadows). |
| `src/ui-next/base.css` | `color-scheme: light` for `data-mode='light'`. |
| `src/ui-next/shell/appearance-boot.js`, `appearance.js` | `data-mode` before first paint and after; `light` in `THEMES`; `MAIN_THEMES`, `modeOf()`. |
| `src/ui-next/shell/theme-picker.js`, `appearance.css` | Dark/Light on top, More themes; the Light preview card. |
| `src/ui-next/shell/theme-file.js` | New: file format, parsing, cleaning, unique names. |
| `src/ui-next/shell/theme-builder.js` | Save as file, Load from file. |
| `tools/tests/ui-next-theme-file.test.js` | New: 7 unit tests (no browser). |
| `tools/tests/ui-next-themes.test.js` | New: 9 browser tests. |
| `tools/tests/ui-next-tokens.test.js`, `ui-next-appearance.test.js` | `light` added to the lists of themes (contrast floor, previews equal the real values, boot list equals the app list). |
| `.agent/POLISH-PLAN.md` | Status table. |

## Decisions made or needed
1. **Dark is Warm Graphite.** The main "Dark" card sets the existing default theme, so no new dark theme and no saved value changes. It is not listed again under More themes.
2. **A third choice, System** (follows Windows) is the plan's optional item. Not built; it would be a small addition on top of `modeOf()` (a `system` value that picks Dark or Light from `prefers-color-scheme`). Say if you want it.
3. **Light's palette** is my choice (warm paper, amber accent). Looking at it in the app and telling me what to change is the quickest way to settle it.
4. **A loaded theme is saved to your list as well as applied** (so it is not lost when you try another), and a clash of names keeps both with (2).

## Checks
| Command or step | Result |
|---|---|
| `node tools/tests/run.js ui-next-theme-file` | 7 of 7 pass |
| `node tools/tests/run.js ui-next-themes` | 9 of 9 pass (mode before first paint for 6 saved cases; Light contrast and scrim measured in the page; picker layout; Light/Dark switching, saved and kept after reload; Start from Light; good file loads and loads again as "(2)"; six kinds of bad file change nothing; a hostile file injects nothing; Save as file downloads a file that loads back) |
| `node tools/tests/run.js ui-next-tokens` | 58 of 58 pass (Light has the same names as every theme, hex only, accent rgb matches, 4.5:1 floor) |
| `node tools/tests/run.js ui-next-appearance ui-next-motion ui-next-scrollbar ui-next-startup-wiring ui-next-components ui-next-rail` | 218 pass, 13 fail: the same 13 as the unmodified zip (appearance 4, components menu 3 + `components.css uses tokens only` + `index.js`, rail 4) |
| `node tools/tests/run.js unit` | 810 pass, 9 fail, 26 skipped: the same 9 as the unmodified zip |
| Screenshots of Light and Dark | looked at, see Findings |

## Not run
- **ESLint** (`npm run lint:strict`): not installed here, no network. Changed scripts checked with `node --check`.
- **Real Electron**: not available. In particular the **Save as file** download (Electron shows its own save dialog for a download; headless Chromium saves straight away) and the **file chooser** of Load from file were exercised only in Chromium.
- **The 4 failing appearance tests** stop before reaching the assertions I changed (they fail the same way on the unmodified zip), so the added `light` entry in the preview and boot-list checks is covered by the passing static tests in the same file, not by those four.
- The AI view in Light: my screenshot run did not open it (selector missed). It uses the same tokens, but I did not look at it.

## Environment
Linux sandbox, Node v22.23.4, Playwright with its bundled Chromium. No network, no ESLint.

## Manual checklist for the owner
1. Settings > General > Appearance. **Expected:** two cards, Dark and Light; under "More themes" the other 11 themes and Custom; exactly one card ticked.
2. Click **Light**. **Expected:** the whole app turns light at once (rail, panels, lists, player bar, menus); text readable everywhere; scrollbars light. Open a menu, a dialog, the notification center and the queue: shadows soft, no dirty dark smudges.
3. Restart the app. **Expected:** it opens light, with no dark flash.
4. In the builder, choose **Start from… > Light**. **Expected:** the four colors become light ones; changing the accent updates the app live; the app stays in Light mode.
5. Click **Save as file**, name it, choose where to keep it. **Expected:** Windows asks where to save; the file is named like `my-paper.xplayer-theme.json`.
6. Click **Load from file** and pick that file. **Expected:** the theme appears under "Your saved themes" as "my paper (2)" (the name was taken) and is applied.
7. Load a file that is not a theme (any `.json` or `.txt`). **Expected:** a message says why and ends "Nothing was changed."; the look and your saved themes stay as they were.
8. Switch to Dark. **Expected:** the original look, unchanged.

## Open issues and follow-ups
- Decision 2 (System) and 3 (the palette).
- C5 and C8 will meet Light too: new motion and the AI view minimum size use the same tokens, so they are covered.
- The pre-existing failing tests listed above.

## Patch
`C-2-themes.patch`, made against the tree after patch C-1. Excludes: `CHANGELOG.md` (the integration owner's), `src/css/*` (old interface).

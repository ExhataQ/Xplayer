# Report UI-A01-A02: foundation start (P0-03, A-01, A-02)

**Agent:** A
**Date:** 2026-10-16
**Status:** Ready for review. Manual checks below are not done yet.

## What changed and why

- **A-01:** design tokens (three layers, three themes, five accent choices), base styles with bundled fonts, and a Lucide icon module. This is the single source of look for every later task.
- **A-02:** a switch that loads the new interface: `--ui=next` or `XPLAYER_UI=next`. Without it the app starts exactly as before. The build now ships `ui-entry.js` and the whole `src/ui-next/` folder.
- **P0-03:** baseline recorded on the board, decisions D1 to D9 recorded as approved.

## Changed files

New:
- `src/ui-next/tokens.css`, `base.css`, `index.html`, `package.json`
- `src/ui-next/fonts/` (6 woff2 files, 2 OFL license files)
- `src/ui-next/icons/icons.js` (generated), `icons/LICENSE-Lucide-ISC.txt`
- `src/ui-next/dev/kitchen-sink.html`, `kitchen-sink.js` (token and icon preview, developer only)
- `electron/ui-entry.js`
- `tools/build-ui-next-icons.js`
- `tools/tests/ui-entry.test.js`, `tools/tests/ui-next-tokens.test.js`
- this report

Edited:
- `electron/window-manager.js` (one require, one `loadFile` line)
- `build/music_player.py` (adds `ui-entry.js` to the copy list, copies `src/ui-next/` to the output)
- `.agent/BOARD.md`, `.agent/PLAN.md` (risk row), `.agent/ui-redesign/DIRECTION.md` (implemented token note, tertiary text value)

## Excluded on purpose

- `tools/CHANGELOG.md`: not edited until you have applied and verified this.
- `tools/tests/README.md` counts (20 unit files, 38 browser files) are now out of date; the runner discovers tests by itself.
- `backgroundColor: '#000000'` of the window: left as is; belongs to the shell task A-03.
- Nothing under `src/js/`, `src/css/` or the current page template.

## Checks

| Check | Result |
|---|---|
| Unit group (`node tools/tests/run.js unit`) | 195 of 195 pass (165 existing, 30 new). Needed `npm i acorn acorn-walk eslint globals` first; the supplied zip has no `node_modules` |
| New tests alone (`ui-entry`, `ui-next-tokens`) | 30 of 30 pass |
| Lint (`node tools/lint.js`) | 137 files, 0 errors, 0 warnings |
| Real build into a throwaway folder (`python build/music_player.py`) | Ran. `App/MusicPlayerOutput/ui-next/` (index, base.css, tokens.css, fonts, icons, dev) and `App/ui-entry.js` were created. node_modules sync and electron launch were skipped (not present in this environment) |
| Rendering in headless Chromium over http | `dev/kitchen-sink.html` loaded with no page errors: IBM Plex Sans 400, 500, 600 and Newsreader 400 loaded, 33 icons drawn, theme and accent switching worked, right-to-left line aligned right. `index.html` rendered. Screenshots were reviewed by eye |
| Contrast | Tested in `ui-next-tokens.test.js` for all three themes: text, dim, tertiary, accent and danger on ground, panel, raised and selected at 4.5:1 or better. This found tertiary text at 4.4:1 on a selected row (preview value `#858A94`); changed to `#8A8F99` |
| Browser test group (`node tools/tests/run.js browser --concurrency=4`) | 286 pass, 0 fail, 1 skipped (287 total). Needed `npm i playwright sharp jimp music-metadata` first. The skipped test was not investigated |
| Real Electron window | Not run: not available in this environment. See the manual checklist |

## Environment

Cloud container (Linux), Node from the container, supplied zip `Xplayer-main_3.zip`. The Windows project folder and the archive folder were not reachable, so the archive step (AGENTS.md section 1) was not done by me. Snapshot your project before applying this patch.

## Manual checklist (needs your Windows app)

1. Snapshot the project, then apply `ui-foundation.patch` from the Source folder (the one that holds `package.json`) with `git apply ui-foundation.patch`, then run the build as you normally do. The patch is a git-style patch because it contains font files.
2. Start Xplayer normally. Expect the same interface as before: library, playback, lyrics all as today.
3. Close it. Start it with the flag: `App\electron.exe App --ui=next` (or set `XPLAYER_UI=next` first). Expect a window with a dark page, a serif headline "The new Xplayer screen is switched on" and a link.
4. Click "Open the design token preview". Expect theme buttons (warm graphite, deep forest, espresso copper), accent buttons, color swatches, type samples and 33 icons. Click through the themes and accents and confirm the colors change and the text stays readable.
5. Check the Persian line near the end of the type section reads right to left.
6. Start normally again and confirm the old interface still loads (the flag is not remembered).

## Follow-ups

- Next on the board: A-03 (shell: title bar, rail, library panel host, player host), A-04 (adapter), A-05 (components).
- Window `backgroundColor` and the loading window still use the old black; decide in A-03 or A-09.
- Persian and other right-to-left text needs a real check in the list and lyrics tasks.

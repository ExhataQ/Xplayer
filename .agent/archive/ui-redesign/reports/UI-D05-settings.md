# Report UI-D05: Settings in the new shell

**Agent:** D
**Date:** 2026-10-17
**Status:** In review. Manual checklist not done yet.

The owner asked D to do whatever A had not delivered and to decide the open questions. D did, within the smallest scope that makes Settings work.

## Decisions taken (also written on the board)

- **D14** closed: D-06 already shipped the interim dialog stylesheet.
- **D16 = S3.** Proven here: the engine's Settings page and its Advanced page run unchanged in the shell's view host and are skinned from outside.
- **D18 = 300 lines** across `store`, `actions`, `events` and `engine-view.js`. Used so far: about 50 (`engine-view.js`; no `store`/`actions`/`events` yet, D-01 will add the first).

## What changed

New:
- `src/ui-next/adapter/engine-view.js`: moves the engine's main content (`.content-wrapper`) into the view host and back. It moves the node (never clones), so every id and cached element of the engine stays valid. It also copies the engine's Theme Color choice to `<html data-accent>` so the swatches in Settings change the whole shell.
- `src/ui-next/adapter/engine-view.css`: the host layout the engine's scroll needs (constrained height, `.content` scrolls, engine scrollbar widget hidden).
- `src/ui-next/views/tools/settings.css`: the skin (sections, rows, buttons, selects, sliders, swatches, folder list, Advanced page, back arrow drawn as a Lucide mask).
- `tools/tests/ui-next-settings.test.js` (5 static, 11 browser).

Edited:
- `src/ui-next/shell/shell.js`: the Settings rail item has `engine: 'settings'`; `showView` calls `releaseEngineView` first, then `showEngineView` for engine views; `init` calls `syncAccentFromEngine`. About 6 lines.
- `src/ui-next/index.html`: three stylesheet links (`engine-view.css`, `dialogs.css`, `settings.css`).
- `tools/tests/ui-next-shell.test.js`: one assertion. The Settings rail item used to show the placeholder heading; it now shows the engine page, so the check reads `.settings-panel-title`.
- `.agent/BOARD.md`: D-05, A-04c, D14/D16/D18, Reports and Blockers rows. No Phase 1 task row besides those.

Not touched: `src/js/`, `src/css/`, `electron/`, `build/`, `components/`, `tokens.css`, `base.css`.

## Design notes

- The engine writes the page with `songList.innerHTML` and sets `display:flex` inline on its list element. CSS overrides that for Settings only, with a selector that does not name the legacy list (gate 13).
- Old token names written inline by the engine (`--bg-hover`, `--bg-card`, `--border`) are given values on the host while Settings is open, because the Advanced slider fill uses them.
- The red Remove Folder / Remove All buttons carry `#ff4444` inline; they are overridden to `--danger` through an attribute selector.
- Theme Color uses the engine's five swatches. ui-next's own default (amber) has no swatch, so a fresh page shows "green" as selected while the accent is amber until the user picks one. See follow-ups.

## Checks

| Check | Result |
|---|---|
| `node --test tools/tests/ui-next-settings.test.js` (headless Chromium, real engine) | 16 of 16 pass |
| `ui-next-dialogs`, `ui-next-shell` (17), `ui-next-components`, `ui-next-tokens`, `ui-entry`, `ui-next-startup` | all pass (shell 17 of 17 after the one assertion change) |
| Screenshots of Settings, top and middle, 1100x800 | reviewed by eye |

The browser tests check: opens from the rail in the host with node identity intact and no page error; scrolls inside the host while the window does not; leaving puts the engine content back in the hidden host and returning works; a checkbox and a select change the real engine settings; a swatch changes the accent, green restores it, and an unrelated body class change does not touch it; buttons are styled and on screen; the Advanced page opens, its back arrow is drawn with no leftover text, the slider moves the engine threshold and Back returns; 800x600 has no horizontal overflow; contrast 4.5:1 for title, section titles, labels, hints, selects and buttons in three themes.

## Not run

- The full `tools/tests/run.js` (over the 5-minute limit of this environment, it was cut off with no output). Only the ui-next test files were run, listed above.
- Electron, real fonts, a screen reader, light themes.
- Folder list with real folders (the fixture has none), the Saved Lyrics list with items, Play History and Search History pages reached from the two top buttons (they still show unstyled engine pages: D-04 area / B).
- Font Awesome icons inside the buttons are still empty (glyph map, B-01 section 10); the labels carry the meaning.

## Environment

Cloud container, Node 22, Playwright 1.56, zip `Xplayer-main (4).zip`. Archive step of AGENTS.md not possible from here: snapshot before applying.

## Manual checklist (Windows app, `--ui=next`)

1. Snapshot, apply patches 0001 and 0002.
2. Click the Settings rail item. Expect the page centered in the main area, sections with rules between them, no raw browser checkboxes colors beyond the accent.
3. Toggle "Minimize to taskbar when closed", close the app window: it minimizes, and the setting is still on after restart.
4. Pick another swatch under Theme Color: the rail indicator, sliders and primary buttons change color. Pick green: back to green.
5. Change Crossfade length with the slider; play two songs, hear the change.
6. Music Library Folders: Add Folder opens the system picker; the list shows the folder; Remove Folder is red outlined; Save and Apply is the filled button.
7. Advanced Settings opens, the back arrow returns, the threshold slider shows its filled part.
8. Click another rail item and come back to Settings: still works, no blank area.

## Follow-ups

- Add an amber swatch (engine change to `initThemeButtons`) or hide the engine swatches and render ui-next's own picker in D-05b.
- `view:changed` handling in the shell: when the engine itself switches views from inside Settings (View Play History), the rail still shows Settings. Needs a rail sync once B maps engine views to rail items.
- `.playlist-hero-section` is hidden for all engine views for now; B will need it back for list views (remove one rule in `engine-view.css`).
- Settings is the first user of `engine-view.js`. D-04 (metadata) and D-01 (lyrics) will use the same call.

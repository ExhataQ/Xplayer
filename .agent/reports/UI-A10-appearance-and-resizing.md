# Report UI-A10: accent themes, resizing, density

**Agent:** A (Claude)  **Date:** 2026-10-19  **Status:** In review. Browser-tested with the real engine; the Windows and Electron checklist below has not been run. Built on top of the A-07 patch (it edits `shell.js` and `index.html` near the same lines).

## What you get

- **Appearance in Settings** (new section, in front of the engine's "Theme Color" block): Theme (Warm Graphite, Deep Forest, Espresso and Copper, each with a small color preview), Accent color (Theme color, green, pink, purple, yellow, white) and Density (Comfortable, Compact). The choice is saved and applied before the first paint, so the window does not flash the default look.
- **One density.** The song list's own "Row height" menu and the Settings control write the same saved choice and follow each other. A density saved by the song list before this patch is adopted once.
- **Resizable library panel.** Drag the panel's right edge (240 to 480 px, saved), or use Left and Right (16 px), Home, End, Enter or double click (reset to 300). It is hidden while the panel is collapsed. A small window only limits what is shown (the view always keeps 420 px); widening the window brings your width back. Under 1000 px the panel still collapses by itself, as before.
- **Resize audit.** A test visits every rail view at 800 x 600, 1000 x 700 and 1400 x 860 and checks nothing scrolls sideways and the title bar, view and player stay inside the window.

## Decisions taken

- **D60.** Theme, accent and density are one saved choice (`xplayer.ui-next.appearance`) applied as `data-theme`, `data-accent` (absent = the theme's own) and `data-density` on `<html>`. The engine's Theme Color swatches only set an old body class and were never saved, so the accent reset on every launch; they are hidden (not deleted) and the engine-to-`data-accent` bridge stays.
- **D61.** Density is global. Today only song rows respond (36 px compact, D24). The library panel's rows have a height the engine reads once at load (`--left-item-height`), so compact panel rows need an engine seam like `setSongItemHeight`; not done, open.
- **D62.** Panel width range 240 to 480, default 300, saved; limited by the window, never by changing the saved value.
- **D63.** No new themes: Midnight Blue, Aubergine and Rose and Porcelain and Teal (light) stay "Later" as DIRECTION.md says.

## Changed files

New: `shell/appearance.js` (state, save, apply, watch), `shell/appearance-boot.js` (classic script in `<head>`), `shell/appearance-settings.js` (the Settings section), `shell/appearance.css`, `shell/panel-resizer.js`, `tools/tests/ui-next-appearance.test.js` (3 static, 15 browser), this report.

Edited:
- `tokens.css`: `--c-accent-own` in each theme block and `--accent-own` (the theme's own accent while another accent is chosen, for the "Theme color" swatch); one block of `--preview-*` tokens so previews stay right while another theme is on. A test checks they equal the real values.
- `shell/shell.js`: 2 imports, the Settings rail item gets `mount: mountAppearanceSettings`, one call `buildPanelResizer(panel)`.
- `index.html`: the boot script and one stylesheet link.
- `views/library/song-list.js` (B's file, 5 small edits, same precedent as the other agents' edits): density starts from the appearance choice, its menu writes it, and it follows changes.
- `tools/tests/ui-next-settings.test.js`: the old engine-swatch test now clicks the hidden swatch programmatically (the bridge is still covered); it cannot be clicked by a person any more.
- `.agent/BOARD.md`: A-10 row, D60 to D63, Reports row.

Not touched: `src/js/`, `src/css/`, `electron/`, `build/`, `components/`, `tools/CHANGELOG.md`.

## Checks (cloud container, Node 22, headless Chromium)

- `ui-next-appearance`: 18 tests, all pass. They cover: defaults; saved choice on `<html>` before any module runs; bad saved values; the Appearance section and the hidden old block; theme changes the real colors, is saved and survives a reload; accent colors and "Theme color" restore; Settings, away and back, three times gives one section; density in Settings, the song list (`--song-item-height` 36 px) and the column menu in both directions; old song-list density adopted; panel drag, keyboard, double click, limits and reload; small window and widening; handle hidden when collapsed; the three window sizes across six views. Also: boot script lists equal `appearance.js`, preview tokens equal the real values, tokens only.
- Every other `ui-next-*` suite passes (23 files; `ui-next-notifications` included), and `node tools/lint.js`: 0 errors, 0 warnings.
- Not run: Electron, the full `npm test`, the archive step (AGENTS.md section 1; the zip was the snapshot).

## Found

1. The accent was never saved in the old UI either; it reset on every start. Now saved.
2. The engine's Settings showed "green" as active while the shell was amber (green was the engine's default, amber is the new one). The hidden block no longer matters; the new control shows the real state.
3. Electron's window `backgroundColor` and the loading window stay near-black (A-01 note). With Espresso and Copper or a light accent there can be a one-frame dark flash when the window opens. Needs `electron/` and a saved theme read in the main process; not done.
4. Accent colors on the three themes meet 4.5:1 (existing token tests); the white accent has dark text on it.

## Manual checklist (Windows app, `--ui=next`)

1. Settings: an Appearance section sits above Right Panel; the old "Theme Color" row is gone.
2. Pick Deep Forest: surfaces turn green-black at once. Pick Espresso and Copper: warm brown. Close and reopen the app: the choice is still there, with no flash of amber.
3. Pick Pink accent: the playing row, progress bar, focus rings and bell dot turn pink. Pick "Theme color" (first dot): back to the theme's accent. Hover a dot: its name shows.
4. Density Compact: song rows become 36 px, no covers. Open the song list's columns button, "Row height": Comfortable. Back in Settings the control says Comfortable.
5. Library: drag the panel's right edge to the right and left; it stops at 240 and 480. Focus the edge with Tab, press Left, Home, End, Enter. Double click resets. Restart: the width is kept.
6. Shrink the window to the minimum: the panel collapses; open it with its arrow: it stays narrow enough that the song list keeps its room. Visit Library, Search, Recently played, Lyrics, Metadata, Settings: nothing is cut off or scrolls sideways.

## Follow-ups

- Compact density for the library panel (needs an engine seam, D61).
- Window background color from the saved theme (item 3).
- `tools/tests/README.md` counts and `tools/CHANGELOG.md` at the end of Phase 3.

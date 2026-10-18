# UI-A06: Phase 1 improvements (reworked)

Owner: A. Status: in review. Not integrated; the changelog is not touched.

This replaces the first version of `ui-phase1-improvements.patch`, which was written against an older tree. It was reviewed and rebuilt on top of A-04c, B-03, B-04, D-01, D-04 and the C playback patch. Only the parts that are still correct and not already done elsewhere were kept.

## What changed

- `shell/shell.js`, `shell/shell.css`:
  - The logo menu is the component `openMenu` (keyboard, focus return, Escape). The logo is the approved X mark from `startup/logo.js` (D19).
  - The bell and the panel toggle are `iconButton`. The panel toggle is a real toggle (`aria-pressed`, tooltip says Open or Collapsed).
  - Every rail button has the component tooltip, placed to the right, and no native `title`. The title bar's back, forward, minimize, maximize and close buttons get the same tooltip.
  - Empty views use `emptyState`.
  - Below 1000 px the panel collapses. The saved choice is kept apart from this, so widening the window brings it back, and toggling inside a narrow window is not saved.
  - Duplicate icon-button rules and the old logo menu rules are removed; forced-colors rules added for the rail and pressed toggles.
- `components/tooltip.js`, `components/button.js`: `placement: 'right'`.
- `components/dialog.js`: keys inside a dialog no longer reach the engine's global shortcuts (space, m, s, arrows).
- `electron/window-manager.js`: window background `#0e1013` for ui-next (Warm Graphite), so the window does not flash black before the page paints. Other themes differ by a few shades; the flash is about the first frame only.
- `adapter/legacy-overlays.css`: the submenu arrow of the engine's context menus is drawn again (the file hides all Font Awesome icons, which included it).
- Shell: the rail no longer jumps to Library when the Search view shows the engine's all-songs list (integration fix between A-04c and B-04), and cancelling "leave Metadata" no longer makes the shell navigate the engine (D and A-04c integration).

## Dropped from the first version, and why

| Dropped | Reason |
|---|---|
| `adapter/player-a11y.js` | C's `views/playback/transport.js` already gives the seek and volume sliders roles, values and tooltips. The dropped file listened on the page's `#audio`, which goes idle under gapless playback (ENGINE-CONTRACT section 15), so it stopped updating after the first track change. Home, End, PageUp and PageDown on the sliders are not done; the engine's Left, Right and Ctrl+Up, Ctrl+Down shortcuts remain |
| `shell/engine-overlays.css` | Duplicates `adapter/legacy-overlays.css` (D14, approved). It also hid every engine tooltip although the tooltip rollout (A-08) has not replaced them yet |
| `--layer-dialog` token | Only the dropped file used it |
| Tooltips on the player's buttons from the shell | C does these |
| Its answers to D14 to D18 | The owner has approved them differently; see the board |
| Its `shell.css` hunk | It merged two rules and removed `-webkit-app-region: no-drag` from the title bar buttons, which would make them unclickable in Electron |

## Tests

- `ui-next-shell.test.js`: logo menu test updated; new tests for tooltips (right placement, no native title, title bar button), narrow window and saved choice, and the submenu arrow.
- `ui-next-search.test.js`: new test that the rail stays on Search when the engine switches to all-songs (fails without the guard in `shell.js`).
- `ui-next-components-behavior.test.js`: keys inside a dialog do not reach the page.
- All ui-next test files, `ui-entry`, `output-dir`, `main-process-safety`, `audio-bytes`, `desktop-api` and `seek-volume` pass in headless Chromium. `lint`, `window-contract` and `ui-views-module` could not run here (no `acorn` offline); run them on your machine.

## Not run or not verified

- Real Electron: window background flash, `-webkit-app-region` with the new menu, DPI scaling.
- Windows High Contrast, Narrator, NVDA: the forced-colors rules are written from the specification only.
- axe-core was not added (D34).
- Not done on purpose: D-3 fix, `show:false` with `ready-to-show`, `titleBarOverlay`, missing Lucide icons.

## Apply

Snapshot first. This is part of the combined patch; apply it with `git apply`. Manual check with `--ui=next`: click the X logo (menu opens, Escape closes and returns focus); hover a rail icon (tooltip to the right); shrink the window below 1000 px (panel collapses), widen it (it returns); open a song's context menu with a submenu (arrow visible); start the app and watch for a black flash.

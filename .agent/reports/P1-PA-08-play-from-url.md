# P1-PA-08: Play from URL in the title bar, animated

Agent A, 2026-10-24. Status: in review. Brief 10.1.

## What changed
- **Button:** a small icon button named "Play from URL" (tooltip too) at the start of the title bar's tools, before the right panel, AI chat and bell buttons. It opens the engine's own dialog (`showAddLinkDialog`), the one the File menu and Home already use, so the engine still owns the URL, the save-to-folder choice and the playback.
- **No new adapter code:** it calls `showPlayFromUrl()` from `adapter/menu-bridge.js` (added in PA-07). The DP9 budget is unchanged.
- **Icon:** a chain drawn as two separate halves (`link` in `icons/custom-icons.js`), so each half can move on its own.
- **Animation:** on hover or keyboard focus the two halves pull apart, click back together a little past closed, and settle where they started (620 ms, once, no looping). Pressing the button shrinks it slightly. Off with reduced motion; the button still works.
- Files: `shell/url-button.css` (new, linked in `index.html`), `shell/shell.js`, `icons/custom-icons.js`.
- Tests: `ui-next-url-button.test.js` (7: static tokens and keyframes, wiring, place in the bar, opens and closes the dialog, hover motion once and back, reduced motion, keyboard). `ui-next-tooltips.test.js` had one test that still expected Settings to open on Appearance (stale since the Settings pages); it now opens the General page first.

## Checks
Rail, notifications, AI slots, phase 1 gate, shell, app menu, right panel, startup and tooltips suites: all pass with the tooltip fix (126 tests). Screenshot at rest and on hover checked. Not run on real Electron.

## Not done
- If the engine is not ready the button does nothing (the same as the menu entry).
- No shortcut was added for it; the brief does not ask for one.

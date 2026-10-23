# Report: PA-02 + PA-05 Tooltips and window buttons

**Task:** PA-02, PA-05 | **Agent:** A | **Date:** 2026-10-21 | **Status:** In review

## Summary
PA-02: tooltips open after 250 ms (was 500), flash briefly in the accent when they open, show the hotkey as key caps, are smaller, and the three window buttons no longer have tooltips. PA-05: the window buttons are separated from the bell by a larger gap and a thin divider.

## Findings (investigations)
- `TOOLTIP_DELAY = 500` in `components/tooltip.js` was the only delay; the "warm" hand-over between neighbours (300 ms window) is unchanged. *Read, confirmed by the test run.*
- `tooltipTitlebarButtons()` in `shell/shell.js` attached tooltips to `.window-control-btn` and `.close-app-btn`; `shell/tooltips.js` does not cover them. *Read.*
- The old `.titlebar__window` had only `margin-left: var(--space-2)`, so the bell sat next to the minimize button. *Read, seen in a screenshot after the change.*

## Changed files
| File | Change |
|---|---|
| `src/ui-next/components/tooltip.js` | Delay 250 ms; the shortcut is split on `+` into one `.tooltip__key` per key; header comment updated |
| `src/ui-next/components/components.css` | Smaller padding, gap and line height; key-cap style; accent flash animation (three keyframes by placement); no raw colors, tokens only |
| `src/ui-next/shell/shell.js` | Tooltips only for `.nav-btn` in the title bar |
| `src/ui-next/shell/shell.css` | Gap and 16 px divider between the bell and the window buttons |
| `src/ui-next/dev/components-gallery.js` | The static tooltip sample renders key caps too |
| `tools/tests/ui-next-shell.test.js` | The old assertion "Close app tooltip appears" now asserts that no tooltip appears |

## Decisions made or needed
- Delay chosen: 250 ms. Existing tests wait 150 ms to check "not yet", so 250 keeps them valid. Owner: say if it should be shorter (Discord is about 200 ms).
- A shortcut such as `Ctrl+Shift+S` becomes three key caps; a single key stays one cap.

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/ui-next-tooltips.test.js` | 17 of 17 passed |
| `node --test tools/tests/ui-next-components-behavior.test.js` | 64 of 64 passed (before the CSS keyframe refactor; the refactor touches only CSS) |
| `node --test tools/tests/ui-next-components.test.js` | 26 of 26 passed (first run failed on a custom property `--tooltip-rise`, removed) |
| `node --test tools/tests/ui-next-playback.test.js`, `ui-next-player-bar.test.js` | 17 of 17 and 8 of 8 passed |
| `node --test tools/tests/ui-next-shell.test.js` | 20 of 20 passed |
| `node tools/lint.js` | 0 errors, 0 warnings (139 files) |
| Headless Chromium screenshots (tooltip on Shuffle, title bar) | Key cap shown; divider between bell and window buttons; hovering the close button shows no tooltip |

## Not run
- Real Electron on Windows. The flash is brief (120 ms) and cannot be judged from a still screenshot.
- The full suite (`npm test`); only the files above were run.
- Reduced motion: handled by the global rule in `base.css`, not tested separately.

## Environment
Linux container, Node v22.22.0, headless Chromium through Playwright. No Python.

## Manual checklist for the owner
1. Open the app with `--ui=next`, hover the Shuffle button in the player bar. Expected: a small tooltip with "Shuffle", "Off" and an "S" key cap appears after about a quarter of a second, with a brief accent glow.
2. Move across neighbouring buttons. Expected: the next tooltip opens at once.
3. Hover minimize, maximize and close. Expected: no tooltip.
4. Look at the top right. Expected: the bell, a small gap with a thin vertical line, then the window buttons.
5. Turn on reduced motion in Windows. Expected: no flash.

## Open issues and follow-ups
- The flash color uses the accent; check it against every theme in PA-14.
- Tooltips of the engine's own `title` text are unchanged.

## Patch
`P1-A-wave1-tooltips.patch`. It excludes `tools/CHANGELOG.md` (the integration owner edits it after verification) and the board status change.

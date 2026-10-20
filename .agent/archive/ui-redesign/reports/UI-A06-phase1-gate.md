# UI-A06: Phase 1 gate (and A-01 confirmation)

**Owner:** A. **Status:** Automated gate added; local verification and manual Electron click-through pending. **Date:** 2026-10-17.

## What changed and why

| File | Change |
|---|---|
| `src/ui-next/adapter/legacy-overlays.css` | New. Interim look for engine-created overlays (shuffle and playlist dialogs, context menus and submenus, overlay shells). Tokens only. Decision D14 (register L-10) |
| `src/ui-next/index.html` | Links the file above |
| `src/ui-next/icons/icons.js`, `tools/build-ui-next-icons.js` | Added `info`, `circle-check`, `triangle-alert` (36 icons). Closes the A-05 icon gap |
| `src/ui-next/components/toast.js` | Toast kinds use `info`, `circle-check`, `circle-alert` (the bell stays the notification center button) |
| `src/ui-next/components/tooltip.js` | Bug fix: `lastHiddenAt` started at 0, so a tooltip in the first 300 ms after page load skipped its delay. Now `-Infinity` |
| `tools/tests/ui-next-phase1-gate.test.js` | New, 11 tests: boot and play, dialog drawn inside the window and closing from its overlay, dialog contrast in 3 themes, context menu and submenu on screen, resize across 5 sizes shrinking and growing with playback uninterrupted, a dialog at 800x600, old UI starts and plays and requests nothing from `ui-next`, every named icon exists, toast icons, overlay css uses tokens only |
| `tools/tests/ui-next-components-behavior.test.js` | Tooltip tests park the pointer before mounting. A pointer left from an earlier test caused a late `pointerenter` that reopened the tooltip after Escape (flaky, about 1 run in 2) |
| `.agent/BOARD.md`, `.agent/ui-redesign/ENGINE-CONTRACT.md` | Board brought in line with the tree; L-10 and the decision list updated; D19 and D20 (A-09) and D14 (overlays) no longer collide |

A-01 confirmed: tokens, base CSS, 6 font files with 2 OFL licenses, icon module, and the token tests (contrast and defined variables).

## Excluded on purpose

`tools/CHANGELOG.md` (integration owner), `tools/tests/README.md` counts, anything under `src/js/`, `src/css/`, `electron/`, `build/`. The editor and metadata overlay insides stay unstyled until D-03 and D-04. The startup view and X logo are not wired into the shell yet (A-09, Phase 3).

## Checks

| Check | Result |
|---|---|
| `ui-next-phase1-gate.test.js` | 11 of 11 pass |
| Mutation: overlay stylesheet unlinked | 5 of 11 fail, as intended; restored |
| Touched test files together (tokens, entry, components static and behavior, shell gate, startup, startup-setting, seek-volume, phase1 gate) | 159 of 159 pass |
| `ui-next-components-behavior.test.js` after the two fixes | 63 of 63, 8 runs in a row |
| Full suite (`node tools/tests/run.js --concurrency=4`), run before the tooltip fixes | 611 tests, 607 pass, 1 fail (the flaky tooltip test, fixed above), 3 skipped: 2 lint tests (ESLint not installed) and 1 timing-sensitive scroll test the suite marks as skipped in sandboxed environments. Not re-run in full after the fixes |
| Screenshots of the shuffle dialog and a context menu with submenu in the new shell | Reviewed by eye, Warm Graphite theme only |
| `node tools/lint.js` | Not run: ESLint is not installed in this environment and there is no network. `node --check` passed on every edited JS file |

## Environment

Cloud container (Linux), Node 22, Playwright 1.56 with Chromium 141 from a global install, `acorn` taken from a global package, `jimp` and `music-metadata` missing. The Windows project and archive folders were not reachable, so the archive step (AGENTS.md section 1) was not done by me.

## Manual checklist (Windows app, `App\electron.exe App --ui=next`)

1. Play a song. Click Shuffle, choose Normal Shuffle. Expect a centered dialog, then the Shuffle button marked active.
2. Resize from the minimum size to maximized and back. Expect the player to stay at the bottom, no horizontal scroll, playback uninterrupted.
3. Click window drag, minimize, maximize, close, back and forward.
4. Start without the flag. Expect the old interface unchanged.
5. Switch to Deep Forest and Espresso and Copper if a switcher is reachable; otherwise skip (themes are covered by the contrast test).

## Follow-ups

- Re-run `node tools/build-ui-next-icons.js` with the real Lucide files when available; the three new icons were taken from the Lucide data in the `react-icons` package and match the vendored `circle-alert`.
- The old Font Awesome icons inside engine context menus are hidden by the interim stylesheet (no icon font in ui-next); real icons arrive with the owning tasks.
- D-3 (volume change during a new track's fade-in is overwritten) is still open.
- Run the full suite once after applying this patch.

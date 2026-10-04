# Agent D report 0008: theme switcher as an ES module (D-07)

Step: D-07 (Phase 4). Applies on top of: `Xplayer-main_2_.zip` **with D-0007 (D-05) applied first** (both touch `src/manifest.json` and `tools/change.log.txt`, so apply them in that order).
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup\...` is not reachable from my environment. Nothing in the zip was changed; the patch is the only deliverable.
D-06: not touched, as asked.

## Changes

- `src/js/06i-theme-switcher.js` is now an ES module:
  - `export function initThemeButtons(doc = document)` and `export function themeClickHandler(e)`.
  - It ends with `if (typeof registerLegacyGlobals === 'function') registerLegacyGlobals({ initThemeButtons });`, as `core/LEGACY.md` asks. Only `initThemeButtons` is registered: it is the one name classic files call (`08e-panel-settings.js:259` and `99-player.js:140`). `themeClickHandler` was only used inside `06i` itself.
  - Behavior is the same. The only code differences: `document` became the `doc` parameter (defaults to `document`, so the two classic callers work unchanged), and the click handler reads the document from `this.ownerDocument`. Nothing reads the page at the top level, so Node can import the file.
- `src/manifest.json`: `06i-theme-switcher.js` moved from `"js"` to `"modules"` (last entry).
- `tools/tests/theme-switcher.test.js` (new): 5 Node tests with a fake document (imports without a DOM, one listener per button even after repeated init, active button, body class and aria-label, switching and green, unrelated body classes untouched) and 1 browser test (Settings draws the 5 buttons, each click switches the theme once and stops at the button, and redrawing Settings still works).
- `tools/tests/converted-modules.test.js`: `initThemeButtons` added to the registered-names list (step 4 of the conversion recipe).
- `tools/change.log.txt`: entry added.

## Why the move is safe

- **Load order:** modules run after every classic script and before `DOMContentLoaded`. Both callers run later than that: `99-player.js:140` is inside the `DOMContentLoaded` handler (and finds no buttons yet, because only Settings draws them), `08e:259` runs when Settings is opened.
- `node tools/dep-map.js`: load-time cross-file references stay at 28 (forward references that would break: 0), and none points at `06i`. `initThemeButtons` is used from `08e` and `99-player` only.
- `tools/event-allowlist.json` already lists `initThemeButtons` under `setup`; no change needed. `event-audit --strict` exits 0.

## Proof that behavior did not change

The browser test is written against what the user sees, so I ran it on **both** versions: it passes on the old classic `06i` (before) and on the module (after). The 5 Node tests only apply to the module (the old file has no exports).
Sabotage checks (restored afterwards): (1) without the `registerLegacyGlobals` entry, the browser test fails, and so do 3 tests in `converted-modules.test.js`; (2) without `e.stopPropagation()`, 2 tests fail.

## Tests actually run (Chromium via Playwright; `NODE_PATH` pointing at the global modules and `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`)

- `theme-switcher`, `converted-modules`, `manifest`, `legacy-bridge`: 36 tests, 36 pass.
- Full suite on the stacked tree (this patch on D-0007), `node --test tools/tests/*.test.js`: **200 tests, 198 pass, 0 fail, 2 skipped** (both skips are written into the tests themselves: a timing-sensitive scroll test and a storage test for a moved function; neither is mine). 23 of the 200 are new from D-0007 and D-0008.
- Not run: the app in real Electron.

## Needs from other agents

- **A:** nothing. The status line in `core/LEGACY.md` ("No inline handler has been converted yet") is still stale after D-0007; yours to update.

## For you (manual checks)

1. Run `node --test tools/tests/theme-switcher.test.js tools/tests/converted-modules.test.js` (or the full suite) -> 0 failures.
2. Open the app, then Settings. Click each of the five themes: the colors change, the clicked button is highlighted, and only one button is highlighted at a time.
3. Click Green: the app returns to the default colors.
4. Leave Settings and come back (also via History and Back): the theme stays, and the buttons still work.
5. Console: no errors, in particular no `initThemeButtons is not defined`.

## Next step

D-05 (second slice) waits for A's "stop here" mode in the bridge. D-06 waits for A-14. D-08 waits for A-13 (patch received) and A-14. Mark D-07 `applied + verified` in `.agent/BOARD.md` after your checks.

# Agent C report 0005: real-ESLint test, remaining sleeps, README, duplicate check

Steps: C-01 (duplicate check), C-04 (undefined-name test), C-05 (sleeps, README). Applies on top of: Xplayer-main4.zip (the tree with C-0001 to C-0004, B-0001 to B-0005 and D-0001 to D-0005 applied).
Archive (.agent/AGENTS.md section 1): not done. `E:\Backup\Programming\Music player` is not reachable from this session. I worked on an unzipped copy and kept an untouched copy next to it; the result is the patch `C-0005-lint-real-eslint-sleeps-readme.patch`. Take your own snapshot before you apply it.

## Changes

- tools/tests/lint.test.js: new describe "tools/lint.js with the real ESLint and the real eslint.config.js" (2 tests). It copies `tools/` (without the tests), `eslint.config.js`, a manifest, a `main.js` that imports the file that publishes `updateExternalScrollbar` and a probe file into a temp dir, links `node_modules`, and runs `tools/lint.js`. An undefined name exits 1 and prints `no-undef`; `[updateExternalScrollbar, document, window]` exits 0 with "0 error(s), 0 warning(s)". Both skip when `eslint` or `globals` cannot be resolved. Header comment updated.
- tools/tests/search-ui.test.js: `typeSearch` waits for `searchQuery` to hold the typed text instead of 450 ms (the search is debounced 300 ms; `searchQuery` is set first in `performSearchNow`, which then runs to the end in the same task).
- tools/tests/context-menu.test.js: the 100 ms after `setViewportSize` is a bounded `waitForFunction` (menu right edge inside the window, 2 s, the assertions after it report a miss). The test now right-clicks the far-right `.song-duration` cell: from the title cell the menu was already inside a 700 px window, so the test passed with the resize handler removed (shown below).
- tools/tests/startup-gate.test.js: the 1200 ms after load is `whenAppReady(resolve)` run in the page. It is queued behind the early messages, so it resolves after every one of them has been applied.
- tools/tests/lyrics-panel-handlers.test.js: the 300 ms after `await openMetadataEditor()` (an async function the evaluate already waited for) is `input.waitFor()`; the 100 ms after clicking the header title is removed, the handler is synchronous (comment says so).
- tools/tests/ui-leaf-modules.test.js: `goto` + 600 ms is `gotoApp` (shared fixture); the 1200 ms hover wait is a bounded `waitForFunction` for the tooltip with text "Shuffle" at opacity 1 (5 s; the assertion after it reports a miss).
- tools/tests/app-fixture.test.js: nothing to change, its only `waitForTimeout` mentions are comments.
- tools/tests/README.md: unit and browser lists and counts match `npm run test:list` (57 files, 19 unit, 38 browser); `SEQUENCE_PAGES` row and the opt-in sentence in section 11 fixed (B asked for this in report 0005); 1 hard-coded skip instead of 2; gate-file paragraph no longer talks about the module conversion; maintenance section says which test owns which fact (manifest, window-contract, order tests, ui-handlers, lint); lint section mentions the real-ESLint tests; section 11 marked historical; new section 12 with the numbers below. No mention of `tools/spike-modules/` or `tools/test-shuffle/` (there was none).
- .agent/BOARD.md, tools/change.log.txt: updated.

## C-01: duplicate assertions (what was actually done)

A script went over all 57 test files for repeated test titles (none) and for repeated assertion lines longer than 45 characters. Flagged sites: `context-menu` 46/52, `drag-drop` 79/232, 160/228/297, 259/299/308, `keyboard-shortcuts` 157/160, `main-process-safety` 109/123, 164/169, `modal-close` (Enter/Escape in 8 and 6 different dialogs), `output-dir` 37/54, `playback-handlers` 117/132, 128/145, `shuffle` 34/72, `songs-store` (6 tests), `storage` 65/97. I read `keyboard-shortcuts`, `output-dir`, `playback-handlers` and `main-process-safety` in context; the others are the same pattern (a state before and after an action, or the same check in a different scenario or dialog). Nothing was removed: each repeat checks a different moment. This is not a line-by-line read of all 57 files; a test that asserts something another file asserts with different wording would not show up in this scan.
The one hard-coded skip left is `scroll.test.js` "a tiny thumb nudge shows real rows only, no placeholders" (marked timing-sensitive; B-02 owns the file). `storage.test.js` has none.

## Numbers

Environment: Linux sandbox, 1 core, Node v22.22.0. `node_modules` is not the real install (the npm registry is blocked here): ESLint 10.1 instead of ^9, Playwright 1.56.1 instead of ^1.63, `globals` generated from Chromium and Node names, no `sharp`/`jimp`/`music-metadata`. Run `npm install` on your machine and repeat the lint and fixture runs once.

Six edited files plus `app-fixture`, three runs in a row (`node tools/tests/run.js context-menu search-ui startup-gate lyrics-panel-handlers ui-leaf-modules app-fixture.test`): 34 tests, 34 pass, 0 fail, 0 skipped each time.
Full suite, `npm run test:timing`: 57 files, 444 tests, 443 pass, 0 fail, 1 skipped, 472 s (slowest: scroll 66 s, events-b 40 s, events-wiring 40 s, events-c 38 s).
`node tools/lint.js --strict --summary`: 136 files, 0 errors, 0 warnings.
`node tools/event-audit.js --strict`: exit 0, total 0 (plus 70 allowed by fileExceptions).
`node tools/dep-map.js`: 115 files, mutable globals assigned from other files 58, file-level cycles 2 + 69, load-time cross-file references 148 (forward 0). Unchanged from report 0003.

## Tests actually run

- Mutation checks (each reverted, the tree compared with the untouched copy afterwards): `no-undef` set to `off` in `eslint.config.js`: lint.test fails (1, the undefined-name test). Window `resize` listener renamed in `06a-context-menus.js`: with the old click position the context-menu test passed (4 of 4 plus the resize test), with the new position it fails (the resize test). Tooltip opacity `1` changed to `0.9` in `06d-tooltip-system.js`: ui-leaf-modules fails (1, the tooltip test).
- Not mutation-checked: the `searchQuery` wait in `search-ui` and the `whenAppReady` wait in `startup-gate` (both are waits, the assertions after them were not changed).
- Not run: the real Electron application, `npm run lint` with ESLint 9 (see above), Windows.

## Needs from other agents

- B (B-06): the README sections 3 and 10 still describe today's commands and CI. When B-06 adds commands or changes `.github/workflows/test.yml`, they must be re-read against it. B did not report yet.
- D: `search-clear.test.js` line 37 has a 150 ms `waitForTimeout` after a debounced search. It is D's file; the same `searchQuery` wait as in `search-ui` would replace it. Not changed by C.

## Not done

- C-01: no line-by-line read of every test file (see above).
- C-05: waits for B-06 only for a final read of the README.
- B's optional suggestion (load the app once per file in `render-modules`, `ui-views-module`, `ui-virtual-scroll-modules`, `converted-modules`, `playback-handlers`) was not started; each needs a look at whether its tests share state.

## For you (manual checks)

None; no application behavior changed. On your machine: `npm install`, then `node --test tools/tests/lint.test.js` (12 tests, 0 skipped with ESLint installed), then the six files above, then `npm run test:timing` once and compare with section 12 of the README.

## Next step

C-05 closes after the B-06 report. Phase 2 can start when B-03, B-05 and B-06 are also applied + verified.

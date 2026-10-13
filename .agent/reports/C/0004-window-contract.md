# Agent C report 0004: one window-contract test

Steps: C-02. Applies on top of: C-0003-order-checks-and-tool-tests.patch (which applies on 0002 and 0001; all four append to `tools/change.log.txt`, so apply them in order).
Archive (.agent/AGENTS.md section 1): not done. `E:\Backup\Programming\Music player` is not reachable from the sandbox I worked in. I worked on an unzipped copy of Source-backup.zip and changed nothing in your project; the result is this patch. Take your own snapshot before you apply it.

## Changes

- New `tools/tests/window-contract.test.js` (11 tests, one page load):
  - static, acorn, no browser: every data-action name is literal and registered (moved as it was from `legacy-bridge.test.js`); a module registers only names it declares (an exported function or a top-level variable); every exported name that another module, the page template, `99-player.js` or `electron/` uses by bare name is registered by its file; the 14 shared constants and state objects are registered (`REQUIRED_SHARED`); every function an inline `on...=` handler calls is registered.
  - one page load: no page error; the names the page registered (`legacyGlobalNames()`, 720 of them) are exactly the names the sources register, none missing and none extra; each exported function is a function on window and every other registered name has a value; `updateExternalScrollbar` (published by assignment, listed in `tools/lint-globals.js`) is a function; the registered constants keep their values.
  - The name lists are read from the sources, so adding a function to a module needs no edit here. Only `REQUIRED_SHARED` and the constants table are written by hand, because the sources cannot say which non-exported constants other files read.
- The ten files below lose only the repeated name and page-error-at-load checks; every behavior test stays. Header comments are updated and no longer name an agent or step.
- `tools/change.log.txt`: one entry.

## What was removed, and what covers it

| File | Removed | Covered now by |
|---|---|---|
| converted-modules | `REGISTERED` (150 function names, `typeof === 'function'`) and its test "all names the classic scripts call are registered ... no page errors" | Static "every exported name ... used by another file is registered", page "exported function is a function on window", page "registered names are exactly the sources' names". All 150 names are in the derived set (checked by script: 0 missing). |
| converted-modules | the four constants and their values | window-contract "registered constants keep the values" (moved as written) |
| converted-modules | last test: exported functions used outside and functions an inline handler calls are on window, no page errors | The two static tests above plus "every function an inline handler calls is registered"; page load test |
| electron-injected-names | "each name is a global function after start-up" | Same static and page tests: `electron/` is in the "used outside" set, and `updateDownloadNotification`, `showWelcomeDialog`, `recalcLayoutWidths` are in the derived set. The three behavior tests and the "still referenced by electron/" test stay |
| legacy-bridge | the two static data-action tests | moved unchanged to window-contract |
| legacy-bridge | "the page loads with the bridge and its API is on window" (5 `typeof` checks) | `core/legacy.js` registers its own API; the page test compares every registered name |
| ui-leaf-modules | "registered names are on window, and the implicit global is now a window property" (13 names + `updateExternalScrollbar`) | derived tests above; "names published by assigning window.<name>" for `updateExternalScrollbar` |
| ui-views-module | static "guarded registration lists every exported function other files use, plus VIEWS and listProviders"; the `missing` check in the page test | static "every exported name ... is registered", `REQUIRED_SHARED` for `VIEWS` and `listProviders`. The test keeps the `VIEWS` values |
| ui-core-render-module | static "guarded registration lists ... plus selectedSongIds"; the `bad` check in the page test | same two; `selectedSongIds` is in `REQUIRED_SHARED`; the test keeps the identity check `window.selectedSongIds === selectedSongIds` |
| ui-virtual-scroll-modules | the registration lines of the per-file test (kept: "no function is left unexported"); the `missing` check; the `FILES` table of shared names | same two; the 11 shared names are in `REQUIRED_SHARED` |
| render-modules | the registration lines of the per-file test (kept: exported set and "no unexported function"); the test "every name is a function on window and start-up completes" | derived tests and the page-load test |
| drag-drop-modules | the guarded-registration regex; the whole page describe (it had only this check) | static and page tests for `initSongDragToLeftPanel` and `initLeftPanelDragAndDrop` (used by `99-player.js`) |
| playback-modules | "every exported function of the playback modules ... is on window, with no page errors" | derived tests and the page-load test |

The `assert.deepEqual(errors, [])` at the end of a behavior test is kept: it checks that the behavior itself threw nothing. Only the page-error check of a test that did nothing else is removed.

## Where the new test is weaker on purpose

- "Registers exactly the exported names" (render-modules, drag-drop-modules): now "registers only what it declares" plus "registers what another file uses". An exported function that nobody else uses may stay unregistered, and registering one is not an error. This is the rule `core/LEGACY.md` states.
- "Registers only exported names" (ui-core-render-module): a non-exported top-level `const`/`let` may also be registered. The state objects need that.
- The exact guarded form `if (typeof registerLegacyGlobals === 'function') { ... }` (drag-drop-modules) is no longer checked; the test still asserts the file has only the export and one `if` statement.
- "More than 3 inline handler functions found" (converted-modules) is gone: handlers are being converted, so that count only shrinks and the guard would fail when it reaches zero.
- "Used outside" used to include `tools/` and the tests, so a name that only a test mentioned had to be registered. It now means what the page needs: other modules, the template, `99-player.js`, `electron/`.

## Numbers

Counted with a counter added to a scratch copy of `app-fixture.js` (not in the patch), one `node --test` per file. Before is the tree with patches 0001 to 0003; the original backup is 44 page loads.

| | Before | After |
|---|---|---|
| Tests in the 12 files | 88 | 87 (12 removed, 11 new) |
| Page loads | 41 | 34 |
| Files that start a browser | 11 | 11 |
| Run time of the 12 files (`run.js --timing`, two runs) | 68.8-72.7 s | 55.3-57.4 s |

Per file, tests and page loads: converted-modules 5/4 to 3/2; electron-injected-names 5/4 to 4/3; legacy-bridge 15/13 to 12/12; ui-leaf-modules 7/4 to 6/3; ui-views-module 9/2 to 8/2; ui-core-render-module 7/1 to 6/1; ui-virtual-scroll-modules 10/2 to 10/2; render-modules 13/3 to 12/2; drag-drop-modules 5/1 to 4/0; playback-modules 6/6 to 5/5; event-subscribers-modules 6/1 to 6/1 (unchanged); window-contract 0/0 to 11/1.

**The "fewer test files start a browser" condition is not met: it is 11 before and 11 after.** `drag-drop-modules.test.js` no longer starts one (it is now a unit test, `run.js` shows `unit`) and `window-contract.test.js` starts one. Every other file keeps real behavior tests that C-02 says to keep, so none of them can stop. The gain is in page loads (7 fewer) and tests that stand on their own; if you want fewer files, the way is to move a behavior test, which this step does not do.
`node tools/dep-map.js` and `node tools/event-audit.js --strict`: not re-run for this patch; it touches only test files and the earlier runs (reports 0001 and 0003) cover the same source.

## Tests actually run

- `node --test` on each of the 12 files: all pass, none skipped (87 tests).
- Spot checks, each in a scratch copy through `SOURCE_ROOT`; the new test fails in each case (unregistering the name):

| Removed registration | Old test that checked it | New failure |
|---|---|---|
| `showWelcomeDialog` (06b) | electron-injected-names | "every exported name ... is registered" |
| `initLeftPanelDragAndDrop` (06g) | drag-drop-modules | same, plus the page load |
| `toggleMute` (15g) | playback-modules | same |
| `showNotification` (06j) | ui-leaf-modules, converted-modules | same |
| `renderLyricsView` (04g) | render-modules | same |
| `recalcLayoutWidths` (01-sizes) | electron-injected-names | same, plus the page load and the published-names test |
| `ITEM_HEIGHT` (05a; shared constant, not exported) | ui-virtual-scroll-modules | "the constants and state objects ... are registered", plus the page load |

- More checks of the new test: a name registered that the file does not declare (fails the static test, and the page throws while loading, so the four page tests fail too); a registration the page never runs, written as `if (window.__neverSet) registerLegacyGlobals(...)` (fails the two page tests that compare the sources with the page); a data-action name nobody registered (fails); `doImportMerge` unregistered, which only an inline `onclick` calls (fails the inline-handler test); `MAX_HISTORY_ENTRIES` 500 changed to 400 (fails the constants test). A file name in `REQUIRED_SHARED` that is not a module fails with a message naming it.
- Two of my first mutation attempts changed nothing (CRLF line endings, then a wrong file); I noticed from the unchanged results, fixed them and reran. The results above are from the corrected runs.
- Not run, and why: `npm run lint` (ESLint is not installed in my sandbox); the full suite (the plan says not to).

## Needs from other agents

- A: when A-03 moves files, the 14 names in `REQUIRED_SHARED` are keyed by file name (`05a-lazy-load-main-list.js`, `07-views.js`, `04a-ui-render-core.js`, ...). The test fails with a message naming the file if a key is stale.
- Whoever owns `tools/tests/helpers/`: `helpers/bridge-use.js` is now used by no test; only a sentence in `src/js/core/LEGACY.md` mentions it. I left both alone. It can be deleted with that sentence, or kept; tell me which.

## Not done

- `event-subscribers-modules.test.js` is in C-02's list but has no name-registration or window check (it records listener and bus order), so nothing was removed there; patch 0003 already cut its page loads from four to one.
- The scan finds names in comments or strings too (whole-word match), so it can only over-ask for a registration, never miss a use. None of the 720 names is affected today.
- The test-name prefixes `D-09b:`, `D-09c:`, `D-09e:` in `describe(...)` titles of three files are left; they are output labels, not comments.
- `npm run lint` is the other net for these names (`no-undef` with globals built from the registrations); I could not run it here.

## For you (manual checks)

None; no application behavior changed.

## Next step

C-05 (the sleeps in my own files, then the README), after the B-06 report.

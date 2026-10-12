# Plan 3: cleanup and test upgrade (4 agents)

Goal: before the UI work starts, remove what is dead, finish the small leftovers the refactor postponed, make the test suite faster and less repetitive, and put the renderer files into folders. No new features, no UI change.

The refactor plan (setters, event bus, ES modules, the final flip) is finished and archived in `.agent/archive/refactor/` (plan, board and all reports). The renderer is ES modules loaded from `src/js/main.js`; the smoke checklist and a real Electron run passed on the final tree.

## 1. Baseline (measured 2026-10-12, Linux sandbox, `npm run test:timing`, one file after another)

| Number | Value |
|---|---|
| Test files / tests | 55 / 459 (457 passed, 0 failed, 2 skipped) |
| Whole suite, one file at a time | 542 s (18 unit files 28 s, 37 browser files 514 s) |
| Slowest five | `events-b` 64 s, `scroll` 63 s, `events-c` 56 s, `events-wiring` 37 s, `modal-close` 36 s (about half of the total) |
| `online-metadata.test.js` (a unit test) | 23 s: real backoff sleeps, no browser |
| Fixed sleeps (`waitForTimeout`) | 42 (28 in `scroll.test.js`, 5 in `view-switch-song-list-cleanup.test.js`) |
| Lint | 0 errors, 1 warning (`currentContextPlaylistId` unused in `06a`) |
| `node tools/dep-map.js` | 115 files; load-time cross-file references 27, none forward; mutable globals assigned from other files 58; file-level cycles 2 + 69 |
| `node tools/event-audit.js --strict` | exits 0 |
| Loose files in `src/js/` | 92 (plus `main.js` and the `99-player.js` template) |

Run `npm run test:timing` and `node tools/dep-map.js` at the start of your session and again at the end; the report records both. Your machine will be slower or faster than the sandbox: compare your own before and after, not these numbers.

## 2. What is in this plan and what is not

In: the real bug in `08h`, the duplicate refreshes and the other leftovers from the refactor, dead files, stale docs, test speed, test repetition, and the folder layout.

Left out on purpose (not important enough now, or they belong to the UI plan): replacing the three icon fonts with one, dropping `jimp` or `sharp`, test coverage tooling, screenshot tests, automating the smoke test in Electron, dropping the number prefixes from file names, replacing bare-name globals with imports, the old song-list-as-data step (A-S3).

The recorded call-sequence tests (`events-a` to `events-d`, `events-wiring`) and the DOM-shape tests will break when the UI is redesigned. This plan keeps them working; deciding what replaces them belongs to the UI plan.

## 3. Phases and gates

| Phase | Who | What | Gate to start |
|---|---|---|---|
| 1 | A, B, C, D in parallel | Four independent areas (section 4). No agent edits another's files. | none |
| 2 | A alone | Move `src/js` into folders (section 5). Nobody else has a patch in flight. | every Phase 1 patch applied and verified |
| 3 | You | Full suite, the smoke checklist, one Electron start. Record the numbers in `tools/change.log.txt`. | Phase 2 applied |

Phase 2 is a single mechanical change on its own so that a failure is easy to read: it only changes folders and the paths that name them. File names stay as they are (the `event-audit` owner groups and `event-allowlist.json` key on the number prefix and the file name).

## 4. Ownership in Phase 1

| Agent | Area | Files it may edit |
|---|---|---|
| **A** | Housekeeping and docs | `.agent/` (except reports of others), `claude.md`, `README.md`, `.gitignore`, `tools/` except `tools/tests/` and `tools/event-allowlist.json`, `package.json` is not touched by A |
| **B** | Test speed and infrastructure | `tools/tests/run.js`, `tools/tests/helpers/app-fixture.js`, `helpers/sequence-suite.js`, `helpers/render-template.js`, `helpers/call-sequence-scenarios.js`, `scroll.test.js`, `online-metadata.test.js`, `modal-close.test.js`, `view-switch-song-list-cleanup.test.js`, `events-a.test.js` to `events-d.test.js`, the `scripts` block of `package.json`, `.github/workflows/test.yml` |
| **C** | Test content (merge, delete, trim) | every other `tools/tests/*.test.js`, `tools/tests/README.md`, `helpers/bridge-use.js`, `helpers/fake_mutagen.py`, `metadata_backend_logic.py` |
| **D** | Product code leftovers | `src/` (js, css, assets), `electron/`, `build/`, `tools/tests/expected/*.json`, `helpers/scenarios-*.js`, `events-wiring.test.js`, new `search-clear.test.js`, `tools/event-allowlist.json` |

Rules:

- An agent edits only its own files. If a step needs a change in someone else's file, stop and say so in the report under "Needs from other agents"; you route it.
- Shared files: `tools/change.log.txt` (append-only) and `package.json` (only B edits it, the `scripts` block only). When you apply several patches, expect small conflicts there; keep both sides.
- One exception for D: if a D change breaks a C or B test only because it names a renamed event or a removed duplicate call, D may change that string in the test (one line each, listed in the report). The owner rebases.
- Steps marked *Needs* wait for those steps to be applied and verified.
- Never delete a test without the report saying which remaining test covers what it checked (C) or why the check is obsolete.
- Comments in code say what the code does or why. They never name an agent, a step ID or a plan.

## 5. Phase 2 layout (the target of A-02)

Names unchanged. A may put a file in a better folder if the reason is in the report; no folders beyond these.

| Folder | Files |
|---|---|
| `core/` | `00-state.js`, `00b-events.js`, `01-sizes.js`, `02-ghost-list.js`, `03-storage.js` |
| `library/` | `03a-recents.js`, `03d-albums-artists.js`, `03e-recents-history.js`, `03f-favorites-settings.js`, `03j-library-locations.js`, `03k-cover-sync.js`, `03l-import-export.js`, `03m-library-folder-render.js`, `12-color-extract.js`, `20-metadata-editor.js` |
| `playlists/` | `03c-playlists.js`, `03g-pinned-items.js`, `03h-folders.js`, `09-folders-playlists.js` |
| `search/` | `03b-search-engine.js`, `03i-search-history.js`, `08h-panel-search.js` |
| `playback/` | `10a0-shuffle-state.js`, `10a-playback-shuffle.js`, `10b-playback-smart-shuffle.js`, `10c-playback-queue.js`, `10d-playback-song.js`, `13-song-highlight.js`, `14-song-navigation.js`, `15a0-controls-state.js`, `15a-controls-time-play.js`, `15b-controls-shuffle-btn.js`, `15c-controls-repeat-btn.js`, `15d-controls-track-nav.js`, `15e-controls-audio-events.js`, `15f-controls-progress-seek.js`, `15g-controls-volume-fade.js` |
| `lyrics/` | `08c-panel-track-lyrics.js`, `08g-panel-saved-lyrics.js`, `11a-lrc-parser-display.js`, `11b-lyrics-import.js`, `11c-sync-editor-shell.js`, `11d-sync-editor-lines.js`, `11e-sync-editor-line-edit.js`, `11f-sync-editor-volume-save.js`, `11g-sync-editor-line-actions.js`, `18-lyrics-editor.js`, `19-online-lyrics.js`, `21-language-detect.js` |
| `ui/subscribers/` | `04h-recents-history-events.js`, `04i-library-rebuild-events.js`, `04j-pinned-items-events.js`, `04k-playlists-events.js`, `04l-search-history-events.js`, `04m-playback-settings-events.js`, `04n-import-export-events.js`, `04o-folders-events.js`, `04p-playback-events.js`, `04t-lyrics-events.js`, `04u-search-events.js`, `04v-right-panel-events.js` |
| `ui/` | `04a0-ui-state.js`, `04a-ui-render-core.js`, `04b-render-playlists-folders.js`, `04c-render-albums.js`, `04d-render-artists.js`, `04e-render-favorites-history.js`, `04f-render-search-history.js`, `04g-render-lyrics-view.js`, `05a-lazy-load-main-list.js`, `05b-lazy-load-left-panel.js`, `05c-lazy-load-smart-lyrics.js`, `06a-context-menus.js`, `06b-modals.js`, `06c-scrollbar-widget.js`, `06d-tooltip-system.js`, `06e-tooltip-titles.js`, `06f-drag-drop-songs.js`, `06g-drag-drop-left-panel.js`, `06h-fullscreen-viewer.js`, `06i-theme-switcher.js`, `06j-notification-system.js`, `06k-keyboard-shortcuts.js`, `07-views.js`, `07a-ui-actions.js`, `08a-panel-layout.js`, `08b-panel-album-art.js`, `08d-panel-right-tabs.js`, `08e-panel-settings.js`, `08f-panel-extended-metadata.js`, `16-context-menu-actions.js`, `17-song-selection.js` |
Existing files in `core/`, `api/`, `library/`, `lyrics/`, `playback/`, `ui/` stay where they are. `src/js/` keeps only `main.js`, `99-player.js` (the build template), `package.json` and the folders.

Why this is cheap: only two files import another renderer file by path (`10b` imports its sibling `10a`, which lands in the same folder, and `core/build-data.js` imports `../api/desktop-api.js`, which does not move); the load order is the list in `main.js`; `tools/lib/manifest.js` already reads subfolders. What has to change is the import lines in `main.js`, every place a script, test or document names a `src/js/<file>` path, and `claude.md`.

## 6. Smoke checklist

`tools/smoke-checklist.md` after Phase 2 (files moved; the app must start and every view must still load). It is not needed after each Phase 1 patch; each step names the focused tests and the one manual check that fits it.

## 7. Rules for every change

1. Archive the project first (`.agent/AGENTS.md`).
2. Smallest reasonable diff; one step per patch where possible.
3. Run the focused tests named in the step, and say what you did not run. Do not run the whole suite to prove the baseline.
4. Append to `tools/change.log.txt` in the existing format.
5. Deliver one `.patch` from the actual repository state, with the report inside it.
6. Record `npm run test:timing` for the files you touched and, for D, the `dep-map` and `event-audit` numbers.

## 8. Mini steps

Each step is sized for one session or less. The IDs are used in reports and on the board.

### Agent A: Housekeeping and docs (Phase 1), then the folder move (Phase 2)

- [ ] **A-01** (Phase 1) **Remove dead tool folders.** Delete `tools/spike-modules/` (its checks ran in Electron and the result is in the archived A report 0004) and `tools/test-shuffle/` (a manual playground; `shuffle.test.js` covers the logic). Before deleting, grep for each name in `package.json`, `.github/`, `eslint.config.js`, `tools/lint*.js`, `tools/tests/` and `build/`; the only mention left should be the sentence in `tools/tests/README.md` (C-05 edits that file). Keep `tools/placeholder-test/`: the tests README names it as a manual page for the virtual list.
  - Files: `tools/spike-modules/`, `tools/test-shuffle/`
  - Done when: both folders are gone; lint and `node tools/tests/run.js unit` pass; the grep result is in the report.
- [ ] **A-02** (Phase 1) **Triage `tools/prompt.txt` and the root docs.** `tools/prompt.txt` (56 KB) is a file-by-file reference written before the module work. Count how many of the file names it lists no longer exist, and report: delete, regenerate in short form, or keep. Do not delete it unless the session brief says "delete prompt.txt". Check that `README.md`, `claude.md` and `.agent/AGENTS.md` have no other names of files that do not exist (`claude.md` was corrected in the plan patch; verify, do not redo).
  - Files: `tools/prompt.txt` (only if told), `README.md`, `claude.md`, `.agent/AGENTS.md`
  - Done when: the report has the stale-name count and a recommendation.
- [ ] **A-03** (Phase 2) **Move the files.** Write a throwaway script (not committed) that applies the table in section 5, then: update the import lines in `src/js/main.js` (same order); rewrite every path that names a moved file in `tools/` (`dep-map.js`, `event-audit.js`, `lint-globals.js`, `lib/`), `tools/tests/` (tests and helpers), `build/`, `eslint.config.js`, and the docs (`claude.md`, `.agent/AGENTS.md`, `tools/tests/README.md`, `src/js/core/*.md`). Make sure `99-player.js` and `core/build-data.js` still find each other.
  - Files: everything that names a `src/js` path
  - Done when: `src/js/` holds only `main.js`, `99-player.js`, `package.json` and folders; `manifest.test`, `listener-order` and the full suite pass with the same counts as before the move; lint exits 0 with at most 1 warning; `node tools/dep-map.js` prints the same four numbers as before the move; `event-audit --strict` exits 0; the report lists any file placed differently from section 5.
  - Needs: B, C and D finished (all their steps applied and verified)
- [ ] **A-04** (Phase 2) **Docs after the move.** Rewrite the "Important file ownership" list in `claude.md` with the new paths, and update `tools/tests/README.md`'s path examples (C owns the file in Phase 1; this edit is Phase 2 and is A's).
  - Files: `claude.md`, `tools/tests/README.md`
  - Done when: every path named in those two files exists (check with a short script; paste the result).
  - Needs: A-03

### Agent B: Test speed and infrastructure

- [ ] **B-01** **Record the timing baseline.** Run `npm run test:timing` once and put the table in the report. This is the "before" for every later number.
  - Files: none (report only)
  - Done when: the table is in the report.
- [ ] **B-02** **Replace fixed sleeps in your own files.** `scroll.test.js` (28 `waitForTimeout`), `view-switch-song-list-cleanup.test.js` (5). Wait for the thing the test needs (`waitForFunction`, the existing `waitForAppSettled`, a DOM state) instead of a time. Do not lower a wait that exists to let a debounce or animation finish unless the test can observe its end.
  - Files: `scroll.test.js`, `view-switch-song-list-cleanup.test.js`
  - Done when: `scroll.test.js` takes at most half its baseline time with the same test count and 3 passes in a row; no `waitForTimeout` is left in the two files, or each remaining one has a comment saying what it waits for.
- [ ] **B-03** **Sequence suites in parallel pages.** `events-a` to `events-d` run every scenario one after another in one `test()`. Run the scenarios in several pages at once by default (the harness supports `SEQUENCE_PAGES`), or make each scenario its own test. The recorded sequences in `tools/tests/expected/` must not change: run it 3 times with the default and once with 1 page, and say so in the report.
  - Files: `helpers/sequence-suite.js`, `events-a.test.js` to `events-d.test.js`, `helpers/call-sequence-scenarios.js`
  - Done when: `events-b` and `events-c` take at most half their baseline; the four expected files are byte-identical to before.
- [ ] **B-04** **Make `online-metadata.test.js` fast.** It waits for the real 700 ms backoff (`electron/online-metadata.js` `sleep`). Use `mock.timers` from `node:test` (or an injected delay if that does not work; an injected delay needs a change in `electron/online-metadata.js`, which is D's: ask in the report). The behavior under test stays the same.
  - Files: `online-metadata.test.js`
  - Done when: the file takes at most 3 s; test count unchanged.
- [ ] **B-05** **Build the fixture once per run, and look at `modal-close`.** `buildApp()` copies `src/js`, `css` and the fonts for every browser file. Build one base copy per run (the runner already sets `XPLAYER_TEST_RUN_ID`) and give each file a cheap copy that differs only in the song list; keep working when a file is started by hand. Then find out why `modal-close.test.js` takes 36 s for 26 tests and fix what is slow.
  - Files: `helpers/app-fixture.js`, `run.js`, `modal-close.test.js`
  - Done when: the report has before and after seconds for 3 browser files and for `modal-close`; the suite still passes when one file is run alone and when the whole run is started.
- [ ] **B-06** **Fast commands and CI.** Add `npm run test:quick` (unit tests and lint; target under 10 s once B-04 is done) and `npm run test:fast` (the browser files with `--concurrency=4`). Add `--shard=i/n` to `run.js`. In `.github/workflows/test.yml`: a job for unit tests and lint on `ubuntu-latest`, and a Windows job for the browser files split in 3 shards, with the Playwright browser cached. Run `test:fast` 3 times and report any file that fails only when run in parallel.
  - Files: `run.js`, `package.json` (scripts), `.github/workflows/test.yml` (the tests README is C's: list the new commands in your report and C adds them)
  - Done when: both commands exist and work; the workflow file is valid YAML (`node -e` parse or a linter) and covers every test file exactly once across the jobs; the report lists the new commands for C-05.
  - Needs: B-04, B-05

### Agent C: Test content

- [ ] **C-01** **Remove the dead and the stale.** `storage.test.js` has a skipped test for code that moved to `03c-playlists.js`; delete it, or rewrite it against the real module if it still checks something no other test checks. Look at the second skip in `scroll.test.js` only to see why it skips (report; B owns the file). Check every `*.test.js` for tests that assert a thing another test already asserts in the same file.
  - Files: `storage.test.js`, other C files
  - Done when: no test is skipped for a reason that is no longer true; the report lists what was removed.
- [ ] **C-02** **One "window contract" test.** The check that names are registered on `window` (and that no page error happens at load) is written again in `converted-modules` (2 tests), `electron-injected-names`, `legacy-bridge` (the static data-action check) and the eight module gate files: `ui-leaf-modules`, `ui-views-module`, `ui-core-render-module`, `ui-virtual-scroll-modules`, `render-modules`, `drag-drop-modules`, `event-subscribers-modules`, `playback-modules`. Write one `window-contract.test.js`: the static parts as unit tests with `acorn` (already a dev dependency), plus one page load. Keep every behavior test in those files (what a function does when called); remove only the repeated name-registration checks.
  - Files: new `window-contract.test.js`, the files above
  - Done when: the report has a table: each removed assertion, and the assertion that now covers it; a spot check on 3 of them (remove a registration in a scratch copy, the new test fails); fewer test files start a browser than before (say how many).
- [ ] **C-03** **Inline handlers as one rule.** `ui-handlers.test.js` has one test per file saying "at most N inline handlers" and every ceiling is 0. Replace them with one static test over all of `src/` (and `build/music_player.html`) that finds `on...=` strings and `setAttribute('on...')`, with an explicit short list of exceptions if there are any. Keep the browser tests in that file.
  - Files: `ui-handlers.test.js`
  - Done when: one test replaces 13; it fails when you add `onclick="x()"` to a scratch copy of any renderer file.
- [ ] **C-04** **Merge the order checks and trim tests of tools.** `listener-order`, `event-subscribers-modules` and `manifest.test` all check order in `main.js`; keep each fact in one place. Cut `app-fixture.test.js` and `lint.test.js` to the cases that protect something real (the fixture's fallback when no browser starts; that lint fails on an undefined name).
  - Files: the four files above
  - Done when: the report lists what was cut and why each remaining case is needed.
- [ ] **C-05** **Sleeps in your own files, then the README.** Replace the `waitForTimeout` calls in `context-menu`, `search-ui`, `startup-gate`, `lyrics-panel-handlers`, `ui-leaf-modules` and `app-fixture` tests with a wait on the real condition. Then update `tools/tests/README.md`: the file list and counts, the new `window-contract` test, the B commands, no mention of `tools/spike-modules/` or `tools/test-shuffle/`.
  - Files: the six test files, `tools/tests/README.md`
  - Done when: no `waitForTimeout` is left in your files except ones with a comment; the README matches `npm run test:list`.
  - Needs: C-02 to C-04 (for the README) and the B-06 report (for the commands)

### Agent D: Product code leftovers

- [ ] **D-01** **Fix the search-clear bug.** `src/js/08h-panel-search.js` line 45 calls `getCachedEl('all-songs-count').textContent = ...`. No element has that id; the count element is `all-songs-count-display`, whose text is "N songs" (see `refreshCurrentView` and `updateAllCounts` in `07-views.js`). `getCachedEl` returns null, so clearing the search box throws. Line 77 has the same id with a null check, so it silently does nothing. Use the existing count updater or the same text format, and decide for line 77 (fix it the same way, or remove it) with a sentence in the report. Add `tools/tests/search-clear.test.js`: type a query, clear it, assert no page error and that the count shows the full number.
  - Files: `08h-panel-search.js`, new `search-clear.test.js`
  - Done when: the new test fails on the old code and passes on the new; `search-ui.test.js` passes.
- [ ] **D-02** **Remove the duplicate left-panel refreshes.** Sites: `04i` (`renderLeftPanelMainList()` twice in the rebuild reaction), `04n` (import), `04k` (`playlist:listChanged` followed by `playlist:deleted`, and the repeated `renderPlaylistsView()` / `renderLeftPanelMainList()` pairs), `04h` (`history:cleared`), `15e` (Recent panel refresh). Remove only a call whose effect a later call in the same reaction fully repeats. Re-record the affected sequences in `tools/tests/expected/` with `EVENT_BASELINE=force` and update `events-wiring.test.js`; list every removed call in the report with the reason.
  - Files: `04h`, `04i`, `04k`, `04n`, `15e`, `tools/tests/expected/*.json`, `helpers/scenarios-*.js`, `events-wiring.test.js`
  - Done when: `events-a` to `events-d`, `events-wiring`, `scroll`, `ui-virtual-scroll-modules` and `render-modules` pass; the report lists each removed call and the diff of each changed recorded sequence.
- [ ] **D-03** **Rename `recents:count-changed` to `recents:countChanged`.** It is the one event name that breaks the rule in `core/EVENTS.md`. Emit in `03e-recents-history.js`, listener in `04h`, `core/EVENTS.md` (two places), `events-wiring.test.js` line 308, and the recorded sequences if they contain it.
  - Files: `03e`, `04h`, `core/EVENTS.md`, `events-wiring.test.js`, `tools/tests/expected/*.json`
  - Done when: `grep -r "count-changed" src tools` finds nothing; `event-audit --strict` exits 0; the tests named in D-02 pass.
  - Needs: D-02 (same files)
- [ ] **D-04** **One helper for the left-panel list writes.** `leftPanelVirtualState.currentItems = ...; renderLeftPanelVisibleItems(false);` is written by hand in `04j` (3), `04k`, `04o`, `04p`, `05b` (4), `06g` and `09`. Add one exported function in `05b-lazy-load-left-panel.js` (for example `refreshLeftPanelItems(items)`; no argument means `getLeftPanelItemsArray()`), register it with `registerLegacyGlobals` only if something outside reads it by bare name, and replace the sites that really are the same two lines. Leave a site alone if it differs (for example it sets `[]` without rendering) and say so. This is virtual scroll: highest regression risk.
  - Files: `05b`, `04j`, `04k`, `04o`, `04p`, `06g`, `09`
  - Done when: `scroll`, `ui-virtual-scroll-modules`, `events-wiring`, `drag-drop`, `drag-drop-modules` and `ui-handlers` pass; the report lists every site changed and every site left, with why; one manual check: pin an item, drag a song into a playlist, delete a playlist, and watch the left panel update once.
  - Needs: D-02, D-03
- [ ] **D-05** **Dead code and the lint warning.** `PAUSE_ICON_HTML` (`00-state.js` line 302) is used nowhere and points to `icons/pause.svg`, which does not exist; `assets/icons/main-pause.svg` is referenced by nothing; `pause.svg` is in the icon copy list in `build/music_player.py` but the file is missing. Confirm each with a grep, then remove them. Fix the unused `currentContextPlaylistId` warning in `06a-context-menus.js` (remove it if nothing reads it).
  - Files: `00-state.js`, `src/assets/icons/main-pause.svg`, `build/music_player.py`, `06a-context-menus.js`
  - Done when: lint reports 0 errors and 0 warnings; `build/music_player.py` still builds (run the build test: `output-dir.test.js`); the report shows the grep for each removed name.

## 9. Session brief (paste at the start of each agent session)

```
You are Agent <X> on the ExhataQ cleanup and test-upgrade plan.

Read first: .agent/AGENTS.md, claude.md, .agent/PLAN.md (sections 2, 4, 7 and your
agent's steps in 8), .agent/BOARD.md, tools/tests/README.md, and the latest report of
any step yours depends on (.agent/reports/). The finished refactor plan is in
.agent/archive/refactor/ if you need background; you do not need to read it.

Your files: <row for your agent in PLAN.md section 4>. Edit nothing else, except your entry
in tools/change.log.txt and your report in .agent/reports/<X>/.

This session: <mini step IDs, for example B-02>.

Rules:
- Archive first, as .agent/AGENTS.md says. Smallest reasonable diff; no unrelated changes.
- Comments in code describe the code. Never write agent names, step IDs or plan names in them.
- Run the focused tests the step names. Say plainly what you did not run.
- Record timings (npm run test:timing for the files you touched) before and after.
- Append to tools/change.log.txt in the existing format.
- Deliver one patch named <X>-NNNN-slug.patch (NNNN counts your own patches).
- Write .agent/reports/<X>/NNNN-slug.md from .agent/reports/TEMPLATE.md and include it in the patch.
- If the step needs a file you do not own, stop and describe it in the report.
```

## 10. What you do after each patch

1. Save the patch and read its report (`.agent/reports/<X>/NNNN-slug.md`).
2. `git apply --check <patch>`; if it passes, `git apply <patch>`. If `change.log.txt` or `package.json` conflict, keep both sides.
3. Run the tests the report lists under "For you", and the one manual check if there is one.
4. Update `.agent/BOARD.md` (status and patch name).
5. Read "Needs from other agents" and "Next step" in the report, and start the next session with the brief from section 9.
6. If a check fails, do not start anything that depends on that step. Give the report back to the same agent.
7. When every Phase 1 step is `applied + verified`, start A-03 with nothing else in flight. After A-04, run the smoke checklist (Phase 3).

# Testing guide

How to run the Xplayer tests, write new ones, and lint. Everything below was checked against this repository; where something could not be checked, it says so.

All commands are PowerShell, run from the repository root (the folder with `package.json`).

## 1. What is here

| Group | What it is | Files |
| --- | --- | --- |
| **unit** | Pure Node: no browser. Fast (most files finish in under a second; `online-metadata` about 0.3 s). | `drag-drop-modules`, `event-bus`, `language-detect`, `lint`, `lrc-parser`, `main-process-safety`, `manifest`, `metadata-backend`, `music-folders`, `online-metadata`, `output-dir`, `recents`, `run-shards`, `scan-folder-tags`, `scanner`, `search-engine`, `setters`, `shuffle`, `storage-core`, `storage` (`*.test.js`; 20 files) |
| **browser** | Builds a throwaway copy of the real app, opens it in headless Chromium with a stubbed Electron API, and drives it. Each test file launches its own browser. | everything else in `tools/tests/*.test.js` (38 files). `window-contract.test.js` is in this group because of its one page load; most of its tests are static (acorn) and need no browser. `songs-store.test.js` is in this group because it imports the fixture. |
| **sequence suites** | A kind of browser test: runs scenarios and compares the recorded order of UI calls with `tools/tests/expected/*.json`. | `events-a`, `events-b`, `events-c`, `events-d` (scenarios live in `helpers/scenarios-*.js`; `events-wiring` checks the event wiring itself) |
| **Python logic test** | `metadata_backend_logic.py`, started by `metadata-backend.test.js`. Uses a stand-in for `mutagen` (`helpers/fake_mutagen.py`). | |

The runner decides unit vs browser by looking at what a file imports (`helpers/app-fixture`, `helpers/sequence-suite` or `playwright` means browser). See `npm run test:list` for the current split (58 files: 20 unit, 38 browser).

Test framework: Node's built-in `node:test` with `node:assert/strict`. No Jest, Mocha or other runner.

Not covered by any automated test: a real Electron window. See "Real Electron smoke test" below for why.

## 2. Prerequisites

* **Node.js.** The repository does not pin a version (no `engines` field). The tests use the built-in `node:test` runner and were run on Node v22.22.2 (where this guide was verified) and on the maintainer's Windows machine with Node v24.13.1.
* **npm packages.** `npm install` at the repository root. Test-relevant packages from `package.json`: `playwright` (browser tests), `acorn` and `acorn-walk` (`setters.test.js`, `tools/dep-map.js`, lint), `sharp`, `jimp`, `music-metadata` (the app's scanner and image code), and `eslint` + `globals` (lint only). If `acorn` is missing, `setters.test.js` fails with `Cannot find module 'acorn'`: that is a setup problem, not a code bug.
* **A browser for the browser tests.** Either `npx playwright install chromium`, or Microsoft Edge / Google Chrome installed (the fixture falls back to them). If none can start, browser test files are **skipped, not failed** (the summary shows `skipped`).
* **Python** (only for `metadata-backend.test.js`): `python`, `python3` or `py` on PATH. It needs only the standard library; real `mutagen` is **not** needed. Without Python that one test is skipped.

Check that your setup is ready:

```powershell
node --version                                   # prints your Node version
node -e "require('playwright'); console.log('playwright ok')"
npx playwright --version                         # the browser tool is installed
python --version                                 # optional, for the metadata backend test
npm run test:list                                # lists the test files the runner finds
npm run test:unit                                # quick end-to-end check of the Node side
```

## 3. Running tests

| Command | What it does / when to use it |
| --- | --- |
| `npm test` | Every test file, one file at a time. Run before committing. |
| `npm run test:unit` | Only the no-browser files. Use while developing. |
| `npm run test:browser` | Only the files that start a browser. |
| `npm run test:quick` | The unit files, then lint (`node tools/tests/run.js unit && node tools/lint.js`). The check to run while you work, and what the first CI job runs. Needs `npm install` (ESLint); without it the lint half exits 2. |
| `npm run test:fast` | Only the browser files, up to 4 at once (`node tools/tests/run.js browser --concurrency=4`). Meant for a machine with several cores: the runner never starts more files than the machine has cores and prints a line when it lowers the number, so on one core this is the same as `npm run test:browser`. |
| `npm run test:list` | Shows which files would run and their group. Changes nothing. |
| `npm test -- shuffle` | Files whose name contains `shuffle`. Several words are allowed: `npm test -- shuffle scroll`. |
| `node --test tools/tests/shuffle.test.js` | One file, directly, with Node's own runner. |
| `node --test --test-name-pattern="several processes" tools/tests/songs-store.test.js` | One test (or a group) by name. The pattern is a regular expression matched against the test title. |
| `node --test --test-reporter=spec tools/tests/shuffle.test.js` | Same, but prints one line per test (names, pass/fail, time) instead of the compact TAP output. |
| `npm run test:timing` | Runs files one at a time and prints seconds, test counts and failures per file, slowest first. Use to find what got slow. |
| `node tools/tests/run.js --concurrency=2` | Runs two files at once. Default is 1, and the number is capped at the number of cores: when it is lowered the runner prints `Running 1 file(s) at once instead of 4 ...`. With more than one file at once, each sequence suite uses one page unless `SEQUENCE_PAGES` is set. Browser files are timing-sensitive: measured by Agent B on a one-core machine with four files at once, `events-b`, `events-c` and `scroll` timed out or differed from their recorded order, and all pass alone. Check a failure with 1 before blaming the code. |
| `node tools/tests/run.js browser --shard=2/3` | Part 2 of 3 of the selected files (here the browser files). The parts are disjoint and together are every selected file; the split is by an approximate run time and is the same on every machine. This is what each browser job in CI runs. Works with `--list` and `--timing`. A bad value (`0/3`, `4/3`, `abc`) or an empty part exits 2 with a message. |
| `$env:SEQUENCE_PAGES=1; node --test tools/tests/events-b.test.js` | The sequence suites run their scenarios in several pages at once: the number of cores, but at least 2 and at most 4. `SEQUENCE_PAGES=<n>` sets the number, and the runner sets 1 when it runs more than one file at once. A scenario that differs from its recorded order (or has a page error) is run again alone, with any number of pages, and the alone result counts; the test prints a diagnostic line naming those scenarios. So `SEQUENCE_PAGES=1` is not a strict check any more. A real regression also differs when run alone and still fails. Recording a baseline (`EVENT_BASELINE`) always uses one page and never retries. |
| `node --check src/js/04a-ui-render-core.js` | Syntax check of one JavaScript file (no linter needed). |
| `npm run lint` | ESLint. Exits 1 if there is any error; warnings are only reported. See "Lint". |
| `npm run lint:strict` | Same, but also exits 1 on any warning. |

Arguments for `node --test` can also be passed through the runner after a second `--`, for example `node tools/tests/run.js songs-store -- --test-name-pattern="lock"`. This pass-through form was verified on Linux only; on Windows PowerShell use the direct `node --test ...` form above, which is verified there.

`npm test` in the `electron/` folder still works as before (it runs the same files with a `*.test.js` pattern); the root scripts are the maintained entry point.

Reading the result: the summary lines are `tests`, `pass`, `fail`, `cancelled`, `skipped`. Exit code 0 means no failures.

## 4. Writing a new test

**Where and how it is found.** Put the file in `tools/tests/` and name it `<topic>.test.js`. The runner picks up every `*.test.js` in that folder (not subfolders). Helpers go in `tools/tests/helpers/`, recorded data in `tools/tests/expected/`. Files are CommonJS and start with a short comment saying what they cover and what they need.

**Unit or browser?** Prefer a unit test: if the logic can be reached with `require()` (everything in `electron/`, and the modules under `src/js/core`), test it directly. Use a browser test only when the thing under test needs the page: DOM, rendered rows, script load order, event wiring.

**A unit test** (verified to run):

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../../electron/songs-store');

test('songs written to a fresh folder read back unchanged', (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'songs-store-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true })); // cleanup even if an assertion fails
    const songs = [{ id: 1, title: 'A', url: 'file:///a.mp3' }];
    store.writeSongs(dir, songs);
    assert.deepEqual(store.readSongs(dir), songs);
});
```

**A browser test** uses the shared fixture in `helpers/app-fixture.js`: `loadPlaywright()`, `launch(pw)` (tries bundled Chromium, then Edge, then Chrome), `buildApp(n)` (throwaway copy of the app with `n` fake songs) and `gotoApp(page, dir)` (opens it and waits until start-up has settled). Skeleton (verified to run):

```js
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

describe('my feature', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        const pw = loadPlaywright();
        if (!pw) return void (skip = 'playwright not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(20);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('the page starts with the fake library and no errors', async (t) => {
        if (skip) return void t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
            await gotoApp(page, dir);
            assert.equal(await page.evaluate('SONGS_DATA.length'), 20);
            assert.deepEqual(errors, []);
        } finally {
            await page.close(); // always, or the browser keeps the page alive
        }
    });
});
```

Rules that keep tests honest:

* **One fresh page per test.** Never share a page, or the state of one, between tests. Tests about load order, the manifest, module registration or "no errors on start-up" especially: attach `pageerror` *before* `gotoApp`, so start-up errors are caught.
* **Temp data only.** `fs.mkdtempSync(path.join(os.tmpdir(), 'name-'))` for every folder; remove it in `t.after(...)`, `after(...)` or `finally`. No fixed names, no fixed ports (`server.listen(0)` picks a free one).
* **Clean up everything you start**: pages, browsers, child processes, servers, listeners, timers.
* **No arbitrary sleeps.** To wait for the page, use a condition: `await page.evaluate('someAsyncFunction()')` already waits for the promise; `await page.waitForFunction(() => <condition>)` waits for state; `gotoApp` waits for start-up. Use `await once(emitter, 'event')` or poll a condition with a timeout in Node tests.
* **Make sure the assertion really runs.** Inside a callback that might never fire, count the calls and assert the count. A browser test that returns early because of `skip` shows up in the `skipped` count: look at that number.
* **See it fail.** After the test passes, break the behavior it checks (comment out the fix, or change an expected value), run the test and confirm it fails with a message that points at the problem; then undo the change. A test that cannot fail proves nothing.

**Sequence suites** add scenarios in `helpers/scenarios-<x>.js`; the recorded call order lives in `expected/events-<x>.json` and must come from the *unconverted* code (`EVENT_BASELINE=1`; `force` re-records). See `helpers/sequence-suite.js`.

## 5. Test quality and common mistakes

* **`waitForTimeout` is a guess.** Too short and the test is flaky; too long and every run pays for it, and the number hides what the test is really waiting for. Replace it with the condition (see above). Typical redundant case found in this repo: `await page.evaluate('asyncFn()')` followed by a sleep, when `evaluate` had already waited for the promise.
* **When a delay is justified.** To prove something does **not** happen (assert after a bounded wait, once a positive signal says the work is finished), and when the delay *is* the behavior under test (a debounce, a hold-to-scroll, a retry back-off). Write down which one it is next to the wait.
* **Deterministic and independent.** A test must pass alone, in any order and after any other test. No shared mutable state, no dependence on the real clock, the network, the user's data or the current folder.
* **Don't use a browser for logic.** A browser test costs about a second of page load plus the start-up settle. If a function can be `require()`d, test it in Node.
* **Reading results.**
  * *fail* with an assertion message: the behavior changed; read the diff between expected and actual first.
  * *skipped*: the test chose not to run. Expected today: 1 hard-coded skip (`scroll.test.js`, "a tiny thumb nudge shows real rows only", marked timing-sensitive). More skips than that usually means a missing browser or Python. Two more are expected when ESLint is not installed: the two real-ESLint tests in `lint.test.js` skip themselves.
  * *timeout* (`--test-timeout=120000` per test file run by the runner): something never became true, or the machine is overloaded. Re-run alone before changing anything.
  * *browser setup error / everything skipped*: install a browser (`npx playwright install chromium`).
  * `Cannot find module '...'`: run `npm install`.
* **Reproducing a flaky test.** Run it alone many times and count failures:

```powershell
$failed = 0
for ($i = 1; $i -le 15; $i++) {
    node --test --test-name-pattern="your test title" tools/tests/your-file.test.js
    if ($LASTEXITCODE -ne 0) { $failed++; Write-Host "FAILED on run $i" }
}
"$failed failure(s) in 15 runs"
```

  Then run the whole file; then with `--concurrency=1` explicitly. If it only fails under load, a wait is probably a guess. If it only fails when run with other tests, something is shared.

## 6. Recommended workflow for every change

Mandatory:

1. Write or update the test that covers the change.
2. Run it alone (`node --test <file>` or with `--test-name-pattern`) and see it fail without your change and pass with it.
3. Run the whole file, then the related group (`npm run test:unit` or `npm run test:browser`).
4. Run `npm test` before committing (the full suite; about 6 minutes on a slow single-core machine, see section 12). On a machine with several cores `npm run test:fast` runs the browser files in parallel; `npm run test:quick` is the short check while you work.
5. `git diff --check`, then read the final diff.
6. Report the exact commands you ran and their results (pass/fail/skipped counts), including anything you could not run.

Optional diagnostics: `npm run test:timing` (what got slower), `--test-reporter=spec` (per-test lines), `npm run lint` (missing imports and typos), repeated runs of a flaky test.

When a change touches how renderer files load, register names or order their listeners, the gate files are `window-contract`, `manifest`, `listener-order`, `event-subscribers-modules`, `converted-modules`, `ui-handlers`, `scroll`, `search-ui` and `view-switch-song-list-cleanup`, plus the manual page `tools/placeholder-test/test-placeholders.html`; run them 5 times in a row after each patch.

## 7. Maintenance

* **Adding a test file:** create `tools/tests/<name>.test.js`. Nothing else to register: the runner discovers it. Check with `npm run test:list` that it appears in the group you expect.
* **Discovery and groups:** `tools/tests/run.js` lists `*.test.js` in `tools/tests/` and puts a file in the *browser* group if its text matches `app-fixture`, `sequence-suite` or `require('playwright')`. Change `BROWSER_MARKER` in `run.js` if you add another browser helper.
* **Shards and the weight table.** `run.js --shard=i/n` spreads the selected files over `n` parts by `SHARD_SECONDS`, an approximate run time per file taken from `npm run test:timing` (files not in the table count as `DEFAULT_SECONDS`, 3 s). When a file gets much slower or a slow file is added, update the table. A wrong number only makes the parts uneven; it never drops a file, because every file is in exactly one part whatever the numbers are.
* **Scripts live in** the root `package.json` (`test*`, `lint*`). `electron/package.json` keeps its older `test` script for compatibility.
* **Browser launch.** `helpers/app-fixture.js` `launch()` tries bundled Chromium, then Edge, then Chrome. `node --test` runs every file in its own process, so nothing in memory is shared between files. When started through `npm test`, the runner sets `XPLAYER_TEST_RUN_ID` and the files of that run share a small file in the temp folder that records which option worked, so later files try it first. A total failure is never recorded. When you run a single file by hand, nothing is cached.
* **Which test owns which fact (so a fact is checked in one place):**
  * `manifest.test.js`: the static facts about `src/js/main.js` (`core/legacy.js` first, each file imported once, every file imported) and about the rendered page template (one module entry, no hand-written script or stylesheet tags).
  * `window-contract.test.js`: every name that must be on `window`. The name lists are read from the sources, so adding an exported function to a module needs no edit there; only `REQUIRED_SHARED` and the table of constant values are written by hand. Do not add "is a function on window" checks to other files.
  * `event-subscribers-modules.test.js` and `listener-order.test.js`: the subscribers' order and registration, and the order the document and window listeners run in. Each loads the page once.
  * `ui-handlers.test.js`: one static rule over `src/` and the page template that no inline `on...=` handler or `setAttribute('on...')` exists, except the entries in `INLINE_EXCEPTIONS` (the list may only get shorter), plus the browser tests of handler behavior.
  * `lint.test.js`: the exit codes of `tools/lint.js` with a stand-in ESLint, `tools/lint-globals.js`, and two tests with the real ESLint and the real `eslint.config.js` (an undefined name fails with `no-undef`; a registered global and a browser built-in pass). The real-ESLint tests skip when `eslint` or `globals` is not installed.
  * `run-shards.test.js`: that for 1, 2, 3, 4 and 7 shards the parts are disjoint and together are every file, that the split does not depend on the order of the file list, that `--shard` is validated, and that the CI workflow agrees with the code: the matrix is `1..N` and the command says `/N`, and `test:quick` and `test:fast` are the commands this guide describes. If you add or remove a shard, change the workflow matrix and the `/N` together.
* **`scroll.test.js`** still has its own copy of `loadPlaywright` and `buildApp` (different fake song data); only `launch` and `gotoApp` come from the shared fixture.
* **Docs:** when you change scripts, discovery, helpers or prerequisites, update this file in the same change. If the repository workflow asks for it, add a line to `tools/change.log.txt`.

## 8. Lint (errors fail, warnings are reported)

ESLint exists to catch missing imports and typos in the renderer, which is now one ES-module graph started from `src/js/main.js`.

* Config: `eslint.config.js` (flat config, root). Rules: `no-undef`, `no-unused-vars` (warning), `no-unreachable`, `no-dupe-keys`, `no-self-assign`.
* The app's globals are **generated**, not listed: `tools/lint-globals.js` reads the entry named in `src/manifest.json` (`tools/lib/manifest.js` follows the `import` lines of `main.js`) and adds every key of a `registerLegacyGlobals({...})` call plus the names registered by `registerLegacyState`. Run `node tools/lint-globals.js` for the counts (measured with the final flip: 1 classic file (`99-player.js`, build data only), 115 modules, 721 names: 720 from `registerLegacyGlobals`, 1 from a window publication). A name that exists only inside a module and is not registered is *not* a global, so using it in another file without an import is reported.
* **One name is published on `window` instead of registered:** `updateExternalScrollbar`. `initExternalScrollbar('main-content', ...)` in `src/js/06c-scrollbar-widget.js` assigns `window.updateExternalScrollbar` during start-up and other files use it as a bare global. `WINDOW_PUBLISHED_GLOBALS` in `tools/lint-globals.js` lists it together with the one file allowed to publish it, and every lint run checks that file's syntax tree for a plain `window.updateExternalScrollbar = ...`; the run fails (exit 2, with a message) if the assignment is gone or the file is not in the manifest. A `window.x = ...` anywhere else does **not** become a global. Add a name there only for a real run-time publication, and update `tools/tests/lint.test.js`, which pins the list. Behavior of the published function (start-up order, which scrollbar it updates) is covered by `scrollbar-publication.test.js`.
* Every file `main.js` imports is linted as an ES module, `electron/` as CommonJS with Node globals (`electron/preload.js` also gets browser globals).
* Skipped: `src/js/99-player.js` (it contains the build token `{{SONGS_DATA}}`, which is not valid JavaScript), `tools/` and `tools/tests/`.
* Exit codes of `tools/lint.js`: `npm run lint` exits **1 if there is any error** (a parse error counts as one) and 0 otherwise, so warnings are only reported; `npm run lint:strict` exits 1 on any error **or warning**; 2 means ESLint could not run (not installed, or it threw). It prints every problem and a count per rule. Nothing is ever fixed automatically. `tools/tests/lint.test.js` runs the real script against a stand-in ESLint to check these codes, so those tests need no ESLint install. Two more tests there run the real ESLint with the real `eslint.config.js` on a small copy of the layout and check that an undefined name exits 1 with `no-undef`; they skip when `eslint` is not installed.
* Needs `npm install` (adds `eslint` and `globals`; `globals` supplies the browser and Node built-in names, which ESLint does not include).

**Baseline:** when this section was written, `node tools/lint.js --summary` reported 136 files, 0 errors and 1 warning (`no-unused-vars`), the same as before the flip; a later run reports 0 warnings (section 12). The older "21 errors" figure (20 for `updateExternalScrollbar`, 1 for `lyricsSavedView`) was fixed earlier and could not be reproduced. ESLint ran here with a `globals` package generated from Chromium's window properties, because the registry was unreachable; run it once with the real package. To check:

```powershell
npm install
node tools/lint.js --summary
```

and paste the per-rule counts here:

| Rule | Errors | Warnings |
| --- | --- | --- |
| `no-undef` | not measured | n/a |
| `no-unused-vars` | n/a | not measured |
| `no-unreachable` | not measured | n/a |
| `no-dupe-keys` | not measured | n/a |
| `no-self-assign` | not measured | n/a |

## 9. Real Electron smoke test: not available yet

A test that launches the real Electron app (Playwright `_electron`) could not be added without changing main-process code, so it was **not** added. The reasons, from `electron/`:

* The song library, `songs.json` and the page the window loads (`music_player.html`) all live in `electron/MusicPlayerOutput`, a path built from `__dirname` in `main.js` (`OUTPUT_DIR` and five repeated `path.join(__dirname, 'MusicPlayerOutput')` calls) and in `window-manager.js` (two uses). No environment variable or command-line option changes it, and the folder is produced by `build/music_player.py`, not committed. A smoke test would therefore read and write the developer's real library.
* Only the small settings files can be redirected today (`MUSIC_PLAYER_CONFIG_DIR`, honored by `storage-paths.js`), plus Electron's own `--user-data-dir`.

Minimal hook needed (main-process change, not made): one constant, for example `const OUTPUT_DIR = process.env.MUSIC_PLAYER_OUTPUT_DIR || path.join(__dirname, 'MusicPlayerOutput')`, used in every place above (including `thumbarIconPath` and `window-manager.js`), plus a way to run the build into that folder. The Electron binary is also not a dependency of this repository, so the test would read its location from an environment variable and skip with a reason when absent. There are also no audio fixture files in the repository (`scanner.test.js` uses in-memory objects), so tiny audio files would have to be generated by the test.

## 10. Continuous integration

`.github/workflows/test.yml` runs on every push and pull request, in two jobs:

* **`unit-and-lint`** (`ubuntu-latest`): checkout, Node 24 with the npm cache, `npm ci`, `npm run test:quick`. That is the 20 unit files and then lint (errors fail the job, warnings do not). No browser is installed.
* **`browser`** (`windows-latest`, matrix `shard: [1, 2, 3]`, `fail-fast: false`): checkout, Node 24, `npm ci`, a cache of the Playwright browser folder (`~\AppData\Local\ms-playwright`, keyed by the OS and `package-lock.json`), `npx playwright install chromium`, then `node tools/tests/run.js browser --shard=<n>/3`. The three parts run at the same time on separate machines.

Every test file runs exactly once: the unit files in the first job, each browser file in exactly one of the three parts. `run-shards.test.js` fails if the matrix and the `/3` in the command disagree. No job starts the real Electron application.

`npm ci` needs `package-lock.json` to match `package.json`: after adding packages, run `npm install` once and commit the updated lock file, or `npm ci` will fail.

Not checked: the workflow file parses as YAML (checked by Agent B), but it has not been confirmed to run green on GitHub, so the cache, the three parts and their run times there are unknown.

## 11. Measured results (record of the first test-suite speed-up, before Plan 3)

This section is a historical record. The commands, file counts and defaults above are current; the numbers below are not. For current timings run `npm run test:timing`; the Plan 3 numbers are in section 12.

Environment: Linux sandbox, **1 CPU core**, Node v22.22.2, Chromium 141. Not measured on Windows. Each number is one run unless a count is given, so expect a few seconds of noise.

| | Before | After |
| --- | --- | --- |
| Full suite command | `cd electron; node --test --test-concurrency=1 --test-timeout=120000 ../tools/tests/*.test.js` | `npm test` (same flags, explicit file list) |
| Total time | 591.4 s | 422.0 s (-29 %) |
| tests / suites | 293 / 29 | 298 / 31 (the 5 new `app-fixture.test.js` tests) |
| pass / fail / skipped | 290 / 1 / 2 | 295 / 1 / 2 |
| test names (same TAP reporter) | 322 | 329: **0 lost**, 7 added (5 tests, 2 suites) |
| `waitForTimeout` mentions in `tools/tests` | 73 | 39 (2 are comments) |

The one counted failure and a second suite-level failure (`data-action names written in the source are all registered`, then in `legacy-bridge.test.js`, now in `window-contract.test.js`) are identical before and after: both are `Cannot find module 'acorn'` because `acorn` is not installed in the sandbox. The 2 skips are the same two hard-coded ones. Run `npm install` to get these tests to run.

Slowest/most-changed files (seconds, before -> after):

| File | Before | After |
| --- | --- | --- |
| `scroll` | 98.2 | 65-67 (5 runs) |
| `events-b` | 97.5 | 67.7 |
| `events-c` | 84.0 | 59.8 |
| `events-wiring` | 54.4 | 39.4 |
| `metadata-editor` | 29.5 | 20.1 |
| `legacy-bridge` | 24.5 | 19.4 |
| `lyrics-panel-handlers` | 23.1 | 17.7 |
| `ui-storage-api` | 21.9 | 16.5 |
| `playback-handlers` | 17.6 | 14.0 |
| `view-switch-song-list-cleanup` | 16.5 | 12.4 |
| `events-a` | 15.7 | 11.2-13.9 |
| `search-ui` | 12.2 | 9.2 |
| `converted-modules` | 9.9 | 6.0-6.4 (5 runs) |
| `ui-handlers` | 9.8 | 7.6-7.8 (5 runs) |

Why it was slow: every browser test opens a fresh page (about 0.8-1.2 s to load on one core) and then slept 500-1200 ms for start-up to finish; the sequence suites do that for each of their 97 scenarios. Start-up actually settles about 0.6 s after load, so `gotoApp` saves about a quarter of a second per page; the larger saving in `metadata-editor` came from waits after `await page.evaluate(asyncFn())`, which had already waited.

Concurrency (measured then with `SEQUENCE_PAGES=3`, when it was opt-in; today the default is 2 to 4 pages depending on the cores, a scenario that differs is run again alone in every mode, and the runner uses 1 page when it runs several files at once, see the `SEQUENCE_PAGES` row in section 3): `SEQUENCE_PAGES=3` ran `events-a` in 6.5 s (2 runs), `events-b` in 36.1/36.9 s and `events-c` in 33.9/32.1 s, all passing with the same recorded sequences.

Remaining bottlenecks (at the time): page load per test (about 1 s each), the 28 intentional waits in `scroll.test.js` (simulated user timing; 8 calls are left today, each with a comment), `online-metadata.test.js` (about 23 s of real retry back-off in the production code; its test now replaces the back-off and takes 0.2 to 0.3 s), and the 97 sequence-suite page opens. Run `npm run test:timing` to see the current numbers.

## 12. Plan 3 results (test content and maintenance, Agent C)

Environment of the numbers below (measured for step C-05, on the tree with the Phase 1 patches applied so far): Linux sandbox, 1 CPU core, Node v22.22.2, Playwright 1.56.0 with Chromium 141. npm's registry was not reachable: `acorn` and `acorn-walk` came from other local packages, and ESLint, `globals`, `jimp` and `music-metadata` were not installed (`sharp` was). So lint and the two real-ESLint tests could not run here (`node tools/lint.js` exits 2), and `scan-folder-tags` and `scanner` run without `jimp` and `music-metadata`. Each number is one run. Earlier runs of this suite in similar one-core sandboxes took 472 s (report C 0005, 57 files) and 414.8 s (report B 0006, 57 files), so expect the total to move by more than ten percent with the load of the machine. Not measured at all: Windows, a machine with several cores, GitHub Actions. Run `npm install` and repeat `npm run test:timing` once on your machine.

| | Value |
| --- | --- |
| Test files | 58 (20 unit, 38 browser) |
| `npm run test:timing`, one file after another | 359 s: 452 tests, 449 passed, 0 failed, 3 skipped (`scroll.test.js`, marked timing-sensitive, and the two real-ESLint tests in `lint.test.js`, which skip because ESLint is not installed here) |
| Slowest files | `scroll` 48 s, `events-wiring` 36 s, `events-b` 32 s, `events-c` 29 s, `ui-handlers` 17 s, `drag-drop` 17 s |
| Unit group, `node tools/tests/run.js unit` | 20 files, 165 tests (163 passed, 2 skipped: the real-ESLint tests), 2.7 s |
| Browser files in 3 shards (`--shard=i/3`) | 13, 13 and 12 files; measured seconds per part 117.5, 123.1 and 114.5 (355 s in all) |
| `waitForTimeout` in `tools/tests` (not counting comments) | `scroll.test.js` (8 calls, each with a comment saying it is the input or the observed window) and one 150 ms wait in `search-clear.test.js` (not reviewed by C) |
| `node tools/lint.js --strict --summary` | 136 files, 0 errors, 0 warnings (report C 0005; not repeated here, see the environment) |
| `node tools/event-audit.js --strict` | exit 0, total 0 (plus 70 allowed by `fileExceptions`) |
| `node tools/dep-map.js` | 115 files; mutable globals assigned from other files 58; file-level cycles 2 + 69; load-time cross-file references 148, forward 0 |

`npm run test:fast` was run three times by Agent B (report 0006): exit 0 each time, 287 tests, 1 skipped, in about 460 s. On that one-core machine the runner lowered the number of files at once to 1, so those runs show that the command works and the whole browser set passes with it, not how parallel runs behave. Four files at once on one core, forced before the cap existed, made `events-b`, `events-c` and `scroll` fail. Not measured: four files at once on a machine with four or more cores, and whether `npm run test:quick` finishes in under 10 s (the unit half takes 2.7 to 3.6 s; lint was not run).

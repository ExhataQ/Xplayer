# Testing guide

How to run the Xplayer tests, write new ones, and lint. Everything below was checked against this repository; where something could not be checked, it says so.

All commands are PowerShell, run from the repository root (the folder with `package.json`).

## 1. What is here

| Group | What it is | Files |
| --- | --- | --- |
| **unit** | Pure Node: no browser. Fast (most files finish in under a second). | `event-bus`, `language-detect`, `lint`, `lrc-parser`, `main-process-safety`, `manifest`, `metadata-backend`, `music-folders`, `online-metadata`, `recents`, `scan-folder-tags`, `scanner`, `search-engine`, `setters`, `shuffle`, `storage-core`, `storage` (`*.test.js`) |
| **browser** | Builds a throwaway copy of the real app, opens it in headless Chromium with a stubbed Electron API, and drives it. Each test file launches its own browser. | everything else in `tools/tests/*.test.js` |
| **sequence suites** | A kind of browser test: runs scenarios and compares the recorded order of UI calls with `tools/tests/expected/*.json`. | `events-a`, `events-b`, `events-c`, `events-d` (scenarios live in `helpers/scenarios-*.js`) |
| **Python logic test** | `metadata_backend_logic.py`, started by `metadata-backend.test.js`. Uses a stand-in for `mutagen` (`helpers/fake_mutagen.py`). | |

The runner decides unit vs browser by looking at what a file imports (`helpers/app-fixture`, `helpers/sequence-suite` or `playwright` means browser). See `npm run test:list` for the current split.

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
| `npm run test:list` | Shows which files would run and their group. Changes nothing. |
| `npm test -- shuffle` | Files whose name contains `shuffle`. Several words are allowed: `npm test -- shuffle scroll`. |
| `node --test tools/tests/shuffle.test.js` | One file, directly, with Node's own runner. |
| `node --test --test-name-pattern="several processes" tools/tests/songs-store.test.js` | One test (or a group) by name. The pattern is a regular expression matched against the test title. |
| `node --test --test-reporter=spec tools/tests/shuffle.test.js` | Same, but prints one line per test (names, pass/fail, time) instead of the compact TAP output. |
| `npm run test:timing` | Runs files one at a time and prints seconds, test counts and failures per file, slowest first. Use to find what got slow. |
| `node tools/tests/run.js --concurrency=2` | Runs two files at once. Default is 1. Browser files are timing-sensitive (see below), so check failures with 1 before blaming the code. |
| `$env:SEQUENCE_PAGES=3; node --test tools/tests/events-b.test.js` | Opt-in: the sequence suites open up to 3 scenario pages at once. Default 1. |
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
  * *skipped*: the test chose not to run. Expected today: 2 hard-coded skips (one in `scroll.test.js`, one in `storage.test.js`). More skips than that usually means a missing browser or Python.
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
4. Run `npm test` before committing (the full suite; about 10 minutes on a slow single-core machine, see the numbers below).
5. `git diff --check`, then read the final diff.
6. Report the exact commands you ran and their results (pass/fail/skipped counts), including anything you could not run.

Optional diagnostics: `npm run test:timing` (what got slower), `--test-reporter=spec` (per-test lines), `npm run lint` (missing imports and typos), repeated runs of a flaky test.

For the `src/js` module conversion, the gate files are `scroll`, `manifest`, `converted-modules`, `ui-handlers` (and `search-ui`, `view-switch-song-list-cleanup`) plus the manual page `tools/placeholder-test/test-placeholders.html`; run them 5 times in a row after each patch.

## 7. Maintenance

* **Adding a test file:** create `tools/tests/<name>.test.js`. Nothing else to register: the runner discovers it. Check with `npm run test:list` that it appears in the group you expect.
* **Discovery and groups:** `tools/tests/run.js` lists `*.test.js` in `tools/tests/` and puts a file in the *browser* group if its text matches `app-fixture`, `sequence-suite` or `require('playwright')`. Change `BROWSER_MARKER` in `run.js` if you add another browser helper.
* **Scripts live in** the root `package.json` (`test*`, `lint*`). `electron/package.json` keeps its older `test` script for compatibility.
* **Browser launch.** `helpers/app-fixture.js` `launch()` tries bundled Chromium, then Edge, then Chrome. `node --test` runs every file in its own process, so nothing in memory is shared between files. When started through `npm test`, the runner sets `XPLAYER_TEST_RUN_ID` and the files of that run share a small file in the temp folder that records which option worked, so later files try it first. A total failure is never recorded. When you run a single file by hand, nothing is cached.
* **`scroll.test.js`** still has its own copy of `loadPlaywright` and `buildApp` (different fake song data); only `launch` and `gotoApp` come from the shared fixture.
* **Docs:** when you change scripts, discovery, helpers or prerequisites, update this file in the same change. If the repository workflow asks for it, add a line to `tools/change.log.txt`.

## 8. Lint (errors fail, warnings are reported)

ESLint exists to catch missing imports and typos while the renderer moves from classic scripts to ES modules.

* Config: `eslint.config.js` (flat config, root). Rules: `no-undef`, `no-unused-vars` (warning), `no-unreachable`, `no-dupe-keys`, `no-self-assign`.
* The app's globals are **generated**, not listed: `tools/lint-globals.js` reads `src/manifest.json`, takes the top-level declarations of the classic scripts from `tools/dep-map.js`, and adds every key of a `registerLegacyGlobals({...})` call (in classic scripts and modules). Run `node tools/lint-globals.js` for the counts (measured with this change: 46 classic files, 67 modules, 929 names: 413 from classic declarations, 515 from `registerLegacyGlobals`, 1 from a window publication). A name that exists only inside a module and is not registered is *not* a global, so using it in another file without an import is reported.
* **One name is published on `window` instead of registered:** `updateExternalScrollbar`. `initExternalScrollbar('main-content', ...)` in `src/js/06c-scrollbar-widget.js` assigns `window.updateExternalScrollbar` during start-up and other files use it as a bare global. `WINDOW_PUBLISHED_GLOBALS` in `tools/lint-globals.js` lists it together with the one file allowed to publish it, and every lint run checks that file's syntax tree for a plain `window.updateExternalScrollbar = ...`; the run fails (exit 2, with a message) if the assignment is gone or the file is not in the manifest. A `window.x = ...` anywhere else does **not** become a global. Add a name there only for a real run-time publication, and update `tools/tests/lint.test.js`, which pins the list. Behavior of the published function (start-up order, which scrollbar it updates) is covered by `scrollbar-publication.test.js`.
* `manifest.modules` files are linted as ES modules, the other `src/js` files as classic scripts, `electron/` as CommonJS with Node globals (`electron/preload.js` also gets browser globals).
* Skipped: `src/js/99-player.js` (it contains the build token `{{SONGS_DATA}}`, which is not valid JavaScript), `tools/` and `tools/tests/`.
* Exit codes of `tools/lint.js`: `npm run lint` exits **1 if there is any error** (a parse error counts as one) and 0 otherwise, so warnings are only reported; `npm run lint:strict` exits 1 on any error **or warning**; 2 means ESLint could not run (not installed, or it threw). It prints every problem and a count per rule. Nothing is ever fixed automatically. `tools/tests/lint.test.js` runs the real script against a stand-in ESLint to check these codes, so the test needs no ESLint install.
* Needs `npm install` (adds `eslint` and `globals`; `globals` supplies the browser and Node built-in names, which ESLint does not include).

**Baseline counts per rule: not recorded yet.** The first real ESLint run (reported by the maintainer, before the lint-fix patch) found 21 errors and 13 warnings: 20 errors for `updateExternalScrollbar` (published at run time, now allowed as described above) and 1 for `lyricsSavedView` (a dead assignment in `src/js/08e-panel-settings.js`, removed). After that patch the expected result is 0 errors and the same 13 warnings; confirm with `node tools/lint.js --summary` and record the per-rule numbers in the table below. The 13 warnings are deliberately left alone. The configuration was first written without a working ESLint (no network). What was verified: the config module loads, its blocks cover every `src/js` file exactly once (112 files plus the skipped `99-player.js`, recounted from the manifest for this change), and the generated global names (above) include the names registered by `core/legacy.js`. To record the baseline:

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

`.github/workflows/test.yml` runs on `windows-latest` for every push and pull request: checkout, Node 24, `npm ci`, `npx playwright install chromium`, `npm test`. It does not run lint or any Electron test. `npm ci` needs `package-lock.json` to match `package.json`: after adding `eslint` and `globals`, run `npm install` once and commit the updated lock file, or `npm ci` will fail. The workflow has not been run (nothing was committed or pushed).

## 11. Measured results (record of the test-suite speed-up)

Environment: Linux sandbox, **1 CPU core**, Node v22.22.2, Chromium 141. Not measured on Windows. Each number is one run unless a count is given, so expect a few seconds of noise.

| | Before | After |
| --- | --- | --- |
| Full suite command | `cd electron; node --test --test-concurrency=1 --test-timeout=120000 ../tools/tests/*.test.js` | `npm test` (same flags, explicit file list) |
| Total time | 591.4 s | 422.0 s (-29 %) |
| tests / suites | 293 / 29 | 298 / 31 (the 5 new `app-fixture.test.js` tests) |
| pass / fail / skipped | 290 / 1 / 2 | 295 / 1 / 2 |
| test names (same TAP reporter) | 322 | 329: **0 lost**, 7 added (5 tests, 2 suites) |
| `waitForTimeout` mentions in `tools/tests` | 73 | 39 (2 are comments) |

The one counted failure and a second suite-level failure (`data-action names written in the source are all registered`, `legacy-bridge.test.js`) are identical before and after: both are `Cannot find module 'acorn'` because `acorn` is not installed in the sandbox. The 2 skips are the same two hard-coded ones. Run `npm install` to get these tests to run.

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

Opt-in concurrency: `SEQUENCE_PAGES=3` ran `events-a` in 6.5 s (2 runs), `events-b` in 36.1/36.9 s and `events-c` in 33.9/32.1 s, all passing with the same recorded sequences. It is off by default.

Remaining bottlenecks: page load per test (about 1 s each), the 28 intentional waits in `scroll.test.js` (simulated user timing, left alone), `online-metadata.test.js` (about 23 s of real retry back-off in the production code, not changed), and the 97 sequence-suite page opens. Run `npm run test:timing` to see the current numbers.

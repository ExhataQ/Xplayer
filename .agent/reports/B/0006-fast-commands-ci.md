# Agent B report 0006: fast commands, shards and CI

Steps: B-06. Also records the state of B-03 and B-05 after your verification (see "Status of B-03 and B-05"). Applies on top of: `Xplayer-main__1_.zip` (patches 0001 to 0005 are already in it).
Archive (.agent/AGENTS.md section 1): not done. The archive root `E:\Backup\Programming\Music player` is not reachable from this session. Work was done on an extracted copy of the uploaded zip, which was left untouched. Take the snapshot yourself before applying.

## Changes

- `tools/tests/run.js`
  - `--shard=i/n` keeps part i of n of the selected files. The files are spread by an approximate run time (`SHARD_SECONDS`, taken from a full `--timing` run of this tree, files of 5 s or more; everything else counts 3 s), heaviest first onto the lightest part, ties by name, so the split is identical on every machine. Over i = 1..n every selected file is in exactly one part. A wrong number in the table only makes the parts uneven; it never skips a file. A bad value (`0/3`, `4/3`, `abc`) exits 2 with a message.
  - An empty selection (for example an empty shard) now exits 2 with a message. Before, `node --test` was started without files and would have run whatever it finds in the folder.
  - `--concurrency=N` is now capped at the number of cores and the runner says so ("Running 1 file(s) at once instead of 4 ..."). With more than one file at once, each sequence suite uses one page unless `SEQUENCE_PAGES` is set, because the files already share the machine.
  - `run.js` can be `require`d (`main()` only runs when it is the entry point) and exports `discover`, `parseArgs`, `select`, `shardFiles`, `effectiveConcurrency`, `SHARD_SECONDS`, `DEFAULT_SECONDS`.
- `package.json`: `test:quick` = `node tools/tests/run.js unit && node tools/lint.js`; `test:fast` = `node tools/tests/run.js browser --concurrency=4`. Nothing else changed.
- `.github/workflows/test.yml` (valid YAML, parsed with PyYAML here):
  - job `unit-and-lint` on `ubuntu-latest`: checkout, Node 24 with npm cache, `npm ci`, `npm run test:quick`.
  - job `browser` on `windows-latest`, matrix `shard: [1, 2, 3]`, `fail-fast: false`: checkout, Node 24, `npm ci`, cache of `~\AppData\Local\ms-playwright` (key `playwright-<os>-<hash of package-lock.json>`), `npx playwright install chromium`, `node tools/tests/run.js browser --shard=<n>/3`.
  - Coverage: the unit files run in the first job and each browser file in exactly one shard of the second, so every test file runs exactly once.
- `tools/tests/run-shards.test.js` (new, unit, 8 tests): for 1, 2, 3, 4 and 7 shards the parts are disjoint and together are every file (all, unit and browser selections); the split does not depend on the order of the file list; no part exceeds the average load by more than the heaviest file; every file in the weight table exists; `--shard` is validated; the workflow matrix is `1..N` and the command says `/N`, `test:quick` runs the unit files and lint, `test:fast` is the 4-file browser command; the concurrency cap works. Not in the plan's file list: it is the check for the "covers every file exactly once" done-when and fails if someone adds a shard or edits the workflow without the other side. Delete it if you do not want it.
- `tools/tests/helpers/sequence-suite.js` (a B-03 file, changed again): a scenario that differs from its recorded sequence (or has page errors) is now run again alone whatever the number of pages. Before (report 0005) this happened only when several pages ran at once. Reason, measured below: other test files running at the same time flip the same timing-sensitive scenarios, and with one page per suite there was no retry. Recording a baseline never retries. Consequence: `SEQUENCE_PAGES=1` is no longer a strict check; a scenario that only matched on the second try is named in a diagnostic line (`... were run again alone ...`). A real regression still fails (checked again, see below). The comment in the file is updated.
- `tools/change.log.txt`: one entry.
- Not changed: `src/`, `electron/`, `expected/*.json`, any other test.

## New commands (for C-05 and the README)

| Command | What it does |
|---|---|
| `npm run test:quick` | The 20 unit files, then lint. For use while developing. |
| `npm run test:fast` | The 38 browser files, up to 4 at once (never more than the number of cores; it prints a line when it lowers the number). |
| `node tools/tests/run.js browser --shard=2/3` | Part 2 of 3 of the browser files (what CI runs). Works with `--list` and `--timing` too. |
| `node tools/tests/run.js --concurrency=N` | As before, but capped at the number of cores. |
| `SEQUENCE_PAGES` | Sequence suites use up to 4 pages (at least 2); `SEQUENCE_PAGES=<n>` overrides; the runner sets 1 when it runs several files at once. A scenario that differs is run again alone (see above). |

`tools/tests/README.md` (C's) is stale in two places: line 53 (`--concurrency`, "Default is 1" and no cap) and line 54 (`SEQUENCE_PAGES` called opt-in, "up to 3", default 1); the numbers near line 266 were measured with `SEQUENCE_PAGES=3`. C-05 should also list the commands above.

## Numbers

Sandbox: 1 vCPU, Node v22.22.2, Playwright 1.56.0 with Chromium 1194. `acorn` and `acorn-walk` were made visible through `NODE_PATH` from other global packages (outside the project). Not installed here: `eslint`, `globals`, `jimp`, `music-metadata`. `lint.test.js` still passes (10 tests) and `scan-folder-tags` / `scanner` pass without `jimp` / `music-metadata`.

Full suite of this tree, one file at a time (`node tools/tests/run.js --timing`): 57 files, 442 tests, 441 passed, 0 failed, 1 skipped, 414.8 s. Report 0001 measured 643.6 s on 55 files in the same sandbox, but 8 files failed there because `acorn` was missing and the tree has changed since (C and D patches), so the two totals are not like for like. Files B worked on (seconds, report 0001 -> now): `scroll` 74.8 -> 55.8, `events-b` 81.9 -> 37.7, `events-c` 70.4 -> 33.1, `events-wiring` 49.2 -> 38.7, `modal-close` 42.5 -> 3.7, `events-a` 12.8 -> 7.3, `online-metadata` 23.3 -> 0.2, `view-switch-song-list-cleanup` 14.8 -> 12.8, `events-d` 0.7 -> 0.5. Several of these (events-*) are in 2-page mode here; a 1-core machine gains least.

Unit files: `node tools/tests/run.js unit` takes 3.6 s on a warm copy and 6.9 s on a freshly extracted one (20 files, 163 tests, exit 0). Lint could not run here (exit 2, "ESLint is not installed"), so the target of under 10 s for `test:quick` is NOT measured; the unit half is 3.6 to 6.9 s here, so lint would have to take only a few seconds on your machine.

Shards of the 38 browser files: 13, 13 and 12 files; sum of the measured seconds per part 138, 139 and 133 s (from the table above), against 411 s in total.

`npm run test:fast`, run 3 times, final code, in this sandbox: exit 0 each time, in 461, 469 and 458 s; each run 287 tests, 286 passed, 0 failed, 1 skipped (the one already skipped in `scroll.test.js`), no file failed and no scenario needed the run-alone retry. In this sandbox the cap lowers it to 1 file at a time (1 core), so these three runs show that the command works from `npm` and that the whole browser set passes with it; they do not show how parallel runs behave. They took about 8 minutes each, slower than the 411 s sum of `--timing` for the browser files; I did not investigate why.

## Files that fail only when run in parallel

Measured before the cap existed, by forcing 4 files at once on this 1-core machine (3 runs; 35 of the 38 files passed every time):

| Run | Setting | Result |
|---|---|---|
| 1 | 120 s hang guard | `events-b`, `events-c`, `scroll` ended with "test timed out after 120000ms" (they take 37.7 s, 33.1 s, 55.8 s alone); 312 s in all |
| 2 | hang guard scaled to 480 s, retry only with several pages | `events-b` failed on "mutation refresh: album view" (one extra `updateActiveHighlight`); 336 s |
| 3 | retry in every mode (the `sequence-suite.js` change above) | `events-b` failed again: two scenarios differed ("mutation refresh: album view" and one more), were run again alone and still differed, because three other files were still loading the one core; 333 s |

All three files pass alone. This is a limit of the machine (4 files on 1 core), not a defect in the tests or the code under test: the recorded order of those scenarios depends on a fixed 120 ms wait next to app timers (see report 0005, note for D). A retry cannot help while the machine stays overloaded, so the fix is the cap: never more files at once than cores. What was NOT measured: 4 files at once on a machine with 4 or more cores. The first real answer is your `npm run test:fast` three times.

## Tests actually run

- `node --test tools/tests/run-shards.test.js`: 8 passed.
- `node tools/tests/run.js unit`: exit 0, 3.6 s. `node tools/tests/run.js --timing` over all 57 files: 441 passed, 1 skipped, 0 failed.
- `npm run test:fast` three times (above); 3 forced 4-at-once runs (above).
- Error paths of `run.js`: `--shard=4/3`, `--shard=abc` and an empty shard (`events-d --shard=2/2`) exit 2 with a message; `--list` with `--shard` shows 13, 13, 12 files.
- Regression check for the `sequence-suite.js` change: on a copy of the tree one recorded sequence in `expected/events-b.json` ("audio ended, repeat one: All Songs view, portable panel closed") got an extra call. With `SEQUENCE_PAGES=1` and with the default pages the file fails (75 s and 45 s), so a real regression still fails after the retry.
- Workflow YAML: parsed with PyYAML (two jobs, matrix `[1, 2, 3]`, cache path `~\AppData\Local\ms-playwright`). GitHub Actions itself was not run.
- Not run, and why: `npm run lint`, `lint:strict` and so `npm run test:quick` as a whole (`eslint` not installed, no network); anything on Windows; the CI workflow on GitHub.
- `src/`, `electron/` and `expected/*.json` are identical to the zip.

## Status of B-03 and B-05

- B-03: `expected/events-d.json` is byte-identical to the original snapshot; `events-a.json`, `events-b.json` and `events-c.json` are not, and none of that comes from B: patch 0005 contained no `expected/` file, and the differences are the re-recordings documented in D's reports 0001 (`events-c`), 0002 (`events-b`) and 0004 (`events-a`, `events-b`). All four suites pass in the 3 `test:fast` runs and in the full timing run. Still needed from you: the Windows timing and the `events-b` runs from report 0005's manual checks.
- B-05: the part "build the fixture once per run" is still not done, deliberately (about 11 ms per `buildApp` here, 35 calls). It stays open until you send the Windows time from report 0003 (`node -e "const f=require('./tools/tests/helpers/app-fixture');let t=Date.now();for(let i=0;i<10;i++)f.buildApp(50);console.log((Date.now()-t)/10,'ms per build')"`) or waive it. "Before and after for 3 other browser files" does not apply: no other browser file was changed by B-05; the full table above is the current record for all files. My recommendation: waive the shared build unless your number is above about 200 ms.

## Needs from other agents

- C: README lines 53, 54 and the timing numbers near line 266, and the new commands above (C-05).
- D (`tools/tests/helpers/scenarios-b.js`): unchanged from report 0005: "mutation refresh: album view" and "mutation refresh: artist view" are timing sensitive; waiting for the app's timers instead of a fixed 120 ms would make the run-alone retry nearly unnecessary and is D's decision because it changes what is recorded.

## Not done

- Lint time for `test:quick` (needs your machine).
- Parallel stability on a machine with 4 or more cores, and the Windows CI run.
- The unit files now run on Linux only in CI (before, everything ran on Windows). If a unit test depends on Windows paths it would now fail only there; none did in this sandbox.
- B-05 shared build (above).

## For you (manual checks)

1. Apply the patch, then `npm run test:quick` -> unit files pass, lint passes; note the total time (target under 10 s).
2. `npm run test:fast` three times -> exit 0 each time; note the line "Running N file(s) at once" if it appears (N should be 4 on a machine with 4 or more cores) and the time against `npm test`. If any file fails only here, send me its name and the output.
3. `node tools/tests/run.js browser --shard=1/3 --list` (and 2/3, 3/3) -> 13, 13 and 12 files with no file repeated.
4. Push to a branch: the `unit-and-lint` job and the three `browser` jobs should all pass; on the second push the Playwright cache step should say "Cache restored". If the cache never restores, the path or key needs a change.
5. Optional: add one extra call name to an array in a scratch copy of `tools/tests/expected/events-b.json` and run `node --test tools/tests/events-b.test.js` -> it fails naming that scenario, also with `SEQUENCE_PAGES=1`.

## Next step

Phase 1 B tasks are done once you have checked B-03 and B-05 as described above. B-06 is the last open B step; C-05 depends on this report.

# Agent C report 0006: README after B-06

Steps: C-05 (the README half; the sleeps in C's six files were replaced in report 0005 and are re-checked here). Applies on top of: `Xplayer-main__1_.zip` (the tree with C-0001 to C-0005 and B-0001 to B-0006 applied).
Archive (.agent/AGENTS.md section 1): not done. `E:\Backup\Programming\Music player` is not reachable from this session. I worked on an unzipped copy and kept an untouched copy next to it; the result is the patch `C-0006-readme-b06-commands-ci.patch`. Take your own snapshot before you apply it.

## Changes

- tools/tests/README.md, section 1: the unit list and its count include `run-shards` (20 files); the line under the table says 58 files: 20 unit, 38 browser, which is what `npm run test:list` prints. It said 57 and 19.
- Section 3: new rows for `npm run test:quick` (unit files, then lint; the lint half exits 2 without ESLint), `npm run test:fast` (browser files, up to 4 at once, never more than the cores) and `node tools/tests/run.js browser --shard=2/3` (disjoint parts, the same split on every machine, bad values and an empty part exit 2). The `--concurrency` row: capped at the number of cores, the line the runner prints when it lowers the number, one page per sequence suite when several files run at once, and B's measurement that four files at once on one core made `events-b`, `events-c` and `scroll` fail (all pass alone). The `SEQUENCE_PAGES` row: the number of pages is the cores but at least 2 and at most 4 (it said "at most the number of cores", which is wrong on one core), a scenario that differs is run again alone with any number of pages (it said only when pages ran in parallel), so `SEQUENCE_PAGES=1` is no longer a strict check.
- Section 5: the expected skips: 1 hard-coded, plus the two real-ESLint tests when ESLint is not installed.
- Section 6: step 4 points to `test:fast` and `test:quick`; "about 10 minutes" is now "about 6 minutes" (359 s measured, section 12).
- Section 7: a bullet for the shard weight table (`SHARD_SECONDS`: a wrong number makes the parts uneven, never drops a file) and the owner of the new facts: `run-shards.test.js` (every file in exactly one shard, the workflow matrix and the `/N` agree).
- Section 8: the lint baseline paragraph says it is dated ("1 warning") and points to the later 0-warning run in section 12. It contradicted section 12.
- Section 10: rewritten for the two-job workflow: `unit-and-lint` on Ubuntu (`npm run test:quick`) and `browser` on Windows in 3 shards with the Playwright cache; every file runs once; what is not confirmed. It said one Windows job running `npm test`, and "does not run lint".
- Section 11 (historical record): the concurrency note ended with "It is off by default" right after saying it is on by default; it now says the measurement used `SEQUENCE_PAGES=3` and what the default is today. "28 intentional waits in `scroll.test.js`" is 8 calls today, each with a comment. "About 23 s of real retry back-off" in `online-metadata` is mocked since B-04 (0.2 to 0.3 s). The moved data-action test is named where it lives now.
- Section 12: new environment note and a new table from a fresh run of this tree (below), the shard sizes and the unit group, and what was not measured.
- tools/change.log.txt: one entry. .agent/BOARD.md: C-05 is `patch received`, and the C bullet lists the checks for your machine.
- Not changed: any test file, `src/`, `electron/`, `run.js`, the workflow.

## Numbers

Environment: Linux sandbox, 1 CPU core, Node v22.22.2, Playwright 1.56.0, Chromium 141. Not installed: ESLint, `globals`, `jimp`, `music-metadata` (`sharp` is). So lint and the two real-ESLint tests cannot run here.

`npm run test:timing` (all files, one after another, one run): 58 files, 452 tests, 449 passed, 0 failed, 3 skipped, 359.0 s. The 3 skips: `scroll.test.js` (hard-coded), and the two real-ESLint tests in `lint.test.js` (ESLint missing). Slowest: `scroll` 48.1 s, `events-wiring` 35.5 s, `events-b` 31.9 s, `events-c` 28.5 s, `ui-handlers` 17.3 s, `drag-drop` 16.9 s. Earlier one-core runs of this suite: 472 s (report 0005, 57 files) and 414.8 s (report B 0006, 57 files), so the total varies by more than ten percent between runs.
`node tools/tests/run.js unit --concurrency=4`: exit 0, 165 tests, 163 passed, 2 skipped, 2.7 s; the runner printed "Running 1 file(s) at once instead of 4: this machine has 1 core(s) ...".
Shards of the 38 browser files (`--list`): 13, 13 and 12 files; measured seconds per part from the run above 117.5, 123.1 and 114.5 (355.1 in all); all 38 files appear exactly once.
`node tools/event-audit.js --strict`: exit 0, Total 0 (plus 70 allowed by `fileExceptions`).
`node tools/dep-map.js`: 115 files; mutable globals assigned from other files 58; file-level cycles 2 + 69; load-time cross-file references 148 (forward 0). Unchanged from report 0005.

## Tests actually run

- `node tools/tests/run.js --timing` over all 58 files: above.
- `node tools/tests/run.js browser --shard=4/3`, `--shard=abc`, `--shard=0/3`: exit 2 with "Bad --shard=...". `events-d --shard=2/2` (an empty part): exit 2, "No test files selected".
- A script over the finished README: the unit files in the table are exactly the 20 that `--list` prints; "58 files: 20 unit, 38 browser" matches; every `npm run <name>` it mentions exists in `package.json` and every script is mentioned; every table row has the same number of cells as its header; no mention of `tools/spike-modules/` or `tools/test-shuffle/`; the six files named in the commands and CI sections exist.
- `grep` for `waitForTimeout` in `tools/tests`: `scroll.test.js` 8 calls, each with a comment saying why; `search-clear.test.js` 1 (D's file); `helpers/app-fixture.js` and `app-fixture.test.js` mention it only in comments. None of C's six files has one.
- Not run, and why: `npm run lint`, `lint:strict` and so `npm run test:quick` as a whole (`node tools/lint.js` exits 2, ESLint is not installed and there is no network); `npm run test:fast` (B ran it three times, report 0006; the README attributes the numbers to B); anything on Windows; the CI workflow on GitHub; the real Electron application. The lint line in section 12 (136 files, 0 errors, 0 warnings) is from report 0005, not repeated.

## Needs from other agents

- D: `tools/tests/search-clear.test.js` line 37 still has a 150 ms `waitForTimeout` after a debounced search (D's file; the `searchQuery` wait used in `search-ui.test.js` would replace it). Not changed by C.
- B: nothing new. B-03 and B-05 stay open as the board says; the README does not depend on them. If B changes a command, the section 3 rows and the CI text are the places to update.

## Not done

- Numbers from your machine: Windows timing, `npm run test:fast` and the lint time on several cores, the workflow running on GitHub. Section 12 says so where it applies.
- C-01 still has no line-by-line read of every test file (see report 0005).

## For you (manual checks)

1. `npm install`, then `node --test tools/tests/lint.test.js` -> 12 tests, 0 skipped (here 2 skip because ESLint is missing).
2. `npm run test:quick` -> unit files pass, then lint reports 136 files, 0 errors, 0 warnings. Note the total time; the plan's target is under 10 s.
3. `npm run test:fast` (a few times) -> all browser files pass; compare the time with `npm run test:browser`.
4. `npm run test:timing` once -> compare with section 12 and send the numbers if they differ a lot.

## Next step

Phase 1 can close for C once you have applied this patch and run the checks above. Phase 2 can start when B-03 and B-05 are also applied + verified and no other agent has a patch in flight.

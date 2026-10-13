# Agent C report 0003: order checks and tool tests

Steps: C-04, except one case that is still open (see "Not done"). Applies on top of: C-0002-inline-handler-rule.patch (which applies on C-0001; all three append to `tools/change.log.txt`, so apply them in order).
Archive (.agent/AGENTS.md section 1): not done. `E:\Backup\Programming\Music player` is not reachable from the sandbox I worked in. I worked on an unzipped copy of Source-backup.zip and changed nothing in your project; the result is this patch. Take your own snapshot before you apply it.

## Changes

- tools/tests/listener-order.test.js: the page is loaded once and the five tests read the same recording (it was loaded once per test). The header no longer says that moving a file between "js" and "modules" in `src/manifest.json` changes its order; those lists are gone, the order of the imports in `src/js/main.js` is what matters.
- tools/tests/event-subscribers-modules.test.js: same single page load (four loads became one). The test "the page loads the subscribers through the module entry, not as classic scripts or tags of their own" is removed, with the two `page.evaluate` calls that fed it. The header lists what is still checked.
- tools/tests/app-fixture.test.js: the case "without a run id nothing is cached" is removed.
- tools/tests/lint.test.js: the describe "lint.js tally and exit code" (two tests), the import of `tally` and `exitCodeFor`, and the test "--summary leaves out the per-problem text" are removed.
- tools/change.log.txt: one entry.

## What was cut, and what covers it

| Cut | Why it is safe | Check |
|---|---|---|
| event-subscribers: page has one module entry and no classic subscriber script | `manifest.test.js` "the rendered page has the player.js tag and exactly one other script: the module entry" and "has no hand-written renderer script/stylesheet tags" assert it on the rendered template; the subscribers are imported by `main.js` (the static test that stays) | Scratch copy: `<script src="js/04h-recents-history-events.js">` added to the template: `manifest.test.js` fails (2 tests) |
| lint: `tally` counts and per-rule table | The script tests print and assert the error and warning counts, and "a parse error counts as an error" asserts the no-ruleId case through the exit code | Scratch copy: `tally` ignores errors without a ruleId: lint.test fails (1) |
| lint: `exitCodeFor` table | The same mapping is asserted through the script: warnings only (0, and 1 with `--strict`), any error (1, also with `--strict` and `--summary`), clean (0) | Scratch copy: strict no longer fails on warnings: fails (1). Errors no longer fail: fails (2) |
| lint: `--summary` text | Display only. The exit code in `--summary` mode is still asserted in "any error" | none needed |
| app-fixture: no run id, nothing cached | The cache is a speed-up and `launch` still tries every browser option when the cached one fails. The case that matters, a total failure is never remembered, stays in the next test | none needed |

## What stays, and why

- manifest.test.js (untouched): the static facts about `main.js`: `core/legacy.js` is first (every file registers its names with it while loading), each file imported once, every file imported.
- event-subscribers-modules: the subscribers are imported right after `core/startup.js` (stated nowhere else); each registers once, in file and source order; nothing is emitted before its subscriber exists; the recording sees the bus.
- listener-order: the four runtime orders (keydown, mousedown, click, resize) and the sanity check. These overlap with "`core/legacy.js` is first" only partly: that one is the cause for names, these are the observed listener order, which also covers `04a`, `06a`, `06d`, `06k`, `09`, `ui/layout.js` and `19`.
- app-fixture: browser fallback order (bundled Chromium, Edge, Chrome); null when none starts or Playwright is missing (callers skip instead of crashing); the working option is tried first and a total failure is not cached; the settle wait does not run into the 3 s ceiling. Every browser file depends on these.
- lint: exit 0 clean; warnings pass `npm run lint` and fail `--strict`; any error fails in every mode; a parse error fails; ESLint missing or throwing is exit 2, never 0; the four `lint-globals` tests.

## Numbers

`node tools/tests/run.js --timing listener-order event-subscribers-modules app-fixture.test lint.test manifest`, two runs before and two after:

| File | Before | After |
|---|---|---|
| listener-order.test.js | 6.7-7.6 s, 5 tests | 1.8 s, 5 tests |
| event-subscribers-modules.test.js | 5.7 s, 7 tests | 1.8 s, 6 tests |
| lint.test.js | 1.2-1.6 s, 13 tests | 1.2-1.3 s, 10 tests |
| app-fixture.test.js | 0.8 s, 5 tests | 0.8-0.9 s, 4 tests |
| manifest.test.js (untouched) | 0.1 s, 13 tests | 0.1 s, 13 tests |
| Total | 14.5-15.8 s, 43 tests | 5.9 s, 38 tests |

All pass, none skipped. Test files that start a browser: unchanged (the same four).
`node tools/dep-map.js`: 115 files, mutable globals assigned from other files 58, file-level cycles 2 + 69, forward load-time references 0 (the 148 versus the plan's 27 is explained in report 0001). `node tools/event-audit.js --strict`: exit 0, Total 0 (plus 70 allowed by fileExceptions). Both re-run after this patch; unchanged.

## Tests actually run

- `node --test` on the five files: 38 pass, 0 fail. Control with nothing mutated in the scratch copy: 34 pass across the four edited files.
- Mutation checks, in a scratch copy through `SOURCE_ROOT` (or a copy of the tree for `lint.js`): `06k` imported before `06a` in `main.js`: listener-order fails (3). `04h` and `04i` swapped: event-subscribers-modules fails (2). The lint and template cases are in the table above.
- Not run, and why: `npm run lint` (ESLint is not installed in my sandbox); the full suite (the plan says not to).

## Needs from other agents

- none

## Not done

- C-04 says to keep "that lint fails on an undefined name". No test does that today: `lint.test.js` feeds canned results to `tools/lint.js`, so it checks the exit codes but not that the config reports `no-undef`. I did not add one because ESLint is not installed where I work, so I could not run it. Design, if you want it: skip when `require('eslint')` fails; in a temp dir put `tools/lint.js`, `tools/lint-globals.js`, `tools/dep-map.js`, `tools/lib/`, the root `eslint.config.js`, a manifest and a `main.js` that import one file containing `export const x = notDefined;`; run `tools/lint.js`; expect exit 1 and `no-undef` in the output. Say so and I will write it when I can run it, or write it unverified and mark it as such.
- `event-subscribers-modules.test.js` still pins "the 36 subscriptions the sources write are the ones the report lists". It will fail whenever a subscription is added. I left it, it is not part of C-04.

## For you (manual checks)

None; no application behavior changed.

## Next step

C-02. C-05 still waits for C-02 and the B-06 report.

# Agent C report 0001: unskip the storage getter test

Steps: C-01 (the skipped tests; the in-file duplicate check is done as a text scan only, see "Not done"). Applies on top of: Source-backup.zip (the 2026-10-12 backup of Source; every task on `.agent/BOARD.md` is still `todo`).
Archive (.agent/AGENTS.md section 1): not done. `E:\Backup\Programming\Music player` is not reachable from the sandbox I worked in. I worked on an unzipped copy of Source-backup.zip and changed nothing in your project; the result is this patch. Take your own snapshot before you apply it.

## Changes

- tools/tests/storage.test.js: `loadStorageWith` also vm-loads `03c-playlists.js`. That file has no top-level DOM or window work (only exported functions), so `getPlaylists` now exists in the test context.
- tools/tests/storage.test.js: the test "storage getters fall back to empty arrays when JSON is malformed" is no longer skipped, and the comment that explained the skip is gone. The skip reason (getPlaylists moved to 03c) was a limit of the test's loader, not of the code.
- tools/tests/storage.test.js: in "wrong-shaped saved data is repaired on read" the playlist assertion sat inside `if (typeof context.getPlaylists === 'function')`. The function was never defined there, so the assertion never ran. The guard is removed.
- tools/tests/storage.test.js: the header and loader comments said the topic files are "classic scripts"; they export functions, so the wording says that.
- tools/change.log.txt: one entry.

Why rewritten and not deleted: `storage-core.test.js` checks the generic `storageReadJson` fallback. No other test checks that each of the nine getters passes the right key and the right fallback, which is what this test does.

## Numbers

`node tools/tests/run.js --timing storage ui-handlers` (matches 4 files; only `storage.test.js` is touched by this patch), run twice before and twice after:

| File | Before | After |
|---|---|---|
| storage.test.js | 0.1 s, 4 tests, 3 pass, 1 skip | 0.1 s, 4 tests, 4 pass, 0 skip |
| storage-core.test.js (untouched) | 0.1 s, 12 pass | 0.1-0.2 s, 12 pass |

`node tools/dep-map.js`: identical before and after (115 files, mutable globals assigned from other files 58, file-level cycles 2 + 69, forward load-time references 0). Load-time cross-file references print as 148 on the untouched backup, not 27 as in `.agent/PLAN.md` section 1; nothing in this patch can change that number, so it is a difference between my run and the plan's measurement (I used acorn 8.16.0, the lock file asks for 8.18.0). Worth one look on your machine.
`node tools/event-audit.js --strict`: exit 0, Total 0 (plus 70 allowed by fileExceptions).

## Tests actually run

- `node --test tools/tests/storage.test.js`: 4 pass, 0 fail, 0 skipped.
- Check that the test can fail: temporarily changed the fallback in `getPlaylists` from `[]` to `null`; the test failed (3 pass, 1 fail). Restored, byte-identical.
- `node tools/tests/run.js --timing storage ui-handlers`, before and after (above).
- Not run, and why: `npm run lint` (ESLint is not installed in my sandbox); the full suite (the plan says not to); `npm run test:list`.

## Needs from other agents

- B: `scroll.test.js` line 351, "a tiny thumb nudge shows real rows only, no placeholders", is skipped with "timing-sensitive in this sandboxed environment". I removed the skip in a scratch copy and ran it 3 times: it failed 3 of 3 with "placeholders flashed during a tiny nudge", expected 0, actual 6. So the skip reason still holds here. I did not change the file. When B-02 replaces the fixed sleeps in that test (40 ms and 300 ms waits), B can try again and either unskip it or report it as a product bug for D.

## Not done

- C-01 asked to check every `*.test.js` for tests that repeat an assertion made by another test in the same file. I only did a text scan: duplicate test titles, and assertion lines repeated four or more times in one file. Nothing in the results is a duplicate test. The repeats are the per-test page-error guard (`assert.deepEqual(errors, [])`, in 13 files) and per-test state checks (`modal-close`, `drag-drop`). The only repeated title prefixes (`shuffle dialog:` in playback-handlers, `06b:` in ui-storage-api) are different tests. A read of each file would still be needed to rule out repeats that are worded differently.

## For you (manual checks)

None; no application behavior changed.

## Next step

C-03 (patch 0002, on top of this one). C-02 and C-04 have no dependencies and can follow; C-05 waits for C-02 to C-04 and the B-06 report.

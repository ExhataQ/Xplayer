# Agent C report 0002: inline handlers as one rule

Steps: C-03. Applies on top of: C-0001-unskip-storage-test.patch (both touch `tools/change.log.txt`; apply 0001 first).
Archive (.agent/AGENTS.md section 1): not done. `E:\Backup\Programming\Music player` is not reachable from the sandbox I worked in. I worked on an unzipped copy of Source-backup.zip and changed nothing in your project; the result is this patch. Take your own snapshot before you apply it.

## Changes

- tools/tests/ui-handlers.test.js: the `INLINE_CEILING` table and its 13 tests ("<file>: at most 0") are replaced by one test, "renderer source and the page template have no inline handlers beyond the listed exceptions". It scans every `.js` and `.html` file under `src/` and `build/music_player.html`.
- tools/tests/ui-handlers.test.js: comments are blanked out before matching (found with the acorn tokenizer, so a string that contains `/*` is not mistaken for a comment). A comment in `03l-import-export.js` mentions `onclick="..."` and would otherwise be counted. The tokenizer also reads `99-player.js`, which is a build template and does not parse as a program.
- tools/tests/ui-handlers.test.js: the event list is wider than before (added dblclick, mouseup, mouseover, mouseout, focus, submit, keyup, keypress, load, drag*, drop, wheel, scroll); `setAttribute('on...` is still matched. On the current tree the wider list finds no handler the old list did not: 10 real handlers in 4 files, with the same counts as the exception table (the old pattern run on the raw text finds 11, the extra one being the comment in `03l`).
- tools/tests/ui-handlers.test.js: new `INLINE_EXCEPTIONS` table, four entries, listed under "Needs from other agents". A listed file may not gain a handler. The test also fails, with the file name, when a listed file no longer exists.
- tools/tests/ui-handlers.test.js: the header comment named "Agent D, step D-05" and a report path; it now describes the file.
- tools/tests/ui-handlers.test.js: the 12 browser tests are untouched.
- tools/change.log.txt: one entry.

The old ceilings covered 13 files: all 0. The plan asked for one test over all of `src/`. That is wider, and it found handlers the old test could not see.

## Numbers

`node tools/tests/run.js --timing storage ui-handlers`, run twice before and twice after:

| File | Before | After |
|---|---|---|
| ui-handlers.test.js | 17.4-19.3 s, 25 tests, 25 pass | 19.0-19.1 s, 13 tests, 13 pass |

The time is the 12 browser tests (about 1.3 s each plus startup); the static check takes about 0.14 s. This patch is about test count and coverage, not speed. Tests that start a browser: unchanged.
`node tools/dep-map.js`: identical before and after (115 files, mutable globals 58, file-level cycles 2 + 69, forward load-time references 0; the 148 versus the plan's 27 is explained in report 0001).
`node tools/event-audit.js --strict`: exit 0, Total 0 (plus 70 allowed by fileExceptions).

## Tests actually run

- `node --test tools/tests/ui-handlers.test.js`: 13 pass, 0 fail, 0 skipped (a browser did start here; the 12 browser tests ran).
- Check that the rule can fail, one case each in a scratch copy through `SOURCE_ROOT` (the working files were not touched):

| Scratch change | Result |
|---|---|
| Only comments (line and block) that mention `onclick="..."` added to `04h` | pass |
| `` `<button onclick="x()">` `` added to `06a-context-menus.js` (had a ceiling before) | fail |
| The same added to `04h-recents-history-events.js` (the old test never looked at it) | fail |
| `setAttribute('onclick', ...)` added to `05a-lazy-load-main-list.js` | fail |
| A seventh handler in `09-folders-playlists.js` (listed with 6) | fail |
| `<button onclick="x()">` added to `build/music_player.html` | fail |
| `09-folders-playlists.js` renamed in the copy | fail: "is listed as an exception but does not exist" |

- Not run, and why: `npm run lint` (ESLint is not installed in my sandbox); the full suite (the plan says not to).

## Needs from other agents

- D (owns `src/`): 10 inline handlers are still written in the source and are the whole `INLINE_EXCEPTIONS` list. `03l-import-export.js` 2 (the merge and replace buttons, which pass the imported data as an argument); `03m-library-folder-render.js` 1 (`selectLibraryFolder(this, ..., event)`); `08d-panel-right-tabs.js` 1 (the close button, `closeExtendedInfoPanel()`); `09-folders-playlists.js` 6 (the All Songs and Liked Songs rows: click, context menu, and `event.stopPropagation()` on the cover play button). They are not in D's plan. If D converts them, tell C and the entries go. If D decides to keep any, the list is where that decision is written down.
- A: when A-03 moves the renderer files, the four paths in `INLINE_EXCEPTIONS` have to follow. If one is missed, the test says which file does not exist; it does not pass silently.

## Not done

- `build/music_player.py` is not scanned. It builds the page and is not renderer source; if it ever writes an inline handler into the template, this test does not see it. Tell me if you want it covered.
- The line-comment handling in `.html` files is not done: a handler inside an HTML comment would be counted. There is none now.

## For you (manual checks)

None; no application behavior changed.

## Next step

C-02 or C-04 (no dependencies). C-05 waits for C-02 to C-04 and the B-06 report.

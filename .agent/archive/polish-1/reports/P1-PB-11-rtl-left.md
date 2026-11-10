# Report: PB-11 Right-to-left text stays on the left

**Task:** PB-11 | **Agent:** B | **Date:** 2026-10-21 | **Status:** In review

## Summary
Persian and Arabic titles in the song list were flush right in their cell. They now start on the left like English ones. Letter order still follows each text's own direction (`unicode-bidi: plaintext` is kept). This reverses the right-aligned part of D29, as the owner decided in round 2.

## Findings (investigations)
- `adapter/songlist-rows.css`, block "Right-to-left titles": `unicode-bidi: plaintext` with `text-align: start`. With `plaintext`, `start` follows the text's own direction. *Reproduced*: with a Persian title the text's right edge equaled the cell's right edge (814 = 814); the English title started at 481.
- `views/library/search-view.css:73` also has `text-align: start`, but it is on the recent-search button, not on user text. Left unchanged. *Read*
- Other `unicode-bidi: plaintext` rules (lyrics, find lyrics) are other views and belong to C. Not touched.
- Library panel rows: not checked for right-aligned user text. Follow-up.

## Changed files
| File | Change |
|---|---|
| `src/ui-next/adapter/songlist-rows.css` | `text-align: start` to `left` for title, artist and album; comment updated |
| `tools/tests/ui-next-songlist.test.js` | New test: Persian, Arabic and English titles start at the cell's left edge and keep `unicode-bidi: plaintext` |
| `.agent/BOARD.md` | PB-11 In review; PB-06 Blocked; reports table |

## Decisions made or needed
None. The owner's round 2 decision is applied.

## Checks
| Command or step | Result |
|---|---|
| Headless probe on the pristine copy, 3 rows (Persian, Arabic, English) | Persian and Arabic flush right (reproduced) |
| Same probe after the change | All three start at the cell's left edge |
| `node --test --test-name-pattern="right-to-left" tools/tests/ui-next-songlist.test.js` with the fix | 2 tests, 2 pass |
| Same command with the original CSS put back | 2 tests, 2 fail (the test pins the change) |
| `node --test tools/tests/ui-next-songlist.test.js` (before adding the new test) | 22 pass, 0 fail |
| `node --test tools/tests/ui-next-library.test.js` | 16 pass, 0 fail |

## Not run
- Real Electron and Windows (not available here).
- The full test suite, the unit group and lint (not run for one CSS rule).
- Library panel rows and the Search view with right-to-left text.

## Environment
Linux sandbox, Node v22.22.2, Playwright 1.56 with headless Chromium. The project's own `node_modules` is absent (global Playwright used through NODE_PATH). Fake library of 30 to 400 songs, no audio.

## Manual checklist for the owner
1. Start the app with the new screen and open a library with a Persian or Arabic song title.
2. Look at the Title column: the Persian title should start at the left edge, in line with English titles.
3. Check the artist and album columns the same way.
4. Check that a mixed title (Persian plus English) still reads in the right letter order.

## Open issues and follow-ups
Check the library panel rows for the same behavior (not tested).

## Patch
`P1-B-PB-11.patch`. Excludes everything else in the project.

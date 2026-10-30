# Report: PC-08 Find lyrics name, blank album, paste in Write, finder state

**Task:** PC-08 (brief 4.4, 4.5, 4.6) | **Agent:** C | **Date:** 2026-10-28 | **Status:** Done (owner's request to finish C); built from a read of the code, not run in a browser

## What PC-08 was
Three small things on the Lyrics tools:
1. The page called "Find lyrics & LRC" needs a name, and its album field should start blank on purpose.
2. The Write tab should let a person add lyrics or LRC from a paste.
3. The song finder should keep its state (what was typed, picked and found) when the person leaves the page; it reset every time.

## Findings
- The Find page filled the album field from the playing song's tags. LRCLIB matches on album too, so a tag that differs from LRCLIB's spelling hides a result. *read*
- Both finders re-created their state every time the page was opened (`openOnlineLyricsSearchView`, `openSmartLyricsFinder` in `lyrics/19-online-lyrics.js`), which is why they looked reset after a visit to another view. The shell's tab bar calls the same functions, so switching tabs wiped them too. *read*
- The Write editor saved whatever was in the box as plain lyrics, so a pasted LRC ended up as plain text with timestamps in it. The Sync editor has "Import .lrc", the old lyrics page had "Paste LRC"; the Write editor had neither. *read*

## Changed files
| File | Change |
|---|---|
| `src/js/lyrics/19-online-lyrics.js` | album starts blank (also in `originalQuery`); the page is "Search lyrics online", the multi-song page and button "Search many songs"; reopening the page for the same song, or the manual search again, keeps fields and results; the multi-song finder is only reset when nothing was done in it |
| `src/js/lyrics/lrc-parser.js` | `looksLikeLrc(text)`: two or more timed lines |
| `src/js/lyrics/18-lyrics-editor.js` | both Write editors (playing song, and from a song's menu) show a hint when the text is LRC and save it as synced lyrics ("Saved N synced lines"), otherwise as plain lyrics as before |
| `src/ui-next/views/tools/lyrics-editors.css` | the hint's style |
| `tools/tests/lrc-parser.test.js`, `lyrics-finder-write-audit.test.js` | new Node tests |
| `tools/tests/ui-next-lyrics-find.test.js` | the two expectations that changed: album blank, button name |

## Decisions for the owner
- **The names are mine**: "Search lyrics online" and "Search many songs". They are one string each in `19-online-lyrics.js`.
- Pasted LRC goes to the synced lyrics only; the plain lyrics are left as they were.
- The multi-song finder has no "start over" button: its results stay until the app restarts, or until you clear its selection and search. Say if you want one.
- Text typed in the single finder's fields but never searched is not kept (only searched state is); the fields are plain page inputs.

## Checks
| Command | Result |
|---|---|
| `node --test` on `lrc-parser`, `lyrics-finder-write-audit` | pass |
| `node --check` on the three engine files | pass |

## Not run
The real pages in a browser or Electron: leaving and coming back to both finders, the hint while pasting, saving pasted LRC from both editors, and the right panel picking the new synced lines up (it checks every second and on `lyrics:changed`).

## Manual checklist for the owner
1. Lyrics, Find, with a song playing. Expected: title and artist filled, album empty; heading "Search lyrics online". Search.
2. Open Metadata or Settings, come back to Lyrics, press Find. Expected: the same fields and results (same song).
3. Many songs: type in its search, pick songs, run it, leave the page, return through its tab. Expected: search, picks and results are still there.
4. Write, paste two or more lines like `[00:12.30] words`. Expected: a line under the box says it looks like LRC; Save says "Saved N synced lines" and the right panel follows the song with them.
5. Write, paste normal lyrics. Expected: no hint, saved as plain lyrics as before.
6. From a song's menu, Edit lyrics, paste LRC. Expected: the same.

## Open issues
- `ui-next-lyrics-find.test.js` and the other browser tests of the Find page were not run.

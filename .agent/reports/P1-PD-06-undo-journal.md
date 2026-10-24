# Report: PD-06 Journal of previous tag values (durable Undo for the tag sheet)

**Task:** PD-06 | **Agent:** D | **Date:** 2026-10-24 | **Status:** In review

## Summary
Every "Review and apply" in Metadata > Many songs now writes one entry to E's undo journal (`electron/ai/journal.js`, on disk, capped at 50). The "Saved N songs" notification has an **Undo** button, and "Undo last apply" in the sheet still works after the app is restarted. Entries use the same shape as the AI's `set_tags`, so E's own undo code reverses them, and Edit > Undo does too. If the journal cannot be written, the save still happens and Undo works until the app is closed (the notification says so). This also unblocks DP12 option C (write confident finder matches at once, with Undo), which only needed this journal.

## What the person sees
1. Apply: the notification says "Saved 3 songs" with an **Undo** button. A save with a failed file says "Saved 2 of 3 songs", warning colour, and still offers Undo for the files that were written.
2. Undo from the notification, or "Undo last apply" in the sheet: the old tags are written back, the rows show them again, the entry is marked undone, the button goes away, and an "Undone" notification confirms it.
3. Close and reopen the app, open Metadata > Many songs: "Undo last apply" is there for the newest tag-sheet change that was not undone.
4. An old notification's Undo undoes *its own* change (through the journal), not the newest one.

## Findings
- **Arrays, not text.** Python returns multi-value tags (genre, artist, ...) as lists and writes them back one entry each, never re-splitting on commas. The sheet therefore records the old values as lists. Checked with the real `multi_values` function from `metadata-editor.py`: restoring `['Rock','Pop']` gives `['Rock','Pop']`; restoring E's joined string `'Rock, Pop'` gives the single value `['Rock, Pop']`.
- **E's AI `set_tags` loses multi-value tags on Undo.** `adapter/ai-bridge.js` records old values with `flat()` (`', '` join). Undoing an AI tag change on a song with two genres writes one genre "Rock, Pop". This is E's code; not changed. Suggested fix: drop `flat()` in the recording step (keep arrays), the undo handler already passes them through untouched. A test in `tag-sheet-journal.test.js` shows E's real `undoEntry` restoring a sheet entry exactly, so the fix is safe for both.
- **A timing bug only the browser found.** My first version restored "Undo after restart" when the module loaded, before `window.desktopApi` exists in the page, so the journal was never asked. The unit tests could not see it (they inject the bridge). Now done when the sheet is mounted, and retried until the journal has answered once. A browser test (fresh page, same journal and files) pins it; removing the call fails it.
- **Adapter budget.** The plan total was already over its frozen number on this zip (452 against 390, because of B's `panel-lists-bridge.js`; `ui-next-adapter-budget` test 3 fails without my changes). PD-06 adds **0** lines: `tag-sheet-bridge.js` stays at 74 (one generic `journal(name, ...)` call and two re-exports instead of six functions).

## Changed files
| File | Change |
|---|---|
| `src/ui-next/views/tools/tag-sheet-actions.js` | Records one journal entry per apply; `announceSaved` (notification with Undo); `undoLast` marks the entry undone and refuses to write old values again if it was already undone elsewhere; `undoOlder` (journal path: after a restart, or an older notification); `rereadUrls`; `restoreUndo` (`ui.restoreUndo`); `ui.hasUndo` also true for a journal entry |
| `src/ui-next/views/tools/tag-sheet.js` | `mountTagSheet` calls `ui.restoreUndo()` |
| `src/ui-next/adapter/tag-sheet-bridge.js` | `journal(name, ...args)` (the `ai` group's four journal calls), `undoJournalEntry` (E's `undoEntry`), notification helpers as re-exports. Same line count as before |
| `tools/tests/tag-sheet-journal.test.js` | New, 14 tests |
| `tools/tests/ui-next-tag-sheet-journal.test.js` | New, 3 tests in the real shell |
| `.agent/AI-TAG-SHEET.md` | One line for the AI |

## Behaviour worth knowing
- One journal entry per apply, one change of type `set_tags` holding `{ changed: [{ fileUrl, previous }] }`, `previous` only for the tags that changed. Summary text: "Tags of 3 songs: Album, Year".
- Undo restores the old values whatever the file holds now. If someone edited the same tag by hand in between, that edit is overwritten (same as E's AI Undo).
- After a restart only the newest tag-sheet entry still marked "done" is offered. Older entries can be undone from Edit > Undo (E's code), one at a time, newest first.
- A partly failed Undo (a locked file) reports the file, keeps the entry as "done" and keeps Undo available; running it again is safe (it writes the same old values).

## Checks
| Command or step | Result |
|---|---|
| `tag-sheet-journal.test.js` | 14 passed (entry shape and arrays, nothing saved = nothing journaled, notification Undo, sheet Undo, journal failure never blocks a save, no-journal fallback, restart, already-undone, partly failed Undo, older notification, failed-file save, E's real `undoEntry` on a sheet entry) |
| 8 mutations (flatten old values like E's path, never mark undone, ignore "already undone", journal error escapes, old notification undoes the newest, no restore after restart, no row re-read, mark undone with problems) | each failed at least one test (one mutation first did not run because my anchor was wrong; redone) |
| `ui-next-tag-sheet-journal.test.js` (Playwright, real shell, stubbed main process) | 3 passed: apply journals and the notification's Undo restores the file and the row; fresh page + same journal + same files offers and runs "Undo last apply"; an already-undone entry is not offered. Removing the restore call fails the restart test |
| Sheet, finder, parity, gate, IPC, runner, tag-service suites (13 files) | 141 passed, 1 failed: `ui-next-metadata` "Save sends only what changed ..." (see below) |
| `ui-next-metadata` on the untouched zip | the same 1 failure |
| Non-UI test files on my tree | 606 passed, 11 failed, 4 cancelled: the same 15 failing names as on every baseline I checked earlier (`acorn` and ESLint missing here, scanner-cancel tests, and others). Not re-run on this exact zip |

## Not mine, found while testing (please route)
- **C: `openSyncEditor` throws when the playing song has no lyrics text.** Stack: `lyrics.js go` -> `engineAction` -> `openSyncEditor` -> `renderSyncEditor` -> `escapeHtml(undefined)` (`text.replace is not a function`). It shows up as a page error in `ui-next-metadata` "Save sends only what changed ...": after Save the shell returns to the previous view (Lyrics), which now opens the Sync editor by itself (PC-07). Fails on the untouched zip.
- **E: AI `set_tags` Undo flattens multi-value tags** (above).
- **A/owner: adapter budget** already over its frozen total before this work (DP14).

## Not run
- Electron, Windows, a real journal file on disk through the real IPC (the journal is E's and has its own tests; here it is faked with E's exact answers).
- ESLint, the full `ui-next` browser group on this zip (the files around Metadata, the shell, the gate and parity were run).
- A journal with thousands of songs: each entry holds one change with every file's old values (about 300 bytes a file) and E's journal rewrites the whole file on each save, so a 2000-song apply is roughly 600 KB written synchronously in the main process. Fine for normal use; worth a look if someone applies the whole library.

## Environment
Node 22, Playwright and a browser, no network, no Electron. Baseline: `archive/D6/Source` (Source-backup_70a764.zip).

## Manual checklist for the owner
1. Metadata > Many songs, change an album on 3 songs, Review and apply. Expect "Saved 3 songs" with an Undo button.
2. Press Undo: the files and rows return to the old album; the notification says Undone.
3. Apply again, close the app completely, reopen, open Many songs: "Undo last apply" is there. Press it.
4. Do it with a song that has two genres, change the genre, Undo: both genres come back as two entries, not "Rock, Pop".
5. Apply twice (two different songs), then press Undo on the *first* notification: only the first song changes back.

## Open issues and follow-ups
1. DP12 option C (a setting to write confident finder matches at once, with Undo) can now be built on this.
2. Edit > Undo (E's menu item) undoes the newest "done" entry of any kind. If it undoes a sheet entry, an open sheet shows the old values only after those rows are read again (reopen or Undo from the sheet).
3. E's `flat()` fix and C's `openSyncEditor` guard (above).

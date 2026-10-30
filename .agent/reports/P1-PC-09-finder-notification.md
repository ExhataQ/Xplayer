# Report: PC-09 Notification for the multi lyrics finder

**Task:** PC-09 | **Agent:** C | **Date:** 2026-10-27 | **Status:** In review

## Summary
Brief 15.3: the Many songs finder now posts one notification that shows the run while it goes and the counts when it ends. The engine's finder emits a new event, `smartLyrics:progress`; a small module in `views/tools/` turns it into a PA-06 `notifyProgress` entry (bar, "N of M · K found", Cancel), then a finished entry ("Found LRC for 7 of 8 songs"). Clicking either one shows the Many songs page with the results. No adapter file changed and no adapter line was added.

## Findings (investigations)
- `runSmartLyricsFinder` (`js/lyrics/19-online-lyrics.js`) reported progress only as text on the finder page (`smartLyricsFinderState.status`), so leaving the page hid the run. *Read.*
- `openSmartLyricsFinder` resets the whole finder state, results included. The Many songs tab uses it (`OPEN.batch`), so the notification click must not. It shows the page with the engine's `switchView('smart-lyrics')`, which draws the finder from the state that is there. *Read.*
- Nothing leaves the finder state when the person moves to another view: only `openSmartLyricsFinder` resets it and `stopSmartLyricsFinder` is called only by the Stop button. So the run and its results survive leaving Lyrics. This answers the worry in PC-08 for this finder (D34 closes the Write and Sync editors on leave, not this page). *Read, not reproduced.*
- `notifyProgress`'s `done()` drops the target unless it is passed again, so the finished entry gets the target explicitly. *Read.*
- The worker pool searches up to 5 songs at once (`SMART_LYRICS_CONCURRENCY`); after Cancel the songs in flight finish first, then the `end` event arrives with `stopped: true`. The entry stays "In progress" until then. *Read.*

## Changed files
| File | Change |
|---|---|
| `src/js/lyrics/19-online-lyrics.js` | Three `emit('smartLyrics:progress', ...)` calls in `runSmartLyricsFinder` (start, after each song, end). No behaviour change |
| `src/js/core/EVENTS.md` | One row for the new event |
| `src/ui-next/adapter/engine-api.js` | `'smartLyrics:progress'` added to the existing `EVENTS` allow-list line (counted lines unchanged: 64) |
| `src/ui-next/views/tools/lyrics-finder-notice.js` | New. `createFinderNotice({ notifyProgress, stop, open })`: the payload-to-notification logic, no imports |
| `src/ui-next/views/tools/lyrics.js` | `watchFinder()`: subscribes once, on the first `mountLyricsModes`, and never unsubscribes (the run outlives the view); wires Cancel to `stopSmartLyricsFinder` and the click to Many songs |
| `tools/tests/ui-next-lyrics-finder-notice.test.js` | New, 10 tests |
| `.agent/BOARD.md` | The PC-09 row only |

## Decisions made or needed
- **Wording (please confirm):** progress title "Finding LRC for 8 songs" (or "lyrics"); finished "Search finished" / "Search stopped" with "Found LRC for 7 of 8 songs" or "Stopped: found LRC for 3 of 4 songs (6 skipped)". Nothing found is an info entry, not a success.
- **Reading of 15.3 (please confirm):** one entry per run that turns into the finished entry, not a separate "started" toast. The first appearance is the "In progress" row; if you wanted a toast at the start, `where: 'both'` on `notifyProgress` is not available, so it would need a `notify` call as well.
- No new DP. DP9 and DP14 are untouched (see Open issues for the figures).

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/ui-next-lyrics-finder-notice.test.js` | 10 of 10 passed. Includes a run against the real `shell/notify.js` (bar percent, status text, Cancel, finished entry, `openNotificationTarget`) |
| `node --test tools/tests/ui-next-notifications.test.js` | 23 of 23 passed |
| `node --test tools/tests/ui-next-adapter-api.test.js` | 3 of 3 passed |
| `node --test tools/tests/ui-next-lyrics.test.js ...-lyrics-find ...-lyrics-editors ...-lyrics-rail-sync` | 52 of 56 passed, the same 4 failures as the untouched backup (see Open issues) |
| `node --test tools/tests/ui-next-adapter-budget.test.js` | 3 of 4, the same failure as the untouched backup; `engine-api.js` is still 64, so this patch adds 0 lines |

## Not run
- Real Electron and Windows. A browser run of the finder: the notification, Cancel and the click were not seen on screen. The click path (`openNotificationTarget` then `switchView('smart-lyrics')`) is read from the code and only the first half is covered by a test.
- Real LRCLIB searches (no network here).
- `node tools/lint.js` and `tools/event-audit.js`: ESLint and acorn are not installed in this sandbox. The new emits are in a C file (`19`) and call nothing from D's files, so the audit should stay 0; please run both after `npm install`.

## Environment
Linux container, Node v22.22.2, no browser, no Python, no network. The project was unpacked without `node_modules`.

## Manual checklist for the owner
1. Start with `--ui=next`. Lyrics > Many songs, select about 10 songs without lyrics, press Find. Expected: the bell gets an entry "Finding LRC for 10 songs" under In progress, with a bar and Cancel, counting up.
2. Go to Library while it runs. Expected: the entry keeps counting; the run is not stopped.
3. Click the entry. Expected: Lyrics opens on Many songs, with the rows that are done already marked.
4. Let it finish. Expected: "Search finished, Found LRC for K of 10 songs"; clicking it shows the same page with the results kept.
5. Run again and press Cancel in the entry. Expected: within a few seconds (the songs in flight finish first) "Search stopped, Stopped: found ... (N skipped)".
6. Start a run, open Write or Sync, then click the entry. Expected: the usual "Discard?" question if something is unsaved; if you keep editing, Many songs does not open.

## Open issues and follow-ups
- **Adapter budget figures are stale on this backup:** `tools/adapter-budget.js` measures the plan bridges at 503 (frozen at 390 in DP14). `panel-lists-bridge.js` 64, `shuffle-menu.js` 26 and `song-open.js` 23 are not in DP14's list. The test fails before and after this patch. The owner's DP14 choice should use 503.
- **Stale test:** `ui-next-lyrics.test.js` "engine-api only forwards allow-listed events" matches an older `EVENTS` list (five names) and fails on the untouched backup. The other three failures in the four lyrics test files (smallest window, editor opened by a song menu, leaving and coming back) also fail without this patch; the first is the documented real layout issue.
- `tools/CHANGELOG.md` is empty in this backup, so the patch does not touch a changelog. Line for the owner's: "Many songs lyrics finder: a notification shows progress with Cancel and the final counts; clicking it opens the results."
- A run started while Lyrics was never opened cannot happen (the finder is only reachable from the Lyrics view), so the subscription on first mount is enough.

## Patch
`P1-PC-09-finder-notification.patch` (and the same files in `P1-PC-09-changed-files.zip`). It excludes the board's status line, `CHANGELOG.md` and `tools/CHANGELOG.md`. Snapshot the project first (PO-02).

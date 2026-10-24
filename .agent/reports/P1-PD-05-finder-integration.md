# Report: PD-05 Multi tag finder, integration (DP12 option A)

**Task:** PD-05 | **Agent:** D | **Date:** 2026-10-24 | **Status:** In review

## Summary
The finder core (`electron/tag-finder.js`, earlier report) is now connected end to end, as the owner decided (DP12, option A): "Find tags online" in Metadata > Many songs looks the checked songs up on MusicBrainz, **stages** the confident matches like any typed edit, and lists the unsure ones in a review queue to accept or skip. Nothing is written to a file by a search. Writing still goes through "Review and apply", and Undo covers it. Progress and the result appear in A's notifications, with Cancel and a link back to the sheet.

## What the person sees
1. Check rows, press **Find tags online** (off while nothing is checked or a search runs).
2. The notification "Finding tags for N songs" shows `done of total, about X min left` and a Cancel button.
3. When it ends: "1 staged, 3 to review, 1 nothing to change" (warning colour if something failed, was cancelled or stopped early).
4. Staged matches are highlighted in the table (album, album artist, year, genre, label). Unsure ones are in the queue under the button: song, release (year), confidence, before -> after, with Accept, Skip, Accept all, Skip all.
5. "Review and apply" as always.

## Changed files
| File | Change |
|---|---|
| `electron/main.js` | `find-tags-many` and `cancel-find-tags`: validates the request (at most 2000 songs, known fields only, rule `original` only, threshold 0..1), one run at a time, progress on `find-tags-progress`, stops if the window is gone. Writes nothing |
| `electron/preload.js`, `src/js/api/desktop-api.js` | `findTagsMany`, `cancelFindTags`, `onFindTagsProgress` (metadata group) |
| `src/ui-next/adapter/tag-sheet-bridge.js` | `findTags`, `cancelFindTags`, `progressNotice`, `notice` (one session-long progress listener, the preload cannot unsubscribe) |
| `src/ui-next/views/tools/tag-sheet-actions.js` | `findTags`, `getFindings`, `acceptFindings`, `skipFindings`, `cancelFind` (also for the AI); queue cleared by Discard and by removing rows |
| `src/ui-next/views/tools/tag-sheet.js`, `metadata.css` | The button, Cancel, status text and the review queue (list capped at 50 shown) |
| `.agent/AI-TAG-SHEET.md` | The new calls and how the AI should use them |
| `tools/tests/` | `find-tags-ipc` (8), `tag-sheet-finder` (21), `ui-next-tag-sheet-finder` (4, real browser), `desktop-api` (+1 and the name list) |

## Decisions I made (change if you disagree)
- Only tags the sheet can show are looked up: album, album artist, year, genre, label. The MusicBrainz id tags are not sheet columns, so they are not staged.
- Mode `add` by default: genres and other multi-value tags are kept and extended; album and year are replaced (that is the point of "original release").
- Unsure matches never stage by themselves, and I did not pre-check rows (the search already runs on checked rows).
- At most 2000 songs per search; about 3 to 4 seconds a song (MusicBrainz allows one request per second, three are needed per song).
- Only the "original release" rule exists. "Most popular" needs a popularity source that does not exist; the main process refuses any other rule.

## Checks
| Command or step | Result |
|---|---|
| `find-tags-ipc.test.js` | 8 passed; 5 mutations (no single-run guard, run flag never reset, window-gone keeps going, cancel does nothing, rule check dropped) each failed tests |
| `tag-sheet-finder.test.js` | 21 passed (staging, queue, accept/skip, add vs replace, notifications, cancel, one at a time, limits, unreadable files, removed rows, apply and Undo path) |
| `ui-next-tag-sheet-finder.test.js` (Playwright, real shell) | 4 passed: button needs checked rows; sure match staged and unsure queued with nothing written; Accept and Skip; Cancel reaches the main process; missing-backend message. Mutation (Accept does Skip) fails it |
| Screenshot of the real shell | Looked at: queue readable, staged cells highlighted, notification shown with "Open the tag sheet" |
| `desktop-api.test.js` (parity) | passed with the three new names and a channel test |
| Phase-1 gate and the rest of the suite | no regression against the untouched baseline (see the PD-01 report for the list of failures that exist without my changes) |

## Not run
- A real MusicBrainz search. No network here. The release fields the ranking relies on (`status`, `primary-type`, `secondary-types`, recording `score`) are still from memory (PD-04). Do one real run first.
- Electron itself, lint (no ESLint here), Windows.
- Writing the staged result to real files: that path needs the Python backend (mutagen), which is not installed here. The apply path is covered with a fake writer.

## Manual checklist for the owner
1. Metadata > Many songs > add a playlist, check 10 songs, press "Find tags online". Expect the notification with a counter and a time estimate.
2. Cancel halfway: it stops after the current song and keeps what it found.
3. Check what got staged (highlighted cells) and the queue. Accept one, Skip one.
4. "Review and apply", then Undo. Confirm the files changed and came back.
5. Unplug the network and search: after 5 failures in a row it stops and says so.
6. Look at a song you know has several releases (single, album, compilation): the earliest official album should win; if it picks a compilation, tell me the song.

## Open issues and follow-ups
1. Live check of MusicBrainz field names and ranking (PD-04).
2. "Most popular" setting: needs a source (Deezer, iTunes) and a terms check.
3. DP12 option C (write confident matches at once, with Undo) needs the journal (PD-06, PE-04).
4. The search makes the sheet's songs "unreadable" if tags cannot be read: that now shows the reason (PD-01 report).

## Patch
`0008-agent-d-finder-integration-and-backend-errors.patch`, against the tree in Source-backup_210b59.zip (board not included: apply the BOARD rows by hand). Covers this report and the PD-01 report.

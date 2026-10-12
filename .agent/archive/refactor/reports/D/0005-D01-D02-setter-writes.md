# Agent D report 0005: replace writes in the UI files (D-01, D-02)

Steps: D-01, D-02. Applies on top of: `Source-backup.zip` (the project you sent with the plan in `.agent/`).
Archive (.agent/AGENTS.md section 1): **not done**. `E:\Backup\...` is not reachable from my environment. Nothing was changed in the zip itself; the patch is the only deliverable.

## Changes

47 assignment lines, one setter call each. Nothing else in these files was touched (checked by diff: every changed line is an assignment turned into a call, with the same right-hand side).

| File | Writes replaced | Setters used |
|---|---|---|
| `04a-ui-render-core.js` | 4 | `setNextSearchItemSlotId`, `setNextFavoriteSlotId`, `setLastMouseX`, `setLastMouseY` |
| `05a-lazy-load-main-list.js` | 1 | `setHoveredSongIndex` |
| `06b-modals.js` | 2 | `setNotificationHistory`, `setCurrentQueueIndex` |
| `06c-scrollbar-widget.js` | 1 | `setHoveredSongIndex` |
| `06j-notification-system.js` | 3 | `setDownloadNotifyIndex` (two `= -1`, one `--` written as `setDownloadNotifyIndex(downloadNotifyIndex - 1)`) |
| `06k-keyboard-shortcuts.js` | 2 | `setPlaybackQueue`, `setCurrentQueueIndex` |
| `07-views.js` | 36 | the 11 globals named in D-02: `setCurrentView` (8), `setSearchQuery`, `setCurrentSearchSessionId`, `setHistoryNavigationIndex` (9, including `++` and `--`), `setPlaybackHistoryStack`, `setIsManualPlay`, `setIsPrevNavigation`, `setIsNavigatingHistory`, `setLyricsPreView`, `setLyricsPreScrollTop`, `setNextSearchItemSlotId` |
| `tools/change.log.txt` | entry added | |

Why this is safe:
- Each setter body is just `variable = value;` (A's `setters.test.js` checks that), so the new call does the same assignment.
- Three setters also emit an event: `setCurrentView` -> `view:changed`, `setPlaybackQueue` -> `queue:changed`, `setCurrentQueueIndex` -> `queue:indexChanged`. I searched for subscribers: **there are none**, so those emits do nothing today. A later subscriber will see them.
- `++`/`--` were all stand-alone statements, so `x - 1` / `x + 1` gives the same result.
- No name is shadowed by a local variable: dep-map is scope-aware and its per-file counts match my line list exactly.
- Setter files (`core/state-*.js`) load before `04a` in `manifest.json`, and all call sites run after load.

## Numbers

`node tools/dep-map.js json` (variables written from a file that does not declare them), the 7 D files: **22 before, 0 after** (04a 4, 05a 1, 06b 2, 06c 1, 06j 1, 06k 2, 07 11).
The project-wide line "Mutable globals assigned from other files: 52" does not change: the setters in `core/` count as "other files", and B and C still write some of the same variables (below). It cannot reach 0 until B-02 to B-04 and C-01 are done, and the tool counts the setter files as writers.
`node tools/event-audit.js --strict`: exit 0, A 0 / B 0 / C 0 (76 excepted), same as before.

## Tests actually run

- `node --test` on `setters`, `manifest`, `events-a/b/c/d`, `events-wiring`, `event-bus`, `search-ui`, `search-engine`, `shuffle`, `recents`, `storage`, `playback-settings`, `view-switch-song-list-cleanup`: 78 tests, **49 pass, 0 fail, 29 skipped**.
- Not run, and why: `scroll.test.js` and the other browser-based suites **skip here because Playwright is not installed**, so `scroll.test.js` and `view-switch-song-list-cleanup.test.js` (the two the plan names as "done when") are **not proven by me**. Please run them.
- Syntax of the 7 edited files checked with acorn: ok.

## Needs from other agents

- **B** still writes D's queue and now-playing globals from `10c`, `10d`, `15b`, `15c`, `15d`, `15e` and `14` (B-02 to B-04). **C** still writes `currentView`, `searchQuery`, `currentSearchSessionId` and `nextSearchItemSlotId` from `08e` and `08h` (C-01). Their patches will not conflict with this one (different files).
- **A (or whoever merges):** the last column of `src/js/core/SETTERS.md` ("Still written directly from") now lists D files that no longer write. I did not edit it: it is A's file and B and C change the same rows. Refresh it once B and C are done (or ask me to).

## Not done

- Nothing from D-01 or D-02 is open. Own-file writes were left as they are on purpose (for example `04a` writing its own `hoveredSongIndex`, 13 times, and `06j` writing its own `notificationHistory`): the plan asks only for cross-file writes, and the setters exist for the outside callers.

## For you (manual checks)

1. Run `node --test tools/tests/scroll.test.js tools/tests/view-switch-song-list-cleanup.test.js` with Playwright -> expect 0 failures.
2. Open the app, click All Songs, Favorites, a playlist, then press Back and Forward in the app several times -> each view shows, the Back/Forward buttons enable and disable correctly, no console error.
3. Type a search, then open another view and press Back -> the search results return with the same query.
4. Open the Lyrics view, then go to another view -> the previous view is restored where you left it (lyrics pre-view and scroll).
5. Play a song, then use Back/Forward -> playback does not restart unexpectedly.
6. Move the mouse over a song list and scroll -> the hover highlight clears when the list scrolls, and no error appears.
7. Trigger a notification (for example start a download or copy something), open the notification list, delete one -> list updates; the progress notification (if any) still behaves.
8. In the queue panel press the keyboard shortcut that clears or replaces the queue (`06k`) -> the queue changes and the current index is 0.

## Next step

D-05 (A-10), D-06 (A-14), D-07 (A-10), D-08 (A-13 + A-14) and D-09 all wait on A. Nothing else for D to start now. After your test run, mark D-01 and D-02 `applied + verified` in `.agent/BOARD.md`.

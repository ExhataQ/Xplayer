# Agent D report 0001: search-clear bug

Steps: D-01. Applies on top of: Source-backup1.zip (the tree this session was given).
Archive (.agent/AGENTS.md section 1): not done as written. `E:\Backup\Programming\Music player` is not reachable from the sandbox, so the uploaded `Source-backup1.zip` was kept untouched as the pre-change snapshot and all work was done on a copy. Nothing was changed in the original.

## Changes

- `src/js/08h-panel-search.js`: in the cleared-query branch of `performSearchNow`, `getCachedEl('all-songs-count').textContent = allSongs.length` (null, threw) is removed. With the throw gone, `resetLeftPanelActiveState`, `activateLeftPanelItem(ALL_SONGS)` and the scrollbar timer run again.
- `src/js/08h-panel-search.js`: the null-checked write to the same missing id in the query branch is removed as well. The left-panel All Songs count (`.left-panel-main-item[data-view="all-songs"] .main-item-count`) is the library total and must not show the number of search hits, and nothing changes it during a search, so there is nothing to restore on clear. The id in both places was wrong; "fixing" the one in the query branch would have made the left panel wrong.
- Why not call `updateAllCounts()` instead (the first idea): `08h` is owned by group C in `tools/event-allowlist.json`, and `event-audit --strict` then reports one direct reaction call (exit 1). Removing the line keeps the audit at 0 and is behaviorally the same, because the count never moved.
- `tools/tests/search-clear.test.js` (new): types a query, clears it, asserts no page error, the count still reads "N songs", the view is All Songs, its left-panel entry is active and all rows are shown again. Fails on the old code (`Cannot set properties of null (setting 'textContent')`), passes on the new.
- `tools/tests/helpers/scenarios-c.js`: the "query is cleared" scenario no longer wraps the call in try/catch (it only existed to record the bug).
- `tools/tests/expected/events-c.json`: that one sequence re-recorded with `EVENT_BASELINE=force`. Diff: three calls added (`resetLeftPanelActiveState`, `activateLeftPanelItem`, `updateExternalScrollbar`), which the old code never reached.
- `tools/change.log.txt`: entry appended.

## Numbers

`node tools/tests/run.js --timing`, seconds, before -> after:
- `search-ui`: 9.2 -> 9.2 (4 tests)
- `events-c`: 54.6 -> 56.2 (1 test)
- `events-wiring`: 37.2 -> 36.7 (12 tests)
- `search-clear`: new, 2.4 (1 test)

`node tools/dep-map.js` (unchanged by this step): mutable globals written from other files 58, file-level cycles 2 + 69, load-time cross-file references 148 (forward 0). The plan's baseline table says 27 for the last one; this tool run counts 148, so compare against this session's number.
`node tools/event-audit.js --strict`: exit 0, A 0, B 0, C 0, total 0 (plus 70 allowed by fileExceptions), checked on the final tree of this patch.

## Tests actually run

- `search-ui`, `search-clear`, `search-engine`: 18 pass, 0 fail.
- `events-c` (before and after re-record), `events-wiring`, `listener-order`: pass.
- Not run: the full suite, `lint` (the `globals` package is not installable in this sandbox, see D-05 report), scanner and metadata tests (`jimp` and `music-metadata` are not installable here; nothing in this step touches them).

## Needs from other agents

- none

## Not done

- After clearing, the hero header still shows the old search title (for example `"number 7"`) above the full list. That was already the case before this step (the code never set the hero in the cleared branch) and is not part of D-01. Worth a separate step for the UI plan.

## For you (manual checks)

1. Open the app, type a word in the main search box, wait for the results -> the list narrows and the left-panel All Songs count stays at the full number.
2. Select all text in the search box and delete it -> no error in DevTools, the full list returns, and the All Songs entry in the left panel is highlighted again.

## Next step

D-02 (duplicate left-panel refreshes).

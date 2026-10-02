# Agent C, patch 0003: EB-C3 search panel (`08h`)

Apply after C-0001 and C-0002.

## What changed
10 audit hits in `08h-panel-search.js` became 3 events with one new subscriber file, `src/js/04u-search-events.js` (manifest line right after `04t-lyrics-events.js`, the last file of my group). Public functions keep their names and signatures. DOM code moved unchanged.

| Event | Payload | Emitted at | Subscriber does |
|---|---|---|---|
| `search:resultsChanged` | `{ view, songs }` | `performSearchNow` (query cleared; query typed), `performSubheroSearch` (empty; filtered) | `renderSongsList`, `reapplyHighlightAfterFilter`, `reapplySelectionAfterFilter` |
| `search:summaryChanged` | `{ query, count, sessionId }` | `performSearchNow` (query typed) | `setupHeroSection(true, '"query"', count, 'Search Results', sessionId, false)` |
| `leftPanelSearch:cleared` | none | `performLeftPanelSearch` (box emptied) | `renderLeftPanelMainList` |

Audit hits: `renderSongsList` x4, `reapplySelectionAfterFilter` x4, `setupHeroSection` x1, `renderLeftPanelMainList` x1 = 10. Audit for C: 16 -> 6.

## Judgment
- A new search result list is a real reaction, so it is an event. The same event serves both the main search box and the subhero filter because both mean "the visible list is now this set of songs".
- `reapplyHighlightAfterFilter` is defined in `13` (Agent B) and the audit does not count it, but it sat between the two counted calls at all four sites. It moved into the subscriber with them so the order stays render, highlight, selection. It is still a direct call, now from `04u`.
- `setupHeroSection` was not allowlisted. It is also called from `03j` (Agent A, inside the changeMusicFolder refresh that EB-A3 must convert), so a by-name allowlist entry would hide that call. It became its own event, emitted before `search:resultsChanged` and after the direct `showTracklistHeader`, so the original order (header, hero, cover, list) is kept. `updateHeroCover` stays direct in `08h` (allowlisted in C-0002); `escapeHtml` for the query moved into the subscriber.
- `renderLeftPanelMainList` could not be allowlisted for the same reason (about 40 calls everywhere). The left-panel filter reset is one emitter and one subscriber; it is the smallest event that satisfies the audit. D may prefer a different name.
- The `count` DOM write (`all-songs-count`) between the hero and the list stays in `08h`, unchanged and in the same position.

## Same calls, same order
7 scenarios in `scenarios-c.js` (main search: typed, edited again, cleared; subhero: typed, emptied; left panel: emptied, typed). Spies include the navigation calls so positions are pinned. Baseline recorded from the unconverted `08h` before any app file changed. After conversion all match. **Calls removed: none. Order changes: none.**
Two harness notes:
- The "continuing session" scenario first recorded stray `updateExternalScrollbar` calls from the setup's own 100 ms timer. I made the setup wait for it and re-recorded the baseline with `EVENT_BASELINE=force` while `08h` was still unconverted; the 32 lyrics sequences from patch 0001 were checked to be identical after that re-record.
- The "query cleared" scenario runs inside try/catch on purpose, see the bug below.

## Existing bug found, NOT fixed
`performSearchNow` (query cleared branch) runs `getCachedEl('all-songs-count').textContent = ...`. No element with id `all-songs-count` exists anywhere (the real one is `all-songs-count-display`), so this line throws in the real app after the list is redrawn. The rest of the branch never runs: `resetLeftPanelActiveState()`, `activateLeftPanelItem(VIEWS.ALL_SONGS)` and the scrollbar timer. The scenario records that truncated sequence as it is. The event conversion keeps this behavior byte for byte. Fixing it is a behavior change outside Plan 1; the human decides. The fix would be one line in `08h` (my file).

## Verification (all run in this session)
- `EVENT_BASELINE=1` / `force` on unconverted code, then `events-c`, `manifest`, `events-wiring`, `search-ui`, `search-engine`: 41 pass, 0 fail.
- Sabotage check on each of the three subscribers (removed `reapplySelectionAfterFilter`, `setupHeroSection`, `renderLeftPanelMainList`): `events-c` failed each time; restored byte-identical.
- Not run: full suite, the app in Electron.

## Needs from other agents
- D: review `04u` (no per-frame work: these run per debounced search, not per frame) and the event names.
- Human: decide whether to fix the `all-songs-count` bug.
- B: `renderSongsList` is also called in `10c`, `15b`, `15c`; if B makes a song-list event, it does not overlap with `search:resultsChanged` (different trigger).

## Manual test checklist
1. Type in the main search box: results list, hero with the query and count, highlight of the playing song and selected rows follow.
2. Keep typing: same session continues (history keeps one entry).
3. Clear the box: the full song list returns (note: the left panel "All songs" item may not re-highlight; that is the existing bug, same as before).
4. Open an album or playlist, type in its search box: list filters, order kept. Empty it: full list returns.
5. Select two songs, then filter: selection is re-applied on matching rows.
6. Left panel search: type (items hide), clear (full list returns).

# Agent C, patch 0005: EB-C5, last open call in the combined project

Apply on top of the combined project you sent (C-0001 to C-0004 and the A/B/D patches already in it).

## What I found in the combined project
- All four C patches are in: `04t`, `04u`, `04v` are in the manifest after `21-language-detect.js`, and the audit for C was **1**, not 2.
- The 2 `updateActiveHighlight` calls in `08e` are now covered by the per-file entry for `08e-panel-settings.js` in `fileExceptions` (D's work, with my reason). Nothing for me to do there.
- The one open call was `updateHeroCover(VIEWS.SEARCH_ITEMS)` in `performSearchNow` (`08h`). It was allowlisted globally in C-0002; D's per-file change removed that, so it showed up again. `08h` has no `fileExceptions` entry.

## Change
Moved that call into the `search:summaryChanged` subscriber in `04u`, right after `setupHeroSection`. The emitter had it directly after the emit, so the order is unchanged (`showTracklistHeader` > `setupHeroSection` > `updateHeroCover` > list). I chose this over a new `fileExceptions` entry: it is the same hero redraw, and it keeps the allowlist smaller.
Files: `src/js/08h-panel-search.js` (-1 line), `src/js/04u-search-events.js` (+1 line), `src/js/core/EVENTS.md` (one sentence), `tools/change.log.txt`, this report.

## Result
- `node tools/event-audit.js`: Agent C **0**. A 0, B 31, total 31 (plus 46 by `fileExceptions`).
- `events-c`, `manifest`, `events-wiring`, `search-ui`, `search-engine`: 41 pass, 0 fail. The recorded search sequences did not change (same order of `setupHeroSection` and `updateHeroCover`).
- Sabotage check: commented out the moved call; `events-c` failed; restored byte-identical.
- Not run: full suite, the app in Electron.

## Still open (not a Plan 1 task)
- The `all-songs-count` bug in `08h` is still there (`performSearchNow`, query-cleared branch: `getCachedEl('all-songs-count').textContent`; the real id is `all-songs-count-display`). Unchanged, the test still records it. One-line fix in my file if you want it.
- `04t`/`04u` subscribers and `fileExceptions` entries for `08e` still need D's review.

## Manual test checklist
1. Type a search: header shows the query and count, the hero cover is the search cover, the list is filtered.
2. Edit the query: header updates, same session.
3. Clear the box and search again: header and cover are right again.

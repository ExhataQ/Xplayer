# Agent D report 0004: Plan 1 close-out (final patch)

One patch on top of `Xplayer-main-merged-B-final.zip` (A, B, C, D merged, with B report 0005). It includes C's patch `C-0005-last-search-call.patch` (all of it, with the `change.log.txt` hunk re-added by hand because the log differs), so **do not apply C-0005 separately**. It replaces D-0004 (first version) and D-0003; do not apply those either.
Changed: `tools/event-allowlist.json`, `tools/change.log.txt`, `src/js/04u-search-events.js` and `src/js/08h-panel-search.js` (C-0005, reviewed), `src/js/core/EVENTS.md`, `EVENTBUS-COMPLETION-PLAN.md`, `PLAN.md`, reports C 0005 and D 0004.
Archive (AGENTS.md section 1) not done: no access to `E:\Backup` here.

## Result

`node tools/event-audit.js`: **A 0, B 0, C 0. `--strict` exits 0.** 76 calls are excepted by `fileExceptions` (9 entries), each with a reason.

## Reviews and decisions

1. **C-0005 (`updateHeroCover` into `04u`): accepted.** Read the diff: the call moves from `performSearchNow()` into the `search:summaryChanged` subscriber, directly after `setupHeroSection`; nothing ran between the emit and the call, so the order is unchanged (header, hero, cover, list). It is better than the exception I had planned, so I **removed the `08h` exception** (it would have hidden future reactions in that file). C reports `events-c` failing when the moved call is removed (sabotage check) and 41 tests passing; I could not re-run those (no browser here).
2. **B EB-B5 highlight (13 and 17): approved**, per-file entries (B's own optional patch, same wording). Outside callers checked: `08e:27` (C's entry) and `17` only.
3. **B `14-song-navigation.js` `renderVisibleItems`: confirmed `virtualScroll`.**
4. **B `16:42` -> `playlist:songAddedFromMenu`: accepted.** The emit sits where the call was; the "playlist is open" check is in the `04p` subscriber.
5. **A's 09/99 exceptions: accepted** (all in click handlers or start-up, mapped by script). Two notes corrected: `toggleFolderExpandedFromUI` is a click handler, not a reaction (I withdraw my 0001 view); `99:100` is inside `togglePlaylistsFilter()`, not start-up.
6. **C's `08e` exception: accepted** (settings view-entry functions).

## EB-D1/D2 on the final code

- All 39 emitted events are in `EVENTS.md`; each subscriber file named there matches the real `on()` calls (checked by script). Three setter events (`queue:changed`, `queue:indexChanged`, `view:changed`) have no subscriber on purpose.
- One naming exception to rule 1: `recents:count-changed` (kebab-case). Kept so recorded sequences stay valid; noted in `EVENTS.md`; rename in Plan 2.
- No per-frame events and no direct state writes in `04p`, `04t`, `04u`, `04v`.

## Not done, by decision (Plan 2 or a later patch)

- **EB-D3 duplicate refreshes** (report 0001: library rebuild, `data:imported`, `playlist:listChanged` + `playlist:deleted`, `history:cleared`, B's `15e` Recent-panel refresh). Real, but each changes a recorded sequence. Nothing is broken by leaving them.
- **Possible real bug in `08h-panel-search.js` (C reported it, I confirmed the id):** `getCachedEl('all-songs-count')` is used at line 45 (search cleared) and line 77, but the only element with a count has the id `all-songs-count-display`. If `getCachedEl` returns null, line 45 would throw when the box is cleared. Unchanged on purpose (it is not event-bus work and the recorded test captures it); a one-line fix for C or Plan 2. Worth a quick manual check: clear the search box and watch the console.

## Docs

`EVENTBUS-COMPLETION-PLAN.md` has the final state; `PLAN.md` Phase 2 is ticked with the real event names (setter event name fixed to `queue:indexChanged`); `change.log.txt` has the entries from D and C. **B's entries are in the merged log; A's too. Check that nothing else is missing.**

## Tests actually run

- `manifest`, `events-wiring`, `events-a/b/c/d`, `event-bus` (this tree): no failures; the browser-based sequence tests skip here (Playwright/browser not installed), so they are not proven by me.
- Audit and `--strict`: run, exit 0.

## What is still yours (EB-D4)

1. `node --test tools/tests/*.test.js` with Playwright: expect 0 failures.
2. Manual smoke checklist (`tools/smoke-checklist.md`). Most relevant to the last changes:
   - Search a word: hero shows the query and count, hero cover is the search cover, list filtered. Edit the query, then clear the box and search again (also watch the console, see the bug note above).
   - Open a playlist; right-click a song > Add to playlist > the open one: shows at once. Add a duplicate: warning, view unchanged. Add to another playlist while a different view is open: notification only.
   - Open Settings from a playlist and back: no stale highlight, hero cover correct.
   - Play a song, scroll a long list: the playing-row highlight follows the song.
   - Expand/collapse a folder chevron; go up a folder: left panel keeps its scroll.

If the full test run and the smoke checklist pass, Plan 1 is done and Plan 2 (`PLAN.md`) can start.

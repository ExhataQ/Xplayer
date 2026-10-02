# Agent B decision 0004 (revised after the merge): EB-B5, `13-song-highlight.js`

This is a decision, not a conversion. **No app code and no allowlist change is applied.** D approves first (plan, EB-B5). The change is ready as `B-optional-EB-B5-allowlist.patch`. Revised because D's allowlist is now per-file (D report 0002), so the entries are `fileExceptions` for the two B files, not global names.

## Recommendation

**Keep the highlight calls direct.** Add these `fileExceptions` entries to `tools/event-allowlist.json`:

| File | Names |
|---|---|
| `13-song-highlight.js` | `updateActiveHighlight`, `updateSelectionHighlight`, `updateHoverHighlightAfterScroll` |
| `17-song-selection.js` | `updateActiveHighlight`, `updateSelectionHighlight` |

Reason (as written in the patch): these paint the active-song and selection highlight layers; `13` and `04a` are one subsystem split over two files; `applyStoredHighlight()` runs from `renderVisibleItems()` on virtual-scroll frames, so no events (EVENTS.md rule 4). In Plan 2, remove the boundary by moving ownership instead.

Effect, simulated on a throwaway copy of the merged project: **B 30 -> 0**; project total 31 -> 1 (the remaining one is C's `08h-panel-search.js` `updateHeroCover`). Because the entries are per file, nothing else is hidden: C's `08e` entry for `updateActiveHighlight` is C's own and stays as it is.

## What the 27 calls in `13` really are

- 27 uses: `updateActiveHighlight` x20, `updateSelectionHighlight` x5, `updateHoverHighlightAfterScroll` x2. They are **14 call sites plus 13 `typeof X === 'function'` guards**. The guards are redundant (`04a`, where all three are defined, loads before `13`). Removing them is cleanup, not event-bus work; best done in the same change as this decision.
- The 14 sites sit in four functions:

| Function in `13` | Sites | When it runs |
|---|---|---|
| `updatePlayingHighlight` | 6 | a song starts or pauses, entering Lyrics |
| `applyStoredHighlight` | 2 | after every list render, **including real-row renders on scroll frames** |
| `reapplyHighlightAfterFilter` | 5 | each search filter change |
| `applyHistoryStoredHighlight` | 1 | History view render |

- In `17` the 3 calls are the 30 ms timer in `refreshCurrentViewAfterMutation()` (after a mutation, not a hot path), repainting the same layers. They follow the same decision.

## Why this is the virtual-scroll hot path

In `05a-lazy-load-main-list.js` the rAF-coalesced scroll listener calls `renderVisibleItems(...)`; when it renders real rows it calls `applyStoredHighlight(...)`, which calls `updateActiveHighlight`. `renderVirtualScrollImmediate` does the same. So the calls inside `applyStoredHighlight` run on scroll frames; the calls in the other three functions do not.

## Options considered

1. **Convert all to events.** Possible (a synchronous emit keeps the order), rejected for Plan 1: it adds an event dispatch to calls that run per scroll frame, to reach tiny functions with no second subscriber. I did not measure the cost; this is a design judgement and D can ask for a measurement.
2. **Convert only the non-hot sites.** Rejected: one subsystem wired two ways.
3. **Keep direct and allowlist (recommended).** No risk to scrolling, no scenario changes.
4. **Move ownership (Plan 2).** The real fix: one owner for the highlight subsystem.

## `14-song-navigation.js`, `renderVisibleItems` x3 (D asked B to confirm)

**Confirmed as `virtualScroll`, not a reaction.** In `scrollToSongItem` and `applyScrollToSong` the code sets `content.scrollTop`, resets `virtualScrollState.visibleItems`, `firstVisibleIndex` and `lastVisibleIndex`, calls `renderVisibleItems(content, false)`, and right after copies `firstVisibleIndex` / `lastVisibleIndex` into `lastRenderedStart` / `lastRenderedEnd`. It is a command that needs the render's result immediately. An event would hide that dependency. Plan 2 note: these lines write D's `virtualScrollState` fields from a B file, which is an ownership question.

## Risks if D wants events instead

- Order inside `updatePlayingHighlight` matters (`updateActiveHighlight`, then `updateSelectionHighlight`, then the hover update in the next animation frame); a scenario would have to record it before converting.
- Headless scenarios cannot reproduce a real scroll frame; a conversion of `applyStoredHighlight` would be tested only by direct calls. The `scroll` suite is the safety net, and one of its tests is skipped in sandboxed environments.

## What B needs from D

One line: approve the entries (then apply `B-optional-EB-B5-allowlist.patch`), or ask for option 1 or 2 with a measurement.

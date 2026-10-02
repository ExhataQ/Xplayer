# Agent B decision 0004: EB-B5, `13-song-highlight.js`

This is a decision, not a conversion. **No app code and no allowlist change is in this document.** D approves first (plan, EB-B5), then the allowlist entry below is applied.

## Recommendation

**Keep the highlight calls direct.** Add `updateActiveHighlight`, `updateSelectionHighlight` and `updateHoverHighlightAfterScroll` to the `services` list of `tools/event-allowlist.json`, with the reason below. Do not put events on this path in Plan 1. In Plan 2, remove the boundary instead (one owner for the highlight subsystem).

## What the 27 calls really are

- The audit counts 27 uses in `13`: `updateActiveHighlight` x20, `updateSelectionHighlight` x5, `updateHoverHighlightAfterScroll` x2.
- They are **14 call sites plus 13 `typeof X === 'function'` guards**. The guards count as uses too. They are redundant: `04a-ui-render-core.js` (where all three are defined) loads before `13` in the manifest. Removing the guards would be a safe cleanup, but it is not event-bus work and I have not done it.
- The 14 sites sit in four functions of `13`:

| Function in `13` | Sites | When it runs |
|---|---|---|
| `updatePlayingHighlight` | 6 | a song starts or pauses, entering Lyrics |
| `applyStoredHighlight` | 2 | after every render of a list, **including real-row renders on scroll frames** (see below) |
| `reapplyHighlightAfterFilter` | 5 | each search filter change |
| `applyHistoryStoredHighlight` | 1 | History view render |

## Why this is the virtual-scroll hot path

Verified in `05a-lazy-load-main-list.js`: the rAF-coalesced scroll listener (`attachRafScroll`) calls `doRender`, which calls `renderVisibleItems(content, ...)`. When it renders real rows (not placeholders), `renderVisibleItems` calls `applyStoredHighlight(...)` (line 386), which calls `updateActiveHighlight`. `renderVirtualScrollImmediate` does the same. So the calls in `applyStoredHighlight` run on scroll frames. The calls in the other three functions do not.

## Options considered

1. **Convert all to events** (`highlight:changed` etc.). Possible: a synchronous emit would keep the order. Rejected for Plan 1: it adds a `CustomEvent` allocation and dispatch to calls that run per scroll frame, to reach functions that are tiny (`updateActiveHighlight` hides one element and stores the slot) and have no second subscriber. Nothing gains from the indirection. I did not measure the cost; this is a design judgement, and D can ask for a measurement before agreeing.
2. **Convert only the non-hot sites** (`updatePlayingHighlight`, `reapplyHighlightAfterFilter`, `applyHistoryStoredHighlight`) and keep `applyStoredHighlight` direct. Rejected: one subsystem would be wired two different ways, and the plan's own note says to avoid exactly that.
3. **Keep direct and allowlist (recommended).** Zero risk to scroll behaviour, no scenario changes, and the audit reflects that these are painting calls into the same subsystem.
4. **Move ownership** (Plan 2): either move the three D functions next to `13` or move `13` into D's group, so the highlight subsystem has one owner and the A/B/D boundary disappears. This is the real fix, and it removes the calls from the audit without adding events.

## Exact allowlist change to apply after D approves

In `tools/event-allowlist.json`, append to `services.names`:

```
"updateActiveHighlight",
"updateSelectionHighlight",
"updateHoverHighlightAfterScroll"
```

Suggested wording for the reason, to add to the `services` `why` or a comment in the report that applies it: "Paint the active-song and selection highlight layers. One subsystem split across B and D; called on virtual-scroll render frames, so they stay direct. Revisit in Plan 2 by moving ownership."

I simulated this change in a throwaway copy of the project (not applied to the deliverable):

| | Now | With the entry |
|---|---|---|
| Agent A | 41 | 41 |
| Agent B | 30 | **0** |
| Agent C | 41 | 39 (two calls in `08e-panel-settings.js`) |
| Total | 112 | 80 |

**D should check that the two `08e` calls are also painting calls, since the allowlist applies by function name to every file.** The 3 highlight calls left in `17-song-selection.js` (the 30 ms timer in `refreshCurrentViewAfterMutation`) are covered by the same entry, so B-0003 needs no further change.

## Risks if D wants events instead

- Order inside `updatePlayingHighlight` matters (`updateActiveHighlight` then `updateSelectionHighlight`, then the hover update in the next animation frame). A scenario would have to record it before converting.
- Headless scenarios cannot reproduce a real scroll frame faithfully. A conversion of `applyStoredHighlight` would be tested only by a direct call, not by the real rAF scroll path. The existing `scroll` suite would be the safety net, and one of its tests is skipped in sandboxed environments.

## What B needs from D

One line: approve the allowlist entry, or ask for option 1/2 with a measurement. After approval B (or D) applies the allowlist change and the audit for B reads 0.

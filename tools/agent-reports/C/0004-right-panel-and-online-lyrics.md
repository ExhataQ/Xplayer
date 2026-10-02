# Agent C, patch 0004: EB-C4 (`08d` right panel tabs, `19` online lyrics)

Apply after C-0001, C-0002, C-0003.

## `08d`: converted (1 call)
`switchRightPanelTab(tab)` called `renderPortableRecentlyPlayed()` when the tab was `recently-played`. It now calls `emit('rightPanel:tabChanged', { tab })` at the same position; the new subscriber `src/js/04v-right-panel-events.js` holds the tab check and the call. Manifest line right after `04u-search-events.js`.
Why an event and not an allowlist entry: `renderPortableRecentlyPlayed` is also called from `15e` (2) and `16` (1), which are Agent B's real reactions (a song counted as played, a context action). A by-name allowlist entry would hide them.
The event fires for every tab switch, not only this one, so another panel can hook it later.

## `19`: no code change (3 audit hits, 2 allowlist entries)
| Name | Calls | Verdict | Why |
|---|---|---|---|
| `refreshSmartLyricsVirtualScroll` | 2 (`typeof` check + call) | services | Both are inside `updateSmartLyricsFinderList`, the finder panel's own list renderer, with an `innerHTML` fallback right next to it. Its only caller in the whole project is `19` (checked with the dependency map). It is the implementation of the panel's redraw, not a response to a change elsewhere, so an event would add a hop with a single emitter and subscriber. The list is shared with `05c` (virtual scroll): one subsystem in two files |
| `renderRightPanelItem` | 1 | queries | Returns an HTML string that `updateOnlineLyricsPickerList` joins into `innerHTML`; it changes nothing by itself |

Side effect of the by-name allowlist: `renderRightPanelItem` is also used in `10c` (Agent B, 4 uses), always inside template strings or `queueHTML +=`, so it is a markup builder there too. Audit B: 81 -> 77. B should still convert the functions around it (queue redraw).

## Same calls, same order
Scenarios (3): switch to `recently-played`, `queue`, `tags`. Spies: `updateRightPanelHeader`, `renderPortableRecentlyPlayed`, `updateInfoButtonVisibility`, `updateScrollbarById` (the first two of those are Agent C's own functions, spied only to pin the position). Baseline recorded from the unconverted `08d` before any app file changed; the earlier 39 sequences were checked unchanged. After conversion all match. **Calls removed: none. Order changes: none.**

## Verification (run in this session)
- `events-c`, `manifest`, `events-wiring`, `scroll`: 39 pass, 0 fail, 1 skipped.
- Sabotage check: commented out `renderPortableRecentlyPlayed()` in `04v`; `events-c` failed; restored byte-identical.
- `node tools/event-audit.js`: C 6 -> 2, B 81 -> 77, A 36 (unchanged). Total 115.
- Not run: full suite, the app in Electron.

## What is left for Agent C
2 calls: `updateActiveHighlight` in `08e` `openSettingsPanel`. Blocked on EB-B5 (see report 0002). Once the human/D choose "allowlist after B5" or "file-scoped allowlist", it is a one-line change.

## Needs from other agents
- D: review `04v` and the two allowlist entries (a `services` and a `queries` entry).
- B: note `renderRightPanelItem` no longer shows in your audit.

## Manual test checklist
1. Right panel: click the Recently played tab: the list is drawn (and the empty message when there is nothing).
2. Switch Queue, Tags, back to Recently played: header, buttons and the list follow each time.
3. Play a song for over 5 seconds with the Recently played tab open: the list updates (this goes through B's and D's code, unchanged).
4. Online lyrics view: change the song filter in Smart lyrics finder: the list refreshes and scrolls.
5. Online lyrics: open the song picker: rows show with covers and context menus.

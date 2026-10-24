# Report: PB-02 Search and Recents panel contents; PB-03 Move panel results to the main view

**Task:** PB-02, PB-03 | **Agent:** B | **Date:** 2026-10-24 | **Status:** In review

## Summary
Search and Recents now fill the left panel (PB-02). Search: a field, then playlists and songs that match (songs are the best 40), or the recent searches when nothing is typed; a song plays, a playlist opens in the main view. Recents: playlists played lately (the arrow on a row lists the songs of it that were played, with the time), then the last 20 songs played. Each panel has an icon button that shows the same thing in the main view while the panel stays open (PB-03): Search shows the main Search page with the typed query, Recents shows the engine's history list.

## Findings
- Search and Recents used to be main views with a placeholder panel. DP2 asks for panel items that leave the main view alone, so both are now `panelOnly` in the shell: `selectView` only fills the panel (click the item again to close it, as before) and the main view stays on whatever it was (Home, Library, Settings).
- The rail marks the open panel's item with the active bar through `data-panel-current`, next to the main view's `aria-current`. So Home and Search both show a bar (DP2). *Reproduced in the running app.*
- The engine does not record which playlist a song was played from (`saveToPlayHistory` stores the song only). Recents therefore says a playlist was played when one of its songs is in the play history, and a song counts for every playlist that holds it. This is shown as "2 of 4 played". If the owner wants exact per-playlist history, the engine must store the list id when a song is played (a change to `playlists`/`99-player.js`, not done).
- `getPlayedItemOrder` was not used: it also lists playlists that were only created, not played.
- The Search panel never touches the engine's search state or its hidden search box; only PB-03's button does (it runs the search in the main page). Recent searches are shown read only; clicking one fills the field.

## Changed files
| File | Change |
|---|---|
| `adapter/panel-lists-bridge.js` (new, 79 lines, counts in the DP9 budget) | `searchPanel`, `recentPlaylists`, `recentSongs`, `whenPlayed` (read only) |
| `views/library/search-panel.js`, `recents-panel.js` (new) | the two panels |
| `views/library/panel-lists.css` (new), `index.html` | one stylesheet link; tokens only |
| `views/library/search-view.js` | `mountSearchView(host, start)` shows a given query at once |
| `shell/shell.js` | `panelOnly` on Search and Recents; `selectView` branch; `showView` option `keepPanel`; `data-panel-current` kept by `setPanelClosed`; registers the two panels with a small context (open, play, showInMain). **A: please review.** |
| `shell/rail.css` | the bar also shows for `data-panel-current` |
| `adapter/engine-api.js` | `history:added` and `playlist:listChanged` added to the allowed events |
| tests | new: `panel-lists-bridge.test.js`, `ui-next-panel-lists.test.js`. Changed for the new behavior: `ui-next-search`, `ui-next-listbar`, `ui-next-panels`, `ui-next-app-menu`, `ui-next-home-shell` (Search and Recents are no longer reached as a main view by the rail; the panel button does that) |

## Decisions made or needed
- No new DP. Follows DP2. The rail's Library item is still a panel item that also sets the main view (unchanged).
- Search's "main view" button is always enabled; with nothing typed it opens the empty Search page.
- Needed from the owner: is "a playlist counts as played when one of its songs was played" enough for Recents (see Findings)?

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/panel-lists-bridge.test.js tools/tests/library-create.test.js tools/tests/ai-bridge.test.js` | 16 tests, 16 pass |
| Built app copy in headless Chromium, driven with Python Playwright: the new test's steps | Search panel fills the panel and main view stays Library; marks on the rail: Library `aria-current`, Search `data-panel-current`; search for "road" lists the playlist, "zzzz" says nothing matches; clicking the playlist opens it in the main view and the panel stays; the buttons show the main Search page with the query and the history list; Recents shows "Road trip, 2 of 4 played", expands to the 2 songs with times, then recent songs; clicking the item again closes the panel and removes the mark; Library brings back its panel and the plus; no page errors |
| Same way, the flows of the five edited tests (focus and empty state of the Search page, rail on Search after Settings, 36 px bar for Search, Recents title and `currentView`, Ctrl+3/4/1/2, Home stays when Search is chosen) | all as the edited tests now expect |

## Not run
- The Node browser tests, including the five I edited and the new `ui-next-panel-lists.test.js`: Node `playwright` is not installed here. Run `node --test tools/tests/ui-next-*.test.js`.
- A real library (thousands of songs) for the search speed: the panel searches synchronously on each key; the engine's own search is debounced. Check typing on a large library.
- Real Electron and Windows.

## Environment
Linux sandbox, Node 22.22.2, Chromium via Python Playwright 1.56. No Electron, no `node_modules`.

## Manual checklist for the owner
1. Click Search in the rail. Expect: the panel shows a field and your recent searches; the main view does not change; the rail shows a bar on Search and on the main view's item.
2. Type part of a playlist name and a song. Expect: Playlists and Songs sections. Click a song: it plays. Click a playlist: it opens in the main view, the panel stays on Search.
3. Click the expand button next to the field. Expect: the main view shows the Search page with your text and the full results.
4. Click Recents. Expect: playlists you played (with "x of y played"), an arrow that lists the played songs and when, then recent songs.
5. Click the expand button in Recents. Expect: the main view shows the recents list.
6. Click Search again while it is open: the panel closes; click again: it opens. Click Home and then Search: Home stays.

## Open issues and follow-ups
- A: review `shell.js` (`panelOnly`, `keepPanel`, `setPanelClosed`) and the rail bar rule.
- Per-playlist play history needs an engine change (see Findings).
- PB-04 (collapse for Library only) still waits for DP8.

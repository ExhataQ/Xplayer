# UI-B04: search

**Owner:** B. **Status:** In review. **Date:** 2026-10-18. **Patch:** `ui-b04-search.patch` (apply on top of B-03). Decision D27 on the board.

## What the patch does

| File | Change |
|---|---|
| `src/ui-next/adapter/search-bridge.js` | New, about 25 code lines. The only place the search view touches the engine: sets the hidden `#search-input` and calls `performSearchNow` (empty query) or the debounced `performSearch`, reads and changes the search history, reopens a recent search, resets the engine's search state |
| `src/ui-next/views/library/search-view.js`, `search-view.css` | New. Search field (the A-05 text field, with clear and Escape), recent searches (query, result count, date, remove button, Clear all), empty message |
| `src/ui-next/shell/shell.js`, `index.html` | The Search rail item shows the song list (B-03) with the search view on top; leaving it removes the view and clears the engine's query |
| `tools/tests/ui-next-search.test.js` | New, 7 tests |
| `.agent/BOARD.md`, this report | D27, B-04 In review |

**No engine file was changed.** Everything runs through functions the engine already exposes.

## Behavior to know about

- Nothing typed: the result list is hidden and the recent searches show (or a short message when there are none).
- Typing: results appear after the engine's own 300 ms pause, in the same song list as the Library (columns, density, play on double click all work). The title bar shows the query and the count.
- Escape or the clear button: back to the recent searches.
- A recent search reopens its saved results and fills the field. The x removes one; Clear all uses the engine's confirmation dialog.
- The engine keeps **one history entry per typing burst** and stores the query in lower case ("artist 5"); I kept both as they are.
- Ranking is the engine's: a search for "Artist 5" lists songs by Artist 5 among other fuzzy matches (in the fixture "Song title number 5" came first).
- Narrow window: the field and recents are limited to 640 px wide.

## Evidence

- `node --test tools/tests/ui-next-search.test.js`: **7 of 7 pass** (focused empty state; results with a title bar; no-match message; artist search and play; Escape back to recents with counts and order; reopen and remove; leaving resets).
- Re-run after the change: shell 17, song list 22, library 16, tokens 23, phase 1 gate 11, lint 12 tests, all passing. `node tools/lint.js --strict`: 0 errors, 0 warnings. The full suite was last run after B-03 (696 tests, 695 passed, 1 skipped); it was **not re-run in full** after B-04.
- Screenshots of the recents and results states looked at.

## Not done, and why

- **Not run in Electron.** Headless Chromium with a stubbed `electronAPI`.
- **Clear all** (the engine's confirm dialog) was not exercised; D-06 restyles dialogs.
- **Search filters** (`applySongFilters` in the engine, for example by genre or year) have no interface here; the old screen has none either.
- **Keyboard shortcut** to open search (Ctrl+F or similar) was not wired or checked; the old shortcut targets `#search-input`, which is hidden in the shell. Parity item for A-11.
- **Right-to-left queries:** the field and recents use `dir="auto"`; not looked at on screen.
- **Archive** not made (project folder not reachable).

## Manual checks for you (`--ui=next`)

1. Click Search in the rail. Expected: a focused field, and a short message (or your recent searches).
2. Type part of a title, then an artist. Expected: results after a short pause, a title bar with your words in quotes and a count.
3. Double click a result. Expected: it plays.
4. Press Escape. Expected: back to recent searches; the one you made is listed first with its count.
5. Click a recent search. Expected: the field fills in and the results return. Hover one and press x: it disappears.
6. Search for nonsense. Expected: "No songs found".
7. Go to Library and back. Expected: Library shows everything; Search starts empty.
8. Type a Persian title. Expected: readable; tell me if the alignment looks wrong.

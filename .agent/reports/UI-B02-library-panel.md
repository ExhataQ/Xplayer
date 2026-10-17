# UI-B02: library panel

**Owner:** B. **Status:** In review. **Date:** 2026-10-17. **Patch:** `ui-b02-library-panel.patch`, which **includes** the earlier docs-only patch `ui-b01-b02-research-and-board.patch`; apply this one alone, or apply that one first and then use `git apply --3way`.

Decisions taken by B on your instruction "decide on your own, best answer compared to the cost": D16 = S3, D21 = L1 (restyle the engine's panel), D22 = additive engine seams. All three are recorded on the board.

## What the patch does

| File | Change |
|---|---|
| `src/js/ui/05b-lazy-load-left-panel.js` | Engine seam. New private view model `{ types, query, sort }` with `getLeftPanelView()` and `setLeftPanelView(patch)` (registered as legacy globals). `getLeftPanelItemsArray()` now applies sort (pinned first, then A to Z; All Songs and Liked Songs stay on top of the unpinned items) and a text filter on the item list. When nothing matches, the rows are cleared (the renderers return early and would leave stale rows). 39 changed lines |
| `src/js/ui/04a-ui-render-core.js` | `collectAllLeftPanelItems()` consults `getLeftPanelView().types`. With `types` null, which is all the old screen ever has, every rule is the old one. With types set, albums and artists follow the types, and playlists inside folders are listed flat unless the Folders type is on. 18 changed lines |
| `src/ui-next/adapter/library-bridge.js` | New, about 50 code lines. The only place the new panel touches the engine's list and view model: moves the list out of the hidden host into the panel, reads and sets the view, folder state, change hook, ready hook |
| `src/ui-next/views/library/library-panel.js` | New. Chip group, find field, sort control, folder bar, empty message. Saves chip and sort in `localStorage` (`xplayer.ui-next.library`) |
| `src/ui-next/views/library/library-panel.css` | New. Rows restyled by tokens only: cover, title, subtitle, active, playing (amber title, speaker icon), pin and folder chevron drawn as Lucide masks, cover play button, skeleton rows. Defines `--left-item-height: 61px` (the engine reads it once at load) |
| `src/ui-next/shell/shell.js`, `index.html` | The Library rail item mounts the panel; other rail items hide it (the engine finds its list by id, so it stays in the page). `components/components.css` was not linked by the shell and is now |
| `tools/tests/ui-next-library.test.js` | New, 16 tests |
| `.agent/BOARD.md`, this report | Board: D16, D21, D22 decided, B-02 In review, Q2 closed |

`src/js/` outside those two files, `src/css/`, `electron/` and `build/` are untouched.

## The engine change, and why it is safe

The old screen never calls `setLeftPanelView`, so `types` stays null, `query` empty and `sort` 'recent', and `getLeftPanelItemsArray()` returns what it always did. Two tests pin that down on the old page: the list is identical after setting and clearing the view, and the old Albums chip still lists playlists and hides artists.

## Evidence

- `node --test tools/tests/ui-next-library.test.js`: **16 of 16 pass** (7 on the old page, 7 in the new shell, 2 source rules). Real Chromium, the unmodified engine, 300 seeded playlists.
- Full suite `node tools/tests/run.js` (acorn, eslint, globals installed): **616 tests, 615 passed, 0 failed, 1 skipped**. This includes `lint`, `ui-handlers`, the tokens test and the shell gates 1 to 14. Before this work the board's last figure was 494 passed of 494 plus the skipped one; the difference is A's later tests and the 16 new ones.
- **The find bug was reproduced before any code:** old UI, 402 items, 17 rows in the DOM, typing "Mix 250" shows nothing. With the seam the same query returns exactly that item, and a test keeps it that way.
- Screenshot of the new shell looked at: rows, chips, find and sort render with the tokens (Warm Graphite). Other themes and accents were **not** looked at.

## Behavior to know about

- **Chips are real filters.** Playlists = All Songs, Liked Songs and playlists; Folders; Albums; Artists; All. Only one is on.
- **Find** matches item titles in the visible list. Items inside a collapsed folder are not searched. Albums and artists are searched only while their chip (or All) is on.
- **Opening a folder** uses the engine's own folder mode: the chips, find and sort hide, a bar with Back and the folder name shows. Rows inside a folder keep the engine's markup; they were checked only for no errors, not styled in detail.
- Sort and chip choices persist; the find text does not.

## Not done, and why

- **Compact mode.** The shell hides the panel body when compact (72 px). A cover-only compact list needs a row variant and the engine's `--left-item-height` re-read; left for a later B-02 patch.
- **Rows inside an opened folder, drag and drop, context menu, cover sync:** not exercised in the new shell. They rely on the engine's own markup, which is unchanged, so they should work, but no test covers them there.
- **Hard-coded cover colors.** The engine writes covers as inline SVG with fixed colors (`#450af5`, `#2a2a2a`, the accent). The panel frames them but cannot recolor them without an engine change.
- **Left panel hover, keyboard arrows and RTL titles** were not checked on screen.
- **Not run in Electron.** Headless Chromium with a stubbed `electronAPI`, as for all Phase 1 work.
- **Archive** (`AGENTS.md` section 1) not made; see question Q6 on the board. `AGENTS.md` and `TEMPLATE.md` problems from the earlier report still stand.
- `npm install` was run in the working copy to run tests; `node_modules` is not part of the patch.

## Manual checks for you (`--ui=next`)

1. Open the app. The Library panel shows five chips, a Find box, Recent and A to Z, then the list. Expected: All Songs is amber-tinted when selected, rows are 61 px.
2. With a big library, type a name from the bottom of the list in Find. Expected: that row appears, others disappear; the clear button brings the list back.
3. Click Folders, then Playlists. Expected: only those items; Playlists includes All Songs and Liked Songs.
4. Click A to Z. Expected: pinned items stay first, the rest ascending.
5. Click a folder. Expected: the controls hide and a bar with Back and the folder name shows; Back returns to the list.
6. Play a song from a playlist. Expected: that row's title turns amber and shows the speaker icon; hovering a cover shows a play or pause button.
7. Pick another rail item and come back. Expected: the list is as you left it.

## Follow-ups for others

- A: fold `adapter/library-bridge.js` into the A-04c surface. `components/components.css` was not linked by the shell; this patch links it.
- Cleanup after cutover: the four dead `render...View` builders (B-02 section 1), and the old filter chips and `performLeftPanelSearch`.

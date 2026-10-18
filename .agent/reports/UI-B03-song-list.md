# UI-B03: song list

**Owner:** B. **Status:** In review. **Date:** 2026-10-18. **Patch:** `ui-b03-song-list.patch` (apply on top of B-02).

Decisions taken by B on your instruction "answer the questions yourself and keep going": D23 to D25 (new), D17, D19, D20 (open or proposed questions, answered as A recommended). D26 is left open for B-05. All are on the board.

## What the patch does

| File | Change |
|---|---|
| `src/js/ui/05a-lazy-load-main-list.js` | Engine seam. `ITEM_HEIGHT` is now a `let`; new `setSongItemHeight(px)` changes it, keeps the first visible row in place and rebuilds the virtual window. `ITEM_HEIGHT` is published with `registerLegacyState` (a live read-only global) so `14-song-navigation` never reads a stale copy. About 20 changed lines. The old screen never calls it |
| `src/ui-next/adapter/songlist-bridge.js` | New, about 40 code lines. The only place the song list touches the engine: which views show song rows, view change events, the row-height seam, the list element, the list title and song count |
| `src/ui-next/adapter/songlist-rows.css` | New. The engine's rows (`.song-item` and its cells) on a column grid, tokens only: number cell with playing bars and a play or pause mark, cover, title, artist, album, time, hover actions, the two highlight layers, placeholder rows. Lives in `adapter/` because gate 13 only lets `adapter/` name the engine's row classes |
| `src/ui-next/views/library/song-list.css` | New. Title bar, header row, resize handle, the column variables on the view host, narrow-window rule |
| `src/ui-next/views/library/song-list.js` | New. Title bar, header, columns menu (Cover art, Artist name, Album, Time; Comfortable or Compact; Reset column widths), resize handle (mouse, keyboard, double click), saved in `localStorage` (`xplayer.ui-next.songlist`) |
| `src/ui-next/shell/shell.js`, `index.html` | The Library rail item now shows the engine's All Songs list in the view host and attaches the song list; other rail items detach it. If the engine has not loaded yet, the view is drawn once it has. Two stylesheets linked |
| `tools/tests/ui-next-songlist.test.js` | New, 22 tests (11 on 30 songs, 11 on 400 songs with virtual scroll, plus 2 source tests) |
| `tools/tests/ui-next-shell.test.js` | One expectation changed on purpose: `#song-list` used to be hidden in the shell, and is now shown in the view host |
| `.agent/BOARD.md`, this report | Decisions, B-03 In review |

`src/css/`, `electron/` and `build/` are untouched. `music_player.py` copies `ui-next/` as a folder, so no copy-list change was needed.

## Behavior to know about

- **Columns.** The engine writes a row as four cells: number, title block (cover, title, artist), album, actions. So Title and Artist cannot be separate columns without changing row markup. Instead: Title and Album share the free width, one handle between them moves the boundary (20% to 80%, never below 140 px and 90 px), and the saved value is a ratio, so it keeps its shape when the window resizes. Cover art and Artist name are switches inside the Title column.
- **Narrow window.** Below 700 px of list width the Album column disappears; the saved choice is not changed.
- **Compact.** 36 px rows, no cover, artist on the same line as the title, smaller type. Switching keeps the same song at the top of a scrolled list (tested on 400 songs).
- **Number cell.** On hover or keyboard focus it turns into a play mark, or a pause mark on the playing row. A paused playing row shows an accent play mark. The playing row's title is accent colored.
- **Engine glyphs.** `fa-plus`, `fa-heart` (liked and not) and the `more_horiz` word are drawn as Lucide masks (register L-02). The mask for the ellipsis was written by hand from Lucide's `ellipsis` shape (three circles); it is not yet in `icons.js`.
- **Heading.** The engine's heading block is hidden; a title bar shows the list name and song count instead (D25).

## Evidence

- `node --test tools/tests/ui-next-songlist.test.js`: **22 of 22 pass.** Real Chromium, the unmodified engine plus the one seam, fixtures of 30 and 400 songs.
- Full suite `node tools/tests/run.js`: **696 tests, 695 passed, 0 failed, 1 skipped.** `node tools/lint.js --strict`: 137 files, 0 errors, 0 warnings. Gate 13 of the shell tests caught my first attempt (row classes in `views/`), which is why the row CSS is in `adapter/`.
- Two screenshots looked at (comfortable with a playing, a selected and a hovered row; compact). Found and fixed from them: a selected row was blank (the highlight layer was drawn over the row), and the engine's heading block pushed the rows down.
- Tests assert: header and rows line up at 1300, 1000 and 760 px; hiding each column; saved choices survive a reload; drag, limits, double click and arrow keys on the handle; compact height reaches the engine (`ITEM_HEIGHT`, list height `count * 36`); play on double click, accent on the playing title; glyph masks; the header leaves with the song views; the old page still has `ITEM_HEIGHT` 56 and the seam works there.

## Not done, and why

- **Not run in Electron.** Headless Chromium with a stubbed `electronAPI`, as for earlier phases. Fixture durations are plain numbers, so "Time" shows seconds there; real data is `m:ss`.
- **Header sorting.** The header cells are labels only. Sorting by a column changes list order, which belongs to the engine's list providers; not started.
- **Other themes and accents** were not looked at, only Warm Graphite.
- **Context menu, drag and drop, multi-select with Shift or Ctrl, cover sync** were not exercised in the new shell. They use the engine's own markup and actions, which are unchanged; a single click selecting and a double click playing are tested.
- **Right-to-left titles** (Persian, Arabic) were not checked on screen. The risk list in PLAN.md still asks for this in B-03: please look at one Persian title. Rows use `text-overflow: ellipsis` without `dir`, so the ellipsis side may be wrong.
- **List toolbar** (play all, shuffle, search in this list, clear history) is absent from the shell's skeleton, so it is not shown. Parity gap, D26.
- **Smart-lyrics list** reuses `.song-item` and copies `ITEM_HEIGHT` at load (`05c`). The new styling applies only inside `[data-songlist]`, which is attached only to the Library view, so it is unaffected. D-01 should check this when it takes over the lyrics view.
- **Archive** (`AGENTS.md` section 1) not made; the project folder is not reachable from here. You snapshot before applying.
- `npm install` was run in the working copy to run tests; `node_modules` is not part of the patch.

## Manual checks for you (`--ui=next`)

1. Open Library. Expected: a title bar ("All Songs", song count), a header row (# Title Album Time and a columns button), then rows of 56 px.
2. Hover a row. Expected: a soft highlight, a play mark where the number was, queue, heart and more buttons appear. Click once: the row is selected. Double click: it plays, the title turns amber, bars animate in the number cell.
3. Drag the thin line between Title and Album. Expected: the two columns trade width; the Album column never gets thinner than a short word. Double click the line: back to the default. Focus it with Tab and press the left and right arrows.
4. Columns button, uncheck Album, then Cover art. Expected: the columns go away and the Title column fills the space. Close and reopen the app: the same.
5. Columns button, Compact. Expected: rows get shorter, no covers, the artist sits beside the title. With a large library scroll far down first: the same song stays at the top.
6. Narrow the window. Expected: Album disappears below about 700 px of list width and returns when wider.
7. Right click a row, drag a row to a playlist, select several with Shift and Ctrl. Expected: as in the old screen.
8. Play a Persian title. Expected: readable; tell me if the ellipsis or alignment looks wrong.

## Follow-ups for others

- A: fold `adapter/songlist-bridge.js` and `library-bridge.js` into the A-04c surface; add the `ellipsis` and `trash-2` shapes to `icons.js` when convenient.
- B (next): B-04 search, B-05 detail views and the list toolbar (D26).
- Cleanup after cutover: the old `.tracklist-header` markup inside the engine's template, which the shell does not use.

# Plan: the song list columns (more columns, resize every column, rearrange, more rows)

**Author:** Agent B | **Date:** 2026-11-05 | **Status:** A plan for the owner to read and answer. Nothing in it is built except step 0.

## What the list is today (read from the code)
- **Rows are the engine's.** Each row is an HTML string (`ui/04a createSongItemHTML`, the loading rows in `05a`, other variants for search and history) placed by a virtual list: absolutely positioned, one fixed row height, only the rows in view exist.
- **The columns** are fixed cells of a row: number, title (cover, title, artist), album, and a right cell (hover buttons, time, more). Show or hide: Cover art, Artist name, Album, Rating, Time, set by attributes on the list's host.
- **The grid is written twice** (header in `views/library/song-list.css`, rows in `adapter/songlist-rows.css`) and now a third time for the Rating column. A hidden column keeps its (zero width) track and its gap. The narrow-window rules are container queries (700px drops the Album and the handle, 640px drops Rating).
- **Only one boundary can be dragged:** Title and Album share a fixed total (a share between 20% and 80%). Rating now has its own width handle (88 to 240px). Nothing else resizes, nothing moves.
- **A new column is expensive:** it needs the grid in three files, the header, the columns menu, the saved state, the narrow rules, and a cell added to every row by script (as Rating does).

## What goes wrong because of that
1. A row that arrives with a different set of cells than the header expects shifts the others (the stray star): the grid places cells by order, not by name. Fixed for Rating by giving each cell its own grid column (done, with this plan).
2. Hidden columns leave gaps.
3. Each added column repeats the same edits and the same risk.
4. Resizing is limited to one pair; there is no way to give a long title more room or make Time narrower.
5. "More rows" and "more columns" both hit the same wall: the layout is decided in CSS with fixed tracks, and the engine cannot be asked what fits.

## The target
**One column table, one template, every cell named.**
- A **column registry** in one module: for each column an id, label, who draws its cell (the engine, or a cell added by script like Rating), default, minimum and maximum width (or "takes the rest", the title), alignment, whether it can be sorted, and its priority when the window is narrow.
- **One function builds the grid template** from the registry, the saved widths and order, and which columns fit, and sets it once on the list's host as a single resolved value (no chain of variables, so a container query cannot break it). The header and every row use that one value. This is the "every row horizontally in step with the header" rule made structural: there is nothing left to get out of step.
- **Every cell has a name** (a class the engine already writes, or a `data-col` for ours) and is placed by that name (`grid-column` from the registry), so a missing, extra or reordered cell cannot move another.
- **Which columns fit** is decided by a ResizeObserver on the list, from the priorities, not by hard-coded widths; hidden columns take no track and no gap.
- **Resize:** a handle at every boundary; dragging changes the column to its left in pixels and the title column takes the difference; keyboard (arrows, Home, End, Enter to reset); double click resets; widths saved per column; "Reset column widths" resets all.
- **Rearrange:** "Move left" and "Move right" in the header menu of each column (works by keyboard) and dragging the header; the order is saved. The number and the right cell (buttons, time, more) stay put.
- **More columns** are then one registry entry plus one batch lookup each (like Rating): Year, Genre, Play count, Date added, Rating, Bitrate. The columns menu is built from the registry.
- **Sort by a column** by clicking its header (the engine's sort, PB-08), with a mark on the sorted column.
- **More rows:** the row height becomes a setting (the density: comfortable, compact, and a denser one), the virtual list recalculates when the window or the density changes (this is the part that has to be measured in a browser: the "resizing" problem you name is most likely the window and the virtual window disagreeing about the height).

## Steps (each is its own patch and can be stopped after)
| # | Step | Size | Risk | Proof |
|---|---|---|---|---|
| 0 | **Done:** Rating as a cell added by script, its own width handle, cells placed by name, a stray or missing cell cannot break the grid. | small | low | unit tests for the rules, owner's eyes |
| 1 | The template builder as a pure module (registry in, grid template out), used by header and rows, replacing the three hand-written grids. Behaviour identical, nothing new visible. | medium | medium (touches every list) | unit tests of the builder; a measurement: header and row cells have the same left edge, in every state and width |
| 2 | Priorities and a ResizeObserver instead of the container queries; hidden columns take no track. | small | medium | the same measurement at several widths |
| 3 | A handle at every boundary, widths saved per column. | medium | medium | unit tests (clamping, saving), the measurement, owner's eyes |
| 4 | Move left / right and drag the header, order saved. | medium | medium | unit tests of the order, the measurement |
| 5 | More columns (Year, Genre, Plays, Date added), from the registry. | one small step per column | low once 1 to 4 hold | per column: batch lookup test, the measurement |
| 6 | Sort by clicking a header. | small | low | the existing sort tests |
| 7 | Row height as a setting; the virtual list recalculating on resize. | medium | high (the virtual list) | needs the browser measurement; I cannot do it blind |

## What I need in order to do steps 1 to 7 well
- **The measuring tool, run on your machine** (parked for now, see `PARKED.md`). Steps 1 to 4 and 7 are about pixels; reading CSS is not enough. I would add the one check that matters: for every list, state and width, the left edge of each header cell equals the left edge of the same cell in every row.
- Your answers below.

## Questions for the owner
1. **"More rows":** do you mean more rows visible at once (a denser row height), or more columns of information per row, or both?
2. Which **extra columns** do you want first (Year, Genre, Play count, Date added, Bitrate, others)?
3. **Rearranging:** is "Move left / Move right" in a header menu enough, or do you want dragging the header too?
4. **Which columns may be moved:** can the Title move (it takes the rest of the width), or only Album, Rating and the new ones?
5. **Per list or everywhere:** one set of columns for every list, or can the Favorites list and the Albums list have their own?
6. Should step 1 (the template builder, nothing new visible) go first, or do you prefer new columns first on the current way and the cleanup later?

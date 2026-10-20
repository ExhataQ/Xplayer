# UI-B01 / B-02: list confirmation and library panel research

**Owner:** B. **Status:** In review. **Date:** 2026-10-17. **Type:** documentation only. **Patch:** `ui-b01-b02-research-and-board.patch`. No source, test, build or Electron file changed.

## What the patch does

| File | Change |
|---|---|
| `.agent/BOARD.md` | Reconciled with the reports and source after your "Phase 1 finished". New decisions D19 to D22, blockers and questions Q1 to Q6, B-01 and B-02 rows, report list |
| `.agent/ui-redesign/research/B-02-library-panel-map.md` | New. Map of the engine's left panel: data source, rendering and virtual scroll, filters, find, sort, what other engine code expects, two strategies, checks before code |
| `.agent/ui-redesign/research/B-01-list-and-views-map.md` | Added section 12 only: what B re-checked, one correction, what was not re-checked |
| `.agent/reports/UI-B01-B02-research.md` | This report |

`tools/CHANGELOG.md` is not touched (task agents do not edit it).

## Board changes, and what each rests on

| Row | Was | Now | Basis |
|---|---|---|---|
| P0-03, A-01, A-04a, A-04b, A-04, A-05 | In review | Done | Your statement that Phase 1 is finished. Their reports show passing checks but each was marked "In review" |
| A-03 | Not started | Done | Report `UI-A03-A04-shell-and-adapter.md` and the shell files exist in the zip |
| A-06 | Not started | Done (on your word) | No A-06 report or gate script is in the zip. Not verified by B |
| A-04c | Not started | Not started, carried into Phase 2 | `ui-next/adapter/` contains only `legacy-dom-adapter.js` and `legacy-icons.css` |
| A-09 | Not started | In review | Its report says In review |
| B-01 | Research draft by A | In review | Partly re-read by B, see below |
| B-02 | Not started | In progress (research, no code) | This patch |

D14, D15, D17 and D18 were left Open: nothing in the zip answers them. D9 has an empty Answer cell in the original board; left as it was.

## Checks done

All by reading the source in the supplied zip. Nothing was run.

- **B-01, re-read and correct:** `switchView` (`ui/07-views.js` line 898), `view:changed` (`core/state-navigation.js` line 10), virtual scroll threshold 200 and range 0 to 2000 (`ui/05a`), `rebuildVirtualWindow` (line 94), the Artists "coming soon" text (`ui/07-views.js` line 1077), row `data-action` attributes.
- **B-01, correction:** "Eight actions in total" lists nine names. Recorded in section 12.
- **B-02:** read `collectAllLeftPanelItems`, `renderLeftPanelMainList` (`ui/04a`), all of `ui/05b-lazy-load-left-panel.js`, `ui/filters.js`, `flattenLeftPanelItems` (`playlists/03h`), `performLeftPanelSearch` and the focus and blur helpers (`search/08h`), `renderPlaylistsView`, `renderFoldersView`, `renderFolderContents` (`ui/04b`), `renderAlbumLeftPanelItems` (`ui/04c`), the pinned-items helpers (`playlists/03g`), the panel part of `build/music_player.html`, and grepped the other consumers of `.left-panel-main-item`, the cover play button and the filter state.
- Line numbers in the new document were re-checked with grep after writing.

## Findings that need your attention

1. **Left panel find may miss rows (unverified).** It hides DOM rows, and the virtual list keeps only the visible window in the DOM. A match lower in a long list would not be found. This is the first thing to test before B-02 code, and if true it is an engine bug, not a restyle item (decision D22).
2. **Filter chips are not real filters.** Playlists, folders, All Songs and Liked Songs are never hidden by any chip. D9's Folders chip and All chip do not exist in the engine.
3. **Chip and search elements are not in the adapter.** `ui/filters.js` calls `classList.add` on a chip element without a null check, so a chip action with no element would throw. Whether the shell supplies hidden chip elements or B replaces the handlers is an open question for A (needs A-04c).
4. **Row height is read once** from `--left-item-height` at module load. A compact mode needs an engine change or a value set before load.
5. **Four render builders look like dead work** (they append rows, then call `renderLeftPanelMainList()`, which empties the list). Unverified at runtime; not to be touched in Phase 2.

## Not done, and why

- **No code and no view work.** B-02 needs D21; B-03 needs D16 and the A-owned view-host bridge (PATCH-PLAN.md section 4, step 1); anything that imports from `adapter/` needs A-04c (question Q1).
- **No test or build run.** Documentation only. The full suite was not run, and `lint` and `ui-handlers` have still never been run against `src/ui-next/` on your machine (A's note).
- **Archive not made.** `AGENTS.md` section 1 requires a snapshot of `E:\Programming\Music Player`; that path is not reachable here. B worked on a copy of the zip. Snapshot before you apply the patch.
- **`AGENTS.md` and the template.** `AGENTS.md` ends mid-sentence at section 13 and `reports/TEMPLATE.md` is not in the zip. This report follows the structure of the existing ones.
- **A-06 not verified.** See the table above.
- **No Electron run.** Nothing was run in Electron or in a browser.

## Manual checks for you (to settle the unverified findings)

1. Create 300 playlists (or import a library with that many items). Open the panel, click the find box, type a name that is in the lower half of the list. Expected if the finding is right: no result. Expected if not: the row appears.
2. In the new shell (`--ui=next`), look for the left panel. There are no chip or find elements today; note what shows.
3. Old UI: click the Albums chip. Expected from the code: albums appear and playlists, folders, All Songs and Liked Songs stay.

## How to apply

1. Snapshot the project (`AGENTS.md` section 1).
2. `git apply --check ui-b01-b02-research-and-board.patch`, then `git apply ui-b01-b02-research-and-board.patch`. The board hunk is against the `BOARD.md` in the zip you supplied; if you changed the board since, resolve by hand and keep both sets of rows.

# B-01 research: song list, virtual scroll and the engine's view router

**Status:** Research draft by A, no code changed. **Evidence:** static reading of `src/js/` plus one throwaway browser experiment (section 7) on the new shell with 1000 fixture songs. Nothing below was measured in Electron.

## 1. Summary

1. The song list is not one component. It is an HTML-string row builder, a virtual scroll engine, two overlay layers (hover highlight and selection highlight), a playing-row marker, drag source, context menu target and cover sync, spread over 18 files that touch list or row DOM.
2. **Every engine view renders into the same container** (`#main-content` / `#song-list-container` / `#song-list`): all songs, albums, artists, playlists, favorites, history, search, **Settings and lyrics**. The engine's router is `switchView(view)` over 15 view names, with its own back/forward history.
3. **The engine's own views can run inside the new shell today.** Moving one subtree into the shell's view host kept node identity, rendered 1000 rows, played from a double-click and rendered albums, favorites and settings with zero page errors (section 7). They are unstyled, not broken.
4. So Phase 2 does not have to rebuild each view before it can show it. It can **show the engine's views in the shell first and restyle or replace them one by one** (strategy S1 below). That is the recommendation.
5. Multi-selection state is an engine `Set` (`selectedSongIds`), not a DOM property. That makes a future own-rows list (S2) feasible with a small engine seam.

## 2. What touches the list (22 files matched; 18 touch list or row DOM)

| Role | Files | Touches |
|---|---|---|
| Row markup, hover layer, selection layer | `ui/04a-ui-render-core.js` (30 hits) | `buildSongItemHTML`, `renderSongsList`, `initHoverLayer`, `selectSongItem` |
| Virtual scroll, main list | `ui/05a-lazy-load-main-list.js` (23) | threshold, spacers, absolute rows, placeholders, rAF scroll |
| Virtual scroll, left panel and smart-lyrics list | `ui/05b`, `ui/05c` | same idea for other lists |
| Per-view renderers | `04b` playlists and folders, `04c` albums, `04d` artists, `04e` favorites and history, `04f` search history | write into `#song-list` |
| Playing marker | `playback/13-song-highlight.js`, `playback/15e-controls-audio-events.js` | `.song-item.playing`, `.song-number-item` |
| Selection mirror | `ui/17-song-selection.js` | `.song-item.selected`, `.last-selected`, `.favorite-btn` |
| Drag source | `ui/06f-drag-drop-songs.js` | `mousedown` on `#song-list`, `closest('.song-item')` |
| Context menu | `ui/06a-context-menus.js` | `closest('.song-item')`, reads `selectedSongIds` |
| Cover sync | `library/03k-cover-sync.js` | `#song-list .song-item[data-song-id] .song-cover` |
| Pages rendered into the list container | `ui/08e-panel-settings.js` (Settings), `lyrics/19-online-lyrics.js` (smart lyrics; reuses `.song-item` as styling) | |
| Container show or hide | `ui/07-views.js` | `song-list-container`, `lyrics-view-root` |
| Matches that are only array variables, no DOM | `playback/14`, `10d`, `15c` | `songList` is a JS array |
| Holds the element reference | `core/00-state.js` | `songListElement` |

## 3. Row anatomy (what the engine needs from a row)

`.song-item` (+ `.playing`, `.selected`), with `tabindex=0`, `data-song-id`, `data-ghost-slot`, `data-cover`, children `.song-number-item`, `.left-song-item` (`img.song-cover`, `.song-title`, `.song-artist`), `.song-album`, `.right-song-item` (`.song-action-buttons` with `.add-to-queue-btn` and `.favorite-btn`, `.song-duration`, `.more-info`).

Behavior is attached by `data-action` attributes, so any markup that carries them works: `selectSongItem` (click), `playSongFromList` (dblclick), `songContextMenu` (contextmenu and the more button), `playSongFromListOnEnter` (keydown), `handleNumberCellClick`, `addSongToQueueNext`, `toggleFavorite`, plus `openAlbum` and `openArtist` on the links. **Eight actions in total.**

Icons in a row: Font Awesome (`fa-plus`, `fa-heart`) and Material Symbols text (`more_horiz`). Neither is mapped in the new shell; unmapped they show as empty boxes and the word "more_horiz" (screenshot in the experiment).

## 4. Virtual scroll

- Turns on above a threshold (default 200 songs, user setting 0 to 2000, snapped to steps of 50 or 100; Settings writes it).
- Rows are absolutely positioned with a fixed item height, with top and bottom spacers, placeholders during fast scroll, and `requestAnimationFrame` scroll handling.
- It needs a scroll container with a **constrained height**. In the experiment, without the old layout CSS the container was 56,039px tall, so all 1000 rows were "visible" and nothing was windowed. This is the main styling dependency of S1.
- The hover highlight and the selection highlight are separate overlay `div`s positioned from row geometry (`getItemPosition`), not row styles. A new look has to keep that geometry or restyle the overlays.

## 5. The view router

15 views: `all-songs`, `favorites`, `history`, `recent`, `playlists`, `albums`, `artists`, `lyrics`, `online-lyrics`, `smart-lyrics`, `search`, `search-items`, `search-history`, `settings`, `settings-advanced`, plus dynamic ids (`playlist-<id>`, and 13-character ids for albums and artists).

`switchView(view)` tears down lyrics and virtual scroll, flips `display` on `lyrics-view-root` and `song-list-container`, toggles `body.in-lyrics-view`, pushes to the engine's own history and updates the back and forward buttons. `setCurrentView` emits `view:changed { view }`, so the shell **can observe** the router. Data for any view comes from `getSongsForList(listId)`, a pure function (providers), so views can read songs without touching DOM.

Parity note for A-11: the Artists view in the old UI renders the text "ARTISTS view coming soon!".

## 6. Selection

`selectedSongIds` (a `Set`), `selectedSongId` and `lastSelectedIndex` are engine state. The context menu and keyboard shortcuts read the `Set`, not DOM classes. The classes only mirror the state.

## 7. Experiment (throwaway, nothing committed)

New shell, 1000 songs, `.content-wrapper` moved into `.view-host`, hidden-host layout neutralized, then driven through the engine's own functions:

| Check | Result |
|---|---|
| `#song-list` node identity after the move | same node |
| `switchView('all-songs')` | 1000 rows rendered |
| Double-click row 4 | queue index 3, title "Song title number 4", playing, 1 row marked playing |
| Deep scroll | no error |
| `albums`, `favorites`, `settings` | rendered (211 album rows; empty state; Settings page) |
| `artists` | "coming soon" placeholder (old UI behavior) |
| Page errors | 0 |
| Virtual scroll windowing | **not windowed**: container height unconstrained, see section 4 |

## 8. Strategies

| | S1: show engine views in the shell, restyle | S2: own rows from `getSongsForList` | S3: S1 now, S2 per view later |
|---|---|---|---|
| Effort for first usable list | low: CSS plus a view-host bridge | high: rows, virtual scroll, hover layer, selection, drag, playing mark, cover sync | low, then spread out |
| Engine changes | none | seams for selection, playing mark, cover sync, drag (about 6 modules) | none first |
| Look freedom | limited by the row markup (4 cells) and the two overlay layers | full | grows over time |
| Risk | CSS must replicate the height and layout the virtual scroll expects | regressions in behaviors the old list gets for free | low |
| Fits Settings and lyrics (66 lyrics actions, a whole Settings page rendered by the engine) | yes, immediately | no, each needs a rebuild | yes |

**Recommendation: S3.** Start with S1 for every engine view (a bridge plus styling), keep the register entry L-01, and replace a view with own markup only where the design needs something the engine markup cannot do (for example a resizable column layout). Decision D16.

## 9. Seams S2 would need (for later, not now)

`selectSongItem` takes a DOM element, so a `selectSongs(ids)` seam on the engine; a playing-row API instead of `.song-item.playing` queries in `13` and `15e`; a cover update API for `03k`; a drag-source hook for `06f`. Each is small, but together they are the real cost of S2.

## 10. Icons the engine renders (for the glyph-map patch)

43 distinct `fa-*` classes (most used: `fa-trash-alt` 14, `fa-play` 10, `fa-music` 7, `fa-plus` 6, `fa-history` 6, `fa-folder-open` 6, `fa-thumbtack` 5, `fa-search` 5, `fa-heart` 5) and 22 Material Symbols names (`volume_up` 6, `music_note` 6, `more_horiz` 4, `arrow_back` 4, `search_off` 3, `delete` 3, `close` 3). Decision D12 covers four of them today; Phase 2 needs about 65 mappings, each as a CSS mask like `legacy-icons.css`, scoped to the shell's wrappers.

## 11. Not verified

Left panel internals (`05b`, `renderLeftPanelMainList`, `collectAllLeftPanelItems`) are B-02 and not read in depth. Search (`08h`), the queue panel renderer, the fullscreen viewer and the lyrics view internals are not read. The experiment ran in headless Chromium with generated fixture data; 1000 songs is far below a real library.

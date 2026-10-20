# B-02 research: the library panel (the engine's left panel)

**Author:** B. **Date:** 2026-10-17. **Status:** Research draft, no code changed. **Method:** static reading of `src/js/` and `build/music_player.html`. Nothing here was run in a browser or in Electron. Items marked *unverified* are conclusions from reading, not observations.

## 1. Summary

1. The panel is already one virtualised list of mixed item types: All Songs, Liked Songs, playlists, folders, albums, artists. The new design (D9) is a change of **look and of filter and sort behaviour**, not a new data model.
2. The list's data comes from one function, `getLeftPanelItemsArray()` (`ui/05b`), which returns flat, ordered item objects. It reads storage and engine state, not the DOM. A new panel can render from it without any engine change.
3. Everything around the list is wired to **DOM ids and classes**, so a restyle has to keep them (section 5).
4. The three D9 needs that the engine does not do today: a **Folders** chip, an explicit **All** chip with the other chips behaving as filters, and **sort**. Text find exists but works on rendered rows only (section 4).
5. Four old DOM builders (`renderPlaylistsView`, `renderFoldersView`, `renderAlbumLeftPanelItems`, `renderArtistLeftPanelItems`) appear to be dead work: each ends by calling `renderLeftPanelMainList()`, and that rebuild starts with `list.innerHTML = ''`. *Unverified at runtime.*

## 2. Where the data comes from

| Step | Function (file) | What it does |
|---|---|---|
| 1 | `collectAllLeftPanelItems()` (`ui/04a`, line 143) | Builds item objects. Always: All Songs, Liked Songs, every playlist and folder that is **not inside a folder**. Albums only when the filter mode is `albums` or `all`. Artists only when it is `artists` or `all`. Sorts pinned first, then by recently played |
| 2 | `getLeftPanelItemsArray()` (`ui/05b`, line 341) | Splits pinned and unpinned, re-sorts pinned by **pin order**, then calls `flattenLeftPanelItems` |
| 3 | `flattenLeftPanelItems()` (`playlists/03h`, line 390) | Adds `depth`, `parentKey`, `childCount`, `isExpanded` and inlines the children of expanded folders (depth limit 50, cycle guard) |

Item fields: `type` (`all-songs`, `favorites`, `playlist`, `folder`, `album`, `artist`), `id`, `title`, `viewId`, `pinId`, `count` or `countText`, `cover`, `isPinned`, `playedIndex`, and after flattening `depth`, `parentKey`, `childCount`, `isExpanded`, `isFolder`.

Sort order today: pinned items first in pin order, then everything else by last played, then insertion order. There is no user sort.

## 3. Rendering and virtual scroll

- `renderLeftPanelMainList()` (`ui/04a`, line 1065): if a folder is open (`currentOpenFolderId`) it calls `renderFolderContents` and returns. Otherwise it starts or refreshes the virtual list.
- The panel list is **always virtual**. Unlike the main song list there is no threshold: `initLeftPanelLazyLoading` is used for any non-empty list.
- Row height comes from the CSS variable `--left-item-height` (61 px in `css/left-panel.css`), read once at load by `05b`. JS and CSS therefore agree only if the variable is not changed after load. A compact mode (D9: "compact and expanded") must set it before the module loads or the engine has to re-read it. *Risk for B-02.*
- Window rebuild goes through the shared `rebuildVirtualWindow` (`ui/05a`, line 94), which empties the list and rebuilds the visible rows plus 5 rows of overscan, with a top and bottom spacer. Fast jumps show skeleton rows (`buildLeftPanelPlaceholderHTML`, fixed 59 px, inline styles) and settle after `VIRTUAL_SCROLL_SETTLE_MS`.
- **Open folder view is not virtual.** `renderFolderContents` (`ui/04b`, line 141) tears the virtual list down and appends every child as a real `li` (class `folder-contents-item`). A very large folder is not windowed. *Unverified for large counts.*
- Row markup is `buildLeftPanelItemAt` (`ui/05b`). Each cover is an inline SVG per type or an `<img>`, so the look is partly hard-coded in JS (colors such as `#450af5`, `#2a2a2a`, `var(--accent)`). A restyle by CSS alone cannot change those covers; it can only hide or frame them.

## 4. Filters, find and sort

| Feature | Engine today | Gap against D9 |
|---|---|---|
| Chips | Three toggles in the HTML template: Playlists, Artists, Albums (`#playlists-filter-tag`, `#artists-filter-tag`, `#albums-filter-tag`, `ui/filters.js`). Clicking the active chip returns to `all`. Mode is `leftPanelFilterMode` (`core/state-ui.js`), reset to `all` at startup (`core/startup.js`, line 165), so it is **not remembered** | No **Folders** chip and no explicit **All** chip |
| What a chip hides | `playlists` hides albums and artists. `albums` hides artists only. `artists` hides albums only. All Songs, Liked Songs, playlists and folders are **never** hidden by any chip | A "Folders" or "Albums only" chip needs a real include list per type, which means a change in `collectAllLeftPanelItems` |
| Find | `performLeftPanelSearch` (`search/08h`, line 197) hides rows by setting `style.display` on `.left-panel-main-item` elements **currently in the DOM**, matching title plus subtitle text | With a virtual list only the visible window plus overscan is in the DOM. A match further down the list is never tested, and any re-render clears the hiding. *Unverified; first thing to test.* A correct find needs to filter the item array, not the DOM |
| Sort | None | New. Needs an engine-side seam or a view-side sort of the array (sorting in the view would break the pinned-first rule unless it re-applies it) |
| Pinned first | Yes, pin order | Keep |

## 5. What other engine code expects from the panel (the contract B must keep)

| Dependency | File | What it needs |
|---|---|---|
| Panel scaffolding | adapter `legacy-dom-adapter.js` line 149 | `#left-panel`, `.left-panel-main-list-container`, `#left-panel-main-content`, `.left-panel-main-list` (the adapter already supplies these) |
| Chips, search, header | `build/music_player.html` lines 185 to 236 | `#playlists-filter-tag`, `#artists-filter-tag`, `#albums-filter-tag`, `#left-panel-search-*`, `#create-playlist-header-btn`. **The adapter does not supply the chip and search elements today** (checked by grep of `ui-next/`). `filters.js` dereferences the chip elements without a null check, so a chip click with no element throws. Hidden-host elements would be a contract item for A |
| Row identity | `07-views.js` (lines 101, 115, 764, 960), `17-song-selection.js`, `04k-playlists-events.js` | `.left-panel-main-item` with `data-view` (and `data-pin-id`); active state is a class `active` set by `07-views`; counts are written into `.main-item-count` for `all-songs` and `favorites` |
| Playing state | `playback/15e`, `library/03k-cover-sync.js` | `.left-panel-cover-play-btn[data-view]` toggles `is-pause`; cover sync queries `.left-panel-main-list .left-panel-cover-play-btn[data-view=...]`; rows carry `playing` and `paused` classes |
| Play button click | `playlists/09-folders-playlists.js` line 40 | delegated on `.left-panel-cover-play-btn` |
| Row actions | `05b` | `openPlaylist`, `openAlbum`, `openArtist`, `openFolder`, `switchView`, `itemContextMenuPrevent`, `toggleFolderExpandedFromUI` through `data-action` |
| Drag and drop | `ui/06g-drag-drop-left-panel.js`, `06f-drag-drop-songs.js` | `.left-panel-main-item`, `.main-item-title`, `[data-stop-mousedown]`, classes `drag-hover`, `drag-folder-hover`, `drag-invalid`, `data-depth`, `data-parent-folder` |
| Context menu | `ui/06a-context-menus.js` line 486 | `closest('.left-panel-main-item')` |
| Scrollbar | `updateScrollbarById('left-panel-main-content')` | the id above and a custom-scrollbar container |
| Collapse and resize | `ui/layout.js`, `core/01-sizes.js` | the engine writes the panel width inline and collapses it itself; D9 "compact and expanded" must decide who owns that (open question for A) |

Not read: `layout.js` internals beyond the collapse thresholds, the keyboard handling for the panel list, and the context menu contents.

## 6. Strategies for B-02

| | L1: restyle the engine panel | L2: own rows from `getLeftPanelItemsArray()` |
|---|---|---|
| Effort for a usable panel | low: CSS on the existing row markup, new chips and find in the shell | high: rows, virtual scroll, active and playing state, drag and drop, context menu, cover sync |
| Engine changes | none for restyle; seams for Folders chip, text filter, sort (small) | those seams plus selection and playing-state hooks |
| Look freedom | rows keep the 3-part structure (cover, title and subtitle, playing icon); the SVG covers are hard-coded | full |
| Risk | the 61 px row height and inline placeholder sizes must be matched by the new density | many behaviors the panel gets for free today |

**Recommendation (decision D21): L1 first.** Restyle the rows by CSS, put the new chip row, find box and sort control in the shell using the A-05 components, and have them call the engine through the adapter. Ask for three small engine seams as a separate, approved patch: (a) a filter set that includes Folders, (b) a text filter applied to the item array before windowing, (c) an optional sort applied after the pinned-first rule. Move to L2 only if the design needs something rows cannot do. This matches D16's S3 and keeps the dead-work builders out of scope.

## 7. Risks and checks before code

1. **Find on a long list.** Reproduce with a fixture of 300 playlists: type a name that is only in the lower half. If it is not found, the seam in 6(b) is a bug fix, not a feature.
2. **Chip elements.** Confirm in the shell that clicking a chip with the element missing throws, then decide whether A's adapter supplies hidden chip and search elements or B replaces the handlers through the adapter (needs A-04c).
3. **Row height.** Decide whether compact mode is a second value of `--left-item-height` re-read on change. This is an engine change to `05b`.
4. **Large folder.** Measure `renderFolderContents` with 2000 children before promising the new design for it.
5. **RTL titles.** Persian and Arabic titles in rows, subtitles and the find box (PLAN.md section 7).
6. **Dead builders.** Confirm by test that removing the four `render...View` appends changes nothing visible. Do not remove them in Phase 2 (engine folders are frozen); list them for the cleanup after cutover.

## 8. Not verified

Everything in sections 3 and 4 that says *unverified*. No run in headless Chromium or Electron was done for this document. Keyboard navigation, the context menu contents and `layout.js` were not read.

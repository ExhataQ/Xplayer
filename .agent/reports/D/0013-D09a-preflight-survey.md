# Agent D report 0013: D-09a pre-flight survey (no code changed)

Step: D-09a. Read-only: **no source file was edited**. The patch adds this report, the raw survey data and a change-log line. Applies on `Xplayer-main_12`. No commit, no push.
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup` is not reachable from my environment.
Scope: the 34 D files still classic in `src/manifest.json` (`04a` to `04v`, `05a` to `05c`, `06a` to `06h`, `06j`, `06k`, `07-views`, `07a`). `06i` is already a module. Tools: `tools/dep-map.js` (its JSON output), plus my own acorn scripts for listeners, `window` uses, reassignments and strict-mode checks (kept out of the repo; the raw data is in `0013-d09a-survey.json`).

## Result in one paragraph

The mechanical part is easy: no D file has a strict-mode problem (all 34 parse as modules; no function declarations in blocks, no top-level `this`), no cross-file duplicate names, no forward load-time reference, and the event subscribers (`04h` to `04v`) have no non-D subscriber to interleave with. **But four things would break or silently change behavior if a file were simply moved to `"modules"`, and one of them already blocks D-09b.** They need a decision before D-09b (sections 1 to 4 below). Nothing here changes the order of the nine steps.

## 1. Shared `let` variables that other files read or set by bare name (blocks D-09b to D-09d, D-09g, D-09h, D-09i)

A `let` declared in a classic script is a global binding every script sees and can assign. In a module it is private, and `registerLegacyGlobals({ name })` only copies the value at that moment (and refuses to replace it later), so a changing variable would go stale. 13 variables are reassigned and also touched from another file:

| Variable | Declared in | Set from other files | Read by other files |
|---|---|---|---|
| `lastMouseX`, `lastMouseY` | 06c | `core/state-ui.js` setters (A) | 04a, 13 (lastMouseY) |
| `notificationHistory` | 06j | `core/state-ui.js` | 06b |
| `notificationPanelOpen` | 06j | - | 06a, 06b |
| `downloadNotifyIndex` | 06b | `core/state-ui.js` | 06j |
| `activeContextMenuSlot` | 06a | - | 16 (B) |
| `currentContextSongId` | 06a | - | 10c, 16, 17 (B) |
| `hoveredSongIndex` | 04a | `core/state-ui.js` | (this file only) |
| `selectedSongId` | 04a | `core/state-ui.js` | 05a, 06k, 17 |
| `lastSelectedIndex` | 04a | `core/state-ui.js` | (this file only) |
| `selectionHighlights` | 04a | `core/state-ui.js` | 17 |
| `VIRTUAL_SCROLL_THRESHOLD` | 05a | - | 08e (C), 2 tests |
| `isNavigatingHistory` | 07-views | `core/state-navigation.js` (A) | (this file only) |

Nine of them are written by A's setters (`setLastMouseX` and the others), which assign the bare name "still declared in its original file" (comment in `core/state-ui.js`). Once the owner file is a module, those setters throw (strict mode: assignment to an undeclared name) or the setters' tests fail.
The other reassigned `let`s (for example `hoveredRowEl`, `hoverLayer`, `tooltip`, `lensActive`) are used only inside their own file and are fine.

**Options** (decision for you and A, because the fix touches A's files):
1. **Move the 13 declarations (with their initial values) out of the D files into a classic script A owns** (for example next to `00-state.js`, or a new `core/state-ui-vars.js` listed before `04a`). The D files lose only the `let` lines (all initial values are plain literals, `-1`, `null`, `0`, `false`, `[]`, except `VIRTUAL_SCROLL_THRESHOLD`: declare it early as `let VIRTUAL_SCROLL_THRESHOLD = 0;` and keep its computed initial value as an assignment at the top level of `05a`, which runs before anyone reads it); every read and write, in D modules, B and C classic files and A's setters, keeps working with no other change. A-16 later moves them into the state modules, as the plan already says for the other classic `let`s. This is what I recommend. Call it **D-09a2** (one small patch, tests: `setters.test.js`, `scroll.test.js`, `ui-handlers.test.js`).
2. Add accessor support (getter and setter on `window`) to `registerLegacyGlobals` (A's `core/legacy.js`) and use it from each module. More machinery and it changes A's bridge.
3. Wait for A-16 for these files. Blocks D-09b (06c, 06j) and everything after it.

Not an issue (a copy of the value is fine, register as before): `selectedSongIds`, `virtualScrollState`, `leftPanelVirtualState` (never reassigned, changed in place) and the shared `const`s `VIEWS`, `ITEM_HEIGHT`, `MIN_`/`MAX_VIRTUAL_SCROLL_THRESHOLD`, `VIRTUAL_SCROLL_SETTLE_MS`, `LEFT_ITEM_HEIGHT`, `LEFT_OVERSCAN_COUNT`, `CONTEXT_MENU_TYPE_LABELS` (full list per file in Appendix A).

## 2. Implicit global in `06c` (D-09b)

`06c-scrollbar-widget.js:85` does `updateExternalScrollbar = updateScrollbar;` and **no file declares** `updateExternalScrollbar`. In a classic script that silently creates a global; in a module it throws a `ReferenceError` the first time a main-content scrollbar is built. 35 references in 16 files read it (most guarded by `typeof updateExternalScrollbar === 'function'`, but `04a:525`, `04f:124`, `04h:30`, `08h:87` call it directly). Fix in D-09b: `window.updateExternalScrollbar = updateScrollbar;` (the callers keep working; spied tests replace `window.updateExternalScrollbar`). `00-state.js:96` has an unrelated `updateExternalScrollbarFn`.

## 3. Load-time references from classic files into D files (D-09b and D-09d)

`ui/player-bar.js` (A, classic, runs while the page loads) uses two D names at load:
- `albumArtImage.addEventListener('click', openImageViewer)`: `openImageViewer` is in `06h`. Once `06h` is a module this throws at load and kills the rest of `player-bar.js`.
- `if (typeof initMarqueeOnHover === 'function') ...` (lines 26 and 32): `initMarqueeOnHover` is in `06k`. Once `06k` is a module the guard is false and the title/artist marquee **silently stops working**.

Fix (A's file, two lines, same pattern A used in A report 0017 for song navigation): `addEventListener('click', () => openImageViewer())`, and call `initMarqueeOnHover` from a `whenAppReady` callback (or make `ui/player-bar.js` a module after `06h` and `06k`). It must go in before D-09b (06h) and before D-09d (06k). I can write it if you tell me A agrees.
No other classic file references a D name while loading (`dep-map`: 28 load-time references, none forward). D's own load-time reads are `on` (from `00b-events`, the event files), `debounce` (06d, from `00-state`) and `ITEM_HEIGHT` (05c, from 05a).

## 4. Listener order (D-09b, D-09d, D-09f)

Document and window listeners registered while the page loads, in manifest order today: bridge (`core/legacy.js`), `04a` keydown, `06a` keydown, mousedown, click and `window` resize, `06c` `window` beforeunload and a capture `mousemove`, `06d` mouseover and click, `06e` DOMContentLoaded, `06k` keydown and mousedown, then `99-player.js` DOMContentLoaded. Plus the element listeners in `06f` and `06g` (registered when their init runs) and `ui/player-bar.js`.
- Modules run after all classic scripts, so the D listeners keep their order **among themselves** (keep the D files in this order in `"modules"`) and still come after the bridge. Nothing else registers a document listener at load, so no other order changes... **except `06e`**: its `DOMContentLoaded` listener is registered today before `99-player.js`'s, and as a module it would be registered after, so it would run after `99-player`'s init instead of before. I checked what both do: `06e` only moves `title` to `data-original-title` and sets a few tooltip texts (it sets the collapse-button tooltip only if absent), and `06d` accepts either attribute, so I expect no visible change, but it is a real order change; D-09b must say so and test it.
- Event subscribers: all 36 top-level `on(...)` calls are in D files (`04h` to `04v`), none elsewhere, so converting them cannot reorder against other agents' subscribers. Their order among themselves is the manifest order (04h, 04i, 04j, 04k, 04l, 04m, 04n, 04o, then 04p, 04t, 04u, 04v). The same modules would register after the classic scripts but before DOMContentLoaded, and nothing emits before that (`18-lyrics-editor.js` emits only from a function). So the decision for D-09f is a naming/ordering one, not a correctness risk: **I propose keeping the rule "subscribe at the top level" and keeping the order.**
- Module order constraints for the `"modules"` list: `05a` before `05c` (05c reads `ITEM_HEIGHT` at load); `06j` before anything that reads it at load (nothing does today).

## 5. Functions reassigned at run time (D-09d, already planned)

Only `06b`: `closePlaylistModal` at lines 262, 375, 460, 541 and `closeAddLinkModal` at line 652, all inside functions, plus `window.handleEditPlaylistCover` and `window._editPlaylistTempCover` (lines 341 to 401). `07a` already calls `window.handleEditPlaylistCover`, so that one is ready. No other file assigns to a D function. Nothing else to add to the D-09d plan.

## 6. Tests that will change (record in each step's report)

Pinned call-sequence baselines (`tools/tests/expected/events-*.json`) and spy lists use D functions that D calls itself; a module's own calls cannot be spied on window, so those names will drop out of the baselines, as in A-15:
- `04a`: `showHeroSection` (1 call inside the file), `updateActiveHighlight` (2), `updateHeroSection` (1), `updateHeroSongCount` (3), `updateSelectionHighlight` (8)
- `05a`: `reapplySelectionState` (3); `05b`: `renderLeftPanelVisibleItems` (6)
- `07-views`: `pushViewToHistory` (3), `resetLeftPanelActiveState` (8), `switchView` (9), `updateSubheroPlayButton` (3), `updateSubheroShuffleButton` (1)
Other spied D names (`renderSongsList`, `renderPlaylistsView`, `showNotification`, ...) are called from other files, so they stay visible. Tests that read the live `let`s from section 1 through the page (`playback-modules.test.js`, `view-switch-song-list-cleanup.test.js`, `ui-storage-api.test.js`, `scenarios-b.js`) keep working under option 1.

## 7. Per-file summary and what each step needs

| Step | Files | Blockers found |
|---|---|---|
| D-09a2 (new, small) | declarations of the 13 live `let`s | section 1 (needs A's agreement) |
| fix in `ui/player-bar.js` (A) | 2 lines | section 3, before 06h and 06k |
| D-09b | 06c, 06d, 06e, 06h, 06j | `06c` implicit global (2) and live lets (1); `06h` and player-bar (3); `06e` order (4); `06j` live lets (1) |
| D-09c | 06f, 06g | none found. They only register element listeners through init functions; keep their `mousedown` order against `04a`'s capture listener and the bridge. They read `selectedSongIds` (a copy is fine), `leftPanelVirtualState`, `CONTEXT_MENU_TYPE_LABELS`, `VIEWS` |
| D-09d | 06a, 06b, 06k | `06b` reassignments (5); `06k` and player-bar (3); `06a` live lets (1) |
| D-09e | 04b to 04g, 07a | none (functions only). `07a` is the largest registration list (it has no state) |
| D-09f | 04h to 04v | rule decision (section 4); no ordering risk |
| D-09g | 04a | needs D-0012; live lets (1); 11 spied names lose call records (6) |
| D-09h | 05c, 05a, 05b | `05a` before `05c` in the list (4); live `VIRTUAL_SCROLL_THRESHOLD` (1); `leftPanelVirtualState` has 10 readers (copy is fine) |
| D-09i | 07-views | `VIEWS` has 41 consumer files, all read it at run time (a copy is fine, register it before any module reads it at load: none does); `isNavigatingHistory` (1); 5 spied names (6) |

Counts of names that other files, tests or `data-action` wrappers use by bare name: 138 functions in total (list per file in Appendix A). Strict-mode check: all 34 files parse as modules and contain no block-level function declarations, top-level `this` or `delete name`.

## Decisions for you

1. **Section 1:** option 1 (move the 13 declarations to a classic file A owns, patch D-09a2)? It needs A to accept that file.
2. **Section 3:** may I write the two-line `ui/player-bar.js` change (A's file) as part of D-09b, or does A do it?
3. **Section 4:** keep the subscriber rule (top-level `on(...)`, current order) for D-09f? I recommend yes.
## Appendix A: per file

Names other files, tests or `data-action` wrappers use by bare name (the ones each step must register with `registerLegacyGlobals`). Files are listed in the D-09 step that converts them.

### 06c-scrollbar-widget.js (D-09b, 331 lines)

- Top level: 2 functions, 2 `let`, 0 `const`, 0 classes; 2 other statements.
- Register (used from other files or tests): `updateScrollbarById`, `initExternalScrollbar`
- **Live `let` `lastMouseX`**: reassigned 1x here; set from core/state-ui.js; read by 04a-ui-render-core.js
- **Live `let` `lastMouseY`**: reassigned 1x here; set from core/state-ui.js; read by 04a-ui-render-core.js, 13-song-highlight.js
- Implicit global `updateExternalScrollbar` assigned at line 85
- `window` properties used: `scrollbarInstances`
- Registered while loading: `window.addEventListener('beforeunload', function () {` (line 15); `document.addEventListener(` (line 31)

### 06d-tooltip-system.js (D-09b, 119 lines)

- Top level: 4 functions, 1 `let`, 1 `const`, 0 classes; 2 other statements.
- Register (used from other files or tests): `temporarilySuppressTooltip`
- Registered while loading: `document.addEventListener('mouseover', function (e) {` (line 73); `document.addEventListener('click', function () {` (line 114)

### 06e-tooltip-titles.js (D-09b, 56 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 1 other statements.
- Register (used from other files or tests): none
- Registered while loading: `document.addEventListener('DOMContentLoaded', function () {` (line 4)

### 06h-fullscreen-viewer.js (D-09b, 137 lines)

- Top level: 5 functions, 4 `let`, 0 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `openImageViewer`, `closeImageViewer`

### 06j-notification-system.js (D-09b, 268 lines)

- Top level: 9 functions, 3 `let`, 0 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `showNotification`, `showCoverProgressNotification`, `completeCoverProgressNotification`, `toggleNotificationPanel`, `closeNotificationPanel`, `clearAllNotifications`, `removeNotificationItem`, `renderNotificationPanel`
- **Live `let` `notificationPanelOpen`**: reassigned 2x here; set from nowhere else; read by 06a-context-menus.js, 06b-modals.js
- **Live `let` `notificationHistory`**: reassigned 3x here; set from core/state-ui.js; read by 06b-modals.js

### 06f-drag-drop-songs.js (D-09c, 335 lines)

- Top level: 1 functions, 0 `let`, 0 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `initSongDragToLeftPanel`

### 06g-drag-drop-left-panel.js (D-09c, 397 lines)

- Top level: 1 functions, 0 `let`, 0 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `initLeftPanelDragAndDrop`

### 06a-context-menus.js (D-09d, 1002 lines)

- Top level: 23 functions, 5 `let`, 2 `const`, 0 classes; 5 other statements.
- Register (used from other files or tests): `showContextMenu`, `closeContextMenu`, `showLeftPanelItemContextMenu`, `showSpecialItemContextMenu`, `showPlaylistContextMenu`, `showFolderContextMenu`, `showAlbumContextMenu`, `showArtistContextMenu`, `showSubheroContextMenu`
- Shared `const` (register, a copy is fine): `CONTEXT_MENU_TYPE_LABELS`
- **Live `let` `activeContextMenuSlot`**: reassigned 2x here; set from nowhere else; read by 16-context-menu-actions.js
- **Live `let` `currentContextSongId`**: reassigned 2x here; set from nowhere else; read by 10c-playback-queue.js, 16-context-menu-actions.js, 17-song-selection.js
- Registered while loading: `registerActions({` (line 328); `document.addEventListener('keydown', function (e) {` (line 935); `document.addEventListener('mousedown', function (event) {` (line 945); `document.addEventListener('click', function (event) {` (line 952); `window.addEventListener('resize', function () {` (line 971)

### 06b-modals.js (D-09d, 933 lines)

- Top level: 26 functions, 2 `let`, 0 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `createModal`, `closePlaylistModal`, `closeAddLinkModal`, `closeCreateItemModal`, `closePlayedDataModal`, `showSongMetadataModal`, `showConfirmDialog`, `showCreatePlaylistDialog`, `confirmCreatePlaylist`, `showEditPlaylistDialog`, `confirmEditPlaylist`, `showCreateFolderDialog`, `confirmCreateFolder`, `showEditFolderDialog`, `confirmEditFolder`, `showCreateItemDialog`, `showAddLinkDialog`, `playFromUrl`, `showPlayedDataModal`, `showWelcomeDialog`
- **Live `let` `downloadNotifyIndex`**: reassigned 3x here; set from core/state-ui.js; read by 06j-notification-system.js
- Reassigned function `closePlaylistModal` at line 262
- Reassigned function `closePlaylistModal` at line 375
- Reassigned function `closePlaylistModal` at line 460
- Reassigned function `closePlaylistModal` at line 541
- Reassigned function `closeAddLinkModal` at line 652
- `window` properties used: `_editPlaylistTempCover`, `handleEditPlaylistCover`

### 06k-keyboard-shortcuts.js (D-09d, 403 lines)

- Top level: 1 functions, 0 `let`, 0 `const`, 0 classes; 2 other statements.
- Register (used from other files or tests): `initMarqueeOnHover`
- Registered while loading: `document.addEventListener('keydown', function (e) {` (line 4); `document.addEventListener('mousedown', function (e) {` (line 208)

### 04b-render-playlists-folders.js (D-09e, 402 lines)

- Top level: 4 functions, 0 `let`, 0 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `renderPlaylistsView`, `renderFoldersView`, `renderFolderContents`, `renderPlaylistDetailView`

### 04c-render-albums.js (D-09e, 179 lines)

- Top level: 3 functions, 0 `let`, 0 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `renderAlbumsView`, `renderAlbumDetailView`, `renderAlbumLeftPanelItems`

### 04d-render-artists.js (D-09e, 114 lines)

- Top level: 2 functions, 0 `let`, 0 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `renderArtistDetailView`, `renderArtistLeftPanelItems`

### 04e-render-favorites-history.js (D-09e, 192 lines)

- Top level: 4 functions, 0 `let`, 0 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `renderFavoritesView`, `renderHistoryView`, `renderRecentlyPlayed`, `renderPortableRecentlyPlayed`

### 04f-render-search-history.js (D-09e, 126 lines)

- Top level: 1 functions, 0 `let`, 0 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `renderSearchHistoryView`

### 04g-render-lyrics-view.js (D-09e, 215 lines)

- Top level: 2 functions, 0 `let`, 0 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `renderLyricsView`, `teardownLyricsView`

### 07a-ui-actions.js (D-09e, 333 lines)

- Top level: 1 functions, 0 `let`, 1 `const`, 0 classes; 3 other statements.
- Register (used from other files or tests): `applyActionAttrs`
- `window` properties used: `handleEditPlaylistCover`
- Registered while loading: `registerActions({` (line 10); `registerActions({` (line 179); `registerActions({` (line 295)

### 04h-recents-history-events.js (D-09f, 61 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 5 other statements.
- Register (used from other files or tests): none
- Registered while loading: `on('recents:count-changed', (e) => {` (line 13); `on('recents:added', () => {` (line 20); `on('recents:cleared', () => {` (line 27); `on('history:added', () => {` (line 41); `on('history:cleared', () => {` (line 47)

### 04i-library-rebuild-events.js (D-09f, 44 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 2 other statements.
- Register (used from other files or tests): none
- Registered while loading: `on('library:rebuilt', () => {` (line 10); `on('covers:scanCompleted', () => {` (line 39)

### 04j-pinned-items-events.js (D-09f, 63 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 3 other statements.
- Register (used from other files or tests): none
- Registered while loading: `on('pinned:changed', (e) => {` (line 9); `on('playedOrder:changed', () => {` (line 25); `on('folderPin:changed', (e) => {` (line 47)

### 04k-playlists-events.js (D-09f, 62 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 4 other statements.
- Register (used from other files or tests): none
- Registered while loading: `on('playlist:listChanged', () => {` (line 11); `on('playlist:deleted', (e) => {` (line 29); `on('playlist:songCountChanged', (e) => {` (line 36); `on('playlist:songRemovedFromView', (e) => {` (line 49)

### 04l-search-history-events.js (D-09f, 22 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 2 other statements.
- Register (used from other files or tests): none
- Registered while loading: `on('searchHistory:cleared', () => {` (line 7); `on('searchHistory:entryDeleted', () => {` (line 15)

### 04m-playback-settings-events.js (D-09f, 20 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 1 other statements.
- Register (used from other files or tests): none
- Registered while loading: `on('playbackSetting:changed', (e) => {` (line 11)

### 04n-import-export-events.js (D-09f, 15 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 1 other statements.
- Register (used from other files or tests): none
- Registered while loading: `on('data:imported', () => {` (line 8)

### 04o-folders-events.js (D-09f, 23 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 1 other statements.
- Register (used from other files or tests): none
- Registered while loading: `on('folder:listChanged', () => {` (line 8)

### 04p-playback-events.js (D-09f, 151 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 12 other statements.
- Register (used from other files or tests): none
- Registered while loading: `on('playback:stateChanged', (e) => {` (line 9); `on('playback:recentViewChanged', () => {` (line 13); `on('playback:recentPanelChanged', () => {` (line 19); `on('shuffle:changed', () => {` (line 26); `on('shuffle:listChanged', (e) => {` (line 32); `on('repeat:listChanged', () => {` (line 43); `on('queue:songsChanged', () => {` (line 55); `on('favorites:changed', () => {` (line 69); `on('songs:changed', () => {` (line 92); `on('viewSongs:changed', (e) => {` (line 105); `on('leftPanelCounts:changed', () => {` (line 137); `on('playlist:songAddedFromMenu', (e) => {` (line 145)

### 04t-lyrics-events.js (D-09f, 12 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 1 other statements.
- Register (used from other files or tests): none
- Registered while loading: `on('lyrics:changed', () => {` (line 9)

### 04u-search-events.js (D-09f, 28 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 3 other statements.
- Register (used from other files or tests): none
- Registered while loading: `on('search:resultsChanged', (e) => {` (line 10); `on('search:summaryChanged', (e) => {` (line 18); `on('leftPanelSearch:cleared', () => {` (line 25)

### 04v-right-panel-events.js (D-09f, 13 lines)

- Top level: 0 functions, 0 `let`, 0 `const`, 0 classes; 1 other statements.
- Register (used from other files or tests): none
- Registered while loading: `on('rightPanel:tabChanged', (e) => {` (line 8)

### 04a-ui-render-core.js (D-09g, 1081 lines)

- Top level: 30 functions, 12 `let`, 3 `const`, 0 classes; 1 other statements.
- Register (used from other files or tests): `updateHeroSongCount`, `updateHeroSection`, `showHeroClearButton`, `showHeroSection`, `setupHeroSection`, `showTracklistHeader`, `updateHeroCover`, `collectAllLeftPanelItems`, `createSongItemHTML`, `buildSongArtistHTML`, `buildSongAlbumHTML`, `buildSongItemHTML`, `renderRightPanelItem`, `renderSongsList`, `scheduleHoverHighlightUpdate`, `hideHoverHighlight`, `updateHoverHighlightAfterScroll`, `selectSongItem`, `clearAllSelections`, `reapplySelectionAfterFilter`, `updateSelectionHighlight`, `updateActiveHighlight`, `renderLeftPanelMainList`
- Shared `let` that is never reassigned (a copy is fine): `selectedSongIds`
- **Live `let` `hoveredSongIndex`**: reassigned 13x here; set from core/state-ui.js; read by this file only
- **Live `let` `selectedSongId`**: reassigned 7x here; set from core/state-ui.js; read by 05a-lazy-load-main-list.js, 06k-keyboard-shortcuts.js, 17-song-selection.js
- **Live `let` `lastSelectedIndex`**: reassigned 8x here; set from core/state-ui.js; read by this file only
- **Live `let` `selectionHighlights`**: reassigned 2x here; set from core/state-ui.js; read by 17-song-selection.js
- Registered while loading: `document.addEventListener('keydown', function (e) {` (line 817)

### 05a-lazy-load-main-list.js (D-09h, 728 lines)

- Top level: 28 functions, 5 `let`, 14 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `snapVirtualScrollThreshold`, `setVirtualScrollThreshold`, `shouldUseVirtualScroll`, `computeVirtualWindow`, `rebuildVirtualWindow`, `appendVirtualBottomSpacer`, `attachRafScroll`, `preloadCover`, `renderVisibleItems`, `syncPlaceholdersForJump`, `attachWheelPlaceholderSync`, `initLazyLoading`, `renderVirtualScrollImmediate`, `scheduleThumbHoldSettle`, `settleVirtualScrollAfterThumbRelease`, `teardownLazyLoading`, `reapplySelectionState`
- Shared `const` (register, a copy is fine): `DEFAULT_VIRTUAL_SCROLL_THRESHOLD`, `MIN_VIRTUAL_SCROLL_THRESHOLD`, `MAX_VIRTUAL_SCROLL_THRESHOLD`, `ITEM_HEIGHT`, `VIRTUAL_SCROLL_SETTLE_MS`
- Shared `let` that is never reassigned (a copy is fine): `virtualScrollState`
- **Live `let` `VIRTUAL_SCROLL_THRESHOLD`**: reassigned 1x here; set from nowhere else; read by 08e-panel-settings.js

### 05b-lazy-load-left-panel.js (D-09h, 350 lines)

- Top level: 7 functions, 1 `let`, 2 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `renderLeftPanelVisibleItems`, `initLeftPanelLazyLoading`, `teardownLeftPanelLazyLoading`, `refreshLeftPanelLazy`, `getLeftPanelItemsArray`
- Shared `const` (register, a copy is fine): `LEFT_ITEM_HEIGHT`, `LEFT_OVERSCAN_COUNT`
- Shared `let` that is never reassigned (a copy is fine): `leftPanelVirtualState`

### 05c-lazy-load-smart-lyrics.js (D-09h, 131 lines)

- Top level: 5 functions, 1 `let`, 2 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `teardownSmartLyricsVirtualScroll`, `refreshSmartLyricsVirtualScroll`
- Shared `const` (register, a copy is fine): `SMART_LYRICS_ITEM_HEIGHT`

### 07-views.js (D-09i, 1139 lines)

- Top level: 36 functions, 1 `let`, 4 `const`, 0 classes; 0 other statements.
- Register (used from other files or tests): `buildPlayerArtistHTML`, `resetViewScroll`, `resetLeftPanelActiveState`, `activateLeftPanelItem`, `refreshCurrentView`, `updateAllCounts`, `getCurrentViewDisplayName`, `setSubheroVisibility`, `updateSubheroPlayButton`, `updateSubheroShuffleButton`, `toggleShuffleFromSubhero`, `isViewCurrentlyPlaying`, `getSongsForList`, `pushToHistoryStack`, `pushViewToHistory`, `canGoBack`, `canGoForward`, `goBack`, `goForward`, `updateNavigationButtons`, `openDetailView`, `openAlbum`, `openArtist`, `switchToLyrics`, `switchView`, `switchToHistoryFromSettings`, `switchToSearchHistoryFromSettings`, `handleHeroClear`, `openSearchHistoryChild`
- Shared `const` (register, a copy is fine): `VIEWS`, `listProviders`
- **Live `let` `isNavigatingHistory`**: reassigned 0x here; set from core/state-navigation.js; read by this file only


# Agent D report 0001: EB-D1, EB-D2, EB-D3 (review only)

No source file was changed. The only file in this patch is this report.

**Archive (AGENTS.md section 1):** not done. `E:\Backup\...` does not exist in my environment. Nothing in `src/`, `electron/` or `tools/` was modified, so there was nothing to protect; the uploaded zip is the baseline.
**`tools/change.log.txt`:** not touched (AGENTS.md section 10: source changes only).

## Tests and tools actually run

- `node --test tools/tests/manifest.test.js tools/tests/events-d.test.js`: 12 pass, 0 fail (events-d is still an empty skeleton, so it passes trivially).
- `node tools/event-audit.js`: first failed with `Cannot find module 'acorn'` (`dep-map.js` needs `npm i -D acorn acorn-walk`; the network is blocked here). I ran it with `NODE_PATH` pointing at an `acorn` copy that was already installed. Result: **164** (A 41, B 81, C 42), identical to the plan. If an agent in a clean checkout sees the acorn error, that is the cause.
- Not run: `events-wiring.test.js` and the other browser tests (no Playwright browser here), and `--strict` (it will fail until A, B and C finish).

## EB-D1: the eight subscriber files (04h to 04o)

Checked each `on()` for: per-frame work, direct writes to shared state, the same call made by two subscribers of the same event.

**Per-frame work: none.** All 17 subscribers are triggered by a user action or a data change. Highest frequency: `recents:added`, `history:added` and `playedOrder:changed` fire once per song start (`movePlayedItemToTop` returns early when the item is already first). `recents:count-changed` is emitted by `updateRecentCount()`, which has callers in 03e, 17, 99 and 04n, all outside any audio-event path. No `timeupdate` link.

**Direct writes to shared state:**
- `04j` (3 places), `04k`, `04o`: `leftPanelVirtualState.currentItems = getLeftPanelItemsArray()` followed by `renderLeftPanelVisibleItems(false)`. `04j` also writes `leftPanelVirtualState.container.scrollTop`. `leftPanelVirtualState` is declared in `05b` (D's own file) and has no setter in `core/SETTERS.md`. The same 2-line block is written by hand at 10 sites: 04j x3, 04k, 04o, 05b:250/333, 06g:271, 09:177 (A), 17:20 (B). **Low severity**, not a blocker for Plan 1. Suggestion for D in Plan 2 or a later session: one helper in `05b` (for example `refreshLeftPanelVirtualItems({ keepScroll })`) so the 10 copies become calls. Not done now: it touches A's and B's files too.
- `04i`: `audioElement.pause()`, `audioElement.src = ''`, `playButton.innerHTML = ...` and writes to `#player-title`, `#player-artist`, `#player-cover`. This is the playback display being reset inside a D subscriber. It is a verbatim move, allowed. Flag for B: when B emits `playback:*` events, this block is a candidate to move to a B subscriber that reacts to `library:rebuilt`. No action now.
- Others (04h, 04k, 04l, 04m, 04n): DOM only, no state writes. `04m` writes `input.checked` (DOM), fine.

**Same call from two subscribers of the same event:** none. Each of the 12 event names has exactly one subscriber (verified with `grep "on('"`: the only `on(` calls are in 04h to 04o). Two different events fire back to back and overlap, see EB-D3 (`playlist:listChanged` then `playlist:deleted`).

**Naming:** `recents:count-changed` is kebab-case (already documented in EVENTS.md). Everything else is camelCase.

**EVENTS.md accuracy:** matches the code. All 17 emitted names appear in the catalog with the right owner file and subscriber file.

## EB-D2: allowlist review

I read the definition and every non-D call site of the names that looked doubtful. Verdicts:

**Correct as listed (no change):** all of `services`, `queries` (except one), `setup` (except one), and in `navigation`: `switchView`, `openDetailView`, `pushViewToHistory`, `pushToHistoryStack`, `activateLeftPanelItem`, `resetLeftPanelActiveState`, `goBack`, `showHeroSection`, `showTracklistHeader`, `teardown*`, `resetViewScroll`. The non-D callers I read (14:247, 15e:266, 08d:242/244, 09:72/75) are commands that move the user.

**Wrong or too coarse (these need a decision):**

1. **`renderPlaylistDetailView`, `renderAlbumDetailView`, `renderArtistDetailView`, `renderFolderContents` are listed as navigation but mix navigation and reactions.** By call site:
   - Navigation (stay direct): `09:137` (`openPlaylist`), `09:228` and `09:244` (open folder / go up), `99:100` (start-up).
   - **Reactions** ("the data changed, redraw the open view"): `09:88` (`removeSongFromPlaylistAndRefresh`) = **A**, EB-A5; `09:172` (folder expand/collapse redraws the open folder) = **A**, EB-A5; `16:45` (song added to the open playlist) = **B**, EB-B3; `17:109`, `17:115`, `17:121` (selection/favorites refresh of the open playlist, album, artist) = **B**, EB-B4.
   - Problem: the audit tool allowlists by name only, so as it stands these 7 reaction calls are invisible to `--strict`. If the names simply come off the list, the 4 navigation calls show up as unconvertible leftovers. Proposed fix: let the allowlist take `"file:name"` entries (for example `"09-folders-playlists.js:renderPlaylistDetailView"`) for the navigation calls, then remove the four bare names. That needs a small change in `tools/event-audit.js` (A's file). I did not make it. **Needs a human decision first** (see below).
2. **`renderVisibleItems` is filed under `queries`, but it is a render function, not a query.** Its only non-D callers are `14-song-navigation.js:116/123/178` (scroll-to-song, forces a re-render of the virtual list after a scroll jump). That is the same case as EB-B5 (virtual-scroll hot path, one subsystem split over two files), not a data reaction. Keep it off the event bus, but for the right reason; suggest B covers it in the EB-B5 paragraph, and the audit tool grows a fifth category (for example `virtualScroll`) later.
3. **`setVirtualScrollThreshold` and `snapVirtualScrollThreshold` are filed under `setup`.** Their only non-D caller is `08e-panel-settings.js:387/398` (the slider's input handler). It is a user command that writes a setting (and reacts only inside D's `05a`), not one-time start-up. Staying direct is right (slider input, same subsystem as the setting), but the stated reason is wrong.
4. **`updateNavigationButtons` is filed under `navigation`**; its only A/B/C callers are `99-player.js:491` and `:612`, both start-up. It belongs under `setup`. Cosmetic.
5. **`initThemeButtons`** has two non-D callers: `99:537` (start-up) and `08e:257` (re-init when the settings view is entered = view setup). Both fine under `setup`/navigation.

**Caveat for A, B and C (affects EB-D3):** `updateScrollbarById` is a legitimate service, but 14 calls in A and B files sit right after a render call (for example `09:92`, `17:55/66/136`, `99:211`). When the render call moves into a subscriber, the owner must also drop the trailing `updateScrollbarById('left-panel-main-content')` or it becomes a duplicate. See candidate 3 below.

## EB-D3: duplicate-refresh candidates

Source: `expected/events-a.json` (2 sequences, repeated names) and the 15 sequences in `events-wiring.test.js`. I did not fix anything.

**Important:** the headless scenarios run with **0 playlists, albums, artists**, so functions such as `renderPlaylistsView()` return early and their nested `renderLeftPanelMainList()` calls never show in the recording. In the real app the counts below are higher.

Many repeats in the recordings are **expected nesting, not duplicates**: `renderLeftPanelMainList()` internally calls `renderLeftPanelVisibleItems` (virtual list), then the subscriber calls `renderLeftPanelVisibleItems(false)` again.

Real candidates, ranked:

1. **Library rebuild, `04i`** (D file; recorded: `renderLeftPanelMainList` x3). By source, `renderPlaylistsView`, `renderAlbumLeftPanelItems`, `renderArtistLeftPanelItems` each end with `renderLeftPanelMainList()` (plus `renderPlaylistsView` calls `updateLeftPanelCounts()` again and `updateScrollbarById`), and `04i` then calls `updateLeftPanelCounts()` and `renderLeftPanelMainList()` itself. With data present: up to **5** `renderLeftPanelMainList` and **2** `updateLeftPanelCounts` (each of which triggers `updateRecentCount` and a `recents:count-changed` event) per rebuild. The 03j/A-side copy (EB-A3) is a related original block that A is measuring.
2. **`data:imported`, `04n`** (D file, no recorded sequence with data): calls `renderPlaylistsView()` and `renderFoldersView()` (each ends with `renderLeftPanelMainList()` + `updateScrollbarById`) and then `renderLeftPanelMainList()` again: **3** left-panel redraws where 1 is needed.
3. **`playlist:listChanged` then `playlist:deleted`** (04k, recorded in "playlists: delete through the confirm flow", repeats `renderPlaylistsView` x2, `renderLeftPanelMainList` x2, `updateScrollbarById` x2). Documented in 03c as preserved on purpose. The second subscriber repeats the first. A pure removal candidate; `renderPlaylistsView()` alone in the first handler already does `renderLeftPanelMainList()` + `updateScrollbarById`, so inside `playlist:listChanged` the explicit `renderLeftPanelMainList()` and the virtual-scroll refresh after it are at least partly redundant when playlists exist.
4. **`history:cleared`, `04h`** (recorded: `showHeroSection` x2, `updateHeroSection` x2): the handler calls `showHeroSection(true)` and `updateHeroSection('Recents', 0, 'Playlist', 'History')` and then `renderHistoryView()`, which starts with `updateHeroCover` and does the same two calls with `history.length` (0 after a clear). The first pair is redundant. Pure removal, but it changes a sequence in the **frozen** `events-wiring.test.js`; needs your approval.
5. **`updateScrollbarById` twice in "folders: confirm-delete the folder that is currently open"** (events-a.json, last two entries) and the `playlist:*`/`pinned:*` cases: normal nesting (`renderFoldersView`/`renderPlaylistsView` end with `updateScrollbarById`, the subscriber adds its own). Low value, listed for completeness.
6. `playback settings: gapless on then off`: `clearGaplessPreload` x2 is one per toggle. **Not a duplicate.**

I did not touch 04h/04i/04k/04n, because removing calls there changes recorded sequences owned by the frozen suite and by A's `events-a.json`.

## Needs from other agents

- **A:** `09:88` and `09:172` are reactions (EB-A5); `tools/event-audit.js` per-file allowlist entries (optional, see EB-D2 item 1); before converting `03j changeMusicFolder()` (EB-A3) note candidate 1.
- **B:** `16:45` (EB-B3) and `17:109/115/121` (EB-B4) are reactions even though the names are allowlisted. In EB-B5 also cover `14-song-navigation.js` `renderVisibleItems` x3 (hot path, not a query).
- **C:** nothing new. When converting 08e, `setVirtualScrollThreshold` stays direct.
- **All:** move the trailing `updateScrollbarById('left-panel-main-content')` together with the render call it follows.

## Decisions for the human

1. Allow `"file:name"` entries in the allowlist and remove the four detail/folder render names? (Recommended; otherwise 7 reactions stay invisible to `--strict`.)
2. Approve removing the redundant calls in 04h (`history:cleared`), 04i and 04n, with a baseline re-record, as a separate small D patch?
3. Do you want the `leftPanelVirtualState` helper in `05b` now or in Plan 2?

## Manual checks (the ones this review points at; nothing was changed, so these are for the future dedupe)

1. Library settings: change the music folder so the library is rebuilt with playlists, albums and artists present. Expect: left panel lists correct, counts correct, player shows "No song selected".
2. Settings: import a data file (merge). Expect: playlists and folders appear once, left panel not flickering, notification "Data imported successfully".
3. Recents/History: clear history while on the History view. Expect: hero title "Recents", 0 songs, notification "Play history cleared".
4. Playlists: delete a playlist through the confirm dialog. Expect: it disappears from the left panel, one "deleted" notification.

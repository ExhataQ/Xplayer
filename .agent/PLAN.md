# Renderer Refactor Plan

Goal: make the existing renderer easier to understand, test and change, with no behavior change and no rewrite.

This plan is based on a static analysis of `src/js` (76 files, ~23.5k lines) using `tools/dep-map.js`. Numbers below come from that tool; re-run it at the start of every phase.

Starting point: the event bus is finished. It is `src/js/00b-events.js` (`emit`, and `on`, which returns the unsubscribe function). The real event list is `src/js/core/EVENTS.md`, and `node tools/event-audit.js --strict` exits 0. The setters exist too (`src/js/core/SETTERS.md`). Run the audit after every phase to keep it that way. The documents of the first plan (event bus) are in `.agent/archive/`.

## 1. Baseline findings

| Finding | Number | Why it matters |
|---|---|---|
| Renderer files / global symbols | 76 / 967 (758 functions, 127 `let`, 82 `const`) | Everything shares one global scope |
| Load-time cross-file references | 14, none forward | Numbered order is barely load-bearing; modules are feasible |
| Files in one dependency cycle | 63 of 76 | Cycles are harmless in classic scripts, and hard to keep once files become modules; the event bus is what breaks them |
| Mutable globals assigned from other files | 52 | ES imports are read-only; each needs an owner and setters |
| Global functions called from inline `on…=` strings | ~198 functions, ~289 sites, 26 files | Modules do not create globals, so these break silently |
| Files that touch `localStorage` directly | 18 | Storage boundary is leaky despite `03-storage.js` |
| Files that touch `window.electronAPI` | 14 (94 references) | IPC boundary is leaky; preload is a flat list of ~45 functions plus a generic `invoke` |
| `99-player.js` | 32 top-level symbols; used by 54 files | Build template, bootstrap and utility dump in one file |
| Tests that load renderer code via `vm` + fake globals | 4 (`shuffle`, `storage`, `recents`, `search-engine`) | Must be rewritten when their code becomes modules |
| Browser tests using the app fixture | 5 | Fixture copies `js/` and injects the `electronAPI` stub before the `00-state.js` tag |

Most depended-on files: `00-state` (61 dependents), `99-player` (54), `07-views` (44), `04a-ui-render-core` (32), `06j-notification-system` (30), `06c-scrollbar-widget` (22).

Most shared globals: `VIEWS` (42 files), `currentView` (37), `currentQueueIndex` (32), `playbackQueue` (32), `showNotification` (29), `escapeHtml` (29), `audioElement` (24), `SONGS_DATA` (22).

### Mutable globals written from other files

| Group | Globals (writer-file count) |
|---|---|
| Queue and playback | `currentQueueIndex` (10), `playbackQueue` (8), `shuffleMode` (3), `isShuffled` (3), `repeatMode` (2), `repeatFunctionalityActive` (3), `repeatVisualState` (3), `lastPlayedSong` (3), `lastPlayedSongStartTime` (3), `queueDisplayLimit` (2) |
| Navigation and history | `currentView` (5), `searchQuery` (3), `historyNavigationIndex` (3), `playbackHistoryStack` (2), `isManualPlay` (3), `isPrevNavigation` (2), `isNavigatingHistory` (1), `lyricsPreView` (2), `lyricsPreScrollTop` (2) |
| Folders and library | `currentOpenFolderId`, `currentOpenFolderName`, `selectedLibraryFolders` |
| Ghost-list counters (`02`) | `nextSearchItemSlotId` (4), `nextFavoriteSlotId` (2), `currentSearchSessionId` (2), `historyGhostSlots`, `nextHistorySlotId` |
| Transient UI | `hoveredSongIndex`, `lastMouseX`, `lastMouseY`, `notificationHistory`, `downloadNotifyIndex`, `rightPanelCollapsed`, `lastRightPanelStateBeforeQueue`, `advancedSettingsOpen` |

Full list: `node tools/dep-map.js` (section "Mutable globals assigned from other files").

### Constraints found in the build and tests

- `player.js` (the built `99-player.js`) is a classic script that runs during parsing. `<script type="module">` is deferred, so module code runs after it. Any load-time reference from `99-player.js` into a converted file will break. There are seven references to four functions today, at lines 770–819: `navigateToCurrentSongInList` and `navigateToCurrentArtist` (from `14`), `initMarqueeOnHover` (from `06k`), `openImageViewer` (from `06h`). Move them into the `DOMContentLoaded` handler (line 409) before converting those files.
- The manifest and build already support subfolders (`core/state.js`) and `manifest.test.js` enforces it. New folders need no build change.
- `electron/` files are copied by a hardcoded list in `build/music_player.py`. Adding a new Electron-side file requires editing that list.
- The app loads via `loadFile` (file://). Module scripts with relative imports should work from file://, but this is unverified; Phase 0 confirms it.

## 2. Principles

- One subsystem per change; old and new coexist until the new one is verified.
- Writes first, reads later: make every write go through an owner before touching any read.
- Every phase has a mechanical "done when" that `dep-map.js` or a test can check.
- Touch virtual scroll (`05a`, `05b`, `05c`), `07-views` and `04a` last, and only with import/export changes there.
- Follow `.agent/AGENTS.md`: archive before every change, update `tools/change.log.txt`, run focused tests, deliver patches.
- Comments say what the code does or why. They never name an agent, a step ID, a phase or a plan; that goes in the report and in `tools/change.log.txt`.

## 3. Phases

### Phase 0: safety net (no behavior change)

Agent: A.

- [x] Add `tools/dep-map.js`; run `npm i -D acorn acorn-walk` in `Source/`.
- [x] Record the browser-test baseline (`metadata-editor`, `playback-settings`, `scroll`, `search-ui`, `view-switch-song-list-cleanup`); confirm Playwright launches on your machine.
- [x] Commit the manual smoke checklist (section 6) as `tools/smoke-checklist.md`.
- [ ] Spike: one throwaway `<script type="module">` loaded from `music_player.html` in the built app under `App/electron.exe`. Confirm it runs, that it can import a sibling file, and that it can read a top-level classic-script `let`/`const` by bare name.
- [ ] Decide the folder layout (section 4) and add empty folders to the manifest only when a file lands in them.

Done when: baseline recorded, spike result written down (works / does not work, and what to do instead). Only the spike and the layout decision are still open; the spike needs you, because an agent cannot start Electron. Nothing before Phase 3 depends on it.

### Phase 1: state ownership (still classic scripts)

Agents: A defined the setters (done: `src/js/core/SETTERS.md`, 52 setters, A's own files already use them). B, C and D each replace the writes in their own files, and can all start now, in parallel.

For each group, create an owner file, define setters, replace every outside write with a setter call, emit the matching event from the setter, and leave reads as bare variables for now. The variable stays declared in `00-state.js`; only the writes move.

- [ ] 1a. Queue: `playbackQueue`, `currentQueueIndex`, `queueDisplayLimit`. Events: `queue:changed`, `queue:indexChanged` (already emitted by the setters).
- [ ] 1b. Playback modes: `isShuffled`, `shuffleMode`, `repeatMode`, `repeatFunctionalityActive`, `repeatVisualState`. Events: `playback:mode-changed`.
- [ ] 1c. Now-playing bookkeeping: `lastPlayedSong`, `lastPlayedSongStartTime`, `isManualPlay`, `isPrevNavigation`.
- [ ] 1d. Navigation: `currentView`, `searchQuery`, `historyNavigationIndex`, `playbackHistoryStack`, `isNavigatingHistory`, `lyricsPre*`. Event: `view:changed` (already emitted by the setter).
- [ ] 1e. Folders and library: `currentOpenFolder*`, `selectedLibraryFolders`.
- [ ] 1f. Ghost-list counters and transient UI globals: move each into its own file (`02`, `04a`, `06c`, `06j`, `06b`) or into a small owner. These are low risk.

Verify each step: `node tools/dep-map.js writers <names…>` lists only the owner file; `shuffle`, `storage`, `recents`, `search-engine` tests pass; smoke checklist sections for playback and navigation pass.

Done when: `dep-map.js` reports 0 mutable globals assigned from other files for the groups above.

### Phase 2: event bus replaces "refresh the UI" calls

Status: finished. 39 events, all subscribers in `04h` to `04v`.

The most-shared functions are mostly "something changed, redraw": `renderLeftPanelMainList` (17 files), `renderSongsList` (14), `updateHeroCover` (10), `renderPlaylistsView` (9). Replace these cross-subsystem calls with events; keep ordinary same-subsystem calls as they are.

- [x] Event catalog: done in Plan 1. The real names (39 events, with payload, owner and subscriber file) are in `src/js/core/EVENTS.md`; the old illustrative names (`song:changed`, `playlists:changed`, `lyrics:loaded`...) are not used.
- [x] Renderers subscribe to the events they care about; emitters stop calling renderers. Done in Plan 1: `node tools/event-audit.js --strict` exits 0 (76 excepted calls, each with a reason, in `tools/event-allowlist.json`).
- [x] Listener-registration rule: written as rule 5 in `EVENTS.md`. Subscribers are `on(...)` calls at the top level of `04x-*-events.js` files (no `init` function); revisit when files become modules.
- Rule that stays: do not route ordinary function calls or per-frame work (scroll, hover, timeupdate) through the bus.

Done: `node tools/event-audit.js --strict` exits 0. Run it after every phase; a new call from A, B or C into a D render function must either use an event or get an entry with a reason in `tools/event-allowlist.json`.

### Phase 3: inline handlers and the legacy bridge

Agents: A builds the mechanism; B, C, D convert handlers in their own files.

- [ ] Add `registerLegacyGlobals({ name: fn, … })` (assigns onto `window`) so each converted module lists its own names; no central file owns all 198.
- [ ] Add one delegated dispatcher for `data-action="name"` (+ `data-*` args) on `document`.
- [ ] Convert inline `onclick=` strings to `data-action` as each view is touched. Heaviest first: `08e-panel-settings` (36), `19-online-lyrics` (33), `06a-context-menus` (31), `11c` (20), `06b-modals` (16), `11d` (15).
- [ ] Also check `build/music_player.html` (49 inline handlers).

Done when: the bridge and dispatcher exist and are covered by a browser test. Full removal of `on…=` strings is tracked, not required, before Phase 6.

### Phase 4: extract pure logic into real modules

Agents: A, B, C, D, each on their own leaf files (A also splits `99-player.js`).

Convert files with almost no dependencies first: `03-storage`, `03a-recents`, `03b-search-engine`, `10a-playback-shuffle`, `10b-playback-smart-shuffle`, `11a` LRC parsing, `12-color-extract`, `21-language-detect`, `06i-theme-switcher`.

- [ ] Split `99-player.js`: utilities (`escapeHtml`, `escapeHtmlAttr`, `generateLongId`, `generateConsistentId`, plus `debounce` from `00-state`) into `core/`, library helpers (`SONGS_DATA`, `deletedSongIds`, `getActiveSongs`, `filterDeletedSongs`, plus `getSongById` from `00-state`) into `library/`, and keep a thin `99-player.js` with the `{{SONGS_DATA}}` / `{{PLACEHOLDER_IMAGE}}` placeholders and bootstrap. `build/music_player.py` and `render-template.js` stay unchanged.
- [ ] Move the seven load-time references in `99-player.js` into the init handler (see section 1).
- [ ] Each converted module exposes itself to legacy code through `registerLegacyGlobals`.
- [ ] Rewrite the four `vm` tests to import the modules directly and drop the fake-global contexts.
- [ ] Update `manifest.json` and `app-fixture.js` for any new script type.

Done when: each converted module has import-based unit tests, and the old test contexts no longer need fake globals for it.

### Phase 5: storage and IPC boundaries

Agents: A builds the storage module, `api/` and preload; B, C, D swap the calls in their own files.

- [ ] Route all 18 `localStorage` users through the storage module (keys stay as in `STORAGE_KEYS`; stored values unchanged).
- [ ] Validate and normalize on read for saved playlists, folders, settings and history.
- [ ] Add a renderer `api/` module; every `window.electronAPI` call goes through it (94 references, 14 files).
- [ ] Preload: expose namespaced groups (`library`, `metadata`, `files`, `lyrics`, `window`) and keep the current flat names as aliases until the renderer stops using them; remove the generic `invoke` (used once, in `06b-modals`).
- [ ] The test stub in `app-fixture.js` keeps working because it is a Proxy; verify.

Done when: only `api/` touches `window.electronAPI` and only `storage/` touches `localStorage` (`grep` check).

### Phase 6: convert the rest to modules

Agents: A first (core, library), then B and C, then D last; A does the final manifest flip.

Order: core → library and playlists → playback → lyrics → panels, modals, context menus → rendering, `07-views`, `04a`, `05a`/`05b`/`05c` last.

- [ ] Convert one subsystem at a time; keep its `registerLegacyGlobals` entries until nothing legacy calls it.
- [ ] Flip reads of Phase 1 state from bare variables to getters, then make the variables private.
- [ ] Final step: manifest points at a single module entry; fixtures updated.

Done when: no classic script other than the `99-player.js` template remains, and `dep-map.js` no longer applies (it becomes an import graph check).

### Optional, when a bug or feature calls for it

- A shared song-row component: virtual scroll and every list build rows separately today.
- Service/UI split for playlists and folders (`03c`, `03h`, `09`, `04b`).
- JSDoc types with `// @ts-check` on new modules; TypeScript only if that proves too limiting.
- DOM-region ownership and view mount/unmount: only where a stale-listener or cross-module DOM bug shows up.

### Known leftovers from the event bus work (none of them is broken today)

- Duplicate refreshes: the library rebuild (`04i`), `data:imported` (`04n`), `playlist:listChanged` followed by `playlist:deleted` (`04k`), `history:cleared` (`04h`), and the Recent panel refresh in `15e` redraw the left panel more than once. Removing the extra calls changes the recorded call sequences in `tools/tests/expected/` and `events-wiring.test.js`, so do it as one small patch with the baselines re-recorded and every removed call listed in the report.
- Rename `recents:count-changed` to camelCase (it is the one event name that breaks rule 1 in `EVENTS.md`); update `04h` and the recorded sequences in the same patch.
- Probable bug in `08h-panel-search.js` (lines 45 and 77): it calls `getCachedEl('all-songs-count')`, but the only element with a count is `all-songs-count-display`. Check by clearing the search box with the console open; fix with a one-line change if it throws.
- `leftPanelVirtualState.currentItems = getLeftPanelItemsArray(); renderLeftPanelVisibleItems(false);` is written by hand at about ten sites (`04j`, `04k`, `04o`, `05b`, `06g`, `09`, `17`). One helper in `05b` would replace them.

## 4. Target layout (direction, not spec)

```
src/js/
  core/       state, events (bus), storage, utils
  api/        electronAPI wrapper
  library/    songs, albums, artists, scanning helpers
  playlists/  playlists, folders, pins
  playback/   queue, shuffle, smart-shuffle, controls, audio events
  lyrics/     LRC parser, sync editor, online lyrics, language detect
  search/     search engine, history
  ui/         renderers, panels, modals, context menus, scrollbar, virtual lists
  99-player.js  build template + bootstrap
```

## 5. Ownership and contracts

Single-owner files (edit only in the phase owner's change): `00-state.js`, `99-player.js`, `07-views.js`, `04a-ui-render-core.js`, `electron/preload.js`, `src/manifest.json`, `build/music_player.py`, core event and storage modules.

Agent ownership (A, B, C, D) is in section 9.

Contracts to agree before parallel work starts: the event names and payloads (section 3, Phase 2), the storage `get`/`set` signature, the `registerLegacyGlobals` signature, and the `api/` namespace shape. Adding to a contract needs the core owner; changing one needs every consumer's owner.

Parallel-safe: Phase 4 conversions of different leaf files; Phase 5 storage vs API; Phase 6 subsystems that do not import each other.

Must be serial: Phases 0, 1, 2 and the Phase 3 mechanism; `99-player.js` split; the final `manifest.json` flip.

## 6. Manual smoke checklist (run after every phase)

- [ ] App starts; library loads; no console errors.
- [ ] Play, pause, seek, next, previous; gapless and crossfade transitions.
- [ ] Queue: add, remove, reorder, play from queue; "show more" paging.
- [ ] Shuffle, smart shuffle and repeat modes; state matches after switching views.
- [ ] Views: library, albums, artists, playlists, favorites, history, search, settings, lyrics; back/forward.
- [ ] Virtual scroll: large list scroll and fast scrollbar drag; no placeholder rows when entering Settings or leaving lyrics.
- [ ] Playlists and folders: create, rename, delete, drag songs; persistence after restart.
- [ ] Lyrics: synced display, sync editor save, online lyrics search and import.
- [ ] Metadata: edit tags, cover change, online metadata.
- [ ] Scan: add folder, rebuild, drop files, download.
- [ ] Context menus, modals, notifications, keyboard shortcuts, theme switch.
- [ ] Window: minimize, maximize, close-to-tray, thumbar buttons.

## 7. Rules for every migration change

1. Archive the project first (`.agent/AGENTS.md`).
2. One subsystem per change; smallest reasonable diff; no unrelated refactoring.
3. Run the focused tests for that subsystem, then the smoke checklist section that covers it.
4. Append the change to `tools/change.log.txt` in the existing format.
5. Deliver as a `.patch` from the actual repository state.
6. Remove old code only after the replacement is verified; update `claude.md` file ownership when a file's responsibility changes.
7. Re-run `node tools/dep-map.js` and record the "mutable globals assigned from other files" and "file-level cycles" numbers in the change description.

## 8. Risks and open questions

| Risk | Mitigation |
|---|---|
| Module scripts behave differently from classic scripts on file:// | Phase 0 spike |
| Inline handlers fail silently after a file converts | Phase 3 bridge; browser test that clicks a handler from each converted file |
| Timing: modules run after `player.js` | Move `99-player.js` load-time references into the init handler first |
| Static analysis misses dynamic access (`window[name]`, string-built handler names) | Grep for `window\[` before converting a file; smoke checklist |
| Virtual scroll regression | Convert last; import/export edits only; run `scroll.test.js` and the placeholder checks |
| Event bus overuse | Catalog stays short; no per-frame events; ordinary calls stay calls |
| Bridge leaks into permanent architecture | Track remaining `registerLegacyGlobals` entries; remove as callers convert |

Open questions:
- Actual event bus API and where it lives.
- Whether the browser tests run in your CI or only locally.
- Whether new Electron-side files (if any) are wanted, since that touches the hardcoded copy list.

## 9. Agents A, B, C, D

Agent A is Claude in this chat. B, C and D are separate agent sessions. Each agent works one session at a time and hands back a patch and a report (section 9.4). The three can run at the same time on different files: B, C and D can all start Phase 1 now.

### 9.1 Who owns what

| Agent | Area | Files |
|---|---|---|
| **A** | Foundation and data | `00`, `01`, `02`, `99-player`, `03*`, `09`, `electron/`, new `core/`, `library/` and `api/` folders, `build/music_player.py`, `src/manifest.json` (final flip), `claude.md` |
| **B** | Playback | `10*`, `14`, `15*`, `13`, `16`, `17` |
| **C** | Lyrics, metadata, panels | `08*`, `11*`, `12`, `18`, `19`, `20`, `21` |
| **D** | UI shell | `04*`, `05*`, `06*`, `07`, `build/music_player.html` |

Rules:

- An agent edits only its own files. If a step needs a change in someone else's file, stop, say so in the report under "Needs from other agents", and let the human route it.
- The only shared files are `src/manifest.json` (keep edits to one-line inserts) and `tools/change.log.txt` (append-only). When you apply several patches, expect small merge conflicts there; keep both sides.
- Agent A defines all setters and contracts first. B, C and D use them, and never invent their own setters for shared state.
- Steps marked *Needs* must not start until those steps are applied and verified.

### 9.2 Start order

1. **Done:** tools, baselines and smoke checklist (A-01 to A-03), setters (A-06), A's own writes (A-07, first half), and the whole event bus (A-05, A-08, A-09, B-05, B-06, C-02, C-03, D-03, D-04).
2. **You, once:** run the module spike (A-04) in Electron. Nothing before Phase 3 needs it, so it does not hold up step 3.
3. **B, C, D in parallel, start now:** replace writes in their own files (B-01 to B-04, C-01, D-01, D-02), and report which variables only their files use.
4. **A:** removes those variables from `00-state.js` (A-07, second half). Once A-04 is in, A builds the handler bridge (A-10).
5. **B, C, D in parallel:** convert inline handlers (B-07, C-04, D-05).
6. **In parallel:** leaf modules (A-12, B-08, C-05, D-07) and the `99-player` split (A-11).
7. **A** builds storage and `api/` (A-13, A-14); then B, C, D swap their calls.
8. **A** converts core and library (A-15); then **B and C**; then **D** last; then **A** does the final flip (A-16).

### 9.3 Mini steps

Each step is sized for one session or less. The IDs are used in reports and on the board.

#### Agent A: Foundation and data

- [x] **A-01** (Phase 0) **Add the analysis tool.** Copy `tools/dep-map.js` into the repo and run `npm i -D acorn acorn-walk`. Run it and record the baseline in the report: mutable globals written from other files (52), files in the dependency cycle (63), load-time cross-file references (14).
  - Files: `tools/dep-map.js`, `package.json`
  - Done when: `node tools/dep-map.js` runs; baseline numbers are in the report.
- [x] **A-02** (Phase 0) **Record test baselines.** Run the node tests (`shuffle`, `storage`, `recents`, `search-engine`, `manifest`) and the five browser tests (`metadata-editor`, `playback-settings`, `scroll`, `search-ui`, `view-switch-song-list-cleanup`). Note any that cannot launch Playwright.
  - Files: none (report only)
  - Done when: A results table (pass/fail/could not run) is in the report.
  - You: If the browser tests cannot run in the agent environment, run them on your machine and paste the result into the report.
- [x] **A-03** (Phase 0) **Add the smoke checklist.** Copy section 6 of this plan into `tools/smoke-checklist.md`.
  - Files: `tools/smoke-checklist.md`
  - Done when: File exists and matches section 6.
- [ ] **A-04** (Phase 0) **Module-loading spike.** Add a temporary `<script type="module">` to the template that (1) logs, (2) imports a sibling file, (3) reads a classic-script top-level `let` by bare name, (4) logs its order relative to `player.js` and `DOMContentLoaded`. Build, check, then remove it.
  - Files: `build/music_player.html` (temporary)
  - Done when: The report says works / does not work for each of the four checks, plus a fallback if any fails.
  - You: Build the app and open `App/electron.exe`; an agent cannot launch Electron. Copy what the DevTools console shows into the report.
- [x] **A-05** (Phase 0.5) **Event bus.** Done in the first plan. The bus is `src/js/00b-events.js` (`emit`, `on`; `on` returns the unsubscribe function) and the event list is `src/js/core/EVENTS.md`.
- [x] **A-06** (Phase 1) **Create the owner and setter files.** Create classic-script files in `core/` with a setter for every global that `node tools/dep-map.js` reports as written from another file (52 today). Groups: queue (`playbackQueue`, `currentQueueIndex`, `queueDisplayLimit`); playback modes (`isShuffled`, `shuffleMode`, `repeatMode`, `repeatFunctionalityActive`, `repeatVisualState`); now-playing (`lastPlayedSong`, `lastPlayedSongStartTime`, `isManualPlay`, `isPrevNavigation`, `lastPlaybackListId`); navigation (`currentView`, `searchQuery`, `historyNavigationIndex`, `playbackHistoryStack`, `isNavigatingHistory`, `lyricsPreView`, `lyricsPreScrollTop`); folders (`currentOpenFolderId`, `currentOpenFolderName`, `folderNavigationStack`, `selectedLibraryFolders`); ghost-list counters; transient UI state. The variables stay declared where they are; a setter assigns the variable and emits the matching event. Nothing calls the setters yet. List every setter and the variable it wraps in `core/SETTERS.md`.
  - Files: new `core/*.js`, `core/SETTERS.md`, `src/manifest.json`
  - Done when: Manifest and node tests pass; app behaves the same; `SETTERS.md` covers every name dep-map reported.
- [ ] **A-07** (Phase 1) **Replace writes in A's own files.** In `03e`, `03j`, `03m`, `09` and `99-player`, replace direct assignments to other files' globals with setter calls. **Status:** the 35 assignments in A's files are done. **Still open:** remove from `00-state.js` any variable that B, C or D report is used only in their files (they move the declaration into their own file).
  - Files: `03e`, `03j`, `03m`, `09`, `99-player`, `00-state`
  - Done when: `node tools/dep-map.js writers <names>` lists no A file as a writer of a global it does not define; focused tests pass.
  - Needs: A-06
- [x] **A-08** (Phase 2) **Emit events from data changes.** Done in the first plan: the `03*` files and `09` emit their events (see `EVENTS.md`).
- [x] **A-09** (Phase 2) **Remove direct render calls from A's files.** Done in the first plan: the audit reports 0 for A.
- [ ] **A-10** (Phase 3) **Build the handler bridge.** Add `registerLegacyGlobals({...})` (assigns onto `window`) and one delegated `data-action` dispatcher in `core/`. Add a browser test that clicks a `data-action` element and a bridged inline handler.
  - Files: `core/legacy.js`, `tools/tests/`, `src/manifest.json`
  - Done when: Both click paths work in the browser test.
  - Needs: A-04
- [ ] **A-11** (Phase 4) **Split `99-player.js`.** Move the seven load-time references (lines 770–819) into the `DOMContentLoaded` handler; move utilities (`escapeHtml`, `escapeHtmlAttr`, `generateLongId`, `generateConsistentId`, `debounce`) to `core/utils.js` and library helpers (`SONGS_DATA`, `deletedSongIds`, `getActiveSongs`, `filterDeletedSongs`, `getSongById`) to `library/songs.js`. Keep the `{{SONGS_DATA}}` and `{{PLACEHOLDER_IMAGE}}` placeholders and the bootstrap in `99-player.js`.
  - Files: `99-player`, `00-state`, new `core/utils.js`, `library/songs.js`
  - Done when: Manifest test passes; built `player.js` still contains song data; smoke checklist passes.
  - Needs: A-04, A-07
- [ ] **A-12** (Phase 4) **Convert storage, recents and search engine.** Turn `03-storage`, `03a-recents`, `03b-search-engine` into modules exposed through `registerLegacyGlobals`. Rewrite `storage.test.js`, `recents.test.js` and `search-engine.test.js` to import them instead of using `vm` and fake globals.
  - Files: `03-storage`, `03a`, `03b`, three tests
  - Done when: The three tests pass with imports and no fake-global contexts.
  - Needs: A-10
- [ ] **A-13** (Phase 5) **Storage module.** Build the storage module (`get`/`set`, keys unchanged from `STORAGE_KEYS`, stored values unchanged). Validate and normalize saved playlists, folders, settings and history on read. Swap the `localStorage` calls in `00`, `01`, `03*`, `99-player`. Publish the contract in the report.
  - Files: `core/storage.js`, `00`, `01`, `03*`, `99-player`
  - Done when: `grep localStorage` finds these files only inside the storage module; saved data from before still loads.
  - Needs: A-12
- [ ] **A-14** (Phase 5) **`api/` wrapper and preload.** Add the renderer `api/` wrapper and group the preload into namespaces (`library`, `metadata`, `files`, `lyrics`, `window`), keeping the flat names as aliases. Swap the `electronAPI` calls in `03f`, `03j`, `03k`, `03m`, `99-player`. Remove the generic `invoke` only after D reports its one use is replaced.
  - Files: `api/`, `electron/preload.js`, `03f`, `03j`, `03k`, `03m`, `99-player`
  - Done when: App works; `app-fixture.js` stub still works; aliases cover every old name.
  - Needs: A-10
- [ ] **A-15** (Phase 6) **Convert core and library to modules.** Convert `00`, `01`, `02`, `03*`, `09` and the split pieces of `99-player` to modules, in dependency order, keeping `registerLegacyGlobals` entries for anything legacy code still calls.
  - Files: A's files, `src/manifest.json`
  - Done when: Smoke checklist and all node tests pass.
  - Needs: A-13, A-14, A-11
- [ ] **A-16** (Phase 6) **Final flip.** Point the manifest at a single module entry, update `app-fixture.js`, remove unused bridge entries and the generic `invoke`, update the file mapping in `claude.md` and the status in this plan.
  - Files: `src/manifest.json`, fixtures, `electron/preload.js`, `claude.md`, `PLAN.md`
  - Done when: All tests and the full smoke checklist pass.
  - Needs: B-10, C-07, D-09

#### Agent B: Playback

- [ ] **B-01** (Phase 1) **Review A's playback setters.** Read `core/SETTERS.md`. For the queue, playback-mode and now-playing setters, report anything missing or wrong (side effects the old direct assignment had, ordering, extra variables).
  - Files: none (report only)
  - Done when: Report lists OK / changes needed for each setter.
  - Needs: A-06
- [ ] **B-02** (Phase 1) **Replace writes in `10c` and `10d`.** Replace direct writes to the queue, index, display limit, `lastPlaybackListId`, manual/prev flags and ghost-list counters with setter calls. `10d` writes 10 shared globals and `10c` writes 6; the audio-element variables are only listed for now.
  - Files: `10c`, `10d`
  - Done when: `node tools/dep-map.js writers currentQueueIndex playbackQueue` lists no B file for these; shuffle test passes; playback and queue smoke checks pass.
  - Needs: A-06, B-01
- [ ] **B-03** (Phase 1) **Replace writes in `10b`, `15b`, `15c`.** Replace direct writes to shuffle, repeat and smart-shuffle state with setter calls.
  - Files: `10b`, `15b`, `15c`
  - Done when: dep-map shows no cross-file writes to `isShuffled`, `shuffleMode`, `repeatMode`, `repeatFunctionalityActive`, `repeatVisualState` from these files; shuffle test passes.
  - Needs: A-06
- [ ] **B-04** (Phase 1) **Replace writes in the remaining B files.** In `14`, `15a`, `15d`, `15e`, `15f`, `17`, replace writes to last-played, history stack, `lyricsPre*` and `searchQuery` with setter calls. Report which variables only B's files use (for example `showRemainingTime`, `wasPlaying`, the selection variables) so A can move them out of `00-state.js`.
  - Files: `14`, `15a`, `15d`, `15e`, `15f`, `17`
  - Done when: dep-map shows no writes to A-owned globals from these files; report lists the B-only variables.
  - Needs: A-06
- [x] **B-05** (Phase 2) **Emit playback events.** Done in the first plan (see `EVENTS.md`, `04p-playback-events.js`).
- [x] **B-06** (Phase 2) **Replace cross-subsystem render calls.** Done in the first plan: the audit reports 0 for B.
- [ ] **B-07** (Phase 3) **Convert inline handlers.** Convert the inline `on…=` strings in `15b` (3) and `10c` (1) to `data-action`.
  - Files: `15b`, `10c`
  - Done when: Handlers work in the browser; no `on…=` left in these files.
  - Needs: A-10
- [ ] **B-08** (Phase 4) **Shuffle modules.** Turn `10a` and `10b` into modules exposed through `registerLegacyGlobals`, and rewrite `shuffle.test.js` to import them instead of using `vm` and fake globals.
  - Files: `10a`, `10b`, `shuffle.test.js`
  - Done when: Shuffle test passes with imports; shuffle and smart-shuffle smoke checks pass.
  - Needs: A-10, B-03
- [ ] **B-09** (Phase 5) **Swap storage and API calls.** Replace direct `localStorage` and `electronAPI` calls in B's files (`15e` has 10 `electronAPI` references, `16` has 4 plus 2 `localStorage`) with the storage module and `api/` wrapper.
  - Files: `15e`, `16` and any others dep-map/grep finds
  - Done when: `grep` finds no direct `localStorage` or `electronAPI` in B's files.
  - Needs: A-13, A-14
- [ ] **B-10** (Phase 6) **Convert playback to modules.** Convert `10a`–`10d`, `14`, `15*`, `13`, `16`, `17`, in dependency order, keeping bridge entries for anything legacy code still calls.
  - Files: B's files, `src/manifest.json` (one-line inserts)
  - Done when: Shuffle test, playback smoke and queue smoke pass.
  - Needs: A-15, A-11, B-09, B-08

#### Agent C: Lyrics, metadata, panels

- [ ] **C-01** (Phase 1) **Replace writes in the panel files.** In `08a`, `08e`, `08h`, replace direct writes to `rightPanelCollapsed`, `lastRightPanelStateBeforeQueue`, `advancedSettingsOpen`, `currentView`, `searchQuery`, `currentSearchSessionId`, `nextSearchItemSlotId` with setter calls.
  - Files: `08a`, `08e`, `08h`
  - Done when: dep-map shows no cross-file writes from these files; `search-ui.test.js` and settings/search smoke checks pass.
  - Needs: A-06
- [x] **C-02** (Phase 2) **Emit lyrics and settings events.** Done in the first plan (`lyrics:changed` and the others in `EVENTS.md`).
- [x] **C-03** (Phase 2) **Panels react to events.** Done in the first plan (`04t`, `04u`, `04v`); the audit reports 0 for C.
- [ ] **C-04** (Phase 3) **Convert inline handlers.** Convert inline `on…=` strings to `data-action`, one file per session in this order: `08e` (36), `19` (33), `11c` (20), `11d` (15), `18` (8), `20` (7), `11b` and `08g` (4 each), then the rest.
  - Files: the listed files
  - Done when: Handlers work in the browser; no `on…=` left in the converted files.
  - Needs: A-10
- [ ] **C-05** (Phase 4) **Lyrics leaf modules.** Turn the LRC parsing part of `11a`, plus `12` and `21`, into modules exposed through `registerLegacyGlobals`. Add new import-based tests for the parser and language detection.
  - Files: `11a` (parser part), `12`, `21`, new tests
  - Done when: New tests pass; synced lyrics and language detection behave the same.
  - Needs: A-10
- [ ] **C-06** (Phase 5) **Swap storage and API calls.** Replace direct `electronAPI` calls in `19` (3), `20` (13), `11d` (2), `11f` (2), `08e` (6) and `localStorage` in `08a`, `08f`, `18`, `21` with the storage module and `api/` wrapper.
  - Files: the listed files
  - Done when: `grep` finds no direct `localStorage` or `electronAPI` in C's files; metadata editor test passes.
  - Needs: A-13, A-14
- [ ] **C-07** (Phase 6) **Convert lyrics, metadata and panels to modules.** Convert `11*`, `12`, `18`, `19`, `20`, `21` first, then `08*`, in dependency order, keeping bridge entries for anything legacy code still calls.
  - Files: C's files, `src/manifest.json` (one-line inserts)
  - Done when: `metadata-editor.test.js` and lyrics/panel smoke checks pass.
  - Needs: A-15, C-05, C-06

#### Agent D: UI shell

- [ ] **D-01** (Phase 1) **Replace writes in the smaller UI files.** In `04a`, `05a`, `06b`, `06c`, `06j`, `06k`, replace direct writes to slot counters, `hoveredSongIndex`, mouse position, `notificationHistory`, `downloadNotifyIndex`, `playbackQueue` and `currentQueueIndex` with setter calls.
  - Files: `04a`, `05a`, `06b`, `06c`, `06j`, `06k`
  - Done when: dep-map shows no cross-file writes from these files; `scroll.test.js` passes.
  - Needs: A-06
- [ ] **D-02** (Phase 1) **Replace writes in `07-views`.** `07-views` writes 11 shared globals (`currentView`, `searchQuery`, `currentSearchSessionId`, history stack and index, `isManualPlay`, `isPrevNavigation`, `isNavigatingHistory`, `lyricsPre*`, `nextSearchItemSlotId`). Change only the assignment lines.
  - Files: `07`
  - Done when: dep-map shows no cross-file writes from `07`; `view-switch-song-list-cleanup.test.js` and view/back/forward smoke pass.
  - Needs: A-06
- [x] **D-03** (Phase 2) **Renderers subscribe to events.** Done in the first plan (`04h` to `04v`).
- [x] **D-04** (Phase 2) **Remove D's own cross-subsystem calls.** Done in the first plan: no double rendering is recorded in the call-sequence tests.
- [ ] **D-05** (Phase 3) **Convert inline handlers.** Convert inline `on…=` strings to `data-action`: `06a` (31), `06b` (16), `04g` (11), `04a` (10), `04f` (4), `04c` (3), `05b` (2), the rest, and `build/music_player.html` (49).
  - Files: the listed files
  - Done when: Handlers work in the browser; no `on…=` left in converted files.
  - Needs: A-10
- [ ] **D-06** (Phase 5) **Replace the one generic `invoke`.** In `06b`, replace `window.electronAPI.invoke('welcome-select-folder')` with a named `api/` call, so A can remove the generic `invoke`.
  - Files: `06b`
  - Done when: The welcome dialog folder picker still works.
  - Needs: A-14
- [ ] **D-07** (Phase 4) **Theme switcher module.** Turn `06i-theme-switcher` into a module exposed through `registerLegacyGlobals`.
  - Files: `06i`
  - Done when: Theme switching works.
  - Needs: A-10
- [ ] **D-08** (Phase 5) **Swap storage and API calls.** Replace direct `localStorage` in `05a` and `electronAPI` in `06b` (4) and `06k` (2) with the storage module and `api/` wrapper.
  - Files: `05a`, `06b`, `06k`
  - Done when: `grep` finds no direct `localStorage` or `electronAPI` in D's files.
  - Needs: A-13, A-14
- [ ] **D-09** (Phase 6) **Convert the UI shell to modules.** Convert `06*` first, then `04b`–`04g`, then `04a`, `05a`/`05b`/`05c`, and `07` last. Import/export edits only, no logic edits. Run `scroll.test.js` and the placeholder checks after each file.
  - Files: D's files, `src/manifest.json` (one-line inserts)
  - Done when: `scroll.test.js`, `search-ui.test.js`, `view-switch-song-list-cleanup.test.js` and the full smoke checklist pass.
  - Needs: A-15, B-10, C-07, D-08, D-05

### 9.4 Session brief (paste at the start of each agent session)

```
You are Agent <X> on the ExhataQ renderer refactor.

Read first: .agent/AGENTS.md, claude.md, .agent/PLAN.md (sections 2, 3, 7 and 9),
src/js/core/EVENTS.md, src/js/core/SETTERS.md, .agent/BOARD.md, and the latest report of
any agent your step depends on (.agent/reports/).

Your files: <list from PLAN.md section 9.1>. Edit nothing else, except one-line
inserts in src/manifest.json, your entry in tools/change.log.txt and your report in
.agent/reports/<X>/.

This session: <mini step IDs, for example B-02>.

Rules:
- Archive first, as .agent/AGENTS.md says. Smallest reasonable diff; no unrelated changes.
- Comments in code describe the code. Never write agent names, step IDs, phases or plan names in them.
- Run `node tools/dep-map.js` before and after and record the numbers.
- Run the tests named in the step; say plainly what you could not run.
- Append to tools/change.log.txt in the existing format.
- Deliver one patch named <X>-NNNN-slug.patch (NNNN counts your own patches).
- Write .agent/reports/<X>/NNNN-slug.md from .agent/reports/TEMPLATE.md and
  include it in the patch.
- If the step needs a file you do not own, stop and describe it in the report.
```

### 9.5 What you do after each patch

1. Save the patch and read its report (`.agent/reports/<X>/NNNN-slug.md`).
2. `git apply --check <patch>`; if it passes, `git apply <patch>`. If `manifest.json` or `change.log.txt` conflict, keep both sides.
3. Run the tests and smoke-checklist sections the report lists under "For you".
4. Update `.agent/BOARD.md` (status and patch name) and the "Next actions" list.
5. Read "Needs from other agents" and "Next step" in the report, and start the next session with the brief from 9.4.
6. If a check fails, do not start anything that depends on that step. Give the report to the same agent to fix.

## Appendix: `tools/dep-map.js`

```
node tools/dep-map.js                    summary report
node tools/dep-map.js writers <name...>  files that assign to a global (* = defining file)
node tools/dep-map.js uses <name...>     files that reference a global
node tools/dep-map.js json <out.json>    full map
```

Static analysis only. It parses `src/manifest.json` order plus `99-player.js` (placeholders replaced), resolves identifiers by scope, and treats top-level `function`, `let`, `const`, `var` and `class` as the global surface.

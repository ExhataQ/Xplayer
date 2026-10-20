# BOARD: UI redesign ("ui-next")

Plan: [`PLAN.md`](./PLAN.md). Detailed evidence lives in `reports/`, one file per task.

**Statuses:** Not started, In progress, In review, Blocked, Done.
**Current phase:** 4, in progress (parity and cutover).

## Decisions

| ID | Decision | Status | Answer |
|---|---|---|---|
| D1 | Location of new screen (`src/ui-next/`) | Approved | Recommendation accepted, 2026-10-16 |
| D2 | Default look (dark, amber accent) | Approved | Recommendation accepted, 2026-10-16 |
| D3 | Themes: Warm Graphite default, Deep Forest and Espresso and Copper as alternatives, old accents kept | Approved | Recommendation accepted, 2026-10-16 |
| D4 | Navigation rail items | Approved | Recommendation accepted, 2026-10-16 |
| D5 | Icon set (Lucide) | Approved | Recommendation accepted, 2026-10-16 |
| D6 | Fonts (IBM Plex Sans, Newsreader) | Approved | Recommendation accepted, 2026-10-16 |
| D7 | Cutover policy | Approved | Recommendation accepted, 2026-10-16 |
| D8 | Title bar: logo menu, back and forward, notification bell | Approved | Recommendation accepted, 2026-10-16 |
| D9 | Library panel: filter chips on top, one list below | Approved |
| D10 | Engine contract: compatibility shim (provide the engine's element IDs and classes), not an event rewrite. Phase 1 migration strategy, not permanent architecture; amended by D11 to D13 | Approved | Recommendation accepted, 2026-10-16. Contract: `archive/ui-redesign/design/ENGINE-CONTRACT.md` (v2) |
| D11 | Fix seek and volume (defects D-1, D-2) in the engine, not in the shell | Approved | Recommendation accepted, 2026-10-16 |
| D12 | Engine-written icons: CSS-map the four transport glyphs to Lucide for Phase 1; neutral engine class in Phase 2 | Approved | Recommendation accepted, 2026-10-16 |
| D13 | `legacy-dom-adapter` budget: 250 lines of code. Over budget means revisit D10 | Approved | Recommendation accepted, 2026-10-16 |
| D14 | Interim styling for engine-created overlays (L-10) until owning tasks replace it | Approved (2026-10-17) | Implemented in A-06: `src/ui-next/adapter/legacy-overlays.css`, linked from `index.html`. Lyrics/sync editor and metadata form interiors remain with D-03/D-04. |
| D15 | Waveform source and data | Approved (2026-10-17) | Renderer decoding with limits; a new read-only IPC must supply file bytes. R-C3, R-C4 and R-C8 remain integration requirements. See `reports/UI-C02-waveform-source.md` |
| D16 | List and views strategy for Phase 2 | Approved (2026-10-17) | S3: reuse engine views and restyle first, then replace individual views where justified. See `archive/ui-redesign/design/research/B-01-list-and-views-map.md` |
| D17 | May A fix D-3 (a volume change during a track's fade-in is overwritten), which is outside the approved scope | Approved and done (2026-10-20) | The fade now ends at the volume the person has set at that moment. Test in `seek-volume.test.js` (D-3). ENGINE-CONTRACT.md updated |
| D18 | Adapter API budget | Approved (2026-10-17) | 300 lines across `store`, `actions`, `events` and `engine-view.js` |
| D19 | Logo mark: use the X mark | Approved (2026-10-18) | Decided by A (owner delegated). In the title bar and the startup view; see `reports/UI-A09-startup-and-logo-options.md` |
| D20 | Startup backgrounds: vinyl default, five animated options, plain, or random | Approved (2026-10-18) | Decided by A (owner delegated). Shown by the app since A-09's second pass; chosen in Settings, Startup screen |
| D21 | Library panel: restyle the engine's own panel instead of rebuilding it | Approved (2026-10-17) | Decided by B. See `reports/UI-B02-library-panel.md` |
| D22 | Library panel needs additive engine seams (view model: types, query, sort) | Approved (2026-10-17) | Decided by B. The old screen never sets them, tests pin that |
| D23 | Song list columns (Cover art, Artist name, Album, Time), Title and Album resize as one saved share | Approved (2026-10-18) | Decided by B. See `reports/UI-B03-song-list.md` |
| D24 | Density: comfortable 56 px (`--row-height`) and compact 36 px (`--row-height-compact`), compact has no cover and puts the artist beside the title. Needs one engine seam, `setSongItemHeight(px)` in `ui/05a`; `ITEM_HEIGHT` becomes a live legacy global | Approved (2026-10-18) | Decided by B. The old screen never calls the seam, and a test pins its behavior |
| D25 | The engine's heading block (cover, label, title) is hidden in the song list and replaced by a title bar (list name and song count) | Approved (2026-10-18) | Decided by B. The block pushed the rows down and the engine's scroll math assumes the list starts at the top of the scroller |
| D26 | Play all, shuffle, "search in this list" and "clear history" (the engine's sub-header) | Approved (2026-10-18) | Decided by B: a list toolbar in the title bar, see D28 |
| D27 | Search: the Search rail item gets its own field and a recent-searches list, and drives the engine's search (hidden `#search-input` and `performSearch`); results are the song list from B-03. Scoring, history entries and result counts stay the engine's. No engine change | Approved (2026-10-18) | Decided by B. See `reports/UI-B04-search.md` |
| D28 | List toolbar: Play and Shuffle call the engine's sub-header handlers (Shuffle opens the engine's mode dialog), Find drives the hidden `#subhero-search-input`, More opens the engine's own menu. Recently played is a rail item showing the engine's history view. One new icon (`ellipsis`). No engine change | Approved (2026-10-18) | Decided by B. See `reports/UI-B05-list-toolbar.md` |
| D29 | The title bar shows a copy of the engine's cover for the list (round for artists), taken from the hidden heading block. The collapsed library panel keeps a cover-only list; names stay in the page, clipped. Right-to-left titles use `unicode-bidi: plaintext`. The Artists index is the panel's Artists chip (D9), so the engine's "coming soon" fallback is never reached from the shell | Approved (2026-10-18) | Decided by B. See `reports/UI-B06-finish.md` |
| D30 | Views reach the lyrics and metadata engine state only through `adapter/engine-api.js` | Decided by D (owner delegated) | Counts toward D18 with `engine-view.js`. A may fold it into `store`, `actions`, `events` |
| D31 | Write and Sync are tabs of the Lyrics page, next to View and Find; the engine's two editors are moved into the page | Decided by D (owner delegated) | Replaces the interim buttons of D-01. See `reports/UI-D03-lyrics-editors.md` |
| D32 | The Metadata rail item shows the engine's tag form (a tab of its right panel) and follows the playing song while the form is clean | Decided by D (owner delegated) | `showEnginePanel` in `adapter/engine-view.js` |
| D33 | Leaving the Metadata view with unsaved changes asks first, with the engine's own question; choosing the view you are on does nothing | Decided by D (owner delegated) | Native confirm, as the engine uses |
| D34 | Leaving the Lyrics view, or picking another tab, closes an open editor and asks first when text or timings would be lost | Decided by D (owner delegated) | Sync asks with the engine's own dialog, which answers later: the person picks the tab again |
| D35 | The startup view is a layer from the first paint until the page has loaded plus two frames: at least 450 ms, gives up after 20 s (a CSS animation moves it away after 30 s if no script runs), clicks pass through while it fades, the real title bar floats above it | Approved (2026-10-18) | Decided by A (owner delegated). `startup/boot.js`. Tests that use the raw mouse straight after load call `waitForStartupGone` |
| D36 | Electron's scan loading window uses the new look (the X in a ring, Warm Graphite, amber) when the app starts with `--ui=next`; the current interface keeps its own | Approved (2026-10-18) | Decided by A (owner delegated). `electron/loading-page.js`; the window cannot read the theme, so it uses the default |
| D37 | Space after a mouse click goes to the page (play or pause), not to the clicked button; Space after keyboard navigation presses the focused button | Decided (2026-10-20) | Stops click-then-Space repeating the click. `shell/space-key.js`; test in `ui-next-tooltips.test.js`; see `reports/UI-A08-tooltip-rollout.md` |
| D40 | Notification center reads the engine's history through a hidden `#notification-panel-list` (the element the engine redraws into after every change); the engine's own notification DOM is never shown | Decided by A | No engine change. See `reports/UI-A07-notification-center.md` |
| D41 | Cancel button on running work (downloads, album art search) | Done (2026-10-20) | Real cancel: the download is aborted and its partial file removed, the cover search child stops after the current batch. Main-process change in `electron/` (downloads, scanner, fast-scan); Cancel button in the notification center. Tests in `cancel-running-work.test.js` |
| D42 | Only failure-worded `error` notifications are shown as errors; the engine's other `error` entries (removals) are information | Decided by A | See report |
| D60 | Theme, accent and density are one saved choice applied as `data-*` attributes on `<html>`, with a boot script before first paint; the engine's unsaved Theme Color block is hidden | Decided by A | See `reports/UI-A10-appearance-and-resizing.md` |
| D61 | Density drives the library panel rows too (compact is shorter), through a small engine seam `setLeftItemHeight` | Done (2026-10-20) | Same pattern as the song list seam. `05b-lazy-load-left-panel.js`, `songlist-bridge.js`, tests in `ui-next-appearance.test.js` |
| D62 | Library panel width: drag or keyboard, 240 to 480 px, default 300, saved; a small window limits what is shown, never the saved value | Decided by A | |
| D63 | No new themes now; Midnight Blue, Aubergine and Rose, Porcelain and Teal stay "Later" | Decided by A | DIRECTION.md |
| D64 | The old interface is not removed. Both ship; the person switches in Settings (either interface) and the choice is saved in `ui-choice.json` | Decided (2026-10-20, owner) | Replaces the cutover plan (A-13). `--ui=next`, `--ui=current` and `XPLAYER_UI` still decide the first load and beat the saved choice. `electron/ui-entry.js`, `window-manager.js` |

## Phase 0: Decisions and safety

| Task | Owner | Status | Depends on | Notes |
|---|---|---|---|---|
| P0-01 Introduce plan, board, direction | A | Done | none | Applied by you |
| P0-02 Record decisions D1 to D9 | You | Done | P0-01 | |
| P0-03 Archive project, record baseline checks | A | In review | P0-02 | Archive not done by the agent (project folder not reachable); you snapshot before applying patches. Baseline: unit group had 3 failing files (`drag-drop-modules`, `lint`, `setters`) in the supplied zip, which has no `node_modules`; after `npm i acorn acorn-walk eslint globals` all 165 tests passed |

## Phase 1: Foundation (A)

| Task | Owner | Status | Depends on | Notes |
|---|---|---|---|---|
| A-01 Tokens, base CSS, fonts, icons | A | Done | P0-03 | Icons `info`, `circle-check`, `triangle-alert` added; token checks need local verification |
| A-02 Entry HTML, `--ui=next` flag, build copy list | A | Done | P0-03 | Touches `electron/` and `build/` |
| A-04a Engine contract map and audit | A | Done | A-02 | Contract v2; see `ENGINE-CONTRACT.md` |
| A-04b Seek and volume fix (D11) | A | Done | A-04a | Fixes D-1/D-2; D-3 remains open |
| A-03 Shell: title bar (logo menu, back and forward, bell), rail, panel host, player host | A | Done | A-01, A-02 | Report `UI-A03-A04-shell-and-adapter.md` |
| A-04 Adapter v1 and DOM-id compatibility layer | A | Done | A-04a, A-04b | `legacy-dom-adapter`; 250-line budget (D13); gates 1–14 in `ENGINE-CONTRACT.md` |
| A-04c Adapter API: `store`, `actions`, `events`, view bridge | A | Done (you confirmed 2026-10-20) | A-04 | Built and browser-tested (`ui-next-adapter-api.test.js`). Report `UI-A04c-adapter-api-runtime.md` |
| A-05 Component set with all states | A | Done | A-01 | 12 components, gallery, existing component tests |
| A-06 Phase 1 gate: boots, plays, resizes, old UI intact | A | Done | A-03, A-04, A-05 | New automated gate added; run locally and complete the real Electron checklist in `reports/UI-A06-phase1-gate.md` before acceptance |

## Phase 2: Surfaces

| Task | Owner | Status | Depends on | Notes |
|---|---|---|---|---|
| B-01 Map of list and virtual scroll behavior | B | Done | A-06 | Research available; confirm findings and list/view strategy |
| B-02 Library panel: filter chips, find, sort, one list | B | Done | A-06 | Browser tests pass; Windows/Electron manual checks remain |
| B-03 Song list: columns, resize, compact mode | B | Done (you confirmed 2026-10-20) | B-01 | Report `UI-B03-song-list.md`. Browser tests pass; Windows/Electron checks remain |
| B-04 Search | B | Done (you confirmed 2026-10-20) | A-06 | Report `UI-B04-search.md`. Browser tests pass; Windows/Electron checks remain |
| B-05 Album, artist, playlist, folder views | B | Done (you confirmed 2026-10-20) | B-03 | Report `UI-B05-list-toolbar.md`. List toolbar, kind label, Recently played |
| B-06 Cover in title bar, compact panel, right-to-left, row behaviors | B | Done (you confirmed 2026-10-20) | B-05 | Report `UI-B06-finish.md`. Windows/Electron checks remain |
| C-01 Player bar and transport | C | Done | A-06 | Styling implemented; remaining integration and manual checks |
| C-02 Waveform seek (compute and cache) | C | Done (you confirmed 2026-10-20) | C-01 | Built and browser-tested; report `UI-C02-waveform-source.md`. Open there: a saved peaks cache, and a 10-minute track limit |
| C-03 Queue and volume | C | Done (you confirmed 2026-10-20) | C-01 | Built and browser-tested; report `UI-C-playback-surfaces.md` |
| C-04 Fullscreen viewer | C | Done (you confirmed 2026-10-20) | C-01 | Built and browser-tested; report `UI-C-playback-surfaces.md` |
| D-01 Lyrics panel: view, empty state, four modes | D | Done (you confirmed 2026-10-20) | A-06 | Engine page in the shell with a four-tab mode bar and a skin; browser-tested; Windows/Electron checklist remains. Reports `reports/UI-D01-lyrics.md`, `reports/UI-D03-lyrics-editors.md` |
| D-02 Online lyrics find and manual search | D | Done (you confirmed 2026-10-20) | D-01 | Built and browser-tested; report `UI-D02-find.md`. Open there: F-1 ("Use for this song" for an unchanged query), now decision DL3 |
| D-03 Lyrics write and sync editor | D | Done (you confirmed 2026-10-20) | D-01 | Write and Sync are tabs of the Lyrics page: editors moved into the page and skinned, unsaved-text guards, 20 browser tests; Windows/Electron checklist remains. Report `reports/UI-D03-lyrics-editors.md` |
| D-04 Metadata editor | D | Done (you confirmed 2026-10-20) | A-06 | The engine's tag form in the shell (rail item Metadata): skin, empty state, follows the song, unsaved-changes guard; 19 browser tests; Windows/Electron checklist remains. Report `reports/UI-D04-metadata.md` |
| D-05 Settings sections | D | Done | A-06 | Browser-tested; Windows/Electron checklist remains |
| D-06 Dialogs | D | Done | A-05 | Browser-tested; remaining dialog and Windows/Electron checks |

## Phase 3: Integration (A)

| Task | Owner | Status | Depends on | Notes |
|---|---|---|---|---|
| A-07 Toasts and bell notification center (in progress and earlier) | A | Done (you confirmed 2026-10-20) | Phase 2 | Report `UI-A07-notification-center.md`. Toasts for every engine notification, center behind the bell (In progress, Earlier), dot on the bell. 15 browser tests pass; Windows/Electron checklist remains. No cancel button (D41) |
| A-08 Tooltip rollout | A | Done (you confirmed 2026-10-20) | Phase 2 | Every control gets the shared tooltip, the engine's old one no longer shows, one shared Space rule (D37 decided); see `reports/UI-A08-tooltip-rollout.md`. Electron run outstanding |
| A-09 Startup view and logo | A | Done (you confirmed 2026-10-20) | A-01 | The startup view is shown by the app (real milestones, real window buttons above it, saved choice read through the adapter), the Electron loading window matches it; 24 tests; a real Electron window still to check. Report `reports/UI-A09-startup-and-logo-options.md` |
| A-10 Accent themes, resizing, density | A | Done (you confirmed 2026-10-20) | Phase 2 | Report `UI-A10-appearance-and-resizing.md`. Appearance section in Settings (theme, accent, density, saved, no flash), shared density, resizable panel, resize audit at 3 window sizes. 18 browser tests pass; Windows/Electron checklist remains. Built on the A-07 patch |

## Phase 4: Parity and cutover

| Task | Owner | Status | Depends on | Notes |
|---|---|---|---|---|
| A-11 Smoke checklist, old versus new | A | In review | Phase 3 | Automated part run (full suite). Manual Electron table in `reports/UI-A11-smoke-checklist.md` is yours to fill in |
| A-12 Gap fixes | A, B, C, D | In review | A-11 | README section on the two interfaces and the switch; CHANGELOG.md started. No other gap is open except C-02's cache and D-02 F-1 (DL3), which need your decision |
| A-13 Keep both interfaces | A | Done | A-12 | Replaces "approval to remove the old UI" (D64). In-app switch in Settings of both interfaces; saved choice; flags still win on launch |
| A-14 Changelog and archive of plan | A | Not started | A-12 | CHANGELOG.md is started. Archive (move plan, board and reports to `archive/ui-redesign/`) waits for your sign-off on A-11 |

## Blockers and questions

None. Open: C-02 peaks cache and 10-minute limit; D-02 F-1 (DL3); real Electron checks of the switch and startup view.

## Reports

| Task | Report | Status |
|---|---|---|
| P0-01 | `reports/UI-P0-01-plan-introduction.md` | Written |
| P0-03, A-01, A-02 | `reports/UI-A01-A02-foundation-start.md` | Written |
| A-04a, A-04b | `reports/UI-A04-engine-contract-and-seek-fix.md` | Written |
| A-05 | `reports/UI-A05-components.md` | Written |
| A-09 | `reports/UI-A09-startup-and-logo-options.md` | Written |
| Research and patch plan | `archive/ui-redesign/design/PATCH-PLAN.md`, `archive/ui-redesign/design/research/` | Written |
| B-02 | `reports/UI-B02-library-panel.md` | Written |
| B-03 | `reports/UI-B03-song-list.md` | Written |
| B-04 | `reports/UI-B04-search.md` | Written |
| B-05 | `reports/UI-B05-list-toolbar.md` | Written |
| B-06 | `reports/UI-B06-finish.md` | Written |
| D-01 | `reports/UI-D01-lyrics.md` | Written |
| D-03 | `reports/UI-D03-lyrics-editors.md` | Written |
| D-04 | `reports/UI-D04-metadata.md` | Written |
| A-07 | `reports/UI-A07-notification-center.md` | Written |
| A-10 | `reports/UI-A10-appearance-and-resizing.md` | Written |

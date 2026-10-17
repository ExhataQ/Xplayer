# BOARD: UI redesign ("ui-next")

Plan: [`PLAN.md`](./PLAN.md). Detailed evidence lives in `reports/`, one file per task.

**Statuses:** Not started, In progress, In review, Blocked, Done.
**Current phase:** 2, in progress.

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
| D10 | Engine contract: compatibility shim (provide the engine's element IDs and classes), not an event rewrite. Phase 1 migration strategy, not permanent architecture; amended by D11 to D13 | Approved | Recommendation accepted, 2026-10-16. Contract: `ui-redesign/ENGINE-CONTRACT.md` (v2) |
| D11 | Fix seek and volume (defects D-1, D-2) in the engine, not in the shell | Approved | Recommendation accepted, 2026-10-16 |
| D12 | Engine-written icons: CSS-map the four transport glyphs to Lucide for Phase 1; neutral engine class in Phase 2 | Approved | Recommendation accepted, 2026-10-16 |
| D13 | `legacy-dom-adapter` budget: 250 lines of code. Over budget means revisit D10 | Approved | Recommendation accepted, 2026-10-16 |
| D14 | Interim styling for engine-created overlays (L-10) until owning tasks replace it | Approved (2026-10-17) | Implemented in A-06: `src/ui-next/adapter/legacy-overlays.css`, linked from `index.html`. Lyrics/sync editor and metadata form interiors remain with D-03/D-04. |
| D15 | Waveform source and data | Approved (2026-10-17) | Renderer decoding with limits; a new read-only IPC must supply file bytes. R-C3, R-C4 and R-C8 remain integration requirements. See `reports/UI-C02-waveform-source.md` |
| D16 | List and views strategy for Phase 2 | Approved (2026-10-17) | S3: reuse engine views and restyle first, then replace individual views where justified. See `ui-redesign/research/B-01-list-and-views-map.md` |
| D17 | May A fix D-3 (a volume change during a track's fade-in is overwritten), which is outside the approved scope | Open | Proposed by A. Small and testable (PATCH-PLAN.md P4) |
| D18 | Adapter API budget | Approved (2026-10-17) | 300 lines across `store`, `actions`, `events` and `engine-view.js` |
| D19 | Logo mark: use the X mark | Proposed by A | See `reports/UI-A09-startup-and-logo-options.md`; title-bar wiring remains unfinished. |
| D20 | Startup backgrounds: vinyl default, five animated options, plain, or random | Proposed by A | See `reports/UI-A09-startup-and-logo-options.md`; startup view is not yet wired into the shell. |

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
| A-04c Adapter API: `store`, `actions`, `events`, view bridge | A | Not started | A-04 | The part of A-04 that PLAN.md section 4 promises and P2 did not build. Budget D18. See PATCH-PLAN.md P5 |
| A-05 Component set with all states | A | Done | A-01 | 12 components, gallery, existing component tests |
| A-06 Phase 1 gate: boots, plays, resizes, old UI intact | A | Done | A-03, A-04, A-05 | New automated gate added; run locally and complete the real Electron checklist in `reports/UI-A06-phase1-gate.md` before acceptance |

## Phase 2: Surfaces

| Task | Owner | Status | Depends on | Notes |
|---|---|---|---|---|
| B-01 Map of list and virtual scroll behavior | B | Done | A-06 | Research available; confirm findings and list/view strategy |
| B-02 Library panel: filter chips, find, sort, one list | B | Done | A-06 | Browser tests pass; Windows/Electron manual checks remain |
| B-03 Song list: columns, resize, compact mode | B | Not started | B-01 | |
| B-04 Search | B | Not started | A-06 | |
| B-05 Album, artist, playlist, folder views | B | Not started | B-03 | |
| C-01 Player bar and transport | C | Done | A-06 | Styling implemented; remaining integration and manual checks |
| C-02 Waveform seek (compute and cache) | C | In progress | C-01 | Renderer waveform module tested; file-byte IPC and seek-bar integration remain |
| C-03 Queue and volume | C | Not started | C-01 | |
| C-04 Fullscreen viewer | C | Not started | C-01 | |
| D-01 Lyrics panel: view, empty state, four modes | D | Not started | A-06 | |
| D-02 Online lyrics find and manual search | D | Not started | D-01 | |
| D-03 Lyrics write and sync editor | D | Not started | D-01 | |
| D-04 Metadata editor | D | Not started | A-06 | |
| D-05 Settings sections | D | Done | A-06 | Browser-tested; Windows/Electron checklist remains |
| D-06 Dialogs | D | Done | A-05 | Browser-tested; remaining dialog and Windows/Electron checks |

## Phase 3: Integration (A)

| Task | Owner | Status | Depends on | Notes |
|---|---|---|---|---|
| A-07 Toasts and bell notification center (in progress and earlier) | A | Not started | Phase 2 | |
| A-08 Tooltip rollout | A | Not started | Phase 2 | |
| A-09 Startup view and logo | A | In review (partial) | A-01 | X logo and startup view exist but are not wired into the shell; see `reports/UI-A09-startup-and-logo-options.md` |
| A-10 Accent themes, resizing, density | A | Not started | Phase 2 | |

## Phase 4: Parity and cutover

| Task | Owner | Status | Depends on | Notes |
|---|---|---|---|---|
| A-11 Smoke checklist, old versus new | A | Not started | Phase 3 | |
| A-12 Gap fixes | A, B, C, D | Not started | A-11 | |
| A-13 Your approval to remove old UI | You | Not started | A-12 | |
| A-14 Changelog and archive of plan | A | Not started | A-13 | |

## Blockers and questions

None. Known and unscheduled: D-3 (a volume change during a new track's fade-in is overwritten when the fade ends; ENGINE-CONTRACT.md section 6).

## Reports

| Task | Report | Status |
|---|---|---|
| P0-01 | `reports/UI-P0-01-plan-introduction.md` | Written |
| P0-03, A-01, A-02 | `reports/UI-A01-A02-foundation-start.md` | Written |
| A-04a, A-04b | `reports/UI-A04-engine-contract-and-seek-fix.md` | Written |
| A-05 | `reports/UI-A05-components.md` | Written |
| Research and patch plan | `ui-redesign/PATCH-PLAN.md`, `ui-redesign/research/` | Written |

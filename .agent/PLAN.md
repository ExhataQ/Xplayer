# PLAN: Polish 1

**Status:** Not started. Decisions DP1 to DP10 are open (see `BOARD.md`).
**Previous plans:** event bus and renderer refactor, and the UI redesign ("ui-next"), both finished. The redesign is in `archive/ui-redesign/` (plan, board, design notes, reports).
**Inputs:** [`POLISH-1-BRIEF.md`](./POLISH-1-BRIEF.md) (the owner's brainstorm, two rounds, 20 numbered round-2 items), the archived redesign decisions D1 to D64, and a read of the source in `Source-backup.zip` (2026-10-20).

## 1. In plain words

The new screen ("ui-next") exists and ships next to the old one (decision D64: the person switches in Settings). This plan polishes the new screen, adds the missing pieces (home page, folder and playlist creation, a complete application menu), fixes the list and player problems you reported, and adds two new areas: a metadata area that does not need Python, and an AI assistant.

Five agents work in parallel. Each has one area and a list of files it owns. Investigations come first where the answer changes the work.

**What this plan is based on.** Every "code shows" note on the board comes from reading the files, not from running the app. I could not run Electron or the test suite here, so each cause below is a *finding from reading* with a confidence level, and each fix task starts by reproducing the problem. Nothing here is claimed as verified.

## 2. What the code showed (read on 2026-10-20)

| Topic | What is in the code | Consequence for the plan |
|---|---|---|
| Tag writing needs Python | `electron/metadata-editor.js` starts `python` or `py` on the user's machine and runs `electron/metadata-editor.py`, which imports `mutagen`. Anyone without Python and mutagen cannot save tags. `tools/tests/metadata-backend.test.js` uses a stand-in for mutagen and skips when Python is missing. CI (`.github/workflows/test.yml`) installs only Node. | No test I found runs the real `mutagen`. Agent D replaces or removes the Python dependency (decision DP7). |
| Online metadata already exists | `electron/online-metadata.js`: MusicBrainz and Cover Art Archive, a 1.1 s spacing between MusicBrainz requests, retries, a cache, search by `scope` (`recording` or `release`), and `firstReleaseDate` in results. | "Find the original release" is a selection rule on top of what exists, not a new service. |
| Hover, selection and virtual scroll | The new song list reuses the engine's virtual scroll (`ui/05a`) and its hover and selection layers (`ui/04a`: JS-positioned divs inside `.content`, a 25 px dead zone at the row edges). The new screen hides the engine's custom scrollbar (`#external-scrollbar`) and uses the native one, so the body class `dragging-scrollbar`, which the engine uses to pause hover, is never set. The old `.song-list` had `padding: 15px 0` and virtual rows at `top: 15px`; the new CSS uses 0 and 0. | These are the leading suspects for the hover, selection and placeholder problems. Agent B reproduces first, compares with the old screen, then ports the old behavior. |
| Right-to-left rows jump right | `adapter/songlist-rows.css` (the "Right-to-left titles" block) sets `unicode-bidi: plaintext; text-align: start`. With `plaintext`, `start` follows the text's own direction, so Persian and Arabic text moves to the right of its cell. Decision D29 chose this on purpose. | Your item #7 reverses that part of D29. One-line fix to a physical `text-align: left`. |
| Space shows the selection circle | In `adapter/songlist-rows.css` the number cell turns into a play mark, and the row gets an inset ring, for `.row-hover-active`, `.last-selected` and `:focus-visible`. After a mouse click Chromium can treat the focused row as keyboard-focused when Space is pressed. `shell/space-key.js` (D37) only handles buttons, not rows. | Track the input mode (pointer or keyboard) and show the focus styles only for keyboard navigation. Tab keeps its ring. |
| Create folder or playlist missing | The old screen's panel header has `#create-playlist-header-btn` (`data-action="showCreateItemDialog"`). The new library panel builds its own header (chips, find, sort) and has no create control. The engine function still exists. | A button and menu entries that call the engine's existing dialog. No engine change. |
| Application menu is empty | `shell/shell.js`: `MENU` has File, View, Playback and Help, each with one disabled "Not built yet" entry. | Agent A builds the real menu from the engine's actions and shortcuts (`ui/06k`). |
| Home does not exist | `shell/shell.js`: Home is a rail item with the note "Not built yet." I found no home view in the engine. | A shell-owned view reading history and playlists through the adapter (decision DP5 for content). |
| Panel behavior feels odd | In `shell/shell.js` the panel host shows for every rail item, but only Library has panel content (`panel: true`). Search, Recents, Lyrics, Metadata and Settings show a title and one line of text. The collapse toggle (`buildPanelToggle`) applies to all of them. | Matches your section 3: the model changes so each rail item owns real panel content, and only Library collapses. |
| Window buttons have tooltips | `tooltipTitlebarButtons()` in `shell/shell.js` attaches tooltips to `.window-control-btn` and `.close-app-btn`. The bell is inserted directly before the window group. | Drop those two selectors; give the bell its own spacing. |
| Tooltip timing | `components/tooltip.js`: `TOOLTIP_DELAY = 500` ms, `WARM_WINDOW = 300` ms. | The delay is a constant; shortening it is a small change. |
| Waveform delay and scale | `views/playback/waveform.js` decodes the whole track in the renderer, one decode at a time, up to `MAX_SECONDS = 600`, with no saved cache. Each bin takes its peak and divides by the loudest peak, so loud music fills most bars. There is no on/off setting. `player-bar.css` hides the engine's progress knob when the waveform shows. | Delay, scaling and "thumb disappears" each have a code-level cause. Details on the board (PC-03, PC-04). |
| Big picture mode | The old screen has `ui/06h-fullscreen-viewer.js` (143 lines) and `css/fullscreen-viewer.css` (325 lines). The new `views/playback/cover-viewer.js` is 56 lines. | Port the old design (your item #6). |
| "Subhero" | It is the engine's name for the list sub-header: `#subhero-search-input`, `.subhero-play-btn`, `.subhero-shuffle-btn`, `SubheroVisibility` (decision D28 moved these into the title-bar list toolbar). | Probably the answer to your open item 10.4: the design of the play, shuffle and search row. Still needs your confirmation (DP4). |
| Mouse back and forward | The engine handles mouse buttons 3 and 4 in `ui/06k` with its own `goBack` and `goForward`. The shell only mirrors the rail highlight and the lyrics view. Shell-owned views are not in the engine's history. | Likely why back and forward do not match what is on screen. Reproduce with a sequence matrix first. |
| Undo and AI | Neither exists as a feature. Delete confirmations say "cannot be undone". I found undo only in the lyrics editor code (not checked in detail). A smart shuffle (`playback/10b`) and language detection (`lyrics/21`) exist and can be reused. | Agent E builds one journal and a fixed action list. |
| Adapter budgets are already spent | D18 allowed 300 lines across `store`, `actions`, `events` and `engine-view`. They total 318 (67 + 96 + 51 + 104), or 408 with `engine-api` (D30). `legacy-dom-adapter.js` is 205 of its 250 (D13). | Every task below that needs a new engine call needs a budget decision first (DP9). |
| Missing template | `AGENTS.md` and `claude.md` name `.agent/reports/TEMPLATE.md`, but it is not in the archive. | Added in this change. |

## 3. Scope and rules

In scope: every visible surface of the new screen, plus new views, and the Electron main-process code needed for tags and AI. The old screen keeps working (D64).

Rules that apply to every task (from `AGENTS.md`, `claude.md` and the redesign plan):

1. Archive before any change (AGENTS.md section 1). No git work by agents.
2. Real application source only. Plain ES modules and CSS, no new framework.
3. `nodeIntegration: false` and `contextIsolation: true` stay. Every new renderer-to-main call is a named preload call in `electron/preload.js` (and listed in `src/js/api/desktop-api.js`), never a generic invoke.
4. Engine changes are additive seams, each pinned by a test, so the old screen is unchanged. Views reach the engine only through `adapter/`.
5. New engine events go through `tools/event-allowlist.json` and `tools/event-audit.js`.
6. The project stays free: no paid services, no premium-only features. The AI feature is optional, off until the person adds their own key, and the default model list is free models only.
7. Free-text files use CRLF (`.gitattributes`: `eol=crlf`).
8. Every state is designed (hover, focus, active, selected, disabled, loading, empty, error, success). Contrast 4.5:1, visible keyboard focus, reduced motion respected.
9. Anything that changes data in bulk (batch tags, AI reorganizing, AI metadata) shows a preview first and records a journal entry so it can be undone.
10. Report per task in `.agent/reports/` (template included), unique name `P1-<task id>-<slug>.md`. Task agents do not edit `tools/CHANGELOG.md`; the integration owner (A) does.
11. Never claim an unrun test passed. Manual checks the agent cannot run (Electron, Windows) are listed as not run.

## 4. Agents and ownership

| Agent | Role | Owns (only these) |
|---|---|---|
| A | Shell, chrome, settings, themes | `src/ui-next/` root files, `shell/`, `components/`, `startup/`, `adapter/` (shared edits need a board entry), title bar and rail, application menu, notification center and its API, settings layout, hotkeys page, themes, `electron/window-manager.js`, `tools/CHANGELOG.md` |
| B | Library, lists and home | `views/library/`, `views/home/` (new), `adapter/songlist-*`, `adapter/library-bridge.js`, `adapter/listbar-bridge.js`, the engine seams in `ui/05a`, `ui/05b` and `ui/04a` (hover) |
| C | Player, lyrics and big picture | `views/playback/`, `views/tools/lyrics*`, `views/tools/dialogs.css` (shared with A), player bar CSS |
| D | Metadata only | `views/tools/metadata*`, engine side of the tag form (`library/20`, `ui/08f`), `electron/metadata-editor.*`, `electron/tag-builder.js`, `electron/online-metadata.js`, a new tag service |
| E | AI only | `src/ui-next/views/ai/` (new), `electron/ai/` (new), the `ai` group in `electron/preload.js`, the undo journal |

Shared files and who decides: `electron/preload.js` and `electron/main.js` are edited by D and E for their own named calls (each in its own block; A integrates). `shell/shell.js` (`VIEWS`, `showView`) is A's; B, C and D request changes on the board. Notification calls always go through A's notification API (task PA-06).

## 5. Phases

### Wave 0: decisions and investigations (owner and all agents)
- Owner answers DP1 to DP10.
- Investigations, each ending in a report with a recommendation: PA-01 (unified color), PB-01 (list rendering), PC-01 (cover layouts), PD-01 (tag backend), PE-01 (AI provider).
- The old-screen audits (item #18): PA-15, PB-17, PC-12, PD-09. Each lists what the old screen fixed that the new one lacks.
- Owner runs the Electron checks nobody ran (PO-01).

### Wave 1: foundations and quick fixes (parallel)
- A: PA-02 tooltips, PA-04 panel slots, PA-06 notification API, PA-09 budget.
- B: PB-01 fix, PB-11 right-to-left, PB-12 Space and focus, PB-13 resize line.
- C: PC-03 waveform, PC-04 thumbs.
- D: PD-01 tag service and backend.
- E: PE-02 provider and key storage, PE-03 action pipeline, PE-04 undo journal.

### Wave 2: features
- A: rail and title bar merge, menu, Play from URL, settings layout, scroll bar.
- B: panel contents, folder and playlist creation, sorting, context menu, home.
- C: layout build, big picture mode, lyrics tools.
- D: editor redesign, multi editor, original-release lookup.
- E: reorganize, translate, AI shuffle, AI metadata, chat UI.

### Wave 3: integration
- Contextual AI buttons, batch finder notifications, hotkeys page, themes and gradients (A, last, after the new surfaces exist), one pass of the whole app, Windows/Electron checklist.

## 6. Risks

| Risk | Handling |
|---|---|
| Engine shared with the old screen (D64) | Seams stay additive; each has a test that pins the old behavior; run the engine's tests after every seam |
| Virtual scroll is fragile | PB-01 reproduces first and compares old and new at identical data before changing code |
| Replacing the tag writer corrupts files | The service is built behind one interface; the old Python path stays as a fallback until a parity test passes; every write keeps a journal of previous values; tests use copies of files, never the library |
| No way to run Python on the owner's machine | Decision DP7 removes the need. Until then, parity data can be generated in CI, which can install Python |
| Free AI models vary in quality and limits | The model returns structured actions only; the app validates, previews and can undo; errors and rate limits show as notifications; nothing executes model-written code |
| What AI sends out | DP6: show it, send the minimum, no file paths by default |
| Adapter budgets exceeded | DP9 sets new budgets before any new bridge is written |
| Agent A is the heaviest load | Home and the scroll behavior moved to B; settings may move to C if A falls behind |
| Panel model change touches many files | PA-04 (slot API) lands before B starts panel contents; B does not edit `shell/shell.js` |

## 7. Delivery

Each task delivers a `.patch` with its report under `.agent/reports/`. Only A edits `tools/CHANGELOG.md`, after integration and verification. The board tracks status; the brief is the source of what the owner asked for.

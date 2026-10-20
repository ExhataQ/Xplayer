# BOARD: Polish 1

Plan: [`PLAN.md`](./PLAN.md). Brief: [`POLISH-1-BRIEF.md`](./POLISH-1-BRIEF.md). Detailed evidence lives in `reports/`, one file per task (template: `reports/TEMPLATE.md`). The finished UI redesign is in `archive/ui-redesign/`.

**Statuses:** Not started, In progress, In review, Blocked, Done.
**Current phase:** Wave 0 (decisions and investigations). Nothing has been built yet.
**Tag meanings:** *Investigate* means answer with a recommendation before building. *Unclear* means the owner must confirm the wording. *Read* means the cause comes from reading the code, not from running it; every fix task reproduces first.

## Decisions

| ID | Decision | Status | Recommendation |
|---|---|---|---|
| DP1 | Surface colors: top bar, rail and panel share one color; main view and right panel differ from it | Open | One new "chrome" surface token for top bar, rail and panel; main view one step lighter; right panel and player a third. Tokens only, in `tokens.css`. Blocks PA-03 and the panel work |
| DP2 | Home (or a tool) in the main view with one panel open at the same time. Which wins when a tool like Lyrics or Metadata is also a main view | Open | The rail has two kinds of items. Main-view items (Home, Lyrics, Metadata, Settings) replace the main view; the last one picked wins. Panel items (Library, Search, Recents) fill the panel and stay independent of the main view. A filled icon marks the main-view item, the colored bar marks the panel item |
| DP3 | Cover layout (brief section 5, cases 1 to 4); big picture mode keeps the old design either way | Open | Wait for the PC-01 prediction. Owner leans to case 2 (big cover bottom left, no left player section). Big picture mode (item #6) is separate from this choice |
| DP4 | What "subhero design" means (brief 10.4) | Open | **Likely:** the list sub-header, the engine's name for the row with play, shuffle and "search in this list" (`.subhero-*`, decision D28 moved it into the title-bar list toolbar). Please confirm, or say what else |
| DP5 | Content of the new home page | Open | Continue playing (last song), recently played playlists, quick actions (create playlist, Play from URL, open the AI chat once enabled), a few library numbers. Only data the engine already has |
| DP6 | AI: key, provider, and what may leave the device | Open | Person adds their own OpenRouter key; AI is off until then; default model list is free models only; calls go from the main process, never the renderer; send the minimum (title, artist, album, duration; lyrics only for translation; no file paths); show it on first use and in Settings |
| DP7 | Tag backend: remove the dependency on a system Python | Open | Replace with a Node implementation behind one tag service. PD-01 verifies candidate libraries (it could not be checked from here). Keep the Python path as a fallback until a parity test passes. Alternative if no library fits: a prebuilt helper executable made by CI |
| DP8 | Wording to confirm: (a) what exactly is broken in the collapsed state, (b) what "download from web to chat" should do, (c) which list "virtual search results" and "highlight the original release" mean (local search results, or online release results) | Open | Describe each in a sentence. Blocks PB-04 (collapsed fix), PE-12 and PB-09 |
| DP9 | Adapter budgets | Open | D18 (300 lines across `store`, `actions`, `events`, `engine-view`) is at 318, and 408 with `engine-api` (D30). `legacy-dom-adapter.js` is 205 of 250 (D13). Set a new counted budget for this plan (suggested +300 lines in new `adapter/` files) before any new bridge |
| DP10 | Carried over: (a) DL3: offer "Use for this song" for an unchanged query in Find lyrics, (b) where to keep the saved waveform peaks (about 1 KB a track) | Open | (a) Yes, one-line change; the old screen behaves the same, so it stays pinned there. (b) Next to the songs data, through `storage-paths.js`; the module already has a store hook |

Decided in the owner's round 2 (no longer open): keep the X logo for now (10.2 on hold); the Sync tool icon is a simple waveform; use the old screen's design for big picture mode; part of D29 is reversed: right-to-left text stays on the left of its cell.

## Owner tasks

| Task | Status | Notes |
|---|---|---|
| PO-01 Run the Electron and Windows checks no agent ran | Not started | The archived A-11 table (`archive/ui-redesign/reports/UI-A11-smoke-checklist.md`), the interface switch in Settings, the startup view, and the "Windows/Electron checks remain" notes in the archived B, C and D reports |
| PO-02 Snapshot the project before applying any patch (AGENTS.md section 1) | Standing | Agents do not archive |

## Agent A: shell, chrome, settings, themes

| Task | Brief | Status | Depends on | What the code shows, first step |
|---|---|---|---|---|
| PA-01 Investigate unified color | 2.2 | Not started | DP1 | Surfaces are tokens in `tokens.css`; report a proposed token set and show the main view and right panel against it |
| PA-02 Tooltips: shorter delay, flash, key-style hotkeys, smaller box, none on window buttons | 1.1 to 1.5 | Not started | none | `components/tooltip.js`: `TOOLTIP_DELAY = 500`, `WARM_WINDOW = 300`. `shell/shell.js` `tooltipTitlebarButtons()` includes `.window-control-btn, .close-app-btn`: drop them. *Read* |
| PA-03 Rail and title bar merge, Home separation, Library icon, icon animations, active bar, Home fill, tool icon states | 2.1 to 2.8 | Not started | DP1, DP2, PA-04 | Rail items come from `VIEWS` in `shell/shell.js`; icons from `icons/icons.js` (Lucide, built by `tools/build-ui-next-icons.js`) |
| PA-04 Panel slot API and rail structure: each rail item owns its panel content, Metadata and Lyrics above Settings, Home as its own main view, click the active item to close its panel | 3.1, 3.2, 3.5 | Not started | DP2 | Today only Library has panel content (`panel: true`); the others show a title and a note. Land this before B and D touch the rail. *Read* |
| PA-05 Window buttons separate from the bell | 9.5 | Not started | none | The bell is inserted right before `.titlebar__window` in `buildTitlebar()` |
| PA-06 Notification behavior and a notification API for other agents (progress, click target, Undo button) | 9.1 to 9.4, 9.6; used by 15.3, 16.5, 19.1 | Not started | none | `shell/notification-center.js` (186 lines), `adapter/notifications-bridge.js`. First notification opens the center only for important ones; clickable items need a target view; some appear in both toast and center |
| PA-07 Complete the application menu with hotkeys | 18.2 | Not started | DP9 | `MENU` in `shell/shell.js` holds four groups of one disabled "Not built yet" entry. Shortcuts are in `ui/06k-keyboard-shortcuts.js`. Needs actions from the engine through the adapter. *Read* |
| PA-08 Play from URL in the top bar, animated | 10.1 | Not started | DP9 | The engine already has the dialog (`ui/06b-modals.js` `playFromUrl`; save location in `ui/08e`). Add a button and an adapter action |
| PA-09 Adapter budgets: measure, fold, apply DP9 | none | Not started | DP9 | Totals above |
| PA-10 Scroll bar style with theme colors for panels, settings and lyrics | 11.4 | Not started | none | The new screen uses the native bar (`scrollbar-color` in `base.css`, `engine-view.css`). The old custom widget is `ui/06c-scrollbar-widget.js`. Lists are decided in PB-01 |
| PA-11 Settings layout (floating menu bar), move every setting, hotkeys page, host for the AI settings | 11, 13, 19.6 | Not started | PA-04 | Settings is the engine page plus `appearance-settings.js`; `views/tools/settings.css` is 432 lines. May move to C if A falls behind |
| PA-12 Keep the X logo; make the installer icon from it | 18.1, 10.3 | Not started | none | 10.2 (creative redesign, hover animation) is on hold. Packaging is outside this repo (`App/`), so deliver the icon files only |
| PA-13 Mouse back and forward | 8.4 | Not started | PA-04 | The engine handles mouse buttons 3 and 4 (`ui/06k`) with its own history; shell-owned views (Metadata, Settings, lyrics modes) are not in it. Start with a matrix of back and forward sequences. *Read, not reproduced* |
| PA-14 Themes and gradients | 12 | Not started | all surfaces done | Last. Themes only swap token values (D3, D60). Midnight Blue, Aubergine and Rose, Porcelain and Teal were deferred in D63 |
| PA-15 Old-screen audit: shell and chrome | 20 | Not started | none | List what the old screen fixed that the new one lacks, with a fix or a reason to skip |

## Agent B: library, lists, home

| Task | Brief | Status | Depends on | What the code shows, first step |
|---|---|---|---|---|
| PB-01 Investigate, then fix, list rendering: virtual loading, scroll and hover, placeholders, hover and selection styles | 14.1, 8.1 | Not started | none | Suspects, in order: (1) the new CSS removed the old `.song-list` padding of 15 px and the virtual rows' `top: 15px`, while the engine positions highlight layers from row rectangles inside `.content`; (2) the engine's custom scrollbar is hidden, so `dragging-scrollbar` never pauses hover; (3) hover must be recomputed after a scroll (`updateHoverHighlightAfterScroll` uses the last mouse position); (4) `.last-selected` and `:focus-visible` styles overlap hover. Write a browser test that reproduces it on the new screen, run the same on the old screen, then port the old behavior and improve it. *Read, not reproduced* |
| PB-02 Panel contents: Search (songs and playlists) and Recents (playlists, expand for songs and times) in the dynamic panel | 3 (table) | Not started | DP2, PA-04 | Search today is a main-view list under its own field (`views/library/search-view.js`); Recents is the engine's history view |
| PB-03 Button that moves panel results to the main view | 3.3 | Not started | PB-02 | |
| PB-04 Collapse for Library only, review conditions that depended on it, fix the collapsed state | 3.4, 17.5 | Not started | DP8, PA-04 | `buildPanelToggle` in `shell/shell.js` applies to every view; compact rules are in `library-panel.css`. What is broken is not known: reproduce and list the cases first |
| PB-05 Wider panel, bigger covers, scroll bar on the right wall and wider | 3.6 | Not started | none | Width is 240 to 480, default 300 (D62); row heights 56 and 36 (D24, D61) |
| PB-06 Folder and playlist creation: panel button, context menu, shared functions the AI will reuse | 17.4, 7.4 | Not started | DP9 | The old panel header has `#create-playlist-header-btn` (`data-action="showCreateItemDialog"`); the new `library-panel.js` builds its own header with no create control. Use the engine's dialog through the adapter. *Read* |
| PB-07 Context menu: icons, floating menu, default cover | 7.4 to 7.6 | Not started | none | Engine menus are `ui/06a`; the old default cover is `src/assets/default-cover.svg`; check which one the new screen uses |
| PB-08 Sort from the track list: album, title, time (both directions) | 7.2 | Not started | none | Header is in `views/library/song-list.js`; the engine has the view-model sort seam (D22) |
| PB-09 Better search results display, highlight the original release | 7.3 | Not started | DP8 | Needs to know which list; the highlight needs PD-04's rule if it is the online list |
| PB-10 Filter animation, queue opens when dragging songs near it | 3.7, 3.8 | Not started | PC-11 | Drag logic is `ui/06f` and `ui/06g`; the queue is `views/playback/queue-panel.js` (C) |
| PB-11 Right-to-left text stays on the left | 14.2 | Not started | none | `adapter/songlist-rows.css`, block "Right-to-left titles": `unicode-bidi: plaintext; text-align: start`. Change to `text-align: left`, keep `plaintext`; check the search view (`text-align: start`) and the panel. Add a Persian, an Arabic and an English row to the test. *Read* |
| PB-12 Space no longer shows the selection circle; Tab keeps it | 14.3 | Not started | none | `adapter/songlist-rows.css` shows the play mark and an inset ring for `.row-hover-active`, `.last-selected` and `:focus-visible`. Add an input-mode flag (pointer or keyboard) set by a small script next to `shell/space-key.js`; scope the focus styles to keyboard mode. A reviews the shared script. *Read, not reproduced* |
| PB-13 White column-resize line | 7.1 | Not started | none | `.songlist-resizer` in `views/library/song-list.css` |
| PB-14 Bugs: unnecessary updates when one item changes, pinned items have no border while moving | 8.2, 8.3 | Not started | none | Pinned items: `playlists/03g-pinned-items.js`, drag in `ui/06g-drag-drop-left-panel.js` |
| PB-15 Home page | 18.3 | Not started | DP5, PA-04 | New `views/home/`, reads history and playlists through the adapter; no engine change expected |
| PB-16 Old-screen audit: lists and library | 20 | Not started | none | |

## Agent C: player, lyrics, big picture

| Task | Brief | Status | Depends on | What the code shows, first step |
|---|---|---|---|---|
| PC-01 Investigate the four cover layouts with a prediction for each | 5, 15.2 | Not started | DP3 | Include how big picture mode (old design) is entered and left in each layout |
| PC-02 Build the chosen layout and rework the player section | 5 | Not started | PC-01, DP3 | |
| PC-03 Waveform: delay, scaling, bar design and contrast, on and off setting (default off), saved peaks | 6.1 to 6.3; C-02 carry-over | Not started | DP10 | `views/playback/waveform.js`: the whole track is decoded in the renderer, one at a time, up to 600 s, and nothing is kept between sessions (a store hook `setPeaksStore` already exists, about 1 KB a track). Each bin uses its peak divided by the loudest peak, so loud music fills the bars: try RMS or a percentile with a curve. No setting exists today. *Read; "verify first" in the brief still applies* |
| PC-04 Thumbs: volume (and maybe progress) must not vanish at zero | 6.4 | Not started | none | The engine positions `#volume-knob` with `left: X%` and `translate(-50%)`, so at 0 half of it sits outside the slider and an ancestor can clip it. Separately, `player-bar.css` hides the engine's progress knob on purpose when the waveform shows. Owner: say which bar you mean. *Read* |
| PC-05 Highlight and selection problems on the bars, on drag, resize and scroll; make some elements non-selectable | 6.5 | Not started | none | Compare with the old screen's rules |
| PC-06 Big picture mode in the old design | 15.2 | Not started | DP3 | Old: `ui/06h-fullscreen-viewer.js` (143 lines) and `css/fullscreen-viewer.css` (325). New: `views/playback/cover-viewer.js` (56). Port the design, keep the new tokens |
| PC-07 Lyrics rail item opens the Sync tool, waveform icon; compare with the tool boxes alternative | 4.1, 4.2, 15.1 | Not started | PA-04 | Write and Sync are tabs of the Lyrics page (D31); the Sync icon is a simple waveform (decided) |
| PC-08 Find lyrics: rename, blank album on purpose; Write: paste lyrics or LRC; keep the finder's state | 4.4 to 4.6 | Not started | none | The multi-song finder is in `lyrics/19-online-lyrics.js`; D34 closes editors on leave, which may be what resets the state |
| PC-09 Notification for the multi lyrics finder | 15.3 | Not started | PA-06 | Started, progress, finished with counts; click opens the results |
| PC-10 DL3: "Use for this song" for an unchanged query | DP10 | Not started | DP10 | One condition in `hasOnlineLyricsQueryChanged` (`lyrics/19`) |
| PC-11 Queue opens when songs are dragged near it | 3.7 | Not started | PB-10 | C owns `queue-panel.js` |
| PC-12 Old-screen audit: player and lyrics | 20 | Not started | none | |

## Agent D: metadata only

| Task | Brief | Status | Depends on | What the code shows, first step |
|---|---|---|---|---|
| PD-01 Investigate, then build, the tag service without a system Python | 16.3 | Not started | DP7 | `electron/metadata-editor.js` runs `python` or `py` and `metadata-editor.py` (mutagen). Tests skip without Python and use a stand-in for mutagen. Verify candidate Node libraries (formats, maintenance); write `read`, `write`, `writeMany`; keep the Python path as a fallback; build parity tests on copies of real files, generating expected data in CI if needed. The tag rules in the Python file (";" splits values, comma does not; which comment frame counts) must be kept. *Read* |
| PD-02 Redesign the single metadata editor | 4.3, 16.1 | Not started | PD-01 | Today it is the engine's tag form, reskinned (D32); `views/tools/metadata.css` is 363 lines. Views reach the engine only through `adapter/engine-api.js` (D30) |
| PD-03 Multi metadata editor: choose songs, apply tags, genres, artists; differing fields show as mixed and stay unchanged unless edited | 16.2 | Not started | PD-01, DP9 | Selection comes from `ui/17-song-selection.js` |
| PD-04 Original or most popular release: selection rule, confidence, review queue | 16.4 | Not started | none | Build on `electron/online-metadata.js` (MusicBrainz, release scope, `firstReleaseDate`). Rule proposal: earliest official album release, skipping compilations, live and remix unless the file is one. "Most popular" needs a popularity source: investigate and verify terms first |
| PD-05 Multi tag finder: apply automatically above a confidence threshold, queue the rest, with notification | 16.4, 16.5 | Not started | PD-03, PD-04, PA-06 | Setting: "original" or "most popular" |
| PD-06 Journal of previous tag values so changes can be undone | 19.1 | Not started | PE-04, PD-01 | Uses E's journal |
| PD-07 Metadata rail item above Settings | 3.1 | Not started | PA-04 | |
| PD-08 Test hygiene: real writer tests that run on the owner's machine and in CI | 16.3 | Not started | PD-01 | Folded into PD-01's report if small |
| PD-09 Old-screen audit: metadata | 20 | Not started | none | |

## Agent E: AI only

| Task | Brief | Status | Depends on | What the code shows, first step |
|---|---|---|---|---|
| PE-01 Investigate OpenRouter: current free models, limits, structured-output quality, web search option | 19.2, 19.3 | Not started | none | Not checkable from here; test two or three models on the action format. Recommendation: use the API, not free chatbots' web pages (fragile and probably against their terms) |
| PE-02 Provider interface, main-process client, named preload group `ai`, key storage, settings | 19.2 | Not started | DP6, DP9 | Add the group to `electron/preload.js` and `src/js/api/desktop-api.js`; calls only from the main process |
| PE-03 Action list, schema, validation, preview, execute | 19.2 | Not started | PE-02 | The model returns structured actions only; the app never runs model-written code. Actions call the engine and the tag service through the adapter |
| PE-04 Undo journal and notifications with an Undo button | 19.1 | Not started | PA-06 | One journal, saved to disk, capped, each entry holds what it changed and the old values. Undo was found only in the lyrics editor code |
| PE-05 Reorganize the library from the person's description | 19.3 | Not started | PE-03, PB-06 | Folders and playlists, always with a preview |
| PE-06 Translate lyrics | 19.3 | Not started | PE-03 | `lyrics/21-language-detect.js` exists; keep LRC timings |
| PE-07 AI shuffle | 19.3 | Not started | PE-03 | Builds on `playback/10b-playback-smart-shuffle.js` |
| PE-08 AI metadata editing and web search | 19.3 | Not started | PE-03, PD-01 | Uses D's tag service; investigate how web search is provided and what it sends |
| PE-09 Privacy screen and AI settings page | 19.4, 19.6 | Not started | DP6, PA-11 | |
| PE-10 Chat UI and the top bar icon next to the bell | 18.4, 19.5 | Not started | PA-03, PA-05 | |
| PE-11 Contextual AI buttons through the app | 19.5 | Not started | PE-05 to PE-08 | Translate on lyrics, fill tags in the editor, organize in the library panel, AI shuffle in the player |
| PE-12 Download from the web through chat | 19.5 | Blocked | DP8 | Unclear what to download, from where, and how it differs from Play from URL. Downloads with Cancel already exist (`electron/downloads.js`, D41) |

## Blockers and questions

Open decisions DP1 to DP10 above. The ones that block building soonest: DP1 and DP2 (rail, panel, colors), DP7 (tag backend), DP9 (any new bridge), DP6 (AI).

## Reports

| Task | Report | Status |
|---|---|---|
| none yet | | |

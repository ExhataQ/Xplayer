# Patch plan after A-03 and A-04

**Author:** A. **Status:** Proposal for your review. Sizes are rough estimates, not measurements. The patch order is mine; you can reorder anything not marked as a dependency.

## 1. Where things stand

| Patch | Contents | State |
|---|---|---|
| P1 `engine-contract-and-seek-fix` | Contract v2, seek and volume fix (D-1, D-2), `seek-volume.test.js` | Delivered |
| P2 `ui-next-shell-and-adapter` | Shell, DOM-id adapter, glyph map, 17-test gate | Delivered |
| P3 `research-and-patch-plan` | This plan and the B-01 and C-02 research (docs only) | This patch |

## 2. A gap in A-04 that I should have flagged

`PLAN.md` section 4 says `adapter/` exposes a small API (`store` to read state, `actions` to do things, `events` to subscribe) and that views import only from `adapter/` and `components/`. What P2 built is the **DOM-id layer** (`legacy-dom-adapter.js`) only. The API surface does not exist yet, so B, C and D have nothing to import. I marked A-04 "In review" and that was too generous. P5 below closes the gap, and the board now shows A-04c as a separate task.

## 3. Phase 1 completion (the path to A-06)

| # | Patch | Board | Scope | Depends on | Gate or tests | Size | Risk |
|---|---|---|---|---|---|---|---|
| P4 | `fade-volume-fix` | D-3 | `animateAudioVolume` is never cancelled when the user sets the volume, so a click during the one-second fade-in is overwritten. Cancel the fade in the user volume path and set the track's target volume | your OK (D17) | new test that clicks **during** the fade | about 10 lines | low |
| P5 | `adapter-api` | A-04c | `adapter/store.js` (read-only: current view, queue and index, current song, playing, volume, muted, repeat, shuffle, selection copy, `songs(listId)` via `getSongsForList`), `adapter/actions.js` (play from list, transport, seek, volume, favorite, add to queue, `switchView`, `openAlbum`, `openArtist`, back, forward), `adapter/events.js` (allow-listed `on` over the engine bus), the view bridge (rail selection follows `view:changed`; rail click calls `switchView`) | P2 | each function tested against the real engine; a lint-style test that files outside `adapter/` and `components/` import nothing from `src/js/` and touch no `window.*` engine global | about 300 lines (D18) | medium: must confirm which engine state is readable; module-private `let` values (for example `selectedSongIds` in `04a`) may need a one-line engine export |
| P6 | `components-inputs` | A-05a | button, icon button (extracted from the shell's duplicated rules), input, segmented control, tabs. Each with default, hover, active, focus-visible, disabled and loading where meaningful | A-01 | kitchen sink page plus keyboard and focus tests; a test that no component uses a raw color | 400 to 600 lines | low |
| P7 | `components-overlays` | A-05b | menu (also replaces the logo menu placeholders), tooltip, dialog (focus trap, Escape, restore focus) | P6 | focus-trap and Escape tests; menu arrow-key navigation | 500 to 700 lines | medium: focus management |
| P8 | `components-feedback` | A-05c | toast, status indicator, empty state (the shell's empty views move onto it) | P6 | live-region test; reduced-motion test | 300 to 400 lines | low |
| P9 | `overlay-bridge` | L-10 | **only if you choose it (D14).** A small stylesheet that makes the engine's own overlays (shuffle and playlist dialogs, context menus, toasts) visible and token-styled until A-05, A-07 and D-06 replace them | decision | open each overlay in the shell and assert it is on screen and inside the window | about 150 lines of CSS | low, but it is throwaway work |
| P10 | `startup-and-logo` | A-09 | real logo mark, startup view. The board says it can start any time after the tokens | A-01 | boot test | small | low |
| P11 | `phase1-gate` | A-06 | One script that runs the whole gate: new shell boots, plays, resizes to the minimum window, the old UI still boots and its tests pass; plus your Electron smoke checklist (window drag, minimize, maximize, close, back, forward, play a real file). Releases B, C and D | P4 to P8 | the gate script itself | small | depends on your Electron run |

Suggested order: P4 and P10 any time, then P5, P6, P7, P8, P9 if chosen, then P11. P5 does not wait for the components.

## 4. Phase 2 slicing (after A-06; to be re-planned then)

The B-01 experiment changes the plan. Every engine view (all songs, albums, playlists, favorites, history, search, **Settings, lyrics**) renders into one container, and moving that container into the shell's view host kept everything working. So Phase 2 can start by **showing the engine's views in the shell and restyling them** (strategy S3, decision D16), instead of rebuilding each one first.

| Order | Patch | Owner | Notes |
|---|---|---|---|
| 1 | `view-host-bridge` | A | Move the engine's main content into the view host, hide the engine's hero section if the design needs, wire rail and router (`view:changed`), add a gate that the node identity holds. Prerequisite for everything below |
| 2 | `glyph-map` | A | Extend D12 from 4 to about 65 glyphs (43 Font Awesome classes, 22 Material Symbols names, listed in the B-01 document) |
| 3 | `settings-restyle` (D-05) | D | The cheapest proof of S3: the engine already renders the page. Restyle it with the shared components. If this goes smoothly the rest follows the same pattern |
| 4 | `songlist-style` (B-03) | B | Grid columns, row height token, compact mode, resize via CSS variables. Must give the virtual scroll a height-constrained container (the one thing that was missing in the experiment) and restyle the two overlay layers |
| 5 | `library-panel` (B-02) | B | Needs its own research first (left panel internals were not read in B-01) |
| 6 | `queue-and-volume` (C-03), `waveform` (C-02), `player-bar` (C-01) | C | C-02 waits for D15. Queue panel likely follows S3 too |
| 7 | `metadata-modal` (D-04), `lyrics-*` (D-01 to D-03) | D | Lyrics is the largest surface (66 of the engine's 198 registered actions), so it needs its own research and at least three patches |
| 8 | `dialogs` (D-06), `search` (B-04), `detail-views` (B-05), `fullscreen-viewer` (C-04) | D, B, C | |

Until Phase 3, engine overlays stay unstyled unless D14 says otherwise.

## 5. Decisions needed from you

| ID | Question | My recommendation |
|---|---|---|
| D14 | Interim styling for engine overlays (P9) | Skip, unless you will use the new shell daily before A-06 |
| D15 | Waveform source (ffmpeg in the main process, or renderer decode with limits). **You need to check the size and licence of the ffmpeg build you would ship** | B if acceptable, else A with limits. See `research/C-02-waveform-source.md` |
| D16 | List and views strategy: S1, S2 or S3 | S3 |
| D17 | May I fix D-3 (P4), which is outside what you approved? | Yes, it is small and tested |
| D18 | Adapter API budget | 300 lines of code across `store`, `actions` and `events`, separate from D13's 250 for the DOM layer. Over budget means revisit |

## 6. Research still worth doing (docs only, no code)

| Doc | Why |
|---|---|
| B-02 left panel | `renderLeftPanelMainList`, `collectAllLeftPanelItems`, lazy load (`05b`), pinned items, filters. Not read yet |
| Lyrics area | 66 actions, sync editor, online search, import. Biggest surface and the least understood |
| Settings page | What `08e` renders and which settings are stored where, so D-05 can restyle without breaking persistence |
| Queue panel, search, fullscreen viewer | Each renders in the engine today; each needs the same short map B-01 gave the list |
| A-11 parity checklist draft | The live registry has 198 actions; the appendix groups them. A checklist now means nothing is forgotten at cutover |

## 7. Housekeeping

- `package.json` already lists `acorn`, `acorn-walk`, `eslint` and `globals` as dev dependencies, so a plain `npm install` brings them in. I said "npm i acorn ..." earlier, which was clumsier than needed. The 9 test files that fail in my sandbox only because `acorn` is missing should be run on your machine, in particular `lint`, which has never seen `src/ui-next/`.
- Run the new shell once in Electron (`--ui=next`). Everything so far is headless Chromium with a stubbed `electronAPI`.
- Snapshot before each patch (`AGENTS.md` section 1). Apply in order: P1, P2, P3.
- `.gitattributes` is `* text=auto eol=crlf`; the new `ui-next` files are LF in the patch and will be normalized by git on checkout.

## Appendix: the engine's surface by area

From the live registry of the running app (198 registered actions, 721 legacy globals). Groups are regex heuristics by name, so treat counts as approximate.

| Area | Actions | Examples |
|---|---|---|
| Lyrics (view, editor, sync, online, import) | 66 | `clearSyncedLyricsForCurrentSong`, `attemptCancelSyncEditor`, `clearOnlineLyricsSearchInputs` |
| Navigation and views | 21 | `goBack`, `goForward`, `openAlbum`, `openArtist` |
| Metadata and tags | 17 | `chooseMetadataCover`, `exportMetadataJson`, `findOnlineMetadata` |
| Playlists and folders | 15 | `confirmCreatePlaylist`, `closeFolder`, `changeMusicFolder` |
| Playback and transport | 14 | `playSongFromList`, `playFromQueue`, `playTrackNext` |
| Search | 13 | `focusLeftPanelSearch`, `clearSearchHistory` |
| Settings and theme | 8 | `setSmartShuffleSetting`, `openAdvancedSettings` |
| Window and app | 8 | `minimizeApp`, `maximizeApp`, `closeApp` |
| Library | 5 | `addLibraryLocation`, `exportAllData`, `importAllData` |
| Queue | 3 | `addSongToQueueNext`, `loadMoreQueueItems` |
| Other (context menu, notifications, misc) | 28 | `clearAllNotifications`, `contextMenuAction`, `contextMenuPinItem` |

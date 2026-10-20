# PLAN: UI redesign ("ui-next")

**Status:** Phase 4 — parity and cutover in progress; A-11/A-12 are in review and A-14 has not started (see `.agent/BOARD.md`).
**Previous plans:** event bus and renderer refactor, finished (see `archive/`).
**Inputs:** [`USER_PREFERENCES.md`](./archive/ui-redesign/design/USER_PREFERENCES.md), [`DIRECTION.md`](./archive/ui-redesign/design/DIRECTION.md), `../.claude/skills/xplayer-ui-redesign/SKILL.md`, the approved design preview.

## 1. In plain words

Xplayer already has a clean split between its **engine** (state, events, playback, library, playlists, search, lyrics parsing, Electron main process) and its **screen** (`src/js/ui/`, `src/css/`, the HTML template). This plan builds a **new screen** on top of the **same engine**.

- The old screen keeps working the whole time. Nothing is deleted until you say so.
- The new screen lives in its own folder and is switched on with a flag (`--ui=next`).
- The engine is not rewritten. The new screen talks to it only through two doors that already exist: the event bus (`on` / `emit`) and `desktopApi`.
- Work is split into layers. Each layer ends with something you can open and test.

## 2. Scope and rules

In scope: every visible surface (window frame, navigation, panels, lists, player, lyrics tools, metadata editor, settings, dialogs, tooltips, notifications, startup view).

Out of scope: scanner, metadata backend, online lookups, storage formats, playback logic. If a change there looks necessary, stop and ask.

Rules that apply to every task (from `AGENTS.md` and the UI skill):

1. Archive before any change (AGENTS.md section 1). No git work by agents.
2. Real application source only. No standalone prototype counts as done.
3. No new framework. Plain ES modules and CSS, same as today.
4. Keep `nodeIntegration: false` and `contextIsolation: true`. New renderer-to-main calls go through a named preload call, never a generic invoke.
5. Keep existing behavior: playback, queue, shortcuts, selection, context menus, drag and drop, virtual scrolling, lyrics, metadata editing. Changing any of them needs approval.
6. During Phase 2 nobody edits `src/js/ui/`, `src/css/` (the old screen) or the shared engine folders. Engine bugs found along the way go on the board as blockers.
7. Every state is designed: hover, focus, active, selected, disabled, loading, empty, error, success.
8. Text contrast at least 4.5:1 (3:1 for 24 px and larger). Keyboard focus is always visible. Reduced motion is respected.
9. Pure UI work is verified by inspection plus a specific manual checklist. Never claim a test passed that was not run.

## 3. Decisions needed from you (before Phase 1)

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Where the new screen lives | `Source/src/ui-next/` inside the same tree, so it ships as real source and the build can see it. Not a separate repo or app. |
| D2 | Default look | Dark, minimal, graphite ground, one amber accent used only for what is playing and the active item. See `DIRECTION.md`. |
| D3 | Themes | Ship Warm Graphite as the default. Shortlist Deep Forest and Espresso and Copper as built-in alternatives. Midnight Blue, Aubergine and Rose, Porcelain and Teal stay as later options. The old accent colors (green, pink, purple, yellow, white) remain as accent choices. Themes only swap token values. |
| D4 | Navigation | Rail: Home, Library, Search, Recently played, Lyrics, Metadata, Settings. Search may later fold into Library. |
| D8 | Title bar | The logo is a button that opens the app menu (File, View, Playback, Help). Back and forward buttons next to it. A notification bell on the right replaces the scan status button; the bell holds ongoing work and recent messages. No app name text. |
| D9 | Library panel | The panel is one list of everything you own (playlists, folders, albums, artists, favorites). Filters sit on top as chips (All, Playlists, Folders, Albums, Artists), then find and sort, then the list. It replaces the old Songs, Albums, Artists section list. The main area shows whatever you pick. |
| D5 | Icons | Lucide (ISC license, free). Copy only the icons used into `ui-next/icons/` with the license file. |
| D6 | Fonts | IBM Plex Sans for the interface, Newsreader for lyrics and large headings. Both OFL. Bundled as woff2, no network use at runtime. |
| D7 | Cutover | The old screen stays until Phase 4 passes the parity checklist and you approve removal. |

## 4. Architecture

```
Source/src/ui-next/
  index.html          shell entry (flag-loaded)
  tokens.css          primitive, semantic, component tokens
  base.css            reset, typography, focus, motion
  icons/              vendored Lucide SVGs + LICENSE
  fonts/              woff2 + license files
  adapter/            the only files that touch core/ or desktopApi
  components/         button, input, tabs, tooltip, toast, status, dialog, menu
  shell/              title bar, nav rail, contextual panel host, player host
  views/library/      (Agent B)
  views/playback/     (Agent C)
  views/tools/        (Agent D)
```

- `adapter/` exposes a small, documented surface: `store` (read state), `actions` (play, queue, edit), `events` (subscribe). Views import only from `adapter/` and `components/`.
- The existing engine modules are loaded unchanged. Where an engine file looks up old DOM ids (the `15a`..`15g` playback controls, lyrics files), the adapter supplies those ids on hidden or re-skinned elements first. Replacing that coupling is a later cleanup, not part of this plan.
- `electron/main.js` and `window-manager.js` choose which entry HTML to load from the flag. This is the only Electron change expected.
- `build/music_player.py` has a hardcoded copy list. Task A-02 extends it for `ui-next/` and is the only build change.

## 5. Agents and ownership

| Agent | Role | Owns (only these) |
|---|---|---|
| A | Foundation and integration | `ui-next/` root files, `adapter/`, `components/`, `shell/`, flag in `electron/`, build list, notifications, tooltips, startup view, `tools/CHANGELOG.md` |
| B | Library surfaces | `views/library/`: contextual panel for library sections, song list, search, albums, artists, playlists, folders |
| C | Playback surfaces | `views/playback/`: player bar, waveform seek, queue, volume, fullscreen viewer |
| D | Tools and settings | `views/tools/`: lyrics (view, find, write, sync), metadata editor, settings, dialogs |

Shared contract: `adapter/` API and `components/` are owned by A. B, C, D may request additions on the board; they do not edit those folders. Event names stay owned by the emitting agent per `core/EVENTS.md`.

## 6. Phases

### Phase 0: Decisions and safety (you and A)
- Approve D1 to D9.
- Archive the current project (AGENTS.md section 1).
- Run the existing quick checks once (`npm run test:quick`) and record the result as the baseline in the first report.
- Exit: decisions recorded on the board.

### Phase 1: Foundation (A only)
- Tokens, base CSS, fonts, icons.
- Shell: title bar (logo menu, back and forward, bell, window controls), nav rail, contextual panel host (compact and expanded), player host, empty views.
- Adapter surface v1 and the `--ui=next` flag.
- Build list updated.
- Component set: button, icon button, input, tabs, segmented control, tooltip, toast, status indicator, dialog, menu, empty state, each with all states.
- Exit: the app starts in the new shell, plays a song through the old engine, resizes cleanly, and the old UI still starts without the flag. B, C, D then get the adapter docs.

### Phase 2: Surfaces (B, C, D in parallel)
- B: library panel (filter chips, find, sort, one list of playlists, folders, albums, artists; compact and expanded), song list (columns, resize, compact mode, virtual scroll, selection, context menu, drag and drop), search, album, artist, playlist, folder views.
- C: player bar with waveform seek, transport, queue, volume, fullscreen viewer, shortcut hints.
- D: lyrics panel with four separate modes (view, find, write, sync), empty state, sync editor, metadata editor, settings sections, dialogs.
- Each task ends with a report and a manual checklist.
- Exit: every surface exists in the new UI and meets the shared component rules.

### Phase 3: Integration (A)
- Transient toasts, plus a notification center behind the title bar bell: an "in progress" section (scan, download, extraction, with progress and cancel) and an "earlier" section (confirmations and errors with a next step).
- Tooltip rollout (name, state, short description, shortcut).
- Startup view and logo.
- Accent themes, window resizing, density.
- Exit: one coherent pass through the whole app with no old styles visible.

### Phase 4: Parity and cutover (A, with you)
- Run `tools/smoke-checklist.md` against old and new.
- Fix gaps. Hold the removal of the old screen until you approve it.
- Update `CHANGELOG.md` and move this plan, board and reports to `archive/ui-redesign/`.

## 7. Risks

| Risk | Handling |
|---|---|
| Engine files bound to old DOM ids | Adapter provides ids first; clean up later |
| Virtual scrolling is fragile | B writes a map of the current behavior before changing it (task B-01) |
| Build copy list misses new files | A-02 early, rechecked at each phase exit |
| Four agents drift visually | Phase 1 components and `DIRECTION.md` are the only source of look |
| Fonts or icons licensing | D5 and D6 vendored with license files |
| Persian, Arabic and other right-to-left text (lyrics, titles) | Bundled fonts are latin only; other scripts use the system font. Text areas use `dir="auto"`. Lyrics and list rows need a right-to-left check in Phase 2 (tasks B-03, D-01) |
| Performance on large libraries | List and panels reuse existing lazy-load logic; measure before and after |

## 8. Delivery

Each task delivers a `.patch` with its report under `.agent/reports/`. Only A edits `tools/CHANGELOG.md`, after integration and verification.

# Engine contract for the new UI (task A-04 map)

**Status:** Map, written before any adapter code. Basis for decision D10 (below).
**Method:** A probe page in headless Chromium loaded the engine modules the playback and state layer needs (27 files from `src/js/`, listed at the end), first with no page, then with the element IDs listed in section 2 added as empty elements. No source file was changed.

## 1. What the probe found

- With no page, the engine fails at load time: `15a-controls-time-play.js` does `playButton.onclick = ...` and `playButton` is `null`. Module-level code assumes the old page exists.
- With the 25 IDs in section 2 present, all 27 modules load with no page errors.
- So the engine's playback and state layer can run inside a new page without a rewrite, as long as the new page provides those IDs and the class names in section 3.

## 2. Element IDs the engine needs (25)

Used by the 27 modules at load time or at runtime. All but one are already in `build/music_player.html`.

| ID | Used by | Notes |
|---|---|---|
| `audio` | `00-state` | The `<audio>` element. Must be an `audio` tag. |
| `play-btn`, `shuffle-btn`, `repeat-btn`, `repeat-one`, `next-btn`, `prev-btn` | `00-state`, `15a`, `15b`, `15c`, `15d` | Buttons. `repeat-one` is an indicator. |
| `current-time`, `total-time` | `00-state`, `15a` | Time text. |
| `progress-container`, `progress-bar`, `progress-knob` | `15f`, `10d` | Seek bar. Class `.progress-container` is also queried. |
| `volume-slider`, `volume-fill`, `volume-knob`, `volume-icon` | `15g` | Volume. |
| `player-title`, `player-artist`, `player-cover` | `10d` | Now playing. `player-artist` takes HTML. |
| `lyrics-toggle-btn`, `subhero-play-btn` | `10d` | Optional behavior. |
| `song-list` | `00-state` | Row container. Engine writes rows into it. |
| `queue-list` | `10c` | Queue rows. |
| `search-input` | `00-state` | Search field. |
| `left-panel`, `right-panel`, `tags-content` | `00-state` | Panel containers. |

Only missing from the template: `library-locations-list` (a runtime list, used by `03j`; not in the playback probe).

## 3. Class names and attributes the engine reads at runtime

The engine writes and queries these by class, so the new CSS must keep them. Count is from the 27 files.

- `.song-item`, `.song-item.playing`, `.song-number-item` (row and playing state; `15e` marks the current row)
- `.left-panel-main-item.playing`, `.left-panel-cover-play-btn` (`15e`)
- `.player-song-info` with `.has-song` (`10c`, `10d`, `15e`)
- `.add-to-queue-btn[data-song-id]` (`10c`)
- `.shuffle-mode-overlay` (`15b`)

## 4. What is not mapped yet

The probe covered playback and state only. Still to map before tasks B and D:
- list rendering: `04a-ui-render-core`, `05a-lazy-load-main-list` (virtual scroll), `07-views`
- lyrics: `11*`, `19-online-lyrics`, `08c`, `08g`
- metadata editor: `20-metadata-editor`
- settings and panels: `08a`, `08e`, `08d`
- the 80+ IDs the other files use (`src/js/` has 167 distinct ID lookups in total; 66 are not in the current template, most are created at runtime by overlays)

## 5. Options

**Option A: compatibility shim (recommended for Phase 1).** The new shell provides the IDs and classes in sections 2 and 3, and restyles them. The engine is unchanged. Playback and lists keep working exactly as now. The new design comes from CSS and the new panels around the engine's markup.
- Risk: the engine's row and player markup is fixed, so some layouts will be constrained by old structure. The virtual scroll (`05a`) is fragile per `.agent/ways-of-working`.

**Option B: event-driven engine.** Playback emits events (`player:stateChanged`, `queue:changed`) and the new UI renders its own markup. Cleaner, but it changes engine behavior and touches the code the plan calls fragile. Needs your approval before any work.

## 6. Decision

**D10:** Use Option A for Phase 1 (A-03 shell and A-04 adapter), with the IDs and classes above as the written contract. Revisit Option B per screen during Phase 2.

## 7. Probe files (not shipped)

The 27 engine modules loaded by the probe, relative to `src/js/`: `core/legacy.js`, `core/storage.js`, `api/desktop-api.js`, `core/build-data.js`, `core/00-state.js`, `core/00b-events.js`, `core/01-sizes.js`, `core/02-ghost-list.js`, `core/state-playback-modes.js`, `library/03j-library-locations.js`, `playback/10a0-shuffle-state.js`, `playback/15a0-controls-state.js`, `core/state-queue.js`, `core/state-now-playing.js`, `core/state-navigation.js`, `core/state-ghost-list.js`, `core/state-folders.js`, `core/state-ui.js`, `core/utils.js`, `library/songs.js`, `playback/session.js`, `playback/10a-playback-shuffle.js`, `playback/10b-playback-smart-shuffle.js`, `playback/10c-playback-queue.js`, `playback/10d-playback-song.js`, `playback/15a-controls-time-play.js`, `playback/15e-controls-audio-events.js`.

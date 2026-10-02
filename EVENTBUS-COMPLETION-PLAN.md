# Plan 1: finish the event bus in every file (4 agents)

Plan 2 is `PLAN.md` (setters, modules, storage, final flip). It starts only when this plan is done. Nothing here needs Electron or modules.

## 1. What "done" means

`node tools/event-audit.js --strict` exits 0: no file owned by A, B or C calls a **reaction** function defined in D's files (`04*`-`07`) directly. Every such call goes through `emit()` (owner side) and `on()` (a subscriber file).

Measured at the start: **164** such calls (A 41, B 81, C 42). **Final state: A 0, B 0, C 0** (`--strict` exits 0). 76 calls stay direct by `fileExceptions` in `tools/event-allowlist.json` (view handlers, start-up, the highlight subsystem), each with a reason that D reviewed (D report 0004). Status: all A, B, C and D steps done in code; **EB-D4 (full smoke checklist in the app) is still to be run by the human**. 39 events are documented in `EVENTS.md`.

## 2. What is and is not event-bus work

Not every call into the UI is a reaction. `tools/event-allowlist.json` lists what stays direct, with the reason:

| Kind | Examples | Why it stays |
|---|---|---|
| Services | `showNotification`, `showConfirmDialog`, `createModal`, `updateScrollbarById` | A sink anyone may call. Roughly 230 calls. Not a reaction. |
| Queries | `getSongsForList`, `buildSongArtistHTML` | Return data, change nothing. |
| Navigation | `switchView`, `openDetailView`, `pushViewToHistory` | Commands that move the user. Revisit with a router in Plan 2. |
| Setup | `initThemeButtons`, `setVirtualScrollThreshold` | Run once at start. |
| **Reactions** | `renderSongsList`, `renderLyricsView`, `updateSubheroPlayButton`, `updateHeroSongCount` | "Something changed, redraw." **This is the work.** |

An agent may add a name to the allowlist, but only with a sentence in its report saying why. D reviews allowlist changes.

## 3. How one slice works (same as the 7 slices already done)

One slice = one coherent reaction (for example "lyrics were saved"). The agent that **owns the file that makes the change** does the whole slice, so nobody edits another agent's file:

1. Add a scenario in `tools/tests/helpers/scenarios-<agent>.js` (spy on the UI functions the old code calls).
2. **On the unconverted code** run `EVENT_BASELINE=1 node --test tools/tests/events-<agent>.test.js`. This records the call order into `tools/tests/expected/events-<agent>.json`. The harness refuses to overwrite a recorded sequence unless you pass `EVENT_BASELINE=force`.
3. Convert: the owner's file calls `emit('subject:verbChanged', {...})`; the DOM code moves unchanged into a **new** subscriber file (names reserved below) that calls `on(...)`. Keep every public function name and signature.
4. Run the suite. It must reproduce the recorded order exactly. A deliberate difference (for example removing a duplicate refresh) is allowed only as removals, and the report must say which calls went and why.
5. Add the event to `src/js/core/EVENTS.md` in the same patch.
6. Run the sabotage check: delete one call inside the new subscriber, confirm the suite fails, restore.

Rules from `src/js/core/EVENTS.md` apply: payload is one object, names are `subject:verbChanged`, no per-frame events.

## 3.1 Keeping four patches from colliding

- **New files only for subscribers.** Reserved names: A `04h`-`04o` (used), B `04p`-`04s`, C `04t`-`04w`, D `04x`-`04z`.
- **Manifest anchors.** Add your subscriber line in `src/manifest.json` right after your own group's last file, so the four patches touch different lines: A after `04o-folders-events.js`, B after `17-song-selection.js`, C after `21-language-detect.js`, D after `07-views.js`. Subscribers only call `on()` at load; the functions they call run later, so position does not matter.
- **Tests are per agent:** `events-<agent>.test.js`, `scenarios-<agent>.js`, `expected/events-<agent>.json`. Nobody edits another agent's file, and `events-wiring.test.js` and `call-sequence-scenarios.js` are frozen.
- **`EVENTS.md`:** each agent adds rows only inside its own section (A, B, C, D headers) of the catalog.
- Apply the four patches in any order; if one fails on `manifest.json`, the fix is moving one line.

## 4. Who does what

Agent A (data and 09/99) already did the harness (`EB-A1`) and the first 09 slice (`EB-A2`). B, C and D can start now.

### Agent A: 41 calls, all handled (A is finished with Plan 1)

| ID | Step | Calls |
|---|---|---|
| EB-A1 | Shared harness, per-agent suites, audit tool, allowlist | done |
| EB-A2 | `09` `confirmDeleteFolder`: remove the duplicate refresh that `folder:listChanged` already does | done |
| EB-A3 | `03j` `changeMusicFolder()` now calls `resetLibraryAfterRebuild()` instead of an inline copy. Only difference from before: one duplicate `updateAllCounts()` is gone; the page DOM after the call is identical | done (8) |
| EB-A4 | `03k` cover scan finished -> `covers:scanCompleted` (subscriber in `04i`) | done (2) |
| EB-A5 | `09`: `removeSongFromPlaylistAndRefresh` -> `playlist:songRemovedFromView` (subscriber in `04k`). `openPlaylist`, `toggleFolderExpandedFromUI`, `closeFolder` are view handlers: kept by `fileExceptions` | done (14) |
| EB-A6 | `99-player.js`: 17 calls are `toggle*Filter` click handlers and the first paint at start-up: kept by `fileExceptions`, none converted | done (17) |

### Agent B: 81 calls

Start with `10c`, `15b`, `15c`, `15d`, `15e`, `10b`, `10d`, `16`: these are "playback state changed". Needs new events such as `playback:started`, `playback:paused`, `queue:songsChanged`, `shuffle:changed`, `repeat:changed`; reuse `queue:changed` and `queue:indexChanged` from the setters where they fit.

| ID | Step | Calls |
|---|---|---|
| EB-B1 | `15e` audio events (play/pause/ended) | 6 |
| EB-B2 | `15b`, `15c`, `15d`, `10b`: shuffle and repeat buttons | 11 |
| EB-B3 | `10c` queue, `10d` song start, `16` context actions | 10 |
| EB-B4 | `17` selection, favorites and counts (`updateHeroSongCount` x11, `updateAllCounts`, `renderFavoritesView`...) | 27 |
| EB-B5 | `13-song-highlight`: **decision, not conversion.** 27 calls to highlight functions inside the virtual-scroll hot path. They are one subsystem split across two agents and run on scroll and hover. B writes up whether they stay direct (allowlist with the reason) and D approves | 27 |

Note for B: playback scenarios need a way to start a song in the headless page (the audio element). If the scenario cannot play, stub `audioElement.play` in the scenario `setup`, and say so in the report.

### Agent C: 42 calls

| ID | Step | Calls |
|---|---|---|
| EB-C1 | Lyrics saved/imported/changed -> one event, e.g. `lyrics:changed { songId }`, replacing the 16 `renderLyricsView` calls in `18`, `11a`, `11b`, `11f`, `08b`, `08g`, `19` | 16 |
| EB-C2 | `08e` settings panel: `setSubheroVisibility`, `updateHeroCover`, `clearAllSelections`. Most are part of entering the settings view; judge each call: view setup (allowlist as navigation) or reaction | 11 |
| EB-C3 | `08h` search panel: `renderSongsList`, `reapplySelectionAfterFilter`: these may be search-result changes -> `search:resultsChanged` | 11 |
| EB-C4 | `19` online lyrics smart-lyrics refresh, `08d`, rest | 4 |

### Agent D: the subscriber side and the gate

D owns the functions being called, so it has no calls to convert, but it protects the app:

| ID | Step |
|---|---|
| EB-D1 | Review each new subscriber file from A, B, C: no per-frame work, no direct state writes, nothing called twice by two subscribers for the same event |
| EB-D2 | Review allowlist changes (add or remove a name) and `EVENTS.md` rows for naming |
| EB-D3 | Look for **duplicate refreshes** like the one EB-A2 removed: places where a subscriber and a leftover direct call both redraw the same thing. `EVENT_BASELINE` makes these visible as repeated names in a recorded sequence |
| EB-D4 | Run the full manual smoke checklist (`tools/smoke-checklist.md`) after each round |
| EB-D5 | Final: `node tools/event-audit.js --strict` exits 0; update `EVENTS.md` and `PLAN.md` section 9 to the real names |

## 5. Order

```
EB-A1 (done)
   |
   +--> A: EB-A3..A6     \
   +--> B: EB-B1..B5      }  in parallel, any order, no waiting between agents
   +--> C: EB-C1..C4     /
   +--> D: EB-D1..D3 as patches arrive
                |
                v
           EB-D4 smoke (you, in the app)  ->  EB-D5 audit = 0  ->  Plan 1 done  ->  start PLAN.md
```

The only waits: D reviews after a patch arrives, and you run the smoke checklist between rounds. B, C and D never wait for A now.

## 6. When Plan 1 ends

- `node tools/event-audit.js --strict` exits 0 and `src/js/core/EVENTS.md` lists every event with owner and subscriber.
- All `events-*.test.js` suites and the older tests pass; the smoke checklist has been run.
- **PLAN.md changes:** A-08 and A-09 are already satisfied, so remove them. Its event names (`playlists:changed`, etc.) are replaced by the real ones. The setters (A-06, A-07) and everything after them become Plan 2.

## 7. What to tell each agent

Give each agent: this file, `src/js/core/EVENTS.md`, `AGENTS.md`, and one line: "You are Agent B. Do EB-B1 to EB-B4 in order, one patch per step, using the slice workflow in section 3 of EVENTBUS-COMPLETION-PLAN.md. Report in tools/agent-reports/."

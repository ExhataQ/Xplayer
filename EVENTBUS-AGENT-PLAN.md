# Event bus plan: splitting the renderer across 4 agents

Companion to PLAN.md section 9. It does not replace it. It answers: is the project separable by agents, where are the seams, and what the bus has to look like for that to work.

Numbers come from `node tools/dep-map.js` run on the current zip (85 files, 969 globals). Static analysis only.

## 1. Verdict

Separable, but not evenly. The split in PLAN.md 9.1 (A, B, C, D by file number) is the right cut. It matches how the files already cluster. The catch is that A is a bottleneck and D is a hub, so the bus has to be built in a specific order or B, C, D will be waiting.

| Agent | Files | Lines | Area |
|---|---|---|---|
| A | 20 | 4.4k | `00`, `01`, `02`, `03*`, `09`, `99` (data, storage, state) |
| B | 15 | 3.6k | `10*`, `13`-`17` (playback) |
| C | 20 | 6.9k | `08*`, `11*`, `12`, `18`-`21` (lyrics, metadata, panels) |
| D | 30 | 8.8k | `04*`-`07` (UI shell, rendering, views) |

D is the biggest by a wide margin. Treat it as two sessions' worth of work per step.

## 2. How coupled the groups are today

Symbol references from one group into another (row uses something defined by column):

| uses → defined in | A | B | C | D |
|---|---|---|---|---|
| A | - | 24 | 12 | 183 |
| B | 847 | - | 17 | 308 |
| C | 503 | 12 | - | 281 |
| D | 632 | 35 | 62 | - |

Writes into another group's globals (155 total): B→A 90, D→A 41, C→A 21, B→D 3.

What this says:

1. **Everyone depends on A** (847 / 503 / 632). That is mostly `00-state`, `99-player`, `STORAGE_KEYS`, `escapeHtml`, `SONGS_DATA`. It is read-heavy and stable. A must finish its contracts first, which is already PLAN.md's order.
2. **Everyone calls D** (A 183, B 308, C 281). These are the "something changed, redraw" calls: `renderLeftPanelMainList`, `renderSongsList`, `updateHeroCover`, `renderPlaylistsView`, `showNotification`, `updateScrollbarById`. This is exactly what the bus removes, and why D-03 (renderers subscribe) is the unlock for A, B and C.
3. **B, C and D almost never touch each other** apart from D. B↔C is 29 references in total. That is the cleanest seam in the project and the main reason 4 parallel agents are viable.
4. **Writes into A's globals (152 of 155)** are the real conflict risk, since two agents could edit the same variable. Phase 1 setters are the fix.

## 3. What the bus has to do for the split to hold

Rule of thumb: **the agent that owns the data emits; D (and sometimes C) subscribes.**

| Direction | Who emits | Who listens | State |
|---|---|---|---|
| Data changed → redraw | A (`03*`) | D (`04*`) | Done for 7 of the 03* files (16 events). `03h` is done in this patch. Left: `03j`, `03k`, `03m` (see section 5). |
| Playback changed → redraw | B (`10d`, `15e`) | D, C | Not started. Needs `song:changed`, `song:started`, `song:ended`, `queue:changed`. |
| Lyrics/settings changed → panels | C (`11a`, `18`, `19`, `08e`) | C panels, D | Not started. |
| View changed | D (`07`) | A, B, C | Not started. Replaces cross-file writes to `currentView`. |

### Naming: the catalog in PLAN.md does not match what was built

PLAN.md Phase 2 lists `playlists:changed`, `favorites:changed`, `history:changed`, `library:changed`. The bus that exists uses `subject:verb` names, one per real reaction:

`recents:added`, `recents:cleared`, `history:added`, `history:cleared`, `pinned:changed`, `folderPin:changed`, `playedOrder:changed`, `playlist:listChanged`, `playlist:deleted`, `playlist:songCountChanged`, `folder:listChanged`, `searchHistory:cleared`, `searchHistory:entryDeleted`, `playbackSetting:changed`, `library:rebuilt`, `data:imported`.

Recommendation: keep the built names. They were created per real call site and are pinned by call-order tests. Update PLAN.md's catalog to say "extend the existing names" and use `<domain>:<pastTenseOrChanged>` for new ones. Also, A-05 expects `core/events.js`; the bus actually lives in `src/js/00b-events.js`. A-05 is mostly done: it only needs `core/EVENTS.md` written from the table above.

### Ownership rules for events

1. An event is **owned by the agent whose file emits it**. Only the owner may change its name or payload. Adding a subscriber never needs the owner.
2. Payload is always one object (`emit(name, { ... })`), read as `e.detail`. Never positional.
3. Subscribers live in a matching `04x-<area>-events.js` (D) or the panel file (C). One `on(...)` per reaction.
4. Emitters never call a render function directly once a subscriber exists. Same-subsystem calls stay plain calls.
5. No per-frame work through the bus (scroll, hover, `timeupdate`).
6. Every converted reaction gets a call-order scenario in `tools/tests/helpers/call-sequence-scenarios.js`, with the expected sequence **measured on the unconverted code first**. This test is what lets four agents work without a human reviewing every render call.

## 4. Order of work

1. **A** finishes the 03* conversion and writes `core/EVENTS.md` (one session). Nobody else can safely add events before the contract exists.
2. **A** adds the setters (A-06). In parallel B, C, D only read.
3. **B, C, D in parallel**, each in own files:
   - B: replace writes (B-02..B-04), then emit playback events (B-05).
   - C: replace writes (C-01), then emit lyrics/settings events (C-02).
   - D: replace writes (D-01, D-02), then add subscribers (D-03).
4. Direct render calls are removed **only after** the subscriber lands: A-09, B-06, D-04. Never in the same patch as adding the subscriber.
5. Phases 3-6 of PLAN.md continue unchanged.

The one hard serial dependency: **D-03 must land before A-09 and B-06**, otherwise removing a direct call leaves nothing redrawing.

## 5. What this slice found for next time

- `03j-library-locations.js` `changeMusicFolder()` contains a ~35-line inline copy of the same reset-and-refresh block that `04i` now handles for `library:rebuilt`. It is not identical (it calls `updateAllCounts()` twice and also writes `currentQueueIndex` / `playbackQueue`), so it must not be merged blindly. Measure it first, then convert it like the others.
- `03k-cover-sync.js` and `03m-library-folder-render.js` are UI files under storage names and stay as they are (decision from the previous session).
- After this patch the 03* set is done except those. A-08/A-09 in PLAN.md are partly already satisfied by it: update BOARD.md accordingly.
- Cross-group writes: B→A is the biggest (90). `10d-playback-song.js` and `10c-playback-queue.js` are the first files B should convert.

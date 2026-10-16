# Engine contract for the new UI, v2 (A-03 audit)

**Status:** Replaces the first version of this file. D10 is unchanged in direction (Option A, compatibility shim) and is amended by D11 to D13 (approved, see `BOARD.md`). Sections 6 and 11 describe the state after patch `engine-contract-and-seek-fix.patch`.
**Author:** Agent A. **Project files changed:** none. All probes ran against a throwaway copy of `Xplayer-main.zip` using the repo's own `tools/tests/helpers/app-fixture.js` (headless Chromium, stubbed `electronAPI`, 20-30 fake songs, 4 generated WAV files for real audio).
**Not run:** Electron itself. Everything below is "true in the fixture build in Chromium". The DOM semantics involved are the same in Electron, but the first A-04 test run should include one Electron pass.

---

## 1. What changed compared with v1

| v1 said | Measured | Consequence |
|---|---|---|
| 25 element IDs | The table in v1 lists 27 rows. The full app (not 27 modules) needs more: **22 specific elements** break boot when missing, plus **27 container-level selectors** that either break boot themselves or contain a required element. | Contract must list the shell's required nesting, not only IDs. |
| "All 27 modules load" proves the playback layer is compatible | The probe loaded 27 files. `15b`, `15c`, `15d`, `15f`, `15g` (which v1 cites as users of the IDs) are **not** in that set. The whole entry (`main.js`) needs `#search-btn`, `#album-art-image`, `#external-scrollbar-thumb`, 5 hero cover elements and `.left-panel-main-list` that v1 does not list. | Full-entry boot probe replaces the 27-module probe as the compatibility proof. |
| `progress-container` is an ID | The engine only queries it as a **class** (`.progress-container`, 5 places in `15f`). No ID lookup exists. | Shell needs the class. The ID is optional. |
| Option B would *introduce* `player:stateChanged`, `queue:changed` | The engine already has an event bus (`core/00b-events.js`, `core/EVENTS.md`) with 38 events, including `playback:stateChanged`, `queue:changed`, `queue:indexChanged`, `queue:songsChanged`, `shuffle:changed`, `lyrics:changed`. | Phase 2 does not need an engine change to give new components something to subscribe to. See section 7. |
| Seek is part of the playback contract | Seek and volume are wired by `data-action-mousedown` **attributes in the HTML**, not by the engine. Seek by mouse was **broken in the supplied build** (fixed by the patch that carries this file, section 6). | The shell must carry the attributes. `tools/tests/seek-volume.test.js` is the guard. |

Also a labelling correction from me: the board defines **A-03 = Shell** and **A-04 = Adapter and DOM-id layer**. In my last message I called the audit "A-03". This document is the A-04a follow-up (contract), not the shell. The shell is still Not started.

---

## 2. Method (so the numbers can be reproduced)

1. **Removal probe** (`removal-probe.js`): build the real app, then for each of 247 candidate selectors (124 template IDs plus 125 selectors the engine passes to `querySelector`/`closest`; 177 exist in the static page), delete the matching nodes before the module scripts run and record uncaught page errors. Baseline (nothing removed): 0 errors. 51 selectors added errors.
2. **Classification** (`classify.js`): a selector is a *leaf* if no other boot-required selector lives inside it, otherwise a *container*. Two of the 51 are generic (`img`, `[data-action]`) and are noise.
3. **Runtime probe** (`runtime-probe.js`): real audio, a `MutationObserver` on `document.body`, and identity tracking of 28 IDs and 2 classes across a 16-step scenario (start queue, pause, resume, next, prev, seek, volume, mute, repeat x3, shuffle dialog, remove from queue, add to queue, auto-advance at end of track, render list, play from row, `library:rebuilt`).
4. **Runtime removal sweep** (`runtime-removal.js`): for the 126 selectors that did not break boot, remove each one before boot and run the same scenario.
5. **Seek check** (`seek-check.js`): real `page.mouse` clicks, not synthetic events, to confirm the defect in section 6.

**Limits of the evidence.** The scenario detects *exceptions*, not wrong results (a step passes if nothing throws). The 120-odd selectors marked "tolerated" are tolerated *for this scenario*. Lyrics, metadata editor, settings, search, and the left-panel library were not exercised (section 9).

---

## 3. Boot-required elements (the shell must provide these or the app does not start)

Removing any of these produces an uncaught error at load and the whole module graph fails.

### 3.1 Leaf elements

| Selector | Tag | Failure when missing | Engine use |
|---|---|---|---|
| `#audio` | `<audio>` | `ontimeupdate` of null | `15e` sets handlers; `00-state` exports it |
| `#play-btn`, `#prev-btn`, `#next-btn`, `#shuffle-btn`, `#repeat-btn` | `<button>` | `onclick` of null | `15a`, `15b`, `15c`, `15d` assign `.onclick` at load |
| `#search-btn` (also found as `.search-btn`) | `<button>` | `onclick` of null | `ui/player-bar.js` assigns `.onclick`. **Not in v1.** |
| `#player-cover` | `<img>` | `src` of null | `core/startup.js`, `10d`, `04i` |
| `#volume-fill`, `#volume-knob`, `#volume-icon` | `<div>` | `style`/`innerHTML` of null | `15g` `updateVolume()` runs at load |
| `#song-list` | `<div>` | `innerHTML` of null | list renderers (`04a`-`04e`) |
| `#queue-list` | `<div>` | `innerHTML` of null | `10c` |
| `#album-art-image` | `<img>` | `src` of null | `08b` (3 places), `player-bar.js`, `06h` fullscreen viewer. **Not in v1.** |
| `#external-scrollbar-thumb` | `<div>` | `updateExternalScrollbar is not defined` | scrollbar widget (`06c`), called from 10 view/render files. **Not in v1.** |
| `#hero-cover-image`, `#hero-cover-svg`, `#hero-cover-svg-heart`, `#hero-cover-svg-history`, `#hero-cover-svg-playlist` | `<img>`/`<svg>` | `style` of null | `04a-ui-render-core` hero setup. **Not in v1.** |
| `.left-panel-main-list` | `<ul>` | `querySelectorAll` of null | left-panel renderers. **Not in v1.** |

### 3.2 Container-level (required, or ancestors of required elements)

Removing these breaks boot. Where the error message names the container itself I have marked it **direct**; the rest may only break because a required leaf lives inside. **Keep the same nesting until each is tested on its own in A-04.**

- **Direct** (error is on the container): `#main-content` (innerHTML), `#song-list-container` (innerHTML), `#right-panel` (innerHTML), `#right-panel-content` (innerHTML), `#queue-content` (innerHTML), `#tags-content` (classList), `#volume-slider` (addEventListener at load), `#left-panel`.
- **Ancestors or unconfirmed:** `.container`, `.content`, `.content-wrapper`, `.content-gradient-wrapper`, `.main-content-inner`, `#left-panel-main-content`, `#external-scrollbar`, `#playlist-hero-section`, `.playlist-hero-cover`, `.panel-content`, `.right-panel-content-wrapper`, `.album-art-container`, `.search-box`, `.player-container`, `.player-left-section`, `.player-center-section`, `.player-right-section`, `.player-song-info`.

`.player-container` and the three `.player-*-section` classes are read by `core/01-sizes.js` (layout code), not only by playback.

---

## 4. Runtime-required elements (boot succeeds, behavior throws)

From the runtime sweep. These do not break boot but throw as soon as a song plays:

| Selector | Failure | Where |
|---|---|---|
| `#player-title` | `textContent` of null on first play | `10c:196`, `10d:58`, `15b:114`, `15e:209` |
| `#player-artist` | `innerHTML` of null on first play | `10c:197`, `10d:59`, `15b:115`, `15e:210` |
| `#current-time`, `#total-time` | `textContent` of null on first play | `00-state`, `15a`, `10d` |
| `#repeat-one` | `style` of null on repeat/shuffle toggle | `15b:28`, `15c:14` |
| `.progress-container` | seek cannot work | `15f` (class query, 5 places) |

**Tolerated for this scenario** (engine guards them, or the code path was not hit): `#progress-bar`, `#progress-knob`, `#lyrics-toggle-btn`, `#subhero-play-btn`, `#search-input`, and about 120 other template elements. Tolerated is not the same as unused; see section 9.

---

## 5. Ownership map: who writes what into the contract elements

Identity result: **none of the 28 tracked IDs or 2 tracked classes was replaced or removed** during the 16-step scenario. The engine mutates these nodes in place, so holding a reference to them is safe *for this scenario*. The exceptions are the two row containers, whose *children* are rebuilt wholesale.

### 5.1 Updated in place by the engine (the new shell owns the element, the engine owns its content and some attributes)

| Element | Engine writes | Other writers in the engine | Shell must |
|---|---|---|---|
| `#play-btn` | `innerHTML` swapped to `<i class="fas fa-play\|fa-pause">`; `aria-label`, `title` | `10c`, `10d`, `15e`, `04i`, `07-views`, `06a`, `11f` (Font Awesome markup) | **Not style it by child structure**, and decide the icon strategy (L-02). Provide `title` via CSS/tooltip system, not static text. |
| `#volume-icon` | `innerHTML` `<i class="fas fa-volume-up\|mute">`; `aria-label`, `title` | `15g` only | Same as play-btn. |
| `#shuffle-btn`, `#repeat-btn` | `classList` toggles `active`; `aria-label` | `15b`, `15c` | Style the `.active` state; do not use `active` for anything else. |
| `#repeat-one` | `style.display` = `block`/`none` | `15b`, `15c` | Must tolerate inline `display`. Do not hide it with `!important`. |
| `#player-title` | `textContent` | `10c`, `10d`, `15b`, `15e`, `04i` reset to "No song selected" | Leave empty; the engine fills it. A **marquee wrapper** (`.marquee-inner`) is injected into it and into `#player-artist` by `06k:249` (4 add/remove cycles in the scenario). |
| `#player-artist` | `innerHTML` (contains `.player-artist-name` spans) | same as title; `player-bar.js` attaches click and contextmenu handlers | Provide one element. Do not pre-fill children. Artist text is **HTML**, so it must be styled as a container. |
| `#player-cover` | `src`, `alt` | `core/startup.js:134`, `04i` | `<img>`. Do not wrap it in something that replaces it. |
| `.player-song-info` | `classList` `has-song` | `10c:195`, `10d:57`, `15e:208`, `04i` | **Unguarded** (`10c` and `10d`): throws if missing. CSS must key empty-state styling off `.has-song`. |
| `#current-time`, `#total-time` | `textContent` | `15a`, `10d` | Plain text elements. |
| `#progress-bar`, `#progress-knob` | `style.width`, `style.left` | `10d`, `15e`, `15f` | Position by percentage only; no `transform`-based layout that fights inline `left`/`width`. |
| `#volume-fill`, `#volume-knob` | `style.width`, `style.left` | `15g` | Same. |
| `#lyrics-toggle-btn` | `disabled`, `data-original-title` | `10d`, `15e`, `18`, `09`, `07-views`, `08e` | Optional; if provided, tooltips must read `data-original-title`. |
| `#subhero-play-btn` | `innerHTML`, attributes | `10d:408`, `07-views` | Optional. |
| `#audio` | `src`, `currentTime`, `volume`, `muted`, `play()`/`pause()` | `15e` (`ontimeupdate`), `15f` (swaps `ontimeupdate` during seek), `15g` | Must be `<audio>`. **No second owner.** |

### 5.2 Rebuilt by the engine (children are created and destroyed; never hold a child reference)

| Container | Children the engine creates | Observed churn |
|---|---|---|
| `#song-list` | `.song-item` rows (with `.song-number-item`, `.now-playing-indicator`, `.add-to-queue-btn[data-song-id]`, `.favorite-btn`, `.song-action-buttons`) | 90 rows removed and re-added in one scenario; 12 childList and 17 attribute mutations on rows |
| `#queue-list` | `.queue-item`, `.queue-lables` (sic), `.next-songs-section`, `.queue-load-more-btn`, `.empty-queue` | 10 add/remove cycles |
| `#left-panel-main-content .left-panel-main-list` | `.left-panel-main-item` | 239 rows rebuilt; 260 childList mutations. **Heaviest churn in the app.** |

### 5.3 Wired by HTML attributes, not by the engine

The engine does not attach these; the old HTML does through `data-action`. The shell must carry them or the control does nothing:

| Element | Attribute | Handler |
|---|---|---|
| `.progress-container` | `data-action-mousedown="startSeek" data-args-mousedown='["$event"]'` | `15f.startSeek` (registered in `07a-ui-actions.js`) |
| `#volume-slider` | `data-action-mousedown="setVolume" data-args-mousedown='["$event"]'` | `15g.setVolume` |

Both are affected by the defect in section 6.

### 5.4 Wired by the engine at load (the shell must not also wire these)

`#play-btn`, `#prev-btn`, `#next-btn`, `#shuffle-btn`, `#repeat-btn`, `#search-btn` get `.onclick =` assigned at load. The shell must not assign `.onclick` or replace the node. Adding `addEventListener` is safe; assigning `.onclick` would silently remove the engine's handler. `#volume-slider` gets a direct `mousedown` listener at load (`15g:229`).

---

## 6. Defects found in the supplied build

D-1 and D-2 are fixed in the patch that carries this file. D-3 is recorded and left alone on purpose.

**D-1. Seeking by mouse did not work and left playback paused (fixed).** Confirmed with real mouse input: with a 6-second track playing, a click at 80% of the seek bar left `currentTime` at 0.75 s, `paused = true`, and threw `Cannot read properties of undefined (reading 'add')` at `15f-controls-progress-seek.js:26`.
- Cause: the HTML uses `data-action-mousedown="startSeek"`. `core/legacy.js` delegates from `document`, so inside the handler `e.currentTarget` is `document`, not the bar (`core/LEGACY.md`, point 2: "Use `this`"). `startSeek` did `e.currentTarget.classList.add('dragging')` after it had already called `audioElement.pause()`.
- Fix (`15f`): look the bar up by `.progress-container`, as the rest of the file already does, **before** pausing, and return if it is missing.

**D-2. Volume click threw a stray error (fixed).** Volume itself worked (the direct listener at `15g` sets it), but the delegated `setVolume` also fired and threw `e.currentTarget.getBoundingClientRect is not a function`.
- Fix (`15g`): `setVolume` reads `#volume-slider` by ID and returns if it is missing. Both listeners then compute the same value, so the double call is harmless. Removing the redundant `data-action-mousedown` attribute is a possible follow-up and is not part of this patch.

**D-3. A volume change during a new track's fade-in is overwritten (not fixed).** A track fades in for about a second (`startFadeIn`, `15g:89`), toward the volume captured when the track started. A click on the volume slider inside that window moves the slider and `window.lastVolume`, but when the fade ends the audio element is set to the old target. Measured: click at 25% at 0.5 s after start gave slider 24%, `audio.volume` 0.5 from then on. A click after the fade works (75% click gave 0.747).
- Not fixed because it is outside the approved scope. `seek-volume.test.js` clicks after the fade and says so in a comment. Whoever fixes it should add a test that clicks during the fade.

The existing 165 tests did not catch D-1 or D-2. They look like fallout from the inline-handler to `data-action` conversion.

---

## 7. The engine already has an event bus (this affects Phase 2, and the adapter size)

`core/EVENTS.md` documents 38 emitted events with rules (naming `subject:verbChanged`, one plain-object payload, **no per-frame events**: `timeupdate`, scroll and hover stay direct). Relevant for the new UI:

| Need | Event that exists today | Payload |
|---|---|---|
| Play/pause state | `playback:stateChanged` (emitted from `10d`, `15e`) | `{ playing }` |
| Queue replaced | `queue:changed` | `{ queue }` |
| Position in queue | `queue:indexChanged` | `{ index }` |
| Queue content edited | `queue:songsChanged` (`10c`) | none |
| Shuffle / repeat | `shuffle:changed`, `shuffle:listChanged`, `repeat:listChanged` | `{ isShuffled }` / none |
| Lyrics changed | `lyrics:changed` | `{ songId }` |
| Library rebuilt | `library:rebuilt` | `{ songs }` |
| Playlists, favorites, pins, recents | `playlist:listChanged`, `favorites:changed`, `pinned:changed`, `recents:added`, ... | various |

`queue:changed`, `queue:indexChanged` and `view:changed` are documented as having no subscribers "on purpose, for Phase 2".

**Consequences.**
1. The v1 framing of Option B ("playback emits events, which changes engine behavior and touches fragile code") is partly out of date. New components can **subscribe** without touching the engine.
2. Time position, buffering and seeking have **no** event by design, so the shell still reads `#audio` directly for the progress UI. That is a small, explicit dependency (L-04).
3. Recommendation: new library and now-playing components read state through events plus the exported state getters, and **never** query `.song-item` or `#song-list`. That is how the "legacy classes must not spread" rule is enforced in practice.

---

## 8. Legacy constraints register

Each entry says what it blocks. Phase 2 replaces an entry only when its "Blocks" column is real.

| ID | Constraint | Accepted for release 1? | Blocks | Rule meanwhile |
|---|---|---|---|---|
| L-01 | Engine renders rows into `#song-list` as `.song-item` / `.song-item.playing` / `.song-number-item`. **`.song-item` is queried by 11 files, not only playback:** `04a`, `04b`, `05a` (virtual scroll), `05c`, `06a` (context menus), `06f` (drag and drop), `17` (selection), `03k` (cover sync), `13`, `14`, `15e` | Yes | Any new song-list layout (B-03): columns, density, row markup. Also context menu, selection and drag-drop behavior on rows | The rule "only the adapter touches these classes" can only apply to **new** code. The 11 existing consumers stay as they are, and B-01 (list map) must cover all of them before B-03 changes row markup. Style via wrapper selectors. |
| L-02 | Engine writes Font Awesome markup (`<i class="fas fa-play">`) into `#play-btn`, `#volume-icon`, and row/panel buttons in 7 files | Yes, for transport | D5 (Lucide). The new look cannot use Lucide in these buttons without a mapping | **Decided (D12): (b)** CSS-map `.fa-play`, `.fa-pause`, `.fa-volume-up`, `.fa-volume-mute` to Lucide glyphs via mask in the shell's stylesheet, for Phase 1. Changing the engine to write a neutral class stays on this register for Phase 2. |
| L-03 | `#player-title` / `#player-artist` receive injected marquee and name wrappers (`06k:249`, `10d:59`) and artist is HTML | Yes | Truncation and typography in the new player bar | Style `.marquee-inner` and `.player-artist-name` as engine output. |
| L-04 | Progress and time are read from `#audio` directly; no event for time | Yes, by design (EVENTS.md rule 4) | Waveform seek (C-02) | One adapter-owned `timeupdate` reader; no other component listens. |
| L-05 | Inline `style` writes (`display`, `width`, `left`) and `.onclick =` assignments on controls | Yes | CSS that needs `!important` or `transform` on those elements | Do not override inline styles; do not assign `.onclick` from new code. |
| L-06 | Seek and volume wired through `data-action` attributes on elements | Yes (D-1/D-2 fixed) | Replacing the seek bar markup | The shell carries the attributes (section 5.3). Guard: `seek-volume.test.js`. |
| L-07 | Layout code (`core/01-sizes.js`) queries `.container`, `.player-*-section`, `#main-content`, `.settings-panel-content`, `.library-location-item` | Yes | Any re-nesting of the shell | Keep these class names and nesting in the shell until `01-sizes` is reviewed. |
| L-08 | The 8 template elements outside the playback layer that break boot (5 hero cover elements, `#album-art-image`, `#external-scrollbar-thumb`, `.left-panel-main-list`) | Yes | A shell that omits panels the old UI has | Provide them, hidden if the design has no use for them. Track each for removal. |
| L-09 | Unguarded `.player-song-info` (`10c:195`, `10d:57`) | Yes | Moving the player bar markup | Keep the class on one persistent element. |

---

## 9. What this contract does **not** cover yet

Same list as v1 section 4, now narrowed by what was measured:

- **Not exercised in any probe:** lyrics (`11*`, `19`, `08c`, `08g`), metadata editor (`20`), settings and panel tabs (`08a`, `08d`, `08e`), search (`08h`), playlists and folders (`09`), drag and drop (`06f`/`06g`), context menus (`06a`), fullscreen viewer (`06h`), keyboard shortcuts (`06k`, which also hosts the marquee).
- **Runtime-created IDs:** about 66 of 167 distinct ID lookups in `src/js/` are not in the template (overlays, modals). Not mapped.
- **Elements tolerated in the scenario but possibly used elsewhere:** `#search-input`, `#progress-bar`, `#progress-knob`, `#lyrics-toggle-btn`.
- **No assertions yet.** The scenario proves "no exception", not "correct result". Section 10 lists the assertions to add.

---

## 10. Behavioral gate for A-04 (adapter is not done until these pass)

Run each against (a) the old UI, to set the baseline, then (b) the new shell. Same scenario script, same assertions. Real audio, real mouse input.

| # | Behavior | Assertion | Baseline today |
|---|---|---|---|
| 1 | Start playback | `audio.src` matches song; `!audio.paused`; `#player-title` text equals title; `.player-song-info.has-song`; `#play-btn` contains `.fa-pause` | No exception (assertions not yet written) |
| 2 | Pause / resume | `audio.paused` flips; icon class flips; `aria-label` flips | No exception |
| 3 | Next / prev | queue index +1 / -1; title changes; `.song-item.playing` moves (old UI) | No exception |
| 4 | Auto-advance at end | after `ended`, next track plays | No exception |
| 5 | **Seek (real mouse)** | click at 80%: `currentTime` within 0.6 s of 80% of duration; **playback state unchanged** | Failed before the patch (D-1). **Covered by `seek-volume.test.js`** |
| 6 | **Volume (real mouse)** | `audio.volume` ≈ click position (after the fade-in, see D-3); `#volume-fill` width matches; **no page error** | Page error before the patch (D-2). **Covered by `seek-volume.test.js`** |
| 7 | Mute / unmute | `audio.muted`; icon class flips; volume restored | No exception |
| 8 | Repeat x3 | `repeatMode` 0, 1, 2; `.active` and `#repeat-one` display match | No exception |
| 9 | Shuffle dialog | mode selected; `isShuffled` set; `.active` on `#shuffle-btn` | No exception |
| 10 | Queue add / remove / empty | queue length changes; `#queue-list` rebuilt; emptying resets `.has-song` and title to "No song selected" | No exception (empty path not exercised) |
| 11 | Identity | the 28 IDs and 2 classes keep node identity through 1-10 | **Passes** |
| 12 | `library:rebuilt` | audio stopped, title reset, cover = placeholder | No exception |
| 13 | **Adapter boundary (new)** | a lint-style test: no file outside `legacy-dom-adapter` references `.song-item`, `.song-number-item`, `#song-list` | n/a |
| 14 | **Adapter size (new)** | adapter stays within 250 lines (D13, code only, no comments or tests); exceeding it is a signal to revisit D10 | n/a |

---

## 11. Decisions (resolved)

| ID | Decision | Status |
|---|---|---|
| D11 | Fix seek and volume in the engine (D-1, D-2), not in the shell | Approved; done in this patch |
| D12 | Engine-written icons: CSS-map the four transport glyphs to Lucide for Phase 1; neutral engine class is a Phase 2 item (L-02) | Approved; applies in A-04 |
| D13 | `legacy-dom-adapter` line budget 250 lines (code only). Over budget means revisit D10 | Approved; applies in A-04 |

---

## 12. Reproducing the audit

The scripts were delivered separately as `xplayer-a03-probes.zip` and are not part of the patch. They need Playwright with Chromium and write only to the OS temp folder and their own directory. Order: `mkwav.js` (test audio), `removal-probe.js`, `classify.js`, `runtime-probe.js`, `runtime-removal.js`, `seek-check.js`. Machine-readable results are in `removal-results.json`, `classified.json`, `ownership.json`, `runtime-removal-results.json`.

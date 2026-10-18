# Report UI-C: playback surfaces (C-01 to C-04 finished)

**Agent:** C  **Date:** 2026-10-17  **Status:** All four C tasks in review. Browser-tested with the real engine; the Electron checklist below is not done.

Earlier parts: `UI-C01-player-bar.md` (player bar styling), `UI-C02-waveform-source.md` (D15 and the waveform module), `research/C-03-queue-map.md`. This report covers everything added on top of the tree that contains A's `player-parts.js`.

## Permission and ownership

You asked C to finish and to answer open questions itself, so C made the decisions below and touched a few files owned by others, with the same precedent as B and D (`library-bridge.js`, `engine-view.js`). Every such edit is listed here; each is small.

| File (owner) | Change |
|---|---|
| `src/ui-next/shell/shell.js` (A) | 2 lines: import `mountPlayback`, call it at the end of `init()` |
| `src/ui-next/adapter/player-parts.js` (A, from C's proposal) | 3 more part names (`volume-fill`, `song-info`, `right-controls`); `src` in the time payload; **bug fix**, see Found |
| `src/ui-next/adapter/playback-bridge.js` (new, adapter) | `mountQueueList`, `refreshQueue`, `readAudioBytes`, `hasCoverArt`. 40 lines; with `engine-view` (58), `library-bridge` (50) and `player-parts` (90) the adapter API files total 238 lines against the 300 of D18 |
| `electron/main.js`, `electron/preload.js` (A) | 1 handler `read-audio-bytes`, 1 preload call `files.readAudioBytes` |
| `src/js/api/desktop-api.js` (engine) | 1 line in the call table (`files.readAudioBytes: 'invoke'`), required by the existing bridge test. No engine behavior changed |
| `tools/tests/desktop-api.test.js` | the name lists and one new test for the new call |

No other engine file, no `src/css/`, no `build/` change.

## What was built

**C-01 controls** (`views/playback/transport.js`)
- Shared tooltips on shuffle, previous, play, next, repeat, mute and lyrics: name, current state (shuffle On or Off; repeat Off, All songs or One song; play and pause follow playback), and the engine's own shortcut (Space, S, R, M, L). Previous and next show none, because the engine has none.
- Seek bar and volume slider are real sliders for assistive technology: role, name, min, max, current value and text ("0:03 of 0:06", "25%", "Muted"), `aria-keyshortcuts` (the engine's arrow keys and Ctrl+Up and Down already do the work). The mute icon became a keyboard-reachable button. The volume tooltip shows the percentage live while dragging.
- The engine's old tooltip system no longer fires on these controls (their `title` attributes are removed as the engine rewrites them).
- Space on a focused player button presses that button. The engine turns Space into play or pause for the whole page, so before this Space on Next toggled play. Fixed in the UI layer without an engine change (the button stops the key at itself).
- "Nothing loaded" dimming now uses a data attribute set from the engine's `.has-song` class instead of `:has()`, because the Electron version is not declared and `:has()` needs Chromium 105.

**C-02 waveform** (`views/playback/seek-waveform.js`, `waveform.js`, `electron/audio-bytes.js`)
- A canvas inside the engine's seek bar draws the waveform of the playing file: amber before the playhead position, quiet color after, smooth while playing, following drags and seeks, redrawn on resize and on theme or accent change. The canvas ignores the pointer, so the engine still handles every press on the bar; the bar grows from 16 to 32 px only while a waveform is shown, and the plain bar returns for any track that has none (loading, over 10 minutes, unreadable, no song).
- Bytes come from the main process: `electron/audio-bytes.js` returns an audio file's bytes (audio extensions only, regular files only, 200 MB limit, urls handled raw because song urls are not percent-encoded: `100% #1.mp3` works). Without the desktop bridge (a plain browser) the page reads the file itself.
- Decoding is one track at a time, waits 300 ms after a track starts (skipping through songs decodes nothing), keeps 200 results in memory, and skips tracks over 10 minutes (about 210 MB decoded). A failed track is not retried on every time event.

**C-03 queue** (`views/playback/queue-panel.js`, `adapter/playback-bridge.js`)
- A queue button in the player opens a drawer above the player. It holds the engine's own queue list (moved in, not rebuilt), so Now Playing, Added to Queue, Next Songs, Load more, shuffle refill, repeat-one and empty cards, row menus and play on click all behave as the engine has them. Rows are restyled; the "more" button's text ("more_horiz") is replaced by drawn dots.
- Keyboard: rows can be focused (tab), played with Enter or Space, moved between with arrows; the menu key opens a row's menu; Escape closes and returns focus to the button; a press outside closes it.
- Volume: slider values and tooltip as above.

**C-04 cover viewer** (`views/playback/cover-viewer.js`)
- A small button appears on the player cover (hover or keyboard focus) when the song has a real cover and opens it large in a dialog with title and artist. Click or Enter on the picture switches fit and actual size; Escape, the close button or the backdrop close it and focus returns to the button. The old viewer's zoom lens is not carried over (decision: the actual-size toggle covers the need and is keyboard-accessible).

## Decisions C took

| Question | Answer |
|---|---|
| D15 waveform source | Renderer decode, bytes through one read-only IPC (already recorded) |
| Where does the queue live | A drawer over the view, above the player, not a new column: the layout in DIRECTION has no right panel |
| Rebuild the queue or reuse it | Reuse the engine's list (S3, as for the library) |
| Space on focused buttons | Fix in the UI for the player's own buttons; engine unchanged; other buttons are A-08 or A-12 |
| Old tooltips | Removed from the player's controls only; the rest is A-08 |
| Zoom lens in the viewer | Not carried over |
| Track length limit for the waveform | 10 minutes |

## Found

1. **A bug in the shared time reader that A applied from C's earlier proposal.** With gapless playback on (the default) the engine swaps between two `<audio>` elements at a track change; the reader's listeners stayed on the idle one, so after the first track change time, play state and any waveform would have gone stale. The old tests never forced a swap. Fixed: the reader follows `window.audioElement`. New test forces a real swap; with the fix disabled it fails.
2. A bug in C's own first version of the waveform view (a track that had been drawn once was not redrawn when you came back to it quickly). Found by the song-change test, fixed.
3. `toggleRightPanel()` and `openImageViewer()` throw in the new shell; not used.
4. Ctrl+Up and Ctrl+Down start from `audioElement.volume`, which includes replay gain, so the step on the slider can differ from 10 points. Engine behavior; not changed.
5. The first version of the `desktop-api` change made `tools/tests/desktop-api.test.js` fail (2 tests), because every preload call must also be in the renderer's table. Fixed; see the table above.

## Checks

Environment: Linux sandbox, Node 22, Playwright 1.56 with headless Chromium, real engine (`tools/tests/helpers/app-fixture.js`), generated WAV files, `electronAPI` stubbed, the real `electron/audio-bytes.js` behind the stub. **Not Electron, not Windows.**

| Test file | Result |
|---|---|
| `ui-next-playback.test.js` (new) | 17 of 17: tooltips and shortcuts, toggle state, no old tooltip and no `title`, slider values, Space on buttons, waveform picture (flat half, tall half, colors, seek, song change and quick skipping, no bridge, refused read), queue drawer styling, row click, keyboard, outside press, manual-add section, empty card, cover button and dialog, fit and actual size, close paths |
| `ui-next-adapter-player.test.js` | 5 of 5 (new: follows a real audio element swap) |
| `ui-next-waveform.test.js` | 9 of 9 (new: decodes one at a time, in order) |
| `audio-bytes.test.js` (new, plain Node) | 8 pass, 1 skipped (Windows drive urls, needs Windows) |
| `desktop-api.test.js` | 12 of 12 |
| `ui-next-player-bar.test.js`, `ui-next-shell.test.js` (gates 13 and 14), `ui-next-library`, `-settings`, `-dialogs`, `-startup`, `-components`, `-components-behavior`, `-tokens`, `-phase1-gate` | all pass, unchanged |
| Whole suite, 75 files, before and after on the same machine | 637 tests pass after; the same 9 files fail before and after (they need `acorn`, not installed here: `drag-drop-modules`, `lint`, `render-modules`, `setters`, `ui-core-render-module`, `ui-handlers`, `ui-views-module`, `ui-virtual-scroll-modules`, `window-contract`). No file got worse |

Mutation checks (disable one piece, the matching tests must fail): waveform mount off (5 tests fail); Space handling off; title removal off; Escape handling off; cover button always visible; slider role off; time reader not following the active element. All were caught and the files restored. The earlier player-bar and waveform mutation checks still hold.

**Not run, please run on your machine:** `npm test`, in particular `lint` and `window-contract`, which need `npm i acorn acorn-walk eslint globals`. Both look at names views use from the engine (`window.updateQueueDisplay`, `window.desktopApi`, `window.audioElement`, `window.PLACEHOLDER_IMAGE`); all four are registered engine globals today, but that is only checked by those two tests.

## Manual checklist (Electron, `--ui=next`)

1. Play a song from the library. Within about a second the seek bar turns into a waveform; the played part is amber and moves smoothly. Click and drag on it: the song jumps, the time label follows the pointer.
2. Play a very long file (over 10 minutes), a corrupt file and a file in a folder with `%` or `#` in its name: the plain bar stays for the first two, the waveform shows for the third. No error in the console.
3. Skip through several songs quickly: no freeze, never a wrong picture for the song that plays. Let a song end into the next one (gapless): the time, play button and waveform carry on.
4. Hover each control for half a second: tooltip with name, state and shortcut; no second, unstyled tooltip at the bottom of the window. Tab to Next and press Space: it skips, it does not pause.
5. Click the queue button: the drawer opens above the player with Now Playing, Added to Queue, Next Songs. Click a row: it plays. Use the three dots on a row: the engine's menu opens above the drawer. Press Escape.
6. Hover the cover in the player: a small expand button; click it: the cover opens large; Escape closes it.
7. Windows screen reader (Narrator or NVDA): the seek bar reads "Seek, 0:12 of 3:45", the volume "Volume, 70%".

## Not done, and why

- The metadata and lyrics views, the library song list and search (B and D tasks).
- The waveform cache across restarts: the hook (`setPeaksStore`) exists; where to keep 1 KB per track is a storage decision for whoever owns `storage-paths.js`.
- Tooltips on every other control and a shared Space rule for all buttons: A-08 and A-12.
- Reduced motion: nothing here animates beyond the playhead, which is the playback position itself.

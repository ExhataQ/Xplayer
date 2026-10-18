# Report UI-C02: waveform source and data (part 1 of C-02)

> **Update 2026-10-17:** the integration, the main-process read (R-C8) and the other C tasks are done; see `UI-C-playback-surfaces.md`. The track length limit is now 10 minutes, not 15.

**Agent:** C  **Date:** 2026-10-17  **Status:** Ready for review. Part 1 only; the manual checklist is not done.

## Decision D15 (taken by C, the owner delegated it)

**Renderer decode with limits**, bytes supplied by one new read-only IPC.

- ffmpeg costs a bundled binary of tens of MB, a licence check on the build (some prebuilt builds are GPL) and a spawn and parse path in the main process. Renderer decode costs nothing to ship, and a 1000-byte result per track is the same either way.
- Limits: tracks over 15 minutes are skipped (decoding holds the whole track as 32-bit PCM), a track is never decoded twice at once, 200 results are kept in memory (1 KB each), a failure returns `null` and is not cached, and the bar then stays plain.
- **Finding that changed the plan:** in the real app a renderer cannot read the file. `fetch()` does not support `file://` (checked: `TypeError: Failed to fetch` in the test browser, which runs with file access allowed), and `electron/` has `contextIsolation: true`, no custom protocol and no IPC that returns file bytes. XMLHttpRequest works in the test browser but I could not check it in Electron, so it is only the default, not relied on. Hence request R-C8.
- Swapping to ffmpeg later changes only where the 1000 bytes come from, not callers.

## Changed files

New: `src/ui-next/views/playback/waveform.js`, `tools/tests/ui-next-waveform.test.js`, this report.
Edited: `.agent/BOARD.md` (D15 row, C-02 row, R-C8, Reports table; no Phase 0 or Phase 1 row).
Not touched: `adapter/`, `shell/`, `components/`, `index.html`, `electron/`, `src/js/`, `src/css/`.

## What `waveform.js` gives

`getPeaks(song)` returns 1000 bytes (0 to 255) or `null`; `computePeaks`; `drawWaveform(canvas, peaks, { progress, played, unplayed })` with colors passed in (the caller reads theme tokens, the file holds no color values); `setBytesReader(fn)` for the app's IPC; `setPeaksStore({ get, set })` for an optional second-level cache; `clearPeaksCache()`.

## Checks (Linux sandbox, Playwright Chromium, real `decodeAudioData`, generated WAV; not Electron)

| Command | Result |
|---|---|
| `node --test tools/tests/ui-next-waveform.test.js` | 8 of 8 pass |
| same, with the cache and in-flight sharing disabled in the module | the cache test fails (7 pass), then the module was restored |
| `ui-next-player-bar` (8), `ui-next-shell` (17) | still pass with the new files present |

Two failures on the first run were bugs in my tests (reading pixels after clearing the canvas; a step in the test signal rings after resampling). Fixed in the tests; the module did not change for them. Test 4 uses a step signal, so it checks "silent first half, loud second half", not exact values.

Not run: lint and other `acorn` tests (no `node_modules`), the full suite, Electron.

## Not done, and why

- Drawing the waveform inside the seek bar and moving it with playback: needs the element hook (R-C4) and the adapter's time reader (R-C3).
- Reading real files in the app: needs R-C8 (main process and `preload.js`, not C's files).
- Persistent cache across restarts: the store hook exists; where to keep it is a storage decision for the owner of `storage-paths.js` (1000 bytes a track, about 10 MB for 10 000 tracks). Without it the waveform is computed again once per track per session.

## Manual checklist (after R-C3, R-C4, R-C8 are in)

1. Play a normal song: the seek bar shows a waveform within about a second; played part in the accent color.
2. Skip through several songs quickly: no freeze, no error in the console, a stale waveform never shows for the next song.
3. Play a very long file (over 15 minutes) and a corrupt file: the plain bar stays, playback is unaffected.
4. Replay a song already played this session: the waveform appears immediately.

# C-02 research: where the waveform comes from

**Status:** Research draft by A, no code changed. The board asks for this report before any waveform code ("Decide source: decode vs precomputed, report first"). Decision needed: D15.

## 1. The question

A waveform seek bar needs about 1000 peak values per track. The app has none today (no waveform code, no decoder dependency; `package.json` has `music-metadata`, `sharp` and `jimp`, none of which decode audio). Where do the peaks come from, and when are they computed?

## 2. What I measured

Test files: generated stereo 44.1 kHz pink noise, 240 s and 600 s, encoded to six formats (the formats `electron/scan-folder.js` accepts: mp3, flac, m4a, aac, ogg, opus). Machine: a **single-core sandbox**, so absolute times are pessimistic and only the comparison is reliable.

**A. Decode in the renderer** (`AudioContext.decodeAudioData`, then a 1000-bin peak pass), headless Chromium:

| File | Decode | Peak pass | PCM held in memory | Process growth |
|---|---|---|---|---|
| mp3 240 s | 1.9 s | 50 ms | 81 MB | about 160 MB |
| mp3 600 s | 3.4 s | 58 ms | **202 MB** | about 160 MB |
| flac 240 s | 0.34 s | 54 ms | 81 MB | about 107 MB |
| ogg 240 s | 0.31 s | 26 ms | 81 MB | small |
| opus 240 s | 1.06 s | 47 ms | 81 MB | about 83 MB |
| m4a (aac) 240 s | **failed** | | | |

The m4a failure is this Chromium build (Playwright's has no proprietary codecs). Electron ships AAC, so this should work in the app, but **I did not verify that**.

**B. Decode in the main process with ffmpeg** (`ffmpeg -ac 1 -ar 8000 -f s16le -`, then peaks in Node):

| File | Wall time | PCM | Node memory |
|---|---|---|---|
| mp3 240 s | 0.60 s | 3.7 MB | 58 MB |
| mp3 600 s | 1.39 s | 9.2 MB | 72 MB |
| flac 240 s | 0.42 s | 3.7 MB | 54 MB |
| ogg 240 s | 0.60 s | 3.7 MB | 59 MB |
| opus 240 s | 0.85 s | 3.7 MB | 60 MB |
| m4a 240 s | 0.65 s | 3.7 MB | 59 MB |

Reading the two tables together: B holds about 20 times less PCM (3.7 MB against 81 MB for the same track), is 2 to 3 times faster for mp3, about the same for opus, **slower than the renderer for flac and ogg** in this test, and is the only one that handled m4a here. I did not compare the peak values the two methods produce. **A cached result is 1000 bytes per track** (one byte per bin), so 10,000 songs is 10 MB.

## 3. Options

| | Where | Needs | Memory | Formats | Works offline | Risk |
|---|---|---|---|---|---|---|
| A | Renderer, when a track starts | nothing new | 80 to 200 MB transient per track; a 10-minute mix doubles it | AAC unverified | yes | memory spikes and a 2 to 3 s delay for mp3 on a slow machine; long tracks could hit limits |
| B | Main process, ffmpeg binary | an ffmpeg binary shipped with the app | small | all | yes | **packaging weight and licence**, an IPC and cache layer |
| C | A first, B as an upgrade | nothing now | as A | as A | yes | two code paths |

**What I have not checked and you should before choosing B:** the size of a bundled ffmpeg (commonly tens of MB per platform) and the licence of the build you would ship (some prebuilt ffmpeg binaries are GPL). I could not install or inspect a candidate package here (no network).

## 4. Recommendation

**B if the packaging cost and licence are acceptable, otherwise A with limits.** Reasons: B removes the memory spike, is the only one verified on m4a and makes a cache natural. Speed is not the argument; it is mixed. If B is not acceptable, A is workable with guards: compute only for the track that is playing or next, skip or downsample above a duration limit (for example 15 minutes), cache the 1 KB result so each track is decoded once, and show a plain bar until the peaks arrive.

Either way the design should be the same, so the choice can be changed later:

- **Cache:** key = song id + file size + modified time; value = 1000 bytes; stored beside the app's other data (path helper in `electron/storage-paths.js`); invalid when the file changes.
- **When:** on demand for the current track, then low-priority background fill for the rest of the queue. Not a full-library scan at start-up (at 0.4 to 1.4 s per track in B, 5000 songs is over an hour of CPU on one core).
- **While waiting:** a flat progress bar identical to today's, then the waveform fades in. Seek must work from the first frame (it already works on the plain bar; D-1 is fixed).
- **API:** one function `getPeaks(songId) -> Promise<Uint8Array | null>` behind the adapter, so the renderer does not know the source. `null` means "no waveform", and the UI keeps the plain bar.
- **Test:** a fixture track with a known shape (silence, loud, silence) and an assertion on the peaks; a test that the cache is reused and invalidated.

## 5. Limits of this research

Synthetic noise stands in for music (decode cost does not depend much on content, but I did not test that). One machine, one core. No Electron run. 1000 bins is my choice; the design may want more or fewer. I did not look at how the player bar would draw it.

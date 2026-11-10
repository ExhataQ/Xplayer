# Audio formats plan (started 2026-11-05)

Why this plan exists: the owner tried a WMA file and it did not play (`NotSupportedError: The element has no supported sources`), M4A worked, and an agent's list of "every audio format" came in with the question *do we need them, where do we stop*. This file holds what was measured, what it means, and the steps. It is separate from `DEV-PLAN.md`; phase 6.1 (Python off) only touches the tag side of it.

## What "supporting a format" means

Four different jobs, and a format can have some and not others: **scan** (the file is added to the library), **play** (the audio element decodes it, and the waveform decodes it), **read tags** (and cover), **edit tags** (and cover). Today one list of extensions in the code answers "scan" for all of them.

## What was measured (2026-11-05)

Method: one 1.5 s file per format made with ffmpeg 6, opened in the real Electron 44 build used for the smoke test (`new Audio(file://...)`, then `play()`, and `decodeAudioData` for the waveform), read with `music-metadata` 11.16 and `node-taglib-sharp` 6.0.3. Electron ships the same Chromium media code on Windows, so the play column holds there too. Not measured: APE (no encoder to make a file), MPC, TAK, DSD, trackers, game formats. Windows has not been re-run; the owner's own report (WMA does not play, M4A does) matches.

| Format | Scanner accepts it today | Plays (and waveform) | Tags read | Tags edit (Node writer) |
|---|---|---|---|---|
| MP3 | yes | **yes** | yes | yes |
| FLAC | yes | **yes** | yes | yes |
| WAV | yes | **yes** | yes | yes |
| M4A / MP4 / M4B (AAC) | yes (M4B no) | **yes** | yes | **yes, since phase 6.1 step 1** |
| AAC (ADTS) | yes | **yes** | yes (files usually have no tags) | not tried (the library opens it) |
| OGG / OGA (Vorbis), Opus | yes (OGA no) | **yes** | yes | yes |
| WMA | yes | **no** | yes | the library can (ASF), the app does not use it yet |
| AIFF / AIF | yes | **no** | yes | the ID3 path is in place, never tried on a real AIFF |
| ALAC (in .m4a) | yes, as "m4a" | **no** | yes | yes (same MP4 path) |
| APE | yes | no (expected, not measured) | `music-metadata` can | no Node writer |
| WV (WavPack) | yes | **no** | yes | no Node writer (the library refuses it) |
| MKA (FLAC or Opus inside) / WebM | no | yes | yes | no (the library fails on it) |
| MP2, TTA, AC3, DTS, Speex, AU, CAF, W64 | no | **no** | MP2, Speex: yes; TTA, AC3, DTS, AU, CAF, W64: no | no |

Python (`mutagen`) never edited the text tags of M4A, WMA, APE or WV, so removing it loses nothing there.

## Findings that matter

1. **The scanner promises more than the player can do.** `.wma`, `.aiff`, `.aif`, `.ape` and `.wv` are in four copies of the extension list (`electron/music-folders.js`, `electron/scan-folder.js`, `electron/ipc-checks.js`, `src/js/library/03j-library-locations.js`; also `src/js/core/startup.js`). Those songs enter the library and then do nothing when played: the audio element has no error handler, so the only trace is an uncaught promise in the console.
2. **ALAC hides behind `.m4a`.** An Apple Lossless file has the same extension as an AAC one and does not play. Only the codec (which `music-metadata` reports) tells them apart.
3. **The waveform has the same limit as playback** (it decodes the file in the renderer), so a format that does not play has no waveform either.
4. **One decoder fixes all the "no" rows at once:** ffmpeg. Chromium's own decoder set cannot be extended without building Electron.

## Do we need all of them? No.

The list from the agent is a checklist of formats that exist, not of what a music library holds. A format earns a place only if the owner has files of it, and each one costs a real test file, scan, play, tag read, and tag edit (or a clear "cannot edit"). Rules for where to stop:

- **In scope (the core):** MP3, FLAC, WAV, M4A/MP4/M4B (AAC and ALAC), AAC, OGG/OGA, Opus, WMA, AIFF/AIF, APE, WV. These are what the scanner already claims.
- **Free once ffmpeg is in, but only added when the owner has such files:** MP2, TTA, MPC, Speex, MKA, W64, CAF, AU. (They decode; they still need a scan entry, a test file and a tag decision each.)
- **Not added:** AC3, EAC3, DTS, TrueHD, MLP (film and DVD surround, not music libraries), AMR and other voice formats, RealMedia, tracker and chiptune formats and MIDI (they are programs, not recordings: a different engine and a different product), game audio containers, DSD/DSF/DFF (only if the owner has SACD rips; needs conversion to PCM), legacy dictation formats. If one of these ever matters, it gets its own task.
- **Tag editing stops at what a Node library can do safely:** MP3, FLAC, OGG/Opus, WAV, AIFF, M4A/MP4/M4B, and WMA after step F3. APE, WV, TTA and MPC stay **read-only**, and the editor says so. A hand-written writer for them would risk people's files for very little.

## How to add playback for the "no" rows

| Option | What it is | Verdict |
|---|---|---|
| A. Honest only | Keep Chromium's list, say clearly what cannot play. | Step F1; always done. |
| B. ffmpeg transcode, cached | The main process runs an ffmpeg binary on first play, writes a FLAC to a cache folder (`cache/transcoded/<hash>.flac`, keyed by path, size and modified time), and the page plays that file. Seeking and the waveform work because it is a whole file. First play of a track waits about a second or two. | **Recommended for F2.** |
| C. Decoders in WebAssembly in the page | One WASM decoder per format; `ffmpeg.wasm` is about 30 MB, slow and memory-hungry. Good decoders exist for few of these formats. | Not recommended. |
| D. A "Convert to FLAC" tool | The person converts their own files on purpose. | Possible later, on request. |

Costs and risks of B: the binary is tens of MB in the portable folder; `ffmpeg-static` is licensed GPL-3.0 (an LGPL build exists; with no release planned this is a note, not a blocker); the cache needs a size limit (for example 2 GB, oldest first) and a "Clear cache" button; the binary is run with `spawn`, so the `runAsNode` fuse and the CSP do not change; `check-dist.js` must learn the binary's path; the Windows CI build is where it is proven.

## Steps

**F1: honest, no new dependency (small, do first).**
- One module, `electron/format-capabilities.js`: for each extension, `{ name, play: 'native' | 'transcode' | 'no', readTags, editTags, editCover }`. The four extension lists above read it; a test fails if they drift apart again.
- At scan, flag songs whose codec cannot play (ALAC, and the extensions marked `no`), so the library can show "cannot play yet" instead of a dead row.
- The player gets an error handler on the audio element: a toast ("Cannot play .wma files yet"), then it skips to the next song instead of sitting silent.
- The metadata editor says "Tags in .ape files cannot be edited" up front, from the same table.
- Tests: the table against the lists, the error path, and the message. No audio files needed.

**F2: play the rest through ffmpeg (needs the owner's go-ahead and a look at the size).**
- `electron/transcode.js` (spawn, cache, size limit), an IPC call the page asks before playing a flagged song, the waveform reading the same cached file.
- Settings > Storage: cache size and a "Clear cache" button; cleared by the same rule that clears peaks.
- Tests on the real files from this study (`tools/dev/make-format-fixtures.js`, ffmpeg needed only to make them), and `npm run smoke` plays a WMA.

**F3: tag editing that is still missing.**
- WMA through the library's ASF tag (a new `asf` kind in `tag-lib-adapter.js` and `tag-rules.js`), with the same copy, write, read back, restore safety.
- AIFF and AAC (ADTS) proven on real files; add them to `tag-parity.test.js`.

**F4: stop.** Anything beyond the core list waits for a file the owner actually has.

## Open questions for the owner

1. Which of WMA, ALAC, AIFF, APE, WV are really in your library? (WMA is: it was the file that failed.) If it is only WMA and ALAC, F2 can start with those and nothing else.
2. Is a bigger portable folder acceptable (the ffmpeg binary)? Is it fine that "cannot play" songs stay in the library, marked, rather than being hidden?
3. Is read-only tag support for APE and WV acceptable?

## What was not done

Nothing in the app changed for this plan; it is findings and steps only. The test files are in the scratchpad of the session that measured them and are not part of the repository.

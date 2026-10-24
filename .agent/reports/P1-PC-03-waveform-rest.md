# Report: PC-03 Waveform, the rest (setting, bar design, delay, saved peaks)

**Task:** PC-03 | **Agent:** C | **Date:** 2026-10-24 | **Status:** In review (not run in Electron or a browser; see Not run)

## Summary
The waveform is now off until turned on in Settings, Playback, Player bar. The bars are smaller and clearer, a track heard before shows its waveform at once from saved peaks, and a new track waits less before decoding.

## Change
- **Setting.** `views/playback/waveform-setting.js` (new): one saved value `xplayer.ui-next.waveform`, default off, with a watcher. `seek-waveform.js` starts or stops at once when it changes (no canvas, no decoding while off). A "Player bar" section with an Off/On switch is added in Settings, Playback (`shell/appearance-settings.js` one line, `shell/settings-layout.js` group titles and summary). `onTime` in `adapter/player-parts.js` got `{ immediate: true }` so turning it on mid-song or while paused draws straight away.
- **Bar design and contrast.** `DESIGN` in `waveform.js`: bars reach 72% of the height, unplayed bars use `--text-tertiary` at 55% instead of `--border-strong`. Computed contrast against the player background: old unplayed 1.4:1, new about 2.6:1 (graphite 2.57, forest 2.61, copper 2.72). Not measured on screen. Drawing is in whole device pixels, so bars stay crisp at 125% and 150% scaling. The canvas fades in (`--motion-fast`), no fade for reduced motion.
- **Saved peaks (DP10 b).** `electron/waveform-peaks.js` (new): one file per track, `<sha1 of key>.bin`, 1 to 4096 bytes, in `<settings folder>/waveform-peaks` (`getPeaksDir` in `storage-paths.js`). Two IPC channels `waveform-peaks:get` and `waveform-peaks:set`, preload `files.getWaveformPeaks` and `files.setWaveformPeaks`, entries in `desktop-api.js`, and `loadSavedPeaks` and `saveSavedPeaks` in `adapter/playback-bridge.js`. The key is only hashed, never a path. Writes go through a temp file and rename. At most 20,000 files; the first save of a run trims to 18,000 oldest-first. **Decision to confirm:** DP10 b says next to the songs data; I used the settings folder so a rebuild of the output folder cannot delete them.
- **Load delay.** `getPeaks(song, { cachedOnly: true })` returns memory or saved peaks without decoding. The seek bar asks that first, with no wait. Only a track with no saved peaks waits `LOAD_DELAY`, now 150 ms (was 300).

## Findings on the delay
`computePeaks` takes 83 ms for a 4-minute stereo track in Node, so the slow parts are the file read over IPC and `decodeAudioData`, neither measured here. Saved peaks remove both for repeat plays. First play of a new track is still a full decode.

## Changed files
| File | Change |
|---|---|
| `src/ui-next/views/playback/waveform-setting.js` | New: setting and Settings section |
| `src/ui-next/views/playback/seek-waveform.js` | Start and stop with the setting, saved peaks first |
| `src/ui-next/views/playback/waveform.js` | `DESIGN`, `cachedOnly`, device-pixel drawing |
| `src/ui-next/views/playback/player-bar.css` | Fade in |
| `src/ui-next/adapter/playback-bridge.js`, `player-parts.js` | Saved peaks calls, `immediate` |
| `src/ui-next/shell/appearance-settings.js`, `settings-layout.js` | Section and group (A's files, small) |
| `electron/waveform-peaks.js` (new), `main.js`, `preload.js`, `storage-paths.js`, `src/js/api/desktop-api.js` | Saved peaks |
| `tools/tests/waveform-peaks.test.js` (new), `ui-next-waveform-setting.test.js` (new), `desktop-api.test.js` | Tests |
| `tools/tests/ui-next-playback.test.js`, `ui-next-settings-layout.test.js` | Waveform switched on for the tests; "Player bar" added to the Playback page |

## Checks
| Command or step | Result |
|---|---|
| `node --test` on the four files `waveform-peaks`, `ui-next-lyrics-translation`, `desktop-api`, `ui-next-waveform-scale` | 44 passed, 0 failed |
| `node tools/tests/run.js unit` | 382 passed, 5 failed, 1 skipped. The same 5 as in the PC-03 scaling report (two scan and album-art tests, `drag-drop-modules`, `lint`, `core/state-*.js setters`) |

## Not run
No Electron and no Playwright here. Browser tests are edited but not run: `ui-next-playback.test.js`, `ui-next-settings-layout.test.js`, and `ui-next-waveform.test.js` (its draw test should still give 67 bars and the same pixels at 1x scale; from reading, not a run). Manual check: turn Waveform on and play (appears; second play of the same song is instant); turn off (plain bar at once); restart keeps the choice; look at the bars on all three themes and the accents.

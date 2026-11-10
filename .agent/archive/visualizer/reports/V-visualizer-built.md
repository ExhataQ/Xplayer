# Audio visualizer: built (V1 to V5)

Date: 2026-11-09. Plan: `.agent/archive/visualizer/VISUALIZER-PLAN.md`. Measurements before the build: `.agent/archive/visualizer/reports/V0-visualizer-spike.md`.

## What it is

Off by default. When it is on and a song plays, bars rise from the bottom edge of the player section (zero) and run edge to edge, behind the controls, in the accent colour (strong at the bottom, faint at the top). Nothing plays, nothing is drawn. Switch it in Settings, Playback, Player bar, or with the bars button at the start of the player's right controls.

## How it works

| Part | File | Job |
|---|---|---|
| Audio bus | `src/js/playback/15h-equalizer.js` | Sources, then the equalizer chain or a bypass, then `tap` (a unity gain), then the speakers. While the visualizer is on, an `AnalyserNode` hangs off `tap` as a side branch whose output goes nowhere, so reading the sound cannot change what is heard. With the visualizer off no analyser exists. Tracks go through the media protocol when the equalizer is on, the visualizer is on, or the elements are already routed (`needsProtocolFor`). `setVisualizerActive(on)`, `getVisualizerAnalyser()`. |
| Bridge | `src/ui-next/adapter/visualizer-bridge.js` | The only door from the views to the two engine functions. |
| Maths | `src/ui-next/views/playback/visualizer-math.js` | Bar count (about one per 11 px), canvas scale cap, log-spaced bin ranges, quiet floor, auto level, log curve, rise and fall, layout, colour parsing. No browser in it. |
| Renderer | `.../visualizer.js` | A canvas behind the controls (`pointer-events: none`), drawn only while seen: setting on, song playing, window visible, animation not reduced. 30 frames per second, drawn at scale 1 at most. Sets `data-viz-playing` on the player section while bars are on screen. Starts again after the page has loaded if the engine's bus was not there yet at mount. |
| Setting | `.../visualizer-setting.js`, row in `shell/appearance-settings.js` | One saved value (`xplayer.ui-next.visualizer`), default off. |
| Quick toggle | `.../visualizer-toggle.js`, icon `visualizer` in `icons/custom-icons.js` | A toggle button (aria-pressed, tooltip On/Off). |
| Song info fade | `.../player-bar.css` | While `data-viz-playing` and the pointer is not over the player section (and nothing in it has focus): the left section slides 48 px left and fades, after a 0.9 s wait. Back at once on hover. Not with less animation. |

## The look of the bars

The sound goes through: the analyser's byte per bin, the maximum per bar's bin range, the quiet floor (0.2, about -75 dB) taken off, the auto level (divide by the loudest bar of the last few seconds, kept for about 5 seconds, never below 0.35), fast rise (0.7 per frame) and quicker fall (0.22), then a mild log curve (boost 4) on the drawn height. Constants are in `DESIGN` in `visualizer-math.js`. The first version had a strong curve (boost 30) and no auto level: with real music every bar sat on the ceiling.

## Tried and removed

A "Compact" width (centred, about 640 px, growing to fill at the window's smallest width). The owner did not like it; code, setting and tests are gone.

## Numbers

- The owner's PC, canvas at scale 1: 3.9 % (screen scale 1.5) and 6.5 % (screen scale 2) of one core at 1920 wide, 30 fps. See the V0 report.
- Real Electron app in a Linux sandbox with a software display (`node tools/dev/bench-visualizer-app.js`, 1 round, 1200 x 800): 15.1 % off, 18.6 % on, 1.7 % on and paused (extra 3.5 %). In that run the analyser read real audio (peak byte 224), the canvas had bars 66 px tall, and the song's time moved.

## Tests

- `tools/tests/audio-bus.test.js`: the bus wiring with a fake Web Audio (every on/off combination, the gapless pair, off and back on, no protocol, Web Audio failing).
- `tools/tests/ui-next-visualizer-math.test.js`: the maths, the settings, the wiring.
- Left side mode and the song-info return (2026-11-09): `leftStripWidth` in the maths, the width setting, and browser tests for the left strip (at 1300 and 900 wide), instant return, delayed leave and the click-focus bug.
- `tools/tests/ui-next-visualizer.test.js` (browser): off by default; the canvas is passive and covers the section; scale cap; frames only while playing; nothing drawn while paused or with less animation; the song info fade; the quick toggle; a real `AnalyserNode` fed with a made-up song at a quiet and a loud level (bars move and are not pinned).

## Found by running the real app

The shell mounts before the engine's modules have run, so with the setting on at start-up the first attempt to start found no audio bus and the visualizer never came up. The renderer now retries once on `load`. The browser tests could not show this (their engine is stubbed after load); the real-app benchmark did.

## What the owner still checks (on Windows, with real music)

1. The sound is unchanged with the visualizer off and on; switching the equalizer on and off with it on never makes a song go silent; gapless still works.
2. Seek, play and volume work as usual.
3. How it looks with real music: if too tame or too jumpy, the numbers are `boost`, `fall`, `gainMin`, `floor` in `DESIGN`.
4. Run `node tools/dev/bench-visualizer-app.js` and send the `.txt` (target: extra about 5 % of one core or less).

## Not done

- Other styles (mirrored bars, a line, the cover colours); the code is built for one style.
- Formats the browser cannot decode (see `FORMATS-PLAN.md`) have no visualizer until they play through the same elements.

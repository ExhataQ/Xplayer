# Audio visualizer plan (written 2026-11-07)

**Status (2026-11-09): built and in use.** V0 to V5 are done; V6 is the real-app measurement, which `tools/dev/bench-visualizer-app.js` does (the owner runs it on Windows). What was built, what changed on the way and why is in `.agent/archive/visualizer/reports/V-visualizer-built.md`. Where this plan and that report differ, the report is right: the plan below is kept as it was written, with the decisions that changed marked under "What changed since".

A separate plan from the polish plan. Source: the owner's request of 2026-11-07, then an investigation of the code (nothing was changed by it).

## What the owner wants

- A visualizer that fills the **whole bottom (player) section**, edge to edge, not a small widget in a corner. The controls stay usable on top of it.
- **Off by default.**
- **One simple style for now:** bars that start at the bottom edge (zero) and grow upward with the sound.
- More styles may come later; the code should make adding one cheap, but only the one style is built now.

## What the investigation found

| Finding | Consequence |
|---|---|
| The only Web Audio chain is the equalizer's (`src/js/playback/15h-equalizer.js`), and it exists only after the equalizer was switched on. With it off, the audio element plays straight to the speakers. | The visualizer needs an `AnalyserNode` on the sound, so there has to be one audio bus that is always used while the visualizer is on. |
| Web Audio is silent for `file://` sources. The equalizer works around it by loading the track through the media protocol (`electron/media-protocol.js`), and an element that went through `createMediaElementSource` cannot be taken out again. | With the visualizer on, every track goes through the protocol, and after the first time the elements stay routed until the app restarts. The same rule the equalizer has; it must be one rule, not two. |
| Two audio elements swap for gapless play; both already feed one chain. | The analyser goes at the end of that chain, after the equalizer, so it shows what is heard. |
| The bottom section is `--player-height: 88px`, the full window width (`.player-host`, laid out by `shell/shell.css`). | The canvas is that size, behind the controls, with `pointer-events: none`. |
| Hardware acceleration is off by decision (`electron/main.js`), so canvas drawing is software. | Cheap drawing only: filled rectangles, no blur or shadow, a frame budget, drawing only while it is seen. Measure before building more. |
| Reusable: the setting pattern of `waveform-setting.js`, the cover colours of `views/library/cover-palette.js`, the reduced-motion rule (`components/motion.js`), the smooth clock of the seek bar. | Less new code, and the same behaviour as the rest of the app. |

## Decisions

1. Off by default; one saved value, like the waveform switch.
2. One style: bars rising from the bottom edge.
3. The visualizer sits **behind** the seek bar, the waveform and the buttons. It does not replace the seek waveform. (Assumption: the owner has not answered this; change it here if wrong.)
4. With less animation on: no moving bars. The switch is still honoured, but it shows nothing animated (a still, dim row of bars, or nothing: decide in V4).
5. Nothing personal is stored; the setting is a localStorage value.

## What changed since (owner's decisions after trying it)

- **Nothing plays, nothing is drawn.** There is no resting baseline any more (decision 4 had a still row or nothing: it is nothing). Paused counts as nothing playing, so the bars fall away. With less animation on, nothing is drawn.
- **Bars follow the music.** A quiet floor, an automatic level (the loudest bar of the last few seconds is the top) and a mild logarithmic curve. A first, stronger curve left every bar on the ceiling with real music.
- **Full width, or a left strip.** A "Compact" width (a centred strip a little wider than the seek bar) was built and removed on the owner's say. Later the owner asked for a **Left side** mode instead: a strip from the left edge to just before the centre column, 30 to 40 % of the section, chosen in Settings ("Visualizer width", default Full width).
- **Song info return.** It comes back instantly on hover and leaves with an animation (900 ms wait, 320 ms fade). Only keyboard focus (`:focus-visible`) keeps it open: a mouse click used to leave a button focused and hold it open until the next click.
- **Quick toggle in the player bar** (a bars icon at the start of the right controls), the same switch as Settings, Playback, Player bar. This answers the open question below.
- **The song info (cover, title, artist, buttons) slides out to the left and fades** while the bars play and the pointer is away from the player section; it comes back at once on hover or keyboard focus. Not with less animation.
- **The canvas draws at scale 1 at most** and CSS stretches it (the measurement of V0 on the owner's PC), at 30 frames per second.

## Packages

| ID | Job | Notes |
|---|---|---|
| V0 | **Spike and measurement.** A throwaway analyser plus a full-width canvas, measured with `tools/dev/measure-states.js` and the GPU-off bench (`tools/dev/bench-gpu.js`) | Gives the cost at the real size (about 1400 x 88 and 1920 x 88). Budget to confirm: a few percent of one core at 30 frames per second. Report the numbers before V1. |
| V1 | **The audio bus.** One chain: sources, then the equalizer or a bypass, then the analyser, then the speakers. The protocol rule becomes "the equalizer is on or the visualizer is on or the elements are already routed" | Touches `15h-equalizer.js` only through its routing functions. Existing equalizer tests must stay green; add tests for the on/off combinations. The sound must be unchanged with the visualizer off (the analyser is not created). |
| V2 | **The renderer.** `views/playback/visualizer.js`: a canvas in the player section, behind the controls. Reads the analyser, maps the frequency bins to about 64 bars on a log scale, smooths with fast attack and slow fall, draws bars from the bottom edge up | Pure functions (bin mapping, smoothing, bar heights) exported and unit-tested without a browser. |
| V3 | **Running only when seen.** Draw only while a song plays, the window is visible and not minimized, and the setting is on; stop the loop otherwise (no timer left running) | A browser test checks that nothing is drawn while paused. |
| V4 | **Look and legibility.** Bars in the accent colour (later: the cover colour), low contrast so the buttons, times and the seek bar stay readable; a gentle fade at the top; the less-animation behaviour of decision 4 | Check in light and dark themes and on a bright accent. No raw colours: tokens only. |
| V5 | **The setting.** An on/off switch in Settings, Playback (next to the waveform switch); the engine and the shell read one function | Default off. A quick toggle in the player bar can come later. |
| V6 | **Tests and checks.** Unit: bin mapping, smoothing, heights, the setting. Browser: the canvas never blocks a click, the seek bar and the buttons work with it on, it stops when paused, it is absent when off. Re-run the equalizer and playback tests. | Run the performance measurement again with the real thing and write the numbers in the report. |

Order: V0, then V1 and V2 together (the renderer can be tried with a fake analyser), then V3, V5, V4, V6.

## Risks

- Routing every track through the media protocol when the visualizer is on: a wrong route means silence. V1 must be tested with the equalizer on and off, with the visualizer on and off, across gapless swaps.
- Software canvas cost on weak machines: V0 decides whether 30 frames per second is allowed, or the bar count has to drop.
- Legibility over bright colours: V4.
- Formats the browser cannot decode (see `FORMATS-PLAN.md`) will not have a visualizer until they play through the same elements.

## Open questions for the owner

- Should it replace the seek waveform in the future, or always sit behind it?
- Later styles to want (mirrored bars, a flowing line, the cover colours)? Not needed now.
- A quick toggle in the player bar, or Settings only? (Answered: both.)

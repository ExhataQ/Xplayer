# Report: the volume control (slider position to audio gain)

**Date:** 2026-11-02 | **Status:** built, tested in Node and in the real app in headless Chromium; not run in Electron on Windows

## Before the change: what was there

**Data flow.** `#volume-slider` (drawn by the engine, and by `adapter/legacy-dom-adapter.js` for the new interface, which only watches it) -> `setVolume(e)` / the mousedown, mousemove and mouseup listeners in `playback/15g-controls-volume-fade.js` -> `updateVolume(fraction)` -> `window.lastVolume` -> `getTargetTrackVolume(song)` -> `audioElement.volume`. The engine is one `HTMLAudioElement`; there is no Web Audio graph, no `GainNode`, and Electron only hosts the page.

**The formula.** `audioElement.volume = clamp(lastVolume * replayGainMultiplier)`: the slider position was the linear amplitude, unchanged. ReplayGain is a multiplier at most 1 (no boost), applied after the slider.

**State.** One slider state, `window.lastVolume` (0 to 1), and `window.lastMutedVolume` (what unmute returns to). Global, not per track. Mute is `updateVolume(0)` (sets `audioElement.muted`); unmute restores `lastMutedVolume`.

**Things that did not match the single state:**
- Persistence did not exist: `core/startup.js` set 0.5 on every launch.
- Ctrl+Up / Ctrl+Down (`ui/06k-keyboard-shortcuts.js`) read `audioElement.volume` back as if it were the slider and passed it to `updateVolume`. With ReplayGain on, the track's gain was fed back as the slider position and the slider drifted.
- The sync editor's own volume slider (`lyrics/11f-sync-editor-volume-save.js`) set `audioElement.volume` directly, read it back, and toggled `muted` on its own: a second, competing control.
- `getTargetTrackVolume` used `baseVolume || 0.5`, so a slider at exactly 0 produced 0.5 (hidden only because `muted` was also set).
- `updateVolume(NaN)` produced NaN.
- No smoothing: every change was one step in the gain. (Fades are smoothed; the slider was not.)

**Why it felt wrong.** In decibels, a linear slider gives: 10 % = -20 dB, 20 % = -14, 50 % = -6, 90 % = -0.9. The first 10 % of the slider moved the level by 20 dB, 90 -> 100 % by 0.9 dB, and the whole top half by only 6 dB. One step at 10 -> 20 % was a 6 dB jump (twice as loud again), one at 80 -> 90 % was 1 dB (barely audible). Only 31 % of the travel lay in the band people listen in (-40 to -10 dB).

## Candidate curves (what each does at each slider position)

| Slider | A linear | p^2 | p^3 | B: dB, -60..0 | **Chosen: dB, -50..0** |
|---:|---:|---:|---:|---:|---:|
| 10 % | -20.0 | -40.0 | -60.0 | -54 | -45 |
| 20 % | -14.0 | -28.0 | -41.9 | -48 | -40 |
| 30 % | -10.5 | -20.9 | -31.4 | -42 | -35 |
| 50 % | -6.0 | -12.0 | -18.1 | -30 | -25 |
| 70 % | -3.1 | -6.2 | -9.3 | -18 | -15 |
| 90 % | -0.9 | -1.8 | -2.7 | -6 | -5 |
| dB per 10 %, at the bottom -> top | 6.0 -> 0.9 | 12 -> 1.8 | 18 -> 2.7 | 6 flat | **5 flat** |
| Slider below -45 dB (inaudible) | 0 % | 7 % | 17 % | 24 % | **9 %** |
| Slider in -40..-10 dB (the listening band) | 31 % | 47 % | 47 % | 50 % | **60 %** |

Power curves (p^2, p^3) fix the top but still change the step size by 6x from bottom to top, and p^3 wastes 17 % of the slider on silence. A -60 dB range is evenly spaced but a quarter of it is dead in an ordinary room. No curve here is "perceptually perfect": loudness also depends on frequency, level and material; this is the practical choice.

## The curve

```
position 0            gain 0               exact silence
position 0 .. 0.05    gain = g(0.05) * position / 0.05      straight ramp to silence, no jump
position 0.05 .. 1    dB = -50 * (1 - position);  gain = 10 ^ (dB / 20)
position 1            gain 1               unity, never above
```

5 dB per 10 % everywhere, 2.5 dB per keyboard step (5 %). One function: `positionToGain` in `src/js/playback/volume-curve.js`. The gain is multiplied by ReplayGain afterwards and clamped to 1, as before.

**Decisions the owner may want to change** (all constants at the top of `volume-curve.js`):
- Range 50 dB (`VOLUME_DB_RANGE`) and the 5 % ramp (`VOLUME_RAMP_POSITION`).
- First-run default 0.8 = -10 dB (`DEFAULT_VOLUME_POSITION`). The old default, gain 0.5, was -6 dB, which is 0.88 on the new slider; 0.8 is a little quieter on purpose.
- Keyboard step 5 % instead of 10 % (a 10 % step is now 5 dB).
- Slider positions saved by nobody (nothing was saved before), so no migration is needed.

## What changed

| File | Change |
|---|---|
| `src/js/playback/volume-curve.js` (new) | the curve, its inverse, the keyboard step, validation of the saved value; pure, no DOM |
| `src/js/playback/15g-controls-volume-fade.js` | slider position is the one state; gain from the curve; 18 ms-constant smoothing of every change (ends exactly on the target, exact 0 for a mute); `nudgeVolume`, `restoreSavedVolume`, `getVolumePosition`; saves 250 ms after the last change and on `pagehide`; robust to NaN |
| `src/js/ui/06k-keyboard-shortcuts.js` | Ctrl+Up / Down call `nudgeVolume` |
| `src/js/lyrics/11f-sync-editor-volume-save.js` | its slider and mute button use `updateVolume` / `toggleMute`, and show the slider position |
| `src/js/core/startup.js` | `restoreSavedVolume()` instead of a fixed 0.5 |
| `src/js/core/00-state.js`, `src/js/main.js` | storage key `volume`; the new module is imported |
| tests | `volume-curve.test.js` (10, Node), `volume-control.test.js` (8, real page); `keyboard-shortcuts`, `playback-modules`, `seek-volume` follow the new mapping |

**Not changed:** the library format, ReplayGain logic, fades and crossfade, the ui-next player bar (it reads the slider and calls the same `updateVolume`), the Electron main process, any dependency.

**Smoothing details.** Skipped (set at once) when no track is loaded, when a fade is running (the fade asks `getTargetTrackVolume` every frame, so it follows the new curve), and when the window is hidden (no animation frames). A mute ramps to exactly 0 and then sets `muted`; an unmute clears `muted` first and ramps up from silence.

## Checks

| Check | Result |
|---|---|
| `node --test tools/tests/volume-curve.test.js` | 10 pass: 0 is exactly 0, 1 is exactly 1, never negative, never above 1, never NaN/Infinity (also for NaN, strings, null, +-Infinity), strictly rising over 10 000 points, 5 dB per 10 %, the inverse is exact, keyboard steps never drift, saved values are validated, listening-band share |
| Real app (headless Chromium, generated WAV), all by real mouse and keyboard | click and drag: gain equals the curve for the slider position; Ctrl+Up/Down: 0.50 -> 0.55 -> 0.45 with matching gain; mute -> gain 0 and `muted`, unmute -> the same position; 0 % -> gain 0, 100 % -> gain 1; track change keeps the volume; a jump 0.2 -> 0.9 rises monotonically over about 100 ms and ends exactly on the target; saved, restored after reload, muted restart keeps the unmute level, change-then-close within 250 ms is kept, five kinds of bad saved value give the default with no error; no page errors |
| `node tools/tests/run.js unit` | 694 pass, 15 fail; the same 15 fail on the untouched zip |

## Not verified, and limits
- `volume-control.test.js` and the three updated browser tests use Playwright for Node, which is not installed here. The same steps were run with Playwright for Python against the built app and gave the results above, but the test files themselves have not been run.
- Not run in Electron, on Windows, with real audio hardware, or by ear. The curve is a reasoned choice, not a listening test.
- `tools/lint-globals.js` and ESLint could not run (no `acorn`); every new name used across files is registered with `registerLegacyGlobals`.
- The sync editor's mini volume slider was changed but not exercised in a browser.
- The slider is still one control for both headphones and loud speakers: with a very high system volume the quietest steps may still be audible, and with a very low one the lowest 10 % may be silent.

## Volume feedback animation (added after the curve)

What the person sees for each slider position, in both interfaces (`volumeLevel` in `volume-curve.js` decides the level; `15g` draws it):

| Level | Slider | Icon | Fill |
|---|---|---|---|
| mute | 0 | speaker with a cross | empty |
| whisper | above 0 to 15 % | speaker alone | 55 % opacity |
| low | up to 50 % | speaker, one wave | 80 % |
| high | 50 % to 100 % | speaker, two waves | full |

- The icon is replaced only when the level changes; then it pops (scale 0.7 -> 1.18 -> 1, 0.28 s), or shakes sideways for a mute. The same level again changes nothing, so a drag does not flicker.
- A small bubble above the knob shows the percentage ("Muted" at 0). It follows the knob, stays while the mouse button is held, and fades 0.9 s after the last change (drag, click, Ctrl+Up/Down, mute button). The knob grows to 1.3x while dragging.
- Start-up (the saved volume being restored) draws the state without animation or bubble (`quiet`).
- `prefers-reduced-motion: reduce`: no pop, shake, knob growth or fades; the icon, fill and number still change.
- The new interface has no Font Awesome, so `legacy-icons.css` draws `fa-volume-down` and `fa-volume-off` from the same Lucide shape as `fa-volume-up` with fewer waves.
- Tests: `volumeLevel` in `volume-curve.test.js`; icon, bubble, animation, fill and reduced motion in `volume-control.test.js` (not run in Node here; the same steps were run with Playwright for Python in both interfaces).

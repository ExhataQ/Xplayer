// ==============================================================================
// VOLUME CURVE
// ==============================================================================
// The one place that turns the volume slider into audio gain. Pure functions, no DOM, no storage: 15g-controls-volume-fade.js uses them
// for the slider, the keyboard and the saved volume, and tools/tests/volume-curve.test.js checks them in Node.
//
// Two numbers must never be mixed up:
//   position  what the person sees and sets: the slider, 0 to 1 (shown as 0 to 100 %), saved between runs, window.lastVolume
//   gain      what goes to the speakers: audioElement.volume, 0 to 1, linear amplitude (1 is the file's own level, never more)
//
// The slider used to be the gain (gain = position). Loudness follows decibels, not amplitude, so on that scale the top half of the slider
// changed the level by only 6 dB while the first 10 % changed it by 20 dB, and about two thirds of the travel sat between -26 dB and 0.
// Now the slider is linear in decibels: every step of the slider is the same step in loudness.
//
//   position 1            gain 1          0 dB     unity, the loudest there is
//   position 0.5          gain 0.056     -25 dB
//   position 0.05 .. 1    dB = -50 * (1 - position)          the same number of dB for every step (5 dB per 10 %)
//   position 0 .. 0.05    a straight ramp from silence up to the gain at 0.05, so the bottom of the slider fades to nothing
//                         instead of falling off a cliff, and the curve has no jump anywhere
//   position 0            gain 0          exactly silent
//
// Why -50 dB and not -60: below about -45 dB music is inaudible in an ordinary room, so a longer range would leave a quarter of the slider
// dead. -50 dB keeps only the bottom 9 % there and puts 60 % of the travel in the band people really listen in (-40 to -10 dB).

export const VOLUME_DB_RANGE = 50; // the straight part of the curve falls this many dB from position 1 (0 dB) towards position 0
export const VOLUME_RAMP_POSITION = 0.05; // below this, the gain ramps linearly to silence
export const DEFAULT_VOLUME_POSITION = 0.8; // first run: -10 dB. (The old default, gain 0.5, was -6 dB: 0.88 here; a little lower is the safer start.)
export const VOLUME_KEY_STEP = 0.05; // one press of Ctrl+Up / Ctrl+Down: 2.5 dB

/** A position as a number from 0 to 1. Anything that is not a finite number is 0 (silent), never NaN. */
export function clampPosition(position) {
    const n = Number(position);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

const decibelGain = (position) => Math.pow(10, (-VOLUME_DB_RANGE * (1 - position)) / 20);

/** Slider position (0 to 1) to gain (0 to 1). The only conversion in the app. */
export function positionToGain(position) {
    const p = clampPosition(position);
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    if (p >= VOLUME_RAMP_POSITION) return decibelGain(p);
    return decibelGain(VOLUME_RAMP_POSITION) * (p / VOLUME_RAMP_POSITION);
}

/** Gain back to slider position (the inverse of positionToGain). */
export function gainToPosition(gain) {
    const g = Number(gain);
    if (!Number.isFinite(g) || g <= 0) return 0;
    if (g >= 1) return 1;
    const rampTop = decibelGain(VOLUME_RAMP_POSITION);
    if (g < rampTop) return (g / rampTop) * VOLUME_RAMP_POSITION;
    return 1 + (20 * Math.log10(g)) / VOLUME_DB_RANGE;
}

/** Gain in decibels (-Infinity for silence). For display and tests. */
export function gainToDb(gain) {
    return gain > 0 ? 20 * Math.log10(gain) : -Infinity;
}

// The look of the volume at each slider position: which speaker icon, and how the slider is drawn (15g, player.css, player-bar.css).
//   mute      0                 the speaker with a cross
//   whisper   above 0 to 15 %   one wave, like low, with the fill drawn dimmer (down to -50 dB: barely there)
//   low       up to 50 %        one wave   (about -25 dB, a quiet room)
//   high      50 % and above    two waves
// Every audible level has at least one curved bar; only mute has none.
export const VOLUME_WHISPER_BELOW = 0.15;
export const VOLUME_HIGH_FROM = 0.5;
export function volumeLevel(position) {
    const p = clampPosition(position);
    if (p <= 0) return 'mute';
    if (p < VOLUME_WHISPER_BELOW) return 'whisper';
    return p < VOLUME_HIGH_FROM ? 'low' : 'high';
}

/** A position moved by `delta` (for the keyboard): stays on whole percents, so repeated presses never drift, and inside 0 to 1. */
export function nudgePosition(position, delta) {
    return clampPosition(Math.round((clampPosition(position) + Number(delta || 0)) * 100) / 100);
}

/**
 * What was saved: { position, restore }. `position` is the slider, `restore` the last audible position (what unmute returns to).
 * Returns null for anything unusable, so the caller falls back to the default.
 */
export function normalizeSavedVolume(saved) {
    if (!saved || typeof saved !== 'object') return null;
    const position = Number(saved.position);
    if (!Number.isFinite(position) || position < 0 || position > 1) return null;
    const restore = Number(saved.restore);
    return { position, restore: Number.isFinite(restore) && restore > 0 && restore <= 1 ? restore : position > 0 ? position : DEFAULT_VOLUME_POSITION };
}

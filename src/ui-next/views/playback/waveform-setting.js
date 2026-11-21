// The waveform on/off setting. Default off: the plain seek bar stays until the person turns the
// waveform on in Settings, Playback. One saved value; seek-waveform.js watches it and starts or stops at once.

const KEY = 'xplayer.ui-next.waveform';

function read() {
    try {
        return localStorage.getItem(KEY) === 'on';
    } catch (_) {
        return false;
    }
}

let enabled = read();
const listeners = new Set();

export const isWaveformOn = () => enabled;

/** Turns the waveform on or off. Saves it, and tells every watcher once. */
export function setWaveformOn(value) {
    const next = value === true;
    if (next === enabled) return;
    enabled = next;
    try {
        localStorage.setItem(KEY, next ? 'on' : 'off');
    } catch (_) {
        /* the choice lasts until the window closes */
    }
    for (const listener of [...listeners]) listener(enabled);
}

/** callback(enabled) on every change. Returns the unsubscribe function. */
export function watchWaveform(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

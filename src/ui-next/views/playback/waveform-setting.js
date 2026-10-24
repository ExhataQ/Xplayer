// The waveform on/off setting (task PC-03, brief 6.3). Default off: the plain seek bar stays until the person turns the
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

/** The Settings row (an On/Off pair of buttons, like the Appearance rows). `el` and `segmented` come from components. */
export function buildWaveformSection({ el, segmented }) {
    const control = segmented({
        label: 'Waveform',
        value: enabled ? 'on' : 'off',
        items: [
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' }
        ],
        onChange: (value) => setWaveformOn(value === 'on')
    });
    const row = el(
        'div',
        { class: 'appearance__row' },
        el('div', { class: 'appearance__label' }, el('div', { class: 'appearance__title' }, 'Waveform'), el('div', { class: 'appearance__hint' }, 'Draw the song as a waveform in the seek bar. Off keeps the plain bar. Long songs (over 10 minutes) always use the plain bar.')),
        control.el
    );
    const section = el('div', { class: 'settings-section appearance', 'data-waveform-setting': '' }, el('div', { class: 'settings-section-title' }, 'Player bar'), row);
    const off = watchWaveform((value) => {
        if (!section.isConnected) return off();
        control.setValue(value ? 'on' : 'off');
    });
    return section;
}

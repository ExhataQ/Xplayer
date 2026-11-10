// The visualizer on/off setting (.agent/archive/visualizer/VISUALIZER-PLAN.md V5). Default OFF. One saved value; visualizer.js watches it and starts or stops at once.

const KEY = 'xplayer.ui-next.visualizer';

function read() {
    try {
        return localStorage.getItem(KEY) === 'on';
    } catch (_) {
        return false;
    }
}

let enabled = read();
const listeners = new Set();

export const isVisualizerOn = () => enabled;

/** Turns the visualizer on or off. Saves it, and tells every watcher once. */
export function setVisualizerOn(value) {
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
export function watchVisualizer(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

// How wide it is. 'full': across the whole player section. 'left': only a strip from the left edge to just before the centre column (the transport
// and seek bar), 30 to 40 % of the width; it sits where the song info slides away (see player-bar.css).
const WIDTH_KEY = 'xplayer.ui-next.visualizer-width';
const WIDTHS = ['full', 'left'];

function readWidth() {
    try {
        const value = localStorage.getItem(WIDTH_KEY);
        return WIDTHS.includes(value) ? value : 'full';
    } catch (_) {
        return 'full';
    }
}

let width = readWidth();
const widthListeners = new Set();

export const getVisualizerWidth = () => width;

export function setVisualizerWidth(value) {
    const next = WIDTHS.includes(value) ? value : 'full';
    if (next === width) return;
    width = next;
    try {
        localStorage.setItem(WIDTH_KEY, next);
    } catch (_) {
        /* the choice lasts until the window closes */
    }
    for (const listener of [...widthListeners]) listener(width);
}

export function watchVisualizerWidth(callback) {
    widthListeners.add(callback);
    return () => widthListeners.delete(callback);
}

// What happens to the song info (the left part of the player) while the bars play: 'hide' slides it away so the bars have the room
// (player-bar.css), 'keep' leaves it where it is.
const INFO_KEY = 'xplayer.ui-next.visualizer-song-info';
function readInfo() {
    try {
        return localStorage.getItem(INFO_KEY) === 'keep' ? 'keep' : 'hide';
    } catch (_) {
        return 'hide';
    }
}
let songInfo = readInfo();
const infoListeners = new Set();
export const getVisualizerSongInfo = () => songInfo;
export function setVisualizerSongInfo(value) {
    const next = value === 'keep' ? 'keep' : 'hide';
    if (next === songInfo) return;
    songInfo = next;
    try {
        localStorage.setItem(INFO_KEY, next);
    } catch (_) {
        /* the choice lasts until the window closes */
    }
    for (const listener of [...infoListeners]) listener(songInfo);
}
export function watchVisualizerSongInfo(callback) {
    infoListeners.add(callback);
    return () => infoListeners.delete(callback);
}

/** The Settings row for the song info (Hide / Keep). */
export function buildVisualizerSongInfoRow({ el, segmented }) {
    const control = segmented({
        label: 'Song info while the visualizer plays',
        value: songInfo,
        items: [
            { value: 'hide', label: 'Hide' },
            { value: 'keep', label: 'Keep' }
        ],
        onChange: (value) => setVisualizerSongInfo(value)
    });
    const row = el(
        'div',
        { class: 'appearance__row', 'data-visualizer-song-info-setting': '' },
        el('div', { class: 'appearance__label' }, el('div', { class: 'appearance__title' }, 'Song info while the visualizer plays'), el('div', { class: 'appearance__hint' }, 'Hide slides the cover and title away while the bars play, and brings them back when the pointer is over the player. Keep leaves them where they are.')),
        control.el
    );
    const off = watchVisualizerSongInfo((value) => {
        if (!row.isConnected) return off();
        control.setValue(value);
    });
    return row;
}

/** The Settings row for the width (Full width / Left side). */
export function buildVisualizerWidthRow({ el, segmented }) {
    const control = segmented({
        label: 'Visualizer width',
        value: width,
        items: [
            { value: 'full', label: 'Full width' },
            { value: 'left', label: 'Left side' }
        ],
        onChange: (value) => setVisualizerWidth(value)
    });
    const row = el(
        'div',
        { class: 'appearance__row', 'data-visualizer-width-setting': '' },
        el('div', { class: 'appearance__label' }, el('div', { class: 'appearance__title' }, 'Visualizer width'), el('div', { class: 'appearance__hint' }, 'Full width spreads the bars across the whole player section. Left side keeps them to a strip from the left edge to just before the transport controls, where the song info slides away.')),
        control.el
    );
    const off = watchVisualizerWidth((value) => {
        if (!row.isConnected) return off();
        control.setValue(value);
    });
    return row;
}

/** The Settings row (an On/Off pair of buttons, like the waveform row). `el` and `segmented` come from components. */
export function buildVisualizerRow({ el, segmented }) {
    const control = segmented({
        label: 'Visualizer',
        value: enabled ? 'on' : 'off',
        items: [
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' }
        ],
        onChange: (value) => setVisualizerOn(value === 'on')
    });
    const row = el(
        'div',
        { class: 'appearance__row', 'data-visualizer-setting': '' },
        el('div', { class: 'appearance__label' }, el('div', { class: 'appearance__title' }, 'Visualizer'), el('div', { class: 'appearance__hint' }, 'Bars that rise from the bottom of the player while a song plays, behind the controls. Off by default. With less animation on they stay still.')),
        control.el
    );
    const off = watchVisualizer((value) => {
        if (!row.isConnected) return off();
        control.setValue(value ? 'on' : 'off');
    });
    return row;
}

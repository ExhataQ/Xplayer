// The visualizer on/off setting. Default OFF. One saved value; visualizer.js watches it and starts or stops at once.

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

// Waveform data and drawing for the seek bar (task C-02, decision D15: decode in the renderer, with limits).
//
// Where the bytes come from: a renderer cannot read an audio file by itself in the real app (fetch() does not support
// file:// at all, and the app runs with web security on). The app supplies a reader with setBytesReader(): a function
// (song) -> Promise<ArrayBuffer>, backed by one read-only IPC in the main process (board request R-C8). Without a reader
// the default one uses XMLHttpRequest, which works in the test fixture and may work in Electron, but is not relied on.
//
// Everything here is independent of the engine and of the adapter: it takes a song object and returns peaks, and it
// draws peaks on a canvas it is given. Placing the canvas in the player and feeding it the playback position is a
// separate step that needs the adapter's time reader (board request R-C3).
//
// getPeaks(song) -> Promise<Uint8Array | null>. One byte per bin, 0..255. null means "no waveform": the caller keeps
// the plain bar. The source can be replaced later (for example by ffmpeg in the main process) without changing callers.

export const BINS = 1000;
export const MAX_SECONDS = 10 * 60; // longer tracks are skipped: decoding holds the whole track as 32-bit PCM (about 210 MB at 10 minutes, stereo, 44.1 kHz)
const MEMORY_LIMIT = 200; // 1 KB each

const memory = new Map(); // key -> Uint8Array, insertion order doubles as least-recently-used order
const pending = new Map(); // key -> Promise, so one track is never decoded twice at once
let reader = readWithXhr;
let decodeQueue = Promise.resolve(); // decodes run one at a time, so skipping quickly never stacks large decodes
let persistent = null; // optional { get(key) -> Uint8Array | null, set(key, bytes) }, supplied by whoever owns storage

/** Supply the function that returns a song's file bytes: (song) -> Promise<ArrayBuffer>. Pass null for the default. */
export function setBytesReader(fn) {
    reader = fn || readWithXhr;
}

export function readWithXhr(song) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', song.url);
        request.responseType = 'arraybuffer';
        request.onload = () => (request.response && request.response.byteLength ? resolve(request.response) : reject(new Error('empty')));
        request.onerror = () => reject(new Error('read failed'));
        request.send();
    });
}

/** Plug in a second-level cache (for example one that lives beside the app's other data). Pass null to remove it. */
export function setPeaksStore(store) {
    persistent = store;
}

export function clearPeaksCache() {
    memory.clear();
    pending.clear();
    decodeQueue = Promise.resolve();
}

const keyOf = (song) => `${song.id}:${Math.round(Number(song.duration) || 0)}:${song.url || song.path || ''}`;

/** channels: Float32Array[] (PCM). Returns `bins` bytes: the loudest absolute sample in each slice, scaled so the loudest bin is 255. */
export function computePeaks(channels, bins = BINS) {
    const length = channels.length ? channels[0].length : 0;
    const peaks = new Float32Array(bins);
    if (length > 0) {
        for (let bin = 0; bin < bins; bin++) {
            const from = Math.floor((bin * length) / bins);
            const to = Math.max(from + 1, Math.floor(((bin + 1) * length) / bins));
            let max = 0;
            for (const channel of channels) {
                for (let i = from; i < to && i < length; i++) {
                    const v = channel[i] < 0 ? -channel[i] : channel[i];
                    if (v > max) max = v;
                }
            }
            peaks[bin] = max;
        }
    }
    const loudest = peaks.reduce((a, b) => (b > a ? b : a), 0);
    const out = new Uint8Array(bins);
    if (loudest > 0) for (let i = 0; i < bins; i++) out[i] = Math.round((peaks[i] / loudest) * 255);
    return out;
}

async function decode(song) {
    const bytes = await reader(song);
    // An offline context decodes without an output device and without the autoplay restriction.
    const context = new OfflineAudioContext(1, 1, 44100);
    const buffer = await context.decodeAudioData(bytes);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    return computePeaks(channels, BINS);
}

function remember(key, peaks) {
    memory.delete(key);
    memory.set(key, peaks);
    while (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value);
}

export function getPeaks(song) {
    if (!song || !song.url) return Promise.resolve(null);
    if (Number(song.duration) > MAX_SECONDS) return Promise.resolve(null);
    const key = keyOf(song);
    if (memory.has(key)) {
        const hit = memory.get(key);
        remember(key, hit);
        return Promise.resolve(hit);
    }
    if (pending.has(key)) return pending.get(key);
    const job = (async () => {
        await decodeQueue.catch(() => {});
        try {
            if (memory.has(key)) return memory.get(key); // finished while this one waited
            const stored = persistent ? await persistent.get(key) : null;
            if (stored && stored.length === BINS) {
                remember(key, stored);
                return stored;
            }
            const peaks = await decode(song);
            remember(key, peaks);
            if (persistent) await persistent.set(key, peaks);
            return peaks;
        } catch (_) {
            return null; // undecodable or unreadable: the bar stays plain; failures are not cached, a later call may retry
        } finally {
            pending.delete(key);
        }
    })();
    decodeQueue = job;
    pending.set(key, job);
    return job;
}

/**
 * Draws `peaks` as centered bars on `canvas`. `progress` is 0..1: bars before it use `played`, the rest `unplayed`.
 * Colors are passed in (read from the theme tokens by the caller), so this file holds no color values.
 * Returns the number of bars drawn.
 */
export function drawWaveform(canvas, peaks, { progress = 0, played, unplayed, barWidth = 2, gap = 1, minBar = 2 } = {}) {
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || canvas.width / ratio;
    const cssHeight = canvas.clientHeight || canvas.height / ratio;
    const width = Math.max(1, Math.round(cssWidth * ratio));
    const height = Math.max(1, Math.round(cssHeight * ratio));
    if (canvas.width !== width) canvas.width = width; // assigning the size clears and reallocates the canvas: only when it changed
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    if (!peaks || !peaks.length) return 0;
    const count = Math.max(1, Math.floor((cssWidth + gap) / (barWidth + gap)));
    const split = Math.max(0, Math.min(1, progress)) * count;
    for (let bar = 0; bar < count; bar++) {
        const from = Math.floor((bar * peaks.length) / count);
        const to = Math.max(from + 1, Math.floor(((bar + 1) * peaks.length) / count));
        let value = 0;
        for (let i = from; i < to; i++) if (peaks[i] > value) value = peaks[i];
        const height = Math.max(minBar, (value / 255) * cssHeight);
        ctx.fillStyle = bar < split ? played : unplayed;
        ctx.fillRect(bar * (barWidth + gap), (cssHeight - height) / 2, barWidth, height);
    }
    return count;
}

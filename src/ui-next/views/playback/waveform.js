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

// Bump when the meaning of the stored bytes changes, so peaks saved by an older scaling are never reused.
export const PEAKS_VERSION = 2;
const keyOf = (song) => `v${PEAKS_VERSION}:${song.id}:${Math.round(Number(song.duration) || 0)}:${song.url || song.path || ''}`;

// Contrast scaling (task PC-03). The first version took the loudest single sample in each slice and divided by the loudest
// slice. Loud, compressed music has a peak near full scale almost everywhere, so nearly every bar came out near full height.
// Now each slice is its average level (RMS, which follows loudness rather than single spikes), and the track is stretched
// between its quiet floor and its loud ceiling, so every song uses the whole height whatever its mastering level.
export const FLOOR_PERCENTILE = 0.1; // slices at or below this level of the track draw as the shortest bar
export const CEILING_PERCENTILE = 0.95; // slices at or above this level draw at full height; a few loud spikes do not squash the rest
export const MIN_SPAN = 0.25; // the floor-to-ceiling distance is never smaller than this share of the ceiling, so a flat or noisy track is not exaggerated
export const CURVE = 1.15; // above 1 keeps mid levels a little lower than a straight line, so loud parts stand out

const percentile = (sorted, share) => {
    const at = (sorted.length - 1) * share;
    const low = Math.floor(at);
    const high = Math.min(sorted.length - 1, low + 1);
    return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
};

/** channels: Float32Array[] (PCM). Returns `bins` bytes: the average level (RMS) of each slice, stretched between the track's quiet floor and loud ceiling (see above), 0..255. */
export function computePeaks(channels, bins = BINS) {
    const length = channels.length ? channels[0].length : 0;
    const levels = new Float32Array(bins);
    if (length > 0) {
        for (let bin = 0; bin < bins; bin++) {
            const from = Math.floor((bin * length) / bins);
            const to = Math.max(from + 1, Math.floor(((bin + 1) * length) / bins));
            let sum = 0;
            let count = 0;
            for (const channel of channels) {
                for (let i = from; i < to && i < length; i++) {
                    sum += channel[i] * channel[i];
                    count++;
                }
            }
            levels[bin] = count ? Math.sqrt(sum / count) : 0;
        }
    }
    const sorted = Float32Array.from(levels).sort();
    const ceiling = percentile(sorted, CEILING_PERCENTILE);
    const out = new Uint8Array(bins);
    if (!(ceiling > 0)) return out; // silence: all zero
    const floor = percentile(sorted, FLOOR_PERCENTILE);
    const span = Math.max(ceiling - floor, ceiling * MIN_SPAN);
    for (let i = 0; i < bins; i++) {
        const unit = Math.min(1, Math.max(0, (levels[i] - floor) / span));
        out[i] = Math.round(Math.pow(unit, CURVE) * 255);
    }
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

// A saved copy (see setPeaksStore) that has the right size, put into memory; null when there is none or the store fails.
async function readStored(key) {
    if (!persistent) return null;
    try {
        const stored = await persistent.get(key);
        if (!stored || stored.length !== BINS) return null;
        remember(key, stored);
        return stored;
    } catch (_) {
        return null;
    }
}

function remember(key, peaks) {
    memory.delete(key);
    memory.set(key, peaks);
    while (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value);
}

/**
 * Peaks for `song`, or null (no waveform). With { cachedOnly: true } nothing is decoded: the answer is the peaks already in
 * memory or saved on disk, or null. The seek bar asks that way first, so a track heard before shows its waveform at once
 * and only a new track waits for the (slow) decode.
 */
export function getPeaks(song, { cachedOnly = false } = {}) {
    if (!song || !song.url) return Promise.resolve(null);
    if (Number(song.duration) > MAX_SECONDS) return Promise.resolve(null);
    const key = keyOf(song);
    if (memory.has(key)) {
        const hit = memory.get(key);
        remember(key, hit);
        return Promise.resolve(hit);
    }
    if (cachedOnly) return readStored(key);
    if (pending.has(key)) return pending.get(key);
    const job = (async () => {
        await decodeQueue.catch(() => {});
        try {
            if (memory.has(key)) return memory.get(key); // finished while this one waited
            const stored = await readStored(key);
            if (stored) return stored;
            const peaks = await decode(song);
            remember(key, peaks);
            if (persistent) {
                try {
                    await persistent.set(key, peaks);
                } catch (_) {
                    /* a failed save only means the next play decodes again; the peaks just decoded are still good */
                }
            }
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

// The look of the bars in the seek bar (task PC-03, brief 6.2). Kept in one place so it can be tuned by eye.
//   - narrower than the bar, so the tallest bar stops short of the edges instead of filling the whole height;
//   - the unplayed bars use the tertiary text color at 55% instead of the old border color. The border color was 1.4:1 against the
//     player background (the bars were nearly invisible); this is about 2.6:1 on all three themes and keeps the played (accent) bars
//     clearly apart, because they are full strength.
export const DESIGN = Object.freeze({ barWidth: 2, gap: 1, minBar: 2, heightShare: 0.72, unplayedAlpha: 0.55 });

/**
 * Draws `peaks` as centered bars on `canvas`. `progress` is 0..1: bars before it use `played`, the rest `unplayed`.
 * Colors are passed in (read from the theme tokens by the caller), so this file holds no color values.
 * Returns the number of bars drawn.
 */
export function drawWaveform(canvas, peaks, { progress = 0, played, unplayed, unplayedAlpha = 1, barWidth = 2, gap = 1, minBar = 2, heightShare = 1 } = {}) {
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || canvas.width / ratio;
    const cssHeight = canvas.clientHeight || canvas.height / ratio;
    const width = Math.max(1, Math.round(cssWidth * ratio));
    const height = Math.max(1, Math.round(cssHeight * ratio));
    if (canvas.width !== width) canvas.width = width; // assigning the size clears and reallocates the canvas: only when it changed
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); // everything below is in device pixels, so bars are whole pixels at any display scaling (125%, 150%)
    ctx.clearRect(0, 0, width, height);
    if (!peaks || !peaks.length) return 0;
    const bar = Math.max(1, Math.round(barWidth * ratio));
    const pitch = bar + Math.max(1, Math.round(gap * ratio));
    const count = Math.max(1, Math.floor((width + pitch - bar) / pitch));
    const split = Math.max(0, Math.min(1, progress)) * count;
    const room = Math.max(1, Math.round(height * heightShare));
    const least = Math.max(1, Math.round(minBar * ratio));
    for (let index = 0; index < count; index++) {
        const from = Math.floor((index * peaks.length) / count);
        const to = Math.max(from + 1, Math.floor(((index + 1) * peaks.length) / count));
        let total = 0;
        for (let i = from; i < to; i++) total += peaks[i];
        const value = total / (to - from); // the average of the bins in this bar; the maximum would push every bar toward full height
        let tall = Math.min(height, Math.max(least, Math.round((value / 255) * room)));
        if ((height - tall) % 2 !== 0 && tall < height) tall += 1; // an even gap above and below keeps the bar centered
        ctx.globalAlpha = index < split ? 1 : unplayedAlpha;
        ctx.fillStyle = index < split ? played : unplayed;
        ctx.fillRect(index * pitch, (height - tall) / 2, bar, tall);
    }
    ctx.globalAlpha = 1;
    return count;
}

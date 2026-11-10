// ==============================================================================
// PLAYBACK - THE SILENT EDGES OF A TRACK (gapless)
// ==============================================================================
// Lossy files start and end with a little silence the encoder added (MP3 and AAC: up to about 50 ms), and the audio element plays it. Between two
// tracks that is a gap no matter how exactly the next one is started. So each track is read once, decoded at a low rate (the same cheap way the waveform does it:
// 8 kHz, about 19 MB of floats for five minutes of stereo, freed at once), and the silence at its two ends is measured. The early start of the next
// track (10c-playback-queue.js) then counts that silence in: it begins the next track early by the silence at the end of this one plus the
// silence at the start of that one.
//
// Only up to EDGE_MAX_MS is ever counted at each end, so a silence an artist put there on purpose (a live album's pause) is not swallowed;
// the encoder's padding is shorter than that.
//
// peekTrackEdges(song) answers at once from memory and starts the measuring in the background when it does not know the track yet.

export const EDGE_MAX_MS = 60;
export const EDGE_LEVEL = 0.001; // about -60 dB: the padding is far below this, music is far above it
export const DECODE_RATE = 8000;
const MAX_BYTES = 60 * 1024 * 1024; // a file bigger than this is a long recording: it is not decoded, and its edges count as 0
const MEMORY_LIMIT = 300;

const NOT_KNOWN = Object.freeze({ headMs: 0, tailMs: 0, measured: false });
const memory = new Map(); // url -> { headMs, tailMs, measured }, insertion order doubles as least-recently-used order
const pending = new Map(); // url -> Promise, so one track is never measured twice at once
let queue = Promise.resolve(); // one decode at a time, so skipping quickly never stacks decodes

/** The silence at the start and at the end of a track, in ms, each at most maxMs. `channels` are Float32Arrays. Pure. */
export function silenceAtEdges(channels, sampleRate, { maxMs = EDGE_MAX_MS, level = EDGE_LEVEL } = {}) {
    const length = channels && channels.length ? channels[0].length : 0;
    if (!length || !(sampleRate > 0)) return { headMs: 0, tailMs: 0, measured: false };
    const limit = Math.min(length, Math.round((sampleRate * maxMs) / 1000));
    const quiet = (frame) => {
        for (const channel of channels) if (Math.abs(channel[frame]) > level) return false;
        return true;
    };
    let head = 0;
    while (head < limit && quiet(head)) head++;
    if (head >= length) return { headMs: 0, tailMs: 0, measured: false }; // silent from end to end: nothing to say about its edges
    let tail = 0;
    while (tail < limit && quiet(length - 1 - tail)) tail++;
    return { headMs: (head / sampleRate) * 1000, tailMs: (tail / sampleRate) * 1000, measured: true };
}

function remember(url, edges) {
    memory.delete(url);
    memory.set(url, edges);
    while (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value);
    return edges;
}

async function readBytes(url) {
    const api = typeof window !== 'undefined' ? window.desktopApi : null;
    if (!api || !api.supports('files.readAudioBytes')) return null;
    const result = await api.files.readAudioBytes(url);
    return result && result.success && result.data && result.data.byteLength <= MAX_BYTES ? result.data : null;
}

async function measure(url) {
    const bytes = await readBytes(url);
    if (!bytes) return NOT_KNOWN;
    // An offline context decodes without an output device and without the autoplay restriction.
    const context = new OfflineAudioContext(1, 1, DECODE_RATE);
    const buffer = await context.decodeAudioData(bytes);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    return silenceAtEdges(channels, buffer.sampleRate);
}

/** Measures `song` (once) and resolves its edges; never rejects: a track that cannot be read counts as having no silent edges. */
export function requestTrackEdges(song) {
    const url = song && song.url;
    if (!url) return Promise.resolve(NOT_KNOWN);
    if (memory.has(url)) return Promise.resolve(memory.get(url));
    if (pending.has(url)) return pending.get(url);
    const job = queue
        .catch(() => {})
        .then(() => (memory.has(url) ? memory.get(url) : measure(url)))
        .catch(() => NOT_KNOWN)
        .then((edges) => {
            pending.delete(url);
            return memory.has(url) ? memory.get(url) : remember(url, edges);
        });
    queue = job;
    pending.set(url, job);
    return job;
}

/** What is already known about `song`'s edges, or null; asking also starts the measuring so the next ask knows. */
export function peekTrackEdges(song) {
    const url = song && song.url;
    if (!url) return null;
    const hit = memory.get(url);
    if (hit) return hit;
    requestTrackEdges(song);
    return null;
}

/** Records edges that are already known (measured elsewhere, or loaded from a saved copy). */
export function rememberTrackEdges(url, edges) {
    if (url) remember(url, { headMs: Number(edges.headMs) || 0, tailMs: Number(edges.tailMs) || 0, measured: true });
}

export function clearTrackEdges() {
    memory.clear();
    pending.clear();
    queue = Promise.resolve();
}

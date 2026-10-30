// playback-bridge (tasks C-02 and C-03): the one place the playback views touch the engine's queue list and the desktop
// API. Views outside adapter/ must not look up engine elements or call engine globals (register L-01), so it is here.
// Like library-bridge.js this is a small early part of the adapter API planned in task A-04c; A may fold it into
// store and actions.

/** Moves the engine's queue list into `target` (the node keeps its identity) and asks the engine to draw it. */
export function mountQueueList(target) {
    const list = document.getElementById('queue-list');
    if (!list) return false;
    if (list.parentNode !== target) target.append(list);
    refreshQueue();
    return true;
}

/** Redraws the queue list; the engine may have drawn it while it was hidden. */
export function refreshQueue() {
    if (typeof window.updateQueueDisplay === 'function') window.updateQueueDisplay();
}

/**
 * The bytes of the audio file at `fileUrl` through the main process (electron/audio-bytes.js).
 * Resolves { success: true, data: ArrayBuffer } or { success: false, reason }, or null when this page has no desktop
 * bridge (a plain browser), in which case the caller may read the file another way.
 */
export async function readAudioBytes(fileUrl) {
    const api = window.desktopApi;
    if (!api || !api.supports('files.readAudioBytes')) return null;
    try {
        const result = await api.files.readAudioBytes(fileUrl);
        return result && typeof result === 'object' && typeof result.success === 'boolean' ? result : null;
    } catch (_) {
        return null;
    }
}

/**
 * Saved waveform peaks (electron/waveform-peaks.js). Both return quietly when there is no desktop bridge or the call fails:
 * a missing saved copy only means the track is decoded again. `key` is the cache key the waveform builds; `bytes` a Uint8Array.
 */
export async function loadSavedPeaks(key) {
    const api = window.desktopApi;
    if (!api || !api.supports('files.getWaveformPeaks')) return null;
    try {
        const result = await api.files.getWaveformPeaks(key);
        return result && result.success && result.data ? new Uint8Array(result.data) : null;
    } catch (_) {
        return null;
    }
}

export async function saveSavedPeaks(key, bytes) {
    const api = window.desktopApi;
    if (!api || !api.supports('files.setWaveformPeaks')) return false;
    try {
        const result = await api.files.setWaveformPeaks(key, bytes);
        return Boolean(result && result.success);
    } catch (_) {
        return false;
    }
}

/** True when `src` is a real cover picture, not the engine's placeholder or the empty one the adapter starts with. */
export function hasCoverArt(src) {
    if (!src || src.startsWith('data:image/gif;base64,R0lGODlhAQABAAAAACH5')) return false;
    return typeof window.PLACEHOLDER_IMAGE === 'string' && window.PLACEHOLDER_IMAGE ? src !== window.PLACEHOLDER_IMAGE : true;
}

/**
 * The song that is playing, with its lyrics, for the right panel (PC-13): { id, title, artist, instrumental, plain, synced }
 * where `synced` is the parsed timed lines [{ time, text, instrumental }] or null, and `plain` is the text or ''.
 * null when nothing is playing. Read only; it never changes the engine's own lyrics page.
 */
export function currentLyrics() {
    const queue = window.playbackQueue;
    const index = window.currentQueueIndex;
    const item = Array.isArray(queue) && index >= 0 ? queue[index] : null;
    const song = item && (item.song || item);
    if (!song) return null;
    const plain = typeof window.getLyricsForSong === 'function' ? String(window.getLyricsForSong(song) || '').trim() : '';
    const lrc = typeof window.getSyncedLyricsForSong === 'function' ? window.getSyncedLyricsForSong(song) : null;
    const synced = lrc && typeof window.parseLRC === 'function' ? window.parseLRC(lrc) : null;
    return { id: song.id, title: String(song.title || ''), artist: String(song.artist || ''), instrumental: song.instrumental === true, plain, synced };
}

/** Moves the playing song to `seconds` (a click on a synced line). */
export function seekTo(seconds) {
    const audio = window.audioElement;
    if (audio && Number.isFinite(seconds)) audio.currentTime = Math.max(0, seconds);
}

/**
 * The playing song's two covers: `small` is the 160px square thumbnail the player bar shows, `large` the full-size cover file
 * (the engine's `largeCover`, which the old big picture mode and the old album art used). Either may be '' when the song has none;
 * `large` falls back to `small`, as the engine does.
 */
export function currentCover() {
    const queue = window.playbackQueue;
    const index = window.currentQueueIndex;
    const item = Array.isArray(queue) && index >= 0 ? queue[index] : null;
    const song = item && (item.song || item);
    if (!song) return null;
    const text = (value) => (typeof value === 'string' ? value.trim() : '');
    const small = text(song.cover);
    return { small, large: text(song.largeCover) || small };
}

/**
 * The song that will play after the current one, for decoding its waveform ahead of time: { url, duration } or null. It follows
 * the engine's own gapless rule: the next entry of the queue, or the first one when the queue ends under repeat all
 * (`repeatMode === 1`). `url` is the absolute form the audio element reports as its `src`, so a waveform made ahead is found
 * again by the seek bar.
 */
export function nextSongForWaveform() {
    const queue = window.playbackQueue;
    const index = window.currentQueueIndex;
    if (!Array.isArray(queue) || !(index >= 0) || !queue.length) return null;
    const nextIndex = index < queue.length - 1 ? index + 1 : window.repeatMode === 1 ? 0 : -1;
    const item = nextIndex >= 0 ? queue[nextIndex] : null;
    const song = item && (item.song || item);
    if (!song || typeof song.url !== 'string' || !song.url) return null;
    let url = song.url;
    try {
        url = new URL(song.url, document.baseURI).href;
    } catch (_) {
        /* keep the raw url */
    }
    return { url, duration: Number(song.duration) || 0 };
}

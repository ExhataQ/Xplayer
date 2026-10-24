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

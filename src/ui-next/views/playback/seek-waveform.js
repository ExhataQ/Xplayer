// The waveform inside the seek bar (task C-02, reworked in PC-03). The engine still owns seeking: a press on the bar is handled by the
// engine exactly as before, because the canvas is a passive picture over the bar (pointer-events: none) and the bar
// keeps its size rules. This only draws, from peaks (waveform.js) and the playback position (adapter/player-parts.js).
//
// While no waveform is available (turned off in Settings, loading, no song, a track over the length limit, an unreadable file) the
// plain bar stays exactly as it was. The waveform is off until the person turns it on (waveform-setting.js); turning it on or off
// takes effect at once, with no restart.
//
// Speed (brief 6.1, reworked in PC-03 after the delay was still seen). Four things, cheapest first:
//   1. A track heard before shows its waveform at once: saved peaks (memory, then the file in the settings folder).
//   2. The next song in the queue is decoded ahead of time, a moment after the current waveform is up (PREFETCH_DELAY), so a song
//      that plays on from the one before has its waveform at the first time event.
//   3. A new song is decoded at 8 kHz (waveform.js), several times less data than before, and a song that was left while it
//      waited its turn is never decoded.
//   4. The old waveform stays on the bar, dimmed and at rest, until the new one is ready (it is not blanked on a change), so
//      the bar does not flash plain between two songs. It is dropped after HOLD_MS if the new one is not ready by then.
// Only a track with no saved peaks waits LOAD_DELAY before it is decoded, so skipping through songs never starts a decode for a
// song that is left at once.

import { playerPart, onTime } from '../../adapter/player-parts.js';
import { readAudioBytes, loadSavedPeaks, saveSavedPeaks, nextSongForWaveform } from '../../adapter/playback-bridge.js';
import { getPeaks, prefetchPeaks, drawWaveform, setBytesReader, setPeaksStore, readWithXhr, MAX_SECONDS, DESIGN } from './waveform.js';
import { isWaveformOn, watchWaveform } from './waveform-setting.js';

const LOAD_DELAY = 150; // ms before a track with no saved peaks is decoded (was 300; the decode itself is the slow part)
const PREFETCH_DELAY = 1500; // ms after the current waveform is settled before the next song is decoded ahead, so it never competes with a start
const HOLD_MS = 3000; // how long the previous waveform stays dimmed while the new one is made
const HOLD_ALPHA = 0.5; // the dimmed waveform's bars are drawn at this share of their usual strength

export function mountSeekWaveform() {
    const seek = playerPart('seek');
    const fill = playerPart('seek-fill');
    if (!seek) return () => {};

    // The main process reads the file (electron/audio-bytes.js). Without it (a plain browser) the page reads it itself.
    setBytesReader(async (song) => {
        const result = await readAudioBytes(song.url);
        if (result === null) return readWithXhr(song);
        if (!result.success) throw new Error(result.reason);
        return result.data;
    });
    // Peaks are kept on disk, so the second play of a track needs no decoding. Without a desktop bridge both calls do nothing.
    setPeaksStore({ get: loadSavedPeaks, set: saveSavedPeaks });

    let canvas = null;
    let parts = null; // what is alive while the waveform is on: { stopTime, resize, theme }
    let peaks = null;
    let src = '';
    let sample = { currentTime: 0, duration: 0, playing: false, at: 0 };
    let frame = 0;
    let loadTimer = 0;
    let prefetchTimer = 0;
    let holdTimer = 0;
    let held = false; // `peaks` belongs to the previous song: drawn dimmed and at rest until the new one is ready
    let lastKey = '';
    let triedSrc = ''; // the track whose waveform was asked for since it started playing: not asked for again on every time event

    const colors = () => {
        const style = getComputedStyle(document.documentElement);
        return { played: style.getPropertyValue('--accent').trim(), unplayed: style.getPropertyValue('--text-tertiary').trim() };
    };

    const fraction = () => {
        if (seek.classList.contains('dragging') && fill) return Math.max(0, Math.min(1, (parseFloat(fill.style.width) || 0) / 100));
        if (!sample.duration) return 0;
        const elapsed = sample.playing ? (performance.now() - sample.at) / 1000 : 0;
        return Math.max(0, Math.min(1, (sample.currentTime + elapsed) / sample.duration));
    };

    const draw = (force = false) => {
        frame = 0;
        if (!peaks || !canvas) return;
        const progress = held ? 0 : fraction();
        const key = `${held ? 'held' : ''}${Math.round(progress * canvas.clientWidth)}|${canvas.clientWidth}`;
        if (force || key !== lastKey) {
            lastKey = key;
            drawWaveform(canvas, peaks, { progress, ...DESIGN, ...(held ? { unplayedAlpha: DESIGN.unplayedAlpha * HOLD_ALPHA } : {}), ...colors() });
        }
        if (!held && (sample.playing || seek.classList.contains('dragging'))) frame = requestAnimationFrame(() => draw());
    };
    const schedule = (force = false) => {
        if (canvas && !frame) frame = requestAnimationFrame(() => draw(force));
    };

    const clear = () => {
        clearTimeout(holdTimer);
        holdTimer = 0;
        held = false;
        peaks = null;
        lastKey = '';
        seek.classList.remove('has-waveform');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const show = (wanted, result) => {
        if (!parts || wanted !== src || !result) return false; // turned off, the track changed meanwhile, or there is no waveform: keep the plain bar
        clearTimeout(holdTimer);
        holdTimer = 0;
        held = false;
        peaks = result;
        seek.classList.add('has-waveform');
        schedule(true);
        queuePrefetch();
        return true;
    };

    // The next song, decoded ahead of time once this one is settled (shown, or known to have no waveform).
    function queuePrefetch() {
        clearTimeout(prefetchTimer);
        prefetchTimer = setTimeout(() => {
            prefetchTimer = 0;
            const current = src;
            const next = parts && nextSongForWaveform();
            if (!next || next.url === current) return;
            prefetchPeaks({ id: next.url, duration: next.duration, url: next.url }, { shouldRun: () => !!parts && src === current });
        }, PREFETCH_DELAY);
    }

    // The previous waveform is kept (dimmed) while the new one is made; with none to keep, the bar is plain.
    const release = () => {
        clearTimeout(loadTimer);
        loadTimer = 0;
        clearTimeout(prefetchTimer);
        prefetchTimer = 0;
        clearTimeout(holdTimer);
        holdTimer = 0;
        if (!peaks) return;
        held = true;
        lastKey = '';
        schedule(true);
        holdTimer = setTimeout(() => {
            holdTimer = 0;
            clear();
        }, HOLD_MS);
    };

    const load = async (wanted, duration) => {
        const song = { id: wanted, duration, url: wanted };
        const result = await getPeaks(song, { shouldRun: () => !!parts && wanted === src });
        if (!show(wanted, result) && parts && wanted === src) {
            clear(); // no waveform for this song (too long, unreadable): the plain bar, and the next song is still prepared
            queuePrefetch();
        }
    };

    // Called for every time event while the waveform is on.
    const onSample = (time) => {
        sample = { currentTime: time.currentTime, duration: time.duration, playing: time.playing, at: performance.now() };
        if (time.src !== src) {
            src = time.src;
            triedSrc = ''; // every visit to a track may try again; the guard only stops a failed one retrying on each time event
            if (src) release();
            else clear();
        }
        if (held && time.duration > MAX_SECONDS) clear(); // a song with no waveform: do not keep the last one on the bar
        if (src && src !== triedSrc && time.duration > 0 && time.duration <= MAX_SECONDS && (!peaks || held) && !loadTimer) {
            const wanted = src;
            const duration = time.duration;
            triedSrc = wanted;
            // Saved peaks first, with no delay. Only when there are none is the track decoded, after the short wait.
            getPeaks({ id: wanted, duration, url: wanted }, { cachedOnly: true }).then((saved) => {
                if (show(wanted, saved) || wanted !== src || !parts) return; // saved, or made ahead of time: shown at once
                loadTimer = setTimeout(() => {
                    loadTimer = 0;
                    if (wanted === src && parts) load(wanted, duration); // the same duration as the saved-peaks lookup, so both build the same cache key
                }, LOAD_DELAY);
            });
        }
        schedule();
    };

    function start() {
        if (parts) return;
        canvas = document.createElement('canvas');
        canvas.className = 'waveform-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        seek.append(canvas);
        // Redraw when the bar changes size or the theme or accent changes.
        const resize = new ResizeObserver(() => schedule(true));
        resize.observe(seek);
        const theme = new MutationObserver(() => schedule(true));
        theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });
        const onAppearance = () => schedule(true); // a custom theme changes colors without changing the attributes above
        document.addEventListener('xplayer:appearance', onAppearance);
        parts = { stopTime: onTime(onSample, { immediate: true }), resize, theme, onAppearance }; // immediate: a song may already be playing, or paused
    }

    function stop() {
        if (!parts) return;
        parts.stopTime();
        parts.resize.disconnect();
        parts.theme.disconnect();
        document.removeEventListener('xplayer:appearance', parts.onAppearance);
        parts = null;
        clearTimeout(loadTimer);
        loadTimer = 0;
        clearTimeout(prefetchTimer);
        prefetchTimer = 0;
        cancelAnimationFrame(frame);
        frame = 0;
        clear();
        canvas.remove();
        canvas = null;
        src = '';
        triedSrc = '';
    }

    const apply = (on) => (on ? start() : stop());
    apply(isWaveformOn());
    const unwatch = watchWaveform(apply);

    return () => {
        unwatch();
        stop();
    };
}

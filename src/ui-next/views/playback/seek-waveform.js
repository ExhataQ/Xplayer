// The waveform inside the seek bar (task C-02, reworked in PC-03). The engine still owns seeking: a press on the bar is handled by the
// engine exactly as before, because the canvas is a passive picture over the bar (pointer-events: none) and the bar
// keeps its size rules. This only draws, from peaks (waveform.js) and the playback position (adapter/player-parts.js).
//
// While no waveform is available (turned off in Settings, loading, no song, a track over the length limit, an unreadable file) the
// plain bar stays exactly as it was. The waveform is off until the person turns it on (waveform-setting.js); turning it on or off
// takes effect at once, with no restart.
//
// Speed (brief 6.1). A track heard before shows its waveform at once: saved peaks (memory, then the file in the settings folder)
// are asked for right away. Only a track with no saved peaks waits LOAD_DELAY before it is decoded, so skipping through songs
// never starts a decode for a song that is left at once.

import { playerPart, onTime } from '../../adapter/player-parts.js';
import { readAudioBytes, loadSavedPeaks, saveSavedPeaks } from '../../adapter/playback-bridge.js';
import { getPeaks, drawWaveform, setBytesReader, setPeaksStore, readWithXhr, MAX_SECONDS, DESIGN } from './waveform.js';
import { isWaveformOn, watchWaveform } from './waveform-setting.js';

const LOAD_DELAY = 150; // ms before a track with no saved peaks is decoded (was 300; the decode itself is the slow part)

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
        const progress = fraction();
        const key = `${Math.round(progress * canvas.clientWidth)}|${canvas.clientWidth}`;
        if (force || key !== lastKey) {
            lastKey = key;
            drawWaveform(canvas, peaks, { progress, ...DESIGN, ...colors() });
        }
        if (sample.playing || seek.classList.contains('dragging')) frame = requestAnimationFrame(() => draw());
    };
    const schedule = (force = false) => {
        if (canvas && !frame) frame = requestAnimationFrame(() => draw(force));
    };

    const clear = () => {
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
        peaks = result;
        seek.classList.add('has-waveform');
        schedule(true);
        return true;
    };

    const load = async (wanted, duration) => {
        const song = { id: wanted, duration, url: wanted };
        show(wanted, await getPeaks(song));
    };

    // Called for every time event while the waveform is on.
    const onSample = (time) => {
        sample = { currentTime: time.currentTime, duration: time.duration, playing: time.playing, at: performance.now() };
        if (time.src !== src) {
            src = time.src;
            triedSrc = ''; // every visit to a track may try again; the guard only stops a failed one retrying on each time event
            clear();
            clearTimeout(loadTimer);
            loadTimer = 0;
        }
        if (src && src !== triedSrc && time.duration > 0 && time.duration <= MAX_SECONDS && !peaks && !loadTimer) {
            const wanted = src;
            const duration = time.duration;
            triedSrc = wanted;
            // Saved peaks first, with no delay. Only when there are none is the track decoded, after the short wait.
            getPeaks({ id: wanted, duration, url: wanted }, { cachedOnly: true }).then((saved) => {
                if (show(wanted, saved) || wanted !== src || !parts) return;
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
        parts = { stopTime: onTime(onSample, { immediate: true }), resize, theme }; // immediate: a song may already be playing, or paused
    }

    function stop() {
        if (!parts) return;
        parts.stopTime();
        parts.resize.disconnect();
        parts.theme.disconnect();
        parts = null;
        clearTimeout(loadTimer);
        loadTimer = 0;
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

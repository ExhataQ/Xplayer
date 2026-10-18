// The waveform inside the seek bar (task C-02). The engine still owns seeking: a press on the bar is handled by the
// engine exactly as before, because the canvas is a passive picture over the bar (pointer-events: none) and the bar
// keeps its size rules. This only draws, from peaks (waveform.js) and the playback position (adapter/player-parts.js).
//
// While no waveform is available (loading, no song, a track over the length limit, an unreadable file) the plain bar
// stays exactly as it was.

import { playerPart, onTime } from '../../adapter/player-parts.js';
import { readAudioBytes } from '../../adapter/playback-bridge.js';
import { getPeaks, drawWaveform, setBytesReader, readWithXhr, MAX_SECONDS } from './waveform.js';

const LOAD_DELAY = 300; // ms: skipping through songs quickly never starts a decode for a song that is left at once

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

    const canvas = document.createElement('canvas');
    canvas.className = 'waveform-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    seek.append(canvas);

    let peaks = null;
    let src = '';
    let sample = { currentTime: 0, duration: 0, playing: false, at: 0 };
    let frame = 0;
    let loadTimer = 0;
    let lastKey = '';
    let triedSrc = ''; // the track whose waveform was asked for since it started playing: not asked for again on every time event

    const colors = () => {
        const style = getComputedStyle(document.documentElement);
        return { played: style.getPropertyValue('--accent').trim(), unplayed: style.getPropertyValue('--border-strong').trim() };
    };

    const fraction = () => {
        if (seek.classList.contains('dragging') && fill) return Math.max(0, Math.min(1, (parseFloat(fill.style.width) || 0) / 100));
        if (!sample.duration) return 0;
        const elapsed = sample.playing ? (performance.now() - sample.at) / 1000 : 0;
        return Math.max(0, Math.min(1, (sample.currentTime + elapsed) / sample.duration));
    };

    const draw = (force = false) => {
        frame = 0;
        if (!peaks) return;
        const progress = fraction();
        const key = `${Math.round(progress * canvas.clientWidth)}|${canvas.clientWidth}`;
        if (force || key !== lastKey) {
            lastKey = key;
            drawWaveform(canvas, peaks, { progress, ...colors() });
        }
        if (sample.playing || seek.classList.contains('dragging')) frame = requestAnimationFrame(() => draw());
    };
    const schedule = (force = false) => {
        if (!frame) frame = requestAnimationFrame(() => draw(force));
    };

    const clear = () => {
        peaks = null;
        lastKey = '';
        seek.classList.remove('has-waveform');
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const load = async (wanted, duration) => {
        const result = await getPeaks({ id: wanted, duration, url: wanted });
        if (wanted !== src || !result) return; // the track changed meanwhile, or there is no waveform: keep the plain bar
        peaks = result;
        seek.classList.add('has-waveform');
        schedule(true);
    };

    const stopTime = onTime((time) => {
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
            loadTimer = setTimeout(() => {
                loadTimer = 0;
                if (wanted !== src) return;
                triedSrc = wanted;
                load(wanted, sample.duration);
            }, LOAD_DELAY);
        }
        schedule();
    });

    // Redraw when the bar changes size or the theme or accent changes.
    const resize = new ResizeObserver(() => schedule(true));
    resize.observe(seek);
    const theme = new MutationObserver(() => schedule(true));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });

    return () => {
        stopTime();
        resize.disconnect();
        theme.disconnect();
        clearTimeout(loadTimer);
        cancelAnimationFrame(frame);
        canvas.remove();
        seek.classList.remove('has-waveform');
    };
}

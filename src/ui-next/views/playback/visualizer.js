// The audio visualizer (.agent/archive/visualizer/VISUALIZER-PLAN.md V2 to V4, design: the "Visualizer in the player bar" board). Bars rise from the bottom edge of
// the player section (z = 0), edge to edge, behind the controls. Off by default (visualizer-setting.js).
//
// The canvas is a passive picture (pointer-events: none) under the player's controls; it never takes a click. It reads the engine's analyser
// (adapter/visualizer-bridge.js) and draws only while it is seen: the setting is on, a song plays (or the bars are still settling after a
// pause), the window is visible, and animation is not reduced. Otherwise no frame is scheduled at all and nothing is drawn (no baseline: with nothing playing the section shows no bars).
//
// Cost (measured: .agent/archive/visualizer/reports/V0-visualizer-spike.md): the canvas draws at scale 1 at most and CSS stretches it, at 30 frames per second.
// Colour: the accent the person chose, as one gradient (strong at the bottom, faint at the top). No colour is written here.

import { onTime } from '../../adapter/player-parts.js';
import { startAnalyser, stopAnalyser, getAnalyser } from '../../adapter/visualizer-bridge.js';
import { isVisualizerOn, watchVisualizer, getVisualizerWidth, watchVisualizerWidth, getVisualizerSongInfo, watchVisualizerSongInfo } from './visualizer-setting.js';
import { reducedMotion } from '../../components/motion.js';
import { DESIGN, barCountFor, canvasScale, binRanges, barTargets, smoothLevels, barHeight, barLayout, parseColor, shapeLevel, aboveFloor, createAutoGain, leftStripWidth } from './visualizer-math.js';

const STRENGTH = 0.22; // the accent's opacity at the bottom of a bar (dark themes)
const STRENGTH_LIGHT = 0.2; // a little lower in the Light theme, so the dark controls stay readable

export function mountVisualizer() {
    const host = document.querySelector('.player-host');
    if (!host) return () => {};

    let canvas = null;
    let ctx = null;
    let stopTime = null;
    let resize = null;
    let theme = null;
    let frame = 0;
    let lastDraw = 0;
    let playing = false;
    let bars = 0;
    let levels = new Float32Array(0);
    let targets = new Float32Array(0);
    let ranges = null;
    let rangesKey = '';
    let freq = null;
    let gradient = null;
    let gradientKey = '';
    let layout = [];
    let scale = 1;
    const gain = createAutoGain();
    let retryOnLoad = null;
    let unwatchWidth = null;
    let unwatchInfo = null;

    const cancel = () => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
    };

    const strength = () => (document.documentElement.dataset.theme === 'light' ? STRENGTH_LIGHT : STRENGTH);

    const makeGradient = () => {
        const rgb = parseColor(getComputedStyle(document.documentElement).getPropertyValue('--accent')) || [255, 255, 255];
        const a = strength();
        const key = `${rgb}|${a}|${canvas.height}`;
        if (gradient && key === gradientKey) return gradient;
        const g = ctx.createLinearGradient(0, canvas.height, 0, canvas.height * (1 - DESIGN.maxShare));
        g.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`);
        g.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a * DESIGN.topAlpha})`);
        gradient = g;
        gradientKey = key;
        return g;
    };

    const fit = () => {
        if (!canvas) return;
        // 'full': the whole section. 'left': a strip from the left edge to just before the centre column (measured, so it follows the window).
        if (getVisualizerWidth() === 'left') {
            const centre = host.querySelector('.player-center');
            const edge = centre ? centre.getBoundingClientRect().left - host.getBoundingClientRect().left : host.clientWidth * 0.35;
            canvas.style.width = `${leftStripWidth(host.clientWidth, edge)}px`;
        } else {
            canvas.style.width = '';
        }
        canvas.dataset.width = getVisualizerWidth();
        const cssWidth = canvas.clientWidth || host.clientWidth;
        const cssHeight = canvas.clientHeight || host.clientHeight;
        scale = canvasScale(window.devicePixelRatio);
        const width = Math.max(1, Math.round(cssWidth * scale));
        const height = Math.max(1, Math.round(cssHeight * scale));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        const count = barCountFor(cssWidth);
        if (count !== bars) {
            bars = count;
            levels = new Float32Array(bars);
            targets = new Float32Array(bars);
            ranges = null;
        }
        layout = barLayout(canvas.width, bars, Math.max(1, Math.round(DESIGN.gap * scale)));
        gradient = null;
    };

    // Nothing is drawn for silence or while nothing plays: a bar with no sound has no height at all (no baseline).
    const paint = () => {
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = makeGradient();
        const h = canvas.height;
        for (let b = 0; b < bars; b++) {
            const height = barHeight(shapeLevel(levels[b]), h);
            if (height > 0) ctx.fillRect(layout[b][0], h - height, layout[b][1], height);
        }
    };

    const shouldRun = () => isVisualizerOn() && canvas && !document.hidden && !reducedMotion();

    // One frame: read the sound (only while a song plays), move the bars, draw; schedule the next only while something still moves.
    const tick = (now) => {
        frame = 0;
        if (!shouldRun()) {
            levels.fill(0);
            paint();
            return;
        }
        if (now - lastDraw >= 1000 / DESIGN.fps - 2) {
            lastDraw = now;
            const analyser = playing ? getAnalyser() : null;
            let sound = null;
            if (analyser) {
                if (!freq || freq.length !== analyser.frequencyBinCount) freq = new Uint8Array(analyser.frequencyBinCount);
                const key = `${bars}|${freq.length}|${analyser.context.sampleRate}`;
                if (!ranges || key !== rangesKey) {
                    ranges = binRanges(bars, freq.length, analyser.context.sampleRate);
                    rangesKey = key;
                }
                analyser.getByteFrequencyData(freq);
                sound = barTargets(freq, ranges, targets);
                for (let i = 0; i < sound.length; i++) sound[i] = aboveFloor(sound[i]);
                gain.apply(sound); // the bars follow the music: loud parts reach the top, quiet parts fall back
            }
            const moving = smoothLevels(levels, sound);
            paint();
            if (!playing && !moving) return; // settled with every bar gone: no more frames until something plays
        }
        frame = requestAnimationFrame(tick);
    };

    // data-viz-playing on the player section: the bars are on screen right now (the player bar CSS slides the song info away while the pointer is elsewhere).
    const flag = (on) => host.toggleAttribute('data-viz-playing', on);

    const update = () => {
        cancel();
        flag(Boolean(canvas) && playing && shouldRun() && getVisualizerSongInfo() === 'hide');
        if (!canvas) return;
        if (!shouldRun()) {
            levels.fill(0);
            paint();
            return;
        }
        frame = requestAnimationFrame(tick);
    };

    const onSample = (state) => {
        const was = playing;
        playing = state.playing === true;
        if (playing && !was) gain.reset(); // a new start (or a new song): the loudness of the last one does not matter
        if (playing !== was) update();
    };

    const onVisibility = () => update();

    function start() {
        if (canvas) return;
        if (!startAnalyser()) {
            // The shell mounts before the engine's modules have run, so at start-up the engine's audio bus may not exist yet: try again once the page has loaded.
            if (document.readyState !== 'complete') {
                if (!retryOnLoad) {
                    retryOnLoad = () => {
                        retryOnLoad = null;
                        if (isVisualizerOn() && !canvas) start();
                    };
                    window.addEventListener('load', retryOnLoad, { once: true });
                }
                return;
            }
            console.warn('The visualizer could not start (it needs the desktop app and Web Audio).');
            return;
        }
        canvas = document.createElement('canvas');
        canvas.className = 'visualizer-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        host.prepend(canvas);
        ctx = canvas.getContext('2d');
        resize = new ResizeObserver(() => {
            fit();
            update();
        });
        resize.observe(host);
        theme = new MutationObserver(() => {
            gradient = null;
            update();
        });
        theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'data-motion'] });
        document.addEventListener('visibilitychange', onVisibility);
        document.addEventListener('xplayer:appearance', onVisibility);
        unwatchWidth = watchVisualizerWidth(() => {
            fit();
            update();
        });
        unwatchInfo = watchVisualizerSongInfo(update);
        fit();
        stopTime = onTime(onSample, { immediate: true });
        update();
    }

    function stop() {
        if (unwatchWidth) unwatchWidth();
        unwatchWidth = null;
        if (unwatchInfo) unwatchInfo();
        unwatchInfo = null;
        if (retryOnLoad) window.removeEventListener('load', retryOnLoad);
        retryOnLoad = null;
        cancel();
        if (stopTime) stopTime();
        stopTime = null;
        if (resize) resize.disconnect();
        if (theme) theme.disconnect();
        resize = theme = null;
        document.removeEventListener('visibilitychange', onVisibility);
        document.removeEventListener('xplayer:appearance', onVisibility);
        flag(false);
        if (canvas) canvas.remove();
        canvas = ctx = null;
        gradient = null;
        stopAnalyser();
    }

    const unwatch = watchVisualizer((on) => (on ? start() : stop()));
    if (isVisualizerOn()) start();
    return () => {
        unwatch();
        stop();
    };
}

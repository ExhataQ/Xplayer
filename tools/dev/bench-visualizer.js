'use strict';

// V0 of .agent/archive/visualizer/VISUALIZER-PLAN.md: what a full-width visualizer in the player section costs with hardware acceleration OFF (how the app runs).
//
//   node tools/dev/bench-visualizer.js                  about 2 minutes
//   node tools/dev/bench-visualizer.js --seconds=8
//
// It opens a plain page (no app code) with a made-up sound (tones and noise, nothing of yours) going through an AnalyserNode, and a canvas
// as wide as the window and 88 px tall, the player section's size. The canvas draws bars rising from its bottom edge, the one style of the plan.
// Browser flags turn the graphics card off (software drawing), as electron/main.js does for the app.
// For every combination of window width, screen scale, frames per second and bar count it reports:
//   draw ms    the time of one frame's work in the page (read the sound, draw the bars): median and 95th percentile
//   cpu        the CPU used by the whole browser (page, raster and graphics threads), as a share of ONE core, with the idle page's share taken off
// The numbers depend on the machine: run it on yours and send the .txt (written to .dev-data/bench-visualizer-<time>.txt).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function loadPlaywright() {
    for (const c of ['playwright', path.join(ROOT, 'electron', 'node_modules', 'playwright'), path.join(ROOT, 'node_modules', 'playwright')]) {
        try {
            return require(c);
        } catch (_) {
            /* next */
        }
    }
    return null;
}

function parseArgs(argv) {
    const out = { seconds: 6 };
    for (const a of argv) {
        const m = /^--seconds=(\d+)$/.exec(a);
        if (m) out.seconds = Math.max(2, Number(m[1]));
    }
    return out;
}

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#101218">
<canvas id="c" style="display:block"></canvas>
<script>
window.setup = async function ({ width, height, dpr, cap, fps, bars, draw, overlay }) {
    const canvas = document.getElementById('c');
    if (overlay) {
        // what the player section puts over the canvas: a translucent veil, the transport buttons, the seek bar and the volume
        const layer = document.createElement('div');
        layer.style.cssText = 'position:absolute;left:0;top:0;width:' + width + 'px;height:' + height + 'px;background:linear-gradient(to bottom, rgba(16,18,24,0.55), rgba(16,18,24,0.15));';
        for (let i = 0; i < 9; i++) {
            const b = document.createElement('div');
            b.style.cssText = 'position:absolute;top:' + (i < 5 ? 14 : 62) + 'px;left:' + (width / 2 - 140 + (i % 5) * 56) + 'px;width:' + (i === 2 ? 44 : 32) + 'px;height:' + (i === 2 ? 44 : 32) + 'px;border-radius:50%;background:rgba(255,255,255,0.12);';
            layer.appendChild(b);
        }
        document.body.style.position = 'relative';
        document.body.appendChild(layer);
    }
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    // cap: the most the canvas's own resolution may be (1 = draw at scale 1 and let CSS stretch it to the screen's scale)
    const res = cap ? Math.min(dpr, cap) : dpr;
    canvas.width = Math.round(width * res);
    canvas.height = Math.round(height * res);
    const ctx = canvas.getContext('2d', { alpha: false });
    const audio = new AudioContext();
    // a made-up sound: a few tones and a loop of noise, so every bin has something in it
    const noise = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const source = audio.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const gain = audio.createGain();
    gain.gain.value = 0.2;
    const analyser = audio.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(audio.destination);
    source.start();
    if (audio.state === 'suspended') await audio.resume();
    const freq = new Uint8Array(analyser.frequencyBinCount);
    // log-spaced bin edges, 30 Hz to 16 kHz
    const edges = [];
    for (let i = 0; i <= bars; i++) edges.push(Math.min(freq.length - 1, Math.round((30 * Math.pow(16000 / 30, i / bars)) / (audio.sampleRate / analyser.fftSize))));
    const level = new Float32Array(bars);
    const times = [];
    const gap = 1000 / fps;
    let last = 0;
    let running = true;
    window.stopBench = () => { running = false; return times; };
    function frame(now) {
        if (!running) return;
        requestAnimationFrame(frame);
        if (now - last < gap - 2) return;
        last = now;
        const t0 = performance.now();
        if (draw) {
            analyser.getByteFrequencyData(freq);
            ctx.fillStyle = '#101218';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#e8a33d';
            const w = canvas.width / bars;
            for (let b = 0; b < bars; b++) {
                let peak = 0;
                for (let i = edges[b]; i <= Math.max(edges[b], edges[b + 1]); i++) if (freq[i] > peak) peak = freq[i];
                const target = peak / 255;
                level[b] = target > level[b] ? target : level[b] * 0.9 + target * 0.1; // fast attack, slow fall
                const h = Math.round(level[b] * canvas.height * 0.9);
                ctx.fillRect(Math.round(b * w) + 1, canvas.height - h, Math.max(1, Math.round(w) - 2), h);
            }
        }
        times.push(performance.now() - t0);
    }
    requestAnimationFrame(frame);
};
</script>`;

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))] : null);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function cpuSeconds(cdp) {
    const info = await cdp.send('SystemInfo.getProcessInfo');
    return info.processInfo.reduce((sum, p) => sum + p.cpuTime, 0);
}

async function measure(browser, seconds, cfg) {
    const context = await browser.newContext({ viewport: { width: cfg.width, height: 400 }, deviceScaleFactor: cfg.dpr });
    const page = await context.newPage();
    await page.setContent(PAGE);
    await page.evaluate((c) => window.setup(c), cfg);
    const cdp = await browser.newBrowserCDPSession();
    await wait(1000); // settle
    const c0 = await cpuSeconds(cdp);
    const t0 = Date.now();
    await wait(seconds * 1000);
    const c1 = await cpuSeconds(cdp);
    const wall = (Date.now() - t0) / 1000;
    const times = await page.evaluate(() => window.stopBench());
    await context.close();
    const sorted = times.slice().sort((a, b) => a - b);
    return { cpu: ((c1 - c0) / wall) * 100, median: pct(sorted, 50), p95: pct(sorted, 95), frames: times.length / seconds };
}

(async () => {
    const pw = loadPlaywright();
    if (!pw) {
        console.error('playwright is not installed (npm i -D playwright)');
        process.exit(1);
    }
    const { seconds } = parseArgs(process.argv.slice(2));
    const browser = await pw.chromium.launch({
        args: ['--disable-gpu', '--disable-gpu-compositing', '--disable-accelerated-2d-canvas', '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream']
    });
    const configs = [];
    for (const width of [1400, 1920]) for (const dpr of [1, 1.5, 2]) for (const fps of [60, 30]) configs.push({ width, height: 88, dpr, fps, bars: 64, draw: true });
    configs.push({ width: 1920, height: 88, dpr: 1.5, fps: 30, bars: 128, draw: true });
    // the decision of V0: the canvas's own resolution capped at scale 1 (or 1.25), stretched by CSS; and a lower frame rate
    for (const dpr of [1.5, 2]) for (const cap of [1, 1.25]) configs.push({ width: 1920, height: 88, dpr, cap, fps: 30, bars: 64, draw: true });
    for (const fps of [20, 24]) configs.push({ width: 1920, height: 88, dpr: 1.5, fps, bars: 64, draw: true });
    configs.push({ width: 1920, height: 88, dpr: 1.5, cap: 1, fps: 20, bars: 64, draw: true });
    configs.push({ width: 1920, height: 88, dpr: 1.5, fps: 30, bars: 64, draw: true, overlay: true });
    configs.push({ width: 1920, height: 88, dpr: 1.5, fps: 60, bars: 64, draw: true, overlay: true });
    const lines = [];
    const say = (s) => { console.log(s); lines.push(s); };
    say(`Visualizer cost with the graphics card off. ${new Date().toISOString().slice(0, 16)}  ${process.platform} ${require('os').cpus()[0].model}, ${require('os').cpus().length} threads. ${seconds} s per row.`);
    say('');
    const idle = await measure(browser, seconds, { width: 1400, height: 88, dpr: 1, fps: 30, bars: 64, draw: false });
    say(`idle page with the analyser, nothing drawn: cpu ${idle.cpu.toFixed(1)}% of one core (taken off below)`);
    say('');
    say('width  scale  fps  bars  cap   draw ms (median / 95th)   real fps   cpu (of one core)   ("+ controls": translucent veil and buttons over the canvas)');
    for (const cfg of configs) {
        const r = await measure(browser, seconds, cfg);
        say(`${String(cfg.width).padStart(5)}  ${String(cfg.dpr).padStart(5)}  ${String(cfg.fps).padStart(3)}  ${String(cfg.bars).padStart(4)}  ${String(cfg.cap || '-').padStart(4)}   ${r.median.toFixed(2).padStart(6)} / ${r.p95.toFixed(2).padStart(6)}           ${r.frames.toFixed(0).padStart(5)}      ${Math.max(0, r.cpu - idle.cpu).toFixed(1).padStart(5)}%${cfg.overlay ? '   + controls' : ''}`);
    }
    await browser.close();
    const dir = path.join(ROOT, '.dev-data');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `bench-visualizer-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)}.txt`);
    fs.writeFileSync(file, lines.join('\n') + '\n');
    console.log('\nWritten to ' + path.relative(ROOT, file));
})().catch((e) => {
    console.error(e);
    process.exit(1);
});

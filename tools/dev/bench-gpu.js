'use strict';

// Measures the app with hardware acceleration off (how it runs now) and on, one after the other, and prints a table (phase 6.5).
//
//   npm run bench:gpu                         3 rounds of each, about 10 minutes the first time (the made-up library is built once)
//   npm run bench:gpu -- --rounds=5 --seconds=8 --count=3000
//
// Each run starts the real app on its own data folder (Source/.dev-data/profiles/bench, git-ignored: a made-up library of 1500 songs,
// nothing of yours) with XPLAYER_GPU=off or =on, and measures through the debugging port:
//   start-up     ms from starting Electron until the song list shows its first rows
//   gpu          what Chromium says it uses (compositing, rasterization, the graphics card), so a run that did not get the GPU shows
//   scroll       the song list scrolled with the mouse wheel for --seconds: frames per second, the slowest 1% of frames, frames over 20 ms
//   waveform     the same measuring while a song plays with the waveform on (Settings > Playback)
//   busy         how much of the time the page's main thread was working during each part (lower is better)
// Close other windows and leave the mouse alone while it runs. Needs a display; the window comes up on screen and scrolls by itself.
// The result is also written to Source/.dev-data/bench-gpu-<time>.json and .txt; send the .txt.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9351;
const DATA = path.join(ROOT, '.dev-data', 'profiles', 'bench');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
    const out = { rounds: 3, seconds: 6, count: 1500 };
    for (const a of argv) {
        const m = /^--(rounds|seconds|count)=(\d+)$/.exec(a);
        if (m) out[m[1]] = Math.max(1, Number(m[2]));
    }
    return out;
}

function median(values) {
    const v = values.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = v.length >> 1;
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// Frame gaps in ms (from requestAnimationFrame) -> what to compare. The gaps are measured in the page.
function summarizeFrames(gaps) {
    if (!gaps || gaps.length < 3) return { frames: gaps ? gaps.length : 0, fps: null, p99: null, over20: null, over33: null };
    const sorted = [...gaps].sort((a, b) => a - b);
    const total = gaps.reduce((a, b) => a + b, 0);
    const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    return {
        frames: gaps.length,
        fps: Math.round((gaps.length / total) * 10000) / 10,
        p99: Math.round(pick(0.99) * 10) / 10,
        over20: Math.round((gaps.filter((g) => g > 20).length / gaps.length) * 1000) / 10,
        over33: Math.round((gaps.filter((g) => g > 33.5).length / gaps.length) * 1000) / 10
    };
}

// runs: [{ gpu: 'off'|'on', startupMs, gpuInfo, scroll: {fps, p99, over20, over33, busy}, waveform: {...}, playing }]
function buildTable(runs) {
    const rows = [];
    const cell = (v, d = 1) => (v === null || v === undefined ? 'n/a' : String(Math.round(v * 10 ** d) / 10 ** d));
    for (const gpu of ['off', 'on']) {
        const mine = runs.filter((r) => r.gpu === gpu);
        if (!mine.length) continue;
        const m = (pick) => median(mine.map(pick));
        rows.push([
            `acceleration ${gpu}`,
            cell(m((r) => r.startupMs), 0),
            cell(m((r) => r.scroll && r.scroll.fps)), cell(m((r) => r.scroll && r.scroll.p99)), cell(m((r) => r.scroll && r.scroll.over20)), cell(m((r) => r.scroll && r.scroll.busy), 0),
            cell(m((r) => r.waveform && r.waveform.fps)), cell(m((r) => r.waveform && r.waveform.p99)), cell(m((r) => r.waveform && r.waveform.over20)), cell(m((r) => r.waveform && r.waveform.busy), 0)
        ]);
    }
    const head = ['', 'start-up ms', 'scroll fps', 'p99 ms', '>20ms %', 'busy %', 'wave fps', 'p99 ms', '>20ms %', 'busy %'];
    const all = [head, ...rows];
    const widths = head.map((_, i) => Math.max(...all.map((r) => String(r[i]).length)));
    return all.map((r) => r.map((c, i) => String(c).padEnd(widths[i])).join('  ').trimEnd()).join('\n');
}

// The part that runs in the page: records the gap between frames for `ms`, resolves with the gaps.
const FRAME_RECORDER = (ms) => new Promise((resolve) => {
    const gaps = [];
    let last = performance.now();
    const end = last + ms;
    const tick = (now) => {
        gaps.push(now - last);
        last = now;
        if (now < end) requestAnimationFrame(tick); else resolve(gaps);
    };
    requestAnimationFrame(tick);
});

async function busyOf(client) {
    const { metrics } = await client.send('Performance.getMetrics');
    const get = (name) => (metrics.find((m) => m.name === name) || {}).value || 0;
    return { task: get('TaskDuration'), at: get('Timestamp') };
}

async function measure(page, client, seconds, action) {
    const before = await busyOf(client);
    const recording = page.evaluate(FRAME_RECORDER, seconds * 1000);
    const acting = action ? action() : Promise.resolve();
    const [gaps] = await Promise.all([recording, acting]);
    const after = await busyOf(client);
    const wall = after.at - before.at;
    return { ...summarizeFrames(gaps), busy: wall > 0 ? Math.round(((after.task - before.task) / wall) * 100) : null };
}

async function oneRun({ gpu, seconds, electron }) {
    const { chromium } = require('playwright');
    const flags = process.platform === 'linux' ? ['--no-sandbox'] : [];
    const started = Date.now();
    const child = spawn(electron, [ROOT, ...flags, `--remote-debugging-port=${PORT}`], {
        env: { ...process.env, XPLAYER_DATA: DATA, XPLAYER_GPU: gpu }, stdio: 'ignore'
    });
    const result = { gpu };
    try {
        let browser = null;
        for (let i = 0; i < 120 && !browser; i++) {
            try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); } catch (e) { await wait(250); }
        }
        if (!browser) throw new Error('the app did not start');
        let page = null;
        for (let i = 0; i < 120 && !page; i++) {
            page = browser.contexts().flatMap((c) => c.pages()).find((p) => /ui-next\/index\.html/.test(p.url())) || null;
            if (!page) await wait(250);
        }
        if (!page) throw new Error('the new interface did not open');
        const rows = '.view-host .song-item:not(.lazy-skeleton)';
        await page.waitForSelector(rows, { timeout: 60000 });
        result.startupMs = Date.now() - started;

        const info = await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo');
        const fs_ = (info.gpu && info.gpu.featureStatus) || {};
        result.gpuInfo = {
            compositing: (info.gpu && info.gpu.auxAttributes && info.gpu.auxAttributes.compositing) || '',
            device: ((info.gpu && info.gpu.devices && info.gpu.devices[0]) || {}).deviceString || '',
            featureStatus: fs_
        };

        const client = await page.context().newCDPSession(page);
        await client.send('Performance.enable');
        await page.bringToFront();
        await wait(1500);

        // the list, scrolled with the wheel
        const box = await page.locator('.view-host .content').first().boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        let dir = 1;
        result.scroll = await measure(page, client, seconds, async () => {
            const end = Date.now() + seconds * 1000;
            let n = 0;
            while (Date.now() < end) {
                if (++n % 120 === 0) dir = -dir; // back up now and then so it never stops at the end
                await page.mouse.wheel(0, 90 * dir);
                await wait(16);
            }
        });

        // a song playing with the waveform on
        await page.evaluate(() => { localStorage.setItem('xplayer.ui-next.waveform', 'on'); });
        await page.reload();
        await page.waitForSelector(rows, { timeout: 60000 });
        await page.evaluate(() => { const c = document.querySelector('.view-host .content'); if (c) c.scrollTop = 0; });
        await wait(1000);
        await page.locator(rows).first().dblclick();
        await wait(1500);
        const client2 = await page.context().newCDPSession(page);
        await client2.send('Performance.enable');
        result.waveform = await measure(page, client2, seconds, null);
        result.playing = await page.evaluate(() => [...document.querySelectorAll('audio')].some((a) => !a.paused && !a.ended));
        result.waveformDrawn = (await page.locator('canvas.waveform-canvas').count()) > 0;
        await page.evaluate(() => { localStorage.setItem('xplayer.ui-next.waveform', 'off'); });
        await browser.close().catch(() => {});
    } catch (e) {
        result.error = e.message;
    } finally {
        child.kill();
        await wait(1500);
    }
    return result;
}

function electronVersion() {
    try { return require('electron/package.json').version; } catch (e) { return 'unknown'; }
}

async function main(argv) {
    const args = parseArgs(argv);
    const electron = process.env.XPLAYER_ELECTRON || require('electron');
    require('./gen-web').run();
    if (!fs.existsSync(path.join(DATA, 'library', 'songs.json'))) {
        console.log(`Making the bench library (${args.count} songs, once)...`);
        await require('./make-sample-library').makeSampleLibrary({ dataDir: DATA, count: args.count, log: () => {} });
    }
    const runs = [];
    for (let round = 1; round <= args.rounds; round++) {
        for (const gpu of round % 2 ? ['off', 'on'] : ['on', 'off']) { // the order alternates, so neither side always goes first
            process.stdout.write(`round ${round}/${args.rounds}, acceleration ${gpu} ... `);
            const run = await oneRun({ gpu, seconds: args.seconds, electron });
            console.log(run.error ? 'FAILED: ' + run.error : `start ${run.startupMs} ms, scroll ${run.scroll.fps} fps, waveform ${run.waveform.fps} fps${run.playing ? '' : ' (no song was playing)'}`);
            runs.push(run);
        }
    }
    const ok = runs.filter((r) => !r.error);
    const lines = [
        `Xplayer GPU benchmark, ${new Date().toISOString()}`,
        `${process.platform} ${process.arch}, node ${process.version}, electron ${electronVersion()}, rounds=${args.rounds}, seconds=${args.seconds}`,
        '',
        buildTable(ok),
        '',
        'columns: start-up = ms until the list shows rows; fps and p99 (slowest 1% of frames, ms) and >20ms (% of frames) come from requestAnimationFrame;',
        'busy = % of the time the page main thread was working. Medians of the rounds.',
        ''
    ];
    for (const gpu of ['off', 'on']) {
        const first = ok.find((r) => r.gpu === gpu);
        if (first) lines.push(`gpu ${gpu}: ${first.gpuInfo.device || 'device unknown'}; ` + Object.entries(first.gpuInfo.featureStatus).filter(([k]) => /^(gpu_compositing|rasterization|webgl|2d_canvas|canvas_oop_rasterization|video_decode)$/.test(k)).map(([k, v]) => `${k}=${v}`).join(', '));
    }
    lines.push(`playing during the waveform part: ${ok.filter((r) => r.playing).length}/${ok.length} runs; waveform drawn: ${ok.filter((r) => r.waveformDrawn).length}/${ok.length}`);
    if (runs.length !== ok.length) lines.push('failed runs: ' + runs.filter((r) => r.error).map((r) => `${r.gpu}: ${r.error}`).join('; '));
    const text = lines.join('\n');
    console.log('\n' + text);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.mkdirSync(path.join(ROOT, '.dev-data'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, '.dev-data', `bench-gpu-${stamp}.txt`), text + '\n');
    fs.writeFileSync(path.join(ROOT, '.dev-data', `bench-gpu-${stamp}.json`), JSON.stringify(runs, null, 2));
    console.log(`\nWritten: .dev-data/bench-gpu-${stamp}.txt (send this one)`);
    return ok.length === runs.length ? 0 : 1;
}

if (require.main === module) {
    main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
}

module.exports = { parseArgs, median, summarizeFrames, buildTable };

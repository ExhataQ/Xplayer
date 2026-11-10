'use strict';

// What the visualizer costs in the real app (visualizer plan V6). Starts the real Electron app on the made-up bench library (nothing of yours),
// plays a song, and measures the CPU the whole app uses (every process: window, graphics, audio) with the visualizer off and on, and on while
// paused (then nothing is drawn, so it must cost nothing). The difference is what the visualizer costs.
//
//   node tools/dev/bench-visualizer-app.js                 3 rounds, 10 seconds of each state
//   node tools/dev/bench-visualizer-app.js --rounds=5 --seconds=15 --width=1920 --height=1080
//
// Needs a display (the window comes up and plays a song; sound will be heard) and the same set-up as bench:gpu (npm i, playwright). Close other
// windows while it runs. The made-up library is shared with bench:gpu (.dev-data/profiles/bench, git-ignored).
// The result is written to .dev-data/bench-visualizer-app-<time>.txt; send that file.
//
// Reading it: "cpu" is the percentage of ONE core. "extra" is on minus off. The target from the plan: extra about 5 % or less of one core at 30 frames
// a second. "drawn" says the canvas was really there, "audio" says the song really played (its time moved), so a run that did not play is visible.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9352;
const DATA = path.join(ROOT, '.dev-data', 'profiles', 'bench');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
    const out = { rounds: 3, seconds: 10, width: 0, height: 0 };
    for (const a of argv) {
        const m = /^--(rounds|seconds|width|height)=(\d+)$/.exec(a);
        if (m) out[m[1]] = Number(m[2]);
    }
    return out;
}

const median = (values) => {
    const v = values.filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

// The made-up songs are two to four seconds of silence, which is no test for a visualizer. The tool makes one real 60 second file (a kick, a bass line,
// chords and hi-hats, nothing from anyone) and points every song of the bench library at it. Only the bench library is touched (git-ignored).
function ensureBenchAudio() {
    const dir = path.join(DATA, 'bench-audio');
    const file = path.join(dir, 'bench-music.wav');
    if (!fs.existsSync(file)) {
        fs.mkdirSync(dir, { recursive: true });
        const rate = 22050;
        const n = rate * 60;
        const buffer = Buffer.alloc(44 + n * 2);
        buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + n * 2, 4); buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
        buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(n * 2, 40);
        const notes = [55, 65.4, 73.4, 49];
        const samples = new Float32Array(n);
        let peak = 0;
        for (let i = 0; i < n; i++) {
            const t = i / rate;
            const kt = t % 0.5;
            let v = 0.9 * Math.sin(2 * Math.PI * (45 * kt + 45 * 0.06 * (1 - Math.exp(-kt / 0.06)))) * Math.exp(-kt / 0.12);
            v += 0.3 * Math.sin(2 * Math.PI * notes[Math.floor(t) % 4] * t);
            const ct = t % 2;
            for (const f of [220, 277, 330, 440, 660, 1320, 2640]) v += 0.08 * Math.min(1, ct * 8) * Math.exp(-ct / 1.2) * Math.sin(2 * Math.PI * f * t);
            v += 0.25 * (Math.random() * 2 - 1) * Math.exp(-(t % 0.25) / 0.03) * (Math.floor(t * 4) % 2 ? 1 : 0.5);
            samples[i] = v;
            peak = Math.max(peak, Math.abs(v));
        }
        for (let i = 0; i < n; i++) buffer.writeInt16LE(Math.round((samples[i] / peak) * 0.6 * 32767), 44 + i * 2);
        fs.writeFileSync(file, buffer);
    }
    const url = 'file:///' + file.replace(/\\/g, '/');
    const songsFile = path.join(DATA, 'library', 'songs.json');
    const data = JSON.parse(fs.readFileSync(songsFile, 'utf8'));
    if (data.songs && data.songs[0] && data.songs[0].url !== url) {
        for (const song of data.songs) { song.url = url; song.duration = '1:00'; }
        fs.writeFileSync(songsFile, JSON.stringify(data));
    }
}

async function cpuSeconds(browser) {
    const session = await browser.newBrowserCDPSession();
    try {
        const { processInfo } = await session.send('SystemInfo.getProcessInfo');
        return processInfo.reduce((sum, p) => sum + (p.cpuTime || 0), 0);
    } finally {
        await session.detach().catch(() => {});
    }
}

async function oneRun({ visualizer, seconds, electron, width, height }) {
    const { chromium } = require('playwright');
    const flags = process.platform === 'linux' ? ['--no-sandbox'] : [];
    const child = spawn(electron, [ROOT, ...flags, `--remote-debugging-port=${PORT}`], { env: { ...process.env, XPLAYER_DATA: DATA }, stdio: 'ignore' });
    const result = { visualizer };
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
        if (width && height) {
            const session = await page.context().newCDPSession(page);
            const { windowId } = await session.send('Browser.getWindowForTarget');
            await session.send('Browser.setWindowBounds', { windowId, bounds: { width, height, windowState: 'normal' } }).catch(() => {});
        }
        await page.evaluate((on) => localStorage.setItem('xplayer.ui-next.visualizer', on ? 'on' : 'off'), visualizer);
        await page.reload();
        await page.waitForSelector(rows, { timeout: 60000 });
        await page.bringToFront();
        await wait(1000);
        await page.locator(rows).first().dblclick();
        await wait(4000); // the song starts, the analyser comes in, the first seconds settle

        const t0 = await page.evaluate(() => (document.querySelector('audio') || {}).currentTime || 0);
        const before = await cpuSeconds(browser);
        const started = Date.now();
        await wait(seconds * 1000);
        const after = await cpuSeconds(browser);
        const wall = (Date.now() - started) / 1000;
        result.cpu = Math.round(((after - before) / wall) * 1000) / 10;
        const state = await page.evaluate(() => {
            const audio = [...document.querySelectorAll('audio')].find((a) => !a.paused) || document.querySelector('audio');
            return { time: (audio || {}).currentTime || 0, playing: [...document.querySelectorAll('audio')].some((a) => !a.paused && !a.ended), drawn: Boolean(document.querySelector('canvas.visualizer-canvas')), width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio };
        });
        result.audio = state.playing && state.time > t0;
        result.drawn = state.drawn;
        result.window = `${state.width}x${state.height} at scale ${state.dpr}`;

        // the same song paused: with the visualizer on nothing is drawn, so this must cost as little as the off state
        if (visualizer) {
            await page.evaluate(() => { for (const a of document.querySelectorAll('audio')) a.pause(); });
            await wait(2500);
            const p0 = await cpuSeconds(browser);
            const ps = Date.now();
            await wait(Math.min(seconds, 6) * 1000);
            const p1 = await cpuSeconds(browser);
            result.pausedCpu = Math.round(((p1 - p0) / ((Date.now() - ps) / 1000)) * 1000) / 10;
        }
        await browser.close().catch(() => {});
    } catch (e) {
        result.error = e.message;
    } finally {
        child.kill();
        await wait(1500);
    }
    return result;
}

async function main(argv) {
    const args = parseArgs(argv);
    const electron = process.env.XPLAYER_ELECTRON || require('electron');
    require('./gen-web').run();
    if (!fs.existsSync(path.join(DATA, 'library', 'songs.json'))) {
        console.log('Making the bench library (1500 songs, once)...');
        await require('./make-sample-library').makeSampleLibrary({ dataDir: DATA, count: 1500, log: () => {} });
    }
    ensureBenchAudio();
    const runs = [];
    for (let round = 1; round <= args.rounds; round++) {
        for (const visualizer of round % 2 ? [false, true] : [true, false]) { // the order alternates, so neither side always goes first
            process.stdout.write(`round ${round}/${args.rounds}, visualizer ${visualizer ? 'on ' : 'off'} ... `);
            const run = await oneRun({ visualizer, seconds: args.seconds, electron, width: args.width, height: args.height });
            console.log(run.error ? 'FAILED: ' + run.error : `cpu ${run.cpu} %${run.pausedCpu !== undefined ? `, paused ${run.pausedCpu} %` : ''}${run.audio ? '' : ' (the song did not play)'}`);
            runs.push(run);
        }
    }
    const ok = runs.filter((r) => !r.error);
    const off = median(ok.filter((r) => !r.visualizer).map((r) => r.cpu));
    const on = median(ok.filter((r) => r.visualizer).map((r) => r.cpu));
    const paused = median(ok.filter((r) => r.visualizer).map((r) => r.pausedCpu));
    const lines = [
        `Xplayer visualizer in the real app, ${new Date().toISOString()}`,
        `${process.platform} ${process.arch}, node ${process.version}, rounds=${args.rounds}, seconds=${args.seconds}`,
        `window: ${(ok[0] && ok[0].window) || 'unknown'}`,
        '',
        '                       cpu (of one core, the whole app)',
        `visualizer off, playing   ${off === null ? '-' : off.toFixed(1)} %`,
        `visualizer on,  playing   ${on === null ? '-' : on.toFixed(1)} %`,
        `visualizer on,  paused    ${paused === null ? '-' : paused.toFixed(1)} %`,
        `extra (on - off)          ${off === null || on === null ? '-' : (on - off).toFixed(1)} %   (target: about 5 % or less)`,
        '',
        `canvas drawn in ${ok.filter((r) => r.visualizer && r.drawn).length}/${ok.filter((r) => r.visualizer).length} "on" runs; song played in ${ok.filter((r) => r.audio).length}/${ok.length} runs; failed runs: ${runs.length - ok.length}`,
        'each run: ' + runs.map((r) => (r.error ? 'FAILED' : `${r.visualizer ? 'on' : 'off'} ${r.cpu}%`)).join(', ')
    ];
    console.log('\n' + lines.join('\n'));
    const dir = path.join(ROOT, '.dev-data');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `bench-visualizer-app-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)}.txt`);
    fs.writeFileSync(file, lines.join('\n') + '\n');
    console.log(`\nWritten to ${path.relative(ROOT, file)}`);
}

main(process.argv.slice(2)).catch((e) => { console.error(e); process.exit(1); });

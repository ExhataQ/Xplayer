// Waveform data and drawing (task C-02, decision D15). Real browser, real decodeAudioData, generated WAV.
// Run: node --test tools/tests/ui-next-waveform.test.js
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT, loadPlaywright, launch } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const MODULE_DIR = path.join(ROOT, 'src', 'ui-next', 'views', 'playback');

// 4 seconds at 8 kHz: silence, loud (0.9), quiet (0.1), silence.
function writeWav(file) {
    const rate = 8000, n = rate * 4, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
    b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) {
        const second = Math.floor(i / rate);
        const amp = second === 1 ? 0.9 : second === 2 ? 0.1 : 0;
        b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * amp * 32000), 44 + i * 2);
    }
    fs.writeFileSync(file, b);
}

describe('waveform.js (static)', () => {
    const code = fs.readFileSync(path.join(MODULE_DIR, 'waveform.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    test('holds no color values and does not look up elements by id (gate 13)', () => {
        assert.deepEqual(code.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/g) || [], []);
        assert.ok(!/getElementById|querySelector\(['"`]#/.test(code));
    });
});

describe('waveform.js in a browser', { concurrency: false }, () => {
    let browser, dir, skip, page;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xplayer-wave-'));
        fs.copyFileSync(path.join(MODULE_DIR, 'waveform.js'), path.join(dir, 'waveform.js'));
        writeWav(path.join(dir, 'tone.wav'));
        fs.writeFileSync(path.join(dir, 'page.html'), '<!doctype html><meta charset="utf-8"><canvas id="c" style="width:200px;height:40px"></canvas>');
        page = await browser.newPage();
        await page.goto('file://' + path.join(dir, 'page.html').replace(/\\/g, '/'));
        await page.evaluate(async (u) => { window.W = await import(u); }, 'file://' + path.join(dir, 'waveform.js').replace(/\\/g, '/'));
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    const guard = (t) => (skip ? (t.skip(skip), false) : true);
    const song = (extra = {}) => ({ id: 'a', duration: 4, url: 'file://' + path.join(dir, 'tone.wav').replace(/\\/g, '/'), ...extra });
    // Runs `body` with a counting reader wrapped around the default (XHR) reader; returns { r: result, fetches: reads }.
    const withFetchCount = (fn, injected = false) => page.evaluate(async ([body, useInjected]) => {
        W.clearPeaksCache(); W.setPeaksStore(null);
        let n = 0;
        const read = (song) => new Promise((resolve, reject) => {
            const x = new XMLHttpRequest(); x.open('GET', song.url); x.responseType = 'arraybuffer';
            x.onload = () => resolve(x.response); x.onerror = () => reject(new Error('read failed')); x.send();
        });
        W.setBytesReader(useInjected ? async (s) => (n++, read(s)) : null);
        const origin = window.XMLHttpRequest;
        if (!useInjected) window.XMLHttpRequest = class extends origin { send(...a) { n++; return super.send(...a); } };
        try { const r = await eval(`(async()=>{${body}})()`); return { r, fetches: n }; } finally { window.XMLHttpRequest = origin; W.setBytesReader(null); }
    }, [fn, injected]);

    test('computePeaks takes the loudest sample per slice and scales the loudest bin to 255', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const out = await page.evaluate(() => Array.from(W.computePeaks([new Float32Array([0, 0.1, -0.5, 0.25])], 4)));
        assert.deepEqual(out, [0, 51, 255, 128]);
        assert.deepEqual(await page.evaluate(() => Array.from(W.computePeaks([], 3))), [0, 0, 0]);
        assert.deepEqual(await page.evaluate(() => Array.from(W.computePeaks([new Float32Array(10)], 3))), [0, 0, 0]);
    });

    test('getPeaks decodes a real file: 1000 bins, silent, loud, quiet, silent', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const peaks = await page.evaluate(async (s) => { W.clearPeaksCache(); return Array.from(await W.getPeaks(s)); }, song());
        assert.equal(peaks.length, 1000);
        const max = (a, b) => Math.max(...peaks.slice(a, b));
        assert.ok(max(0, 240) <= 2, 'first second is silent');
        assert.ok(max(260, 490) >= 250, 'second second is the loudest');
        const quiet = max(510, 740);
        assert.ok(quiet > 20 && quiet < 40, `third second is about 0.1/0.9 of the loudest (${quiet})`);
        assert.ok(max(760, 1000) <= 2, 'last second is silent');
    });

    test('a decoded track is cached; two calls at once share one fetch', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const s = song();
        const { r, fetches } = await withFetchCount(`const s=${JSON.stringify(s)};const [a,b]=await Promise.all([W.getPeaks(s),W.getPeaks(s)]);const c=await W.getPeaks(s);return {same:a===b&&b===c,len:c.length};`);
        assert.deepEqual(r, { same: true, len: 1000 });
        assert.equal(fetches, 1);
    });

    test('an injected reader (the app\'s IPC) is used instead of the default one', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const out = await page.evaluate(async (s) => {
            W.clearPeaksCache();
            const wave = new Float32Array(8000); wave.fill(0.5);
            const wav = (() => { const n = 8000, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
                const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
                w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
                v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true);
                v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
                for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, i < n / 2 ? 0 : 16000, true); return b; })();
            const seen = [];
            W.setBytesReader(async (song) => (seen.push(song.id), wav));
            const peaks = await W.getPeaks({ id: 'ipc', duration: 1, url: 'media://not-readable' });
            W.setBytesReader(null);
            return { seen, first: peaks[10], last: peaks[990] };
        }, null);
        assert.deepEqual(out.seen, ['ipc']);
        assert.ok(out.first <= 2 && out.last >= 200, `silent first half, loud second half: ${JSON.stringify(out)}`);
    });

    test('different tracks decode one at a time, in the order asked', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const out = await page.evaluate(async (base) => {
            W.clearPeaksCache();
            let running = 0, most = 0; const order = [];
            const wavBytes = async (song) => { const r = await new Promise((res) => { const x = new XMLHttpRequest(); x.open('GET', song.url); x.responseType = 'arraybuffer'; x.onload = () => res(x.response); x.send(); }); return r; };
            W.setBytesReader(async (song) => { running++; most = Math.max(most, running); order.push(song.id); await new Promise((r) => setTimeout(r, 60)); try { return await wavBytes(song); } finally { running--; } });
            const results = await Promise.all(['a', 'b', 'c'].map((id) => W.getPeaks({ ...base, id })));
            W.setBytesReader(null);
            return { most, order, sizes: results.map((r) => r && r.length) };
        }, song());
        assert.deepEqual(out, { most: 1, order: ['a', 'b', 'c'], sizes: [1000, 1000, 1000] });
    });

    test('tracks over the length limit and unreadable files give null without breaking', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const long = await withFetchCount(`return await W.getPeaks(${JSON.stringify(song({ id: 'long', duration: 11 * 60 }))});`);
        assert.equal(long.r, null);
        assert.equal(long.fetches, 0, 'skipped before any read');
        const bad = await withFetchCount(`const s=${JSON.stringify(song({ id: 'bad', url: 'file://' + path.join(dir, 'missing.wav').replace(/\\/g, '/') }))};const a=await W.getPeaks(s);const b=await W.getPeaks(s);return [a,b];`);
        assert.deepEqual(bad.r, [null, null]);
        assert.equal(bad.fetches, 2, 'a failure is not cached');
        assert.equal((await withFetchCount(`return await W.getPeaks(null);`)).r, null);
    });

    test('a plugged-in store is written once and read back without decoding', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const out = await page.evaluate(async (s) => {
            W.clearPeaksCache();
            const db = new Map(); let sets = 0;
            W.setPeaksStore({ get: (k) => db.get(k) || null, set: (k, v) => (sets++, db.set(k, v)) });
            await W.getPeaks(s);
            W.clearPeaksCache();
            let fetches = 0;
            W.setBytesReader(async () => { fetches++; throw new Error('must not read'); });
            const again = await W.getPeaks(s);
            W.setBytesReader(null); W.setPeaksStore(null);
            return { sets, fetches, len: again.length };
        }, song());
        assert.deepEqual(out, { sets: 1, fetches: 0, len: 1000 });
    });

    test('drawWaveform paints played bars and unplayed bars in the given colors', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const out = await page.evaluate(() => {
            const canvas = document.getElementById('c');
            const peaks = new Uint8Array(1000).fill(255);
            const count = W.drawWaveform(canvas, peaks, { progress: 0.5, played: '#ff0000', unplayed: '#0000ff' });
            const ctx = canvas.getContext('2d');
            const r = window.devicePixelRatio || 1;
            const px = (x, y) => Array.from(ctx.getImageData(Math.round(x * r), Math.round(y * r), 1, 1).data);
            const left = px(1, 20), right = px(199 - 1, 20);
            const empty = W.drawWaveform(canvas, new Uint8Array(0), { played: '#ff0000', unplayed: '#0000ff' });
            return { count, left, right, emptyCount: empty, blank: px(1, 20) };
        });
        assert.equal(out.count, 67);
        assert.deepEqual(out.left, [255, 0, 0, 255]);
        assert.deepEqual(out.right, [0, 0, 255, 255]);
        assert.equal(out.emptyCount, 0);
        assert.equal(out.blank[3], 0, 'no peaks clears the canvas');
    });
});

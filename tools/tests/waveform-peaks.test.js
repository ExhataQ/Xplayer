// electron/waveform-peaks.js: the saved waveform peaks (task PC-03, DP10 b). Plain Node, no Electron.
// Run: node --test tools/tests/waveform-peaks.test.js
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readPeaks, writePeaks, MAX_BYTES, MAX_KEY } = require('../../electron/waveform-peaks');
const storagePaths = require('../../electron/storage-paths');

describe('waveform peaks store', () => {
    let dir;
    before(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xplayer-peaks-'));
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const bytes = () => Uint8Array.from({ length: 1000 }, (_, i) => i % 256);

    test('what is saved is read back exactly', async () => {
        const key = 'v2:file:///C:/Music/a b.mp3:187:file:///C:/Music/a b.mp3';
        assert.deepEqual(await writePeaks(key, bytes(), { dir }), { success: true });
        const back = await readPeaks(key, { dir });
        assert.equal(back.success, true);
        assert.deepEqual(Array.from(back.data), Array.from(bytes()));
    });

    test('an ArrayBuffer is accepted too, and a missing key is a miss, not an error', async () => {
        assert.deepEqual(await writePeaks('k-buffer', bytes().buffer, { dir }), { success: true });
        assert.equal((await readPeaks('k-buffer', { dir })).success, true);
        assert.deepEqual(await readPeaks('never-saved', { dir }), { success: false });
        assert.deepEqual(await readPeaks('x', { dir: path.join(dir, 'no-such-folder') }), { success: false });
    });

    test('different keys never share a file, and the key is never used as a path', async () => {
        await writePeaks('../../escape', Uint8Array.of(1, 2, 3), { dir });
        await writePeaks('v2:other', Uint8Array.of(9), { dir });
        assert.deepEqual(Array.from((await readPeaks('../../escape', { dir })).data), [1, 2, 3]);
        assert.deepEqual(Array.from((await readPeaks('v2:other', { dir })).data), [9]);
        for (const name of fs.readdirSync(dir)) assert.match(name, /^[0-9a-f]{40}\.bin$/);
        assert.equal(fs.existsSync(path.join(dir, '..', '..', 'escape')), false);
    });

    test('bad input is refused and nothing is written', async () => {
        const before = fs.readdirSync(dir).length;
        for (const key of ['', null, undefined, 42, {}, 'a\0b', 'x'.repeat(MAX_KEY + 1)]) {
            assert.deepEqual(await writePeaks(key, bytes(), { dir }), { success: false }, String(key).slice(0, 12));
            assert.deepEqual(await readPeaks(key, { dir }), { success: false });
        }
        for (const data of [null, undefined, 'text', [1, 2, 3], new Uint8Array(0), new Uint8Array(MAX_BYTES + 1)]) {
            assert.deepEqual(await writePeaks('fine-key', data, { dir }), { success: false });
        }
        assert.equal(fs.readdirSync(dir).length, before);
    });

    test('a damaged (empty or oversized) saved file is a miss', async () => {
        await writePeaks('damaged', bytes(), { dir });
        const file = path.join(dir, require('crypto').createHash('sha1').update('damaged').digest('hex') + '.bin');
        assert.equal(fs.statSync(file).size, 1000);
        fs.writeFileSync(file, Buffer.alloc(0));
        assert.deepEqual(await readPeaks('damaged', { dir }), { success: false });
        fs.writeFileSync(file, Buffer.alloc(MAX_BYTES + 1));
        assert.deepEqual(await readPeaks('damaged', { dir }), { success: false });
    });

    test('the folder is in the settings folder, not next to the code', () => {
        storagePaths.setConfigDir(dir, dir);
        try {
            assert.equal(storagePaths.getPeaksDir(), path.join(dir, 'waveform-peaks'));
        } finally {
            storagePaths.setConfigDir(null);
        }
    });

    test('main.js registers both channels, and preload and the page-side map list the same two calls', () => {
        const root = path.join(__dirname, '..', '..');
        const main = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');
        assert.match(main, /ipcMain\.handle\('waveform-peaks:get', async \(event, key\) => readPeaks\(key\)\)/);
        assert.match(main, /ipcMain\.handle\('waveform-peaks:set', async \(event, key, bytes\) => writePeaks\(key, bytes\)\)/);
        const preload = fs.readFileSync(path.join(root, 'electron', 'preload.js'), 'utf8');
        assert.match(preload, /getWaveformPeaks: \(key\) => ipcRenderer\.invoke\('waveform-peaks:get', key\)/);
        assert.match(preload, /setWaveformPeaks: \(key, bytes\) => ipcRenderer\.invoke\('waveform-peaks:set', key, bytes\)/);
        const api = fs.readFileSync(path.join(root, 'src', 'js', 'api', 'desktop-api.js'), 'utf8');
        assert.match(api, /getWaveformPeaks: 'invoke'/);
        assert.match(api, /setWaveformPeaks: 'invoke'/);
    });
});

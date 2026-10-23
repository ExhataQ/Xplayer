// Tests for the waveform scaling in src/ui-next/views/playback/waveform.js (task PC-03).
// Pure logic: runs in Node, no browser needed. The module only touches the browser when drawing or decoding.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const waveModule = import(pathToFileURL(path.join(__dirname, '../../src/ui-next/views/playback/waveform.js')).href);

// A track of `bins` slices with one sample per slice, so each slice's level is exactly the sample's size.
const track = (levels) => [Float32Array.from(levels)];
const spread = (bytes) => ({ lowest: Math.min(...bytes), highest: Math.max(...bytes), share: bytes.filter((v) => v > 230).length / bytes.length });

test('silence and empty input give all zero bytes', async () => {
    const { computePeaks } = await waveModule;
    assert.deepEqual(Array.from(computePeaks([], 3)), [0, 0, 0]);
    assert.deepEqual(Array.from(computePeaks([new Float32Array(10)], 3)), [0, 0, 0]);
});

test('the shape is kept: louder slices never draw shorter than quieter ones', async () => {
    const { computePeaks } = await waveModule;
    const levels = [0, 0.1, 0.5, 0.25, 0.3, 0.05, 0.4, 0.2, 0.35, 0.15];
    const out = Array.from(computePeaks(track(levels), levels.length));
    for (let a = 0; a < levels.length; a++) for (let b = 0; b < levels.length; b++) if (levels[a] < levels[b]) assert.ok(out[a] <= out[b], `${levels[a]} vs ${levels[b]}`);
    assert.equal(Math.max(...out), 255);
    assert.equal(out[0], 0);
});

test('a loud, compressed track no longer fills most bars (the reported problem)', async () => {
    const { computePeaks } = await waveModule;
    // Real samples, not levels. Loud mastering: the average level moves between about 0.1 and 0.35, but every slice still holds
    // one sharp peak near full scale (a drum hit, a clipped sample). The first version drew the peak, so every bar came out full.
    const bins = 200;
    const per = 200;
    const samples = new Float32Array(bins * per);
    for (let bin = 0; bin < bins; bin++) {
        const level = 0.35 + 0.15 * Math.sin(bin / 9) * Math.cos(bin / 4) - (bin % 40 < 3 ? 0.25 : 0);
        for (let k = 0; k < per; k++) samples[bin * per + k] = level * Math.sin((2 * Math.PI * k) / 20);
        samples[bin * per] = 0.95;
    }
    const peakOf = (bin) => samples.slice(bin * per, (bin + 1) * per).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    const oldStyle = Array.from({ length: bins }, (_, bin) => Math.round((peakOf(bin) / 0.95) * 255)); // the first version's result
    assert.ok(spread(oldStyle).share > 0.9, 'setup: the old scaling drew almost every bar near full height');
    const out = Array.from(computePeaks([samples], bins));
    const { lowest, highest, share } = spread(out);
    assert.ok(lowest <= 20, `quiet parts reach the floor, got ${lowest}`);
    assert.equal(highest, 255);
    assert.ok(share < 0.2, `fewer than 20% of the bars near full height, got ${Math.round(share * 100)}%`);
});

test('a quiet track and the same track made 4 times louder draw the same shape', async () => {
    const { computePeaks } = await waveModule;
    const base = Array.from({ length: 100 }, (_, i) => 0.05 + 0.04 * Math.abs(Math.sin(i / 5)));
    const quiet = Array.from(computePeaks(track(base), 100));
    const loud = Array.from(computePeaks(track(base.map((v) => v * 4)), 100));
    assert.deepEqual(loud, quiet);
});

test('a flat track is not stretched into false detail', async () => {
    const { computePeaks } = await waveModule;
    const flat = Array.from({ length: 100 }, (_, i) => 0.5 + (i % 2 ? 0.01 : 0));
    const out = Array.from(computePeaks(track(flat), 100));
    // The floor-to-ceiling distance is at least a quarter of the ceiling, so a 2% wobble stays a small difference.
    assert.ok(Math.max(...out) - Math.min(...out) < 200, `range ${Math.min(...out)}..${Math.max(...out)}`);
});

test('saved peaks from the old scaling are not reused: the cache key carries a version', async () => {
    const { PEAKS_VERSION } = await waveModule;
    assert.ok(PEAKS_VERSION >= 2);
});

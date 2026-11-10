'use strict';

// Phase 6.5: the switch in main.js and the pure parts of tools/dev/bench-gpu.js (the run itself needs a screen and takes minutes).

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseArgs, median, summarizeFrames, buildTable } = require('../dev/bench-gpu');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

describe('hardware acceleration switch and benchmark', () => {
    test('main.js keeps acceleration off unless XPLAYER_GPU=on', () => {
        const main = read('electron', 'main.js');
        assert.match(main, /process\.env\.XPLAYER_GPU === 'on'/);
        assert.match(main, /if \(!gpuOn\) app\.disableHardwareAcceleration\(\);/);
        assert.equal((main.match(/disableHardwareAcceleration\(\)/g) || []).length, 1, 'one place decides');
    });

    test('npm run bench:gpu runs the script, which exists', () => {
        assert.equal(JSON.parse(read('package.json')).scripts['bench:gpu'], 'node tools/dev/bench-gpu.js');
        assert.ok(fs.existsSync(path.join(ROOT, 'tools', 'dev', 'bench-gpu.js')));
    });

    test('parseArgs: defaults, and the three numbers', () => {
        assert.deepEqual(parseArgs([]), { rounds: 3, seconds: 6, count: 1500 });
        assert.deepEqual(parseArgs(['--rounds=5', '--seconds=8', '--count=3000', '--x=1']), { rounds: 5, seconds: 8, count: 3000 });
    });

    test('median', () => {
        assert.equal(median([3, 1, 2]), 2);
        assert.equal(median([4, 1, 3, 2]), 2.5);
        assert.equal(median([null, undefined, 5]), 5);
        assert.equal(median([]), null);
    });

    test('summarizeFrames: 60 fps steady, one slow frame, too few frames', () => {
        const steady = summarizeFrames(Array(120).fill(1000 / 60));
        assert.equal(steady.fps, 60);
        assert.equal(steady.over20, 0);
        const slow = summarizeFrames([...Array(99).fill(16), 50]);
        assert.equal(slow.over20, 1);
        assert.equal(slow.over33, 1);
        assert.equal(slow.p99, 50);
        assert.equal(summarizeFrames([16]).fps, null);
        assert.equal(summarizeFrames(null).frames, 0);
    });

    test('buildTable: one row per setting, medians, n/a for a missing number', () => {
        const mk = (gpu, fps) => ({ gpu, startupMs: 1000, scroll: { fps, p99: 20, over20: 2, busy: 30 }, waveform: { fps, p99: 18, over20: 1, busy: 20 } });
        const table = buildTable([mk('off', 50), mk('off', 60), mk('on', 58), { gpu: 'on', startupMs: 900 }]);
        const lines = table.split('\n');
        assert.equal(lines.length, 3);
        assert.match(lines[1], /^acceleration off\s+1000\s+55\s/);
        assert.match(lines[2], /^acceleration on\s+950\s+58\s/);
        assert.match(buildTable([{ gpu: 'off' }]), /n\/a/);
    });
});

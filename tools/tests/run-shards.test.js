'use strict';

// The test split used by CI (.github/workflows/test.yml) and by `run.js --shard`. Every test file must run in exactly
// one place: the unit files in the unit job, the browser files in exactly one of the shards. These tests fail if a
// shard overlaps another, drops a file, or the workflow and the runner disagree about the number of shards.
//
// Run:   node --test tools/tests/run-shards.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { discover, parseArgs, shardFiles, effectiveConcurrency, SHARD_SECONDS, DEFAULT_SECONDS } = require('./run.js');

const ROOT = path.resolve(__dirname, '..', '..');
const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'test.yml'), 'utf8');
const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
const names = (files) => files.map((f) => f.file).sort();

test('for every number of shards, the parts are disjoint and together are every file', () => {
    const all = discover();
    for (const group of ['all', 'unit', 'browser']) {
        const files = all.filter((f) => group === 'all' || f.kind === group);
        for (const count of [1, 2, 3, 4, 7]) {
            const seen = [];
            for (let index = 1; index <= count; index++) seen.push(...shardFiles(files, index, count));
            assert.deepEqual(names(seen), names(files), `${group}, ${count} shards`);
        }
    }
});

test('the split does not depend on the order the files are listed in', () => {
    const files = discover().filter((f) => f.kind === 'browser');
    const reversed = files.slice().reverse();
    for (let index = 1; index <= 3; index++) {
        assert.deepEqual(shardFiles(files, index, 3).map((f) => f.file), shardFiles(reversed, index, 3).map((f) => f.file));
    }
});

test('the parts take about equally long by the table: no part exceeds the average by more than the heaviest file', () => {
    const files = discover().filter((f) => f.kind === 'browser');
    const weight = (f) => (f.file in SHARD_SECONDS ? SHARD_SECONDS[f.file] : DEFAULT_SECONDS);
    const loads = [1, 2, 3].map((i) => shardFiles(files, i, 3).reduce((s, f) => s + weight(f), 0));
    const average = loads.reduce((s, v) => s + v, 0) / 3;
    assert.ok(Math.max(...loads) <= average + Math.max(...files.map(weight)), `part loads ${loads.join(', ')}`);
});

test('every file named in the weight table exists (a renamed file would silently lose its weight)', () => {
    const present = new Set(discover().map((f) => f.file));
    const missing = Object.keys(SHARD_SECONDS).filter((f) => !present.has(f));
    assert.deepEqual(missing, []);
});

test('--shard is validated', () => {
    assert.deepEqual(parseArgs(['browser', '--shard=2/3']).shard, { index: 2, count: 3 });
    for (const bad of ['--shard=0/3', '--shard=4/3', '--shard=2', '--shard=a/b', '--shard=1/0']) {
        assert.throws(() => parseArgs([bad]), /--shard=i\/n/, bad);
    }
});

test('the workflow and the runner agree: the matrix is 1..N and every command says /N', () => {
    const matrix = /shard:\s*\[([^\]]*)\]/.exec(workflow);
    assert.ok(matrix, 'the browser job has a shard matrix');
    const parts = matrix[1].split(',').map((s) => Number(s.trim()));
    const commands = [...workflow.matchAll(/run\.js browser --shard=\$\{\{ matrix\.shard \}\}\/(\d+)/g)].map((m) => Number(m[1]));
    assert.equal(commands.length, 1, 'one browser command that uses the matrix value');
    assert.deepEqual(parts, Array.from({ length: commands[0] }, (_, i) => i + 1), 'matrix entries are 1..N where N is the number after the slash');
});

test('the workflow runs the unit files and the browser files, and the quick script runs the unit files and lint', () => {
    assert.match(workflow, /run: npm run test:quick/, 'the unit job runs test:quick');
    assert.match(scripts['test:quick'], /run\.js unit\b/);
    assert.match(scripts['test:quick'], /tools\/lint\.js/);
    assert.match(scripts['test:fast'], /run\.js browser --concurrency=4/);
});

test('files at once never exceed the number of cores, and never go below one', () => {
    assert.equal(effectiveConcurrency(4, 8), 4);
    assert.equal(effectiveConcurrency(4, 4), 4);
    assert.equal(effectiveConcurrency(4, 2), 2);
    assert.equal(effectiveConcurrency(4, 1), 1);
    assert.equal(effectiveConcurrency(1, 16), 1);
    assert.equal(effectiveConcurrency(4, 0), 1);
});

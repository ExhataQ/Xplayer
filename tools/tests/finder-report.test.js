'use strict';

// The pure parts of tools/dev/finder-report.js (task PD-04): choosing the songs and building the rows. The tool itself needs the internet.
// Run:   node --test tools/tests/finder-report.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { selectSample, reportRow, summarizeCandidates, toMarkdown } = require('../dev/finder-report');

const library = Array.from({ length: 100 }, (_, i) => ({ id: i, title: `T${i}`, artist: i % 10 === 0 ? 'Unknown Artist' : `A${i}`, album: 'X', url: `file:///m/${i}.mp3` }));
library.push({ id: 200, title: '', artist: 'No title', url: 'file:///m/x.mp3' }, { id: 201, title: 'No url', artist: 'A' });

test('selectSample: only songs with a title, a known artist and a file; spread evenly; the count asked for', () => {
    const sample = selectSample(library, 20);
    assert.equal(sample.length, 20);
    assert.ok(sample.every((s) => s.title && s.artist !== 'Unknown Artist' && s.url));
    const ids = sample.map((s) => s.id);
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b), 'in library order');
    assert.ok(ids[ids.length - 1] - ids[0] > 60, 'taken across the whole library, not from the start');
});

test('selectSample: a seed gives a repeatable shuffle, another seed another one; fewer songs than asked gives them all', () => {
    const a = selectSample(library, 10, 7).map((s) => s.id);
    assert.deepEqual(selectSample(library, 10, 7).map((s) => s.id), a);
    assert.notDeepEqual(selectSample(library, 10, 8).map((s) => s.id), a);
    assert.equal(selectSample(library.slice(0, 5), 20).length, 4, 'one of the five has no known artist');
    assert.deepEqual(selectSample(null, 5), []);
});

test('reportRow: same release is "same", another release is not, and the popularity note is kept apart', () => {
    const song = { title: 'Song', artist: 'Band', album: 'Greatest Hits' };
    const original = { decision: 'review', confidence: 0.7, release: { id: 'r1', title: 'Debut', date: '1991-09-24' }, reasons: ['earliest'] };
    const popular = { decision: 'review', confidence: 0.8, release: { id: 'r2', title: 'Second', date: '1994' }, reasons: ['popularity 90%', 'earliest'] };
    const row = reportRow(song, original, popular);
    assert.equal(row.same, false);
    assert.equal(row.original, 'Debut (1991) 70% review');
    assert.equal(row.popularWhy, 'popularity 90%');
    assert.equal(reportRow(song, original, { ...original }).same, true);
    const none = reportRow(song, { decision: 'none', confidence: 0, release: null, reasons: ['no releases found'] }, { decision: 'none', confidence: 0, release: null, reasons: [] });
    assert.equal(none.original, 'none: no releases found');
    assert.equal(none.same, true);
});

test('toMarkdown: one line per song, a pipe in a title cannot break the table, a difference is bold', () => {
    const md = toMarkdown([{ song: 'A | B - C', inFile: 'x', original: 'o', popular: 'p', why: 'w', popularWhy: '', same: false }]);
    const lines = md.split('\n');
    assert.equal(lines.length, 3);
    assert.ok(lines[2].includes('A / B - C'));
    assert.ok(lines[2].includes('**no**'));
});

// The first real run failed with "Cannot read properties of undefined (reading 'getPath')": with the electron package installed, plain Node's
// require('electron') is the path of the program as a string. This reproduces that with a fake package, in a separate process.
test('the finder loads and finds its cache folder in plain Node even when require("electron") is just a path string', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-fake-electron-'));
    fs.mkdirSync(path.join(root, 'node_modules', 'electron'), { recursive: true });
    fs.writeFileSync(path.join(root, 'node_modules', 'electron', 'index.js'), "module.exports = 'C:\\\\fake\\\\electron.exe';\n");
    const script = `
        const real = require('electron');
        if (typeof real !== 'string' || real.app !== undefined) throw new Error('the fake package is not what the test thinks it is');
        const { installElectronStub } = require(${JSON.stringify(path.join(__dirname, '..', 'dev', 'finder-report.js'))});
        const folder = installElectronStub(${JSON.stringify(path.join(root, 'cache'))});
        require(${JSON.stringify(path.join(__dirname, '..', '..', 'electron', 'tag-finder.js'))}).createTagFinder();
        const api = require(${JSON.stringify(path.join(__dirname, '..', '..', 'electron', 'online-metadata.js'))});
        const answer = require('electron').app.getPath('userData');
        if (answer !== folder) throw new Error('wrong folder: ' + answer);
        console.log('ok ' + typeof api.searchOnlineMetadata);
    `;
    const result = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, NODE_PATH: path.join(root, 'node_modules') }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok function/);
});

test('summarizeCandidates: how many releases and of which kinds, and the earliest three; nothing for nothing', () => {
    const rel = (title, date, primaryType, secondaryTypes = [], status = 'Official') => ({ title, date, primaryType, secondaryTypes, status });
    const summary = summarizeCandidates([
        rel('Hits 2000', '2000-05', 'Album', ['Compilation']), rel('Hits 2001', '2001', 'Album', ['Compilation']), rel('Hits 2002', '2002', 'Album', ['Compilation']),
        rel('The Single', '2009-11', 'Single'), rel('The Album', '2009-02', 'Album'), rel('Undated', '', 'Album')
    ]);
    assert.equal(summary.count, 6);
    assert.match(summary.kinds, /^Album\+Compilation x3, /);
    assert.match(summary.kinds, /Single x1/);
    assert.equal(summary.earliest, 'Hits 2000 (2000, Album+Compilation, Official); Hits 2001 (2001, Album+Compilation, Official); Hits 2002 (2002, Album+Compilation, Official)');
    assert.deepEqual(summarizeCandidates([]), { count: 0, kinds: '', earliest: '' });
    assert.deepEqual(summarizeCandidates(undefined), { count: 0, kinds: '', earliest: '' });
});

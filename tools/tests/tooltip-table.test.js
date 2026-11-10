'use strict';

// B7: the generator behind .agent/archive/polish-2/TOOLTIP-TABLE.md (tools/dev/tooltip-table.js). It reads source text only, so no browser is needed.
// The file on disk is not compared here: other work adds tooltips, and the table is simply made again (`--check` tells when it is behind).
//
// Run:   node --test tools/tests/tooltip-table.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '..', 'dev', 'tooltip-table.js');
const run = () => execFileSync(process.execPath, [SCRIPT, '--stdout'], { encoding: 'utf8' });
const rowsOf = (text) => text.split('\n').filter((line) => /^\| T[0-9a-f]{5} \|/.test(line)).map((line) => line.split(/(?<!\\)\|/).map((c) => c.trim()));

test('the table is the same every time it is made', () => {
    assert.equal(run(), run());
});

test('every row has an id nobody else has, some text, and a place in the source', () => {
    const rows = rowsOf(run());
    assert.ok(rows.length > 50, `only ${rows.length} rows`);
    assert.equal(new Set(rows.map((r) => r[1])).size, rows.length, 'ids repeat');
    for (const [, id, , name, state, description, , source] of rows) {
        assert.ok(name || state || description, `${id} has no text`);
        assert.match(source, /\.(js|html):\d+/, `${id} has no source`);
    }
});

test('it finds the tooltips of each kind of source', () => {
    const rows = rowsOf(run());
    const has = (control, name) => rows.some((r) => r[2].includes(control) && r[3].startsWith(name));
    assert.ok(has('rail library', 'Library'), 'rail');
    assert.ok(rows.some((r) => r[2] === 'player shuffle' && r[3].startsWith('Shuffle') && r[6] === 'S'), 'player button with its shortcut');
    assert.ok(has('icon link', 'Play from URL'), 'iconButton label');
    assert.ok(has('#back-btn', 'Go back'), 'engine data-original-title');
});

test('buttons that opted out and the plumbing that moves text are not rows', () => {
    const text = run();
    assert.ok(!/\| Dismiss \|/.test(text), 'a tooltip: false button is listed');
    assert.ok(!/\{titleText\}/.test(text), 'the engine\u2019s generic title loop is listed');
});

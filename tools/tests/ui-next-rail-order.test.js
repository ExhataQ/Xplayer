'use strict';

// PD-07 (brief 3.1): Metadata and Lyrics sit above Settings in the rail, in the bottom group, and open in the main view.
// Static: it reads the VIEWS list in src/ui-next/shell/shell.js, so it needs no browser. The look of the rail (colors, fills, motion)
// is covered by ui-next-rail.test.js.
// Run: node --test tools/tests/ui-next-rail-order.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'ui-next', 'shell', 'shell.js'), 'utf8');
const block = source.slice(source.indexOf('const VIEWS = ['), source.indexOf('];', source.indexOf('const VIEWS = [')));
const views = [...block.matchAll(/^\s*\{ id: ([^,]+), (.*)\}[,]?\s*$/gm)].map((m) => ({ id: m[1].replace(/['"]/g, ''), line: m[2] }));
const railed = views.filter((v) => !/rail: false/.test(v.line));
const ids = railed.map((v) => v.id);

test('the rail lists Home, Library, Search, Recent, then Lyrics, Metadata and Settings', () => {
    assert.deepEqual(ids, ['home', 'library', 'search', 'recent', 'lyrics', 'metadata', 'settings']);
});

test('Metadata is directly above Settings and Lyrics directly above Metadata', () => {
    assert.equal(ids.indexOf('metadata') + 1, ids.indexOf('settings'));
    assert.equal(ids.indexOf('lyrics') + 1, ids.indexOf('metadata'));
});

test('Lyrics, Metadata and Settings are the bottom group; the panel items and Home are not', () => {
    for (const v of railed) assert.equal(/\bend: true\b/.test(v.line), ['lyrics', 'metadata', 'settings'].includes(v.id), v.id);
});

test('Metadata is a main view: it mounts a page, and it does not own the left panel', () => {
    const metadata = railed.find((v) => v.id === 'metadata');
    assert.match(metadata.line, /mount: mountMetadata/);
    assert.doesNotMatch(metadata.line, /\bpanel:/);
});

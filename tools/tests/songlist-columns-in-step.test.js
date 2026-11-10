'use strict';

// The track list's header and its rows must lay their columns out the same way, or a row's cells stop lining up under their header.
// There are two places that write the grid (the header in views/library/song-list.css, the rows in adapter/songlist-rows.css), so this reads
// both style sheets and fails when one gets a column size, a gap or a template the other does not. (What really lines up in a browser, with
// the scrollbar measured, is what tools/dev/measure-states.js is for.) Run: node --test tools/tests/songlist-columns-in-step.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { parse } = require('../dev/state-size-scan');

const sheets = ['src/ui-next/views/library/song-list.css', 'src/ui-next/adapter/songlist-rows.css'].flatMap((file) => parse(file));
const isHead = (sel) => /(^|[\s,>])\.songlist-head(?![\w-])/.test(sel) && !/__/.test(sel);
const COLUMN_PROPS = /^(--sl-[\w-]+|grid-template-columns|column-gap)$/;

const collect = (test) => {
    const out = new Set();
    for (const rule of sheets) {
        for (const part of rule.selector.split(',').map((x) => x.trim())) {
            if (!test(part)) continue;
            // only the plain header or row itself (no state, no inner cell): `.songlist-head`, `.view-host[...] .songlist-head`, `.view-host[...] .song-item`
            if (/::|:hover|:focus|\.selected|\.playing|\.lazy-skeleton|__|>\s*\./.test(part.replace(/\.view-host\[[^\]]*\]/g, ''))) continue;
            for (const [prop, value] of Object.entries(rule.decls)) if (COLUMN_PROPS.test(prop)) out.add(`${prop}: ${value}`);
        }
    }
    return out;
};

// The header may also set things that are only its own (the scrollbar room it keeps is padding, not a column), and the host sets the
// variables for both. What matters: every column rule that reaches one reaches the other.
test('the header and the rows get the same column template', () => {
    const head = collect(isHead);
    const rows = collect((sel) => /\.view-host\[data-songlist\][^,]*\.song-item$|^\.view-host\[data-songlist\] \.song-item$/.test(sel.replace(/\[data-rating-column='on'\]/g, '')));
    const templates = (set) => [...set].filter((x) => x.startsWith('grid-template-columns')).sort();
    assert.ok(templates(head).length >= 2, 'the header has its template (four columns, and five with Rating)');
    assert.deepEqual(templates(head), templates(rows));
});

test('the header and the rows get the same gap and the same column size overrides', () => {
    const head = collect(isHead);
    const rows = collect((sel) => /\.song-item$/.test(sel.replace(/\[data-rating-column='on'\]/g, '')) && /data-songlist/.test(sel));
    const sizes = (set) => [...set].filter((x) => !x.startsWith('grid-template-columns')).sort();
    // what the header sets for narrow windows (--sl-album: 0px, --sl-rating: 0px, --sl-side, --sl-gap, --sl-right) the rows set too
    assert.ok(sizes(head).length >= 4 && sizes(rows).length >= 4, 'both have column rules to compare');
    const headOnly = sizes(head).filter((x) => !sizes(rows).includes(x));
    assert.deepEqual(headOnly, [], 'a column rule only the header has: the rows would not follow it');
    const rowsOnly = sizes(rows).filter((x) => !sizes(head).includes(x));
    assert.deepEqual(rowsOnly, [], 'a column rule only the rows have: the header would not follow it');
});

test('both use the same side padding, and the header adds only the scrollbar to its right side', () => {
    const rule = (re) => sheets.find((r) => r.decls.padding && r.selector.split(',').some((s) => re.test(s.trim())));
    const head = rule(/^\.songlist-head$/);
    const row = rule(/^\.view-host\[data-songlist\] \.song-item$/);
    assert.match(head.decls.padding, /^0 calc\(var\(--sl-side\) \+ var\(--sl-scrollbar, 0px\)\) 0 var\(--sl-side\)$/);
    assert.equal(row.decls.padding, '0 var(--sl-side)');
    assert.equal(head.decls['column-gap'], 'var(--sl-gap)');
    assert.equal(row.decls['column-gap'], 'var(--sl-gap)');
});

test('the header\'s sort button for Rating exists next to its label, and the cells keep their own columns', () => {
    const fs = require('fs');
    const js = fs.readFileSync(path.join(__dirname, '..', '..', 'src/ui-next/views/library/song-list.js'), 'utf8');
    assert.match(js, /sortButton\('rating', 'Rating'\)/);
    assert.match(js, /engineEvent\('ratings:changed'/, 'a list sorted by rating is drawn again when a rating changes');
    assert.match(js, /changeListSort\(now\.view, null, 'asc'\)/, 'turning the system off ends a sort by rating');
});

'use strict';

// B8 guard: in the new interface's own style sheets, no state (hover, focus, pressed, selected, playing, past, open ...) may change the size or
// weight of text: font-size, font-weight, letter-spacing, line-height. A heavier or larger letter is wider, so a line near the edge of its row
// wraps and the whole list moves (this is how the playing line of the right panel lyrics grew, `.rp-line--active { font-weight: 600 }`).
// Read from the style sheets, no browser; the measurement (node tools/dev/measure-states.js) proves what really moves.
// Only one thing is allowed: the song number cell hides its digit with font-size 0 to show a play mark in its place; its box has a fixed size.
//
// Run: node --test tools/tests/states-keep-size.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scan } = require('../dev/state-size-scan');

const TEXT = /^(font-size|font-weight|font|letter-spacing|line-height)$/;
const ALLOWED = [{ file: 'src/ui-next/adapter/songlist-rows.css', selector: /\.song-number-item$/, prop: 'font-size', now: '0' }];

test('no state rule of src/ui-next changes the size or weight of text (except the song number swap)', () => {
    const found = scan()
        .filter((f) => f.file.startsWith('src/ui-next/') && !f.pseudo && TEXT.test(f.prop))
        .filter((f) => !ALLOWED.some((a) => a.file === f.file && a.selector.test(f.selector) && a.prop === f.prop && a.now === f.now));
    assert.deepEqual(found.map((f) => `${f.file}:${f.line} ${f.selector} { ${f.prop}: ${f.now} }`), []);
});

test('the scan sees the BEM modifier that caused the right-panel lyrics bug', () => {
    const { parse } = require('../dev/state-size-scan');
    const rules = parse('src/ui-next/views/playback/player-bar.css');
    assert.ok(rules.some((r) => r.selector === '.rp-line--active'), 'the playing line rule exists');
    const lineActive = rules.find((r) => r.selector === '.rp-line--active');
    assert.equal(lineActive.decls['font-weight'], undefined, 'and does not set a weight');
});

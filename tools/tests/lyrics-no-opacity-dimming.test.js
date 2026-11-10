'use strict';

// B8: the lyric lines (View page and right panel) are dimmed by colour, never by opacity. A line at less than full opacity is drawn in its own layer
// with lighter text smoothing, so the playing line looks bigger or bolder the moment it returns to full opacity.
//
// Run: node --test tools/tests/lyrics-no-opacity-dimming.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'ui-next', 'views', 'tools', 'lyrics.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));

test('no rule of the lyric lines sets an opacity below 1', () => {
    const lyric = rules.filter((r) => /lyrics-line|track-lyrics-line/.test(r.selector));
    assert.ok(lyric.length > 5);
    const dim = lyric.filter((r) => /opacity:\s*(0?\.\d+|0)\s*;?/.test(r.body));
    assert.deepEqual(dim.map((r) => r.selector), []);
});

test('the engine\'s opacity on synced lines is switched back to 1 for the View page and the right panel', () => {
    const has = (re) => rules.some((r) => re.test(r.selector) && /opacity:\s*1\b/.test(r.body));
    assert.ok(has(/lyrics-view-synced \.lyrics-line\.synced-past/), 'View page, past line');
    assert.ok(has(/track-lyrics-synced \.track-lyrics-line\.synced-active/), 'right panel, playing line');
    assert.ok(has(/track-lyrics-line:hover/), 'right panel, hovered line');
});

test('every dimmed line keeps its brightness hierarchy through colour', () => {
    assert.match(css, /\.lyrics-line:not\(\.lyrics-line-empty\)\s*\{[^}]*color:\s*color-mix\(/);
    assert.match(css, /track-lyrics-synced \.track-lyrics-line\s*\{[^}]*color:\s*color-mix\(/);
});

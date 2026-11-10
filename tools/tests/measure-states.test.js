'use strict';

// tools/dev/measure-states.js: the comparison and the report of the state-size measurement (B8). The browser part is run by hand
// (node tools/dev/measure-states.js); what is checked here needs no browser.
//
// Run: node --test tools/tests/measure-states.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { differences, render } = require('../dev/measure-states');

const font = '14px / 400 / normal / none / 1';
const cell = (over = {}) => ({ x: 12, y: 6, w: 200, h: 20, lines: 1, font, ...over });
const item = (cells, over = {}) => ({ w: 400, h: 32, own: '14px / 400 / none / 1', cells, ...over });

test('a difference under half a pixel is rounding, not movement', () => {
    assert.deepEqual(differences(item({ title: cell() }), item({ title: cell({ x: 12.3, w: 200.4 }) }, { w: 400.4 })), []);
});

test('item size, and each inner element\'s place, size, text rows and font are reported by name', () => {
    const out = differences(item({ 'span.title[1]': cell() }), item({ 'span.title[1]': cell({ x: 20, lines: 2, font: '14px / 600 / normal / none / 1' }) }, { h: 36 }));
    assert.ok(out.some((d) => d === 'item height: 32 -> 36'));
    const inner = out.find((d) => d.startsWith('span.title[1]:'));
    assert.ok(inner && /x 12 -> 20/.test(inner) && /text rows 1 -> 2/.test(inner) && /font 14px \/ 400/.test(inner));
});

test('an element that is not drawn after (a number swapped for a play mark) is not movement, and the others still are compared', () => {
    const before = item({ 'span.number[0]': cell({ x: 4 }), 'span.title[1]': cell({ x: 60 }) });
    assert.deepEqual(differences(before, item({ 'span.title[1]': cell({ x: 60 }) })), []);
    assert.equal(differences(before, item({ 'span.title[1]': cell({ x: 70 }) })).length, 1);
});

test('the report says how many things moved, what was not measured, and lists each row', () => {
    const text = render([{ scenario: 'Song list rows', item: '#0 Title', state: 'hover', diff: ['item height: 32 -> 36'] }], ['Song list rows'], ['Lyrics: could not run (x)']);
    assert.match(text, /\*\*1 things moved\.\*\*/);
    assert.match(text, /Not measured:\n- Lyrics: could not run/);
    assert.match(text, /\| Song list rows \| #0 Title \| hover \| item height: 32 -> 36 \|/);
    assert.match(render([], ['a'], []), /\*\*0 things moved\.\*\*/);
});

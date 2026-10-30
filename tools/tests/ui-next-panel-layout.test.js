// Left panels: one row layout for Library, Search and Recents, and matching placeholders (PB-21).
// Pure Node: reads the stylesheets. The look itself needs a real browser. (The collapsed strip of PB-04 is gone from the shell, so its tests are gone too.)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const UI = path.resolve(__dirname, '..', '..', 'src', 'ui-next');
const read = (...parts) => fs.readFileSync(path.join(UI, ...parts), 'utf8').replace(/\r\n/g, '\n');
const rule = (css, selector) => {
    const start = css.indexOf(`${selector} {`);
    assert.ok(start >= 0, `rule ${selector}`);
    return css.slice(start, css.indexOf('}', start));
};

test('Library, Search and Recents rows share one inner left padding', () => {
    const library = read('views', 'library', 'library-panel.css');
    const lists = read('views', 'library', 'panel-lists.css');
    assert.match(library, /--panel-row-pad-x:\s*var\(--space-2\)/);
    assert.match(rule(library, '.library-panel .subfolder-row'), /padding: 0 var\(--space-3\) 0 var\(--panel-row-pad-x\)/);
    assert.match(rule(lists, '.plist-row'), /padding: 0 var\(--space-3\) 0 var\(--panel-row-pad-x\)/);
});

test('Library covers are rounded like Search and Recents, and the artist placeholder is square like its real cover', () => {
    const library = read('views', 'library', 'library-panel.css');
    assert.match(library, /\.library-panel \.left-panel-main-list \.main-item-cover-wrapper,[\s\S]*?border-radius: var\(--radius-sm\)/);
    const covers = read('adapter', 'default-covers.css');
    const artist = covers.split('\n').find((line) => line.startsWith('.cover-ph--artist'));
    assert.ok(artist && !/border-radius/.test(artist), artist);
});

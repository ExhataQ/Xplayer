// The custom scrollbar: one stylesheet, no arrow buttons, a themed thumb with a neutral choice in Settings.
// Pure Node: reads the stylesheets and scripts. How it looks needs a real browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const UI = path.resolve(__dirname, '..', '..', 'src', 'ui-next');
const read = (...parts) => fs.readFileSync(path.join(UI, ...parts), 'utf8').replace(/\r\n/g, '\n');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name === 'dev' || e.name === 'node_modules' ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('scrollbar.css hides the arrow buttons and draws a thumb from the scrollbar tokens', () => {
    const css = stripComments(read('scrollbar.css'));
    assert.match(css, /\*::-webkit-scrollbar-button\s*\{[^}]*display:\s*none/);
    assert.match(css, /\*::-webkit-scrollbar-thumb\s*\{[^}]*background-color:\s*var\(--scrollbar-thumb\)/);
    const thumb = css.match(/\*::-webkit-scrollbar-thumb\s*\{([^}]*)\}/)[1];
    assert.doesNotMatch(thumb, /(^|\s)border\s*:\s*[1-9]/, 'the thumb is flush against the wall: no gutter border');
    assert.match(css, /:root\[data-scrollbar='neutral'\]\s*\{[^}]*--scrollbar-thumb:/);
    assert.match(read('index.html'), /href="scrollbar\.css"/);
});

test('no stylesheet sets scrollbar-width or scrollbar-color (they switch the custom bar off in Chromium 121+); only "none" is allowed', () => {
    for (const file of walk(UI).filter((f) => f.endsWith('.css'))) {
        const css = stripComments(fs.readFileSync(file, 'utf8'));
        for (const m of css.matchAll(/scrollbar-(width|color)\s*:\s*([^;}]*)/g)) {
            assert.ok(m[1] === 'width' && m[2].trim() === 'none', `${path.relative(UI, file)}: ${m[0]}`);
        }
    }
});

test('the scrollbar color is a saved appearance choice, applied before the first paint, with a row in Settings', () => {
    const appearance = read('shell', 'appearance.js');
    assert.match(appearance, /SCROLLBARS = \[\s*\{ id: 'theme'[\s\S]*?\{ id: 'neutral'/);
    assert.match(appearance, /root\.dataset\.scrollbar = state\.scrollbar/);
    assert.match(read('shell', 'appearance-boot.js'), /saved\.scrollbar === 'neutral'/);
    assert.match(read('shell', 'appearance-settings.js'), /label: 'Scrollbar color'/);
});

test('the scrollbar shape (flush bar or wall tab) is a saved choice, and the tab rounds only the side away from the wall', () => {
    const appearance = read('shell', 'appearance.js');
    assert.match(appearance, /SCROLLBAR_SHAPES = \[\s*\{ id: 'bar'[\s\S]*?\{ id: 'tab'/);
    assert.match(appearance, /root\.dataset\.scrollbarShape = state\.scrollbarShape/);
    assert.match(read('shell', 'appearance-boot.js'), /saved\.scrollbarShape === 'tab'/);
    assert.match(read('shell', 'appearance-settings.js'), /label: 'Scrollbar shape'/);
    const css = stripComments(read('scrollbar.css'));
    assert.match(css, /\[data-scrollbar-shape='tab'\] \*::-webkit-scrollbar-thumb:vertical\s*\{[^}]*border-radius:\s*4px 0 0 4px/);
    assert.match(css, /\[data-scrollbar-shape='tab'\] \*::-webkit-scrollbar-thumb:horizontal\s*\{[^}]*border-radius:\s*4px 4px 0 0/);
});

test('the cat scrollbar is a saved choice (off by default), applied before the first paint, with a row in Settings', () => {
    const appearance = read('shell', 'appearance.js');
    assert.match(appearance, /SCROLLBAR_CATS = \[\s*\{ id: 'off'[\s\S]*?\{ id: 'on'/);
    assert.match(appearance, /scrollbarCat: 'off'/);
    assert.match(appearance, /root\.dataset\.scrollbarCat = state\.scrollbarCat/);
    assert.match(read('shell', 'appearance-boot.js'), /saved\.scrollbarCat === 'on'/);
    assert.match(read('shell', 'appearance-settings.js'), /label: 'Cat scrollbar'/);
    assert.match(read('shell', 'shell.js'), /installCatScrollbar\(\)/);
    assert.match(read('index.html'), /href="shell\/cat-scrollbar\.css"/);
});

test('the cat scrollbar hides the native bar only on scrollers that have a cat, and stops its motion for reduced motion', () => {
    const css = stripComments(read('shell', 'cat-scrollbar.css'));
    assert.match(css, /\[data-cat-scroll\]::-webkit-scrollbar:vertical\s*\{[^}]*width:\s*0/);
    assert.doesNotMatch(css, /\*::-webkit-scrollbar/, 'no blanket rule: scrollers without a cat keep their bar');
    assert.match(css, /\.xp-cat-layer\s*\{[^}]*pointer-events:\s*none/, 'the layer never blocks clicks on the list under it');
    // Every animation is inside the no-preference block, so reduce motion stops all of them.
    const outside = css.replace(/@media \(prefers-reduced-motion: no-preference\)\s*\{[\s\S]*?\n\}\n/, '').replace(/@keyframes[\s\S]*?\n\}\n/g, '');
    assert.doesNotMatch(outside, /animation\s*:/);
});

test('the cat scrollbar script draws nothing and watches nothing while the option is off', () => {
    const js = read('shell', 'cat-scrollbar.js');
    assert.match(js, /dataset\.scrollbarCat === 'on'/);
    assert.match(js, /attributeFilter: \['data-scrollbar-cat'\]/);
    assert.doesNotMatch(js, /localStorage|fetch\(|require\(/, 'no storage, network or Node access');
    // start() is the only place the layer and the body observer are created, and stop() undoes both.
    assert.match(js, /function stop\(\)[\s\S]*observer\.disconnect\(\)[\s\S]*layer\.remove\(\)/);
});

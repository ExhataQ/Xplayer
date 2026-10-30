'use strict';

// A-09: the page Electron's loading window shows while the library is scanned (electron/loading-page.js). The current interface keeps
// its look; the new interface shows the X in a ring on the Warm Graphite ground, like the startup view that follows it.
//
// Run: node --test tools/tests/loading-page.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const { loadingPageHtml, loadingBackground, NEXT_LOOK } = require(path.join(ROOT, 'electron', 'loading-page.js'));

// The Warm Graphite block of tokens.css, as { 'c-ground': '#0e1013', ... }
function warmGraphite() {
    const css = read('src', 'ui-next', 'tokens.css');
    const block = css.match(/:root,\s*:root\[data-theme='warm-graphite'\]\s*\{([^}]*)\}/);
    assert.ok(block, 'the Warm Graphite block was found');
    return Object.fromEntries([...block[1].matchAll(/--(c-[a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2].toLowerCase()]));
}

describe('the loading page', () => {
    test('the new look uses the Warm Graphite colors of tokens.css (a palette change fails here)', () => {
        const c = warmGraphite();
        assert.deepEqual(NEXT_LOOK, { ground: c['c-ground'], line: c['c-line'], ink: c['c-ink'], inkDim: c['c-ink-dim'], accent: c['c-accent'] });
        const html = loadingPageHtml(true);
        for (const color of Object.values(NEXT_LOOK)) assert.ok(html.includes(color), `the new page uses ${color}`);
    });

    test('the new page draws the same X as the logo', () => {
        const logo = read('src', 'ui-next', 'startup', 'logo.js');
        const paths = [...logo.matchAll(/<path d="([^"]+)"[^>]*stroke-width="(\d+)"/g)].map((m) => `${m[1]}|${m[2]}`);
        assert.equal(paths.length, 2);
        const html = loadingPageHtml(true);
        for (const p of paths) {
            const [d, width] = p.split('|');
            assert.ok(html.includes(`d="${d}"`) && html.includes(`stroke-width="${width}"`), `the X path ${d}`);
        }
    });

    test('the current interface keeps its green circle on #121212', () => {
        const html = loadingPageHtml(false);
        assert.ok(html.includes('#121212') && html.includes('#1db954'));
        assert.ok(!html.includes(NEXT_LOOK.accent));
        assert.equal(loadingBackground(false), '#121212');
    });

    test('both pages keep the ids and the ring size that updateLoadingProgress writes to', () => {
        const writer = read('electron', 'loading-window.js');
        for (const next of [false, true]) {
            const html = loadingPageHtml(next);
            for (const id of ['progress-fill', 'progress-text', 'step-title', 'step-count']) {
                assert.ok(html.includes(`id="${id}"`), `${next ? 'new' : 'current'} page has #${id}`);
                assert.ok(writer.includes(`'${id}'`), `the writer reads #${id}`);
            }
            assert.ok(html.includes('stroke-dasharray="213.6"'), 'the ring circumference the writer assumes');
        }
        assert.ok(writer.includes('const circumference = 213.6'));
    });

    test('the loading window and the main window agree on the ground color', () => {
        assert.equal(loadingBackground(true), NEXT_LOOK.ground);
        assert.ok(read('electron', 'window-manager.js').includes(`'${NEXT_LOOK.ground}'`), 'window-manager.js uses the same ground for the new interface');
    });

    test('the window picks the page from the same flag as the main window', () => {
        const src = read('electron', 'loading-window.js');
        assert.match(src, /activeEntry\(\) === NEXT_ENTRY/);
        assert.match(src, /loadingPageHtml\(next\)/);
        assert.match(src, /backgroundColor: loadingBackground\(next\)/);
    });

    test('the build copies loading-page.js next to loading-window.js (a missing file would crash the packaged app at start)', () => {
        const build = read('build', 'music_player.py');
        // The build copies every .js file in electron/ (it used to keep a list by hand, which fell behind main.js).
        assert.match(build, /os\.listdir\(electron_dir\)/);
        assert.match(build, /name\.endswith\("\.js"\)/);
        const required = [...read('electron', 'loading-window.js').matchAll(/require\('\.\/([a-z-]+)'\)/g)].map((m) => `${m[1]}.js`);
        assert.ok(required.includes('loading-page.js'));
        for (const file of required) assert.ok(fs.existsSync(path.join(ROOT, 'electron', file)), `${file} is in electron/, so the build copies it`);
    });

    test('the page contains no template placeholders and no stray interpolation', () => {
        for (const next of [false, true]) {
            const html = loadingPageHtml(next);
            assert.ok(!html.includes('${') && !html.includes('undefined'));
            assert.match(html, /<html>[\s\S]*<\/html>/);
        }
    });
});

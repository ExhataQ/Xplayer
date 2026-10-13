// 04a-ui-render-core.js is an ES module. Behavior is covered by scroll, search-ui, ui-handlers, keyboard-shortcuts,
// listener-order and the pinned call-sequence baselines; this file checks the wiring: manifest placement, that every
// top-level function is exported, that the selection Set is shared with classic code, and that the Ctrl+A listener
// it adds at load still selects every row in a real page. That its names are registered on window is checked in
// window-contract.test.js.
// Needs: acorn (devDependency). The last describe needs playwright + a browser and skips itself if missing.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const SRC = path.resolve(__dirname, '..', '..', 'src');
const FILE = '04a-ui-render-core.js';
const manifest = require('../lib/manifest').readManifest(path.resolve(SRC, '..'));
const text = fs.readFileSync(path.join(SRC, 'js', FILE), 'utf8');
const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
const exported = ast.body.filter((n) => n.type === 'ExportNamedDeclaration').map((n) => n.declaration.id.name);

describe('04a module: manifest', () => {
    test('it is a module, not a classic script', () => {
        assert.ok(manifest.modules.includes(FILE));
    });

    test('it runs after the renderers and 07a and before 06a, so its keydown listener stays ahead of 06a and 06k', () => {
        const m = manifest.modules;
        assert.ok(m.indexOf('07a-ui-actions.js') < m.indexOf(FILE));
        assert.ok(m.indexOf(FILE) < m.indexOf('06a-context-menus.js'));
        assert.ok(m.indexOf(FILE) < m.indexOf('06k-keyboard-shortcuts.js'));
    });

    test('the state it uses by bare name is declared in 04a0-ui-state.js, which loads first and publishes it', () => {
        assert.ok(manifest.modules.indexOf('04a0-ui-state.js') >= 0);
        assert.ok(manifest.modules.indexOf('04a0-ui-state.js') < manifest.modules.indexOf(FILE));
        assert.ok(!/^let (hoveredSongIndex|selectedSongId|lastSelectedIndex|selectionHighlights)\b/m.test(text));
    });
});

describe('04a module: shape', () => {
    test('every top-level function is exported and none is left unexported', () => {
        assert.ok(exported.length >= 30);
        assert.ok(!ast.body.some((n) => n.type === 'FunctionDeclaration'));
    });

    test('no inline on...= handler strings are written by this file', () => {
        assert.ok(!/\bon(click|dblclick|contextmenu|mousedown|change|input|keydown|blur|error)\s*=/.test(text));
    });
});

describe('04a module: real page', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(60);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('the shared Set is the live object; Ctrl+A selects the rows through it; clearing empties it', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
            await gotoApp(page, dir);
            assert.equal(await page.evaluate(() => selectedSongIds instanceof Set && window.selectedSongIds === selectedSongIds), true);
            await page.evaluate(() => document.getElementById('song-list').focus());
            await page.keyboard.press('Control+a');
            const size = await page.evaluate(() => selectedSongIds.size);
            assert.ok(size > 0, 'Ctrl+A selected songs');
            await page.evaluate(() => clearAllSelections());
            assert.equal(await page.evaluate(() => selectedSongIds.size), 0);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
});

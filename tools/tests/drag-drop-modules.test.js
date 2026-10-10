// D-09c: 06f-drag-drop-songs.js and 06g-drag-drop-left-panel.js are ES modules.
// What they do when dragging is covered by drag-drop.test.js (which passes unchanged on both versions). This file
// checks the wiring: manifest placement, that each file has only its one exported function (no listeners or state
// at load time, so load order cannot matter), and that the two names are still on window for 99-player.js.
// Needs: acorn (devDependency). The last test needs playwright + a browser and skips itself if missing.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const SRC = path.resolve(__dirname, '..', '..', 'src');
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const FILES = { '06f-drag-drop-songs.js': 'initSongDragToLeftPanel', '06g-drag-drop-left-panel.js': 'initLeftPanelDragAndDrop' };

describe('D-09c: manifest', () => {
    test('both files are modules and no longer classic scripts', () => {
        for (const file of Object.keys(FILES)) {
            assert.ok(manifest.modules.includes(file), `${file} should be in modules`);
            assert.ok(!manifest.js.includes(file), `${file} should not be in js`);
        }
    });

    test('they sit between 06e and 06h, in their old order', () => {
        const m = manifest.modules;
        const at = (f) => m.indexOf(f);
        assert.ok(at('06e-tooltip-titles.js') < at('06f-drag-drop-songs.js'));
        assert.ok(at('06f-drag-drop-songs.js') < at('06g-drag-drop-left-panel.js'));
        assert.ok(at('06g-drag-drop-left-panel.js') < at('06h-fullscreen-viewer.js'));
    });
});

describe('D-09c: module shape', () => {
    for (const [file, name] of Object.entries(FILES)) {
        test(`${file} only exports ${name} and registers it; nothing runs at load time`, () => {
            const ast = acorn.parse(fs.readFileSync(path.join(SRC, 'js', file), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
            const kinds = ast.body.map((n) => n.type + (n.declaration ? ':' + n.declaration.type + ':' + n.declaration.id.name : ''));
            assert.deepEqual(kinds, [`ExportNamedDeclaration:FunctionDeclaration:${name}`, 'IfStatement']);
            // The IfStatement is the guarded registration: if (typeof registerLegacyGlobals === 'function') { registerLegacyGlobals({ name }) }
            const text = fs.readFileSync(path.join(SRC, 'js', file), 'utf8');
            assert.match(text, new RegExp(`if \\(typeof registerLegacyGlobals === 'function'\\) \\{\\s+registerLegacyGlobals\\(\\{\\s+${name}\\s+\\}\\);\\s+\\}`));
        });
    }
});

describe('D-09c: real page', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(5);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('both init functions are registered on window and start-up completes without errors', async (t) => {
        if (skip) return void t.skip(skip);
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
            await gotoApp(page, dir);
            const types = await page.evaluate((names) => names.map((n) => typeof window[n]), Object.values(FILES));
            assert.deepEqual(types, ['function', 'function']);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
});

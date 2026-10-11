// 07-views.js is an ES module. Behavior is covered by view-switch-song-list-cleanup.test.js, ui-handlers.test.js and
// the event baselines; this file checks the wiring: manifest placement, that every top-level function is exported and
// registered on window together with VIEWS and listProviders, that nothing runs while the file loads, and that the
// names other files rely on are reachable by bare name in a real page.
// Needs: acorn (devDependency). The last describe needs playwright + a browser and skips itself if missing.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const SRC = path.resolve(__dirname, '..', '..', 'src');
const FILE = '07-views.js';
const SHARED = ['VIEWS', 'listProviders'];
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const source = fs.readFileSync(path.join(SRC, 'js', FILE), 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const exported = ast.body.filter((n) => n.type === 'ExportNamedDeclaration').map((n) => n.declaration.id.name);

describe('07-views module: manifest', () => {
    test('is a module and no longer a classic script', () => {
        assert.ok(manifest.modules.includes(FILE));
        assert.ok(!manifest.js.includes(FILE));
    });

    test('order: the bridge and 07a come before it, 04a and 06a after it', () => {
        const m = manifest.modules;
        const order = ['07a-ui-actions.js', FILE, '04a-ui-render-core.js', '06a-context-menus.js'].map((f) => m.indexOf(f));
        assert.ok(order.every((i) => i >= 0));
        assert.deepEqual(order, [...order].sort((a, b) => a - b));
        assert.ok(manifest.js.indexOf('core/legacy.js') >= 0);
    });

    test('isNavigatingHistory stays declared in the classic 04a0-ui-state.js', () => {
        assert.ok(manifest.js.includes('04a0-ui-state.js'));
        assert.ok(!/^(let|const|var) isNavigatingHistory\b/m.test(source));
    });
});

describe('07-views module: shape', () => {
    test('every function is exported; 36 of them', () => {
        assert.ok(!ast.body.some((n) => n.type === 'FunctionDeclaration'));
        assert.equal(exported.length, 36);
    });

    test('the guarded registration lists every exported function plus VIEWS and listProviders', () => {
        const block = source.match(/if \(typeof registerLegacyGlobals === 'function'\) \{\s+registerLegacyGlobals\(\{([^}]*)\}\);\s+\}/);
        assert.ok(block, 'guarded registration present');
        const names = block[1].split(',').map((s) => s.trim()).filter(Boolean).sort();
        assert.deepEqual(names, [...SHARED, ...exported].sort());
    });

    test('nothing runs while loading: only declarations and the registration', () => {
        const kinds = ast.body.filter((n) => n.type === 'ExpressionStatement' || n.type === 'IfStatement').map((n) => n.type);
        assert.deepEqual(kinds, ['IfStatement']);
    });

    test('VIEWS, viewConfigs, viewHandlers and listProviders are never reassigned', () => {
        for (const name of ['VIEWS', 'viewConfigs', 'viewHandlers', 'listProviders']) {
            assert.ok(!new RegExp(`(^|[^.\\w])${name}\\s*=[^=]`, 'm').test(source.replace(new RegExp(`^const ${name}\\s*=`, 'm'), '')), name);
        }
    });
});

describe('07-views module: real page', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(40);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('names are on window and VIEWS keeps its values', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
            await gotoApp(page, dir);
            const missing = await page.evaluate((list) => list.filter((n) => window[n] === undefined), [...SHARED, ...exported]);
            assert.deepEqual(missing, []);
            const views = await page.evaluate(() => ({ ...VIEWS }));
            assert.equal(views.ALL_SONGS, 'all-songs');
            assert.equal(views.SETTINGS_ADVANCED, 'settings-advanced');
            assert.equal(Object.keys(views).length, 15);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('switching views and Back/Forward work through the bare names', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
            await gotoApp(page, dir);
            const r = await page.evaluate(() => {
                switchView(VIEWS.FAVORITES);
                const a = currentView;
                switchView(VIEWS.HISTORY);
                const b = currentView;
                const back = canGoBack();
                goBack();
                const c = currentView;
                goForward();
                return { a, b, back, c, d: currentView, count: getSongCountForList(VIEWS.ALL_SONGS), flag: isNavigatingHistory };
            });
            assert.deepEqual(r, { a: 'favorites', b: 'history', back: true, c: 'favorites', d: 'history', count: r.count, flag: false });
            assert.ok(r.count > 0);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
});

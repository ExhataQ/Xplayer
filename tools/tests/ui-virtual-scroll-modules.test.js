// 05a, 05b and 05c (the virtual scroll files) are ES modules. Behavior is covered by scroll.test.js and the
// other browser tests; this file checks the wiring: manifest placement and order, that every top-level function
// is exported and registered on window together with the shared constants and state objects, that the state
// objects are never reassigned (a registered copy of a reassigned variable would go stale), and that the
// saved virtual scroll threshold is applied at start-up.
// Needs: acorn (devDependency). The last describe needs playwright + a browser and skips itself if missing.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');
const { usedOutside } = require('./helpers/bridge-use');

const SRC = path.resolve(__dirname, '..', '..', 'src');
const manifest = require('../lib/manifest').readManifest(path.resolve(SRC, '..'));
const FILES = {
    '05a-lazy-load-main-list.js': ['DEFAULT_VIRTUAL_SCROLL_THRESHOLD', 'MIN_VIRTUAL_SCROLL_THRESHOLD', 'MAX_VIRTUAL_SCROLL_THRESHOLD', 'ITEM_HEIGHT', 'virtualScrollState', 'VIRTUAL_SCROLL_SETTLE_MS'],
    '05b-lazy-load-left-panel.js': ['LEFT_ITEM_HEIGHT', 'LEFT_OVERSCAN_COUNT', 'leftPanelVirtualState'],
    '05c-lazy-load-smart-lyrics.js': ['SMART_LYRICS_ITEM_HEIGHT', 'smartLyricsVirtualState']
};
const read = (file) => fs.readFileSync(path.join(SRC, 'js', file), 'utf8');
const parse = (file) => acorn.parse(read(file), { ecmaVersion: 'latest', sourceType: 'module' });
const exportedOf = (file) => parse(file).body.filter((n) => n.type === 'ExportNamedDeclaration').map((n) => n.declaration.id.name);

describe('virtual scroll modules: manifest', () => {
    test('the three files are modules and no longer classic scripts', () => {
        for (const file of Object.keys(FILES)) {
            assert.ok(manifest.modules.includes(file), `${file} should be in modules`);
        }
    });

    test('order: 04a, then 05a, 05b, 05c, then 06a (05c reads ITEM_HEIGHT while loading)', () => {
        const m = manifest.modules;
        const order = ['04a-ui-render-core.js', '05a-lazy-load-main-list.js', '05b-lazy-load-left-panel.js', '05c-lazy-load-smart-lyrics.js', '06a-context-menus.js'].map((f) => m.indexOf(f));
        assert.ok(order.every((i) => i >= 0));
        assert.deepEqual(order, [...order].sort((a, b) => a - b));
    });

    test('the threshold variable stays declared in 04a0-ui-state.js (loaded first), which 05a assigns at load', () => {
        assert.ok(manifest.modules.indexOf('04a0-ui-state.js') >= 0);
        assert.ok(manifest.modules.indexOf('04a0-ui-state.js') < manifest.modules.indexOf('05a-lazy-load-main-list.js'));
        assert.ok(!/^(let|const|var) VIRTUAL_SCROLL_THRESHOLD\b/m.test(read('05a-lazy-load-main-list.js')));
        assert.match(read('05a-lazy-load-main-list.js'), /^VIRTUAL_SCROLL_THRESHOLD = /m);
    });
});

describe('virtual scroll modules: shape', () => {
    for (const [file, shared] of Object.entries(FILES)) {
        test(`${file}: every function is exported; those other files use are registered, plus ${shared.join(', ')}`, () => {
            const ast = parse(file);
            assert.ok(!ast.body.some((n) => n.type === 'FunctionDeclaration'), 'no function is left unexported');
            const block = read(file).match(/if \(typeof registerLegacyGlobals === 'function'\) \{\s+registerLegacyGlobals\(\{([^}]*)\}\);\s+\}/);
            assert.ok(block, 'guarded registration present');
            const names = block[1].split(',').map((s) => s.trim()).filter(Boolean).sort();
            const exported = exportedOf(file);
            for (const name of [...shared, ...exported.filter((n) => usedOutside(file, n))]) assert.ok(names.includes(name), `${name} is used by another file but not registered`);
            for (const name of names) assert.ok([...shared, ...exported].includes(name), `${name} is registered but is not exported`);
        });
    }

    test('the registered state objects are never reassigned anywhere (they are changed in place)', () => {
        const files = fs.readdirSync(path.join(SRC, 'js'), { recursive: true }).filter((f) => f.endsWith('.js'));
        for (const name of ['virtualScrollState', 'leftPanelVirtualState', 'smartLyricsVirtualState']) {
            for (const f of files) {
                const lines = read(f).split('\n').filter((l) => new RegExp(`(^|[^.\\w])${name}\\s*=[^=]`).test(l) && !/^\s*(let|const)\s/.test(l));
                assert.deepEqual(lines, [], `${f} reassigns ${name}`);
            }
        }
    });

    test('none of the three files registers a listener or emits while loading', () => {
        for (const file of Object.keys(FILES)) {
            const kinds = parse(file).body.filter((n) => n.type === 'ExpressionStatement' && !(n.expression.type === 'AssignmentExpression'));
            assert.deepEqual(kinds.map((n) => n.expression.type), [], file);
        }
    });
});

describe('virtual scroll modules: real page', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(300);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('names are on window, row heights come from the CSS, the shared state is the live object', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
            await gotoApp(page, dir);
            const all = Object.entries(FILES).flatMap(([file, shared]) => [...shared, ...exportedOf(file).filter((n) => usedOutside(file, n))]);
            const missing = await page.evaluate((list) => list.filter((n) => window[n] === undefined), all);
            assert.deepEqual(missing, []);
            const info = await page.evaluate(() => ({
                item: ITEM_HEIGHT,
                css: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--song-item-height')),
                left: LEFT_ITEM_HEIGHT,
                smart: SMART_LYRICS_ITEM_HEIGHT,
                threshold: VIRTUAL_SCROLL_THRESHOLD,
                enabled: virtualScrollState.enabled,
                same: window.virtualScrollState === virtualScrollState && window.leftPanelVirtualState === leftPanelVirtualState,
                selection: getLazyState() !== undefined
            }));
            assert.equal(info.item, info.css > 0 ? info.css : 56);
            assert.equal(info.smart, info.item);
            assert.ok(info.left > 0);
            assert.equal(info.threshold, 200, 'default threshold is applied at start-up');
            assert.equal(info.same, true);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('setVirtualScrollThreshold snaps, stores, and the classic variable follows', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
            await gotoApp(page, dir);
            const r = await page.evaluate(() => {
                const v = setVirtualScrollThreshold(330);
                return { v, bare: VIRTUAL_SCROLL_THRESHOLD, stored: localStorage.getItem('virtualScrollThreshold') };
            });
            assert.deepEqual(r, { v: 350, bare: 350, stored: '350' });
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
});

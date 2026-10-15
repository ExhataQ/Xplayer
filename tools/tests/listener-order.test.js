// Order in which files register their document and window listeners while the page loads. Several of these
// listeners depend on running in a fixed order (a Escape / outside click handled by the context menu before the
// tooltip code, keyboard shortcuts after the context menu, ...). The order of the imports in src/js/main.js
// decides when a file runs, so this records, in a real page, which file registered each listener and checks the
// order that has to hold. The page is loaded once; every test reads the same recording.
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

describe('listener registration order (real page)', { concurrency: false }, () => {
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

    // [ 'document.keydown <- core/legacy.js', ... ] in the order the listeners were added.
    async function record() {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript(() => {
            window.__registered = [];
            for (const [name, target] of [
                ['document', document],
                ['window', window]
            ]) {
                const original = target.addEventListener.bind(target);
                target.addEventListener = function (type, listener, options) {
                    const frames = (new Error().stack || '').split('\n').filter((line) => /\.js/.test(line));
                    const file = frames.map((line) => (line.match(/\/js\/([\w\-./]+\.js)/) || [])[1]).find(Boolean) || '(other)';
                    window.__registered.push(`${name}.${type} <- ${file}`);
                    return original(type, listener, options);
                };
            }
        });
        await gotoApp(page, dir);
        const list = await page.evaluate(() => window.__registered);
        await page.close();
        assert.deepEqual(errors, []);
        return list;
    }

    let recording;
    const registrations = () => (recording ||= record());

    // The files that registered `event` among `files`, in registration order, without repeats.
    const order = (list, event, files) => [...new Set(list.filter((r) => r.startsWith(event + ' <- ')).map((r) => r.split(' <- ')[1]))].filter((f) => files.includes(f));

    test('document keydown: bridge, then 04a, the context menu, and the keyboard shortcuts last', async (t) => {
        if (skip) return void t.skip(skip);
        const list = await registrations();
        assert.deepEqual(order(list, 'document.keydown', ['core/legacy.js', 'ui/04a-ui-render-core.js', 'ui/06a-context-menus.js', 'ui/06k-keyboard-shortcuts.js']), [
            'core/legacy.js',
            'ui/04a-ui-render-core.js',
            'ui/06a-context-menus.js',
            'ui/06k-keyboard-shortcuts.js'
        ]);
    });

    test('document mousedown: bridge, the context menu, then the mouse navigation buttons', async (t) => {
        if (skip) return void t.skip(skip);
        const list = await registrations();
        assert.deepEqual(order(list, 'document.mousedown', ['core/legacy.js', 'ui/06a-context-menus.js', 'ui/06k-keyboard-shortcuts.js']), [
            'core/legacy.js',
            'ui/06a-context-menus.js',
            'ui/06k-keyboard-shortcuts.js'
        ]);
    });

    test('document click: bridge, the context menu, the tooltip system, then folders/playlists', async (t) => {
        if (skip) return void t.skip(skip);
        const list = await registrations();
        assert.deepEqual(order(list, 'document.click', ['core/legacy.js', 'ui/06a-context-menus.js', 'ui/06d-tooltip-system.js', 'playlists/09-folders-playlists.js']), [
            'core/legacy.js',
            'ui/06a-context-menus.js',
            'ui/06d-tooltip-system.js',
            'playlists/09-folders-playlists.js'
        ]);
    });

    test('window resize: the context menu first, then layout and online lyrics', async (t) => {
        if (skip) return void t.skip(skip);
        const list = await registrations();
        assert.deepEqual(order(list, 'window.resize', ['ui/06a-context-menus.js', 'ui/layout.js', 'lyrics/19-online-lyrics.js']), [
            'ui/06a-context-menus.js',
            'ui/layout.js',
            'lyrics/19-online-lyrics.js'
        ]);
    });

    test('the recording sees the files it is meant to (so the checks above cannot pass on an empty list)', async (t) => {
        if (skip) return void t.skip(skip);
        const list = await registrations();
        for (const needle of ['document.keydown <- ui/06k-keyboard-shortcuts.js', 'document.click <- ui/06a-context-menus.js', 'window.resize <- ui/06a-context-menus.js']) {
            assert.ok(list.includes(needle), `${needle} not recorded`);
        }
    });
});

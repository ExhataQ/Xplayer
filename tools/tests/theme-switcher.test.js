'use strict';

// Agent D, step D-07: 06i-theme-switcher.js is an ES module (see "modules" in src/manifest.json).
//
//   - unit tests (Node, no browser): the module imports without a DOM, and the two functions
//     work against a fake document
//   - browser test (Playwright, skipped if it is missing): in the real page the theme buttons that
//     Settings draws switch the theme, and window.initThemeButtons is registered for 08e and 99-player

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const MODULE_URL = pathToFileURL(path.join(ROOT, 'src/js/06i-theme-switcher.js')).href;
const THEMES = ['green', 'pink', 'purple', 'yellow', 'white'];

// A document with just what the module uses: .settings-theme-btn buttons and a body.
function fakeDocument(extraBodyClasses = []) {
    const classList = (initial) => {
        const set = new Set(initial);
        return {
            add: (...c) => c.forEach((x) => set.add(x)),
            remove: (...c) => c.forEach((x) => set.delete(x)),
            contains: (c) => set.has(c),
            list: () => [...set].sort()
        };
    };
    const doc = { body: { classList: classList(extraBodyClasses) } };
    doc.buttons = THEMES.map((theme, i) => {
        const attrs = { 'data-theme': theme };
        const listeners = [];
        return {
            classList: classList(i === 0 ? ['settings-theme-btn', 'active'] : ['settings-theme-btn']),
            ownerDocument: doc,
            getAttribute: (n) => (n in attrs ? attrs[n] : null),
            setAttribute: (n, v) => { attrs[n] = v; },
            addEventListener: (type, fn) => { if (type === 'click') listeners.push(fn); },
            removeEventListener: (type, fn) => {
                const k = listeners.indexOf(fn);
                if (type === 'click' && k >= 0) listeners.splice(k, 1);
            },
            listeners,
            click() {
                const e = { stopped: false, stopPropagation() { this.stopped = true; } };
                for (const fn of [...listeners]) fn.call(this, e);
                return e;
            }
        };
    });
    doc.querySelectorAll = (sel) => (sel === '.settings-theme-btn' ? doc.buttons : []);
    return doc;
}

describe('06i-theme-switcher.js as a module (Node)', () => {
    test('imports without a document and exports the two functions', async () => {
        assert.equal(typeof document, 'undefined');
        const mod = await import(MODULE_URL);
        assert.equal(typeof mod.initThemeButtons, 'function');
        assert.equal(typeof mod.themeClickHandler, 'function');
    });

    test('initThemeButtons gives every button exactly one click listener, also when called again', async () => {
        const { initThemeButtons } = await import(MODULE_URL);
        const doc = fakeDocument();
        initThemeButtons(doc);
        initThemeButtons(doc);
        initThemeButtons(doc);
        assert.deepEqual(doc.buttons.map((b) => b.listeners.length), [1, 1, 1, 1, 1]);
    });

    test('a click marks the button active, sets the body theme class and the aria-label', async () => {
        const { initThemeButtons } = await import(MODULE_URL);
        const doc = fakeDocument();
        initThemeButtons(doc);
        const pink = doc.buttons[1];
        const e = pink.click();
        assert.equal(e.stopped, true, 'the click must not bubble to document');
        assert.deepEqual(doc.buttons.map((b) => b.classList.contains('active')), [false, true, false, false, false]);
        assert.deepEqual(doc.body.classList.list(), ['theme-pink']);
        assert.equal(pink.getAttribute('aria-label'), 'pink theme active');
    });

    test('switching themes leaves only the newest theme class; green removes them all and adds none', async () => {
        const { initThemeButtons } = await import(MODULE_URL);
        const doc = fakeDocument();
        initThemeButtons(doc);
        const byTheme = Object.fromEntries(doc.buttons.map((b) => [b.getAttribute('data-theme'), b]));
        byTheme.purple.click();
        byTheme.yellow.click();
        assert.deepEqual(doc.body.classList.list(), ['theme-yellow']);
        byTheme.white.click();
        assert.deepEqual(doc.body.classList.list(), ['theme-white']);
        byTheme.green.click();
        assert.deepEqual(doc.body.classList.list(), []);
        assert.equal(byTheme.green.getAttribute('aria-label'), 'green theme active');
        assert.equal(byTheme.green.classList.contains('active'), true);
        assert.equal(byTheme.white.classList.contains('active'), false);
    });

    test('other classes on body are left alone', async () => {
        const { initThemeButtons } = await import(MODULE_URL);
        const doc = fakeDocument(['collapsed', 'theme-pink']);
        initThemeButtons(doc);
        doc.buttons[3].click();
        assert.deepEqual(doc.body.classList.list(), ['collapsed', 'theme-yellow']);
    });
});

describe('theme switching in the real page', () => {
    let pw, browser, dir, skip;
    before(async () => {
        pw = loadPlaywright();
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(20);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('Settings draws the theme buttons, each click switches the theme once and does not reach document', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await gotoApp(page, dir);
        const out = await page.evaluate(async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const registered = typeof window.initThemeButtons;
            toggleSettingsPanel();
            await sleep(300);
            let documentClicks = 0;
            document.addEventListener('click', () => { documentClicks++; });
            const buttons = [...document.querySelectorAll('.settings-theme-btn')];
            const themeClasses = () => [...document.body.classList].filter((c) => c.startsWith('theme-'));
            const steps = [];
            for (const theme of ['pink', 'purple', 'yellow', 'white', 'green']) {
                const btn = buttons.find((b) => b.getAttribute('data-theme') === theme);
                btn.click();
                steps.push({
                    theme,
                    classes: themeClasses(),
                    active: buttons.filter((b) => b.classList.contains('active')).map((b) => b.getAttribute('data-theme')),
                    label: btn.getAttribute('aria-label')
                });
            }
            // Drawing Settings again re-creates the buttons and calls initThemeButtons() again.
            toggleSettingsPanel();
            await sleep(100);
            toggleSettingsPanel();
            await sleep(300);
            const again = [...document.querySelectorAll('.settings-theme-btn')].find((b) => b.getAttribute('data-theme') === 'purple');
            again.click();
            return { registered, count: buttons.length, steps, documentClicks, afterRedraw: themeClasses(), bodyAfterRedraw: document.body.classList.contains('theme-purple') };
        });
        assert.equal(out.registered, 'function');
        assert.equal(out.count, 5);
        assert.deepEqual(out.steps.map((s) => s.classes), [['theme-pink'], ['theme-purple'], ['theme-yellow'], ['theme-white'], []]);
        assert.deepEqual(out.steps.map((s) => s.active), [['pink'], ['purple'], ['yellow'], ['white'], ['green']]);
        assert.deepEqual(out.steps.map((s) => s.label), ['pink theme active', 'purple theme active', 'yellow theme active', 'white theme active', 'green theme active']);
        assert.equal(out.documentClicks, 0, 'theme clicks stop at the button');
        assert.deepEqual(out.afterRedraw, ['theme-purple']);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

// Keyboard shortcuts and mouse back/forward buttons (src/js/06k-keyboard-shortcuts.js).
// Drives synthetic key and mouse events at the document, like the browser would, and checks what the app does.
// Passes on the classic-script version and on the module version (D-09d).
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

describe('keyboard shortcuts and mouse navigation (real page)', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await gotoApp(page, dir);
        return { page, errors };
    }

    // Dispatches a keydown on the document and reports whether it was claimed (preventDefault).
    const press = (page, key, init = {}) =>
        page.evaluate(
            ([k, i]) => {
                const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...i });
                document.dispatchEvent(e);
                return e.defaultPrevented;
            },
            [key, init]
        );

    // Counts clicks on a global button element (shuffleButton, repeatButton).
    const countClicks = (page, name) =>
        page.evaluate((n) => {
            window.__clicks = window.__clicks || {};
            window.__clicks[n] = 0;
            window[n === 'shuffleButton' ? '__s' : '__r'] = true;
            const btn = n === 'shuffleButton' ? shuffleButton : repeatButton;
            btn.addEventListener('click', () => window.__clicks[n]++);
        }, name);
    const clicks = (page, name) => page.evaluate((n) => window.__clicks[n], name);

    test('S and R click the shuffle and repeat buttons and claim the key', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            await countClicks(page, 'shuffleButton');
            await countClicks(page, 'repeatButton');
            assert.equal(await press(page, 's'), true);
            assert.equal(await press(page, 'S'), true);
            assert.equal(await press(page, 'r'), true);
            assert.equal(await clicks(page, 'shuffleButton'), 2);
            assert.equal(await clicks(page, 'repeatButton'), 1);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('M toggles mute through the volume code', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            await page.evaluate(() => updateVolume(0.6));
            assert.equal(await press(page, 'm'), true);
            assert.equal(await page.evaluate(() => audioElement.volume), 0);
            assert.equal(await press(page, 'M'), true);
            assert.ok((await page.evaluate(() => audioElement.volume)) > 0);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('Ctrl+Up and Ctrl+Down change the volume by a tenth, and plain arrows without a track do nothing', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            await page.evaluate(() => updateVolume(0.5));
            assert.equal(await press(page, 'ArrowDown', { ctrlKey: true }), true);
            const down = await page.evaluate(() => audioElement.volume);
            assert.ok(Math.abs(down - 0.4) < 0.001, `volume ${down}`);
            assert.equal(await press(page, 'ArrowUp', { ctrlKey: true }), true);
            const up = await page.evaluate(() => audioElement.volume);
            assert.ok(Math.abs(up - 0.5) < 0.001, `volume ${up}`);
            // no track loaded: seek keys are left alone
            assert.equal(await press(page, 'ArrowLeft'), false);
            assert.equal(await press(page, 'ArrowRight'), false);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('shortcuts are ignored while typing in an input', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            await countClicks(page, 'shuffleButton');
            await page.evaluate(() => {
                const input = document.createElement('input');
                input.id = 'typing-probe';
                document.body.appendChild(input);
                input.focus();
            });
            assert.equal(await press(page, 's'), false);
            assert.equal(await press(page, 'm'), false);
            assert.equal(await clicks(page, 'shuffleButton'), 0);
            await page.evaluate(() => document.getElementById('typing-probe').blur());
            assert.equal(await press(page, 's'), true);
            assert.equal(await clicks(page, 'shuffleButton'), 1);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('mouse back and forward buttons call goBack / goForward only when there is somewhere to go', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            // 06k calls these by bare name, so replacing them on window shows which one it reaches for.
            await page.evaluate(() => {
                window.__nav = { back: 0, forward: 0 };
                window.__can = { back: false, forward: false };
                window.goBack = () => window.__nav.back++;
                window.goForward = () => window.__nav.forward++;
                window.canGoBack = () => window.__can.back;
                window.canGoForward = () => window.__can.forward;
            });
            const mouse = (button) =>
                page.evaluate((b) => {
                    const e = new MouseEvent('mousedown', { button: b, bubbles: true, cancelable: true });
                    document.dispatchEvent(e);
                    return e.defaultPrevented;
                }, button);
            const nav = () => page.evaluate(() => ({ ...window.__nav }));
            // Nothing to go to: the buttons are claimed (so the browser does not navigate) but nothing is called.
            assert.equal(await mouse(3), true);
            assert.equal(await mouse(4), true);
            assert.deepEqual(await nav(), { back: 0, forward: 0 });
            await page.evaluate(() => (window.__can = { back: true, forward: true }));
            assert.equal(await mouse(3), true);
            assert.deepEqual(await nav(), { back: 1, forward: 0 });
            assert.equal(await mouse(4), true);
            assert.deepEqual(await nav(), { back: 1, forward: 1 });
            assert.equal(await mouse(0), false, 'the left button is left alone');
            assert.equal(await mouse(1), false, 'the middle button is left alone');
            assert.deepEqual(await nav(), { back: 1, forward: 1 });
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('Home, End, PageDown and PageUp scroll the content area', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            const r = await page.evaluate(() => {
                const content = document.querySelector('.content');
                if (!content) return { skipped: true };
                const spacer = document.createElement('div');
                spacer.style.cssText = 'height:6000px;width:1px;';
                content.appendChild(spacer);
                const out = { skipped: false };
                const key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
                key('End');
                out.end = content.scrollTop > 0;
                key('Home');
                out.home = content.scrollTop;
                key('PageDown');
                out.pageDown = content.scrollTop;
                key('PageUp');
                out.pageUp = content.scrollTop;
                return out;
            });
            if (r.skipped) return void t.skip('no .content element in this build');
            assert.deepEqual(r, { skipped: false, end: true, home: 0, pageDown: 200, pageUp: 0 });
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
});

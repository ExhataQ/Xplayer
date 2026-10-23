// Task PA-16: the right panel slot (shell/right-panel.js): button, push layout, resize, remembered width, narrow-window overlay.
//
// Run:   node --test tools/tests/ui-next-right-panel.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('right panel slot', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = '<script>window.electronAPI = new Proxy({}, {get:(t,k)=>(k==="then"?undefined:(...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null))});</script>\n';
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open(vw = 1400) {
        const page = await browser.newPage({ viewport: { width: vw, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return { page, errors };
    }

    const button = (page) => page.locator('button[aria-label="Right panel"]');
    const host = (page) => page.locator('.right-host');
    const register = (page) =>
        page.evaluate(async () => {
            const m = await import(new URL('shell/right-panel.js', location.href).href);
            window.__rp = { mounts: 0 };
            m.registerRightPanel({ mount(body) { window.__rp.mounts++; body.textContent = 'provider body'; return {}; } });
        });

    test('with no provider there is no button and no panel', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        assert.equal(await button(page).count(), 1);
        assert.equal(await button(page).isHidden(), true);
        assert.equal(await host(page).isHidden(), true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('registering a provider shows the button; opening pushes the list narrower and mounts once', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const before = await page.locator('.view-host').evaluate((n) => n.getBoundingClientRect().width);
        await register(page);
        await button(page).click();
        assert.equal(await host(page).isVisible(), true);
        const after = await page.locator('.view-host').evaluate((n) => n.getBoundingClientRect().width);
        const w = await host(page).evaluate((n) => Math.round(n.getBoundingClientRect().width));
        assert.equal(w, 320);
        assert.ok(Math.abs(before - after - 320) <= 2, `list narrowed by the panel width (${before} -> ${after})`);
        assert.equal(await host(page).getAttribute('data-overlay'), null);
        await button(page).click();
        await button(page).click();
        assert.equal(await page.evaluate(() => window.__rp.mounts), 1);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the keyboard resizes within 280 to 420 and the width and open state are remembered', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await register(page);
        await button(page).click();
        await page.locator('.right-resizer').focus();
        await page.keyboard.press('ArrowLeft');
        assert.equal(await host(page).evaluate((n) => Math.round(n.getBoundingClientRect().width)), 336);
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowLeft');
        assert.equal(await host(page).evaluate((n) => Math.round(n.getBoundingClientRect().width)), 420);
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowRight');
        assert.equal(await host(page).evaluate((n) => Math.round(n.getBoundingClientRect().width)), 280);
        await page.keyboard.press('Enter');
        assert.equal(await host(page).evaluate((n) => Math.round(n.getBoundingClientRect().width)), 320);
        await page.keyboard.press('End');
        const saved = await page.evaluate(() => [localStorage.getItem('xplayer.ui-next.right-open'), localStorage.getItem('xplayer.ui-next.right-width')]);
        assert.deepEqual(saved, ['true', '420']);
        await page.close();
    });

    test('dragging the left edge widens the panel', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await register(page);
        await button(page).click();
        const box = await page.locator('.right-resizer').boundingBox();
        await page.mouse.move(box.x + 2, box.y + 50);
        await page.mouse.down();
        await page.mouse.move(box.x - 58, box.y + 50, { steps: 4 });
        await page.mouse.up();
        assert.equal(await host(page).evaluate((n) => Math.round(n.getBoundingClientRect().width)), 380);
        await page.close();
    });

    test('in a window too narrow to push the list the panel floats over it, and Escape closes it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open(700);
        await register(page);
        await button(page).click();
        assert.equal(await host(page).isVisible(), true);
        assert.equal(await host(page).getAttribute('data-overlay'), '');
        const list = await page.locator('.view-host').evaluate((n) => Math.round(n.getBoundingClientRect().width));
        assert.ok(list >= 420 - 2, 'the list keeps its width under the overlay');
        assert.equal(await page.evaluate(() => localStorage.getItem('xplayer.ui-next.right-open')), null, 'the saved choice is untouched');
        await page.locator('.right-host').focus().catch(() => {});
        await page.locator('.right-resizer').focus();
        await page.keyboard.press('Escape');
        assert.equal(await host(page).isHidden(), true);
        await page.close();
    });

    test('a saved open panel hides itself when the window shrinks and comes back when it widens', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await register(page);
        await button(page).click();
        await page.setViewportSize({ width: 700, height: 860 });
        await page.waitForFunction(() => document.querySelector('.right-host').hidden);
        await page.setViewportSize({ width: 1400, height: 860 });
        await page.waitForFunction(() => !document.querySelector('.right-host').hidden);
        await page.close();
    });
});

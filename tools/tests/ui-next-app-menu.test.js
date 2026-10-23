// Task PA-07: the application menu (shell/app-menu.js, adapter/menu-bridge.js) and its hotkeys, in the real shell and engine.
//
// Run:   node --test tools/tests/ui-next-app-menu.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('application menu', { concurrency: false }, () => {
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

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return { page, errors };
    }

    const view = (page) => page.evaluate(() => document.querySelector('.view-host').dataset.view);
    async function openGroup(page, group) {
        if ((await page.locator('.menu').count()) === 0) await page.getByRole('button', { name: 'Application menu' }).click();
        await page.locator('.menu[data-depth="0"] [role="menuitem"]', { hasText: group }).click();
        return page.locator('.menu[data-depth="1"]');
    }
    const closeMenus = async (page) => {
        for (let i = 0; i < 3 && (await page.locator('.menu').count()) > 0; i++) await page.keyboard.press('Escape');
    };
    const item = (menu, label) => menu.locator('[role="menuitem"]', { hasText: new RegExp('^\\s*' + label) });
    const count = (page, selector) =>
        page.evaluate((sel) => {
            window.__hits = window.__hits || {};
            window.__hits[sel] = 0;
            document.querySelector(sel).addEventListener('click', () => window.__hits[sel]++);
        }, selector);
    const hits = (page, selector) => page.evaluate((sel) => window.__hits[sel], selector);

    test('the seven groups are in order and every entry is a real entry or disabled', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.getByRole('button', { name: 'Application menu' }).click();
        assert.deepEqual(await page.locator('.menu[data-depth="0"] [role="menuitem"]').evaluateAll((n) => n.map((x) => x.querySelector('.menu__label').textContent)), ['File', 'Edit', 'View', 'Playback', 'Tools', 'Window', 'Help']);
        const file = await openGroup(page, 'File');
        for (const label of ['Open file', 'Open folder', 'Import and export']) assert.equal(await item(file, label).getAttribute('aria-disabled'), 'true', label);
        assert.equal(await item(file, 'New playlist').getAttribute('aria-disabled'), null);
        assert.match(await item(file, 'New playlist').innerText(), /Ctrl\+N/);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('View entries and Ctrl+1 to Ctrl+4 switch the main view; Ctrl+, opens Settings', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const viewMenu = await openGroup(page, 'View');
        await item(viewMenu, 'Home').click();
        assert.equal(await view(page), 'home');
        for (const [key, id] of [['Control+2', 'library'], ['Control+3', 'search'], ['Control+4', 'recent'], ['Control+1', 'home'], ['Control+,', 'settings']]) {
            await page.keyboard.press(key);
            assert.equal(await view(page), id, key);
        }
        await page.close();
    });

    test('New playlist (menu and Ctrl+N), New folder (Ctrl+Shift+N) and Play from URL (Ctrl+U) open the engine dialogs', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const file = await openGroup(page, 'File');
        await item(file, 'New playlist').click();
        await page.locator('#playlist-name-input').waitFor({ timeout: 3000 });
        await page.keyboard.press('Escape');
        await page.evaluate(() => window.closePlaylistModal && window.closePlaylistModal());
        await page.keyboard.press('Control+n');
        await page.locator('#playlist-name-input').waitFor({ timeout: 3000 });
        await closeMenus(page);
        await page.evaluate(() => document.querySelectorAll('.playlist-modal-overlay').forEach((n) => n.click()));
        await page.keyboard.press('Control+Shift+N');
        await page.locator('.playlist-modal', { hasText: 'folder' }).first().waitFor({ timeout: 3000 });
        await page.evaluate(() => window.closePlaylistModal && window.closePlaylistModal());
        await page.keyboard.press('Control+u');
        await page.locator('#link-url-input').waitFor({ timeout: 3000 });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Playback entries press the player buttons; Ctrl+Right is Next but not inside a text box', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await count(page, '#next-btn');
        await count(page, '#shuffle-btn');
        await page.keyboard.press('Control+ArrowRight');
        assert.equal(await hits(page, '#next-btn'), 1);
        const pb = await openGroup(page, 'Playback');
        await item(pb, 'Shuffle').click();
        assert.equal(await hits(page, '#shuffle-btn'), 1);
        await closeMenus(page);
        await page.evaluate(() => document.querySelectorAll('.playlist-modal-overlay').forEach((n) => n.click())); // the engine's shuffle button opens its mode dialog
        await page.locator('.rail-btn[data-view="search"]').click();
        await page.locator('.view-host input').first().focus();
        await page.keyboard.press('Control+ArrowRight');
        assert.equal(await hits(page, '#next-btn'), 1, 'the arrows belong to the text box');
        await page.close();
    });

    test('Ctrl+Q toggles the queue; entries with no feature behind them are disabled (no desktop bridge in this page)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const toggle = page.locator('[aria-controls="queue-panel"]');
        const before = await toggle.getAttribute('aria-expanded');
        await page.keyboard.press('Control+q');
        assert.notEqual(await toggle.getAttribute('aria-expanded'), before);
        const win = await openGroup(page, 'Window');
        assert.equal(await item(win, 'Always on top').getAttribute('aria-disabled'), 'true');
        await closeMenus(page);
        const v = await openGroup(page, 'View');
        for (const label of ['Zoom', 'Full screen', 'Big picture mode']) assert.equal(await item(v, label).getAttribute('aria-disabled'), 'true', label);
        await page.close();
    });
});

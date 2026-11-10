// Task C6: the "LRCLIB website" button on the Find page. It asks the main process to open a fixed address in the normal browser.
//
// Run:   node --test tools/tests/ui-next-lyrics-find-site.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('LRCLIB website button (static rules)', () => {
    const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

    test('the address is fixed in the main process: the call takes nothing and cannot open anything else', () => {
        assert.match(read('electron', 'preload.js'), /openLrclibSite: \(\) => ipcRenderer\.invoke\('open-lrclib-site'\)/);
        assert.match(read('src', 'js', 'api', 'desktop-api.js'), /openLrclibSite: 'invoke'/);
        const main = read('electron', 'main.js');
        assert.match(main, /ipcMain\.handle\('open-lrclib-site', async \(\) => \{\s*try \{\s*await shell\.openExternal\('https:\/\/lrclib\.net'\);/);
        assert.equal((main.match(/shell\.openExternal\(/g) || []).length, 1, 'the only openExternal in the main process is this one');
    });
});

describe('LRCLIB website button on the Find page', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function openFind() {
        const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
        const errors = [];
        const popups = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        page.on('popup', (p) => popups.push(p.url()));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        await page.evaluate(() => {
            window.__opened = [];
            window.__answer = { success: true };
            window.desktopApi.lyrics.openLrclibSite = (...args) => (window.__opened.push(args), Promise.resolve(window.__answer));
        });
        await page.click('.rail-btn[data-view="lyrics"]');
        await page.waitForSelector('.view-host .lyrics-bar');
        await page.click('.lyrics-bar .tab:has-text("Find")');
        await page.waitForSelector('.online-lyrics-view-container');
        return { page, errors, popups };
    }

    test('the button is on the Find page; pressing it asks once, with no address, and leaves the app where it is', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors, popups } = await openFind();
        const button = page.getByRole('button', { name: 'LRCLIB website' });
        assert.equal(await button.count(), 1);
        assert.equal(await button.getAttribute('title'), 'Opens lrclib.net in your browser');
        const before = page.url();
        await button.click();
        await page.waitForTimeout(100);
        assert.deepEqual(await page.evaluate(() => window.__opened), [[]], 'one call, no argument');
        assert.equal(page.url(), before, 'the app did not navigate');
        assert.deepEqual(popups, [], 'no window of the app was opened');
        assert.equal(await page.locator('.online-lyrics-view-container').count(), 1, 'the Find page is still there');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a failed or refused open says so', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openFind();
        await page.evaluate(() => (window.__answer = { success: false, error: 'no browser' }));
        await page.getByRole('button', { name: 'LRCLIB website' }).click();
        // The first failure opens the notification center by itself (PA-06), so it is read there.
        const rows = page.locator('#notification-center .notif__title', { hasText: 'Could not open the browser' });
        await rows.first().waitFor({ timeout: 2000 });
        assert.equal(await rows.count(), 1);
        await page.evaluate(() => (window.desktopApi.lyrics.openLrclibSite = () => Promise.reject(new Error('x'))));
        await page.getByRole('button', { name: 'LRCLIB website' }).click();
        await page.waitForFunction(() => document.querySelectorAll('#notification-center .notif').length >= 2, null, { timeout: 2000 });
        await page.close();
    });

    test('without the desktop call (a browser) there is no button', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openFind();
        await page.evaluate(() => {
            const real = window.desktopApi.supports;
            window.desktopApi.supports = (name) => (name === 'lyrics.openLrclibSite' ? false : real(name));
        });
        await page.click('.lyrics-bar .tab:has-text("Batch")');
        await page.click('.lyrics-bar .tab:has-text("Find")');
        await page.waitForSelector('.online-lyrics-view-container');
        assert.equal(await page.getByRole('button', { name: 'LRCLIB website' }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Search many songs' }).count(), 1, 'the other buttons are unchanged');
        await page.close();
    });
});

// PB-06 and PB-05 in the new shell: the Library panel's plus button, its empty-space menu, and the wider panel with its scroll bar on the wall.
// Real browser, real engine, new shell.
//
// Run:   node --test tools/tests/ui-next-library-create.test.js
// Needs: playwright and a browser (skips itself if missing; see scroll.test.js).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForStartupGone } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };

function buildNextApp(songs) {
    const dir = buildApp(songs);
    fs.cpSync(path.join(ROOT, 'src', 'ui-next'), path.join(dir, 'ui-next'), { recursive: true });
    const file = path.join(dir, 'ui-next', 'index.html');
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    return dir;
}

describe('Library panel: create button and wider list', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildNextApp(60);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html'));
        await page.waitForSelector('.library-panel .left-panel-main-item:not(.lazy-skeleton)');
        await waitForStartupGone(page); // right clicks use page.mouse, which the startup view would take
        return { page, errors };
    }

    test('the plus is in the Library header, opens the engine dialog, and is gone in the compact strip and in other panels', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const plus = page.getByRole('button', { name: 'New playlist or folder' });
        assert.equal(await plus.isVisible(), true);
        const [plusBox, arrowBox] = [await plus.boundingBox(), await page.locator('.panel-host__header [aria-pressed]').boundingBox()];
        assert.ok(plusBox.x < arrowBox.x, 'the plus sits before the collapse arrow');
        await plus.click();
        assert.equal(await page.locator('.playlist-modal-title').textContent(), 'Create New');
        await page.keyboard.press('Escape');
        await page.locator('.panel-host__header [aria-pressed]').click();
        assert.equal(await plus.isVisible(), false, 'hidden when collapsed');
        await page.locator('.panel-host__header [aria-pressed]').click();
        await page.click('.rail-btn[data-view="search"]');
        assert.equal(await plus.isVisible(), false, 'Library only');
        await page.click('.rail-btn[data-view="library"]');
        assert.equal(await plus.isVisible(), true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('right click on empty panel space offers New playlist and New folder', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const box = await page.locator('.library-panel__controls').boundingBox();
        await page.mouse.click(box.x + 3, box.y + 3, { button: 'right' });
        await page.locator('.menu__item').first().waitFor();
        assert.deepEqual(await page.locator('.menu__item').allInnerTexts(), ['New playlist', 'New folder']);
        await page.locator('.menu__item', { hasText: 'New folder' }).click();
        assert.equal(await page.locator('.playlist-modal-title').textContent(), 'Create New Folder');
        await page.close();
    });

    test('PB-05: the panel is 340 px wide, rows are 72 px with 44 px covers, and the list reaches the panel wall', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const m = await page.evaluate(() => {
            const rect = (s) => document.querySelector(s).getBoundingClientRect();
            return { panel: Math.round(rect('.panel-host').width), row: Math.round(rect('.library-panel .left-panel-main-item').height), cover: Math.round(rect('.library-panel .main-item-cover-wrapper').height), gap: Math.round(rect('.panel-host').right - rect('.left-panel-main-list-content').right) };
        });
        assert.deepEqual(m, { panel: 340, row: 72, cover: 44, gap: 1 }); // 1 px is the panel's own border
        await page.close();
    });
});

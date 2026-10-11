// Context menus (src/js/06a-context-menus.js): opening, and the document / window listeners the file adds while it
// loads (Escape, a click outside, window resize), plus the state the other files read (currentContextSongId).
// What each menu item does is covered in ui-handlers.test.js. Passes on the classic-script version and on the
// module version (D-09d).
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

describe('context menus (real page)', { concurrency: false }, () => {
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
    const menus = (page) => page.evaluate(() => document.querySelectorAll('.context-menu').length);
    // part: which cell of the row to click. The title is on the left, the duration far right, away from an open menu.
    const rightClickSong = async (page, id, part = '.song-title') => {
        const box = await page.evaluate(([i, sel]) => {
            const r = document.querySelector(`#song-list .song-item[data-song-id="${i}"] ${sel}`).getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, [id, part]);
        await page.mouse.click(box.x, box.y, { button: 'right' });
    };

    test('right-click on a song opens one menu for that song; Escape closes it and clears the stored song', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            assert.equal(await page.evaluate(() => currentContextSongId), null);
            await rightClickSong(page, 2);
            assert.equal(await menus(page), 1);
            assert.equal(await page.evaluate(() => currentContextSongId), 2);
            await page.keyboard.press('Escape');
            assert.equal(await menus(page), 0);
            assert.equal(await page.evaluate(() => currentContextSongId), null);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('right-clicking another song replaces the menu instead of stacking a second one', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            await rightClickSong(page, 1);
            await rightClickSong(page, 3, '.song-duration');
            assert.equal(await menus(page), 1);
            assert.equal(await page.evaluate(() => currentContextSongId), 3);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('a click outside closes the menu; a click inside the menu text does not', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            await rightClickSong(page, 2);
            const inside = await page.evaluate(() => {
                const r = document.querySelector('.context-menu').getBoundingClientRect();
                return { x: r.left + 3, y: r.top + 3 };
            });
            await page.mouse.click(inside.x, inside.y); // the menu's own padding, not an item
            assert.equal(await menus(page), 1, 'a click on the menu itself keeps it open');
            await page.mouse.click(700, 120); // empty header area
            assert.equal(await menus(page), 0);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('shrinking the window keeps an open menu inside it', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            await rightClickSong(page, 2);
            await page.setViewportSize({ width: 700, height: 500 });
            await page.waitForTimeout(100);
            const r = await page.evaluate(() => {
                const m = document.querySelector('.context-menu').getBoundingClientRect();
                return { right: m.right, left: m.left, innerWidth: window.innerWidth };
            });
            assert.ok(r.right <= r.innerWidth, `menu right edge ${r.right} is past the window width ${r.innerWidth}`);
            assert.ok(r.left >= 0);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('Escape with the notification panel open closes the panel and leaves the menu alone', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            await rightClickSong(page, 2);
            await page.evaluate(() => {
                notificationPanelOpen = true;
                window.__panelClosed = 0;
                window.closeNotificationPanel = () => {
                    window.__panelClosed++;
                    notificationPanelOpen = false;
                };
            });
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => window.__panelClosed), 1);
            assert.equal(await menus(page), 1, 'the first Escape went to the panel');
            await page.keyboard.press('Escape');
            assert.equal(await menus(page), 0);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
});

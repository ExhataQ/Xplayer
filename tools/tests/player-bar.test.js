// Player bar wiring (src/js/ui/player-bar.js) and the title/artist marquee (initMarqueeOnHover in 06k).
// player-bar.js runs while the page loads and calls initMarqueeOnHover on the title and the artist, guarded by
// typeof: if the two files were ever loaded in the wrong order the marquee would silently stop working, which is
// exactly what this test would show. It passes on the classic-script version and on the module version (D-09d).
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

describe('player bar wiring (real page)', { concurrency: false }, () => {
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

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await gotoApp(page, dir);
        return { page, errors };
    }

    test('start-up wires the marquee onto the title and artist and the search button', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            const r = await page.evaluate(() => ({
                title: document.getElementById('player-title').dataset.marqueeInit,
                artist: document.getElementById('player-artist').dataset.marqueeInit,
                search: typeof document.getElementById('search-btn').onclick,
                initFn: typeof window.initMarqueeOnHover
            }));
            assert.deepEqual(r, { title: '1', artist: '1', search: 'function', initFn: 'function' });
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    for (const id of ['player-title', 'player-artist']) {
        test(`hovering a ${id} that is wider than its box scrolls it`, async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                await page.evaluate((i) => {
                    document.getElementById(i).textContent = 'A very long text that cannot fit in the player bar '.repeat(20);
                }, id);
                const box = await page.evaluate((i) => {
                    const r = document.getElementById(i).getBoundingClientRect();
                    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                }, id);
                await page.mouse.move(box.x, box.y);
                await page.waitForFunction((i) => document.getElementById(i).classList.contains('marquee-active'), id, { timeout: 5000 });
                const r = await page.evaluate((i) => {
                    const el = document.getElementById(i);
                    const inner = el.querySelector('.marquee-inner');
                    return { hasInner: !!inner, text: inner && inner.textContent.length > 100 };
                }, id);
                assert.deepEqual(r, { hasInner: true, text: true });
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });
    }

    test('right-click on the title, artist or cover opens the context menu of the current song, and only when there is one', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            const menus = () => page.evaluate(() => document.querySelectorAll('.context-menu').length);
            const rightClick = async (id) => {
                const box = await page.evaluate((i) => {
                    const r = document.getElementById(i).getBoundingClientRect();
                    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                }, id);
                await page.mouse.click(box.x, box.y, { button: 'right' });
            };
            const dismiss = () => page.evaluate(() => closeContextMenu());
            // No current song: nothing opens.
            await rightClick('player-title');
            assert.equal(await menus(), 0);
            // With a current song, each of the three elements opens a menu.
            await page.evaluate(() => {
                setPlaybackQueue([SONGS_DATA[0]]);
                setCurrentQueueIndex(0);
            });
            for (const id of ['player-title', 'player-artist', 'player-cover']) {
                await rightClick(id);
                assert.equal(await menus(), 1, `${id} should open the menu`);
                await dismiss();
                assert.equal(await menus(), 0);
            }
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
});

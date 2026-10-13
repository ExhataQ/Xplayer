// Browser test: clearing the main search box must not throw and must restore the full All Songs state.
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 30000 };
const SONG_COUNT = 50;

describe('clearing the main search box', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(SONG_COUNT);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('typing a query and clearing it throws nothing and shows the full song count', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await gotoApp(page, dir);

        const setSearch = async (value) => {
            await page.evaluate((v) => {
                document.getElementById('search-input').value = v;
                performSearchNow();
            }, value);
            await page.waitForTimeout(150);
        };
        const readState = () =>
            page.evaluate(() => ({
                count: document.querySelector('.left-panel-main-item[data-view="all-songs"] .main-item-count').textContent,
                view: currentView,
                allSongsActive: document.querySelector('.left-panel-main-item[data-view="all-songs"]').classList.contains('active'),
                rows: document.querySelectorAll('#song-list .song-item[data-song-id]').length
            }));

        const before = await readState();
        assert.equal(before.count, `${SONG_COUNT} songs`);

        await setSearch('number 7');
        const during = await readState();
        assert.equal(during.count, `${SONG_COUNT} songs`, 'the left panel count is the library total, not the search result count');
        assert.ok(during.rows < SONG_COUNT, 'the search must narrow the list');

        await setSearch('');
        const after = await readState();

        assert.deepEqual(errors, [], 'clearing the search must not throw');
        assert.equal(after.count, `${SONG_COUNT} songs`);
        assert.equal(after.view, 'all-songs');
        assert.equal(after.allSongsActive, true, 'the All Songs entry is highlighted again');
        assert.equal(after.rows, SONG_COUNT, 'the full list is shown again');
        await page.close();
    });
});

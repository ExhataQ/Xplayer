// Browser tests for how search and recents are wired into the real UI.
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 30000 };

describe('search and recents in the UI', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(50);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    const guard = (t) => (skip ? (t.skip(skip), false) : true);
    async function openApp() {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto('file://' + path.join(dir, 'index.html').replace(/\\/g, '/'));
        await page.waitForTimeout(900);
        return { page, errors };
    }
    const typeSearch = async (page, text) => {
        await page.evaluate((v) => {
            document.getElementById('search-input').value = v;
            performSearch();
        }, text);
        await page.waitForTimeout(450); // longer than the debounce
    };

    test('typing a search shows the best match first, and the list on screen is the list the app searches', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await typeSearch(page, 'number 7');
        const r = await page.evaluate(() => ({
            shown: [...document.querySelectorAll('#song-list .song-item[data-song-id]')].map((e) => +e.getAttribute('data-song-id')),
            provider: listProviders.search.getSongs().map((s) => s.id),
            next: getSearchResults(searchQuery).map((s) => s.id)
        }));
        assert.equal(r.shown[0], 7, 'the exact "number 7" song should be first');
        assert.deepEqual(r.shown, r.provider);
        assert.deepEqual(r.provider, r.next, 'next/previous must walk the same list that is shown');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('one typing burst creates ONE search-history entry, a new search creates another', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openApp();
        for (const text of ['so', 'son', 'song t']) await typeSearch(page, text);
        let history = await page.evaluate(() => getSearchHistory().map((h) => h.query));
        assert.deepEqual(history, ['song t']);
        await typeSearch(page, ''); // clearing ends the burst
        await typeSearch(page, 'artist');
        history = await page.evaluate(() => getSearchHistory().map((h) => h.query));
        assert.deepEqual(history, ['artist', 'song t']);
        await page.close();
    });

    test('opening a search from history uses the same results as typing it (deleted songs excluded)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openApp();
        const r = await page.evaluate(() => {
            deletedSongIds.add(7);
            openSearchHistoryChild('session-1', 'number 7');
            return { slots: ghostLists['search-items'].length, provider: listProviders.search.getSongs().length, hasDeleted: listProviders.search.getSongs().some((s) => s.id === 7) };
        });
        assert.equal(r.hasDeleted, false);
        assert.equal(r.slots, r.provider, 'the history view must not count songs the search does not return');
        await page.close();
    });

    test('recents: a song appears once, and shows its CURRENT title after a metadata edit', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(() => {
            for (const i of [0, 1, 2]) saveToRecentlyPlayed(SONGS_DATA[i]);
            for (let n = 0; n < 60; n++) saveToRecentlyPlayed(SONGS_DATA[0]);
            SONGS_DATA[1].title = 'Edited in the metadata editor';
            renderRecentlyPlayed();
            return {
                stored: JSON.parse(localStorage.getItem('recentlyPlayed')).length,
                rows: document.querySelectorAll('#song-list .song-item[data-song-id]').length,
                text: document.getElementById('song-list').textContent,
                count: getRecentCount()
            };
        });
        assert.equal(r.stored, 3, 'replaying a song must not add copies');
        assert.equal(r.rows, 3);
        assert.equal(r.count, 3);
        assert.match(r.text, /Edited in the metadata editor/);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

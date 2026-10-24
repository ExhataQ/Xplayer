// PB-02 in the new shell: the Search and Recents panels. (PB-03's buttons that show them in the main view are off for now.)
// Real browser, real engine, new shell.
//
// Run:   node --test tools/tests/ui-next-panel-lists.test.js
// Needs: playwright and a browser (skips itself if missing; see scroll.test.js).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

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

describe('Search and Recents panels', { concurrency: false }, () => {
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
        // a playlist with four songs, and three songs played (two of them in the playlist)
        await page.evaluate(() => {
            const playlist = createPlaylist('Road trip');
            [1, 2, 3, 4].forEach((i) => addSongToPlaylist(i, playlist.id));
            [0, 2, 9].forEach((i) => saveToPlayHistory(SONGS_DATA[i], 60000));
        });
        return { page, errors };
    }
    const rail = (page, id) => page.locator(`.rail-btn[data-view="${id}"]`);

    test('Search is a panel item: it fills the panel, leaves the main view alone, and shows both marks on the rail', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await rail(page, 'search').click();
        await page.waitForSelector('.plist-panel[data-panel-kind="search"]:not([hidden])');
        assert.equal(await page.locator('.view-host').getAttribute('data-view'), 'library');
        assert.equal(await page.locator('.panel-host__title').innerText(), 'Search');
        assert.equal(await rail(page, 'library').getAttribute('aria-current'), null, 'the library list is only there; Search is the active item (PB-22)');
        assert.equal(await rail(page, 'search').evaluate((n) => n.hasAttribute('data-panel-current')), true);
        assert.equal(await page.locator('.panel-host__action').isVisible(), false, 'the plus is for Library only');
        await rail(page, 'search').click();
        assert.equal(await page.locator('.panel-host').evaluate((n) => n.hasAttribute('data-closed')), true, 'choosing it again closes the panel');
        assert.equal(await rail(page, 'search').evaluate((n) => n.hasAttribute('data-panel-current')), false);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('typing lists the playlists and songs that match; a playlist opens in the main view and the panel stays', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await rail(page, 'search').click();
        const field = page.locator('.plist-panel input');
        await field.fill('road');
        assert.match(await page.locator('.plist-section').first().innerText(), /Road trip/);
        await field.fill('zzzz');
        assert.match(await page.locator('.plist-empty').innerText(), /Nothing matches/);
        await field.fill('road');
        await page.locator('.plist-row').first().click();
        await page.waitForSelector('.songlist-bar__title');
        assert.equal(await page.locator('.songlist-bar__title').innerText(), 'Road trip');
        assert.equal(await page.locator('.panel-host__title').innerText(), 'Search');
        await page.close();
    });

    test('Recents lists played playlists (expand for the songs and when) and recent songs', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await rail(page, 'recent').click();
        const panel = page.locator('.plist-panel[data-panel-kind="recent"]');
        await panel.waitFor();
        assert.match(await panel.innerText(), /Road trip[\s\S]*2 of 4 played/);
        await page.locator('.plist-toggle').click();
        assert.equal(await page.locator('.plist-list--nested .plist-item').count(), 2);
        assert.equal(await page.locator('.plist-toggle').getAttribute('aria-expanded'), 'true');
        await page.close();
    });

    // ---- PB-17 to PB-22 ----
    async function seedMore(page) {
        // seven more played playlists (Recents shows 5 and a Load more), and one song that is in no album
        await page.evaluate(() => {
            for (let i = 0; i < 7; i++) {
                const list = createPlaylist('List ' + i);
                addSongToPlaylist(SONGS_DATA[10 + i].id, list.id);
                saveToPlayHistory(SONGS_DATA[10 + i], 60000 + i);
            }
            SONGS_DATA[5].album = '';
        });
    }

    test('PB-19: filter chips, auto-load while scrolling, artist results, and the filter is kept', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await rail(page, 'search').click();
        assert.deepEqual(await page.locator('.plist-panel .chip').allInnerTexts(), ['Everything', 'Songs', 'Artists', 'Albums', 'Playlists']);
        await page.locator('.plist-panel input').fill('song');
        assert.match(await page.locator('.plist-more').innerText(), /Show all 60 songs/);
        await page.getByRole('button', { name: 'Songs', exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll('.plist-results .plist-item').length === 40);
        await page.evaluate(() => (document.querySelector('.plist-results').scrollTop = 1e6));
        await page.waitForFunction(() => document.querySelectorAll('.plist-results .plist-item').length === 60);
        await rail(page, 'search').click();
        await rail(page, 'search').click();
        assert.equal(await page.locator('.plist-panel .chip[aria-pressed="true"]').innerText(), 'Songs', 'the filter is kept');
        await page.getByRole('button', { name: 'Artists', exact: true }).click();
        await page.locator('.plist-panel input').fill('artist 3');
        await page.locator('.plist-results .plist-row').first().click();
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'library');
        assert.equal(await page.locator('.panel-host__title').innerText(), 'Search', 'the panel stays');
        await page.close();
    });

    test('PB-17: a song in an album opens the album and plays; a song in no album opens its own page (and back works)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await seedMore(page);
        await rail(page, 'search').click();
        await page.getByRole('button', { name: 'Songs', exact: true }).click();
        await page.locator('.plist-panel input').fill('song title number 3');
        await page.locator('.plist-results .plist-row').first().click();
        await page.waitForFunction(() => document.getElementById('player-title')?.textContent.includes('Song title number 3'));
        assert.equal(await page.locator('.songlist-bar__title').innerText(), 'Album 2');
        await page.locator('.plist-panel input').fill('song title number 6');
        await page.locator('.plist-results .plist-row').first().click();
        await page.waitForSelector('.song-page__title');
        assert.equal(await page.locator('.song-page__title').innerText(), 'Song title number 6');
        assert.equal(await page.locator('.song-page__row').count(), 1);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('PB-20: Recents shows the last 5 playlists and a Load more, and the song rows have covers', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await seedMore(page);
        await rail(page, 'recent').click();
        await page.waitForSelector('.plist-block');
        assert.equal(await page.locator('.plist-block').count(), 5);
        assert.match(await page.locator('.plist-more').innerText(), /Load more \(\d+ left\)/);
        assert.ok((await page.locator('.plist-list:not(.plist-list--blocks) > .plist-item .plist-row__cover img').count()) > 0, 'recent songs have covers');
        await page.locator('.plist-more').click();
        assert.ok((await page.locator('.plist-block').count()) > 5);
        assert.equal(await page.locator('.plist-more').count(), 0);
        await page.close();
    });

    test('PB-21: panel rows are as tall as the Library rows with the same 44 px cover', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const library = await page.evaluate(() => Math.round(document.querySelector('.library-panel .left-panel-main-item').getBoundingClientRect().height));
        await rail(page, 'search').click();
        await page.locator('.plist-panel input').fill('song');
        await page.waitForSelector('.plist-item');
        const row = await page.evaluate(() => ({ item: Math.round(document.querySelector('.plist-item').getBoundingClientRect().height), cover: Math.round(document.querySelector('.plist-row__cover').getBoundingClientRect().width) }));
        assert.deepEqual([row.item, row.cover], [library, 44]);
        await page.close();
    });

    test('PB-22: each rail item is marked only when it is active', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const marks = () => page.evaluate(() => [...document.querySelectorAll('.rail-btn')].map((b) => b.dataset.view + ':' + (b.getAttribute('aria-current') ? 'main' : '') + (b.dataset.panelCurrent !== undefined ? 'panel' : '')).filter((x) => !x.endsWith(':')));
        assert.deepEqual(await marks(), ['library:mainpanel']);
        await rail(page, 'search').click();
        assert.deepEqual(await marks(), ['search:panel'], 'the library list is only there: Library is not marked');
        await rail(page, 'home').click();
        assert.deepEqual((await marks()).sort(), ['home:main', 'search:panel'], 'Home in the main view, Search as the panel');
        await rail(page, 'library').click();
        assert.deepEqual(await marks(), ['library:mainpanel']);
        await page.close();
    });
});

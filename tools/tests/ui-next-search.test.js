// Search view (task B-04): the field, the recent searches and the results, in a real browser against the real engine
// inside the new shell. The engine's own search (ui/08h, search/03b) does the work; these tests check the new view drives it.
//
// Run:   node --test tools/tests/ui-next-search.test.js
// Needs: playwright and a browser (skips itself if missing; see scroll.test.js).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

function buildNextApp(songs) {
    const dir = buildApp(songs);
    fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
    const file = path.join(dir, 'ui-next', 'index.html');
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    return dir;
}

describe('search view in the new shell', { concurrency: false }, () => {
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
    const guard = (t) => (t.skip('the main Search page has no entry point while the panel buttons are off (PB-03 paused)'), false);

    async function openSearch() {
        const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => m.type() === 'error' && !/ERR_FILE_NOT_FOUND/.test(m.text()) && errors.push(m.text()));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html'));
        await page.evaluate(() => localStorage.removeItem('searchHistory'));
        await page.reload();
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        await page.locator('.rail-btn[data-view="search"]').click();
        await page.getByRole('button', { name: 'Show in the main view' }).click(); // Search is a panel item (PB-02); the page is its main view
        await page.waitForSelector('.search-page');
        return { page, errors };
    }
    const type = async (page, text) => {
        await page.locator('.search-page .field__input').fill(text);
        await page.waitForTimeout(700); // the engine waits 300 ms after the last key
    };
    const rowTexts = (page) => page.$$eval('.view-host .song-item:not(.lazy-skeleton) .song-title', (els) => els.map((e) => e.textContent));

    test('the rail stays on Search when the engine switches back to its all-songs list', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openSearch();
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.waitForSelector('.view-host .settings-panel-title');
        // The Search panel is still open next to Settings (a panel item stays until another one replaces it), so its button is there.
        await page.getByRole('button', { name: 'Show in the main view' }).click(); // the engine goes settings -> all-songs: a view:changed event
        await page.waitForSelector('.search-page');
        await page.waitForTimeout(200);
        assert.equal(await page.locator('.rail-btn[aria-current="page"]').getAttribute('data-view'), 'search');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('opens with a focused field, the empty message, and no list', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openSearch();
        const r = await page.evaluate(() => ({
            focused: document.activeElement === document.querySelector('.search-page .field__input'),
            mode: document.getElementById('view-host').dataset.search,
            listVisible: !!document.querySelector('.view-host .content-wrapper')?.offsetParent,
            recents: document.querySelector('.search-recents').textContent
        }));
        assert.equal(r.focused, true);
        // the Search view shows the engine's all-songs list; the rail must stay on Search, not jump to Library
        assert.equal(await page.locator('.rail-btn[aria-current="page"]').getAttribute('data-view'), 'search');
        assert.equal(r.mode, 'empty');
        assert.equal(r.listVisible, false);
        assert.match(r.recents, /Search your library/);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('typing shows the engine results with a title bar for the query; no match shows the empty list message', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openSearch();
        await type(page, 'number 7');
        const titles = await rowTexts(page);
        assert.ok(titles.length >= 1 && titles.includes('Song title number 7'), titles.join());
        const r = await page.evaluate(() => ({
            view: currentView,
            mode: document.getElementById('view-host').dataset.search,
            bar: document.querySelector('.songlist-bar__title').textContent,
            recentsHidden: document.querySelector('.search-recents').hidden,
            listVisible: !!document.querySelector('.view-host .content-wrapper').offsetParent
        }));
        assert.equal(r.view, 'search-items');
        assert.equal(r.mode, 'results');
        assert.match(r.bar, /number 7/);
        assert.equal(r.recentsHidden, true);
        assert.equal(r.listVisible, true);
        await type(page, 'zzqqxx');
        assert.equal((await rowTexts(page)).length, 0);
        assert.match(await page.locator('.view-host .empty-state-container').innerText(), /No songs found/);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('searching by artist finds that artist, and a result plays on double click', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openSearch();
        await type(page, 'Artist 5');
        const artists = await page.$$eval('.view-host .song-item:not(.lazy-skeleton) .song-artist', (els) => els.map((e) => e.textContent.trim()));
        assert.ok(artists.length >= 1 && artists.some((a) => a.includes('Artist 5')), artists.join());
        await page.locator('.view-host .song-item:not(.lazy-skeleton)').first().dblclick({ position: { x: 300, y: 20 } });
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => document.querySelectorAll('.view-host .song-item.playing').length), 1);
        await page.close();
    });

    test('clearing the field (Escape) goes back to the recent searches, which list what was searched with counts', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openSearch();
        await type(page, 'number 7');
        await page.locator('.search-page .field__input').press('Escape'); // the engine keeps one history entry per typing burst
        await page.waitForTimeout(500);
        await type(page, 'Artist 5');
        await page.locator('.search-page .field__input').press('Escape');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => document.getElementById('view-host').dataset.search), 'empty');
        const recents = await page.$$eval('.search-recent', (els) => els.map((e) => e.textContent));
        assert.equal(recents.length, 2);
        assert.match(recents[0], /artist 5/i, 'newest first');
        assert.match(recents[1], /number 7/i);
        assert.match(recents[0], /\d+ songs?/);
        assert.equal(await page.evaluate(() => currentView), 'all-songs');
        await page.close();
    });

    test('a recent search reopens its results and fills the field; the x removes it from the history', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openSearch();
        await type(page, 'number 7');
        await page.locator('.search-page .field__input').press('Escape');
        await page.waitForTimeout(300);
        await page.locator('.search-recent').first().click();
        await page.waitForTimeout(300);
        assert.equal(await page.locator('.search-page .field__input').inputValue(), 'number 7');
        assert.ok((await rowTexts(page)).includes('Song title number 7'));
        await page.locator('.search-page .field__input').press('Escape');
        await page.waitForTimeout(300);
        await page.locator('.search-recents__item').first().hover();
        await page.getByRole('button', { name: /Remove number 7 from recent searches/ }).click();
        await page.waitForTimeout(300);
        assert.equal(await page.locator('.search-recent').count(), 0);
        assert.equal(await page.evaluate(() => getSearchHistory().length), 0);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('leaving Search forgets the query and Library shows all songs again', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openSearch();
        await type(page, 'number 7');
        await page.locator('.rail-btn[data-view="library"]').click();
        await page.waitForSelector('.view-host .songlist-head');
        const r = await page.evaluate(() => ({
            hidden: document.getElementById('search-input').value,
            mode: document.getElementById('view-host').dataset.search ?? null,
            pages: document.querySelectorAll('.search-page').length,
            view: currentView,
            rows: document.querySelectorAll('.view-host .song-item:not(.lazy-skeleton)').length
        }));
        assert.equal(r.hidden, '');
        assert.equal(r.mode, null);
        assert.equal(r.pages, 0);
        assert.equal(r.view, 'all-songs');
        assert.equal(r.rows, 60);
        await page.close();
    });

    test('the bridge is small and the new files use tokens only', () => {
        const lines = fs
            .readFileSync(path.join(NEXT_SRC, 'adapter', 'search-bridge.js'), 'utf8')
            .split(/\r?\n/)
            .filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l)).length;
        assert.ok(lines <= 40, `search-bridge.js has ${lines} code lines`);
        const css = fs.readFileSync(path.join(NEXT_SRC, 'views', 'library', 'search-view.css'), 'utf8');
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|\brgba?\(/);
    });
});

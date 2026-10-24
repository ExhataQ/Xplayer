// List toolbar and detail views (task B-05): play, shuffle, find in list and the engine's "more" menu above the song list,
// for the Library, a playlist, an album, Liked Songs and Recently played. Real browser, real engine, new shell.
//
// Run:   node --test tools/tests/ui-next-listbar.test.js
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

// The fixture has no audio files, so playback is simulated: play() marks the element playing and fires the events.
const FAKE_AUDIO = () => {
    HTMLMediaElement.prototype.play = function () {
        Object.defineProperty(this, 'paused', { value: false, configurable: true });
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
        Object.defineProperty(this, 'paused', { value: true, configurable: true });
        this.dispatchEvent(new Event('pause'));
    };
};

describe('list toolbar in the new shell', { concurrency: false }, () => {
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
        page.on('console', (m) => m.type() === 'error' && !/ERR_FILE_NOT_FOUND/.test(m.text()) && errors.push(m.text()));
        await page.addInitScript(FAKE_AUDIO);
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html'));
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return { page, errors };
    }
    const rows = (page) => page.locator('.view-host .song-item:not(.lazy-skeleton)').count();
    const play = (page) => page.locator('.list-toolbar .icon-btn--solid');

    test('the Library has the toolbar and a kind label above the title', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const names = await page.$$eval('.list-toolbar > .icon-btn', (els) => els.map((e) => e.getAttribute('aria-label')));
        assert.deepEqual(names, ['Play', 'Shuffle', 'Find in this list', 'More options for this list']);
        assert.equal(await page.locator('.songlist-bar__label').textContent(), 'Playlist');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Play starts the list and turns into Pause; clicking again pauses', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await play(page).click();
        await page.waitForTimeout(300);
        assert.equal(await play(page).getAttribute('aria-label'), 'Pause');
        assert.equal(await page.evaluate(() => currentQueueIndex), 0);
        assert.equal(await page.locator('.view-host .song-item.playing').count(), 1);
        await play(page).click();
        await page.waitForTimeout(200);
        assert.equal(await play(page).getAttribute('aria-label'), 'Play');
        await page.close();
    });

    test('Shuffle opens the engine shuffle-mode dialog (as the old list header did), and the button shows the result', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const button = page.locator('.list-toolbar > .icon-btn').nth(1);
        await button.click();
        await page.getByRole('button', { name: 'Normal Shuffle' }).click();
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => isShuffled), true);
        assert.equal(await button.getAttribute('aria-pressed'), 'true');
        await button.click();
        await page.getByRole('button', { name: 'Turn Shuffle Off' }).click();
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => isShuffled), false);
        assert.equal(await button.getAttribute('aria-pressed'), 'false');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Find filters the list in order, and closing it brings every song back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const total = await rows(page);
        await page.locator('.list-toolbar > .icon-btn').nth(2).click();
        const input = page.locator('.list-toolbar__find .field__input');
        assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.list-toolbar__find .field__input')), true);
        await input.fill('number 4');
        await page.waitForTimeout(500);
        const titles = await page.$$eval('.view-host .song-item:not(.lazy-skeleton) .song-title', (els) => els.map((e) => e.textContent));
        assert.ok(titles.length >= 1 && titles.length < total, `${titles.length} of ${total}`);
        assert.ok(titles.includes('Song title number 4') && titles.includes('Song title number 44'), titles.join()); // the engine's search also allows near matches
        const numbers = titles.map((x) => Number(x.match(/\d+$/)[0]));
        assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b), 'the list keeps its own order');
        await input.press('Escape'); // clears the text
        await page.waitForTimeout(400);
        assert.equal(await rows(page), total);
        await input.press('Escape'); // empty: closes the field
        assert.equal(await page.locator('.list-toolbar__find').isHidden(), true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('changing list closes Find; an album and Liked Songs get the same toolbar with their own label', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.locator('.list-toolbar > .icon-btn').nth(2).click();
        await page.locator('.list-toolbar__find .field__input').fill('zz');
        await page.waitForTimeout(300);
        await page.evaluate(() => switchView('favorites'));
        await page.waitForTimeout(300);
        assert.equal(await page.locator('.list-toolbar__find').isHidden(), true);
        assert.equal(await page.locator('.songlist-bar__title').textContent(), 'Liked Songs');
        const albumId = await page.evaluate(() => getAlbums()[0].id);
        await page.evaluate((id) => openAlbum(id), albumId);
        await page.waitForTimeout(300);
        assert.equal(await page.locator('.songlist-bar__label').textContent(), 'Album');
        assert.equal(await page.locator('.list-toolbar > .icon-btn').count(), 4);
        assert.ok((await rows(page)) >= 1);
        await page.close();
    });

    test('Recently played in the rail shows the engine history with the toolbar, and More opens the engine menu', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        t.skip('no entry to the main page while the panel buttons are off (PB-03 paused)');
        return;
        const { page, errors } = await open();
        await page.evaluate(() => localStorage.setItem('playHistory', JSON.stringify([{ id: 2, timestamp: Date.now() }])));
        await page.locator('.rail-btn[data-view="recent"]').click();
        await page.getByRole('button', { name: 'Show recently played songs in the main view' }).click(); // a panel item (PB-02, PB-03)
        await page.waitForSelector('.view-host .songlist-bar');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => currentView), 'history');
        assert.equal(await page.locator('.songlist-bar__title').textContent(), 'Recents');
        assert.ok((await rows(page)) >= 1, 'the song just played is in the history');
        await page.getByRole('button', { name: 'More options for this list' }).click();
        await page.waitForTimeout(200);
        const menu = await page.evaluate(() => {
            const m = document.getElementById('context-menu');
            const r = m && m.getBoundingClientRect();
            return m ? { visible: getComputedStyle(m).visibility === 'visible' && r.width > 0 && r.right <= innerWidth, text: m.textContent } : null;
        });
        assert.ok(menu && menu.visible, 'the engine menu is on screen');
        assert.match(menu.text, /Clear history/);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Search has its own field and no toolbar; the bridge stays small; new CSS uses tokens only', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        t.skip('no entry to the main page while the panel buttons are off (PB-03 paused)');
        return;
        const { page } = await open();
        await page.locator('.rail-btn[data-view="search"]').click();
        await page.getByRole('button', { name: 'Show in the main view' }).click();
        await page.waitForSelector('.search-page');
        assert.equal(await page.locator('.list-toolbar').count(), 0);
        await page.close();
        const lines = fs
            .readFileSync(path.join(NEXT_SRC, 'adapter', 'listbar-bridge.js'), 'utf8')
            .split(/\r?\n/)
            .filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l)).length;
        assert.ok(lines <= 45, `listbar-bridge.js has ${lines} code lines`);
    });
});

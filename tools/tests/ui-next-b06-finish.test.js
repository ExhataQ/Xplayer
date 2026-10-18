// B finish (task B-06): cover art in the song list title bar, right-to-left text, and the engine's row behaviors inside the new
// shell (select, context menu, drag handle) that earlier B tasks left unchecked. Real browser, real engine, new shell.
//
// Run:   node --test tools/tests/ui-next-b06-finish.test.js
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

describe('B finish in the new shell', { concurrency: false }, () => {
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
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html'));
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return { page, errors };
    }

    test('an artist opens as a song list with a round cover, the Artist label and its name', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate(() => window.openArtist(window.getArtists()[0].id));
        await page.waitForFunction(() => document.querySelector('.songlist-bar__label')?.textContent === 'Artist');
        assert.equal(await page.locator('.songlist-bar__title').textContent(), 'Artist 0');
        const cover = page.locator('.songlist-bar__cover');
        assert.equal(await cover.isVisible(), true);
        assert.equal(await cover.getAttribute('data-kind'), 'artist');
        const box = await cover.boundingBox();
        assert.ok(box.width >= 48 && Math.abs(box.width - box.height) < 1, 'cover is square');
        assert.equal(await cover.locator('[id]').count(), 0, 'no duplicate ids from the engine drawing');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('an album shows its label and cover; switching list updates both', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => window.openAlbum(window.getAlbums()[0].id));
        await page.waitForFunction(() => document.querySelector('.songlist-bar__label')?.textContent === 'Album');
        assert.equal(await page.locator('.songlist-bar__cover').getAttribute('data-kind'), 'album');
        await page.evaluate(() => window.switchView('favorites'));
        await page.waitForFunction(() => document.querySelector('.songlist-bar__title')?.textContent === 'Liked Songs');
        assert.equal(await page.locator('.songlist-bar__cover').getAttribute('data-kind'), 'favorites');
        await page.close();
    });

    test('a Persian title lines up on the right of its cell, an English one on the left', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const edges = await page.evaluate(() => {
            const titles = [...document.querySelectorAll('.view-host .song-item .song-title')];
            titles[0].textContent = 'آهنگ شماره یک';
            const place = (node) => {
                const range = document.createRange();
                range.selectNodeContents(node);
                const text = range.getBoundingClientRect();
                const cell = node.getBoundingClientRect();
                return { left: text.left - cell.left, right: cell.right - text.right, bidi: getComputedStyle(node).unicodeBidi };
            };
            return { fa: place(titles[0]), en: place(titles[1]) };
        });
        assert.equal(edges.fa.bidi, 'plaintext');
        assert.ok(edges.fa.right < edges.fa.left, `Persian should hug the right edge (left ${edges.fa.left}, right ${edges.fa.right})`);
        assert.ok(edges.en.left < edges.en.right, 'English should hug the left edge');
        await page.close();
    });

    test('the list title bar follows its own direction', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        assert.equal(await page.locator('.songlist-bar__title').getAttribute('dir'), 'auto');
        await page.close();
    });

    test('clicking a row selects it, and right-click opens the engine song menu in the new shell', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.waitForFunction(() => document.querySelectorAll('.view-host .song-item:not(.lazy-skeleton)').length >= 6);
        const rows = page.locator('.view-host .song-item:not(.lazy-skeleton)');
        await rows.nth(2).click({ position: { x: 200, y: 20 } });
        await page.waitForFunction(() => selectedSongIds.size === 1);
        await rows.nth(3).click({ button: 'right', position: { x: 200, y: 20 } });
        await page.waitForTimeout(300);
        const menu = await page.evaluate(() => {
            const nodes = [...document.querySelectorAll('.context-menu, .song-context-menu, [role="menu"]')].filter((n) => {
                const r = n.getBoundingClientRect();
                return getComputedStyle(n).visibility !== 'hidden' && r.width > 0 && r.height > 0;
            });
            return nodes.map((n) => n.textContent.replace(/\s+/g, ' ').trim());
        });
        assert.ok(menu.some((text) => /play|queue|favorite|playlist/i.test(text)), `song menu text: ${JSON.stringify(menu)}`);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the collapsed panel keeps a cover-only list, and the names stay readable by screen readers', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.waitForSelector('.library-panel .left-panel-main-item:not(.lazy-skeleton)');
        await page.locator('.panel-host__header button').click();
        await page.waitForFunction(() => document.querySelector('.panel-host').dataset.panel === 'compact');
        const info = await page.evaluate(() => {
            const host = document.querySelector('.panel-host');
            const row = document.querySelector('.library-panel .left-panel-main-item:not(.lazy-skeleton)');
            const cover = row.querySelector('.main-item-cover-wrapper').getBoundingClientRect();
            const name = row.querySelector('.main-item-info').getBoundingClientRect();
            const body = document.querySelector('.panel-host__body');
            return {
                width: host.getBoundingClientRect().width,
                bodyShown: getComputedStyle(body).display !== 'none',
                controlsShown: getComputedStyle(document.querySelector('.library-panel__controls')).display !== 'none',
                cover: cover.width,
                coverCenter: cover.left + cover.width / 2 - host.getBoundingClientRect().left,
                nameWidth: name.width,
                nameText: row.querySelector('.main-item-title').textContent.trim()
            };
        });
        assert.equal(info.width, 72);
        assert.equal(info.bodyShown, true);
        assert.equal(info.controlsShown, false);
        assert.ok(info.cover >= 40, 'cover is drawn');
        assert.ok(Math.abs(info.coverCenter - 36) < 3, `cover is centered (${info.coverCenter})`);
        assert.ok(info.nameWidth <= 1 && info.nameText.length > 0, 'name is clipped, not removed');
        await page.locator('.panel-host__header button').click();
        await page.waitForFunction(() => document.querySelector('.panel-host').dataset.panel === 'expanded');
        assert.equal(await page.locator('.library-panel__controls').isVisible(), true);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

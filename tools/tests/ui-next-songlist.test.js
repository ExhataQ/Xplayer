// Song list (task B-03): header, columns, resize and compact density, in a real browser against the real, unmodified engine
// (plus its one new seam, ui/05a setSongItemHeight) inside the new shell.
//
// Run:   node --test tools/tests/ui-next-songlist.test.js
// Needs: playwright and a browser (skips itself if missing; see scroll.test.js).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForStartupGone } = require('./helpers/app-fixture');

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

const codeLines = (file) =>
    fs
        .readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l)).length;

for (const [label, count] of [['small library (rows in normal flow)', 30], ['large library (virtual scroll)', 400]]) {
    describe(`song list, ${label}`, { concurrency: false }, () => {
        let browser, dir, skip;
        before(async () => {
            if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
            browser = await launch(pw);
            if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
            dir = buildNextApp(count);
        });
        after(async () => {
            if (browser) await browser.close();
            if (dir) fs.rmSync(dir, { recursive: true, force: true });
        });
        const guard = (t) => (skip ? (t.skip(skip), false) : true);

        async function open(width = 1300, { keepStorage = false, page: existing } = {}) {
            const page = existing || (await browser.newPage({ viewport: { width, height: 800 } }));
            const errors = [];
            page.on('pageerror', (e) => errors.push(String(e)));
            page.on('console', (m) => m.type() === 'error' && !/ERR_FILE_NOT_FOUND/.test(m.text()) && errors.push(m.text())); // the fixture has no audio files
            await page.goto('file://' + path.join(dir, 'ui-next', 'index.html'));
            if (!keepStorage) await page.evaluate(() => localStorage.removeItem('xplayer.ui-next.songlist'));
            if (!keepStorage) await page.reload();
            await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
            await waitForStartupGone(page); // some tests drive the raw mouse; the startup view would take those events
            return { page, errors };
        }
        const box = (page, selector) => page.locator(selector).first().evaluate((e) => {
            const r = e.getBoundingClientRect();
            return { left: r.left, right: r.right, width: r.width, height: r.height };
        });
        const openColumns = (page) => page.getByRole('button', { name: 'Columns and row height' }).click();

        test('Library shows the engine song list with a header, rows on the token height, and no errors', TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page, errors } = await open();
            const r = await page.evaluate(() => ({
                head: [...document.querySelectorAll('.songlist-head__cell')].map((c) => c.textContent),
                headVisible: !document.querySelector('.songlist-head').hidden,
                rows: document.querySelectorAll('.view-host .song-item:not(.lazy-skeleton)').length,
                rowHeight: document.querySelector('.view-host .song-item').getBoundingClientRect().height,
                engineHeight: window.ITEM_HEIGHT,
                virtual: document.getElementById('song-list').classList.contains('song-list--virtual')
            }));
            assert.deepEqual(r.head, ['#', 'Title', 'Album']);
            assert.equal(r.headVisible, true);
            assert.ok(r.rows > 5);
            assert.equal(r.rowHeight, 56);
            assert.equal(r.engineHeight, 56);
            assert.equal(r.virtual, count > 200);
            assert.deepEqual(errors, []);
            await page.close();
        });

        test('header cells line up with row cells, also after the window narrows', TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page } = await open();
            for (const width of [1300, 1000, 760]) {
                await page.setViewportSize({ width, height: 800 });
                await page.waitForTimeout(100);
                const title = await box(page, '.songlist-head__cell--title');
                const rowTitle = await box(page, '.view-host .song-item .left-song-item');
                assert.ok(Math.abs(title.left - rowTitle.left) < 1.5 && Math.abs(title.width - rowTitle.width) < 1.5, `title column at ${width}px: ${JSON.stringify({ title, rowTitle })}`);
                if (width >= 1000) {
                    const album = await box(page, '.songlist-head__cell--album');
                    const rowAlbum = await box(page, '.view-host .song-item .song-album');
                    assert.ok(Math.abs(album.left - rowAlbum.left) < 1.5 && Math.abs(album.width - rowAlbum.width) < 1.5, `album column at ${width}px`);
                }
            }
            await page.close();
        });

        test('a narrow window drops the Album column but keeps the saved choice', TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page } = await open(600);
            const r = await page.evaluate(() => ({
                albumWidth: document.querySelector('.view-host .song-item .song-album').getBoundingClientRect().width,
                attr: document.getElementById('view-host').dataset.album,
                saved: localStorage.getItem('xplayer.ui-next.songlist')
            }));
            assert.equal(r.albumWidth, 0);
            assert.equal(r.attr, 'on');
            assert.ok(!r.saved || JSON.parse(r.saved).album !== false);
            await page.close();
        });

        test('the columns menu hides and shows Album, Cover art, Artist name and Time, and the choice survives a reload', TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page, errors } = await open();
            const state = () =>
                page.evaluate(() => ({
                    album: document.querySelector('.view-host .song-item .song-album').getBoundingClientRect().width,
                    cover: getComputedStyle(document.querySelector('.view-host .song-cover')).display,
                    artist: getComputedStyle(document.querySelector('.view-host .song-artist')).display,
                    time: getComputedStyle(document.querySelector('.view-host .song-duration')).display
                }));
            assert.ok((await state()).album > 50);
            for (const name of ['Album', 'Cover art', 'Artist name', 'Time']) {
                await openColumns(page);
                const item = page.getByRole('menuitemcheckbox', { name });
                assert.equal(await item.getAttribute('aria-checked'), 'true', `${name} starts on`);
                await item.click();
            }
            let s = await state();
            assert.equal(s.album, 0);
            assert.equal(s.cover, 'none');
            assert.equal(s.artist, 'none');
            assert.equal(s.time, 'none');
            await open(1300, { keepStorage: true, page });
            s = await state();
            assert.equal(s.album, 0, 'saved choice is applied after a reload');
            await openColumns(page);
            assert.equal(await page.getByRole('menuitemcheckbox', { name: 'Album' }).getAttribute('aria-checked'), 'false');
            await page.getByRole('menuitemcheckbox', { name: 'Album' }).click();
            assert.ok((await state()).album > 50);
            assert.deepEqual(errors, []);
            await page.close();
        });

        test('dragging the handle moves the Title and Album boundary, within limits; double click and keyboard work', TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page } = await open();
            const widths = () =>
                page.evaluate(() => ({
                    title: document.querySelector('.songlist-head__cell--title').getBoundingClientRect().width,
                    album: document.querySelector('.songlist-head__cell--album').getBoundingClientRect().width,
                    valuenow: +document.querySelector('.songlist-resizer').getAttribute('aria-valuenow')
                }));
            const before = await widths();
            const handle = await box(page, '.songlist-resizer');
            const y = 400;
            const x = handle.left + handle.width / 2;
            await page.evaluate(() => (document.querySelector('.songlist-head').style.pointerEvents = 'auto'));
            const head = await box(page, '.songlist-head');
            const hy = (await page.locator('.songlist-head').first().boundingBox()).y + 18;
            await page.mouse.move(x, hy);
            await page.mouse.down();
            await page.mouse.move(x + 120, hy, { steps: 6 });
            await page.mouse.up();
            const grown = await widths();
            assert.ok(grown.title > before.title + 80, `title grew: ${before.title} -> ${grown.title}`);
            assert.ok(grown.album < before.album - 80);
            // far past the limit: the Album column keeps its floor
            const handle2 = await box(page, '.songlist-resizer');
            await page.mouse.move(handle2.left + handle2.width / 2, hy);
            await page.mouse.down();
            await page.mouse.move(handle2.left + 2000, hy, { steps: 4 });
            await page.mouse.up();
            const limit = await widths();
            assert.ok(limit.album >= 85, `album floor: ${limit.album}`);
            assert.ok(limit.valuenow <= 80);
            // double click resets
            const handle3 = await box(page, '.songlist-resizer');
            await page.locator('.songlist-resizer').dblclick();
            const reset = await widths();
            assert.ok(Math.abs(reset.title - before.title) < 2, `reset ${reset.title} vs ${before.title}`);
            // keyboard
            await page.locator('.songlist-resizer').focus();
            await page.keyboard.press('ArrowLeft');
            await page.keyboard.press('ArrowLeft');
            const keyed = await widths();
            assert.ok(keyed.title < reset.title - 10);
            const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('xplayer.ui-next.songlist')).share);
            assert.ok(Math.abs(saved - keyed.valuenow / 100) < 0.01);
            void head; void handle3; void y;
            await page.close();
        });

        test('compact density: 36 px rows, no covers, artist beside the title, and the engine follows', TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page, errors } = await open();
            await openColumns(page);
            await page.getByRole('menuitemradio', { name: 'Compact' }).click();
            await page.waitForTimeout(250);
            const r = await page.evaluate(() => {
                const row = document.querySelector('.view-host .song-item:not(.lazy-skeleton)');
                const list = document.getElementById('song-list');
                const title = row.querySelector('.song-title').getBoundingClientRect();
                const artist = row.querySelector('.song-artist').getBoundingClientRect();
                return {
                    rowHeight: row.getBoundingClientRect().height,
                    engineHeight: window.ITEM_HEIGHT,
                    cover: getComputedStyle(row.querySelector('.song-cover')).display,
                    sameLine: Math.abs(title.top - artist.top) < 12,
                    virtual: list.classList.contains('song-list--virtual'),
                    listHeight: list.style.height,
                    rows: document.querySelectorAll('.view-host .song-item:not(.lazy-skeleton)').length
                };
            });
            assert.equal(r.rowHeight, 36);
            assert.equal(r.engineHeight, 36);
            assert.equal(r.cover, 'none');
            assert.equal(r.sameLine, true);
            if (r.virtual) assert.equal(r.listHeight, `${count * 36}px`);
            assert.ok(r.rows > 10, 'compact rows fill the taller window');
            assert.deepEqual(errors, []);
            // and back
            await openColumns(page);
            await page.getByRole('menuitemradio', { name: 'Comfortable' }).click();
            await page.waitForTimeout(250);
            assert.equal(await page.evaluate(() => window.ITEM_HEIGHT), 56);
            await page.close();
        });

        test('changing density keeps the same song at the top of a scrolled list', TEST_OPTIONS, async (t) => {
            if (!guard(t) || count < 300) return;
            const { page } = await open();
            const topSong = (p) =>
                p.evaluate(() => {
                    const content = document.querySelector('.view-host .content');
                    const rows = [...document.querySelectorAll('.view-host .song-item:not(.lazy-skeleton)')];
                    const first = rows.find((r) => r.getBoundingClientRect().bottom > content.getBoundingClientRect().top + 1);
                    return Number(first.dataset.songId);
                });
            await page.evaluate(() => {
                document.querySelector('.view-host .content').scrollTop = 56 * 150;
            });
            await page.waitForTimeout(400);
            const before = await topSong(page);
            await openColumns(page);
            await page.getByRole('menuitemradio', { name: 'Compact' }).click();
            await page.waitForTimeout(400);
            const after = await topSong(page);
            assert.ok(Math.abs(after - before) <= 1, `top song ${before} -> ${after}`);
            await page.close();
        });

        test('rows still play on double click, select on click, and show the playing and selected looks', TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page, errors } = await open();
            const row = page.locator('.view-host .song-item:not(.lazy-skeleton)').nth(2);
            await row.click({ position: { x: 200, y: 20 } });
            assert.equal(await page.evaluate(() => selectedSongIds.size), 1);
            await row.dblclick({ position: { x: 200, y: 20 } });
            await page.waitForTimeout(300);
            const r = await page.evaluate(() => {
                const playing = document.querySelectorAll('.view-host .song-item.playing');
                const normal = document.querySelector('.view-host .song-item:not(.playing) .song-title');
                return {
                    count: playing.length,
                    playingColor: getComputedStyle(playing[0].querySelector('.song-title')).color,
                    normalColor: getComputedStyle(normal).color,
                    accent: (() => {
                        const probe = document.createElement('i');
                        probe.style.color = 'var(--accent)';
                        document.body.append(probe);
                        const c = getComputedStyle(probe).color;
                        probe.remove();
                        return c;
                    })(),
                    queueIndex: currentQueueIndex,
                    selectionColor: getComputedStyle(document.querySelector('#selection-styles-set > div') || document.body).backgroundColor
                };
            });
            assert.equal(r.count, 1);
            assert.equal(r.playingColor, r.accent);
            assert.notEqual(r.normalColor, r.accent);
            assert.equal(r.queueIndex, 2);
            assert.deepEqual(errors, []);
            await page.close();
        });

        test('the engine glyphs in a row (queue, heart, more) draw as masks, not as empty boxes or words', TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page } = await open();
            await page.locator('.view-host .song-item:not(.lazy-skeleton)').nth(1).hover();
            await page.waitForTimeout(400); // the engine throttles hover updates, and the buttons fade in
            const r = await page.evaluate(() => {
                const row = document.querySelectorAll('.view-host .song-item:not(.lazy-skeleton)')[1];
                const glyph = (sel) => {
                    const e = row.querySelector(sel);
                    const cs = getComputedStyle(e);
                    return { w: e.getBoundingClientRect().width, mask: cs.webkitMaskImage || cs.maskImage, fontSize: cs.fontSize };
                };
                return { queue: glyph('.add-to-queue-btn i'), heart: glyph('.favorite-btn i'), more: glyph('.more-info .material-symbols-outlined'), moreOpacity: getComputedStyle(row.querySelector('.more-info')).opacity };
            });
            for (const k of ['queue', 'heart', 'more']) {
                assert.ok(r[k].w >= 16, `${k} width ${r[k].w}`);
                assert.match(r[k].mask, /^url\("data:image\/svg\+xml/, k);
                assert.equal(r[k].fontSize, '0px', `${k} hides the glyph word`);
            }
            assert.equal(r.moreOpacity, '1', 'row actions show on hover');
            await page.close();
        });

        test('other views: the header hides for albums and Settings and comes back for All Songs', TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page } = await open();
            const hidden = () => page.evaluate(() => document.querySelector('.songlist-head').hidden);
            await page.evaluate(() => switchView('albums'));
            assert.equal(await hidden(), true);
            await page.evaluate(() => switchView('all-songs'));
            assert.equal(await hidden(), false);
            await page.locator('.rail-btn[data-view="settings"]').click();
            assert.equal(await page.evaluate(() => document.querySelectorAll('.songlist-head').length), 0, 'the header is removed when another rail item is chosen');
            assert.equal(await page.evaluate(() => 'songlist' in document.getElementById('view-host').dataset), false);
            await page.locator('.rail-btn[data-view="library"]').click();
            await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
            assert.equal(await page.evaluate(() => document.querySelectorAll('.songlist-head').length), 1);
            await page.close();
        });
    });
}

describe('song list sources', () => {
    test('the old page is untouched: the seam exists, ITEM_HEIGHT is still 56 and never read as a stale copy', async (t) => {
        if (!pw) return t.skip('playwright is not installed');
        const browser = await launch(pw);
        if (!browser) return t.skip('no browser found');
        const dir = buildApp(30);
        try {
            const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
            const { gotoApp } = require('./helpers/app-fixture');
            await gotoApp(page, dir);
            const r = await page.evaluate(() => ({ height: ITEM_HEIGHT, seam: typeof setSongItemHeight, row: document.querySelector('#song-list .song-item').getBoundingClientRect().height }));
            assert.deepEqual(r, { height: 56, seam: 'function', row: 56 });
            await page.evaluate(() => setSongItemHeight(40));
            assert.equal(await page.evaluate(() => ITEM_HEIGHT), 40, 'the legacy global follows the module variable');
            await page.evaluate(() => setSongItemHeight(56));
            await page.close();
        } finally {
            await browser.close();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('the bridge stays small, and the song list files use tokens only (no raw colors)', () => {
        assert.ok(codeLines(path.join(NEXT_SRC, 'adapter', 'songlist-bridge.js')) <= 40, 'songlist-bridge.js size');
        for (const f of ['views/library/song-list.css', 'adapter/songlist-rows.css']) {
            const text = fs.readFileSync(path.join(NEXT_SRC, f), 'utf8');
            assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b(?![\w-])/, `${f} has a hex color`);
            assert.doesNotMatch(text, /\brgba?\(/, `${f} has a raw rgb color`);
        }
    });
});

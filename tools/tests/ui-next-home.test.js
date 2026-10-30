// Home (task PB-15): the shelf component and the shelf registry, in a real browser inside the new shell's page.
// Home is not in the shell yet (shell/shell.js is agent A's), so the tests mount it into the view host themselves.
//
// Run:   node --test tools/tests/ui-next-home.test.js
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

describe('home shelves', { concurrency: false }, () => {
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
        await waitForStartupGone(page);
        await page.evaluate(async () => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'ui-next/views/home/home.css';
            document.head.appendChild(link);
            await new Promise((resolve) => (link.onload = resolve));
            document.querySelector('.view-host').replaceChildren();
        });
        return { page, errors };
    }

    const fake = (kind, n, extra = {}) => Array.from({ length: n }, (_, i) => ({ kind, id: `${kind}${i}`, viewId: `${kind}-${i}`, title: `${kind} ${i}`, subtitle: `${i} songs`, cover: '', played: true, ...extra }));

    test('draws one shelf per registry entry that has items, in registry order, and none for an empty list', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const ids = await page.evaluate(async (data) => {
            const { mountHome } = await import('./ui-next/views/home/home.js');
            mountHome(document.querySelector('.view-host'), { read: () => data, open: () => {} });
            return [...document.querySelectorAll('.shelf')].map((s) => s.dataset.shelf);
        }, { songs: fake('song', 5), playlists: [], albums: fake('album', 3), artists: fake('artist', 2, { played: false }) });
        assert.deepEqual(ids, ['recent-songs', 'recent-albums']); // no playlists; artists the person never played are not "recent"
        assert.deepEqual(errors, []);
    });

    test('a new shelf is one registry entry', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const titles = await page.evaluate(async (data) => {
            const { mountHome, SHELVES } = await import('./ui-next/views/home/home.js');
            const extra = { id: 'recent-added', title: 'Recently added', items: (d) => d.songs };
            mountHome(document.querySelector('.view-host'), { shelves: [...SHELVES, extra], read: () => data, open: () => {} });
            return [...document.querySelectorAll('.shelf__title')].map((h) => h.textContent);
        }, { songs: fake('song', 3), playlists: [], albums: [], artists: [] });
        assert.deepEqual(titles, ['Recently played', 'Recently added']);
    });

    test('the row fades only on a side that has more to scroll to, and the arrows page it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(async (data) => {
            const { mountHome } = await import('./ui-next/views/home/home.js');
            mountHome(document.querySelector('.view-host'), { read: () => data, open: () => {} });
        }, { songs: fake('song', 20), playlists: [], albums: [], artists: [] });
        const state = () => page.evaluate(() => {
            const s = document.querySelector('.shelf');
            const row = s.querySelector('.shelf__row');
            const mask = getComputedStyle(row).maskImage;
            return { start: s.dataset.fadeStart, end: s.dataset.fadeEnd, left: row.scrollLeft, masked: mask !== 'none' };
        });
        await page.waitForFunction(() => document.querySelector('.shelf').dataset.fadeEnd === 'true');
        const fade = (side) => `getComputedStyle(document.querySelector('.shelf__row')).getPropertyValue('--fade-${side}').trim()`;
        // The fade width itself reaches the row (a custom property that does not inherit leaves the mask at 0 and nothing fades).
        await page.waitForFunction(`${fade('r')} === '48px'`);
        assert.equal(await page.evaluate(fade('l')), '0px');
        let s = await state();
        assert.deepEqual([s.start, s.end, s.masked], ['false', 'true', true]);
        await page.getByRole('button', { name: 'Scroll Recently played forward' }).click();
        await page.waitForFunction(() => document.querySelector('.shelf__row').scrollLeft > 100);
        await page.waitForFunction(() => document.querySelector('.shelf').dataset.fadeStart === 'true');
        await page.waitForFunction(`${fade('l')} === '48px'`);
        s = await state();
        assert.equal(s.start, 'true');
        await page.evaluate(() => { const r = document.querySelector('.shelf__row'); r.scrollLeft = r.scrollWidth; });
        await page.waitForFunction(() => document.querySelector('.shelf').dataset.fadeEnd === 'false');
        s = await state();
        assert.deepEqual([s.start, s.end], ['true', 'false']);
        assert.equal(await page.getByRole('button', { name: 'Scroll Recently played forward' }).isDisabled(), true);
    });

    test('a card opens its item; with no history the empty state shows', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const opened = await page.evaluate(async (data) => {
            const { mountHome } = await import('./ui-next/views/home/home.js');
            window.__opened = [];
            mountHome(document.querySelector('.view-host'), { read: () => data, open: (item) => window.__opened.push(item.id) });
            document.querySelectorAll('.shelf-card')[1].click();
            return window.__opened;
        }, { songs: fake('song', 3), playlists: [], albums: [], artists: [] });
        assert.deepEqual(opened, ['song1']);
        await page.evaluate(async () => {
            const { mountHome } = await import('./ui-next/views/home/home.js');
            document.querySelector('.view-host').replaceChildren();
            mountHome(document.querySelector('.view-host'), { read: () => ({ songs: [], playlists: [], albums: [], artists: [] }) });
        });
        assert.equal(await page.locator('.home .empty-state').count(), 1);
        assert.equal(await page.locator('.shelf').count(), 0);
    });

    test('PB-23: an empty Home offers the quick actions with a library, and one folder action with no music; with history it has shelves and no empty state', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const draw = (data) =>
            page.evaluate(async (d) => {
                const { mountHome } = await import('./ui-next/views/home/home.js');
                document.querySelector('.view-host').replaceChildren();
                mountHome(document.querySelector('.view-host'), { read: () => d, actions: { newPlaylist: () => {}, playFromUrl: () => {}, askAi: null, folders: () => {} } });
            }, data);
        const labels = () => page.locator('.home .empty-state__actions button').allInnerTexts();
        await draw({ songs: [], playlists: [], albums: fake('album', 2, { played: false }), artists: fake('artist', 1, { played: false }) });
        assert.deepEqual(await labels(), ['New playlist', 'Play from URL'], 'AI is not offered when it is not there');
        assert.match(await page.locator('.home .empty-state__text').innerText(), /2 albums · 1 artist · 0 playlists/);
        await draw({ songs: [], playlists: [], albums: [], artists: [] });
        assert.deepEqual(await labels(), ['Music folders']);
        await draw({ songs: fake('song', 2), playlists: [], albums: [], artists: [] });
        assert.equal(await page.locator('.home .empty-state').count(), 0, 'with history there is no empty state');
        assert.ok((await page.locator('.shelf').count()) >= 1);
        await page.close();
    });

    test('with the real engine data: played songs, albums and artists get shelves, newest first', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const r = await page.evaluate(async () => {
            window.SONGS_DATA.slice(0, 4).forEach((s) => window.saveToRecentlyPlayed(s));
            const albums = window.getAlbums().slice(0, 3);
            albums.map((a) => a.id).reverse().forEach((id) => window.movePlayedItemToTop(id));
            const { mountHome } = await import('./ui-next/views/home/home.js');
            mountHome(document.querySelector('.view-host'));
            const titles = (id) => [...document.querySelectorAll(`[data-shelf="${id}"] .shelf-card__title`)].map((n) => n.textContent);
            return { songs: titles('recent-songs'), albums: titles('recent-albums'), expected: albums.map((a) => a.name) };
        });
        assert.equal(r.songs[0], 'Song title number 4'); // the last one played is first
        assert.equal(r.songs.length, 4);
        assert.deepEqual(r.albums, r.expected);
        assert.deepEqual(errors, []);
    });
});

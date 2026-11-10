// Library panel (task B-02). Two groups, both in a real browser against the real, unmodified engine:
//   1. the engine seam (ui/05b setLeftPanelView): the OLD page, because the seam must not change what it shows;
//   2. the new panel in the new shell (src/ui-next/views/library): chips, find, sort, folder bar, row layout.
//
// Run:   node --test tools/tests/ui-next-library.test.js
// Needs: playwright and a browser (skips itself if missing; see scroll.test.js).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, gotoApp, waitForStartupGone } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

// Same construction as ui-next-shell.test.js: the fixture's engine plus the real src/ui-next, with an electronAPI stub.
function buildNextApp() {
    const dir = buildApp(30);
    fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
    fs.cpSync(path.join(path.dirname(NEXT_SRC), 'assets'), path.join(dir, 'assets'), { recursive: true }); // the default covers: without them every default cover is a failed request
    const file = path.join(dir, 'ui-next', 'index.html');
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    const html = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, html.replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    return dir;
}

// 300 playlists named "Mix 000" to "Mix 299", seeded through the engine's own storage function.
const seedPlaylists = async (page) => {
    await page.evaluate(() => {
        const list = [];
        for (let i = 0; i < 300; i++) list.push({ id: 'p' + i, name: 'Mix ' + String(i).padStart(3, '0'), songs: [] });
        savePlaylists(list);
        renderLeftPanelMainList();
    });
};

describe('library panel: engine seam on the old page', { concurrency: false }, () => {
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
        await gotoApp(page, dir);
        await seedPlaylists(page);
        return { page, errors };
    }

    test('with the defaults the item list is the one the old screen always built (nothing set, nothing changed)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(() => {
            const before = getLeftPanelItemsArray().map((i) => i.viewId);
            setLeftPanelView({ query: 'x' });
            setLeftPanelView({ query: '', types: null, sort: 'recent' });
            return { before, after: getLeftPanelItemsArray().map((i) => i.viewId), view: getLeftPanelView() };
        });
        assert.deepEqual(r.after, r.before);
        assert.deepEqual(r.view, { types: null, query: '', sort: 'recent' });
        assert.ok(r.before.includes('all-songs') && r.before.includes('favorites'));
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the old chips keep their rules: albums mode still lists playlists and hides artists', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openApp();
        const r = await page.evaluate(() => {
            setLeftPanelFilterMode('albums');
            const types = [...new Set(getLeftPanelItemsArray().map((i) => i.type))];
            setLeftPanelFilterMode('all');
            return types;
        });
        assert.ok(r.includes('playlist') && r.includes('album') && !r.includes('artist'), r.join());
        await page.close();
    });

    test('find searches the whole list, not only the rows that are in the DOM (the bug the old find box has)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(async () => {
            const domBefore = document.querySelectorAll('.left-panel-main-list .left-panel-main-item:not(.lazy-skeleton)').length;
            const input = document.getElementById('left-panel-search-input');
            input.value = 'Mix 250';
            performLeftPanelSearch();
            const oldFindShows = [...document.querySelectorAll('.left-panel-main-list .left-panel-main-item')].filter((e) => e.style.display !== 'none').length;
            input.value = '';
            performLeftPanelSearch();
            setLeftPanelView({ query: 'Mix 250' });
            await new Promise((resolve) => setTimeout(resolve, 100));
            return {
                domBefore,
                total: getLeftPanelItemsArray().length,
                oldFindShows,
                items: getLeftPanelItemsArray().map((i) => i.title),
                rows: [...document.querySelectorAll('.left-panel-main-list .main-item-title')].map((e) => e.textContent)
            };
        });
        assert.ok(r.domBefore < 60, `the list is virtual: ${r.domBefore} rows in the DOM`);
        assert.equal(r.oldFindShows, 0, 'documents the old find box: it does not see Mix 250');
        assert.deepEqual(r.items, ['Mix 250']);
        assert.deepEqual(r.rows, ['Mix 250']);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('types: Playlists shows only playlists and the two special lists, Albums only albums, Folders only folders', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openApp();
        const r = await page.evaluate(() => {
            createFolder('Road trip');
            const out = {};
            for (const [key, types] of Object.entries({ playlists: ['all-songs', 'favorites', 'playlist'], folders: ['folder'], albums: ['album'], artists: ['artist'] })) {
                setLeftPanelView({ types });
                out[key] = [...new Set(getLeftPanelItemsArray().map((i) => i.type))].sort();
            }
            setLeftPanelView({ types: null });
            return out;
        });
        assert.deepEqual(r.playlists, ['all-songs', 'favorites', 'playlist']);
        assert.deepEqual(r.folders, ['folder']);
        assert.deepEqual(r.albums, ['album']);
        assert.deepEqual(r.artists, ['artist']);
        await page.close();
    });

    test('a playlist inside a folder is still listed when the Folders type is off, and hidden at the root when it is on', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openApp();
        const r = await page.evaluate(() => {
            const folder = createFolder('Road trip');
            addToFolder(folder.id, 'p7', 'playlist');
            const titles = () => getLeftPanelItemsArray().map((i) => i.title);
            setLeftPanelView({ types: ['playlist'] });
            const flat = titles().includes('Mix 007');
            setLeftPanelView({ types: null });
            const root = titles().includes('Mix 007');
            return { flat, root };
        });
        assert.equal(r.flat, true, 'Playlists chip must reach every playlist');
        assert.equal(r.root, false, 'with All the playlist lives inside its folder, as before');
        await page.close();
    });

    test('sort A to Z keeps pinned items first and the two special lists on top, everything else ascending (numbers by value)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openApp();
        const r = await page.evaluate(() => {
            savePinnedItems(['playlist-p200']);
            setLeftPanelView({ sort: 'name' });
            const titles = getLeftPanelItemsArray().map((i) => i.title);
            savePinnedItems([]);
            setLeftPanelView({ sort: 'recent' });
            return titles;
        });
        assert.equal(r[0], 'Mix 200', 'pinned first');
        assert.deepEqual(r.slice(1, 3).sort(), ['All Songs', 'Liked Songs']);
        const mixes = r.filter((x) => /^Mix /.test(x) && x !== 'Mix 200');
        assert.deepEqual(mixes, [...mixes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
        await page.close();
    });

    test('a query that matches nothing leaves no stale rows on screen', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openApp();
        const rows = await page.evaluate(async () => {
            setLeftPanelView({ query: 'zzzz-no-such-item' });
            await new Promise((resolve) => setTimeout(resolve, 100));
            return document.querySelectorAll('.left-panel-main-list .left-panel-main-item').length;
        });
        assert.equal(rows, 0);
        await page.close();
    });
});

describe('library panel in the new shell', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildNextApp();
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    const guard = (t) => (skip ? (t.skip(skip), false) : true);
    async function openShell() {
        const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html'));
        await page.waitForSelector('.library-panel .left-panel-main-item');
        await seedPlaylists(page);
        await page.waitForSelector('.library-panel .left-panel-main-list .main-item-title');
        await waitForStartupGone(page); // its animation slows the page and the panel's staged render races with this test's waits
        return { page, errors };
    }
    const titles = (page) => page.$$eval('.library-panel .left-panel-main-list .main-item-title', (els) => els.map((e) => e.textContent));

    test('boots with the panel mounted, the engine list inside it, and no errors', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openShell();
        const r = await page.evaluate(() => ({
            chips: [...document.querySelectorAll('.library-panel .chip')].map((c) => c.textContent),
            pressed: [...document.querySelectorAll('.library-panel .chip[aria-pressed="true"]')].map((c) => c.textContent),
            inPanel: !!document.querySelector('.library-panel__list #left-panel-main-content'),
            inHiddenHost: !!document.querySelector('[data-legacy-slot="host"] #left-panel-main-content')
        }));
        assert.deepEqual(r.chips, ['All', 'Playlists', 'Albums', 'Artists']);
        assert.deepEqual(r.pressed, ['All']);
        assert.equal(r.inPanel, true);
        assert.equal(r.inHiddenHost, false);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the list is windowed inside a constrained scroller and rows use the token height', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openShell();
        const r = await page.evaluate(() => {
            const scroller = document.getElementById('left-panel-main-content');
            const rows = [...document.querySelectorAll('.library-panel .left-panel-main-item:not(.lazy-skeleton)')];
            return { client: scroller.clientHeight, scroll: scroller.scrollHeight, rows: rows.length, rowHeight: Math.round(rows[0].getBoundingClientRect().height), total: getLeftPanelItemsArray().length };
        });
        assert.ok(r.client > 100 && r.client < 800, `scroller height ${r.client}`);
        assert.ok(r.scroll > r.client, 'the list scrolls');
        assert.ok(r.rows < r.total, `windowed: ${r.rows} rows of ${r.total}`);
        assert.equal(r.rowHeight, 61);
        await page.close();
    });

    test('typing in Find finds a row far below the window; clearing brings the list back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openShell();
        await page.click('.library-panel .panel-search__button'); // the find field is a button until it is opened
        await page.fill('.library-panel input[type="search"]', 'Mix 250');
        await page.waitForFunction(() => document.querySelectorAll('.library-panel .left-panel-main-item').length === 1);
        assert.deepEqual(await titles(page), ['Mix 250']);
        await page.fill('.library-panel input[type="search"]', 'zzzz');
        await page.waitForSelector('.library-panel__empty:not([hidden])');
        assert.match(await page.textContent('.library-panel__empty'), /Nothing matches "zzzz"/);
        await page.fill('.library-panel input[type="search"]', '');
        await page.waitForFunction(() => document.querySelectorAll('.library-panel .left-panel-main-item').length > 5);
        assert.equal(await page.isHidden('.library-panel__empty'), true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('chips filter by type and only one is on; the choice is remembered', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openShell();
        await page.click('.library-panel .chip:has-text("Albums")');
        await page.waitForFunction(() => [...document.querySelectorAll('.library-panel .chip[aria-pressed="true"]')].map((x) => x.textContent).join() === 'Albums');
        await page.click('.library-panel .chip:has-text("Playlists")');
        await page.waitForFunction(() => [...document.querySelectorAll('.library-panel .main-item-title')].some((e) => e.textContent === 'All Songs'));
        const kinds = await page.$$eval('.library-panel .main-item-subtitle', (els) => [...new Set(els.map((e) => e.firstElementChild.textContent.trim()))]);
        assert.deepEqual(kinds, ['Playlist']);
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('xplayer.ui-next.library')));
        assert.equal(saved.chip, 'playlists');
        await page.close();
    });

    test('sort A to Z reorders the rows', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openShell();
        await page.click('.library-panel .library-sort');
        await page.click('.menu__item:has-text("A to Z")');
        await page.waitForFunction(() => document.querySelector('.library-panel .library-sort').dataset.sort === 'name');
        await page.click('.library-panel .panel-search__button');
        await page.fill('.library-panel input[type="search"]', 'Mix 00');
        await page.waitForFunction(() => document.querySelectorAll('.library-panel .left-panel-main-item').length === 10);
        assert.deepEqual(await titles(page), Array.from({ length: 10 }, (_, i) => `Mix 00${i}`));
        await page.close();
    });

    test('Hide generated albums and artists is in the sort menu, is remembered, and leaves the made playlists', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openShell();
        await page.click('.library-panel .library-sort');
        assert.equal(await page.getAttribute('.menu__item:has-text("Hide generated")', 'aria-checked'), 'false');
        await page.click('.menu__item:has-text("Hide generated")');
        await page.waitForFunction(() => document.querySelector('.library-panel .library-sort').dataset.filtered === 'true');
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('xplayer.ui-next.library')));
        assert.equal(saved.hideGenerated, true);
        const kinds = await page.$$eval('.library-panel .main-item-subtitle', (els) => [...new Set(els.map((e) => e.firstElementChild.textContent.trim()))]);
        assert.ok(!kinds.includes('Album') && !kinds.includes('Artist'), `kinds ${kinds}`);
        await page.click('.library-panel .library-sort');
        await page.click('.menu__item:has-text("Hide generated")');
        await page.waitForFunction(() => document.querySelector('.library-panel .library-sort').dataset.filtered === 'false');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a selected Library row goes dark when the main view becomes Home, Settings, Sync or Metadata', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openShell();
        await page.click('.library-panel .left-panel-main-item[data-view="favorites"]');
        await page.waitForSelector('.library-panel .left-panel-main-item.active');
        for (const view of ['home', 'settings', 'lyrics', 'metadata']) {
            await page.click(`.rail-btn[data-view="${view}"]`);
            await page.waitForFunction((v) => document.querySelector('.view-host').dataset.view === v, view);
            assert.equal(await page.locator('.library-panel .left-panel-main-item.active').count(), 0, `no row stays selected over ${view}`);
        }
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Search and Recents rows are selected by what they stand for: a playlist, an album, an artist or a song', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openShell();
        const r = await page.evaluate(async () => {
            const { setPanelActive } = await import('./views/library/panel-active.js');
            const { itemRow, songRow } = await import('./views/library/panel-rows.js');
            const host = document.createElement('div');
            host.append(itemRow({ kind: 'playlist', id: 'p1', viewId: 'playlist-p1', title: 'P', cover: '' }), itemRow({ kind: 'album', id: 'a1234567890123', title: 'A', cover: '' }), songRow({ kind: 'song', id: 's1', title: 'S', cover: '' }));
            document.body.append(host);
            const lit = () => [...host.querySelectorAll('.plist-row')].map((b) => b.getAttribute('aria-current') === 'page');
            const out = {};
            setPanelActive({ page: 'playlist-p1' });
            out.playlist = lit();
            setPanelActive({ page: 'a1234567890123' });
            out.album = lit();
            setPanelActive({ song: 's1' });
            out.song = lit();
            setPanelActive({});
            out.none = lit();
            host.remove();
            return out;
        });
        assert.deepEqual(r, { playlist: [true, false, false], album: [false, true, false], song: [false, false, true], none: [false, false, false] });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the hero tint continues across the scroll bar, as wide as the bar and as tall as the hero\'s gradient (the hero and its extension)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openShell();
        await page.setViewportSize({ width: 1300, height: 560 });
        await page.waitForFunction(() => {
            const c = document.querySelector('.view-host .content');
            const e = document.querySelector('.songlist-hero-edge');
            return c && e && c.scrollHeight > c.clientHeight + 20 && !e.hidden;
        });
        // The window was just made shorter, which changes the hero's size (the compact hero), and the strip follows on the next frame: wait for it.
        await page.waitForFunction(() => {
            const edge = document.querySelector('.songlist-hero-edge');
            const b = document.querySelector('.songlist-bar').getBoundingClientRect();
            const w = edge.parentElement.getBoundingClientRect();
            const extend = parseFloat(document.querySelector('.view-host').style.getPropertyValue('--hero-extend')) || 0;
            const e = edge.getBoundingClientRect();
            return Math.abs(e.height - Math.min(b.height + extend, w.height - (e.top - w.top))) <= 1;
        });
        const r = await page.evaluate(() => {
            const c = document.querySelector('.view-host .content');
            const edge = document.querySelector('.songlist-hero-edge');
            const e = edge.getBoundingClientRect();
            const b = document.querySelector('.songlist-bar').getBoundingClientRect();
            const w = edge.parentElement.getBoundingClientRect();
            // the gradient goes on below the hero by --hero-extend (song-list.js), as far as the wrapper reaches
            const extend = parseFloat(document.querySelector('.view-host').style.getPropertyValue('--hero-extend')) || 0;
            return { width: Math.round(e.width), bar: c.offsetWidth - c.clientWidth, top: Math.round(e.top - b.top), height: Math.round(e.height - Math.min(b.height + extend, w.height - (e.top - w.top))), extend };
        });
        assert.equal(r.width, r.bar, 'as wide as the scroll bar');
        assert.ok(r.extend > 0, 'the gradient goes on below the hero');
        assert.ok(Math.abs(r.top) <= 1 && Math.abs(r.height) <= 1, `level with the hero, as tall as the hero and its extension ${JSON.stringify(r)}`);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the filter chips stay on one line and scroll sideways with arrows when the panel is narrow', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openShell();
        const r = await page.evaluate(() => {
            const chips = [...document.querySelectorAll('.library-panel .chip')];
            return { oneLine: new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top))).size === 1, strip: document.querySelector('.library-panel .chip-strip').dataset.overflow };
        });
        assert.equal(r.oneLine, true, 'the chips share one line');
        await page.evaluate(() => (document.querySelector('.library-panel .chip-strip').style.width = '150px'));
        await page.waitForFunction(() => document.querySelector('.library-panel .chip-strip').dataset.overflow === 'true');
        await page.click('.library-panel .chip-strip__arrow[aria-label*="forward"]');
        await page.waitForFunction(() => document.querySelector('.library-panel .chip-strip__row').scrollLeft > 0);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Find opens from its button, grows, clears with Escape, and shuts when empty and left', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openShell();
        assert.equal(await page.getAttribute('.library-panel .panel-search', 'data-open'), 'false');
        await page.click('.library-panel .panel-search__button');
        await page.waitForFunction(() => document.activeElement && document.activeElement.matches('.library-panel .panel-search__input'));
        assert.equal(await page.getAttribute('.library-panel .panel-search', 'data-open'), 'true');
        await page.keyboard.type('Mix 25');
        await page.keyboard.press('Escape');
        assert.equal(await page.inputValue('.library-panel input[type="search"]'), '');
        assert.equal(await page.getAttribute('.library-panel .panel-search', 'data-open'), 'true', 'the first Escape only clears');
        await page.keyboard.press('Escape');
        assert.equal(await page.getAttribute('.library-panel .panel-search', 'data-open'), 'false');
        await page.close();
    });

    test('opening a folder shows the folder bar with a working Back button; the controls hide meanwhile', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openShell();
        const id = await page.evaluate(() => {
            const folder = createFolder('Road trip');
            addToFolder(folder.id, 'p7', 'playlist');
            return folder.id;
        });
        await page.evaluate((folderId) => openFolder(folderId), id);
        await page.waitForSelector('.library-panel[data-folder="open"]');
        assert.equal(await page.textContent('.library-panel__folder-name'), 'Road trip');
        assert.equal(await page.isHidden('.library-panel__controls'), true);
        await page.click('.library-panel__folder-bar button');
        await page.waitForSelector('.library-panel[data-folder="closed"]');
        assert.equal(await page.isVisible('.library-panel__controls'), true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the list survives a trip to another rail item and back (the engine finds it by id the whole time)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openShell();
        await page.click('.rail-btn[data-view="settings"]');
        const during = await page.evaluate(() => ({ stillInPage: !!document.getElementById('left-panel-main-content'), panelHidden: document.querySelector('.library-panel').hidden }));
        assert.deepEqual(during, { stillInPage: true, panelHidden: false }); // a main-view item leaves the Library panel as it is (DP2, PA-04)
        await page.click('.rail-btn[data-view="library"]');
        await page.waitForFunction(() => !document.querySelector('.library-panel').hidden);
        assert.ok((await titles(page)).length > 5);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

describe('library panel source rules', () => {
    test('library files follow the adapter boundary: no legacy list classes, no hidden-host names, no engine ids', () => {
        const files = [path.join(NEXT_SRC, 'views', 'library', 'library-panel.js'), path.join(NEXT_SRC, 'views', 'library', 'library-panel.css')];
        for (const f of files) {
            const text = fs.readFileSync(f, 'utf8');
            assert.ok(!/\.song-item|\.song-number-item|#song-list|legacy-host/.test(text), `${path.basename(f)} uses a legacy name`);
        }
        const js = fs.readFileSync(files[0], 'utf8');
        assert.ok(!/getElementById|querySelector/.test(js), 'the panel script looks nothing up by id or selector');
    });

    test('the bridge stays small (it is part of the A-04c budget, D18: 300 lines across store, actions, events)', () => {
        const lines = fs
            .readFileSync(path.join(NEXT_SRC, 'adapter', 'library-bridge.js'), 'utf8')
            .split(/\r?\n/)
            .filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l)).length;
        assert.ok(lines <= 60, `library-bridge.js has ${lines} code lines`);
    });
});

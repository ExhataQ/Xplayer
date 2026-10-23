// Home inside the shell (task PA, integration of PB-15): the rail item opens Home, and its cards reach the right engine view.
// Real engine, real shell, real browser; the engine's own functions seed the history exactly as playing would.
//
// Run:   node --test tools/tests/ui-next-home-shell.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('Home in the shell', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(60);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = '<script>window.electronAPI = new Proxy({}, {get:(t,k)=>(k==="then"?undefined:(...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null))});</script>\n';
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    // Seeds what playing leaves behind: four recent songs, a played album and artist, and a playlist with two songs.
    async function open() {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        page.on('console', (m) => m.type() === 'error' && !/ERR_FILE_NOT_FOUND/.test(m.text()) && errors.push(m.text()));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        const seeded = await page.evaluate(() => {
            window.SONGS_DATA.slice(0, 4).forEach((s) => window.saveToRecentlyPlayed(s));
            const album = window.getAlbums()[2];
            const artist = window.getArtists()[3];
            window.movePlayedItemToTop(album.id);
            window.movePlayedItemToTop(artist.id);
            const playlist = window.createPlaylist('Road trip');
            window.addSongToPlaylist(window.SONGS_DATA[10].id, playlist.id);
            window.addSongToPlaylist(window.SONGS_DATA[11].id, playlist.id);
            return { album: album.id, albumName: album.name, artist: artist.id, artistName: artist.name, playlist: `playlist-${playlist.id}`, farSong: window.SONGS_DATA[40] };
        });
        return { page, errors, seeded };
    }

    const home = (page) => page.locator('.rail-btn[data-view="home"]').click();
    const card = (page, shelf, title) => page.locator(`[data-shelf="${shelf}"] .shelf-card`, { hasText: title });
    const engineView = (page) => page.evaluate(() => window.currentView);
    const rows = (page) => page.locator('.view-host .song-item:not(.lazy-skeleton)').count();

    test('the Home rail item shows the Home view with its shelves, and no placeholder', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await home(page);
        assert.equal(await page.evaluate(() => document.querySelector('.view-host').dataset.view), 'home');
        assert.equal(await page.locator('.view-host .home').count(), 1);
        assert.equal(await page.locator('.view-host .empty-view').count(), 0);
        assert.equal(await page.locator('.rail-btn[data-view="home"]').getAttribute('aria-current'), 'page');
        assert.deepEqual(await page.locator('.shelf').evaluateAll((s) => s.map((n) => n.dataset.shelf)), ['recent-songs', 'playlists', 'recent-albums', 'recent-artists']);
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.shelf__title')).fontSize !== ''), true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the home.css file is linked, so the registered fade properties exist', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        assert.equal(await page.evaluate(() => [...document.styleSheets].some((s) => (s.href || '').endsWith('views/home/home.css'))), true);
        await page.close();
    });

    test('the generated viewId values are the engine\'s own view names, and switchView alone cannot open them (why the bridge uses openAlbum and friends)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, seeded } = await open();
        const ids = await page.evaluate(async () => {
            const { homeData } = await import(new URL('adapter/home-bridge.js', location.href).href);
            const d = homeData();
            return { playlist: d.playlists[0].viewId, album: d.albums[0].viewId, artist: d.artists[0].viewId };
        });
        assert.equal(ids.playlist, seeded.playlist);
        assert.equal(ids.album, seeded.album);
        assert.equal(ids.artist, seeded.artist);
        assert.match(ids.album, /^a.{12}$/);
        assert.match(ids.artist, /^r.{12}$/);
        // The engine's switchView sets the album view as current and then finds it current, so nothing is drawn: all songs stay on screen.
        await page.evaluate((v) => window.switchView(v), ids.album);
        await page.waitForTimeout(300);
        assert.equal(await rows(page), 60, 'switchView(albumId) draws nothing (engine behavior the bridge works around)');
        await page.close();
    });

    for (const [name, shelf, title, key, expectedRows] of [
        ['playlist', 'playlists', 'Road trip', 'playlist', 2],
        ['album', 'recent-albums', null, 'album', 1],
        ['artist', 'recent-artists', null, 'artist', 1]
    ]) {
        test(`a ${name} card goes to Library, opens that ${name} in the engine, and the rail follows`, TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page, errors, seeded } = await open();
            await home(page);
            await card(page, shelf, title || (key === 'album' ? seeded.albumName : seeded.artistName)).first().click();
            assert.equal(await page.evaluate(() => document.querySelector('.view-host').dataset.view), 'library');
            assert.equal(await engineView(page), seeded[key]);
            assert.equal(await page.locator('.rail-btn[data-view="library"]').getAttribute('aria-current'), 'page');
            assert.equal(await page.locator('.rail-btn[data-view="home"]').getAttribute('aria-current'), null);
            assert.equal(await page.locator('.view-host .home').count(), 0, 'Home is gone');
            await page.waitForFunction((n) => document.querySelectorAll('.view-host .song-item:not(.lazy-skeleton)').length >= n, expectedRows);
            assert.equal(await rows(page), expectedRows);
            assert.deepEqual(errors, []);
            await page.close();
        });
    }

    test('a card for the item the engine already shows still opens it (the second switch is not a no-op)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, seeded } = await open();
        await page.evaluate((v) => window.switchView(v), seeded.playlist); // the engine is on the playlist ...
        await home(page); // ... the person goes to Home ...
        await card(page, 'playlists', 'Road trip').first().click(); // ... and picks the same playlist
        assert.equal(await page.evaluate(() => document.querySelector('.view-host').dataset.view), 'library');
        assert.equal(await engineView(page), seeded.playlist);
        await page.waitForFunction(() => document.querySelectorAll('.view-host .song-item:not(.lazy-skeleton)').length === 2);
        await page.close();
    });

    test('a song card plays that song even when the engine\'s last view does not contain it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, seeded } = await open();
        // The engine's current view is the two-song playlist; the song on Home (number 40) is not in it.
        await page.evaluate(({ v, song }) => {
            window.saveToRecentlyPlayed(song);
            window.switchView(v);
        }, { v: seeded.playlist, song: seeded.farSong });
        await home(page);
        await card(page, 'recent-songs', seeded.farSong.title).first().click();
        await page.waitForFunction((title) => document.getElementById('player-title')?.textContent.includes(title), seeded.farSong.title);
        assert.equal(await page.evaluate(() => document.querySelector('.view-host').dataset.view), 'home', 'a song card stays on Home');
        assert.equal(await page.evaluate(() => window.playbackQueue.length), 60, 'the queue is the whole library');
        await page.close();
    });

    test('leaving Home removes it (no leftover listener or view), and coming back draws it again', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await home(page);
        await page.locator('.rail-btn[data-view="search"]').click();
        assert.equal(await page.locator('.home').count(), 0);
        await home(page);
        assert.equal(await page.locator('.home').count(), 1);
        await page.close();
    });
});

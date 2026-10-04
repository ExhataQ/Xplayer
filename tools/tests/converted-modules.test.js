// Browser test for the files converted to ES modules (03-storage.js, 03a-recents.js,
// 03b-search-engine.js). The unit tests import them directly; this one checks the part only
// the real page shows: that the modules load as <script type="module">, that every name the
// remaining classic scripts call by bare name is registered, and that the app's own call paths
// (no arguments, reading the live library) work. Names from core/storage.js (a classic script)
// are listed too, because 00-state.js reads them while it loads.
//
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'manifest.json'), 'utf8'));
const pw = loadPlaywright();

// Every name that classic scripts use from a converted file (see `node tools/dep-map.js uses <name>`).
const REGISTERED = {
    functions: ['normalizeIdList', 'normalizeStringList', 'normalizeObjectList', 'normalizePlaylists', 'normalizeFolders', 'normalizePinnedMap', 'normalizeSettings', 'normalizePanelWidths', 'storageRead', 'storageWrite', 'storageRemove', 'storageReadBool', 'storageWriteBool', 'storageReadJson', 'storageWriteJson', 'addToRecentList', 'getRecentlyPlayedSongs', 'getRecentCount', 'normalizeSearchText', 'searchSongs', 'getSearchResults', 'initThemeButtons'],
    constants: { MAX_RECENT_SONGS: 50, MAX_HISTORY_ENTRIES: 500, MAX_SEARCH_HISTORY: 20 }
};

describe('converted ES modules in the real page', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(20);
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

    test('the built page loads every manifest module as type="module"', { timeout: 30000 }, async (t) => {
        if (!guard(t)) return;
        const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
        for (const name of manifest.modules) {
            assert.ok(html.includes(`<script type="module" src="js/${name}"></script>`), `${name} should be a module tag`);
            assert.ok(!html.includes(`<script src="js/${name}"></script>`), `${name} should not also be a classic tag`);
        }
    });

    test('all names the classic scripts call are registered on window, with no page errors', { timeout: 30000 }, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const seen = await page.evaluate(({ functions, constants }) => ({
            functions: Object.fromEntries(functions.map((n) => [n, typeof window[n]])),
            constants: Object.fromEntries(Object.keys(constants).map((n) => [n, window[n]]))
        }), REGISTERED);
        for (const n of REGISTERED.functions) assert.equal(seen.functions[n], 'function', `window.${n}`);
        assert.deepEqual(seen.constants, REGISTERED.constants);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the app call paths work: stored JSON, recents from the live library, search over active songs', { timeout: 30000 }, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const out = await page.evaluate(() => {
            const first = SONGS_DATA[0];
            const second = SONGS_DATA[1];
            localStorage.setItem('__probe', '{"a":1}');
            const stored = storageReadJson('__probe', null);
            const missing = storageReadJson('__nope', 'fallback');
            localStorage.removeItem('__probe');
            saveToRecentlyPlayed(first);
            saveToRecentlyPlayed(second);
            const recentIds = getRecentlyPlayedSongs().map((s) => s.id);
            const countBefore = getRecentCount();
            markSongAsDeleted(second.id);
            const countAfter = getRecentCount();
            const results = getSearchResults(second.title).map((s) => s.id);
            const firstResults = getSearchResults(first.title).map((s) => s.id);
            return { stored, missing, recentIds, countBefore, countAfter, results, firstIncluded: firstResults.includes(first.id), secondId: second.id, firstId: first.id };
        });
        assert.deepEqual(out.stored, { a: 1 });
        assert.equal(out.missing, 'fallback');
        assert.deepEqual(out.recentIds, [out.secondId, out.firstId]);
        assert.equal(out.countBefore, 2);
        assert.equal(out.countAfter, 1, 'a deleted song is not counted');
        assert.ok(!out.results.includes(out.secondId), 'a deleted song is not searchable');
        assert.ok(out.firstIncluded);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('data saved by an older build still loads, and bad data is repaired instead of breaking the page', { timeout: 30000 }, async (t) => {
        if (!guard(t)) return;
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        // Written before any app script runs, exactly as an older build left it.
        await page.addInitScript(() => {
            localStorage.setItem('favorites', '[3,5]');
            localStorage.setItem('playlists', '[{"id":"p1","name":"Old mix","songs":[1,2],"createdAt":"1/1/2024"},{"name":"broken, no id"},null]');
            localStorage.setItem('folders', '{"not":"a list"}');
            localStorage.setItem('leftPanelCollapsed', 'true');
            localStorage.setItem('panelWidths', '{"left":321,"right":433}'); // start-up re-measures and rewrites it, so only "no errors" is checked
            localStorage.setItem('minimizeOnClose', 'true');
            localStorage.setItem('smartShuffleSettings', '{"journeySize":"lots","replayGainLimiter":false}');
        });
        await page.goto('file://' + path.join(dir, 'index.html').replace(/\\/g, '/'));
        await page.waitForTimeout(900);
        const out = await page.evaluate(() => ({
            favorites: getFavorites(),
            playlists: getPlaylists(),
            folders: getFolders(),
            leftCollapsed: leftPanelCollapsed,
            minimizeOnClose: getWindowSettings().minimizeOnClose,
            journeySize: getSmartShuffleSettings().journeySize,
            limiter: getSmartShuffleSettings().replayGainLimiter,
            rawFolders: localStorage.getItem('folders')
        }));
        assert.deepEqual(out.favorites, [3, 5]);
        assert.deepEqual(out.playlists, [{ id: 'p1', name: 'Old mix', songs: [1, 2], createdAt: '1/1/2024' }]);
        assert.deepEqual(out.folders, []);
        assert.equal(out.rawFolders, '{"not":"a list"}', 'reading must not rewrite what is stored');
        assert.equal(out.leftCollapsed, true);
        assert.equal(out.minimizeOnClose, true);
        assert.equal(out.journeySize, 50);
        assert.equal(out.limiter, false);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

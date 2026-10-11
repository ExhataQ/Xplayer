// D-09e: 04b to 04g (the view renderers) and 07a (the data-action wrappers) are ES modules.
// What the renderers draw is covered by the other browser tests (scroll, search-ui, view-switch-song-list-cleanup,
// ui-handlers, the pinned call-sequence baselines). This file checks the wiring: manifest placement, that each file
// only exports its functions and registers exactly those on window (07a also registers its actions at load), and
// that in a real page every name is a function and every renderer runs without a page error.
// Needs: acorn (devDependency). The last describe needs playwright + a browser and skips itself if missing.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const SRC = path.resolve(__dirname, '..', '..', 'src');
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const FILES = {
    '04b-render-playlists-folders.js': ['renderPlaylistsView', 'renderFoldersView', 'renderFolderContents', 'renderPlaylistDetailView'],
    '04c-render-albums.js': ['renderAlbumsView', 'renderAlbumDetailView', 'renderAlbumLeftPanelItems'],
    '04d-render-artists.js': ['renderArtistDetailView', 'renderArtistLeftPanelItems'],
    '04e-render-favorites-history.js': ['renderFavoritesView', 'renderHistoryView', 'renderRecentlyPlayed', 'renderPortableRecentlyPlayed'],
    '04f-render-search-history.js': ['renderSearchHistoryView'],
    '04g-render-lyrics-view.js': ['renderLyricsView', 'teardownLyricsView'],
    '07a-ui-actions.js': ['applyActionAttrs']
};
const parse = (file) => acorn.parse(fs.readFileSync(path.join(SRC, 'js', file), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });

describe('D-09e: manifest', () => {
    test('the seven files are modules and no longer classic scripts', () => {
        for (const file of Object.keys(FILES)) {
            assert.ok(manifest.modules.includes(file), `${file} should be in modules`);
            assert.ok(!manifest.js.includes(file), `${file} should not be in js`);
        }
    });

    test('they sit after 06i and before 06c, so 06a can still be inserted before 06c', () => {
        const m = manifest.modules;
        for (const file of Object.keys(FILES)) {
            assert.ok(m.indexOf('06i-theme-switcher.js') < m.indexOf(file), `${file} after 06i`);
            assert.ok(m.indexOf(file) < m.indexOf('06c-scrollbar-widget.js'), `${file} before 06c`);
        }
    });
});

describe('D-09e: module shape', () => {
    for (const [file, names] of Object.entries(FILES)) {
        test(`${file} exports ${names.join(', ')} and registers the same names`, () => {
            const ast = parse(file);
            const exported = ast.body.filter((n) => n.type === 'ExportNamedDeclaration').map((n) => n.declaration.id.name);
            assert.deepEqual(exported.sort(), [...names].sort(), 'every top-level function is exported');
            assert.ok(!ast.body.some((n) => n.type === 'FunctionDeclaration'), 'no function is left unexported');
            const text = fs.readFileSync(path.join(SRC, 'js', file), 'utf8');
            const block = text.match(/if \(typeof registerLegacyGlobals === 'function'\) \{\s+registerLegacyGlobals\(\{([^}]*)\}\);\s+\}/);
            assert.ok(block, 'guarded registration present');
            assert.deepEqual(block[1].split(',').map((s) => s.trim()).filter(Boolean).sort(), [...names].sort());
        });
    }

    test('the renderers (04b to 04g) do nothing at load time except declare functions and register them', () => {
        for (const file of Object.keys(FILES).filter((f) => f.startsWith('04'))) {
            const kinds = parse(file).body.map((n) => n.type);
            assert.ok(kinds.every((k) => k === 'ExportNamedDeclaration' || k === 'IfStatement'), `${file}: ${kinds.join(',')}`);
        }
    });
});

describe('D-09e: real page', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(60);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('every name is a function on window and start-up completes without errors', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
            await gotoApp(page, dir);
            const names = Object.values(FILES).flat();
            const types = await page.evaluate((list) => list.map((n) => [n, typeof window[n]]), names);
            assert.deepEqual(types.filter(([, type]) => type !== 'function'), []);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('the data-action wrappers registered by 07a at load exist and applyActionAttrs copies attributes', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
            await gotoApp(page, dir);
            const result = await page.evaluate(() => {
                const el = document.createElement('div');
                applyActionAttrs(el, 'data-action="goBack" data-args="[1]"');
                return { action: el.getAttribute('data-action'), args: el.getAttribute('data-args') };
            });
            assert.deepEqual(result, { action: 'goBack', args: '[1]' });
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('every renderer runs on a real library and leaves content behind, with no page error', { timeout: 60000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
            await gotoApp(page, dir);
            const result = await page.evaluate(async () => {
                const wait = (ms) => new Promise((r) => setTimeout(r, ms));
                const out = {};
                const run = async (name, fn, selector) => {
                    try { fn(); } catch (e) { out[name] = 'threw: ' + e.message; return; }
                    await wait(80);
                    out[name] = (document.querySelector(selector) || { children: [] }).children.length > 0 ? 'ok' : 'empty';
                };
                await run('albums', () => renderAlbumsView(), '#song-list');
                await run('playlists', () => renderPlaylistsView(), '#song-list');
                await run('folders', () => renderFoldersView(), '#song-list');
                await run('artistLeft', () => renderArtistLeftPanelItems(), '.left-panel-main-list');
                await run('albumLeft', () => renderAlbumLeftPanelItems(), '.left-panel-main-list');
                await run('artistDetail', () => renderArtistDetailView(SONGS_DATA[0].artist), '#song-list');
                await run('favorites', () => renderFavoritesView(), '#song-list');
                await run('history', () => renderHistoryView(), '#song-list');
                await run('searchHistory', () => renderSearchHistoryView(), '#song-list');
                return out;
            });
            for (const [name, state] of Object.entries(result)) assert.notEqual(state.startsWith('threw'), true, `${name}: ${state}`);
            assert.equal(result.albums, 'ok');
            assert.equal(result.artistDetail, 'ok');
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
});

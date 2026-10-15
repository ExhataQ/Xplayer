// 04b to 04g (the view renderers) and 07a (the data-action wrappers) are ES modules.
// What the renderers draw is covered by the other browser tests (scroll, search-ui, view-switch-song-list-cleanup,
// ui-handlers, the pinned call-sequence baselines). This file checks the wiring: manifest placement, that each file
// only exports its functions (07a also registers its actions at load), and that in a real page every renderer runs
// without a page error. That the names are registered on window is checked in window-contract.test.js.
// Needs: acorn (devDependency). The last describe needs playwright + a browser and skips itself if missing.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const SRC = path.resolve(__dirname, '..', '..', 'src');
const manifest = require('../lib/manifest').readManifest(path.resolve(SRC, '..'));
const FILES = {
    'ui/04b-render-playlists-folders.js': ['renderPlaylistsView', 'renderFoldersView', 'renderFolderContents', 'renderPlaylistDetailView'],
    'ui/04c-render-albums.js': ['renderAlbumsView', 'renderAlbumDetailView', 'renderAlbumLeftPanelItems'],
    'ui/04d-render-artists.js': ['renderArtistDetailView', 'renderArtistLeftPanelItems'],
    'ui/04e-render-favorites-history.js': ['renderFavoritesView', 'renderHistoryView', 'renderRecentlyPlayed', 'renderPortableRecentlyPlayed'],
    'ui/04f-render-search-history.js': ['renderSearchHistoryView'],
    'ui/04g-render-lyrics-view.js': ['renderLyricsView', 'teardownLyricsView'],
    'ui/07a-ui-actions.js': ['applyActionAttrs']
};
const parse = (file) => acorn.parse(fs.readFileSync(path.join(SRC, 'js', file), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });

describe('D-09e: manifest', () => {
    test('the seven files are modules and no longer classic scripts', () => {
        for (const file of Object.keys(FILES)) {
            assert.ok(manifest.modules.includes(file), `${file} should be in modules`);
        }
    });

    test('they sit after 06i and before 06c, so 06a can still be inserted before 06c', () => {
        const m = manifest.modules;
        for (const file of Object.keys(FILES)) {
            assert.ok(m.indexOf('ui/06i-theme-switcher.js') < m.indexOf(file), `${file} after 06i`);
            assert.ok(m.indexOf(file) < m.indexOf('ui/06c-scrollbar-widget.js'), `${file} before 06c`);
        }
    });
});

describe('D-09e: module shape', () => {
    for (const [file, names] of Object.entries(FILES)) {
        test(`${file} exports ${names.join(', ')} and has no unexported function`, () => {
            const ast = parse(file);
            const exported = ast.body.filter((n) => n.type === 'ExportNamedDeclaration').map((n) => n.declaration.id.name);
            assert.deepEqual(exported.sort(), [...names].sort(), 'every top-level function is exported');
            assert.ok(!ast.body.some((n) => n.type === 'FunctionDeclaration'), 'no function is left unexported');
        });
    }

    test('the renderers (04b to 04g) do nothing at load time except declare functions and register them', () => {
        for (const file of Object.keys(FILES).filter((f) => f.split('/').pop().startsWith('04'))) {
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

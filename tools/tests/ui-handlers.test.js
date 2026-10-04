'use strict';

// Agent D, step D-05: the UI shell's inline on...= handlers became data-action (core/LEGACY.md).
//
//   - static check: the number of inline handlers left in each D file can only go down
//   - browser checks (Playwright, skipped if it is missing): the converted controls still call the
//     same function with the same arguments, in the same order, as the inline handlers did

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');

// Inline handlers (on...="...") still written in each D file. Lower these when you convert more;
// the test fails if a file gets more. Left on purpose (see .agent/reports/D/0007-*.md): handlers that
// call event.stopPropagation(), handlers on elements other code finds by their onclick text,
// mousedown handlers that must run before drag listeners, and the right-panel header that
// 08d-panel-right-tabs.js rewrites with setAttribute('onclick', ...).
const INLINE_CEILING = {
    'src/js/04a-ui-render-core.js': 22,
    'src/js/04b-render-playlists-folders.js': 3,
    'src/js/04c-render-albums.js': 6,
    'src/js/04d-render-artists.js': 1,
    'src/js/04e-render-favorites-history.js': 0,
    'src/js/04f-render-search-history.js': 1,
    'src/js/04g-render-lyrics-view.js': 0,
    'src/js/05b-lazy-load-left-panel.js': 4,
    'src/js/06a-context-menus.js': 3,
    'src/js/06b-modals.js': 16,
    'src/js/06j-notification-system.js': 1,
    'src/js/07-views.js': 1,
    'build/music_player.html': 20
};
const INLINE = /(?<![\w.])on(?:click|change|input|mousedown|contextmenu|error|dblclick|keydown|blur)\s*=\s*\\?["'`]/g;

describe('inline handlers left in the D files', () => {
    for (const [file, ceiling] of Object.entries(INLINE_CEILING)) {
        test(`${file}: at most ${ceiling}`, () => {
            const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
            const count = (source.match(INLINE) || []).length;
            assert.ok(count <= ceiling, `${file} has ${count} inline handlers, the ceiling is ${ceiling}; convert them to data-action instead`);
        });
    }
});

describe('converted UI controls behave like the inline handlers did (real page)', () => {
    let pw, browser, dir, skip;
    before(async () => {
        pw = loadPlaywright();
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(50);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    async function openPage() {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto('file://' + path.join(dir, 'index.html'));
        await page.waitForTimeout(500);
        return { page, errors };
    }

    // Replaces global functions with spies that record name(args) and, for closeContextMenu, still run.
    const SPY_SETUP = `
        window.__calls = [];
        window.__spy = (names) => {
            const desc = (a) => (typeof a === 'function' ? 'fn' : JSON.stringify(a));
            for (const n of names) {
                window[n] = function (...a) { window.__calls.push(n + '(' + a.map(desc).join(',') + ')'); };
            }
        };
        window.__realClose = window.closeContextMenu;
        window.__spyClose = () => {
            window.closeContextMenu = function (...a) { window.__calls.push('closeContextMenu()'); return window.__realClose.apply(this, a); };
        };
        window.__click = (el) => {
            const r = el.getBoundingClientRect();
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
        };
    `;

    test('every data-action control in the page template calls its function once, with no arguments', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(`(() => {
            ${SPY_SETUP}
            const kinds = [['', 'click'], ['-input', 'input'], ['-blur', 'blur']];
            const found = [];
            for (const [suffix, type] of kinds) {
                for (const el of document.querySelectorAll('[data-action' + suffix + ']')) {
                    found.push({ el, name: el.getAttribute('data-action' + suffix), type });
                }
            }
            // performSearch is a const (debounced) in 08h, not a global function, so it cannot be spied on.
            const names = [...new Set(found.map((f) => f.name))].filter((n) => Object.getOwnPropertyDescriptor(window, n));
            __spy(names);
            const out = [];
            for (const f of found) {
                if (!names.includes(f.name)) continue;
                __calls.length = 0;
                f.el.disabled = false;
                if (f.type === 'click') f.el.click();
                else if (f.type === 'input') f.el.dispatchEvent(new Event('input', { bubbles: true }));
                else f.el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
                out.push({ id: f.el.id || f.el.className, name: f.name, calls: [...__calls] });
            }
            return out;
        })()`);
        assert.ok(result.length >= 35, `expected the template to have many data-action controls, found ${result.length}`);
        for (const r of result) assert.deepEqual(r.calls, [`${r.name}()`], `${r.id}: ${r.name}`);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('search history: the row opens the entry with its id and query, the delete button only deletes', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(`(() => {
            ${SPY_SETUP}
            __spy(['openSearchHistoryChild', 'deleteSearchHistoryEntry', 'clearSearchHistory']);
            window.getSearchHistory = () => [{ sessionId: 's1', query: "it's a \\"test\\" \\\\ x", resultCount: 3, timestamp: Date.now() }];
            renderSearchHistoryView();
            const list = document.getElementById('song-list');
            const out = {};
            __calls.length = 0; __click(list.querySelector('.search-history-item')); out.row = [...__calls];
            __calls.length = 0; __click(list.querySelector('.more-info')); out.del = [...__calls];
            __calls.length = 0; __click(list.querySelector('.clear-history-btn')); out.clear = [...__calls];
            return out;
        })()`);
        assert.deepEqual(result.row, ['openSearchHistoryChild("s1","it\'s a \\"test\\" \\\\ x")']);
        assert.deepEqual(result.del, ['deleteSearchHistoryEntry("s1")']);
        assert.deepEqual(result.clear, ['clearSearchHistory()']);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('context menus: items call their function and then close the menu; play items close first', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(`(async () => {
            ${SPY_SETUP}
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            __spy(['toggleFavoriteFromMenu', 'showSongMetadataModal', 'removeFromQueue', 'addArtistToQueue', 'openArtist', 'playCurrentViewFromStart', 'togglePinItem', 'confirmDeleteFolder', 'openFolder']);
            __spyClose();
            const fire = (fn) => { const el = document.createElement('div'); document.body.appendChild(el); el.addEventListener('contextmenu', (e) => fn(e), { once: true }); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 200 })); el.remove(); };
            const itemByText = (text) => [...document.querySelectorAll('#context-menu .context-menu-item')].find((e) => e.textContent.trim().startsWith(text));
            const out = {};
            const run = async (key, open, text) => { open(); __calls.length = 0; __click(itemByText(text)); await sleep(150); out[key] = [...__calls]; if (document.getElementById('context-menu')) __realClose(); };
            await run('favorite', () => fire((e) => showContextMenu(e, 3, {})), 'Add to favorites');
            await run('metadata', () => fire((e) => showContextMenu(e, 3, {})), 'Show metadata');
            await run('queue', () => fire((e) => showContextMenu(e, 3, { queueIndex: 4 })), 'Remove from queue');
            await run('artistAdd', () => fire((e) => showArtistContextMenu(e, "Artist 1")), 'Add to queue');
            await run('artistPlay', () => fire((e) => showArtistContextMenu(e, "Artist 1")), 'Play');
            await run('pinQuote', () => fire((e) => showLeftPanelItemContextMenu(e, 'artist-x', "O'Neil", 'artist')), 'Pin to top');
            createFolder("Fold's"); const folderId = getFolders().slice(-1)[0].id;
            await run('folderOpen', () => fire((e) => showFolderContextMenu(e, folderId)), 'Open');
            await run('folderDelete', () => fire((e) => showFolderContextMenu(e, folderId)), 'Delete folder');
            out.folderId = folderId;
            return out;
        })()`);
        assert.deepEqual(result.favorite, ['toggleFavoriteFromMenu()', 'closeContextMenu()']);
        assert.deepEqual(result.metadata, ['showSongMetadataModal(3)', 'closeContextMenu()']);
        assert.deepEqual(result.queue, ['removeFromQueue(4)', 'closeContextMenu()']);
        assert.deepEqual(result.artistAdd, ['addArtistToQueue("Artist 1")', 'closeContextMenu()']);
        assert.deepEqual(result.artistPlay, ['closeContextMenu()', 'openArtist("Artist 1")', 'playCurrentViewFromStart()']);
        assert.deepEqual(result.pinQuote, ['togglePinItem("artist-x","O\'Neil")', 'closeContextMenu()']);
        assert.deepEqual(result.folderOpen, [`openFolder(${JSON.stringify(result.folderId)})`, 'closeContextMenu()']);
        assert.deepEqual(result.folderDelete, [`confirmDeleteFolder(${JSON.stringify(result.folderId)},"Fold's")`, 'closeContextMenu()']);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('lyrics view: the mode, editor and variant buttons call their function with the right arguments', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(`(() => {
            ${SPY_SETUP}
            __spy(['setLyricsDisplayMode', 'openLyricsEditor', 'openSyncEditor', 'importLrcFile', 'openLrcPasteDialog', 'openOnlineLyricsView', 'selectSyncedVariant', 'renameSyncedVariant', 'deleteSyncedVariant']);
            setPlaybackQueue([SONGS_DATA[0]]); setCurrentQueueIndex(0);
            window.getLyricsForSong = () => 'line one\\nline two';
            window.initSyncedLyrics = () => { syncedLyricsState = { songId: SONGS_DATA[0].id, entries: [{ text: 'a', time: 0 }, { text: 'b', time: 1 }] }; return true; };
            window.getSyncedLyricsVariantsForSong = () => ({ activeId: 'v1', variants: [{ id: 'v1', name: 'One', createdAt: 1 }, { id: 'v2', name: 'Two', createdAt: 2 }] });
            window.getLyricsDisplayMode = () => 'auto';
            renderLyricsView();
            const root = document.getElementById('lyrics-view-root');
            const out = [];
            for (const el of root.querySelectorAll('[data-action]')) {
                __calls.length = 0; __click(el); out.push([...__calls]);
            }
            return out;
        })()`);
        assert.deepEqual(result.flat(), [
            'setLyricsDisplayMode("plain")', 'openLyricsEditor()', 'openSyncEditor()', 'importLrcFile()', 'openLrcPasteDialog()', 'openOnlineLyricsView()',
            'selectSyncedVariant("v1")', 'selectSyncedVariant("v1")', 'renameSyncedVariant("v1")', 'deleteSyncedVariant("v1")',
            'selectSyncedVariant("v2")', 'selectSyncedVariant("v2")', 'renameSyncedVariant("v2")', 'deleteSyncedVariant("v2")'
        ]);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

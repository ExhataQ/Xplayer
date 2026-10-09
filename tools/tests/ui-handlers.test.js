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
    'src/js/04a-ui-render-core.js': 0,
    'src/js/04b-render-playlists-folders.js': 0,
    'src/js/04c-render-albums.js': 0,
    'src/js/04d-render-artists.js': 0,
    'src/js/04e-render-favorites-history.js': 0,
    'src/js/04f-render-search-history.js': 0,
    'src/js/04g-render-lyrics-view.js': 0,
    'src/js/05b-lazy-load-left-panel.js': 0,
    'src/js/06a-context-menus.js': 0,
    'src/js/06b-modals.js': 0,
    'src/js/06j-notification-system.js': 0,
    'src/js/07-views.js': 0,
    'build/music_player.html': 0
};
const INLINE = /(?<![\w.])on(?:click|change|input|mousedown|contextmenu|error|dblclick|keydown|blur)\s*=\s*\\?["'`]|setAttribute\(\s*['"]on/g;

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
                for (const el of document.querySelectorAll('[data-action' + suffix + ']:not([data-args' + suffix + '])')) {
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
    test('template controls with arguments pass them through', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(`(() => {
            ${SPY_SETUP}
            __spy(['switchView', 'showSpecialItemContextMenu', 'showSubheroContextMenu', 'closeImageViewer', 'closeExtendedInfoPanel']);
            const out = {};
            const li = document.querySelector('.left-panel-main-item[data-view="favorites"]');
            __calls.length = 0; __click(li); out.fav = [...__calls];
            __calls.length = 0;
            const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
            li.dispatchEvent(ev); out.menu = [...__calls]; out.prevented = ev.defaultPrevented;
            __calls.length = 0; __click(document.querySelector('.image-viewer-content')); out.viewerInner = [...__calls];
            __calls.length = 0; __click(document.getElementById('image-viewer')); out.viewer = [...__calls];
            return out;
        })()`);
        assert.deepEqual(result.fav, ['switchView("favorites")']);
        assert.match(result.menu[0], /^showSpecialItemContextMenu\(.*,"favorites","Liked Songs"\)$/);
        assert.equal(result.prevented, true);
        assert.deepEqual(result.viewerInner, []);
        assert.deepEqual(result.viewer, ['closeImageViewer()']);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('song rows: click, double click, menu, number cell, buttons and spans call the right function', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(`(() => {
            ${SPY_SETUP}
            __spy(['selectSongItem', 'playSongFromList', 'handleNumberCellClick', 'toggleFavorite', 'showContextMenu', 'openArtist', 'openAlbum']);
            const holder = document.createElement('div');
            holder.innerHTML = buildSongItemHTML({ song: SONGS_DATA[0], index: 2, listId: 'all-songs' });
            document.body.appendChild(holder);
            const row = holder.querySelector('.song-item');
            const id = SONGS_DATA[0].id;
            const out = {};
            const run = (key, fn) => { __calls.length = 0; fn(); out[key] = [...__calls].map((c) => c.replace(/\{[^}]*\}/g, 'EV')); };
            run('number', () => __click(row.querySelector('.song-number-item')));
            run('fav', () => __click(row.querySelector('.favorite-btn')));
            run('dbl', () => row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })));
            run('numDbl', () => row.querySelector('.song-number-item').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })));
            run('menu', () => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
            run('more', () => __click(row.querySelector('.more-info')));
            run('enter', () => row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
            out.id = id;
            holder.remove();
            return out;
        })()`);
        const id = result.id;
        assert.deepEqual(result.number, [`handleNumberCellClick(${id},"all-songs",2)`]);
        assert.equal(result.fav.length, 1);
        assert.match(result.fav[0], new RegExp(`^toggleFavorite\\(${id},`));
        assert.deepEqual(result.dbl, [`playSongFromList(${id},"all-songs",2)`]);
        assert.deepEqual(result.numDbl, []);
        assert.equal(result.menu.length, 1);
        assert.match(result.menu[0], new RegExp(`^showContextMenu\\(.*,${id}\\)$`));
        assert.equal(result.more.length, 1);
        assert.deepEqual(result.enter, [`playSongFromList(${id},"all-songs",2)`]);
        assert.deepEqual(errors, []);
        await page.close();
    });
    test('a cover that fails to load is replaced by the placeholder, once', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(`(async () => {
            const holder = document.createElement('div');
            holder.innerHTML = buildSongItemHTML({ song: { ...SONGS_DATA[0], cover: 'file:///missing-cover.png' }, index: 0, listId: 'all-songs' });
            document.body.appendChild(holder);
            await new Promise((r) => setTimeout(r, 400));
            const img = holder.querySelector('.song-cover');
            const out = { src: img.src === PLACEHOLDER_IMAGE || img.getAttribute('src') === PLACEHOLDER_IMAGE, attr: img.hasAttribute('data-action-error') };
            holder.remove();
            return out;
        })()`);
        assert.deepEqual(result, { src: true, attr: false });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('dialogs: every button calls its function, clicks inside stay inside, the overlay closes the dialog', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(`(() => {
            ${SPY_SETUP}
            const open = {
                createPlaylist: showCreatePlaylistDialog, createFolder: showCreateFolderDialog, createItem: showCreateItemDialog,
                addLink: showAddLinkDialog, editPlaylist: () => showEditPlaylistDialog('p1'), editFolder: () => showEditFolderDialog('f1'),
                played: () => showPlayedDataModal(SONGS_DATA[0].id)
            };
            window.getPlaylists = () => [{ id: 'p1', name: 'Mix', cover: null, songs: [] }];
            window.getFolders = () => [{ id: 'f1', name: 'Fold', parentId: null }];
            window.getPlayHistory = () => [];
            __spy(['closePlaylistModal', 'confirmCreatePlaylist', 'confirmEditPlaylist', 'confirmCreateFolder', 'confirmEditFolder', 'closeCreateItemModal',
                   'showCreatePlaylistDialog', 'showCreateFolderDialog', 'closeAddLinkModal', 'playFromUrl', 'closePlayedDataModal']);
            let docClicks = 0;
            document.addEventListener('click', () => { docClicks++; });
            const out = {};
            for (const [name, fn] of Object.entries(open)) {
                fn();
                const modal = document.querySelector('.playlist-modal');
                const overlay = document.querySelector('.playlist-modal-overlay');
                const r = { buttons: [], inside: null, overlay: null, stillOpen: null };
                for (const b of modal.querySelectorAll('button')) {
                    __calls.length = 0; docClicks = 0; __click(b);
                    r.buttons.push({ label: b.textContent.trim().replace(/\\s+/g, ' '), calls: [...__calls], docClicks });
                }
                __calls.length = 0; docClicks = 0;
                __click(modal.querySelector('.playlist-modal-title'));
                r.inside = { calls: [...__calls], docClicks, stillOpen: document.body.contains(overlay) };
                if (name === 'editPlaylist') {
                    const input = document.getElementById('edit-playlist-cover-input');
                    input.click = () => __calls.push('coverInput.click');
                    __calls.length = 0; docClicks = 0;
                    __click(document.getElementById('edit-playlist-cover-preview'));
                    r.cover = { calls: [...__calls], docClicks };
                    __spy(['handleEditPlaylistCover']);
                    __calls.length = 0; docClicks = 0;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    r.coverChange = [...__calls];
                }
                __calls.length = 0; docClicks = 0;
                __click(overlay);
                r.overlay = { calls: [...__calls], docClicks };
                out[name] = r;
            }
            return out;
        })()`);
        const cancel = (n) => ({ label: 'Cancel', calls: [n], docClicks: 0 });
        const closeP = cancel('closePlaylistModal()');
        const inside = { calls: [], docClicks: 0, stillOpen: true };
        const ev = (calls) => calls.map((c) => c.replace(/\(.*\)/, '()'));
        const overlayP = { calls: ['closePlaylistModal()'], docClicks: 1 };
        assert.deepEqual(result.createPlaylist.buttons, [closeP, { label: 'Create', calls: ['confirmCreatePlaylist()'], docClicks: 0 }]);
        assert.deepEqual(result.editPlaylist.buttons, [closeP, { label: 'Save', calls: ['confirmEditPlaylist("p1")'], docClicks: 0 }]);
        assert.deepEqual(result.createFolder.buttons, [closeP, { label: 'Create', calls: ['confirmCreateFolder()'], docClicks: 0 }]);
        assert.deepEqual(result.editFolder.buttons, [closeP, { label: 'Save', calls: ['confirmEditFolder("f1")'], docClicks: 0 }]);
        assert.deepEqual(result.createItem.buttons, [
            { label: 'Playlist', calls: ['closeCreateItemModal()', 'showCreatePlaylistDialog()'], docClicks: 0 },
            { label: 'Folder', calls: ['closeCreateItemModal()', 'showCreateFolderDialog()'], docClicks: 0 }
        ]);
        assert.deepEqual(result.addLink.buttons, [
            { label: 'Cancel', calls: ['closeAddLinkModal()'], docClicks: 0 },
            { label: 'Stream Only', calls: ['playFromUrl(false)'], docClicks: 0 },
            { label: 'Download & Stream', calls: ['playFromUrl(true)'], docClicks: 0 }
        ]);
        assert.deepEqual(result.played.buttons, [{ label: 'Close', calls: ['closePlayedDataModal()'], docClicks: 0 }]);
        assert.deepEqual(result.editPlaylist.cover, { calls: ['coverInput.click'], docClicks: 0 });
        assert.deepEqual(result.editPlaylist.coverChange, ['handleEditPlaylistCover({})']);
        for (const name of Object.keys(result)) {
            assert.deepEqual(result[name].inside, inside, `${name}: a click inside the dialog must not close it or reach the document`);
        }
        for (const name of ['createPlaylist', 'editPlaylist', 'createFolder', 'editFolder']) assert.deepEqual({ ...result[name].overlay, calls: ev(result[name].overlay.calls) }, overlayP, name);
        assert.deepEqual(ev(result.createItem.overlay.calls), ['closeCreateItemModal()']);
        assert.deepEqual(ev(result.addLink.overlay.calls), ['closeAddLinkModal()']);
        assert.deepEqual(ev(result.played.overlay.calls), ['closePlayedDataModal()']);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('add to queue: the button animates by song id, not by a part of its onclick text', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(`(() => {
            const rows = [...document.querySelectorAll('#song-list .add-to-queue-btn')];
            const ids = rows.map((b) => b.getAttribute('data-song-id'));
            const song = SONGS_DATA.find((s) => s.id === 1);
            setPlaybackQueue([SONGS_DATA[5]]); setCurrentQueueIndex(0);
            addSongToQueueNext(1);
            const adding = [...document.querySelectorAll('.add-to-queue-btn.adding')].map((b) => b.getAttribute('data-song-id'));
            return { count: rows.length, firstIds: ids.slice(0, 3), adding };
        })()`);
        assert.ok(result.count > 0, 'the song list should have add-to-queue buttons');
        assert.deepEqual(result.firstIds.slice(0, 1), ['1']);
        assert.deepEqual(result.adding, ['1']);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('filter tags: each tag toggles its filter once', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(`(() => {
            ${SPY_SETUP}
            __spy(['togglePlaylistsFilter', 'toggleArtistsFilter', 'toggleAlbumsFilter']);
            const out = [];
            for (const id of ['playlists-filter-tag', 'artists-filter-tag', 'albums-filter-tag']) {
                __calls.length = 0; __click(document.getElementById(id)); out.push([...__calls]);
            }
            return out.flat();
        })()`);
        assert.deepEqual(result, ['togglePlaylistsFilter()', 'toggleArtistsFilter()', 'toggleAlbumsFilter()']);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('right-panel rows: click, menu and "..." call the right function', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(`(() => {
            ${SPY_SETUP}
            __spy(['playFromQueue', 'playSongFromList', 'showContextMenu']);
            const song = SONGS_DATA[0];
            const holder = document.createElement('div');
            holder.innerHTML =
                renderRightPanelItem(song, { action: ['playFromQueue', [3]], menuArgs: [song.id, { queueIndex: 3 }] }) +
                renderRightPanelItem(song, { action: ['playFromQueue', [4]], menuArgs: [song.id, { queueIndex: 4 }] }) +
                renderRightPanelItem(song, { action: ['playSongFromList', [song.id, VIEWS.HISTORY]] });
            document.body.appendChild(holder);
            const out = [];
            for (const row of holder.querySelectorAll('.queue-item')) {
                const one = {};
                __calls.length = 0; __click(row); one.click = [...__calls];
                const cm = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
                __calls.length = 0; row.dispatchEvent(cm); one.menu = [...__calls]; one.prevented = cm.defaultPrevented;
                __calls.length = 0; __click(row.querySelector('.more-info')); one.more = [...__calls];
                out.push(one);
            }
            return out;
        })()`);
        const ev = '{"isTrusted":false}';
        assert.deepEqual(result[0], { prevented: true, click: ['playFromQueue(3)'], menu: [`showContextMenu(${ev},1,{"queueIndex":3})`], more: [`showContextMenu(${ev},1,{"queueIndex":3})`] });
        assert.deepEqual(result[1], { prevented: true, click: ['playFromQueue(4)'], menu: [`showContextMenu(${ev},1,{"queueIndex":4})`], more: [`showContextMenu(${ev},1,{"queueIndex":4})`] });
        assert.deepEqual(result[2], { prevented: true, click: ['playSongFromList(1,"history")'], menu: [`showContextMenu(${ev},1)`], more: [`showContextMenu(${ev},1)`] });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('queue panel: rows built by the queue renderer play their index and open the menu with it', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(`(() => {
            ${SPY_SETUP}
            setPlaybackQueue(SONGS_DATA.slice(0, 4)); setCurrentQueueIndex(0);
            updateQueueDisplay();
            __spy(['playFromQueue', 'showContextMenu']);
            const rows = [...document.querySelectorAll('#queue-list .queue-item')];
            const out = { count: rows.length, click: [], menu: [] };
            for (const row of rows.slice(0, 3)) {
                __calls.length = 0; __click(row); out.click.push(...__calls);
                __calls.length = 0; __click(row.querySelector('.more-info')); out.menu.push(...__calls);
            }
            return out;
        })()`);
        assert.ok(result.count >= 3, `expected queue rows, found ${result.count}`);
        assert.deepEqual(result.click, ['playFromQueue(0)', 'playFromQueue(1)', 'playFromQueue(2)']);
        const ev = '{"isTrusted":false}';
        assert.deepEqual(result.menu, [`showContextMenu(${ev},1,{"queueIndex":0})`, `showContextMenu(${ev},2,{"queueIndex":1})`, `showContextMenu(${ev},3,{"queueIndex":2})`]);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

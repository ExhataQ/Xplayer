// Browser tests for the event-bus conversion (00b-events.js and the 04h-04o *-events.js
// subscriber files). Unit tests can't catch "core emits an event but the UI subscriber
// never registered / throws" - that only shows up in the running app, so these call the
// real converted core functions in the real page and assert the DOM actually changed.
//
// A listener that throws does not propagate to emit()'s caller, it surfaces as a page
// error - so every test also asserts no page errors happened.
//
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');
const { SCENARIOS, measure } = require('./helpers/call-sequence-scenarios');

// Call sequences measured on the code as it was BEFORE the event-bus conversion (see
// helpers/call-sequence-scenarios.js). The converted code has to reproduce each one exactly.
// Several UI functions call each other (e.g. renderPlaylistsView() itself calls
// renderLeftPanelMainList()), which is why some sequences repeat calls - that nesting is
// pre-existing and intentionally pinned, not tidied up.
// updateRecentCount() lives in 03e-recents-history.js, an ES module now, and is called from
// saveToRecentlyPlayed() / clearRecentlyPlayed() in that same file. A call inside a module goes
// straight to its own binding, so a spy on window.updateRecentCount cannot see it. It is not spied
// any more; the recorded sequence below is the old one with those entries removed, nothing else.
// Likewise prepareGaplessNextTrack() in 10c-playback-queue.js calls clearGaplessPreload() inside its own
// module, so the gapless scenario lost that one entry and nothing else.
const EXPECTED_CALL_SEQUENCES = {
    "recents: save a song while the portable Recent panel is open": [
        "renderPortableRecentlyPlayed"
    ],
    "history: record a play while the History view is showing": [
        "renderHistoryView"
    ],
    "pinned: pin then unpin an item": [
        "showNotification",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "showNotification",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById"
    ],
    "pinned: move a played item to the top": [
        "renderPlaylistsView",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "renderAlbumLeftPanelItems",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "renderArtistLeftPanelItems",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById"
    ],
    "pinned: pin then unpin inside a folder": [
        "showNotification",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "showNotification",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById"
    ],
    "playlists: create, add a song, remove it, delete": [
        "renderPlaylistsView",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "renderPlaylistsView",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById"
    ],
    "search history: delete an entry while the Search History view is showing": [
        "renderSearchHistoryView",
        "showNotification"
    ],
    "playback settings: turn gapless on then off": [
        "prepareGaplessNextTrack",
        "clearGaplessPreload"
    ],
    "search history: clear all while the Search History view is showing": [
        "renderSearchHistoryView",
        "showNotification"
    ],
    "recents: clear while the Recent view is showing and the portable panel is open": [
        "renderRecentlyPlayed",
        "renderPortableRecentlyPlayed",
        "showNotification",
        "updateExternalScrollbar"
    ],
    "history: clear while the History view is showing": [
        "showHeroSection",
        "updateHeroSection",
        "renderHistoryView",
        "showHeroSection",
        "updateHeroSection",
        "showNotification",
        "updateExternalScrollbar"
    ],
    "playlists: delete through the confirm flow": [
        "renderPlaylistsView",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "renderPlaylistsView",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "showNotification"
    ],
    "library rebuild: the UI refresh after the song list was replaced": [
        "updateQueueDisplay",
        "updateAlbumArt",
        "updateAllCounts",
        "updateLeftPanelCounts",
        "renderPlaylistsView",
        "renderAlbumLeftPanelItems",
        "renderLeftPanelMainList",
        "renderArtistLeftPanelItems",
        "renderLeftPanelMainList",
        "renderLeftPanelMainList",
        "renderSongsList",
        "setupHeroSection"
    ],
    "folders: create then delete an empty folder": [
        "renderFoldersView",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "renderFoldersView",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById"
    ],
    "folders: delete a folder together with its contents": [
        "renderFoldersView",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "renderFoldersView",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById"
    ],
    "folders: delete the folder that is currently open": [
        "switchView",
        "renderFoldersView",
        "renderLeftPanelMainList",
        "renderLeftPanelVisibleItems",
        "renderLeftPanelVisibleItems",
        "updateScrollbarById"
    ]
};

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 30000 };

describe('event bus: core emits, UI subscribers react', { concurrency: false }, () => {
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
        await gotoApp(page, dir);
        // Record every notification the UI shows, so tests can assert on them.
        await page.evaluate(() => {
            window.__notes = [];
            const real = showNotification;
            window.showNotification = (msg, type, ms) => {
                window.__notes.push({ msg, type });
                return real(msg, type, ms);
            };
        });
        return { page, errors };
    }

    test('the bus itself is loaded and the subscriber files registered their listeners', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(() => {
            // Emit each event the converted core code uses; a missing subscriber is silent,
            // so instead check the observable effect of the ones that notify.
            emit('recents:cleared');
            emit('history:cleared');
            emit('playlist:deleted', { playlistName: 'X' });
            emit('pinned:changed', { itemId: 'playlist-zzz', itemName: 'Y', pinned: true });
            emit('folderPin:changed', { folderId: 'nope', itemId: 'playlist-zzz', itemName: 'Z', pinned: false });
            emit('searchHistory:cleared');
            emit('searchHistory:entryDeleted', { sessionId: 's' });
            emit('data:imported');
            return window.__notes;
        });
        assert.deepEqual(r, [
            { msg: 'Recently played list cleared', type: 'success' },
            { msg: 'Play history cleared', type: 'success' },
            { msg: 'Playlist "X" deleted', type: 'error' },
            { msg: '"Y" pinned', type: 'success' },
            { msg: '"Z" unpinned', type: 'info' },
            { msg: 'Search history cleared', type: 'success' },
            { msg: 'Search removed from history', type: 'error' },
            { msg: 'Data imported successfully', type: 'success' }
        ]);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('playlists: create -> appears in the left panel, add/remove song updates its count, delete removes it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(() => {
            const row = (id) => document.querySelector(`.left-panel-main-item[data-view="playlist-${id}"]`);
            const count = (id) => row(id)?.querySelector('.main-item-count')?.textContent;
            const out = {};

            const pl = createPlaylist('Wiring Test');
            out.returned = pl && typeof pl.id !== 'undefined' && pl.name === 'Wiring Test';
            out.appearsAfterCreate = !!row(pl.id);

            out.addFirst = addSongToPlaylist(1, pl.id);
            out.countAfterAdd = count(pl.id);
            out.addDuplicate = addSongToPlaylist(1, pl.id);
            out.addSecond = addSongToPlaylist(2, pl.id);
            out.countAfterTwo = count(pl.id);
            out.removeReal = removeSongFromPlaylist(1, pl.id);
            out.removeMissing = removeSongFromPlaylist(99, pl.id);
            out.countAfterRemove = count(pl.id);

            deletePlaylist(pl.id);
            out.goneAfterDelete = !row(pl.id);
            out.stillInStorage = getPlaylists().some((p) => p.id === pl.id);
            return out;
        });
        assert.equal(r.returned, true, 'createPlaylist must still return the new playlist');
        assert.equal(r.appearsAfterCreate, true, "'playlist:listChanged' subscriber should re-render the left panel");
        assert.equal(r.addFirst, true);
        assert.equal(r.countAfterAdd, '1 song');
        assert.equal(r.addDuplicate, false, 'adding the same song twice must still return false');
        assert.equal(r.addSecond, true);
        assert.equal(r.countAfterTwo, '2 songs');
        assert.equal(r.removeReal, true);
        assert.equal(r.removeMissing, false);
        assert.equal(r.countAfterRemove, '1 song');
        assert.equal(r.goneAfterDelete, true);
        assert.equal(r.stillInStorage, false);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('pinning: togglePinItem pins/unpins in storage and shows the matching notification', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(() => {
            const pl = createPlaylist('Pin Me');
            window.__notes.length = 0;
            const id = `playlist-${pl.id}`;
            togglePinItem(id, 'Pin Me');
            const pinned = isItemPinned(id);
            togglePinItem(id, 'Pin Me');
            return { pinned, unpinned: !isItemPinned(id), notes: window.__notes };
        });
        assert.equal(r.pinned, true);
        assert.equal(r.unpinned, true);
        assert.deepEqual(r.notes, [
            { msg: '"Pin Me" pinned', type: 'success' },
            { msg: '"Pin Me" unpinned', type: 'info' }
        ]);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('recents: saving a played song emits events carrying the right data, and nothing throws', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(() => {
            // NOTE: the '.left-panel-item[onclick*="recent"] .song-count' element that
            // updateRecentCount() has always tried to update does not exist anywhere in the
            // current markup (no element has a bare "song-count" class), so that update was
            // a silent no-op before the event-bus conversion too and still is. Preserved
            // as-is, not fixed here. So instead of asserting on that element, observe the
            // events themselves.
            const counts = [];
            const added = [];
            on('recents:count-changed', (e) => counts.push(e.detail.count));
            on('recents:added', (e) => added.push(e.detail.song.id));
            saveToRecentlyPlayed(SONGS_DATA[0]);
            saveToRecentlyPlayed(SONGS_DATA[1]);
            return { counts, added, stored: getRecentCount(), ids: [SONGS_DATA[0].id, SONGS_DATA[1].id] };
        });
        assert.deepEqual(r.counts, [1, 2], "updateRecentCount() should emit the running count after each save");
        assert.deepEqual(r.added, r.ids);
        assert.equal(r.stored, 2);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('library rebuild: resetLibraryAfterRebuild swaps the song list and resets the now-playing UI', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(() => {
            document.getElementById('player-title').textContent = 'Something playing';
            resetLibraryAfterRebuild(SONGS_DATA.slice(0, 5));
            return {
                songs: SONGS_DATA.length,
                queueEmpty: playbackQueue.length === 0 && currentQueueIndex === -1,
                title: document.getElementById('player-title').textContent,
                artist: document.getElementById('player-artist').textContent
            };
        });
        assert.equal(r.songs, 5);
        assert.equal(r.queueEmpty, true);
        assert.equal(r.title, 'No song selected', "'library:rebuilt' subscriber should reset the player display");
        assert.equal(r.artist, '\u2014');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('search history: deleting an entry removes it from storage and notifies', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(() => {
            saveSearchToHistory('alpha', 'sess-a', 3);
            saveSearchToHistory('beta', 'sess-b', 5);
            window.__notes.length = 0;
            deleteSearchHistoryEntry('sess-a');
            return { left: getSearchHistory().map((e) => e.query), notes: window.__notes };
        });
        assert.deepEqual(r.left, ['beta']);
        assert.deepEqual(r.notes, [{ msg: 'Search removed from history', type: 'error' }]);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('playback settings: turning on gapless unchecks the crossfade checkbox (mutual exclusion is reflected in the UI)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(() => {
            const make = (key, checked) => {
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.setAttribute('data-playback-setting', key);
                input.checked = checked;
                document.body.appendChild(input);
                return input;
            };
            const crossfade = make('crossfadeEnabled', true);
            const gapless = make('gaplessEnabled', false);
            const returned = setAudioPlaybackSetting('gaplessEnabled', true);
            return {
                crossfadeChecked: crossfade.checked,
                gaplessChecked: gapless.checked,
                returnedCrossfade: returned.crossfadeEnabled,
                returnedGapless: returned.gaplessEnabled
            };
        });
        assert.equal(r.gaplessChecked, true);
        assert.equal(r.crossfadeChecked, false, "'playbackSetting:changed' subscriber should sync the other checkbox");
        assert.equal(r.returnedGapless, true);
        assert.equal(r.returnedCrossfade, false);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('import (merge): unions data without duplicating, skips existing ids, refreshes the UI and notifies', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(() => {
            const existing = createPlaylist('Existing');
            saveFavorite(1);
            window.__notes.length = 0;
            doImportMerge({
                playlists: [
                    { id: existing.id, name: 'SAME ID, SHOULD BE IGNORED', songs: [] },
                    { id: 'p-imported', name: 'Imported PL', songs: [] }
                ],
                favorites: [1, 2, 3],
                pinnedItems: ['playlist-p-imported']
            });
            return {
                names: getPlaylists().map((p) => p.name).sort(),
                favorites: getFavorites().slice().sort(),
                pinned: getPinnedItems(),
                importedRowShown: !!document.querySelector('.left-panel-main-item[data-view="playlist-p-imported"]'),
                notes: window.__notes.filter((n) => n.msg === 'Data imported successfully')
            };
        });
        assert.deepEqual(r.names, ['Existing', 'Imported PL'], 'merge keeps the existing playlist untouched and adds only the new id');
        assert.deepEqual(r.favorites, [1, 2, 3], 'favorites are a set union, no duplicates');
        assert.deepEqual(r.pinned, ['playlist-p-imported']);
        assert.equal(r.importedRowShown, true, "'data:imported' subscriber should re-render the left panel");
        assert.equal(r.notes.length, 1);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('import (replace): overwrites what the file contains and leaves what it omits', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(() => {
            createPlaylist('Will Be Replaced');
            saveFavorite(7);
            saveToPlayHistory(SONGS_DATA[0], 5000);
            doImportReplace({ playlists: [{ id: 'only', name: 'Only One', songs: [] }], favorites: [] });
            return {
                names: getPlaylists().map((p) => p.name),
                favorites: getFavorites(),
                historyUntouched: getPlayHistory().length === 1
            };
        });
        assert.deepEqual(r.names, ['Only One']);
        assert.deepEqual(r.favorites, [], 'an empty array in the file still replaces (it is truthy)');
        assert.equal(r.historyUntouched, true, 'keys missing from the file are left alone');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('export: buildExportData has the expected shape and reflects current data', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const r = await page.evaluate(() => {
            createPlaylist('Exported');
            saveFavorite(4);
            const d = buildExportData();
            return { keys: Object.keys(d).sort(), playlistNames: d.playlists.map((p) => p.name), favorites: d.favorites, dateOk: !Number.isNaN(Date.parse(d.exportDate)) };
        });
        assert.deepEqual(r.keys, ['exportDate', 'favorites', 'folders', 'pinnedItems', 'playHistory', 'playlists', 'recentlyPlayed', 'searchHistory']);
        assert.deepEqual(r.playlistNames, ['Exported']);
        assert.deepEqual(r.favorites, [4]);
        assert.equal(r.dateOk, true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('import: the UI refresh makes exactly the same calls, in the same order, as before the event-bus conversion', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const calls = await page.evaluate(() => {
            const seen = [];
            for (const name of ['renderPlaylistsView', 'renderFoldersView', 'renderLeftPanelMainList', 'updateRecentCount', 'showNotification']) {
                const real = window[name];
                window[name] = (...args) => {
                    seen.push(name);
                    return real(...args);
                };
            }
            doImportMerge({ playlists: [{ id: 'p-x', name: 'X', songs: [] }] });
            return seen;
        });
        // Measured on the code as it was BEFORE finishImport() was turned into the
        // 'data:imported' event (this same test passes against that version). Note that
        // renderPlaylistsView() itself calls renderLeftPanelMainList() and updateRecentCount()
        // (the first pair below), and the subscriber then calls them again explicitly (the
        // second pair). That redundancy is pre-existing and preserved; asserting the exact
        // sequence is what stops a dropped or reordered call from slipping through unnoticed.
        assert.deepEqual(calls, [
            'renderPlaylistsView',
            'renderLeftPanelMainList',
            'updateRecentCount',
            'renderFoldersView',
            'renderLeftPanelMainList',
            'updateRecentCount',
            'showNotification'
        ]);
        assert.deepEqual(errors, []);
        await page.close();
    });

    // One page load per scenario (~1.5s each), so this test needs far more than the 30s default
    // as scenarios are added.
    test('every converted UI reaction makes the same calls, in the same order, as the code it replaced', { timeout: 120000 }, async (t) => {
        if (!guard(t)) return;
        assert.deepEqual(Object.keys(SCENARIOS), Object.keys(EXPECTED_CALL_SEQUENCES), 'scenario list and expected list must match');
        for (const [name, scenario] of Object.entries(SCENARIOS)) {
            const { page, errors } = await openApp();
            const calls = await measure(page, scenario);
            assert.deepEqual(calls, EXPECTED_CALL_SEQUENCES[name], name);
            assert.deepEqual(errors, [], `${name}: page errors`);
            await page.close();
        }
    });
});

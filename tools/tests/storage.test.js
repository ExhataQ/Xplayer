const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

// 03-storage.js is an ES module: imported directly. The topic files it used to hold
// (03e-03i: favorites, recents, folders, search history...) are still classic scripts, so the
// getter tests below load them into a small vm and hand it the module's names, the same
// thing registerLegacyGlobals does in the app.
const storageModule = import(pathToFileURL(path.join(__dirname, '../../src/js/03-storage.js')).href);

async function loadStorageWith(values) {
    const mod = await storageModule;
    // 03-storage.js's remaining getters were split out into topic files
    // (03e recents/history, 03f favorites/settings, 03g pinned items, 03h folders,
    // 03i search history). None of these have top-level DOM/window references (verified
    // before adding them here), so they're safe to vm-load alongside 03-storage.js the
    // same way 00-state.js's STORAGE_KEYS constant already was below. getPlaylists()
    // stays unloaded/skipped below -- it lives in 03c-playlists.js, which does have
    // other top-level concerns, left alone per the existing explicit instruction.
    const splitSources = ['03e-recents-history.js', '03f-favorites-settings.js',
        '03g-pinned-items.js', '03h-folders.js', '03i-search-history.js']
        .map((name) => fs.readFileSync(path.join(__dirname, '../../src/js/' + name), 'utf8'));
    // 03-storage.js references STORAGE_KEYS, defined in 00-state.js (the single
    // source of truth for localStorage keys). Pull just that constant out rather than vm-loading the whole
    // of 00-state.js, which has top-level document.getElementById(...) calls this plain vm
    // context doesn't provide - same "load exactly what's needed, nothing more" approach
    // already used for getPlaylists() below.
    const stateSource = fs.readFileSync(path.join(__dirname, '../../src/js/00-state.js'), 'utf8');
    const storageKeysMatch = stateSource.match(/const STORAGE_KEYS = \{[\s\S]*?\n\};/);
    if (!storageKeysMatch) {
        throw new Error('storage.test.js: could not find STORAGE_KEYS in 00-state.js - did it move or get renamed?');
    }
    const storage = {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
        },
        setItem() {},
        removeItem() {}
    };
    const context = {
        localStorage: storage, console, Date, JSON, setTimeout, clearTimeout,
        MAX_RECENT_SONGS: mod.MAX_RECENT_SONGS,
        MAX_HISTORY_ENTRIES: mod.MAX_HISTORY_ENTRIES,
        MAX_SEARCH_HISTORY: mod.MAX_SEARCH_HISTORY,
        getStoredJson: (key, fallback) => mod.getStoredJson(key, fallback, storage)
    };
    vm.createContext(context);
    vm.runInContext(storageKeysMatch[0], context);
    for (const s of splitSources) {
        vm.runInContext(s, context);
    }
    return context;
}

// Skipped: getPlaylists() moved to src/js/03c-playlists.js when the files were split.
// loadStorageWith() only vm-loads 03-storage.js plus the topic
// files it was split into, so context.getPlaylists is undefined
// here even though it works fine in the real app (loaded via build/music_player.html,
// see scroll.test.js). Left skipped per explicit instruction rather than widening
// loadStorageWith's file list further.
test('storage getters fall back to empty arrays when JSON is malformed', { skip: 'getPlaylists moved to 03c-playlists.js; loadStorageWith only loads 03e-03i' }, async () => {
    const context = await loadStorageWith({
        favorites: '{broken', playHistory: '{broken', playlists: '{broken', folders: '{broken',
        searchHistory: '{broken', recentlyPlayed: '{broken', pinnedItems: '{broken',
        playedItemOrder: '{broken', expandedFolders: '{broken'
    });
    assert.deepStrictEqual(Array.from(context.getFavorites()), []);
    assert.deepStrictEqual(Array.from(context.getPlayHistory()), []);
    assert.deepStrictEqual(Array.from(context.getPlaylists()), []);
    assert.deepStrictEqual(Array.from(context.getFolders()), []);
    assert.deepStrictEqual(Array.from(context.getSearchHistory()), []);
    assert.deepStrictEqual(Array.from(context.getRecentlyPlayed()), []);
    assert.deepStrictEqual(Array.from(context.getPinnedItems()), []);
    assert.deepStrictEqual(Array.from(context.getPlayedItemOrder()), []);
    assert.deepStrictEqual(Array.from(context.getExpandedFolderKeys()), []);
});

test('storage getters still return valid stored arrays', async () => {
    const context = await loadStorageWith({ favorites: '[1,2]', folders: '[{"id":"f1"}]' });
    assert.deepStrictEqual(context.getFavorites(), [1, 2]);
    assert.deepStrictEqual(context.getFolders(), [{ id: 'f1' }]);
});

test('getStoredJson returns the parsed value, or the fallback when missing, malformed or unreadable', async () => {
    const { getStoredJson } = await storageModule;
    const store = (values) => ({ getItem: (k) => (k in values ? values[k] : null) });
    assert.deepStrictEqual(getStoredJson('a', [], store({ a: '[1,2]' })), [1, 2]);
    assert.deepStrictEqual(getStoredJson('a', ['x'], store({})), ['x'], 'missing key');
    assert.deepStrictEqual(getStoredJson('a', ['x'], store({ a: '{broken' })), ['x'], 'malformed JSON');
    assert.deepStrictEqual(getStoredJson('a', ['x'], { getItem() { throw new Error('SecurityError'); } }), ['x'], 'storage throws');
    assert.deepStrictEqual(getStoredJson('a', ['x'], undefined), ['x'], 'no storage available in this realm');
});

test('the history and recents limits keep their values', async () => {
    const m = await storageModule;
    assert.equal(m.MAX_RECENT_SONGS, 50);
    assert.equal(m.MAX_HISTORY_ENTRIES, 500);
    assert.equal(m.MAX_SEARCH_HISTORY, 20);
});

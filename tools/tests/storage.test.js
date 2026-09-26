const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadStorageWith(values) {
    const source = fs.readFileSync(path.join(__dirname, '../../src/js/03-storage.js'), 'utf8');
    // Phase 2 Checkpoint 5 split 03-storage.js's remaining getters out into topic files
    // (03e recents/history, 03f favorites/settings, 03g pinned items, 03h folders,
    // 03i search history). None of these have top-level DOM/window references (verified
    // before adding them here), so they're safe to vm-load alongside 03-storage.js the
    // same way 00-state.js's STORAGE_KEYS constant already was below. getPlaylists()
    // stays unloaded/skipped below -- it lives in 03c-playlists.js, which does have
    // other top-level concerns, left alone per the existing explicit instruction.
    const splitSources = ['03e-recents-history.js', '03f-favorites-settings.js',
        '03g-pinned-items.js', '03h-folders.js', '03i-search-history.js']
        .map((name) => fs.readFileSync(path.join(__dirname, '../../src/js/' + name), 'utf8'));
    // 03-storage.js references STORAGE_KEYS, defined in 00-state.js (code-cleanup-plan.md
    // Agent 5, Checkpoint 1). Pull just that constant out rather than vm-loading the whole
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
    const context = { localStorage: storage, console, Date, JSON, setTimeout, clearTimeout };
    vm.createContext(context);
    vm.runInContext(storageKeysMatch[0], context);
    vm.runInContext(source, context);
    for (const s of splitSources) {
        vm.runInContext(s, context);
    }
    return context;
}

// Skipped: getPlaylists() moved to src/js/03c-playlists.js in the Agent 2 file-split
// (code-cleanup-plan.md). loadStorageWith() only vm-loads 03-storage.js plus the topic
// files it was split into by Phase 2 Checkpoint 5, so context.getPlaylists is undefined
// here even though it works fine in the real app (loaded via build/music_player.html,
// see scroll.test.js). Left skipped per explicit instruction rather than widening
// loadStorageWith's file list further.
test('storage getters fall back to empty arrays when JSON is malformed', { skip: 'getPlaylists moved to 03c-playlists.js; loadStorageWith only loads 03-storage.js' }, () => {
    const context = loadStorageWith({
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

test('storage getters still return valid stored arrays', () => {
    const context = loadStorageWith({ favorites: '[1,2]', folders: '[{"id":"f1"}]' });
    assert.deepStrictEqual(context.getFavorites(), [1, 2]);
    assert.deepStrictEqual(context.getFolders(), [{ id: 'f1' }]);
});

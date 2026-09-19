const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadStorageWith(values) {
    const source = fs.readFileSync(path.join(__dirname, '../../src/js/03-storage.js'), 'utf8');
    const storage = {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
        },
        setItem() {},
        removeItem() {}
    };
    const context = { localStorage: storage, console, Date, JSON, setTimeout, clearTimeout };
    vm.createContext(context);
    vm.runInContext(source, context);
    return context;
}

test('storage getters fall back to empty arrays when JSON is malformed', () => {
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

// Tests for the recently-played logic (src/js/03a-recents.js) and how 03e-recents-history.js
// saves it. Runs in Node, no browser needed.
//
// 03a-recents.js and 03-storage.js are ES modules, imported directly. Only the last two tests
// need 03e-recents-history.js, which is still a classic script, so it is loaded into a small
// vm context; bridge() hands that context the same names registerLegacyGlobals gives the app.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const JS = path.join(__dirname, '../../src/js');
// These files are ES modules in the app (export + registerLegacyGlobals); a vm context runs them
// as plain scripts, so the export keywords are dropped. Their functions behave the same.
const { stripExports } = require('../lib/strip-exports');
const legacySource = (file) => stripExports(fs.readFileSync(file, 'utf8'));
const recentsModule = import(pathToFileURL(path.join(JS, '03a-recents.js')).href);
const storageModule = import(pathToFileURL(path.join(JS, '03-storage.js')).href);
const schemaModule = import(pathToFileURL(path.join(JS, 'core/storage-schema.js')).href);

// 03e-recents-history.js (classic) in a context with a fake localStorage.
async function loadRecentsHistory({ stored = {}, failWrites = false, library = [], deleted = [] } = {}) {
    const recents = await recentsModule;
    const storage = await storageModule;
    const schema = await schemaModule;
    const fakeStorage = {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null),
        setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); stored[k] = v; },
        removeItem: (k) => { delete stored[k]; }
    };
    const context = {
        localStorage: fakeStorage,
        console: { ...console, warn() {} },
        Date, JSON, setTimeout, clearTimeout, EventTarget, CustomEvent,
        // what registerLegacyGlobals provides in the app
        addToRecentList: recents.addToRecentList,
        // in the app the defaults of getRecentCount read these globals; here they are passed in
        getRecentCount: () => recents.getRecentCount(context.getRecentlyPlayed(), library, (id) => deleted.includes(id)),
        ...schema, // the normalizers, as registerLegacyGlobals provides them
        MAX_RECENT_SONGS: storage.MAX_RECENT_SONGS,
        MAX_HISTORY_ENTRIES: storage.MAX_HISTORY_ENTRIES
    };
    vm.createContext(context);
    // STORAGE_KEYS lives in 00-state.js, which needs a DOM; take just that constant.
    const stateSource = fs.readFileSync(path.join(JS, '00-state.js'), 'utf8');
    const keys = stateSource.match(/const STORAGE_KEYS = \{[\s\S]*?\n\};/);
    if (!keys) throw new Error('recents.test.js: could not find STORAGE_KEYS in 00-state.js - did it move or get renamed?');
    vm.runInContext(keys[0], context);
    for (const file of ['core/storage.js', '00b-events.js', 'core/state-ghost-list.js', '03e-recents-history.js']) {
        vm.runInContext(legacySource(path.join(JS, file)), context);
    }
    context.__stored = stored;
    return context;
}
const ids = (list) => Array.from(list, (e) => e.id);
const song = (id, extra = {}) => ({ id, url: `file:///m/${id}.mp3`, title: `Song ${id}`, artist: 'A', album: 'B', duration: 100, cover: `covers/${id}.jpg`, ...extra });

test('playing a song moves it to the top instead of adding a copy', async () => {
    const { addToRecentList } = await recentsModule;
    let list = [];
    for (const id of [1, 2, 3]) list = addToRecentList(list, song(id), id * 1000, 50);
    list = addToRecentList(list, song(1), 9000, 50);
    assert.deepEqual(ids(list), [1, 3, 2]);
    assert.equal(list[0].playedAt, 9000);
});

test('replaying one song 60 times no longer pushes every other song out', async () => {
    const { addToRecentList } = await recentsModule;
    let list = [];
    for (let id = 1; id <= 10; id++) list = addToRecentList(list, song(id), id, 50);
    for (let i = 0; i < 60; i++) list = addToRecentList(list, song(3), 100 + i, 50);
    assert.equal(list.length, 10);
    assert.equal(list[0].id, 3);
});

test('the list is capped, dropping the oldest', async () => {
    const { addToRecentList } = await recentsModule;
    let list = [];
    for (let id = 1; id <= 55; id++) list = addToRecentList(list, song(id), id, 50);
    assert.equal(list.length, 50);
    assert.equal(list[0].id, 55);
    assert.equal(list[49].id, 6);
});

test('entries do not store the cover, and a {song: ...} wrapper is accepted', async () => {
    const { addToRecentList } = await recentsModule;
    const list = addToRecentList([], { song: song(7) }, 1, 50);
    assert.equal(list[0].id, 7);
    assert.equal('cover' in list[0], false);
});

test('an older stored list (duplicates, covers) is cleaned up the next time a song is added', async () => {
    const { addToRecentList } = await recentsModule;
    const legacy = [song(1, { playedAt: 5 }), song(2, { playedAt: 4 }), song(1, { playedAt: 3 })];
    const list = addToRecentList(legacy, song(9), 10, 50);
    assert.deepEqual(ids(list), [9, 1, 2]);
    assert.equal(list.some((e) => 'cover' in e), false);
});

test('a song without id or url is ignored instead of corrupting the list', async () => {
    const { addToRecentList } = await recentsModule;
    assert.deepEqual(ids(addToRecentList([{ id: 1, playedAt: 1 }], {}, 2, 50)), [1]);
});

test('the views show the CURRENT library data, so a metadata edit is reflected', async () => {
    const library = [song(1, { title: 'Edited title' }), song(2)];
    const { resolveRecentSongs } = await recentsModule;
    const stored = [{ id: 2, title: 'Song 2', playedAt: 20 }, { id: 1, title: 'Old title', playedAt: 10 }];
    const out = resolveRecentSongs(stored, library, () => false);
    assert.deepEqual(Array.from(out, (s) => s.title), ['Song 2', 'Edited title']);
    assert.deepEqual(Array.from(out, (s) => s.playedAt), [20, 10]);
    assert.equal(library[0].playedAt, undefined, 'the library objects must not be modified');
});

test('deleted and vanished songs are left out; a rescan that changed ids is matched by url', async () => {
    const library = [song(101, { url: 'file:///m/1.mp3' }), song(2), song(3)];
    const { resolveRecentSongs } = await recentsModule;
    const stored = [{ id: 1, url: 'file:///m/1.mp3' }, { id: 2 }, { id: 3 }, { id: 99, url: 'file:///gone.mp3' }];
    const out = resolveRecentSongs(stored, library, (id) => id === 3);
    assert.deepEqual(Array.from(out, (s) => s.id), [101, 2]);
});

test('saveToRecentlyPlayed stores one entry per song and getRecentCount matches what is shown', async () => {
    const library = [song(1), song(2), song(3)];
    const deleted = new Set([3]);
    const { getRecentCount, getRecentlyPlayedSongs } = await recentsModule;
    const ctx = await loadRecentsHistory({ library, deleted: [3] });
    ctx.saveToRecentlyPlayed(library[0]);
    ctx.saveToRecentlyPlayed(library[1]);
    ctx.saveToRecentlyPlayed(library[0]);
    ctx.saveToRecentlyPlayed(library[2]);
    assert.deepEqual(ids(JSON.parse(ctx.__stored.recentlyPlayed)), [3, 1, 2]);
    const stored = ctx.getRecentlyPlayed();
    assert.equal(getRecentCount(stored, library, (id) => deleted.has(id)), 2, 'the deleted song must not be counted');
    assert.deepEqual(Array.from(getRecentlyPlayedSongs(stored, library, (id) => deleted.has(id)), (s) => s.id), [1, 2]);
});

test('a storage failure (for example the quota) does not break playback', async () => {
    const library = [song(1)];
    const ctx = await loadRecentsHistory({ failWrites: true, library });
    assert.doesNotThrow(() => ctx.saveToRecentlyPlayed(library[0]));
});

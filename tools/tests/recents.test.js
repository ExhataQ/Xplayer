// Tests for the recently-played logic (src/js/03a-recents.js) and how 03-storage.js saves it.
// Runs in Node, no browser needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load({ stored = {}, library = [], deleted = [], failWrites = false } = {}) {
    const writes = {};
    const storage = {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null),
        setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); stored[k] = v; writes[k] = v; },
        removeItem: (k) => { delete stored[k]; }
    };
    const document = { getElementById: () => null, querySelector: () => null };
    const context = { localStorage: storage, document, console: { ...console, warn() {} }, Date, JSON, setTimeout, clearTimeout, SONGS_DATA: library, deletedSongIds: new Set(deleted) };
    vm.createContext(context);
    for (const file of ['03-storage.js', '03a-recents.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../../src/js', file), 'utf8'), context);
    }
    context.__stored = stored;
    return context;
}
const ids = (list) => Array.from(list, (e) => e.id);
const song = (id, extra = {}) => ({ id, url: `file:///m/${id}.mp3`, title: `Song ${id}`, artist: 'A', album: 'B', duration: 100, cover: `covers/${id}.jpg`, ...extra });

test('playing a song moves it to the top instead of adding a copy', () => {
    const { addToRecentList } = load();
    let list = [];
    for (const id of [1, 2, 3]) list = addToRecentList(list, song(id), id * 1000, 50);
    list = addToRecentList(list, song(1), 9000, 50);
    assert.deepEqual(ids(list), [1, 3, 2]);
    assert.equal(list[0].playedAt, 9000);
});

test('replaying one song 60 times no longer pushes every other song out', () => {
    const { addToRecentList } = load();
    let list = [];
    for (let id = 1; id <= 10; id++) list = addToRecentList(list, song(id), id, 50);
    for (let i = 0; i < 60; i++) list = addToRecentList(list, song(3), 100 + i, 50);
    assert.equal(list.length, 10);
    assert.equal(list[0].id, 3);
});

test('the list is capped, dropping the oldest', () => {
    const { addToRecentList } = load();
    let list = [];
    for (let id = 1; id <= 55; id++) list = addToRecentList(list, song(id), id, 50);
    assert.equal(list.length, 50);
    assert.equal(list[0].id, 55);
    assert.equal(list[49].id, 6);
});

test('entries do not store the cover, and a {song: ...} wrapper is accepted', () => {
    const { addToRecentList } = load();
    const list = addToRecentList([], { song: song(7) }, 1, 50);
    assert.equal(list[0].id, 7);
    assert.equal('cover' in list[0], false);
});

test('an older stored list (duplicates, covers) is cleaned up the next time a song is added', () => {
    const { addToRecentList } = load();
    const legacy = [song(1, { playedAt: 5 }), song(2, { playedAt: 4 }), song(1, { playedAt: 3 })];
    const list = addToRecentList(legacy, song(9), 10, 50);
    assert.deepEqual(ids(list), [9, 1, 2]);
    assert.equal(list.some((e) => 'cover' in e), false);
});

test('a song without id or url is ignored instead of corrupting the list', () => {
    const { addToRecentList } = load();
    assert.deepEqual(ids(addToRecentList([{ id: 1, playedAt: 1 }], {}, 2, 50)), [1]);
});

test('the views show the CURRENT library data, so a metadata edit is reflected', () => {
    const library = [song(1, { title: 'Edited title' }), song(2)];
    const { resolveRecentSongs } = load();
    const stored = [{ id: 2, title: 'Song 2', playedAt: 20 }, { id: 1, title: 'Old title', playedAt: 10 }];
    const out = resolveRecentSongs(stored, library, () => false);
    assert.deepEqual(Array.from(out, (s) => s.title), ['Song 2', 'Edited title']);
    assert.deepEqual(Array.from(out, (s) => s.playedAt), [20, 10]);
    assert.equal(library[0].playedAt, undefined, 'the library objects must not be modified');
});

test('deleted and vanished songs are left out; a rescan that changed ids is matched by url', () => {
    const library = [song(101, { url: 'file:///m/1.mp3' }), song(2), song(3)];
    const { resolveRecentSongs } = load();
    const stored = [{ id: 1, url: 'file:///m/1.mp3' }, { id: 2 }, { id: 3 }, { id: 99, url: 'file:///gone.mp3' }];
    const out = resolveRecentSongs(stored, library, (id) => id === 3);
    assert.deepEqual(Array.from(out, (s) => s.id), [101, 2]);
});

test('saveToRecentlyPlayed stores one entry per song and getRecentCount matches what is shown', () => {
    const library = [song(1), song(2), song(3)];
    const ctx = load({ library, deleted: [3] });
    ctx.saveToRecentlyPlayed(library[0]);
    ctx.saveToRecentlyPlayed(library[1]);
    ctx.saveToRecentlyPlayed(library[0]);
    ctx.saveToRecentlyPlayed(library[2]);
    assert.deepEqual(ids(JSON.parse(ctx.__stored.recentlyPlayed)), [3, 1, 2]);
    assert.equal(ctx.getRecentCount(), 2, 'the deleted song must not be counted');
    assert.deepEqual(Array.from(ctx.getRecentlyPlayedSongs(), (s) => s.id), [1, 2]);
});

test('a storage failure (for example the quota) does not break playback', () => {
    const library = [song(1)];
    const ctx = load({ library, failWrites: true });
    assert.doesNotThrow(() => ctx.saveToRecentlyPlayed(library[0]));
});

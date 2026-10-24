// Tests for src/ui-next/adapter/panel-lists-bridge.js (task PB-02): what the Search and Recents panels read. Pure Node, fake engine.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE = pathToFileURL(path.resolve(__dirname, '..', '..', 'src', 'ui-next', 'adapter', 'panel-lists-bridge.js')).href;
const DAY = 86400000;

function world() {
    const songs = [1, 2, 3, 4, 5].map((id) => ({ id, title: `Song ${id}`, artist: `Artist ${id}`, cover: '' }));
    const w = {
        songs,
        playlists: [
            { id: 'a', name: 'Road trip', songs: [1, 2, 3] },
            { id: 'b', name: 'Calm', songs: [4] },
            { id: 'c', name: 'Never played', songs: [5] }
        ],
        history: [],
        getActiveSongs: () => songs,
        getPlaylists: () => w.playlists,
        getArtists: () => w.artists || [],
        getAlbums: () => w.albums || [],
        getSongById: (id) => songs.find((s) => s.id === id),
        getPlayHistory: () => w.history,
        normalizeSearchText: (v) => String(v).toLowerCase().trim().replace(/\s+/g, ' '),
        searchSongs: (list, q) => list.filter((s) => s.title.toLowerCase().includes(String(q).toLowerCase()))
    };
    return w;
}
const load = (w) => {
    globalThis.window = w;
    return import(`${MODULE}?t=${Math.random()}`);
};

test('searchLibrary: empty query gives nothing; songs, artists, albums and playlists that match are split by kind', async () => {
    const w = world();
    w.artists = [{ id: 'r1', name: 'Road Singers', songCount: 2, cover: 'c.jpg' }];
    w.albums = [{ id: 'a1', name: 'Open Road', songCount: 1 }];
    const { searchLibrary } = await load(w);
    assert.deepEqual(searchLibrary('  '), { songs: [], artists: [], albums: [], playlists: [] });
    const r = searchLibrary('road');
    assert.deepEqual([r.songs.length, r.playlists.map((p) => p.title), r.playlists[0].viewId, r.playlists[0].subtitle], [0, ['Road trip'], 'playlist-a', '3 songs']);
    assert.deepEqual([r.artists.map((a) => [a.kind, a.id, a.subtitle, a.cover]), r.albums.map((a) => [a.id, a.subtitle])], [[['artist', 'r1', '2 songs', 'c.jpg']], [['a1', '1 song']]]);
    assert.deepEqual(searchLibrary('song 2').songs.map((s) => [s.kind, s.id, s.subtitle]), [['song', 2, 'Artist 2']]);
    w.songs.push(...Array.from({ length: 60 }, (_, i) => ({ id: 100 + i, title: `Many ${i}` })));
    assert.equal(searchLibrary('many').songs.length, 60, 'every match is returned; the panel pages through them');
});

test('recentPlaylists: only playlists with a played song, newest first, one row per song with its latest play', async () => {
    const w = world();
    const now = Date.now();
    w.history = [
        { id: 4, title: 'Song 4', artist: 'Artist 4', playedAt: now - 1000 },
        { id: 2, title: 'Song 2', artist: 'Artist 2', playedAt: now - 2 * DAY },
        { id: 1, title: 'Song 1', artist: 'Artist 1', playedAt: now - 3 * DAY },
        { id: 2, title: 'Song 2', artist: 'Artist 2', playedAt: now - 9 * DAY }
    ];
    const { recentPlaylists } = await load(w);
    const out = recentPlaylists();
    assert.deepEqual(out.map((p) => p.id), ['b', 'a']);
    assert.deepEqual(out[1].plays.map((p) => [p.id, p.playedAt === now - 2 * DAY || p.playedAt === now - 3 * DAY]), [[2, true], [1, true]]);
    assert.equal(out[1].songCount, 3);
});

test('recentSongs: one row per song, newest first, limited', async () => {
    const w = world();
    w.history = [2, 1, 2, 3].map((id, i) => ({ id, title: `Song ${id}`, artist: 'A', playedAt: 1000 - i }));
    const { recentSongs } = await load(w);
    assert.deepEqual(recentSongs().map((s) => s.id), [2, 1, 3]);
    assert.equal(recentSongs(2).length, 2);
    w.history = [];
    assert.deepEqual(recentSongs(), []);
});

test('whenPlayed: time today, Yesterday, or a short date; empty when unknown', async () => {
    const { whenPlayed } = await load(world());
    const now = new Date(2026, 9, 24, 15, 0).getTime();
    assert.match(whenPlayed(new Date(2026, 9, 24, 9, 5).getTime(), now), /9|09/);
    assert.equal(whenPlayed(new Date(2026, 9, 23, 23, 0).getTime(), now), 'Yesterday');
    assert.match(whenPlayed(new Date(2026, 9, 1).getTime(), now), /Oct/);
    assert.equal(whenPlayed(0, now), '');
});

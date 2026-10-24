// Tests for src/ui-next/adapter/song-open.js (task PB-17): the one rule for "open this song". Pure Node, fake engine.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE = pathToFileURL(path.resolve(__dirname, '..', '..', 'src', 'ui-next', 'adapter', 'song-open.js')).href;

function world() {
    const log = [];
    const w = {
        log,
        albums: [{ id: 'a0000000000a1', songs: [1, 2] }],
        getAlbums: () => w.albums,
        switchToViewAndScroll: (...args) => log.push(['scroll', ...args]),
        playSongFromList: (...args) => log.push(['play', ...args])
    };
    return w;
}
const load = (w) => {
    globalThis.window = w;
    return import(`${MODULE}?t=${Math.random()}`);
};

test('a song in an album opens that album with the song in view, and plays it with the album as its queue', async () => {
    const w = world();
    const { openSong, registerSongOpeners, albumOfSong } = await load(w);
    const shown = [];
    registerSongOpeners({ library: () => shown.push('library'), page: (id) => shown.push(['page', id]) });
    assert.equal(albumOfSong(2).id, 'a0000000000a1');
    assert.deepEqual(openSong(2), { kind: 'album', albumId: 'a0000000000a1' });
    assert.deepEqual(shown, ['library']);
    assert.deepEqual(w.log, [['scroll', 'a0000000000a1', 0, 2, 'a0000000000a1'], ['play', 2, 'a0000000000a1', null]]);
});

test('a song in no album opens its own page and plays it', async () => {
    const w = world();
    const { openSong, registerSongOpeners, albumOfSong } = await load(w);
    const shown = [];
    registerSongOpeners({ library: () => shown.push('library'), page: (id) => shown.push(['page', id]) });
    assert.equal(albumOfSong(9), null);
    assert.deepEqual(openSong(9), { kind: 'song-page' });
    assert.deepEqual(shown, [['page', 9]]);
    assert.deepEqual(w.log, [['play', 9, 'all-songs', null]]);
});

test('openSong before the shell registered its openers says so', async () => {
    const { openSong } = await load(world());
    assert.throws(() => openSong(1), /registered/);
});

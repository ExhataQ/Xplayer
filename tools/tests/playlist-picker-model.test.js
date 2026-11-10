'use strict';

// views/library/playlist-picker-model.js: what the "Add to playlist" picker lists. Run: node --test tools/tests/playlist-picker-model.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'ui-next', 'views', 'library', 'playlist-picker-model.js')).href);
const LISTS = [
    { id: 'a', name: 'Road trip', songs: [1, 2] },
    { id: 'b', name: 'Trip hop', songs: [] },
    { id: 'c', name: 'Gym', songs: [3] }
];

test('no query keeps every playlist in the given order', async () => {
    const { filterPlaylists } = await load();
    assert.deepEqual(filterPlaylists(LISTS, '  ').map((p) => p.id), ['a', 'b', 'c']);
});

test('a query keeps names that contain it, names that start with it first, any case', async () => {
    const { filterPlaylists } = await load();
    assert.deepEqual(filterPlaylists(LISTS, 'TRIP').map((p) => p.id), ['b', 'a']);
    assert.deepEqual(filterPlaylists(LISTS, 'zzz'), []);
});

test('membership says whether a playlist has all, some or none of the songs', async () => {
    const { membership } = await load();
    assert.equal(membership(LISTS[0], [1, 2]), 'all');
    assert.equal(membership(LISTS[0], [2, 9]), 'some');
    assert.equal(membership(LISTS[1], [1]), 'none');
});

test('the new playlist is named what was typed, else the first free "New playlist"', async () => {
    const { newPlaylistName } = await load();
    assert.equal(newPlaylistName(LISTS, '  Focus '), 'Focus');
    assert.equal(newPlaylistName(LISTS, ''), 'New playlist');
    assert.equal(newPlaylistName([{ name: 'new playlist' }], ''), 'New playlist 2');
    assert.equal(newPlaylistName([{ name: 'New playlist' }, { name: 'New playlist 2' }], undefined), 'New playlist 3');
});

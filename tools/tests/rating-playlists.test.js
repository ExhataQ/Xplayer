'use strict';

// The engine side of Top rated and Not rated (library/03i-rating-playlists.js) and the places that must not edit them by hand
// (task B3). The pure rules are in rating-rules.test.js. Run: node --test tools/tests/rating-playlists.test.js

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const url = (rel) => pathToFileURL(path.join(ROOT, rel)).href;
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let playlists;
let log;
let ratings;
let on;

async function engine() {
    Object.assign(globalThis, await import(url('src/js/library/rating-rules.js')));
    globalThis.SONGS_DATA = [{ id: 1 }, { id: 2 }, { id: 3 }];
    globalThis.isRatingSystemOn = () => on;
    globalThis.ratingsForSongIds = (ids) => ids.map((id) => ratings[id] || 0);
    globalThis.getPlaylists = () => playlists;
    globalThis.savePlaylists = (list) => ((playlists = list), log.push('save'));
    globalThis.generateLongId = (p) => p + 'x' + log.length;
    globalThis.removeItemFromAllFolders = (id) => log.push('folders:' + id);
    globalThis.emit = (name, detail) => log.push(name + (detail && detail.playlistId ? ':' + detail.playlistId : ''));
    globalThis.VIEWS = { ALL_SONGS: 'all-songs' };
    globalThis.switchView = (v) => log.push('view:' + v);
    globalThis.refreshCurrentViewAfterMutation = () => log.push('redraw');
    return import(url('src/js/library/03i-rating-playlists.js') + '?t=' + Math.random());
}

beforeEach(() => {
    playlists = [{ id: 'mine', name: 'Mine', songs: [1] }];
    log = [];
    ratings = {};
    on = true;
    globalThis.currentView = 'all-songs';
});

test('with the system on the playlists are made from the ratings, saved once, and the lists told', async () => {
    ratings = { 1: 5, 2: 4 };
    const m = await engine();
    assert.equal(m.refreshRatingPlaylists(), true);
    assert.deepEqual(playlists.find((p) => p.smart === 'top-rated').songs, [1, 2]);
    assert.deepEqual(playlists.find((p) => p.smart === 'not-rated').songs, [3]);
    assert.equal(log.filter((x) => x === 'save').length, 1);
    assert.ok(log.includes('playlist:listChanged'));
    assert.equal(m.refreshRatingPlaylists(), false, 'again with nothing changed: nothing saved');
});

test('turning the system off removes them (and their place in folders), and a list that is open goes to All songs first', async () => {
    ratings = { 1: 5 };
    const m = await engine();
    m.refreshRatingPlaylists();
    const top = playlists.find((p) => p.smart === 'top-rated').id;
    on = false;
    globalThis.currentView = 'playlist-' + top;
    log.length = 0;
    assert.equal(m.refreshRatingPlaylists(), true);
    assert.deepEqual(playlists.map((p) => p.id), ['mine']);
    assert.ok(log.indexOf('view:all-songs') < log.indexOf('save'), 'it leaves the list before the list is gone');
    assert.ok(log.some((x) => x.startsWith('folders:')));
});

test('the open playlist is redrawn when its songs change, so the rows and the clicks agree', async () => {
    ratings = { 1: 5 };
    const m = await engine();
    m.refreshRatingPlaylists();
    const top = playlists.find((p) => p.smart === 'top-rated').id;
    globalThis.currentView = 'playlist-' + top;
    ratings = { 1: 2 };
    log.length = 0;
    m.refreshRatingPlaylists();
    assert.deepEqual(playlists.find((p) => p.id === top).songs, []);
    assert.ok(log.includes('redraw'));
    assert.ok(log.includes('playlist:songCountChanged:' + top));
});

test('songs cannot be added to, removed from, or dropped into a rating playlist, and it cannot be deleted by hand', async () => {
    const stored = [{ id: 'top', name: 'Top rated', smart: 'top-rated', songs: [1] }, { id: 'mine', name: 'Mine', songs: [] }];
    let writes = 0;
    Object.assign(globalThis, await import(url('src/js/library/rating-rules.js')));
    globalThis.STORAGE_KEYS = { PLAYLISTS: 'playlists' };
    globalThis.storageReadJson = () => JSON.parse(JSON.stringify(stored));
    globalThis.storageWriteJson = () => writes++;
    globalThis.normalizePlaylists = (x) => x;
    globalThis.emit = () => {};
    globalThis.removeItemFromAllFolders = () => {};
    globalThis.showNotification = () => {};
    const m = await import(url('src/js/playlists/03c-playlists.js') + '?t=' + Math.random());
    assert.equal(m.addSongToPlaylist(2, 'top'), false);
    assert.equal(m.removeSongFromPlaylist(1, 'top'), false);
    m.deletePlaylist('top');
    assert.equal(writes, 0, 'nothing was saved');
    assert.equal(m.addSongToPlaylist(2, 'mine'), true, 'the person\'s own playlist still works');
    assert.equal(writes, 1);
    const drop = await import(url('src/js/ui/06l-drop-rules.js') + '?t=' + Math.random());
    globalThis.getPlaylists = () => stored;
    assert.equal(drop.dropTarget('song', 'playlist-top', null), null, 'no drop on Top rated');
    assert.deepEqual(drop.dropTarget('song', 'playlist-mine', null), { type: 'playlist', id: 'mine' });
    delete globalThis.getPlaylists;
});

test('the wiring: loaded in order, hidden from the Add to playlist menus and Remove from playlist, a rating row in Show metadata', () => {
    const main = read('src/js/main.js');
    assert.ok(main.indexOf("'./library/03h-ratings.js'") < main.indexOf("'./library/03i-rating-playlists.js'"));
    const menu = read('src/js/ui/06a-context-menus.js');
    assert.match(menu, /getPlaylists\(\)\.filter\(\(p\) => !p\.smart\)/, 'the old submenu');
    assert.match(menu, /showRemoveFromCurrentPlaylist && currentPlaylistName && !\(/, 'Remove from playlist');
    assert.match(read('src/ui-next/adapter/playlist-picker-bridge.js'), /getPlaylists\(\)\.filter\(\(p\) => !p\.smart\)/, 'the picker');
    const modal = read('src/js/ui/06b-modals.js');
    assert.match(modal, /isRatingSystemOn\(\) \? \[\['Rating', ratingOf\(song\) \? ratingLabel\(ratingOf\(song\)\) : ''\]\] : \[\]/);
    assert.match(read('src/js/library/03i-rating-playlists.js'), /on\('ratingSettings:changed', refreshRatingPlaylists\)/);
});

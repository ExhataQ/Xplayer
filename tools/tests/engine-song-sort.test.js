// Engine song sort (task PB-08, decision DP13 option A): the per-list sort that getSongsForList and renderSongsList both apply.
// Pure module, no browser needed. The wiring into those two functions is tested in ui-next-songlist.test.js with the real app.
//
// Run:   node --test tools/tests/engine-song-sort.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const sorter = require(path.join(__dirname, '..', '..', 'src', 'js', 'library', '03n-song-sort.js'));
const { parseDuration, sortSongs, compareSongs, isSongListSortable, getSongListSort, setSongListSort, applyListSort } = sorter;

const ids = (songs) => songs.map((s) => s.id);
const song = (id, extra = {}) => ({ id, title: id, album: '', duration: '', ...extra });
let n = 0;
const freshList = () => `playlist-t${++n}`; // the module keeps its state for the whole run, so each test uses its own list id

test('durations: seconds, m:ss and h:mm:ss; anything else is unknown', () => {
    assert.equal(parseDuration(180), 180);
    assert.equal(parseDuration('180'), 180);
    assert.equal(parseDuration('3:05'), 185);
    assert.equal(parseDuration('1:02:03'), 3723);
    for (const bad of ['\u2014', '', undefined, null, -4, '3:xx', '1:2:3:4']) assert.equal(parseDuration(bad), null, String(bad));
});

test('title sorts both ways, with numbers compared by value', () => {
    const songs = [song('Song 10'), song('Song 2'), song('Alpha')];
    assert.deepEqual(ids(sortSongs(songs, 'title', 'asc')), ['Alpha', 'Song 2', 'Song 10']);
    assert.deepEqual(ids(sortSongs(songs, 'title', 'desc')), ['Song 10', 'Song 2', 'Alpha']);
});

test('time sorts by seconds, not by text', () => {
    const songs = [song('a', { duration: '10:00' }), song('b', { duration: '9:30' }), song('c', { duration: '1:02:03' })];
    assert.deepEqual(ids(sortSongs(songs, 'time', 'asc')), ['b', 'a', 'c']);
    assert.deepEqual(ids(sortSongs(songs, 'time', 'desc')), ['c', 'a', 'b']);
});

test('missing values go last in both directions', () => {
    const songs = [song('x', { album: '' }), song('y', { album: 'Blue' }), song('z', { album: 'Ant' })];
    assert.deepEqual(ids(sortSongs(songs, 'album', 'asc')), ['z', 'y', 'x']);
    assert.deepEqual(ids(sortSongs(songs, 'album', 'desc')), ['y', 'z', 'x']);
    assert.deepEqual(ids(sortSongs([song('p', { duration: '\u2014' }), song('q', { duration: '2:00' })], 'time', 'desc')), ['q', 'p']);
});

test('equal values keep the order they came in, in both directions', () => {
    const songs = [song('one', { album: 'Same' }), song('two', { album: 'Same' }), song('three', { album: 'Same' })];
    assert.deepEqual(ids(sortSongs(songs, 'album', 'asc')), ['one', 'two', 'three']);
    assert.deepEqual(ids(sortSongs(songs, 'album', 'desc')), ['one', 'two', 'three']);
});

test('sortSongs never changes its input; an unknown key gives a copy in the same order', () => {
    const songs = [song('b'), song('a')];
    const out = sortSongs(songs, 'title', 'asc');
    assert.deepEqual(ids(songs), ['b', 'a']);
    assert.deepEqual(ids(out), ['a', 'b']);
    const same = sortSongs(songs, 'artist', 'asc');
    assert.deepEqual(ids(same), ['b', 'a']);
    assert.notEqual(same, songs);
});

test('Persian and Latin titles sort without throwing', () => {
    assert.doesNotThrow(() => sortSongs([song('Hello'), song('\u0633\u0644\u0627\u0645')], 'title', 'asc'));
    assert.equal(compareSongs(song('a', { duration: '' }), song('b', { duration: '' }), 'time'), 0);
});

test('a list has no sort until one is set; a bad key clears it; lists are independent', () => {
    const a = freshList();
    const b = freshList();
    assert.equal(getSongListSort(a), null);
    assert.deepEqual(setSongListSort(a, 'title', 'desc'), { key: 'title', dir: 'desc' });
    assert.deepEqual(getSongListSort(a), { key: 'title', dir: 'desc' });
    assert.equal(getSongListSort(b), null);
    assert.deepEqual(setSongListSort(a, 'album'), { key: 'album', dir: 'asc' });
    assert.equal(setSongListSort(a, 'nonsense'), null);
    assert.equal(getSongListSort(a), null);
    assert.equal(setSongListSort('', 'title'), null);
});

test('only lists that draw through renderSongsList can be sorted', () => {
    for (const ok of ['all-songs', 'favorites', 'playlist-1699999999999', 'aUU6BIQ66UEIJ', 'rAB6BIQ66UEIJ']) assert.equal(isSongListSortable(ok), true, ok);
    for (const no of ['history', 'recent', 'search-items', 'search', 'albums', 'artists', 'playlists', 'lyrics', 'aShort', '', null, undefined, 7]) assert.equal(isSongListSortable(no), false, String(no));
    assert.equal(setSongListSort('history', 'title', 'asc'), null);
    assert.equal(getSongListSort('history'), null);
    const songs = [song('b'), song('a')];
    assert.equal(applyListSort('history', songs), songs, 'a list that cannot be sorted always keeps its own order');
});

test('applyListSort with no sort returns the very same array', () => {
    const list = freshList();
    const songs = [song('b'), song('a')];
    assert.equal(applyListSort(list, songs), songs);
    assert.equal(applyListSort(list, null), null);
    assert.deepEqual(applyListSort(list, []), []);
});

test('applyListSort sorts a copy and leaves the source alone', () => {
    const list = freshList();
    const songs = [song('b'), song('c'), song('a')];
    setSongListSort(list, 'title', 'asc');
    const out = applyListSort(list, songs);
    assert.deepEqual(ids(out), ['a', 'b', 'c']);
    assert.deepEqual(ids(songs), ['b', 'c', 'a']);
    setSongListSort(list, 'title', 'desc');
    assert.deepEqual(ids(applyListSort(list, songs)), ['c', 'b', 'a']);
    setSongListSort(list, null);
    assert.equal(applyListSort(list, songs), songs);
});

test('the drawing path and the reading path get the same order, even from different copies of the list', () => {
    // renderSongsList gets whatever array its caller holds; getSongsForList builds its own. Both call applyListSort(listId, ...).
    const list = freshList();
    const natural = [song('d', { album: 'B' }), song('a', { album: 'B' }), song('c', { album: 'A' }), song('b', { album: '' })];
    setSongListSort(list, 'album', 'asc');
    const drawn = applyListSort(list, natural.slice());
    const read = applyListSort(list, [...natural]);
    assert.deepEqual(ids(drawn), ids(read));
    assert.deepEqual(ids(drawn), ['c', 'd', 'a', 'b']);
    // sorting an already sorted list changes nothing, so it does not matter which caller sorted first
    assert.deepEqual(ids(applyListSort(list, drawn)), ids(drawn));
});

test('the last result is reused while the input is unchanged, and not otherwise', () => {
    const list = freshList();
    const songs = [song('b'), song('c'), song('a')];
    setSongListSort(list, 'title', 'asc');
    const first = applyListSort(list, songs);
    assert.equal(applyListSort(list, songs), first, 'same input, same result object');
    assert.equal(applyListSort(list, songs.slice()), first, 'a copy with the same songs in the same order is the same input');

    songs[0].title = 'z'; // a metadata edit made in place
    const edited = applyListSort(list, songs);
    assert.notEqual(edited, first);
    assert.deepEqual(ids(edited), ['a', 'c', 'b'], 'the edited title sorts last (b is now "z")');

    const bigger = [...songs, song('0first')];
    assert.deepEqual(ids(applyListSort(list, bigger)), ['0first', 'a', 'c', 'b']);
    assert.deepEqual(ids(applyListSort(list, [songs[2], songs[1], songs[0]])), ['a', 'c', 'b'], 'a different order of the same songs still gives a sorted result');

    const again = applyListSort(list, songs);
    setSongListSort(list, 'title', 'desc');
    assert.notEqual(applyListSort(list, songs), again, 'a new sort is never served from the old result');
    assert.deepEqual(ids(applyListSort(list, songs)), ['b', 'c', 'a']);
});

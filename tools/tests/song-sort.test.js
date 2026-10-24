// Song sort, header side (task PB-08): what a header click does. The sorting itself is tested in engine-song-sort.test.js.
//
// Run:   node --test tools/tests/song-sort.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { nextSort, SORT_KEYS } = require(path.join(__dirname, '..', '..', 'src', 'ui-next', 'views', 'library', 'song-sort.js'));

test('a new column sorts ascending', () => {
    assert.deepEqual(nextSort(null, 'title'), { key: 'title', dir: 'asc' });
    assert.deepEqual(nextSort({ key: 'title', dir: 'desc' }, 'time'), { key: 'time', dir: 'asc' });
});

test('the same column goes ascending, descending, then back to the list\'s own order', () => {
    let state = nextSort(null, 'album');
    assert.deepEqual(state, { key: 'album', dir: 'asc' });
    state = nextSort(state, 'album');
    assert.deepEqual(state, { key: 'album', dir: 'desc' });
    state = nextSort(state, 'album');
    assert.equal(state, null);
    assert.deepEqual(nextSort(state, 'album'), { key: 'album', dir: 'asc' });
});

test('a key that is not sortable changes nothing', () => {
    assert.deepEqual(nextSort({ key: 'title', dir: 'asc' }, 'artist'), { key: 'title', dir: 'asc' });
    assert.equal(nextSort(null, 'artist'), null);
});

test('the three sortable columns', () => {
    assert.deepEqual(SORT_KEYS, ['title', 'album', 'time']);
});

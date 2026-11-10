'use strict';

// The Rating column of the song list (task B3, slice 2b): which star a click lands on, the bulk lookup the rows use, and the wiring and
// style that cannot be seen without a browser. Run: node --test tools/tests/rating-column.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const url = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

test('a click sets the rating under it: 16px a star, the left half of a star is the half star, never outside 0.5 to 5', async () => {
    const { starAt } = await import(url('src/ui-next/views/library/song-rating-column.js'));
    assert.deepEqual([0, 1, 8, 9, 16, 17, 24, 25, 32, 40, 41, 72, 73, 80, 200, -5].map(starAt), [0.5, 0.5, 0.5, 1, 1, 1.5, 1.5, 2, 2, 2.5, 3, 4.5, 5, 5, 5, 0.5]);
});

test('ratings for a batch of songs: the saved one, else the file tag, else none, in the order asked', async () => {
    const rules = await import(url('src/js/library/rating-rules.js'));
    Object.assign(globalThis, rules);
    const store = { ratings: JSON.stringify({ 1: 5, 3: 2 }) };
    globalThis.STORAGE_KEYS = { RATINGS: 'ratings', RATING_SETTINGS: 'ratingSettings' };
    let reads = 0;
    globalThis.storageReadJson = (key, fallback, normalize) => (reads++, key in store ? (normalize ? normalize(JSON.parse(store[key])) : JSON.parse(store[key])) : fallback);
    globalThis.storageWriteJson = () => true;
    globalThis.emit = () => {};
    globalThis.SONGS_DATA = [{ id: 1, rating: '0.2' }, { id: 2, rating: '0.8' }, { id: 3 }, { id: 4, rating: 'x' }, { id: 5, rating: '0.7' }];
    const m = await import(url('src/js/library/03h-ratings.js') + '?t=' + Math.random());
    reads = 0;
    assert.deepEqual(m.ratingsForSongIds([1, 2, 3, 4, 99, '2', 5]), [5, 4, 2, 0, 0, 4, 3.5]);
    assert.equal(reads, 1, 'one read of the saved ratings for the whole batch, not one per row');
    assert.deepEqual(m.ratingsForSongIds([]), []);
});

test('the grid: five columns only while the column is on, four otherwise; the cell is never display: none; narrow windows give it no width', () => {
    const css = read('src/ui-next/views/library/song-list.css');
    assert.match(css, /\[data-rating-column='on'\] \.song-item \{\s*grid-template-columns: var\(--sl-number\) minmax\(0, var\(--sl-title\)\) minmax\(0, var\(--sl-album\)\) var\(--sl-rating\) var\(--sl-right\);/);
    assert.match(css, /\.songlist-head__cell--rating \{\s*display: none;/);
    const cell = css.slice(css.indexOf('.song-rating {'), css.indexOf('}', css.indexOf('.song-rating {')));
    assert.ok(!/display: none/.test(cell), 'the cell stays in the row');
    assert.match(css, /@container songhost \(max-width: 640px\) \{[^@]*--sl-rating: 0px;/);
    assert.match(css, /\.song-rating__stars \{[^}]*width: 80px;[^}]*height: 16px;/);
    assert.match(css, /calc\(var\(--preview, var\(--stars, 0\)\) \* 16px\)/);
});

test('every cell has its own grid column, so a missing or left-over Rating cell cannot push the others; off, the cell is not drawn', () => {
    const css = read('src/ui-next/views/library/song-list.css');
    assert.match(css, /\.song-item > \.right-song-item,\s*\.songlist-head > \.songlist-head__tail \{\s*grid-column: -2 \/ -1;/, 'time and buttons: always the last column');
    assert.match(css, /\[data-rating-column='on'\] \.song-item > \.song-rating,[^{]*\.songlist-head__cell--rating \{\s*grid-column: 4;/, 'rating: the fourth, row and header alike');
    assert.match(css, /:not\(\[data-rating-column='on'\]\) \.song-rating \{\s*display: none;/);
    const js = read('src/ui-next/views/library/song-rating-column.js');
    assert.match(js, /if \(host\.dataset\.ratingColumn !== 'on'\) return;/, 'a cell is added only while the grid has its column');
});

test('the Rating column can be resized: a saved width within limits, a handle, drag and keys, reset with the other widths; the style shows it only while the column is on', () => {
    const js = read('src/ui-next/views/library/song-list.js');
    assert.match(js, /RATING_MIN = 88/);
    assert.match(js, /RATING_MAX = 240/);
    assert.match(js, /ratingWidth: ratingWidth >= RATING_MIN && ratingWidth <= RATING_MAX/);
    assert.match(js, /--sl-rating-w/);
    assert.match(js, /startWidth - \(e\.clientX - startX\)/, 'dragging left makes it wider');
    assert.match(js, /ratingResizer\.addEventListener\('keydown'/);
    assert.match(js, /state\.share === DEFAULT_SHARE && state\.ratingWidth === RATING_DEFAULT/);
    const css = read('src/ui-next/views/library/song-list.css');
    assert.match(css, /--sl-rating: var\(--sl-rating-w, 88px\)/);
    assert.match(css, /\.songlist-rating-resizer \{\s*display: none;/);
    assert.match(css, /\[data-rating-column='on'\] \.songlist-rating-resizer \{\s*display: block;/);
    assert.ok(!/\.songlist-resizer[^-]/.test(js.slice(js.indexOf('ratingResizer = el('), js.indexOf('const header = el('))), 'a class of its own: the tests that look for the Title and Album handle find only that one');
});

test('the song list: Rating is a column setting (on by default), has a header cell, and a menu entry only while the system is on', () => {
    const js = read('src/ui-next/views/library/song-list.js');
    assert.match(js, /DEFAULTS = \{[^}]*rating: true/);
    assert.match(js, /rating: flag\('rating'\)/);
    assert.match(js, /songlist-head__cell--rating/);
    assert.match(js, /ratingSystemOn\(\) \? \[toggle\('rating', 'Rating'\)\] : \[\]/);
    assert.match(js, /ratingColumn\.setOn\(state\.rating\)/);
});

test('the cells: added to each row as it appears, one lookup per batch, a double click does not play, a click does not select the row', () => {
    const js = read('src/ui-next/views/library/song-rating-column.js');
    assert.match(js, /new MutationObserver/);
    assert.match(js, /ratingsForSongs\(/);
    assert.match(js, /data-stop-dblclick/);
    assert.match(js, /event\.stopPropagation\(\)/);
    assert.match(js, /current === picked \? 0 : picked/);
    assert.match(js, /lazy-skeleton/, 'the loading rows get a cell too, so their grid keeps its columns');
    assert.match(js, /bar\.className = 'skeleton-bar'/, 'with a placeholder bar like their other cells');
    assert.match(read('src/ui-next/views/library/song-list.css'), /\.song-rating \.skeleton-bar \{\s*height: 10px;\s*width: 70px;/);
});

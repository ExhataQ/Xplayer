'use strict';

// The rating in the song menu (task B3): the menu action, and what the menu builder shows and when. Run: node --test tools/tests/rating-menu.test.js

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let said;
let saved;

async function actions() {
    const rules = await import(pathToFileURL(path.join(ROOT, 'src/js/library/rating-rules.js')).href);
    Object.assign(globalThis, rules);
    globalThis.registerActions = () => {};
    globalThis.registerLegacyGlobals = () => {};
    globalThis.setRating = (id, n) => (saved[id] = n);
    globalThis.showNotification = (text) => said.push(text);
    globalThis.SONGS_DATA = [{ id: 1, title: 'One' }, { id: 2, title: 'Two' }, { id: 3, title: 'Three' }];
    return import(pathToFileURL(path.join(ROOT, 'src/js/ui/16-context-menu-actions.js')).href + '?t=' + Math.random());
}

beforeEach(() => {
    said = [];
    saved = {};
    delete globalThis.selectedSongIds;
});

test('Rate from the menu rates the clicked song and says so', async () => {
    const m = await actions();
    m.setRatingFromMenu(1, '4');
    assert.deepEqual(saved, { 1: 4 });
    assert.deepEqual(said, ['Rated "One" 4 stars']);
});

test('Rate from the menu with several songs selected rates all of them, once, with one message', async () => {
    const m = await actions();
    globalThis.selectedSongIds = new Set([1, 2, 3]);
    m.setRatingFromMenu(2, 5);
    assert.deepEqual(saved, { 1: 5, 2: 5, 3: 5 });
    assert.deepEqual(said, ['Rated 3 songs 5 stars']);
});

test('a song that is not part of the selection is rated alone', async () => {
    const m = await actions();
    globalThis.selectedSongIds = new Set([1, 2]);
    m.setRatingFromMenu(3, 2);
    assert.deepEqual(saved, { 3: 2 });
});

test('Remove rating (0) clears and says so; one star reads "1 star"', async () => {
    const m = await actions();
    m.setRatingFromMenu(1, '0');
    assert.deepEqual(saved, { 1: 0 });
    assert.deepEqual(said, ['Removed the rating of "One"']);
    m.setRatingFromMenu(2, 1);
    assert.equal(said[1], 'Rated "Two" 1 star');
});

test('half stars are rated and read back as half stars', async () => {
    const m = await actions();
    m.setRatingFromMenu(1, '3.5');
    assert.deepEqual(saved, { 1: 3.5 });
    assert.deepEqual(said, ['Rated "One" 3.5 stars']);
});

test('nothing happens without a song', async () => {
    const m = await actions();
    m.setRatingFromMenu(null, 3);
    m.setRatingFromMenu(undefined, 3);
    assert.deepEqual(saved, {});
    assert.deepEqual(said, []);
});

test('the song menu builder: Rate only while the system is on, as a submenu of five rows, with Remove rating only when something is rated', () => {
    const src = read('src/js/ui/06a-context-menus.js');
    assert.match(src, /typeof isRatingSystemOn === 'function' && isRatingSystemOn\(\)/);
    assert.match(src, /\['setRatingFromMenu', songId, String\(n\)\]/);
    assert.match(src, /RATING_CHOICES\.map\(starRow\)/, 'every rating from 5 stars down to half a star');
    assert.match(src, /now\.some\(\(r\) => r > 0\)/);
    assert.match(src, /setRatingFromMenu: \(\.\.\.a\) => setRatingFromMenu\(\.\.\.a\)/, 'the menu may run the action');
    assert.match(read('src/js/ui/16-context-menu-actions.js'), /^\s+setRatingFromMenu,$/m, 'and the action is a registered global');
});

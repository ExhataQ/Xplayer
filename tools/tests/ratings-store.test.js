'use strict';

// src/js/library/03h-ratings.js (task B3): the saved ratings and the Rating system settings, with the engine's storage and events
// replaced by plain stand-ins. Also checks the wiring that cannot be seen in a browser here. Run: node --test tools/tests/ratings-store.test.js

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const url = (rel) => pathToFileURL(path.join(ROOT, rel)).href;
let events;
let saved;

async function load() {
    const rules = await import(url('src/js/library/rating-rules.js'));
    Object.assign(globalThis, rules); // the engine files find these by name (registerLegacyGlobals)
    globalThis.STORAGE_KEYS = { RATINGS: 'ratings', RATING_SETTINGS: 'ratingSettings' };
    globalThis.storageReadJson = (key, fallback, normalize) => (key in saved ? (normalize ? normalize(JSON.parse(saved[key])) : JSON.parse(saved[key])) : fallback);
    globalThis.storageWriteJson = (key, value) => ((saved[key] = JSON.stringify(value)), true);
    globalThis.emit = (name, detail) => events.push({ name, detail });
    return import(url('src/js/library/03h-ratings.js') + '?t=' + Math.random());
}

beforeEach(() => {
    events = [];
    saved = {};
});

test('the system is off until the person turns it on, and a switch saves and tells', async () => {
    const m = await load();
    assert.equal(m.isRatingSystemOn(), false);
    assert.deepEqual(m.getRatingSettings(), { enabled: false, shuffleWeight: true, writeTags: true });
    m.setRatingSetting('enabled', true);
    assert.equal(m.isRatingSystemOn(), true);
    assert.deepEqual(events.map((e) => e.name), ['ratingSettings:changed']);
    assert.equal(events[0].detail.key, 'enabled');
});

test('a switch that does not exist, or a value that is not true or false, changes nothing', async () => {
    const m = await load();
    m.setRatingSetting('nope', true);
    m.setRatingSetting('enabled', 'yes');
    assert.equal(m.isRatingSystemOn(), false);
    assert.deepEqual(events, []);
});

test('a rating is saved per song, cleared with 0, and every change is announced', async () => {
    const m = await load();
    assert.equal(m.getRating(7), 0);
    assert.equal(m.setRating(7, 4), 4);
    assert.equal(m.getRating(7), 4);
    assert.equal(m.getRating('7'), 4, 'the id may be a number or a string');
    assert.equal(m.setRating(7, 0), 0);
    assert.equal(m.getRating(7), 0);
    assert.deepEqual(m.getRatings(), {});
    assert.deepEqual(events.map((e) => e.name), ['ratings:changed', 'ratings:changed']);
    assert.equal(m.setRating(7, 99), 0, 'an impossible number is no rating');
});

test('half stars are kept as half stars; between halves the nearest is kept', async () => {
    const m = await load();
    assert.equal(m.setRating(1, 3.5), 3.5);
    assert.equal(m.getRating(1), 3.5);
    assert.equal(m.setRating(1, 3.7), 3.5);
    assert.equal(m.ratingOf({ id: 2, rating: '0.7' }), 3.5, 'a half star from the file tag');
});

test('the stars of a song: the saved one, else the one the scan read from the tags', async () => {
    const m = await load();
    assert.equal(m.ratingOf({ id: 1, rating: '0.8' }), 4, 'from the file tags');
    m.setRating(1, 2);
    assert.equal(m.ratingOf({ id: 1, rating: '0.8' }), 2, 'what is saved here wins');
    assert.equal(m.ratingOf({ id: 2, rating: '' }), 0);
    assert.equal(m.ratingOf(null), 0);
});

test('ratings stay saved while the system is off (nothing is lost by turning it off)', async () => {
    const m = await load();
    m.setRating(3, 5);
    m.setRatingSetting('enabled', true);
    m.setRatingSetting('enabled', false);
    assert.equal(m.getRating(3), 5);
});

test('Smart Shuffle order: plain random with the system off or the weight off, weighted only when both are on', async () => {
    const m = await load();
    const songs = [{ id: 1 }, { id: 2 }, { id: 3 }];
    m.setRating(1, 5);
    assert.equal(m.songsInShuffleOrder(songs).length, 3);
    let calls = 0;
    globalThis.ratingWeight = (stars) => (calls++, 1);
    m.songsInShuffleOrder(songs);
    assert.equal(calls, 0, 'off: the ratings are not even looked at');
    m.setRatingSetting('enabled', true);
    m.songsInShuffleOrder(songs);
    assert.ok(calls > 0, 'on: weighted');
    calls = 0;
    m.setRatingSetting('shuffleWeight', false);
    m.songsInShuffleOrder(songs);
    assert.equal(calls, 0, 'weight switch off: plain random again');
});

test('the wiring: the engine files are in main.js in order, Smart Shuffle asks for the order, the keys exist, backups carry ratings', () => {
    const main = fs.readFileSync(path.join(ROOT, 'src/js/main.js'), 'utf8');
    assert.ok(main.indexOf("'./library/rating-rules.js'") > 0 && main.indexOf("'./library/rating-rules.js'") < main.indexOf("'./library/03h-ratings.js'"));
    const shuffle = fs.readFileSync(path.join(ROOT, 'src/js/playback/10b-playback-smart-shuffle.js'), 'utf8');
    assert.match(shuffle, /songsInShuffleOrder\(artistSongs\)/);
    assert.equal(shuffle.split('[...artistSongs].sort(() => Math.random() - 0.5)').length - 1, 1, 'the plain random sort is only the fallback when the function is missing');
    const state = fs.readFileSync(path.join(ROOT, 'src/js/core/00-state.js'), 'utf8');
    assert.match(state, /RATINGS: 'ratings'/);
    assert.match(state, /RATING_SETTINGS: 'ratingSettings'/);
    const io = fs.readFileSync(path.join(ROOT, 'src/js/library/03l-import-export.js'), 'utf8');
    assert.match(io, /ratings: getRatings\(\)/);
    assert.match(io, /data\.ratings/);
});

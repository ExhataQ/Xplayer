'use strict';

// src/js/library/rating-rules.js (task B3): what counts as a rating, the shuffle weight, tag text as stars, and the Home playlists.
// Pure module, imported directly. Run: node --test tools/tests/rating-rules.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const rules = import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'js', 'library', 'rating-rules.js')).href);

test('a rating is stars from 0.5 to 5 in half steps; anything else is no rating', async () => {
    const { normalizeRating } = await rules;
    assert.deepEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(normalizeRating), [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
    assert.equal(normalizeRating('4'), 4);
    assert.equal(normalizeRating('3.5'), 3.5);
    assert.equal(normalizeRating(3.6), 3.5, 'the nearest half star');
    assert.equal(normalizeRating(3.8), 4);
    assert.equal(normalizeRating(5.2), 5);
    assert.equal(normalizeRating(0.3), 0.5);
    for (const bad of [0, 0.2, -1, 6, 5.3, NaN, Infinity, null, undefined, '', 'x', {}, [], true]) assert.equal(normalizeRating(bad), 0, String(bad));
});

test('the scan reads a tag rating as 0 to 1; that becomes stars, and anything outside is no rating', async () => {
    const { ratingFromTagText } = await rules;
    assert.equal(ratingFromTagText('1'), 5);
    assert.equal(ratingFromTagText('0.8'), 4);
    assert.equal(ratingFromTagText('0.7'), 3.5, 'half stars come through');
    assert.equal(ratingFromTagText('0.5'), 2.5);
    assert.equal(ratingFromTagText(0.2), 1);
    assert.equal(ratingFromTagText('0.1'), 0.5);
    assert.equal(ratingFromTagText('0.04'), 0, 'less than a quarter star rounds to none');
    for (const bad of ['', '0', '-1', '3', '128', 'abc', null, undefined]) assert.equal(ratingFromTagText(bad), 0, String(bad));
});

test('labels say not rated, 1 star, 2 stars', async () => {
    const { ratingLabel } = await rules;
    assert.deepEqual([0, 0.5, 1, 1.5, 2, 5, 9].map(ratingLabel), ['Not rated', '0.5 stars', '1 star', '1.5 stars', '2 stars', '5 stars', 'Not rated']);
});

test('the weight: no rating and 3 stars are neutral, higher is more, lower is less, and nothing is zero', async () => {
    const { ratingWeight } = await rules;
    assert.equal(ratingWeight(0), 1);
    assert.equal(ratingWeight(3), 1);
    assert.ok(ratingWeight(5) > ratingWeight(4) && ratingWeight(4) > ratingWeight(3));
    assert.ok(ratingWeight(1) < ratingWeight(2) && ratingWeight(2) < ratingWeight(3));
    for (let s = 0; s <= 5; s += 0.5) assert.ok(ratingWeight(s) > 0, String(s));
    const rated = [];
    for (let s = 0.5; s <= 5; s += 0.5) rated.push(ratingWeight(s));
    assert.deepEqual([...rated].sort((a, b) => a - b), rated, 'from half a star to five stars the weight only goes up');
    assert.ok(ratingWeight(3.5) > ratingWeight(3) && ratingWeight(3.5) < ratingWeight(4), 'a half star is between its neighbours');
});

test('the song menu offers every rating from the best down', async () => {
    const { RATING_CHOICES, normalizeRating } = await rules;
    assert.equal(RATING_CHOICES.length, 10);
    assert.deepEqual(RATING_CHOICES, [...RATING_CHOICES].sort((a, b) => b - a));
    for (const c of RATING_CHOICES) assert.equal(normalizeRating(c), c);
});

test('weighted order keeps every item once, and with equal weights it is a shuffle', async () => {
    const { weightedOrder } = await rules;
    const items = ['a', 'b', 'c', 'd', 'e'];
    const out = weightedOrder(items, () => 1);
    assert.deepEqual([...out].sort(), items);
    assert.deepEqual(items, ['a', 'b', 'c', 'd', 'e'], 'the input is not changed');
    assert.deepEqual(weightedOrder([], () => 1), []);
});

test('heavier items come first more often (counted over many draws), and the light ones still come first sometimes', async () => {
    const { weightedOrder, ratingWeight } = await rules;
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // a fixed sequence: the test cannot flake
    const first = { five: 0, none: 0, one: 0 };
    const stars = { five: 5, none: 0, one: 1 };
    for (let i = 0; i < 6000; i++) first[weightedOrder(Object.keys(stars), (k) => ratingWeight(stars[k]), random)[0]]++;
    assert.ok(first.five > first.none && first.none > first.one, JSON.stringify(first));
    assert.ok(first.one > 300, 'a 1-star song still comes up: ' + first.one);
});

test('a bad weight counts as 1 instead of removing the item', async () => {
    const { weightedOrder } = await rules;
    assert.equal(weightedOrder(['a', 'b'], () => NaN).length, 2);
    assert.equal(weightedOrder(['a', 'b'], () => -3).length, 2);
});

test('saved ratings keep only valid ones, as string keys', async () => {
    const { parseRatings } = await rules;
    assert.deepEqual(parseRatings({ 1: 5, 2: 0, 3: 9, x: '4', y: 'no', z: 3.5, w: 3.7 }), { 1: 5, x: 4, z: 3.5, w: 3.5 });
    for (const bad of [null, undefined, 3, 'x', [1, 2]]) assert.deepEqual(parseRatings(bad), {});
});

test('the settings are off by default, and only true or false is taken', async () => {
    const { normalizeRatingSettings, RATING_DEFAULTS } = await rules;
    assert.equal(RATING_DEFAULTS.enabled, false);
    assert.deepEqual(normalizeRatingSettings(null), RATING_DEFAULTS);
    assert.deepEqual(normalizeRatingSettings({ enabled: 'yes', shuffleWeight: false, other: true }), { ...RATING_DEFAULTS, shuffleWeight: false });
});

test('Top rated is 4 stars and up, best first and stable; Not rated is the songs with no rating', async () => {
    const { ratingPlaylist } = await rules;
    const songs = [{ id: 'a', r: 4 }, { id: 'b', r: 0 }, { id: 'c', r: 5 }, { id: 'd', r: 4 }, { id: 'e', r: 2 }, { id: 'f' }, { id: 'g', r: 4.5 }, { id: 'h', r: 3.5 }];
    const of = (s) => s.r;
    assert.deepEqual(ratingPlaylist('top-rated', songs, of).map((s) => s.id), ['c', 'g', 'a', 'd']);
    assert.deepEqual(ratingPlaylist('not-rated', songs, of).map((s) => s.id), ['b', 'f']);
    assert.deepEqual(ratingPlaylist('other', songs, of), []);
});

// ----- Top rated and Not rated, the two playlists the rating system keeps -----
const planArgs = (over = {}) => ({ enabled: true, playlists: [], songs: [], ratingOf: () => 0, makeId: (() => { let n = 0; return () => 'p' + ++n; })(), now: 'now', ...over });

test('a smart playlist is the one with a known `smart` marker, nothing else', async () => {
    const { isRatingPlaylist } = await rules;
    assert.equal(isRatingPlaylist({ id: 1, smart: 'top-rated' }), true);
    assert.equal(isRatingPlaylist({ id: 1, smart: 'not-rated' }), true);
    for (const no of [{ id: 1 }, { id: 1, smart: 'other' }, { id: 1, smart: true }, null, undefined, 'x', 5]) assert.equal(isRatingPlaylist(no), false, JSON.stringify(no));
});

test('with the system off the two playlists are removed, the person\'s own are untouched', async () => {
    const { planRatingPlaylists } = await rules;
    const mine = { id: 'm', name: 'Mine', songs: [1] };
    const plan = planRatingPlaylists(planArgs({ enabled: false, playlists: [mine, { id: 't', smart: 'top-rated', songs: [1] }, { id: 'n', smart: 'not-rated', songs: [2] }] }));
    assert.deepEqual(plan.playlists, [mine]);
    assert.deepEqual(plan.removed, ['t', 'n']);
    assert.equal(plan.changed, true);
    const same = [mine];
    const none = planRatingPlaylists(planArgs({ enabled: false, playlists: same }));
    assert.equal(none.changed, false);
    assert.equal(none.playlists, same, 'the very same array: nothing to save');
});

test('with the system on a playlist is created when it would hold a song: Top rated best first, Not rated in library order', async () => {
    const { planRatingPlaylists } = await rules;
    const songs = [{ id: 1, r: 4 }, { id: 2, r: 0 }, { id: 3, r: 5 }, { id: 4, r: 2 }, { id: 5, r: 0 }];
    const plan = planRatingPlaylists(planArgs({ songs, ratingOf: (s) => s.r }));
    const top = plan.playlists.find((p) => p.smart === 'top-rated');
    const not = plan.playlists.find((p) => p.smart === 'not-rated');
    assert.deepEqual(top.songs, [3, 1]);
    assert.deepEqual(not.songs, [2, 5]);
    assert.equal(top.name, 'Top rated');
    assert.equal(not.name, 'Not rated');
    assert.equal(plan.added.length, 2);
    assert.deepEqual(plan.touched, plan.added);
    assert.equal(plan.changed, true);
});

test('a playlist that would be empty is not created, and one that exists is kept even when it goes empty', async () => {
    const { planRatingPlaylists } = await rules;
    const songs = [{ id: 1, r: 2 }];
    const first = planRatingPlaylists(planArgs({ songs, ratingOf: (s) => s.r }));
    assert.equal(first.playlists.some((p) => p.smart === 'top-rated'), false, 'nothing is 4 stars yet');
    assert.equal(first.playlists.some((p) => p.smart === 'not-rated'), false, 'every song is rated');
    const kept = [{ id: 't', name: 'Top rated', smart: 'top-rated', songs: [1] }];
    const after = planRatingPlaylists(planArgs({ songs, playlists: kept, ratingOf: (s) => s.r }));
    assert.deepEqual(after.playlists.find((p) => p.id === 't').songs, [], 'kept, now empty');
    assert.deepEqual(after.touched, ['t']);
});

test('nothing is saved when the playlists already match the ratings, and only what changed is touched', async () => {
    const { planRatingPlaylists } = await rules;
    const songs = [{ id: 1, r: 5 }, { id: 2, r: 0 }];
    const playlists = [{ id: 't', smart: 'top-rated', songs: [1] }, { id: 'n', smart: 'not-rated', songs: [2] }, { id: 'm', name: 'Mine', songs: [1, 2] }];
    const plan = planRatingPlaylists(planArgs({ songs, playlists, ratingOf: (s) => s.r }));
    assert.equal(plan.changed, false);
    assert.equal(plan.playlists, playlists);
    const rated = planRatingPlaylists(planArgs({ songs: [{ id: 1, r: 5 }, { id: 2, r: 4.5 }], playlists, ratingOf: (s) => s.r }));
    assert.deepEqual(rated.touched.sort(), ['n', 't'].sort());
    assert.deepEqual(rated.playlists.find((p) => p.id === 't').songs, [1, 2], '4.5 is Top rated too');
    assert.deepEqual(rated.playlists.find((p) => p.id === 'm').songs, [1, 2], 'the person\'s own playlist is never touched');
});

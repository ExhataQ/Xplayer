'use strict';

// electron/popularity.js: the ListenBrainz popularity request and the score from its answer. No network: the POST is injected.
// The request and answer shapes are from https://listenbrainz.readthedocs.io/en/latest/users/api/popularity.html (read 2026-10-26).
// Run: node --test tools/tests/popularity.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fetchPopularity, toScores, URL_RELEASE_GROUP } = require('../../electron/popularity');

const row = (id, users) => ({ release_group_mbid: id, total_listen_count: users === null ? null : users * 10, total_user_count: users });

test('scores are log-scaled against the most listened-to group, which scores 1', () => {
    const scores = toScores([row('a', 10), row('b', 1000), row('c', 0)]);
    assert.equal(scores.b, 1);
    assert.ok(scores.a > 0 && scores.a < scores.b);
    assert.equal(scores.c, 0);
    assert.ok(Math.abs(scores.a - Math.log1p(10) / Math.log1p(1000)) < 0.001);
});

test('unknown groups (null counts) score 0; nothing known at all gives null, and junk answers give null', () => {
    assert.equal(toScores([row('a', 5), row('b', null)]).b, 0);
    assert.equal(toScores([row('a', null), row('b', null)]), null);
    for (const junk of [null, undefined, {}, 'x', [], [null], [{}]]) assert.equal(toScores(junk), null);
});

test('the request is the documented POST: release_group_mbids, once each, at most 50', async () => {
    const seen = [];
    const post = async (url, body) => { seen.push([url, body]); return body.release_group_mbids.map((id) => row(id, 5)); };
    const ids = ['a', 'b', 'a', '', null, 5, ...Array.from({ length: 80 }, (_, i) => `g${i}`)];
    const scores = await fetchPopularity(ids, { post });
    assert.equal(seen.length, 1);
    assert.equal(seen[0][0], URL_RELEASE_GROUP);
    assert.equal(seen[0][1].release_group_mbids.length, 50);
    assert.deepEqual(seen[0][1].release_group_mbids.slice(0, 3), ['a', 'b', 'g0']);
    assert.equal(scores.a, 1);
});

test('no ids means no request; any failure means null instead of an error', async () => {
    let calls = 0;
    assert.equal(await fetchPopularity([], { post: async () => { calls += 1; } }), null);
    assert.equal(await fetchPopularity(undefined, { post: async () => { calls += 1; } }), null);
    assert.equal(calls, 0);
    assert.equal(await fetchPopularity(['a'], { post: async () => { throw new Error('offline'); } }), null);
    assert.equal(await fetchPopularity(['a'], { post: async () => 'not json rows' }), null);
});

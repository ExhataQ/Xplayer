'use strict';

// electron/release-rank.js: the "original release" rule, with releases shaped like electron/online-metadata.js returns them.
// Run: node --test tools/tests/release-rank.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pickRelease, rankReleases, fileKinds } = require('../../electron/release-rank');

const rel = (id, title, date, extra = {}) => ({ id, title, date, releaseGroupId: `g-${id}`, status: 'Official', primaryType: 'Album', secondaryTypes: [], recordingScore: 100, ...extra });

test('the earliest official album wins over a later compilation and a later reissue of another album', () => {
    const pick = pickRelease([
        rel('c', 'Greatest Hits', '2005', { secondaryTypes: ['Compilation'] }),
        rel('a', 'The Album', '1999'),
        rel('b', 'Second Album', '2003')
    ], { file: { title: 'Song', album: '' } });
    assert.equal(pick.best.id, 'a');
    assert.ok(pick.ranked.findIndex((r) => r.id === 'c') > pick.ranked.findIndex((r) => r.id === 'b'), 'the compilation ranks below a normal album');
    assert.match(pick.best.reasons.join(' '), /earliest/);
});

test('an album beats an earlier single, and a bootleg or promo never wins on date alone', () => {
    const pick = pickRelease([
        rel('s', 'Song (single)', '1998', { primaryType: 'Single' }),
        rel('a', 'The Album', '1999'),
        rel('b', 'Bootleg', '1990', { status: 'Bootleg' }),
        rel('p', 'Promo', '1991', { status: 'Promotion' })
    ]);
    assert.equal(pick.best.id, 'a');
});

test('releases of one release group count once (reissues and regional editions)', () => {
    const ranked = rankReleases([
        rel('a1', 'The Album', '1999', { releaseGroupId: 'G' }),
        rel('a2', 'The Album (Deluxe)', '2009', { releaseGroupId: 'G' }),
        rel('a3', 'The Album', '1999-05', { releaseGroupId: 'G', country: 'JP' })
    ]);
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].id, 'a1');
});

test('a compilation or live release is allowed only when the file is one', () => {
    const live = rel('l', 'Live in Berlin', '2004', { secondaryTypes: ['Live'] });
    const studio = rel('a', 'The Album', '2001');
    assert.equal(pickRelease([live, studio], { file: { title: 'Song', album: 'The Album' } }).best.id, 'a');
    assert.equal(pickRelease([live, studio], { file: { title: 'Song (Live)', album: 'Live in Berlin' } }).best.id, 'a', 'earlier studio album still ranks first by date');
    assert.ok(fileKinds({ title: 'Song (Live at Wembley)' }).has('live'));
    const comp = rel('c', 'Best Of', '2008', { secondaryTypes: ['Compilation'] });
    const onlyComp = pickRelease([comp], { file: { title: 'Song', album: 'Best Of' } });
    assert.match(onlyComp.best.reasons.join(' '), /file is one/);
});

test('confidence: clear winner is auto, two close albums go to review, weak recording match goes to review, nothing is none', () => {
    const clear = pickRelease([rel('a', 'A', '1999'), rel('c', 'Hits', '2010', { secondaryTypes: ['Compilation'] })]);
    assert.equal(clear.decision, 'auto');
    const close = pickRelease([rel('a', 'A', '2000'), rel('b', 'B', '2001')]);
    assert.equal(close.decision, 'review');
    const weak = pickRelease([rel('a', 'A', '1999', { recordingScore: 60 }), rel('c', 'Hits', '2010', { secondaryTypes: ['Compilation'] })]);
    assert.equal(weak.decision, 'review');
    const none = pickRelease([]);
    assert.deepEqual([none.decision, none.confidence, none.best], ['none', 0, null]);
});

test('no date is a weak signal, not a crash', () => {
    const pick = pickRelease([rel('a', 'A', ''), rel('b', 'B', '2001')]);
    assert.equal(pick.best.id, 'b');
});

test('"popular" uses the popularity signal when there is one and falls back to "original" when there is none', () => {
    const list = [rel('a', 'First', '1999'), rel('b', 'Hit Album', '2003')];
    assert.equal(pickRelease(list, { rule: 'popular' }).best.id, 'a', 'no signal: original rule');
    assert.equal(pickRelease(list, { rule: 'popular', popularity: { 'g-b': 0.95, 'g-a': 0.1 } }).best.id, 'b');
    assert.equal(pickRelease(list, { rule: 'original', popularity: { 'g-b': 0.95 } }).best.id, 'a', 'the original rule ignores popularity');
});

// ---- annotateSearch: the single-song editor's "original" marker (PD-04) ----
const { annotateSearch } = require('../../electron/release-rank');

test('annotateSearch (recording scope): each recording gets the ranked release, not just the earliest date', () => {
    const releases = [
        { id: 'comp', title: 'Greatest Hits', date: '1985', releaseGroupId: 'g1', status: 'Official', primaryType: 'Album', secondaryTypes: ['Compilation'] },
        { id: 'orig', title: 'The Album', date: '1990', releaseGroupId: 'g2', status: 'Official', primaryType: 'Album', secondaryTypes: [] }
    ];
    const answer = { success: true, results: [{ id: 'r1', title: 'Song', score: 100, releases }, { id: 'r2', title: 'Empty', releases: [] }] };
    const out = annotateSearch(answer, { title: 'Song', album: '', scope: 'recording' });
    assert.equal(out.results[0].recommendedReleaseId, 'orig');
    assert.ok(out.results[0].recommendedConfidence > 0);
    assert.equal('recommendedReleaseId' in out.results[1], false);
    assert.equal('recommendedReleaseId' in answer.results[0], false, 'the answer passed in (possibly cached) is not changed');
});

test('annotateSearch (release scope): the answer says which release is the likely original', () => {
    const results = [
        { id: 'live', title: 'Live', date: '1980', releaseGroupId: 'g1', status: 'Official', primaryType: 'Album', secondaryTypes: ['Live'] },
        { id: 'orig', title: 'The Album', date: '1982', releaseGroupId: 'g2', status: 'Official', primaryType: 'Album', secondaryTypes: [] }
    ];
    const out = annotateSearch({ success: true, results }, { title: 'Song', album: '', scope: 'release' });
    assert.equal(out.recommended.id, 'orig');
    assert.ok(out.recommended.confidence > 0 && Array.isArray(out.recommended.reasons));
});

test('annotateSearch leaves failures and empty answers alone', () => {
    const failed = { success: false, error: 'x' };
    assert.equal(annotateSearch(failed, {}), failed);
    assert.deepEqual(annotateSearch({ success: true, results: [] }, { scope: 'release' }), { success: true, results: [] });
    assert.equal(annotateSearch(undefined, {}), undefined);
});

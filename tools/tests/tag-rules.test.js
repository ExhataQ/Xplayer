'use strict';

// electron/tag-rules.js: which tags the Node backend keeps, writes and clears, on in-memory models (no library, no files).
// Run: node --test tools/tests/tag-rules.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readMetadata, applyPatch } = require('../../electron/tag-rules');
const { id3Model, vorbisModel, mp4Model, sampleId3 } = require('./helpers/fake-tag-models');

const keys = (m) => new Set(m.state.frames.map((f) => f.key));
const text = (m, key) => m.get(key).join('|');

test('read: artists are not split on commas, the user comment ignores iTunes frames', () => {
    const r = readMetadata('id3', sampleId3());
    assert.deepEqual(r.artist, ['Earth, Wind & Fire']);
    assert.equal(r.comment, 'my comment');
    assert.equal(r.title, 'Old title');
    assert.equal(r.track, '7'); assert.equal(r.trackTotal, '13');
    assert.equal(r.label, 'EMI');
});

test('read: every field is present, multi fields are lists, and a semicolon separates values', () => {
    const r = readMetadata('id3', id3Model([{ key: 'TCON', values: ['Rock; Pop'] }]));
    assert.deepEqual(r.genre, ['Rock', 'Pop']);
    assert.deepEqual(r.artist, []);
    assert.equal(r.title, '');
    assert.equal(r.cover, null);
    assert.ok('musicBrainzReleaseGroupId' in r && 'sortComposer' in r);
});

test('read: a comma is never a separator', () => {
    const r = readMetadata('id3', id3Model([{ key: 'TCON', values: ['Rock, Pop'] }, { key: 'TPE1', values: ['Tyler, The Creator'] }]));
    assert.deepEqual(r.genre, ['Rock, Pop']); assert.deepEqual(r.artist, ['Tyler, The Creator']);
});

test('read: other tags lists unknown frames, not the known ones', () => {
    const m = id3Model([{ key: 'TIT2', values: ['x'] }, { key: 'TXXX:replaygain', values: ['-7 dB'] }, { key: 'TXXX:GROUPING', values: ['g'] }, { key: 'TKEY', values: ['Am'] }]);
    assert.deepEqual(readMetadata('id3', m).otherTags.map((t) => t.key), ['TKEY', 'TXXX:replaygain']);
});

test('save: a patch changes only what was sent', () => {
    const m = sampleId3(); const before = keys(m);
    applyPatch('id3', m, { title: 'New title' });
    assert.equal(text(m, 'TIT2'), 'New title');
    assert.deepEqual(keys(m), before);
    assert.equal(text(m, 'TPE1'), 'Earth, Wind & Fire');
    assert.equal(m.comments().length, 2);
});

test('save: an artist list is written as it is, never split', () => {
    const m = sampleId3();
    applyPatch('id3', m, { artist: ['Earth, Wind & Fire'] }); assert.deepEqual(m.get('TPE1'), ['Earth, Wind & Fire']);
    applyPatch('id3', m, { artist: ['A', 'B', 'A', ' '] }); assert.deepEqual(m.get('TPE1'), ['A', 'B']);
});

test('save: an empty value clears only that field; Label is written to the Publisher frame', () => {
    const m = sampleId3();
    applyPatch('id3', m, { label: '' });
    assert.ok(!keys(m).has('TPUB')); assert.ok(keys(m).has('TCOP'));
    applyPatch('id3', m, { label: 'Parlophone' }); assert.equal(text(m, 'TPUB'), 'Parlophone');
    applyPatch('id3', m, { publisher: 'Odeon' }); assert.equal(text(m, 'TPUB'), 'Odeon');
});

test('save: track number and total keep the other half', () => {
    const m = sampleId3();
    applyPatch('id3', m, { track: '9' }); assert.equal(text(m, 'TRCK'), '9/13');
    applyPatch('id3', m, { trackTotal: '' }); assert.equal(text(m, 'TRCK'), '9');
    applyPatch('id3', m, { track: '' }); assert.ok(!keys(m).has('TRCK'));
});

test('save: a comment edit keeps the iTunes frames, clearing removes only the user comment', () => {
    const m = sampleId3();
    applyPatch('id3', m, { comment: 'edited' });
    assert.deepEqual(m.comments().map((c) => [c.desc, c.text]).sort(), [['', 'edited'], ['iTunNORM', '0000 00000A 000']]);
    applyPatch('id3', m, { comment: '' });
    assert.deepEqual(m.comments().map((c) => c.desc), ['iTunNORM']);
    applyPatch('id3', m, { comment: 'again' });
    assert.equal(readMetadata('id3', m).comment, 'again');
});

test('save: sort composer, and lyricist and writer use different frames', () => {
    const m = sampleId3();
    assert.deepEqual(applyPatch('id3', m, { sortComposer: 'White, Maurice' }), []);
    assert.equal(readMetadata('id3', m).sortComposer, 'White, Maurice');
    applyPatch('id3', m, { writer: 'Elton John' });
    const r = readMetadata('id3', m);
    assert.equal(r.lyricist, 'Freddie'); assert.equal(r.writer, 'Elton John');
    applyPatch('id3', m, { lyricist: 'Bernie Taupin' });
    assert.equal(text(m, 'TEXT'), 'Bernie Taupin'); assert.equal(text(m, 'TXXX:WRITER'), 'Elton John');
});

test('save: sort fields are written to both the sort frame and the custom frame', () => {
    const m = id3Model();
    applyPatch('id3', m, { sortTitle: 'T' });
    assert.equal(text(m, 'TSOT'), 'T'); assert.equal(text(m, 'TXXX:SORT_TITLE'), 'T');
});

test('save: keys that start with two underscores are not tags', () => {
    const m = id3Model();
    applyPatch('id3', m, { __coverPath: 'x.png', title: 'T' });
    assert.deepEqual([...keys(m)], ['TIT2']);
});

const vorbis = () => vorbisModel({ title: ['T'], label: ['EMI'], copyright: ['(c)'], artist: ['Earth, Wind & Fire'], replaygain_track_gain: ['-7 dB'] });

test('vorbis: clearing a field really clears it, untouched and unknown tags survive', () => {
    const m = vorbis();
    applyPatch('vorbis', m, { label: '' }); assert.ok(!('label' in m.state));
    applyPatch('vorbis', m, { title: 'New' });
    assert.deepEqual(m.state.title, ['New']);
    for (const k of ['copyright', 'artist', 'replaygain_track_gain']) assert.ok(k in m.state);
});

test('vorbis: a field the format cannot hold is reported, not dropped silently', () => {
    assert.deepEqual(applyPatch('vorbis', vorbis(), { mood: 'Happy', title: 'x' }), ['mood']);
});

test('vorbis: year is DATE, track and disc keep their totals, album artist reads either spelling', () => {
    const m = vorbisModel({ tracknumber: ['3/10'], 'album artist': ['Band'] });
    applyPatch('vorbis', m, { year: '1999', track: '4' });
    assert.deepEqual(m.state.date, ['1999']); assert.deepEqual(m.state.tracknumber, ['4/10']);
    assert.deepEqual(readMetadata('vorbis', m).albumArtist, ['Band']);
    assert.deepEqual(readMetadata('vorbis', m).otherTags, []);
});

test('vorbis: other tags excludes the known names in any case', () => {
    const m = vorbisModel({ TITLE: ['x'], REPLAYGAIN_TRACK_GAIN: ['-7 dB'] });
    assert.deepEqual(readMetadata('vorbis', m).otherTags, [{ key: 'replaygain_track_gain', values: ['-7 dB'] }]);
});

const NAM = '\u00a9nam', ART = '\u00a9ART', ALB = '\u00a9alb', DAY = '\u00a9day', GEN = '\u00a9gen', WRT = '\u00a9wrt';

test('mp4: the atoms are read into the fields, "n/total" atoms are split, a semicolon separates values', () => {
    const m = mp4Model({ [NAM]: ['Song'], [ART]: ['Earth, Wind & Fire'], [GEN]: ['Funk; Soul'], [DAY]: ['1977'], trkn: ['7/13'], disk: ['2'], tmpo: ['120'], cpil: ['1'], '----:MOOD': ['Calm'], '----:MusicBrainz Track Id': ['abc'], '\u00a9lyr': ['la la'] });
    const r = readMetadata('mp4', m);
    assert.equal(r.title, 'Song'); assert.deepEqual(r.artist, ['Earth, Wind & Fire']); assert.deepEqual(r.genre, ['Funk', 'Soul']);
    assert.equal(r.year, '1977'); assert.equal(r.track, '7'); assert.equal(r.trackTotal, '13'); assert.equal(r.discNumber, '2'); assert.equal(r.discTotal, '');
    assert.equal(r.bpm, '120'); assert.equal(r.compilation, '1'); assert.equal(r.mood, 'Calm'); assert.equal(r.musicBrainzTrackId, 'abc');
    assert.deepEqual(r.otherTags, [{ key: '\u00a9lyr', values: ['la la'] }], 'only the atoms the editor has no field for');
});

test('mp4: a patch changes only what was sent; several artists are one "; " text; an empty value clears', () => {
    const m = mp4Model({ [NAM]: ['Old'], [ALB]: ['Kept'], [ART]: ['X'], '----:MOOD': ['Calm'] });
    assert.deepEqual(applyPatch('mp4', m, { title: 'New', artist: ['A', 'B, C'], mood: '' }), []);
    assert.deepEqual(m.state[NAM], ['New']); assert.deepEqual(m.state[ART], ['A; B, C']);
    assert.deepEqual(m.state[ALB], ['Kept']); assert.ok(!('----:MOOD' in m.state));
    assert.deepEqual(readMetadata('mp4', m).artist, ['A', 'B, C']);
});

test('mp4: track and disc keep the other half; clearing both removes the atom; Label and Publisher are one atom', () => {
    const m = mp4Model({ trkn: ['7/13'], disk: ['1/2'] });
    applyPatch('mp4', m, { trackTotal: '20' });
    assert.deepEqual(m.state.trkn, ['7/20']);
    applyPatch('mp4', m, { track: '' });
    assert.deepEqual(m.state.trkn, ['/20']);
    applyPatch('mp4', m, { track: '', trackTotal: '' });
    assert.ok(!('trkn' in m.state));
    applyPatch('mp4', m, { discNumber: '3' });
    assert.deepEqual(m.state.disk, ['3/2']);
    applyPatch('mp4', m, { publisher: 'EMI' });
    assert.deepEqual(m.state['----:LABEL'], ['EMI']);
});

test('mp4: BPM and compilation are written as the numeric atoms, a field the format cannot hold is reported', () => {
    const m = mp4Model({});
    const skipped = applyPatch('mp4', m, { bpm: '98', compilation: '1', mediaKind: 'Music', __coverPath: 'x.png' });
    assert.deepEqual(m.state.tmpo, ['98']); assert.deepEqual(m.state.cpil, ['1']);
    assert.deepEqual(skipped, ['mediaKind']);
    applyPatch('mp4', m, { compilation: '0', bpm: '' });
    assert.ok(!('cpil' in m.state) && !('tmpo' in m.state));
});

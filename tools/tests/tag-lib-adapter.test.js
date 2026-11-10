'use strict';

// electron/tag-lib-adapter.js against a made-up library object: how the adapter behaves when the library answers in the ways its
// documentation allows (no tag could be created, a file flagged as corrupt, another spelling of an enum member). It cannot prove how
// the real package behaves; tag-parity.test.js does that.
// Run: node --test tools/tests/tag-lib-adapter.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openFile, AdapterError } = require('../../electron/tag-lib-adapter');

class Text { constructor() { this.text = []; } }
class Frames { }
function lib({ tagTypes = { Id3v2: 1, Xiph: 2, Id3v1: 8, Apple: 16 }, getTag = () => ({ frames: [], addFrame() {}, removeFrame() {} }), corrupt = false, saved = [], onDisk = 1, removed = [] } = {}) {
    return {
        TagTypes: tagTypes,
        Id3v2TextInformationFrame: Text, Id3v2UserTextInformationFrame: class extends Text {}, Id3v2CommentsFrame: Frames,
        Id3v2FrameIdentifiers: {}, StringType: { UTF8: 3 },
        ByteVector: { fromString: (text) => text },
        File: { createFromPath: () => ({ getTag, isPossiblyCorrupt: corrupt, corruptionReasons: ['bad header'], tag: { pictures: [] }, tagTypesOnDisk: onDisk, removeTags: (t) => removed.push(t), save: () => saved.push(1), dispose() {} }) }
    };
}
const open = (library, file = 'a.mp3') => openFile(file, { library: async () => library });

test('a tag that cannot be created is "unsupported", not a crash', async () => {
    await assert.rejects(open(lib({ getTag: () => undefined })), (e) => e instanceof AdapterError && /ID3v2 tag/.test(e.message));
    await assert.rejects(open(lib({ getTag: () => undefined }), 'a.flac'), (e) => e instanceof AdapterError && /Xiph/.test(e.message));
});

test('both spellings of the ID3v2 tag type are accepted, and one that is missing is reported', async () => {
    assert.equal((await open(lib({ tagTypes: { ID3v2: 1, Xiph: 2 } }))).kind, 'id3');
    assert.equal((await open(lib({ tagTypes: { Id3v2: 1, Xiph: 2 } }))).kind, 'id3');
    await assert.rejects(open(lib({ tagTypes: { Xiph: 2 } })), (e) => e instanceof AdapterError);
});

test('a file the library marks as possibly corrupt is not written, and the reason is given', async () => {
    const saved = [];
    const handle = await open(lib({ corrupt: true, saved }));
    assert.throws(() => handle.save(), (e) => e instanceof AdapterError && /bad header/.test(e.message));
    assert.deepEqual(saved, []);
    const fine = [];
    (await open(lib({ saved: fine }))).save();
    assert.deepEqual(fine, [1]);
});

test('file types that are not handled answer "unsupported" without touching the tags', async () => {
    const handle = await open(lib({ getTag: () => { throw new Error('must not be called'); } }), 'a.wma');
    assert.equal(handle.kind, 'unsupported');
    assert.equal(handle.model, null);
});

test('an m4a file opens as an MP4 file and its atoms go through the library calls', async () => {
    const atoms = {};
    const tag = {
        track: 0, trackCount: 0, disc: 0, discCount: 0, beatsPerMinute: 0, isCompilation: false, genres: [],
        getQuickTimeStrings: (key) => atoms[key] || [], setQuickTimeStrings: (key, v) => { if (v) atoms[key] = v; else delete atoms[key]; },
        getItunesStrings: (mean, name) => atoms[`${mean}:${name}`] || [], setItunesStrings: (mean, name, ...v) => { if (v.length) atoms[`${mean}:${name}`] = v; else delete atoms[`${mean}:${name}`]; },
        _ilstBox: { children: [] }
    };
    const handle = await open(lib({ getTag: () => tag }), 'a.M4A');
    assert.equal(handle.kind, 'mp4');
    handle.model.set('\u00a9nam', ['Song']); assert.deepEqual(handle.model.get('\u00a9nam'), ['Song']);
    handle.model.set('trkn', ['7/13']); assert.deepEqual([tag.track, tag.trackCount], [7, 13]); assert.deepEqual(handle.model.get('trkn'), ['7/13']);
    handle.model.set('trkn', []); assert.deepEqual(handle.model.get('trkn'), []);
    handle.model.set('----:MOOD', ['Calm']); assert.deepEqual(handle.model.get('----:MOOD'), ['Calm']);
    handle.model.set('cpil', ['1']); assert.equal(tag.isCompilation, true);
    handle.model.del('cpil'); assert.equal(tag.isCompilation, false);
    assert.throws(() => handle.model.set('trkn', ['x']), /must be a number/);
    assert.throws(() => handle.model.set('tmpo', ['fast']), /BPM must be/);
    assert.throws(() => handle.model.set('trkn', ['70000']), /too large/);
});

test('an MP3 that had no ID3v1 tag does not get one on save; one that had it keeps it; other files are not touched', async () => {
    const run = async (file, onDisk) => { const removed = []; const h = await open(lib({ onDisk, removed }), file); h.save(); return removed; };
    assert.deepEqual(await run('a.mp3', 4), [8]);
    assert.deepEqual(await run('a.mp3', 4 | 8), []);
    assert.deepEqual(await run('a.wav', 4), []);
    assert.deepEqual(await run('a.flac', 0), []);
});

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
function lib({ tagTypes = { Id3v2: 1, Xiph: 2 }, getTag = () => ({ frames: [], addFrame() {}, removeFrame() {} }), corrupt = false, saved = [] } = {}) {
    return {
        TagTypes: tagTypes,
        Id3v2TextInformationFrame: Text, Id3v2UserTextInformationFrame: class extends Text {}, Id3v2CommentsFrame: Frames,
        Id3v2FrameIdentifiers: {}, StringType: { UTF8: 3 },
        File: { createFromPath: () => ({ getTag, isPossiblyCorrupt: corrupt, corruptionReasons: ['bad header'], tag: { pictures: [] }, save: () => saved.push(1), dispose() {} }) }
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
    const handle = await open(lib({ getTag: () => { throw new Error('must not be called'); } }), 'a.m4a');
    assert.equal(handle.kind, 'unsupported');
    assert.equal(handle.model, null);
});

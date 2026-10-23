'use strict';

// electron/tag-service.js with a fake backend: no Python, no audio files.
// Run: node --test tools/tests/tag-service.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTagService } = require('../../electron/tag-service');

function fakeBackend(files) {
    const calls = [];
    return {
        calls,
        getAudioMetadata: async (url) => (files[url] ? { success: true, metadata: { ...files[url] } } : { success: false, error: 'Failed to read metadata' }),
        saveAudioMetadata: async (url, metadata) => {
            calls.push(['save', url, metadata]);
            if (url === 'file:///bad.mp3') return { success: false, error: 'disk full' };
            files[url] = { ...files[url], ...metadata };
            return { success: true, metadata: { ...files[url] } };
        }
    };
}

test('read and write pass through to the backend', async () => {
    const backend = fakeBackend({ 'file:///a.mp3': { title: 'A' } });
    const tags = createTagService(backend);
    assert.deepEqual((await tags.read('file:///a.mp3')).metadata, { title: 'A' });
    assert.equal((await tags.write('file:///a.mp3', { title: 'B' })).metadata.title, 'B');
});

test('writeMany returns the previous values of every written file', async () => {
    const backend = fakeBackend({ 'file:///a.mp3': { genre: ['Rock'] }, 'file:///b.mp3': { genre: [] } });
    const results = await createTagService(backend).writeMany([
        { fileUrl: 'file:///a.mp3', metadata: { genre: ['Rock', 'Pop'] } },
        { fileUrl: 'file:///b.mp3', metadata: { genre: ['Pop'] } }
    ]);
    assert.deepEqual(results.map((r) => r.success), [true, true]);
    assert.deepEqual(results[0].previous, { genre: ['Rock'] });
    assert.deepEqual(results[1].metadata, { genre: ['Pop'] });
});

test('writeMany keeps going after a failure and never writes a file it could not read', async () => {
    const backend = fakeBackend({ 'file:///bad.mp3': { title: 'x' }, 'file:///ok.mp3': { title: 'y' } });
    const results = await createTagService(backend).writeMany([
        { fileUrl: 'file:///missing.mp3', metadata: { title: 'z' } },
        { fileUrl: 'file:///bad.mp3', metadata: { title: 'z' } },
        { fileUrl: 'file:///ok.mp3', metadata: { title: 'z' } }
    ]);
    assert.deepEqual(results.map((r) => r.success), [false, false, true]);
    assert.equal(results[1].error, 'disk full');
    assert.deepEqual(backend.calls.map((c) => c[1]), ['file:///bad.mp3', 'file:///ok.mp3']);
});

test('writeMany with nothing to do returns an empty list', async () => {
    assert.deepEqual(await createTagService(fakeBackend({})).writeMany(undefined), []);
});

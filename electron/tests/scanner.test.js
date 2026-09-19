const test = require('node:test');
const assert = require('node:assert/strict');
const { extractJsonArray, extractJsonObject, mergeAppend, mergePrepend } = require('../scanner');

test('mergeAppend keeps existing songs first and assigns new ids', () => {
    const existing = [{ id: 0, url: 'file:///a.mp3' }];
    const incoming = [{ id: 99, url: 'file:///b.mp3' }];
    const result = mergeAppend(existing, incoming);
    assert.deepStrictEqual(result.songs, [
        { id: 0, url: 'file:///a.mp3' },
        { id: 1, url: 'file:///b.mp3' }
    ]);
    assert.deepStrictEqual(result.newSongs, [{ id: 1, url: 'file:///b.mp3' }]);
    assert.deepStrictEqual(existing, [{ id: 0, url: 'file:///a.mp3' }]);
    assert.deepStrictEqual(incoming, [{ id: 99, url: 'file:///b.mp3' }]);
});

test('mergePrepend puts new songs before existing songs', () => {
    const existing = [{ id: 0, url: 'file:///a.mp3' }, { id: 1, url: 'file:///b.mp3' }];
    const incoming = [{ url: 'file:///c.mp3' }];
    const result = mergePrepend(existing, incoming);
    assert.deepStrictEqual(result.songs.map((song) => song.url), [
        'file:///c.mp3', 'file:///a.mp3', 'file:///b.mp3'
    ]);
    assert.equal(result.newSongs[0].id, 2);
});

test('merge functions skip songs whose urls already exist', () => {
    const existing = [{ id: 0, url: 'file:///a.mp3' }];
    const incoming = [{ url: 'file:///a.mp3' }, { url: 'file:///b.mp3' }];
    const result = mergeAppend(existing, incoming);
    assert.deepStrictEqual(result.songs.map((song) => song.url), [
        'file:///a.mp3', 'file:///b.mp3'
    ]);
});

test('merge functions return null for empty incoming data', () => {
    assert.equal(mergeAppend([], []), null);
    assert.equal(mergePrepend([], null), null);
});

test('extractJsonArray isolates an array from scanner output', () => {
    const raw = 'Scanning songs |██| 50%\n[{"id":1,"url":"file:///a.mp3"}]\n';
    assert.deepStrictEqual(extractJsonArray(raw), [{ id: 1, url: 'file:///a.mp3' }]);
});

test('extractJsonObject isolates an object from scanner output', () => {
    const raw = 'progress\n{"success":true,"songs":[{"id":1}]}\n';
    assert.deepStrictEqual(extractJsonObject(raw), { success: true, songs: [{ id: 1 }] });
});

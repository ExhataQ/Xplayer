const test = require('node:test');
const assert = require('node:assert/strict');
const { isDuplicateFolder, removeFolder, computeFolderSongCount } = require('../../electron/music-folders');

test('isDuplicateFolder compares paths case-insensitively', () => {
    assert.equal(isDuplicateFolder(['C:\\Music'], 'c:\\music'), true);
    assert.equal(isDuplicateFolder(['C:\\Music'], 'C:\\Other'), false);
});

test('removeFolder removes the normalized target folder', () => {
    const folders = ['C:\\Music', 'C:\\Other'];
    assert.deepStrictEqual(removeFolder(folders, 'C:/Music'), ['C:\\Other']);
    assert.deepStrictEqual(folders, ['C:\\Music', 'C:\\Other']);
});

test('computeFolderSongCount counts songs inside the folder but not sibling prefixes', () => {
    const songs = [
        { url: 'file:///C:/Music/a.mp3' },
        { url: 'file:///C:/Music/Sub/b.mp3' },
        { url: 'file:///C:/Music-other/c.mp3' }
    ];
    assert.equal(computeFolderSongCount('C:\\Music', songs), 2);
});

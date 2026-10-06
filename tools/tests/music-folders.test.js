const test = require('node:test');
const assert = require('node:assert/strict');
const { isDuplicateFolder, removeFolder, computeFolderSongCount, normalizeFolderPath, addMusicFolder, getMusicFolders } = require('../../electron/music-folders');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

// The scanner builds song.url as 'file:///' + the Windows path with "/" separators and no
// percent-encoding (tag-builder.js), so spaces, "%" and non-Latin letters appear as they are.
test('computeFolderSongCount matches song urls exactly as the scanner writes them', () => {
    const songs = [
        { url: 'file:///D:/My Music/Be Bop 100%/a b.mp3' },
        { url: 'file:///D:/My Music/نغمه/c.mp3' },
        { url: 'file:///D:/My Music 2/d.mp3' },
        { url: 'file://///server/share/Music/e.mp3' }
    ];
    assert.equal(computeFolderSongCount('D:\\My Music', songs), 2);
    assert.equal(computeFolderSongCount('d:\\my music\\', songs), 2);
    assert.equal(computeFolderSongCount('\\\\server\\share\\Music', songs), 1);
    assert.equal(computeFolderSongCount('D:\\', songs), 3);
});

test('a network folder keeps its two leading backslashes, doubled escapes are still collapsed', () => {
    assert.equal(normalizeFolderPath('\\\\server\\share\\Music'), '\\\\server\\share\\Music');
    assert.equal(normalizeFolderPath('C:\\\\Music\\\\Sub'), 'C:\\Music\\Sub');
    assert.equal(normalizeFolderPath('\\\\\\\\server\\\\share'), '\\\\server\\share');
    const config = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mf-')), 'cfg.json');
    assert.equal(addMusicFolder(config, '\\\\server\\share\\Music').success, true);
    assert.deepStrictEqual(getMusicFolders(config), ['\\\\server\\share\\Music']);
    assert.equal(addMusicFolder(config, '\\\\SERVER\\share\\music').reason, 'duplicate');
});

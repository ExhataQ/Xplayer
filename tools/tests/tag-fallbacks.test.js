// Missing tags (task PM-01): what the scan saves when a file has no title, artist or album, and how a tag edit clears the note.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const { buildSongFromTags, refreshMissingTags, TAG_BUILD_PROFILES, SCAN_FORMAT } = require('../../electron/tag-builder');

const file = path.join(os.tmpdir(), 'Downloads', 'New folder', '03 - Some Song.mp3');
const build = (common, profile = TAG_BUILD_PROFILES.FAST) =>
    buildSongFromTags({ filePath: file, metadata: common === null ? null : { common, format: { duration: 100 }, native: null }, coversFolder: path.join(os.tmpdir(), 'c'), profile, fileStat: null });

test('a file with no tags: the title is the file name, artist and album are empty, all three are listed as missing', async () => {
    const song = await build({});
    assert.equal(song.title, '03 - Some Song');
    assert.equal(song.artist, '');
    assert.equal(song.album, '');
    assert.deepEqual(song.missingTags, ['title', 'artist', 'album']);
});

test('the folder name is never used as the album, for any scan profile', async () => {
    for (const profile of Object.values(TAG_BUILD_PROFILES)) {
        const song = await build({ title: 'T', artist: 'A' }, profile);
        assert.equal(song.album, '');
        assert.deepEqual(song.missingTags, ['album']);
    }
});

test('a file that could not be parsed at all is listed with all three missing', async () => {
    const song = await build(null);
    assert.deepEqual(song.missingTags, ['title', 'artist', 'album']);
});

test('a tag that is only spaces counts as missing', async () => {
    const song = await build({ title: '  ', artist: ' \t ', album: 'Real Album' });
    assert.equal(song.title, '03 - Some Song');
    assert.deepEqual(song.missingTags, ['title', 'artist']);
});

test('a complete file has no missingTags field', async () => {
    const song = await build({ title: 'T', artist: 'A', album: 'B' });
    assert.equal('missingTags' in song, false);
    assert.equal(song.album, 'B');
});

test('refreshMissingTags drops what the edit filled in, keeps the rest, and removes the field when nothing is left', () => {
    const song = { missingTags: ['title', 'artist', 'album'] };
    refreshMissingTags(song, { artist: 'New Artist', album: '' });
    assert.deepEqual(song.missingTags, ['title', 'album']);
    refreshMissingTags(song, { title: 'New Title', album: 'New Album' });
    assert.equal('missingTags' in song, false);
    assert.doesNotThrow(() => refreshMissingTags({}, { artist: 'x' }));
    assert.doesNotThrow(() => refreshMissingTags(null, {}));
});

test('the scan format is 2 or higher, so libraries saved with the old fallbacks are read again once', () => {
    assert.ok(SCAN_FORMAT >= 2);
});

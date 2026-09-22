// Regression tests for the tag-mangling bugs in electron/scan-folder.js:
// - titles were cut at 50 characters, artist/genre/composer/albumArtist at 30
// - every " and ' was stripped from every text field
// The fix keeps the full value from the tag; the UI is responsible for shortening it
// visually (CSS ellipsis) if it doesn't fit. These tests make sure that stays true.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const {
    sanitizeString,
    extractAllNativeTags,
    extractExtendedMetadata,
    scanSingleFile,
    scanMultipleFiles
} = require('../../electron/scan-folder');

// --- sanitizeString --------------------------------------------------------

test('sanitizeString keeps quotes and apostrophes', () => {
    assert.equal(sanitizeString(`Don't Stop Me Now`), `Don't Stop Me Now`);
    assert.equal(sanitizeString(`"Weird Al" Yankovic`), `"Weird Al" Yankovic`);
});

test('sanitizeString does not truncate long values', () => {
    const long = 'A'.repeat(200);
    assert.equal(sanitizeString(long), long);
});

test('sanitizeString still strips control characters and trims whitespace', () => {
    assert.equal(sanitizeString('  Hello\x00World\x1F  '), 'HelloWorld');
});

test('sanitizeString returns an empty string for empty/falsy input', () => {
    assert.equal(sanitizeString(''), '');
    assert.equal(sanitizeString(null), '');
    assert.equal(sanitizeString(undefined), '');
});

// --- extractAllNativeTags (fallback path when music-metadata's `common` misses a field) ---

test('extractAllNativeTags keeps a long composer/genre from native frames', () => {
    const longComposer = 'A'.repeat(45);
    const result = extractAllNativeTags({
        ID3v2: [
            { id: 'TCOM', value: longComposer },
            { id: 'TCON', value: 'Progressive Rock' }
        ]
    });
    assert.equal(result.composer, longComposer);
    assert.equal(result.genre, 'Progressive Rock');
});

test('extractExtendedMetadata keeps a long album artist from a native TPE2 frame', () => {
    const longAlbumArtist = 'B'.repeat(45);
    const result = extractExtendedMetadata({}, {}, {
        ID3v2: [{ id: 'TPE2', value: longAlbumArtist }]
    });
    assert.equal(result.albumArtist, longAlbumArtist);
});

test('extractAllNativeTags strips a leading genre code like ID3 used to store it', () => {
    const result = extractAllNativeTags({ ID3v1: [{ id: 'TCON', value: '(17)Rock' }] });
    assert.equal(result.genre, 'Rock');
});

// --- extractExtendedMetadata ------------------------------------------------

test('extractExtendedMetadata keeps a long album artist from common.albumartist', () => {
    const long = 'The Some Really Long Collaborating Album Artist Name';
    const result = extractExtendedMetadata({ albumartist: long }, {}, null);
    assert.equal(result.albumArtist, long);
});

// --- scanSingleFile (full pipeline, mocked music-metadata) ------------------

function mockMetadata({ title, artist, album, genre, composer, albumartist }) {
    return {
        common: { title, artist, album, genre, composer, albumartist, picture: null },
        format: { duration: 200 },
        native: null
    };
}

test('scanSingleFile keeps full title/artist/album/genre/composer/albumArtist and their punctuation', async () => {
    const longTitle = 'A Song Title That Is Considerably Longer Than Fifty Characters Long';
    const longArtist = `Earth, Wind & Fire feat. "The Guys" and Don't Stop`;
    const longAlbum = 'A Really Long Album Name That Used To Get Cut At Thirty Characters';
    const longGenre = 'Progressive Alternative Indie Rock Fusion';
    const longComposer = 'Maurice White, Philip Bailey and a Whole Lot of Other People';
    const longAlbumArtist = "Earth, Wind & Fire's Full Touring Collective";

    const mm = {
        parseFile: async () => mockMetadata({
            title: longTitle,
            artist: longArtist,
            album: longAlbum,
            genre: longGenre,
            composer: longComposer,
            albumartist: longAlbumArtist
        })
    };

    const filePath = path.join(os.tmpdir(), 'fake-folder', 'fake-song.mp3');
    const coversFolder = path.join(os.tmpdir(), 'fake-covers');
    const song = await scanSingleFile(filePath, coversFolder, mm);

    assert.equal(song.title, longTitle);
    assert.equal(song.artist, longArtist);
    assert.equal(song.album, longAlbum);
    assert.equal(song.genre, longGenre);
    assert.equal(song.composer, longComposer);
    assert.equal(song.albumArtist, longAlbumArtist);
    assert.ok(song.title.length > 50, 'title should not have been cut at 50 chars');
    assert.ok(song.artist.length > 30, 'artist should not have been cut at 30 chars');
});

test('scanMultipleFiles falls back to filename/"Unknown Artist" when tags are missing, without truncating the filename', async () => {
    const mm = { parseFile: async () => { throw new Error('no tags'); } };
    const os2 = require('os');
    const longName = 'A'.repeat(80);
    const filePath = path.join(os2.tmpdir(), `${longName}.mp3`);
    require('fs').closeSync(require('fs').openSync(filePath, 'w'));
    try {
        const songs = await scanMultipleFiles([filePath], path.join(os2.tmpdir(), 'fake-covers'), mm);
        assert.equal(songs.length, 1);
        assert.equal(songs[0].title, longName);
        assert.equal(songs[0].artist, 'Unknown Artist');
    } finally {
        require('fs').unlinkSync(filePath);
    }
});

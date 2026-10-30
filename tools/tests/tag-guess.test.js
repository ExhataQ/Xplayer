// Offline tag suggestions (task PM-02): file name, folder layout and neighbouring songs. Pure functions, no files read.
const test = require('node:test');
const assert = require('node:assert/strict');
const { guessTags, cleanName, stripTrackNumber, foldersBelowRoot, consensus } = require('../../electron/tag-guess');

const roots = ['D:\\Music'];
const values = (guess) => Object.fromEntries(Object.entries(guess).map(([k, v]) => [k, v.value]));

test('Artist/Album/03 - Title: folders give artist and album, the file name gives title and track', () => {
    const g = guessTags('D:\\Music\\Queen\\A Night at the Opera\\03 - Love of My Life.mp3', { roots });
    assert.deepEqual(values(g), { track: '3', title: 'Love of My Life', artist: 'Queen', album: 'A Night at the Opera' });
    assert.equal(g.artist.from, 'folders');
    assert.equal(g.artist.confidence, 'high');
});

test('year and CD folders: "1975 - Album" gives the year, a CD1 folder is skipped, disc-track "1-04" gives track 4', () => {
    const g = guessTags('D:\\Music\\Queen\\1975 - A Night at the Opera\\CD1\\1-04 Bohemian Rhapsody.flac', { roots });
    assert.deepEqual(values(g), { track: '4', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', year: '1975' });
});

test('"Artist - Album (1979)" in the artist\'s folder drops the repeated artist', () => {
    const g = guessTags('D:\\Music\\Pink Floyd\\Pink Floyd - The Wall (1979)\\05 Another Brick in the Wall.mp3', { roots });
    assert.equal(g.album.value, 'The Wall');
    assert.equal(g.year.value, '1979');
});

test('a downloads folder is never an artist or an album; the file name still gives artist and title', () => {
    const g = guessTags('D:\\Music\\Downloads\\Daft Punk - Get Lucky (Official Audio).mp3', { roots });
    assert.deepEqual(values(g), { artist: 'Daft Punk', title: 'Get Lucky' });
    assert.equal(g.artist.from, 'filename');
    assert.equal(g.artist.confidence, 'medium');
});

test('one folder level is not enough to call the folder an artist or an album', () => {
    const g = guessTags('D:\\Music\\Some Folder\\Just A Title.mp3', { roots });
    assert.deepEqual(values(g), { title: 'Just A Title' });
});

test('"Title - Artist" inside the artist\'s own folder is swapped, with high confidence', () => {
    const g = guessTags('D:\\Music\\Adele\\Hello - Adele.mp3', { roots });
    assert.deepEqual(values(g), { artist: 'Adele', title: 'Hello' });
    assert.equal(g.artist.confidence, 'high');
});

test('three parts cannot be decided from the name: low confidence', () => {
    const g = guessTags('D:\\Music\\Mix\\Foo - Bar - Baz.mp3', { roots });
    assert.equal(g.artist.confidence, 'low');
    assert.equal(g.title.value, 'Bar - Baz');
});

test('"99 Problems" keeps its number; "01 Song", "1. Song" and "(07) Song" lose theirs', () => {
    assert.equal(stripTrackNumber('99 Problems').rest, '99 Problems');
    assert.deepEqual(stripTrackNumber('01 Song'), { track: '1', disc: '', rest: 'Song' });
    assert.equal(stripTrackNumber('1. Song').rest, 'Song');
    assert.equal(stripTrackNumber('(07) Song').track, '7');
    assert.equal(stripTrackNumber('1-03 Song').disc, '1');
});

test('cleanName removes video ids, site tags and "(Official Video)", and keeps real parts of a title', () => {
    assert.equal(cleanName('Rick Astley - Never Gonna Give You Up [dQw4w9WgXcQ]'), 'Rick Astley - Never Gonna Give You Up');
    assert.equal(cleanName('Song (Official Video)'), 'Song');
    assert.equal(cleanName('Song [HD]'), 'Song');
    assert.equal(cleanName('Song [www.site.com]'), 'Song');
    assert.equal(cleanName('Song (Remix)'), 'Song (Remix)');
    assert.equal(cleanName('Song [Remastered]'), 'Song [Remastered]');
    assert.equal(cleanName('Artist_-_Some_Song_(live)'), 'Artist - Some Song (live)');
});

test('neighbouring songs that agree give the album of an untagged file, with high confidence', () => {
    const siblings = [{ album: 'Blue', artist: 'Joni' }, { album: 'Blue', artist: 'Joni' }, { album: 'Blue', artist: 'Joni' }];
    const g = guessTags('D:\\Music\\Mixed\\track.mp3', { roots, siblings });
    assert.equal(g.album.value, 'Blue');
    assert.equal(g.album.from, 'siblings');
    assert.equal(g.artist.value, 'Joni');
});

test('siblings that disagree, or only one sibling, suggest nothing', () => {
    assert.equal(consensus(['A', 'B', 'C']), '');
    assert.equal(consensus(['A']), '');
    assert.equal(consensus(['A', 'A', 'B']), '', '2 of 3 is under 75%');
    assert.equal(consensus(['A', 'A', 'A', 'B']), 'A');
});

test('a tag the song already has is never suggested again', () => {
    const g = guessTags('D:\\Music\\Queen\\A Night at the Opera\\03 - Love of My Life.mp3', { roots, have: { artist: 'Someone Else', title: 'Kept' } });
    assert.equal('artist' in g, false);
    assert.equal('title' in g, false);
    assert.equal(g.album.value, 'A Night at the Opera');
});

test('foldersBelowRoot: longest matching root, case-insensitive, either slash; null when under no root', () => {
    assert.deepEqual(foldersBelowRoot('d:/music/Queen/Album/x.mp3', ['D:\\Music']), ['Queen', 'Album']);
    assert.deepEqual(foldersBelowRoot('D:\\Music\\Rock\\Queen\\x.mp3', ['D:\\Music', 'D:\\Music\\Rock']), ['Queen']);
    assert.equal(foldersBelowRoot('E:\\Other\\x.mp3', ['D:\\Music']), null);
});

test('posix paths work too', () => {
    const g = guessTags('/home/me/Music/Queen/A Night at the Opera/03 - Love of My Life.mp3', { roots: ['/home/me/Music'] });
    assert.equal(g.artist.value, 'Queen');
    assert.equal(g.album.value, 'A Night at the Opera');
});

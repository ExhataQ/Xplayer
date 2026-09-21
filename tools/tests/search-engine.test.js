// Tests for src/js/03b-search-engine.js (the one search/rank/filter function used everywhere).
// Pure logic: runs in Node, no browser needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadEngine(activeSongs = []) {
    const source = fs.readFileSync(path.join(__dirname, '../../src/js/03b-search-engine.js'), 'utf8');
    const context = { console, WeakMap, Number, Array, String, Math, parseInt, getActiveSongs: () => activeSongs };
    vm.createContext(context);
    vm.runInContext(source, context);
    return context;
}
const titles = (list) => Array.from(list, (s) => s.title);
const { searchSongs, normalizeSearchText, getSearchResults } = loadEngine();

test('normalization ignores case, accents, apostrophes and extra spaces', () => {
    assert.equal(normalizeSearchText('  Beyoncé   KNOWLES '), 'beyonce knowles');
    assert.equal(normalizeSearchText("Don’t Stop"), 'dont stop');
    assert.equal(normalizeSearchText(undefined), '');
    assert.equal(normalizeSearchText(null), '');
});

test('accents and apostrophes never hide a match (also titles the scanner stored without quotes)', () => {
    const songs = [{ title: 'Halo', artist: 'Beyoncé' }, { title: "Don't Stop Me Now" }, { title: 'Dont Stop Believin' }];
    assert.deepEqual(titles(searchSongs(songs, 'beyonce')), ['Halo']);
    assert.deepEqual(titles(searchSongs(songs, "don't")).sort(), ["Don't Stop Me Now", 'Dont Stop Believin'].sort());
    assert.deepEqual(titles(searchSongs(songs, 'dont stop')).length, 2);
});

test('every word of the query must match, in any field ("queen jazz" finds the album Jazz by Queen)', () => {
    const songs = [
        { title: 'Fat Bottomed Girls', artist: 'Queen', album: 'Jazz' },
        { title: 'Song', artist: 'Queen', album: 'Innuendo' },
        { title: 'Other', artist: 'Someone', album: 'Jazz' }
    ];
    assert.deepEqual(titles(searchSongs(songs, 'queen jazz')), ['Fat Bottomed Girls']);
});

test('best matches come first: exact title, then prefix, then word start, then anywhere', () => {
    const songs = [
        { title: 'X', artist: 'Y', album: 'Best of Love' },
        { title: 'Glove' },
        { title: 'A Love Story' },
        { title: 'Loveless' },
        { title: 'Love' }
    ];
    assert.deepEqual(titles(searchSongs(songs, 'love')), ['Love', 'Loveless', 'A Love Story', 'Glove', 'X']);
});

test('a title match beats an artist match for the same word', () => {
    const songs = [{ title: 'Other', artist: 'Queen' }, { title: 'Queen of Hearts', artist: 'Someone' }];
    assert.deepEqual(titles(searchSongs(songs, 'queen')), ['Queen of Hearts', 'Other']);
});

test('equal scores keep the original order (stable)', () => {
    const songs = ['b', 'a', 'c'].map((t, i) => ({ title: `${t} song`, id: i }));
    assert.deepEqual(titles(searchSongs(songs, 'song')), ['b song', 'a song', 'c song']);
});

test('rank:false keeps the list order (used when filtering an album or playlist)', () => {
    const songs = [{ title: 'zz love' }, { title: 'Love' }];
    assert.deepEqual(titles(searchSongs(songs, 'love', { rank: false })), ['zz love', 'Love']);
});

test('songs with missing fields never throw', () => {
    assert.deepEqual(Array.from(searchSongs([{}, { title: null, artist: undefined }, { title: 'ok' }], 'ok')).length, 1);
    assert.deepEqual(Array.from(searchSongs(undefined, 'x')), []);
});

test('an empty or blank query returns every song as a new array', () => {
    const songs = [{ title: 'a' }, { title: 'b' }];
    for (const q of ['', '   ', undefined]) {
        const out = searchSongs(songs, q);
        assert.equal(out.length, 2);
        assert.notEqual(out, songs, 'must be a copy so callers can sort it safely');
    }
});

test('edited metadata is picked up (the per-song cache does not go stale)', () => {
    const song = { title: 'Old name' };
    assert.equal(searchSongs([song], 'old').length, 1);
    song.title = 'New name';
    assert.equal(searchSongs([song], 'old').length, 0);
    assert.equal(searchSongs([song], 'new').length, 1);
});

test('filters: artist, album, genre, year range and duration range', () => {
    const songs = [
        { title: 'a', artist: 'Queen', album: 'Jazz', genre: 'Rock, Pop', year: '1978', duration: 200 },
        { title: 'b', artist: 'queen', album: 'Innuendo', genre: 'Rock', year: '1991-02-05', duration: 400 },
        { title: 'c', artist: 'Beyoncé', album: 'Lemonade', genre: 'R&B', year: 2016, duration: 250 },
        { title: 'd', artist: 'Nobody', album: '', genre: '', year: '', duration: undefined }
    ];
    assert.deepEqual(titles(searchSongs(songs, '', { filters: { artist: 'QUEEN' } })), ['a', 'b']);
    assert.deepEqual(titles(searchSongs(songs, '', { filters: { artist: ['beyonce', 'nobody'] } })), ['c', 'd']);
    assert.deepEqual(titles(searchSongs(songs, '', { filters: { album: 'jazz' } })), ['a']);
    assert.deepEqual(titles(searchSongs(songs, '', { filters: { genre: 'pop' } })), ['a']);
    assert.deepEqual(titles(searchSongs(songs, '', { filters: { genre: 'rock' } })), ['a', 'b']);
    assert.deepEqual(titles(searchSongs(songs, '', { filters: { yearFrom: 1980, yearTo: 2000 } })), ['b']);
    assert.deepEqual(titles(searchSongs(songs, '', { filters: { minDuration: 220, maxDuration: 300 } })), ['c']);
    assert.deepEqual(titles(searchSongs(songs, 'queen', { filters: { yearFrom: 1990 } })), ['b'], 'query and filters combine');
});

test('getSearchResults only searches songs that are still in the library', () => {
    const engine = loadEngine([{ title: 'kept song' }]);
    assert.deepEqual(titles(engine.getSearchResults('song')), ['kept song']);
});

test('searching a large library stays fast', () => {
    const songs = Array.from({ length: 5000 }, (_, i) => ({ title: `Track ${i}`, artist: `Artist ${i % 200}`, album: `Album ${i % 300}` }));
    searchSongs(songs, 'track 4'); // warm the per-song cache
    const start = process.hrtime.bigint();
    const results = searchSongs(songs, 'artist 7 track');
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    assert.ok(results.length > 0);
    assert.ok(ms < 500, `took ${ms.toFixed(0)} ms`);
});

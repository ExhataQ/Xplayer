'use strict';

// electron/tag-finder.js: the multi tag finder core (task PD-05), with both MusicBrainz calls replaced by fakes.
// Run: node --test tools/tests/tag-finder.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTagFinder, compareTags, MAX_CONSECUTIVE_ERRORS } = require('../../electron/tag-finder');

const rel = (id, title, date, extra = {}) => ({ id, title, date, releaseGroupId: `g-${id}`, status: 'Official', primaryType: 'Album', secondaryTypes: [], recordingScore: 100, ...extra });
const song = (id, tags = {}) => ({ id, fileUrl: `file:///music/${id}.mp3`, tags: { title: `Song ${id}`, artist: ['The Band'], album: '', genre: [], year: '', ...tags } });
const online = { album: 'The Album', albumArtist: ['The Band'], year: '1999', genre: ['Rock'], label: 'Label', musicBrainzTrackId: 'rec-1', musicBrainzAlbumId: 'a', musicBrainzOriginalAlbumId: 'a' };

// One clear album: confidence 0.9, 'auto'. Two close albums: 0.68, 'review'.
const CLEAR = [rel('a', 'The Album', '1999')];
const AMBIGUOUS = [rel('a', 'The Album', '1999'), rel('b', 'Second Album', '2003')];

function fakes({ releases = CLEAR, metadata = online, onSearch, onGet } = {}) {
    const calls = { search: [], get: [] };
    let running = 0;
    let most = 0;
    const guard = async (fn) => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setImmediate(resolve));
        try { return await fn(); } finally { running -= 1; }
    };
    return {
        calls,
        most: () => most,
        deps: {
            search: (query) => guard(async () => { calls.search.push(query); if (onSearch) return onSearch(query); return { success: true, results: typeof releases === 'function' ? releases(query) : releases }; }),
            getMetadata: (query) => guard(async () => { calls.get.push(query); if (onGet) return onGet(query); return { success: true, metadata }; })
        }
    };
}

test('a clear single album is auto; only changed tags are in the patch, and title and artist never are', async () => {
    const f = fakes();
    const out = await createTagFinder(f.deps).findOne(song('1', { genre: ['Pop'] }));
    assert.equal(out.decision, 'auto');
    assert.equal(out.confidence, 0.9);
    assert.deepEqual(out.release, { id: 'a', title: 'The Album', date: '1999', releaseGroupId: 'g-a' });
    assert.equal(out.patch.album, 'The Album');
    assert.deepEqual(out.patch.genre, ['Rock']);
    assert.deepEqual(out.changes.genre, { from: ['Pop'], to: ['Rock'] });
    assert.ok(!('title' in out.patch) && !('artist' in out.patch));
});

test('two close albums are not sure enough: the decision is review, and the patch is still there for the person to look at', async () => {
    const out = await createTagFinder(fakes({ releases: AMBIGUOUS }).deps).findOne(song('1'));
    assert.equal(out.decision, 'review');
    assert.ok(out.confidence >= 0.5 && out.confidence < 0.85, String(out.confidence));
    assert.ok(Object.keys(out.patch).length > 0);
});

test('the threshold is the caller\'s: the same answer is auto at 0.85 and review at 0.99', async () => {
    const finder = createTagFinder(fakes().deps);
    assert.equal((await finder.findOne(song('1'))).decision, 'auto');
    assert.equal((await finder.findOne(song('1'), { autoThreshold: 0.99 })).decision, 'review');
});

test('a song with no title asks nothing; no releases or a hopeless match gives none', async () => {
    const f = fakes();
    const finder = createTagFinder(f.deps);
    const untitled = await finder.findOne(song('1', { title: '  ' }));
    assert.equal(untitled.decision, 'none');
    assert.equal(f.calls.search.length, 0, 'no request is made for it');
    const empty = await createTagFinder(fakes({ releases: [] }).deps).findOne(song('2'));
    assert.equal(empty.decision, 'none');
    assert.deepEqual(empty.patch, {});
    const bootleg = await createTagFinder(fakes({ releases: [rel('x', 'Bootleg', '1990', { status: 'Bootleg', primaryType: 'Other' })] }).deps).findOne(song('3'));
    assert.notEqual(bootleg.decision, 'auto');
});

test('a song that already has these tags is unchanged (case and genre order do not matter)', async () => {
    const f = fakes({ metadata: { ...online, genre: ['Rock', 'Pop'] } });
    const same = song('1', { album: 'the album', albumArtist: ['the band'], year: '1999', genre: ['pop', 'ROCK'], label: 'label', musicBrainzTrackId: 'rec-1', musicBrainzAlbumId: 'a', musicBrainzOriginalAlbumId: 'a' });
    assert.equal((await createTagFinder(f.deps).findOne(same)).decision, 'unchanged');
    const differs = song('2', { ...same.tags, genre: ['Pop'] });
    assert.equal((await createTagFinder(f.deps).findOne(differs)).decision, 'auto', 'a genre that is missing is a real difference');
});

test('an empty value from MusicBrainz never erases a tag', () => {
    const { patch, changes } = compareTags({ album: 'Keep', genre: ['Jazz'], year: '2001' }, { album: '', genre: [], year: '  ', label: 'New' });
    assert.deepEqual(patch, { label: 'New' });
    assert.deepEqual(Object.keys(changes), ['label']);
});

test('multi-value text splits on ";" only; a comma stays inside a name', () => {
    const { patch } = compareTags({ genre: [] }, { genre: 'Rock; Pop', albumArtist: 'Crosby, Stills & Nash' });
    assert.deepEqual(patch.genre, ['Rock', 'Pop']);
    assert.deepEqual(patch.albumArtist, ['Crosby, Stills & Nash']);
});

test('the search and the fetch get what they need: first artist, the chosen release, the song title, and no cover download', async () => {
    const f = fakes();
    await createTagFinder(f.deps).findOne(song('7', { artist: ['First', 'Second'], album: 'Hint', duration: 200 }));
    assert.deepEqual(f.calls.search[0], { fileUrl: 'file:///music/7.mp3', title: 'Song 7', artist: 'First', album: 'Hint', duration: 200, scope: 'release' });
    assert.deepEqual(f.calls.get[0], { fileUrl: 'file:///music/7.mp3', releaseId: 'a', title: 'Song 7', skipCover: true });
});

test('findMany goes one song at a time, in order, and reports progress and a summary', async () => {
    const f = fakes({ releases: (q) => (q.title === 'Song 2' ? AMBIGUOUS : q.title === 'Song 3' ? [] : CLEAR) });
    const seen = [];
    const run = await createTagFinder(f.deps).findMany([song('1'), song('2'), song('3'), song('4', { title: '' })], { onProgress: (p) => seen.push([p.done, p.total, p.result.decision]) });
    assert.equal(f.most(), 1, 'never two requests at once');
    assert.deepEqual(seen, [[1, 4, 'auto'], [2, 4, 'review'], [3, 4, 'none'], [4, 4, 'none']]);
    assert.deepEqual(run.summary, { total: 4, processed: 4, auto: 1, review: 1, none: 2, unchanged: 0, error: 0 });
    assert.deepEqual(run.results.map((r) => r.id), ['1', '2', '3', '4']);
    assert.equal(run.cancelled, false);
    assert.equal(run.stopped, null);
});

test('one song failing does not stop the run', async () => {
    const f = fakes({ onGet: (q) => { if (q.title === 'Song 2') throw new Error('No track in that release matches this song\'s title.'); return { success: true, metadata: online }; } });
    const run = await createTagFinder(f.deps).findMany([song('1'), song('2'), song('3')]);
    assert.deepEqual(run.results.map((r) => r.decision), ['auto', 'error', 'auto']);
    assert.match(run.results[1].error, /No track/);
    assert.equal(run.summary.error, 1);
    assert.equal(run.stopped, null);
});

test('a fatal error stops the run at once and says why; the songs after it are not touched', async () => {
    const f = fakes({ onSearch: () => { throw Object.assign(new Error('Refused to contact untrusted host x'), { fatal: true }); } });
    const run = await createTagFinder(f.deps).findMany([song('1'), song('2'), song('3')]);
    assert.equal(run.stopped, 'fatal');
    assert.match(run.message, /untrusted host/);
    assert.equal(run.results.length, 1);
    assert.equal(f.calls.search.length, 1);
});

test(`${MAX_CONSECUTIVE_ERRORS} failures in a row stop the run as offline; a success in between resets the count`, async () => {
    const down = fakes({ onSearch: () => { throw new Error('getaddrinfo ENOTFOUND'); } });
    const songs = Array.from({ length: 10 }, (_, i) => song(String(i)));
    const run = await createTagFinder(down.deps).findMany(songs);
    assert.equal(run.stopped, 'offline');
    assert.equal(run.results.length, MAX_CONSECUTIVE_ERRORS);
    assert.equal(down.calls.search.length, MAX_CONSECUTIVE_ERRORS, 'the other songs never spend retries');

    let n = 0;
    const flaky = fakes({ onSearch: () => { n += 1; if (n % 3 !== 0) throw new Error('timeout'); return { success: true, results: CLEAR }; } });
    const ok = await createTagFinder(flaky.deps).findMany(songs, { maxConsecutiveErrors: 3 });
    assert.equal(ok.stopped, null, 'two failures then a success never reaches three in a row');
    assert.equal(ok.results.length, 10);
});

test('cancel is checked before every song; what was done is kept', async () => {
    const f = fakes();
    let done = 0;
    const run = await createTagFinder(f.deps).findMany([song('1'), song('2'), song('3'), song('4')], { shouldCancel: () => done >= 2, onProgress: () => { done += 1; } });
    assert.equal(run.cancelled, true);
    assert.equal(run.results.length, 2);
    assert.equal(run.summary.processed, 2);
});

test('an empty or missing list is a finished run, not an error', async () => {
    const finder = createTagFinder(fakes().deps);
    assert.deepEqual((await finder.findMany([])).summary, { total: 0, processed: 0, auto: 0, review: 0, none: 0, unchanged: 0, error: 0 });
    assert.equal((await finder.findMany(null)).results.length, 0);
});

test('the finder has no way to write: it exports no save or apply function and its source never touches a file', () => {
    const source = require('fs').readFileSync(require.resolve('../../electron/tag-finder'), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/writeFile|writeMany|saveAudioMetadata|\.write\(|fs\./.test(source));
    assert.deepEqual(Object.keys(require('../../electron/tag-finder')).sort(), ['DEFAULT_FIELDS', 'MAX_CONSECUTIVE_ERRORS', 'compareTags', 'createTagFinder']);
});

// Tests for electron/online-metadata.js cover-art download, with the network mocked (no real requests).
// Models what the Cover Art Archive really does: 307 redirects to archive.org and http:// image URLs.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const https = require('https');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'onlinemeta-'));
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === 'electron') return { app: { getPath: () => userData } };
    return originalLoad.call(this, request, ...rest);
};
after(() => fs.rmSync(userData, { recursive: true, force: true }));

// ---- mocked network -------------------------------------------------------------------------
let routes = {};
let calls = [];
https.get = function (url, opts, callback) {
    const target = String(url);
    calls.push(target);
    const req = new EventEmitter();
    req.destroy = (err) => setImmediate(() => req.emit('error', err || new Error('destroyed')));
    setImmediate(() => {
        let spec = routes[target];
        if (Array.isArray(spec)) spec = spec.length > 1 ? spec.shift() : spec[0]; // sequence of responses
        if (!spec) spec = { status: 404, body: '' };
        const res = new EventEmitter();
        res.statusCode = spec.status;
        res.headers = spec.headers || {};
        res.resume = () => {};
        callback(res);
        const raw = spec.body === undefined ? '' : spec.body; // redirects have no body
        const body = Buffer.isBuffer(raw) ? raw : Buffer.from(typeof raw === 'string' ? raw : JSON.stringify(raw));
        const mid = Math.floor(body.length / 2);
        res.emit('data', body.subarray(0, mid)); // two chunks: the body must be re-assembled correctly
        res.emit('data', body.subarray(mid));
        res.emit('end');
    });
    return req;
};

const { getOnlineMetadata } = require('../../electron/online-metadata.js');

const REC = '11111111-1111-1111-1111-111111111111';
const REL = '22222222-2222-2222-2222-222222222222';
const MB_REC = `https://musicbrainz.org/ws/2/recording/${REC}?inc=artist-credits%2Breleases%2Bgenres%2Btags%2Bisrcs&fmt=json`;
const MB_REL = `https://musicbrainz.org/ws/2/release/${REL}?inc=artist-credits%2Blabels%2Brecordings%2Brelease-groups%2Bgenres%2Btags&fmt=json`;
const CAA = `https://coverartarchive.org/release/${REL}`;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);

function musicBrainzRoutes() {
    return {
        [MB_REC]: { status: 200, body: { id: REC, title: 'Song', length: 200000, 'artist-credit': [{ name: 'Artist', joinphrase: '', artist: { id: 'a1', name: 'Artist', 'sort-name': 'Artist' } }], releases: [{ id: REL, title: 'Album', date: '2000' }], genres: [], tags: [] } },
        [MB_REL]: { status: 200, body: { id: REL, title: 'Album', date: '2000', 'artist-credit': [{ name: 'Artist', joinphrase: '' }], 'label-info': [], 'release-group': { id: 'rg' }, media: [{ position: 1, tracks: [{ position: 1, title: 'Song', recording: { id: REC } }] }] } }
    };
}
const run = () => getOnlineMetadata({ fileUrl: 'file:///a.mp3', recordingId: REC, releaseId: REL, title: 'Song' });
const cacheFiles = () => fs.readdirSync(path.join(userData, 'metadata-cache')).filter((f) => f.includes('-cover'));

test('follows the Cover Art Archive redirects, upgrades http:// image links and downloads the 1200px thumbnail', async () => {
    calls = [];
    routes = {
        ...musicBrainzRoutes(),
        [CAA]: { status: 307, headers: { location: 'https://archive.org/download/mbid-x/index.json' } },
        'https://archive.org/download/mbid-x/index.json': { status: 200, body: { images: [{ front: true, image: `http://coverartarchive.org/release/${REL}/1.jpg`, thumbnails: { '1200': `http://coverartarchive.org/release/${REL}/1-1200.jpg`, large: 'http://coverartarchive.org/x-500.jpg' } }] } },
        [`https://coverartarchive.org/release/${REL}/1-1200.jpg`]: { status: 307, headers: { location: 'https://ia800000.us.archive.org/1/items/mbid-x/mbid-x-1-1200.jpg' } },
        'https://ia800000.us.archive.org/1/items/mbid-x/mbid-x-1-1200.jpg': { status: 200, headers: { 'content-type': 'application/octet-stream' }, body: JPEG }
    };
    const r = await run();
    assert.equal(r.success, true);
    assert.equal(r.coverStatus, 'downloaded');
    assert.ok(r.coverPath.endsWith('.jpg') && fs.existsSync(r.coverPath));
    assert.deepEqual(fs.readFileSync(r.coverPath), JPEG, 'downloaded bytes must match exactly');
    assert.equal(calls.some((u) => u.startsWith('http://')), false, 'never make a plain http request');
    assert.equal(calls.some((u) => u.endsWith('/1.jpg')), false, 'the huge original must not be downloaded when a 1200px thumbnail exists');
});

test('a release without cover art reports "none" and still returns the metadata', async () => {
    calls = [];
    routes = { ...musicBrainzRoutes(), [CAA]: { status: 404, body: '' } };
    const r = await run();
    assert.equal(r.success, true);
    assert.equal(r.coverStatus, 'none');
    assert.equal(r.coverPath, '');
    assert.equal(r.metadata.title, 'Song');
});

test('a redirect to an untrusted host is refused, reported as failed, and metadata still returns', async () => {
    calls = [];
    routes = { ...musicBrainzRoutes(), [CAA]: { status: 307, headers: { location: 'https://evil.example.com/steal.json' } } };
    const r = await run();
    assert.equal(r.success, true);
    assert.equal(r.coverStatus, 'failed');
    assert.match(r.coverError, /untrusted host/i);
    assert.equal(calls.some((u) => u.includes('evil.example.com')), false, 'must not even contact the untrusted host');
    assert.equal(r.metadata.title, 'Song');
});

test('a redirect loop stops after a few hops without retrying', async () => {
    calls = [];
    routes = { ...musicBrainzRoutes(), [CAA]: { status: 307, headers: { location: CAA } } };
    const r = await run();
    assert.equal(r.coverStatus, 'failed');
    assert.match(r.coverError, /too many redirects/i);
    assert.ok(calls.filter((u) => u === CAA).length <= 6, `expected one bounded attempt, got ${calls.filter((u) => u === CAA).length} requests`);
});

test('a non-image response is rejected and nothing is saved as the cover', async () => {
    calls = [];
    for (const f of cacheFiles()) fs.unlinkSync(path.join(userData, 'metadata-cache', f));
    routes = {
        ...musicBrainzRoutes(),
        [CAA]: { status: 200, body: { images: [{ front: true, thumbnails: { '1200': `https://coverartarchive.org/release/${REL}/2-1200.jpg` } }] } },
        [`https://coverartarchive.org/release/${REL}/2-1200.jpg`]: { status: 200, headers: { 'content-type': 'image/jpeg' }, body: '<html>Service unavailable</html>' }
    };
    const r = await run();
    assert.equal(r.coverStatus, 'failed');
    assert.match(r.coverError, /not an image/i);
    assert.equal(r.coverPath, '');
    assert.deepEqual(cacheFiles(), [], 'no bogus cover file may be written');
});

test('a transient 503 while downloading is retried and then succeeds', async () => {
    calls = [];
    const img = `https://coverartarchive.org/release/${REL}/3-1200.jpg`;
    routes = {
        ...musicBrainzRoutes(),
        [CAA]: { status: 200, body: { images: [{ front: true, thumbnails: { '1200': img } }] } },
        [img]: [{ status: 503, headers: { 'retry-after': '0' }, body: '' }, { status: 200, body: JPEG }]
    };
    const r = await run();
    assert.equal(r.coverStatus, 'downloaded');
    assert.equal(calls.filter((u) => u === img).length, 2, 'expected exactly one retry');
});

test('a new cover with a different image type replaces the old file instead of leaving a stale one', async () => {
    calls = [];
    const png = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(40, 1)]);
    const img = `https://coverartarchive.org/release/${REL}/4-1200.png`;
    routes = { ...musicBrainzRoutes(), [CAA]: { status: 200, body: { images: [{ front: true, thumbnails: { '1200': img } }] } }, [img]: { status: 200, body: png } };
    const r = await run();
    assert.equal(r.coverStatus, 'downloaded');
    assert.ok(r.coverPath.endsWith('.png'));
    assert.deepEqual(cacheFiles().map((f) => path.extname(f)), ['.png'], 'the older .jpg cover for this file must be gone');
});

// ---- artist-credit handling -------------------------------------------------------------------
// MusicBrainz's artist-credit is a list of the individually credited artists. The importer used
// to throw that list away and re-split the human-readable joined text on commas instead, which
// broke any single artist whose own name contains a comma (e.g. "Earth, Wind & Fire").

test('a single credited artist whose name contains a comma is imported as one artist, not split on the comma', async () => {
    calls = [];
    routes = {
        ...musicBrainzRoutes(),
        [MB_REC]: {
            status: 200,
            body: {
                id: REC, title: 'September', length: 200000,
                'artist-credit': [{ name: 'Earth, Wind & Fire', joinphrase: '', artist: { id: 'a1', name: 'Earth, Wind & Fire', 'sort-name': 'Earth, Wind & Fire' } }],
                releases: [{ id: REL, title: 'Album', date: '2000' }], genres: [], tags: []
            }
        }
    };
    const r = await run();
    assert.deepEqual(r.metadata.artist, ['Earth, Wind & Fire']);
});

test('two genuinely separate credited artists are imported as two artists', async () => {
    calls = [];
    routes = {
        ...musicBrainzRoutes(),
        [MB_REC]: {
            status: 200,
            body: {
                id: REC, title: 'Under Pressure', length: 200000,
                'artist-credit': [
                    { name: 'Queen', joinphrase: ' & ', artist: { id: 'a1', name: 'Queen' } },
                    { name: 'David Bowie', joinphrase: '', artist: { id: 'a2', name: 'David Bowie' } }
                ],
                releases: [{ id: REL, title: 'Album', date: '1981' }], genres: [], tags: []
            }
        }
    };
    const r = await run();
    assert.deepEqual(r.metadata.artist, ['Queen', 'David Bowie']);
    assert.equal(r.metadata.sortArtist, 'Queen & David Bowie', 'the joined display text is unaffected, only how it gets split into artists');
});

// ---- release-only import (no recordingId, just a release + this song's title) ------------------

function releaseOnlyRoutes(tracks) {
    return {
        [MB_REL_ONLY]: {
            status: 200,
            body: {
                id: REL, title: 'Album', date: '2000',
                'artist-credit': [{ name: 'Artist', joinphrase: '' }], 'label-info': [], 'release-group': { id: 'rg' },
                media: [{ position: 1, tracks }]
            }
        },
        [MB_REC]: musicBrainzRoutes()[MB_REC],
        [MB_REL]: musicBrainzRoutes()[MB_REL]
    };
}
const MB_REL_ONLY = `https://musicbrainz.org/ws/2/release/${REL}?inc=artist-credits%2Brecordings%2Blabels%2Brelease-groups&fmt=json`;
const runReleaseOnly = (title) => getOnlineMetadata({ fileUrl: 'file:///a.mp3', releaseId: REL, title });

test('release-only import picks the track whose title matches this song', async () => {
    calls = [];
    routes = releaseOnlyRoutes([
        { position: 1, title: 'Wrong Song', recording: { id: '33333333-3333-3333-3333-333333333333' } },
        { position: 2, title: 'Song', recording: { id: REC } }
    ]);
    const r = await runReleaseOnly('Song');
    assert.equal(r.success, true);
    assert.equal(r.metadata.title, 'Song');
});

test('release-only import refuses to fall back to track 1 when no track title matches', async () => {
    calls = [];
    routes = releaseOnlyRoutes([
        { position: 1, title: 'Wrong Song', recording: { id: '33333333-3333-3333-3333-333333333333' } },
        { position: 2, title: 'Also Wrong', recording: { id: '44444444-4444-4444-4444-444444444444' } }
    ]);
    await assert.rejects(() => runReleaseOnly('Song That Is Not In This Release'), /no track in that release matches/i);
});

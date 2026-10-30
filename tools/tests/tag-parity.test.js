'use strict';

// The REAL tag writer on REAL files (task PD-08, decision DP7): the Node backend (node-taglib-sharp) is run on copies of the files in
// tools/tests/fixtures/audio, compared with what it should leave behind, with an independent reader (music-metadata, ffprobe) and
// with the Python backend (mutagen), which is the behaviour the Node backend has to match.
//
// Needs: the package `node-taglib-sharp` (npm install node-taglib-sharp); for the parity tests also Python with `mutagen`
// (python -m pip install mutagen). Without them the tests are SKIPPED and say why. In CI set XPLAYER_REQUIRE_REAL_TAGS=1: a missing
// piece is then a FAILURE, so these tests can never be skipped without anyone noticing.
// Run: node --test tools/tests/tag-parity.test.js

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { createNodeBackend } = require('../../electron/tag-node-backend');
const { createPythonRunner } = require('../../electron/metadata-editor');
const { loadLibrary } = require('../../electron/tag-lib-adapter');
const { ALL_FIELDS } = require('../../electron/tag-rules');

const REQUIRE_REAL = process.env.XPLAYER_REQUIRE_REAL_TAGS === '1';
const FIX = path.join(__dirname, 'fixtures', 'audio');
const NAMES = ['tone.mp3', 'tone.flac', 'tone.ogg', 'tone.opus', 'tone.wav'];
const TAGGED = new Set(['tone.mp3', 'tone.flac', 'tone.ogg', 'tone.opus']); // tone.wav has no tags until the first save
const COVER = path.join(FIX, 'cover.png');
const PATCH = { title: 'Ünïcode Títle ✓', artist: ['A', 'B, C'], genre: ['Rock', 'Pop'], track: '3', trackTotal: '9', comment: 'new comment', year: '2001' };

let work, haveLib = false, haveMutagen = false, python, node, musicMetadata = null;
const toPath = (u) => u;
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });

before(async () => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-parity-'));
    try { await loadLibrary(); haveLib = true; } catch (e) { haveLib = false; }
    for (const cmd of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
        const r = run(cmd, [...(cmd === 'py' ? ['-3'] : []), '-c', 'import mutagen']);
        if (!r.error && r.status === 0) { haveMutagen = true; break; }
    }
    try { musicMetadata = await import('music-metadata'); } catch (e) { musicMetadata = null; }
    node = createNodeBackend({ toPath });
    python = createPythonRunner();
});
after(() => fs.rmSync(work, { recursive: true, force: true }));

function need(t, ok, why) {
    if (ok) return true;
    if (REQUIRE_REAL) assert.fail(`${why} (XPLAYER_REQUIRE_REAL_TAGS=1, so this may not be skipped)`);
    t.skip(why);
    return false;
}
const hasLib = (t) => need(t, haveLib, 'node-taglib-sharp is not installed (npm install node-taglib-sharp)');
const hasBoth = (t) => hasLib(t) && need(t, haveMutagen, 'Python with mutagen is not available (python -m pip install mutagen)');
let n = 0;
function copyOf(name) { const dir = path.join(work, String(++n)); fs.mkdirSync(dir); const p = path.join(dir, name); fs.copyFileSync(path.join(FIX, name), p); return p; }
const pyRead = (p) => python({ action: 'read', path: p });
const pySave = (p, metadata, coverPath = '') => python({ action: 'save', path: p, metadata, coverPath });
const duration = (p) => { const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', p]); return r.status === 0 ? Number(r.stdout) : null; };
// What must be equal between the two backends: every tag except the cover bytes; year by its first four characters.
function comparable(meta) {
    const o = {};
    for (const f of ALL_FIELDS) o[f] = f === 'year' ? String(meta[f] || '').slice(0, 4) : meta[f];
    o.otherTags = (meta.otherTags || []).map((t) => ({ key: t.key.toLowerCase(), values: t.values })).sort((a, b) => (a.key < b.key ? -1 : 1));
    return o;
}

for (const name of NAMES) {
    test(`${name}: the Node backend reads the tags the file was made with`, async (t) => {
        if (!hasLib(t)) return;
        const r = await node.getAudioMetadata(path.join(FIX, name));
        assert.equal(r.success, true, r.error);
        if (!TAGGED.has(name)) return assert.equal(r.metadata.title, '');
        assert.equal(r.metadata.title, 'Fixture Song');
        assert.deepEqual(r.metadata.artist, ['Earth, Wind & Fire']);
        assert.equal(r.metadata.album, 'Fixture Album');
        assert.deepEqual(r.metadata.genre, ['Funk']);
        assert.equal(r.metadata.comment, 'fixture comment');
    });

    test(`${name}: a save is read back from the file, by Node and by an independent reader, and the audio is intact`, async (t) => {
        if (!hasLib(t)) return;
        const p = copyOf(name);
        const length = duration(p);
        const saved = await node.saveAudioMetadata(p, { ...PATCH });
        assert.equal(saved.success, true, saved.error);
        const again = await node.getAudioMetadata(p);
        for (const key of ['title', 'comment', 'track', 'trackTotal']) assert.equal(again.metadata[key], saved.metadata[key]);
        assert.equal(again.metadata.title, PATCH.title);
        assert.deepEqual(again.metadata.artist, ['A', 'B, C']);
        assert.deepEqual(again.metadata.genre, ['Rock', 'Pop']);
        assert.equal(again.metadata.track, '3'); assert.equal(again.metadata.trackTotal, '9');
        if (musicMetadata) {
            const common = (await musicMetadata.parseFile(p)).common;
            assert.equal(common.title, PATCH.title);
            assert.ok((common.artists || [common.artist]).join('|').includes('B, C'), 'the comma inside a name is kept');
            assert.equal(common.track.no, 3);
        }
        if (length !== null) assert.ok(Math.abs(duration(p) - length) < 0.06, 'the audio length did not change');
    });

    test(`${name}: clearing a tag clears only that tag, and a second save keeps everything else`, async (t) => {
        if (!hasLib(t)) return;
        const p = copyOf(name);
        assert.equal((await node.saveAudioMetadata(p, { title: 'One', album: 'Kept' })).success, true);
        const cleared = await node.saveAudioMetadata(p, { comment: '' });
        assert.equal(cleared.success, true, cleared.error);
        assert.equal(cleared.metadata.comment, '');
        assert.equal(cleared.metadata.title, 'One'); assert.equal(cleared.metadata.album, 'Kept');
    });

    if (name !== 'tone.wav') test(`${name}: the cover is saved, read back, and the tags stay`, async (t) => {
        if (!hasLib(t)) return;
        const p = copyOf(name);
        const r = await node.saveAudioCover(p, COVER);
        assert.equal(r.success, true, r.error);
        assert.equal(r.metadata.cover.data, fs.readFileSync(COVER).toString('base64'));
        assert.equal(r.metadata.title, 'Fixture Song');
    });

    test(`${name}: parity: the Node backend reads what the Python backend reads`, async (t) => {
        if (!hasBoth(t)) return;
        const p = path.join(FIX, name);
        const [a, b] = [await node.getAudioMetadata(p), await pyRead(p)];
        assert.equal(a.success, true, a.error); assert.equal(b.success, true, b.error);
        assert.deepEqual(comparable(a.metadata), comparable(b.metadata));
    });

    test(`${name}: parity: both backends leave the same tags after the same save`, async (t) => {
        if (!hasBoth(t)) return;
        const [pn, pp] = [copyOf(name), copyOf(name)];
        const a = await node.saveAudioMetadata(pn, { ...PATCH });
        const b = await pySave(pp, { ...PATCH });
        assert.equal(a.success, true, a.error); assert.equal(b.success, true, b.error);
        // Read both results with the SAME reader (mutagen), so only what was written differs.
        const [ra, rb] = [await pyRead(pn), await pyRead(pp)];
        assert.deepEqual(comparable(ra.metadata), comparable(rb.metadata));
    });
}

test('a file that is not audio is refused and left as it was', async (t) => {
    if (!hasLib(t)) return;
    const p = path.join(work, 'fake.mp3');
    fs.writeFileSync(p, 'not audio at all');
    const r = await node.saveAudioMetadata(p, { title: 'x' });
    assert.equal(r.success, false);
    assert.equal(fs.readFileSync(p, 'utf8'), 'not audio at all');
});

test('the service answers through the real backend for a file URL', async (t) => {
    if (!hasLib(t)) return;
    const { createTagService } = require('../../electron/tag-service');
    const real = createNodeBackend({ toPath: (u) => require('url').fileURLToPath(u) });
    const p = copyOf('tone.mp3');
    const out = await createTagService(real).writeMany([{ fileUrl: pathToFileURL(p).href, metadata: { album: 'Many' } }]);
    assert.equal(out[0].success, true, out[0].error);
    assert.equal(out[0].previous.album, 'Fixture Album'); assert.equal(out[0].metadata.album, 'Many');
});

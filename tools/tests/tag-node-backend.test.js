'use strict';

// electron/tag-node-backend.js and electron/tag-backend.js with a fake library over real temp files: the write is checked by
// reading the file back, a bad write is rolled back byte for byte, and the Python backend takes over when Node cannot do the job.
// Run: node --test tools/tests/tag-node-backend.test.js

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createNodeBackend } = require('../../electron/tag-node-backend');
const { createTagBackend } = require('../../electron/tag-backend');
const { AdapterError } = require('../../electron/tag-lib-adapter');
const { id3Model, sampleId3 } = require('./helpers/fake-tag-models');

let dir, disk, tmpRoot;
const clone = (m) => id3Model(m.state.frames, m.state.comments);

// "Disk": what each file holds, kept next to the real bytes. open() works on a copy and save() commits it and changes the bytes.
function fakeOpen({ breakSave, throwOnSave, kind = 'id3', cover } = {}) {
    return async (file) => {
        const entry = disk[file];
        if (!entry) throw new Error('no such file in the fake disk');
        const model = clone(entry.model);
        let newCover = null;
        return {
            kind, model,
            readCover: () => entry.cover || null,
            writeCover: (buf, mime) => { newCover = { data: buf.toString('base64'), mime }; },
            save() {
                if (throwOnSave) { fs.writeFileSync(file, 'HALF-WRITTEN'); throw new Error('disk full'); }
                fs.writeFileSync(file, `WRITTEN ${Math.random()}`);
                entry.model = clone(model);
                if (breakSave === 'drop-comment') entry.model.state.comments = [];
                if (breakSave === 'drop-title') entry.model.del('TIT2');
                if (newCover && breakSave !== 'drop-cover') entry.cover = newCover;
            },
            close() {}
        };
    };
}
const backend = (opts) => createNodeBackend({ toPath: (u) => u, open: fakeOpen(opts), tmpdir: () => tmpRoot });
const add = (name, model = sampleId3()) => { const p = path.join(dir, name); fs.writeFileSync(p, 'ORIGINAL BYTES'); disk[p] = { model, cover: null }; return p; };
const leftovers = () => fs.readdirSync(tmpRoot);

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-tags-')); tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-tmp-')); disk = {}; });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(tmpRoot, { recursive: true, force: true }); });

test('read answers with the same shape as the Python backend', async () => {
    const r = await backend().getAudioMetadata(add('a.mp3'));
    assert.equal(r.success, true);
    assert.equal(r.metadata.title, 'Old title'); assert.deepEqual(r.metadata.artist, ['Earth, Wind & Fire']);
    assert.ok(Array.isArray(r.metadata.otherTags) && 'cover' in r.metadata);
});

test('save writes the patch, answers with the tags read back from the file, and leaves no backup behind', async () => {
    const p = add('a.mp3');
    const r = await backend().saveAudioMetadata(p, { title: 'New', artist: ['A', 'B'] });
    assert.equal(r.success, true);
    assert.equal(r.metadata.title, 'New'); assert.deepEqual(r.metadata.artist, ['A', 'B']);
    assert.equal(r.metadata.album, 'Jazz');
    assert.notEqual(fs.readFileSync(p, 'utf8'), 'ORIGINAL BYTES');
    assert.deepEqual(leftovers(), []);
});

test('save reports the keys the file type cannot hold', async () => {
    const r = await backend({ kind: 'vorbis' }).saveAudioMetadata(add('a.flac', require('./helpers/fake-tag-models').vorbisModel({ title: ['T'] })), { mood: 'Happy', title: 'x' });
    assert.deepEqual(r.skipped, ['mood']);
});

test('a save that loses an untouched tag is rolled back byte for byte', async () => {
    const p = add('a.mp3');
    const r = await backend({ breakSave: 'drop-comment' }).saveAudioMetadata(p, { title: 'New' });
    assert.equal(r.success, false); assert.equal(r.reason, 'verify-failed');
    assert.match(r.error, /original was restored/);
    assert.equal(fs.readFileSync(p, 'utf8'), 'ORIGINAL BYTES');
    assert.deepEqual(leftovers(), []);
});

test('a save that did not store the new value is rolled back', async () => {
    const p = add('a.mp3');
    const r = await backend({ breakSave: 'drop-title' }).saveAudioMetadata(p, { title: 'New' });
    assert.equal(r.reason, 'verify-failed'); assert.match(r.error, /title was not saved/);
    assert.equal(fs.readFileSync(p, 'utf8'), 'ORIGINAL BYTES');
});

test('a save that throws half way puts the original file back', async () => {
    const p = add('a.mp3');
    const r = await backend({ throwOnSave: true }).saveAudioMetadata(p, { title: 'New' });
    assert.deepEqual([r.success, r.reason, r.error], [false, 'failed', 'disk full']);
    assert.equal(fs.readFileSync(p, 'utf8'), 'ORIGINAL BYTES');
});

test('label and publisher share a frame, so a Label edit is not reported as damage', async () => {
    const r = await backend().saveAudioMetadata(add('a.mp3'), { label: 'Parlophone' });
    assert.equal(r.success, true); assert.equal(r.metadata.label, 'Parlophone');
});

test('clearing the track number also drops the total with it, which is not reported as damage', async () => {
    const r = await backend().saveAudioMetadata(add('a.mp3'), { track: '' });
    assert.equal(r.success, true); assert.equal(r.metadata.track, ''); assert.equal(r.metadata.trackTotal, '');
});

test('a cover is saved and read back; a cover that did not stick is rolled back', async () => {
    const img = path.join(dir, 'c.png'); fs.writeFileSync(img, Buffer.from([1, 2, 3]));
    const p = add('a.mp3');
    const ok = await backend().saveAudioMetadata(p, { title: 'T' }, img);
    assert.equal(ok.success, true); assert.equal(ok.metadata.cover.data, Buffer.from([1, 2, 3]).toString('base64'));
    const q = add('b.mp3');
    const bad = await backend({ breakSave: 'drop-cover' }).saveAudioCover(q, img);
    assert.equal(bad.reason, 'verify-failed'); assert.equal(fs.readFileSync(q, 'utf8'), 'ORIGINAL BYTES');
    const onlyCover = await backend().saveAudioCover(add('c.mp3'), img);
    assert.equal(onlyCover.success, true);
});

test('an empty patch only reads: the file is not written', async () => {
    const p = add('a.mp3');
    const r = await backend().saveAudioMetadata(p, {});
    assert.equal(r.success, true); assert.equal(fs.readFileSync(p, 'utf8'), 'ORIGINAL BYTES');
});

test('an unhandled file type and a missing library are told apart, and nothing is written', async () => {
    const p = add('a.m4a');
    const u = await backend({ kind: 'unsupported' }).saveAudioMetadata(p, { title: 'x' });
    assert.deepEqual([u.success, u.reason], [false, 'unsupported']); assert.equal(fs.readFileSync(p, 'utf8'), 'ORIGINAL BYTES');
    const noLib = createNodeBackend({ toPath: (x) => x, open: async () => { throw Object.assign(new Error("Cannot find module 'node-taglib-sharp'"), { code: 'MODULE_NOT_FOUND' }); }, tmpdir: () => tmpRoot });
    const n = await noLib.getAudioMetadata(p);
    assert.equal(n.reason, 'no-library'); assert.match(n.error, /npm install node-taglib-sharp/);
    const odd = createNodeBackend({ toPath: (x) => x, open: async () => { throw new AdapterError('no frames'); }, tmpdir: () => tmpRoot });
    assert.equal((await odd.getAudioMetadata(p)).reason, 'unsupported');
});

test('a missing audio file is reported plainly', async () => {
    const r = await backend().saveAudioMetadata(path.join(dir, 'nope.mp3'), { title: 'x' });
    assert.deepEqual([r.success, r.error], [false, 'Audio file not found']);
});

// ---- the choice between the two backends ----
const stub = (answer) => ({ calls: 0, async getAudioMetadata() { this.calls++; return answer; }, async saveAudioMetadata() { this.calls++; return answer; }, async saveAudioCover() { this.calls++; return answer; } });
const OK = { success: true, metadata: { title: 'x' } };

test('auto: Node answers, Python is not started', async () => {
    const node = stub(OK), python = stub({ success: false });
    assert.equal((await createTagBackend({ node, python }).getAudioMetadata('f')).success, true);
    assert.equal(python.calls, 0);
});

test('auto: every Node failure that left the file intact falls back to Python', async () => {
    for (const reason of ['no-library', 'unsupported', 'verify-failed', 'failed']) {
        const python = stub(OK);
        const r = await createTagBackend({ node: stub({ success: false, reason, error: 'x' }), python }).saveAudioMetadata('f', {});
        assert.equal(r.success, true, reason); assert.equal(python.calls, 1, reason);
    }
});

test('auto: a missing file is not retried with Python', async () => {
    const python = stub(OK);
    await createTagBackend({ node: stub({ success: false, error: 'Audio file not found' }), python }).getAudioMetadata('f');
    assert.equal(python.calls, 0);
});

test('auto: when both fail, the answer that tells the person what to do wins', async () => {
    const noPython = { success: false, reason: 'no-python', error: 'Install Python' };
    const nodeFailed = { success: false, reason: 'verify-failed', error: 'did not match' };
    const noLib = { success: false, reason: 'no-library', error: 'npm install' };
    assert.equal((await createTagBackend({ node: stub(nodeFailed), python: stub(noPython) }).getAudioMetadata('f')).error, 'did not match');
    assert.equal((await createTagBackend({ node: stub(noLib), python: stub(noPython) }).getAudioMetadata('f')).error, 'Install Python');
    assert.equal((await createTagBackend({ node: stub(nodeFailed), python: stub({ success: false, reason: 'failed', error: 'py crash' }) }).getAudioMetadata('f')).error, 'py crash');
});

test('modes: python and node use one backend only', async () => {
    let node = stub(OK), python = stub(OK);
    await createTagBackend({ node, python, mode: 'python' }).getAudioMetadata('f');
    assert.deepEqual([node.calls, python.calls], [0, 1]);
    node = stub({ success: false, reason: 'no-library', error: 'n' }); python = stub(OK);
    assert.equal((await createTagBackend({ node, python, mode: 'node' }).getAudioMetadata('f')).success, false);
    assert.equal(python.calls, 0);
    python = stub(OK); node = stub(OK);
    await createTagBackend({ node, python, mode: 'nonsense' }).getAudioMetadata('f');
    assert.deepEqual([node.calls, python.calls], [1, 0]);
});

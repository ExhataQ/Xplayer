// electron/cover-thumb.js: the main-process side of the header colors. Plain Node: Electron's nativeImage is replaced by a stub.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { readCoverThumb, coverPath, SIZE } = require('../../electron/cover-thumb');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
function stubImage({ empty = false, calls = [] } = {}) {
    return {
        calls,
        createFromPath(file) {
            calls.push(['createFromPath', file]);
            return { isEmpty: () => empty, resize: (options) => (calls.push(['resize', options]), { toPNG: () => PNG }) };
        }
    };
}

describe('readCoverThumb', () => {
    let dir;
    before(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xplayer-cover-thumb-'));
        for (const name of ['cover.jpg', 'my cover 100% #1.png', 'notes.txt']) fs.writeFileSync(path.join(dir, name), 'x');
        fs.mkdirSync(path.join(dir, 'folder.png'));
        fs.mkdirSync(path.join(dir, 'webroot', 'covers'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'library', 'covers'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'library', 'covers', 'a.jpg'), 'x');
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const url = (file) => pathToFileURL(path.join(dir, file)).href;

    test('shrinks the cover to SIZE x SIZE and returns the PNG bytes as an ArrayBuffer', async () => {
        const nativeImage = stubImage();
        const result = await readCoverThumb(url('cover.jpg'), { nativeImage });
        assert.equal(result.success, true);
        assert.ok(result.data instanceof ArrayBuffer);
        assert.deepEqual(Array.from(new Uint8Array(result.data)), Array.from(PNG));
        assert.deepEqual(nativeImage.calls[1], ['resize', { width: SIZE, height: SIZE, quality: 'good' }]);
    });

    test('a percent-encoded file url (what the page sends) with spaces, a percent sign and a hash works', async () => {
        const result = await readCoverThumb(url('my cover 100% #1.png'), { nativeImage: stubImage() });
        assert.equal(result.success, true);
    });

    test('only an image: not a text file, not a folder, not a missing file, not a url of another kind', async () => {
        const nativeImage = stubImage();
        assert.deepEqual(await readCoverThumb(url('notes.txt'), { nativeImage }), { success: false, reason: 'not-image' });
        assert.equal((await readCoverThumb(url('folder.png'), { nativeImage })).success, false);
        assert.equal((await readCoverThumb(url('missing.jpg'), { nativeImage })).success, false);
        for (const bad of ['https://example.com/a.jpg', 'covers/a.jpg', '', null, undefined, 42]) assert.deepEqual(await readCoverThumb(bad, { nativeImage }), { success: false, reason: 'not-image' }, String(bad));
        assert.equal(nativeImage.calls.length, 0, 'nothing was decoded');
    });

    test('a file over the size limit is not decoded', async () => {
        const nativeImage = stubImage();
        assert.deepEqual(await readCoverThumb(url('cover.jpg'), { nativeImage, maxBytes: 0 }), { success: false, reason: 'too-large' });
        assert.equal(nativeImage.calls.length, 0);
    });

    test('an image the decoder cannot read, or a decoder that throws, gives a plain failure', async () => {
        assert.deepEqual(await readCoverThumb(url('cover.jpg'), { nativeImage: stubImage({ empty: true }) }), { success: false, reason: 'not-image' });
        const throwing = { createFromPath: () => { throw new Error('boom'); } };
        assert.deepEqual(await readCoverThumb(url('cover.jpg'), { nativeImage: throwing }), { success: false, reason: 'read-failed' });
    });

    test('a library that is not the web root keeps its covers elsewhere: webRoot/covers/x is read from libraryDir/covers/x', async () => {
        const layout = { webRoot: path.join(dir, 'webroot'), libraryDir: path.join(dir, 'library') };
        const nativeImage = stubImage();
        const result = await readCoverThumb(pathToFileURL(path.join(dir, 'webroot', 'covers', 'a.jpg')).href, { nativeImage, layout });
        assert.equal(result.success, true);
        assert.equal(nativeImage.calls[0][1], path.join(dir, 'library', 'covers', 'a.jpg'));
        assert.equal(coverPath(url('cover.jpg'), layout), path.join(dir, 'cover.jpg'), 'a file outside covers/ is left alone');
        assert.equal(coverPath(url('cover.jpg'), { webRoot: dir, libraryDir: dir }), path.join(dir, 'cover.jpg'), 'same folder: no mapping');
    });
});

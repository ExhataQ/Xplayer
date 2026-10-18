// electron/audio-bytes.js: the main-process side of the waveform (R-C8). Plain Node, no Electron needed.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readAudioBytes, candidatePaths, MAX_BYTES } = require('../../electron/audio-bytes');

describe('readAudioBytes', () => {
    let dir;
    const bytes = Buffer.from([1, 2, 3, 4, 5, 250, 251, 252]);
    const urlOf = (file) => 'file://' + (file.startsWith('/') ? file : '/' + file).replace(/\\/g, '/');
    before(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xplayer-audio-bytes-'));
        for (const name of ['plain.wav', 'my song 100% #1 é.mp3', 'enc 1.flac']) fs.writeFileSync(path.join(dir, name), bytes);
        fs.writeFileSync(path.join(dir, 'notes.txt'), 'not audio');
        fs.mkdirSync(path.join(dir, 'folder.mp3'));
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const same = (result) => assert.deepEqual(Array.from(new Uint8Array(result.data)), Array.from(bytes));

    test('reads an audio file and returns exactly its bytes as an ArrayBuffer', async () => {
        const result = await readAudioBytes(urlOf(path.join(dir, 'plain.wav')));
        assert.equal(result.success, true);
        assert.ok(result.data instanceof ArrayBuffer);
        same(result);
    });

    test('a raw url with spaces, a percent sign, a hash and non-ASCII letters works (urls are not encoded)', async () => {
        same(await readAudioBytes(urlOf(path.join(dir, 'my song 100% #1 é.mp3'))));
    });

    test('a percent-encoded url works as a second try', async () => {
        same(await readAudioBytes(urlOf(path.join(dir, 'enc%201.flac'))));
    });

    test('a plain absolute path works too', async () => {
        same(await readAudioBytes(path.join(dir, 'plain.wav')));
    });

    test('refuses anything that is not an audio file: other extensions, folders, other schemes, junk', async () => {
        for (const input of [urlOf(path.join(dir, 'notes.txt')), urlOf(path.join(dir, 'folder.mp3')), 'http://example.com/a.mp3', 'https://example.com/a.mp3', 'file://host/share/a.mp3', '', null, undefined, 42, {}, 'relative/a.mp3', 'a\0b.mp3']) {
            const result = await readAudioBytes(input);
            assert.equal(result.success, false, `refused: ${String(input)}`);
            assert.equal(result.data, undefined);
        }
    });

    test('a missing file and a file over the size limit give a reason, not an exception', async () => {
        assert.deepEqual(await readAudioBytes(urlOf(path.join(dir, 'missing.wav'))), { success: false, reason: 'read-failed' });
        assert.deepEqual(await readAudioBytes(urlOf(path.join(dir, 'plain.wav')), { maxBytes: 4 }), { success: false, reason: 'too-large' });
        assert.ok(MAX_BYTES >= 100 * 1024 * 1024 && MAX_BYTES <= 400 * 1024 * 1024, 'a sane default limit');
    });

    test('the returned buffer is its own copy of exactly the file (no pooled-buffer slack)', async () => {
        const result = await readAudioBytes(urlOf(path.join(dir, 'plain.wav')));
        assert.equal(result.data.byteLength, bytes.length);
    });

    test('candidatePaths never returns a non-audio path', () => {
        assert.deepEqual(candidatePaths('file:///C:/Music/a.txt'), []);
        assert.deepEqual(candidatePaths('file:///etc/passwd'), []);
        assert.deepEqual(candidatePaths('file://server/share/a.mp3'), []);
    });

    // A Windows drive url only makes an absolute path on Windows, which is where the app runs.
    test('a Windows drive url keeps its drive letter', { skip: process.platform !== 'win32' && 'needs Windows path rules' }, () => {
        assert.deepEqual(candidatePaths('file:///C:/Music/a b.mp3').map((p) => p.replace(/\\/g, '/')), ['C:/Music/a b.mp3']);
    });
});

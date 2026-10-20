// Real cancel for running work (decision D41): a download and the album art search can be stopped from the app.
// Real files, a real local server and a real forked scan process; only the 'electron' module is a stand-in.
//
// Run:   node --test tools/tests/cancel-running-work.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const Module = require('node:module');

const realLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === 'electron') return { app: { getPath: () => os.tmpdir() } };
    return realLoad.call(this, request, ...rest);
};
const downloads = require('../../electron/downloads');
const scanner = require('../../electron/scanner');
Module._load = realLoad;

const TEMP_FOLDER = path.join(os.tmpdir(), 'music-player-temp');
const tempFiles = (prefix) => (fs.existsSync(TEMP_FOLDER) ? fs.readdirSync(TEMP_FOLDER).filter((name) => name.startsWith(prefix)) : []);

// A server that sends a big file slowly, so a download is still running when the test cancels it.
function slowServer({ headerDelay = 0 } = {}) {
    const server = http.createServer((request, response) => {
        const send = () => {
            if (response.destroyed || request.socket.destroyed) return; // the client already gave up
            response.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': 5 * 1024 * 1024 });
            const timer = setInterval(() => response.write(Buffer.alloc(8 * 1024)), 15);
            response.on('close', () => clearInterval(timer));
        };
        if (headerDelay) setTimeout(send, headerDelay);
        else send();
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

test('cancelDownload says false when nothing is downloading', () => {
    assert.equal(downloads.cancelDownload(), false);
});

test('a download that is coming in stops on cancel, reports it, and leaves no half-written file', async () => {
    const { server, port } = await slowServer();
    try {
        let cancelledNow = null;
        const result = await downloads.download(`http://127.0.0.1:${port}/cancel-me-midway.mp3`, true, () => {
            if (cancelledNow === null) cancelledNow = downloads.cancelDownload();
        });
        assert.equal(cancelledNow, true);
        assert.equal(result.success, false);
        assert.equal(result.cancelled, true);
        assert.deepEqual(tempFiles('cancel-me-midway'), []);
        assert.equal(downloads.cancelDownload(), false, 'nothing is left to cancel');
    } finally {
        server.closeAllConnections();
        server.close();
    }
});

test('a download that has not been answered yet stops on cancel too', async () => {
    const { server, port } = await slowServer({ headerDelay: 1500 });
    try {
        const started = downloads.download(`http://127.0.0.1:${port}/cancel-me-early.mp3`, true, () => {});
        await new Promise((resolve) => setTimeout(resolve, 150));
        assert.equal(downloads.cancelDownload(), true);
        const result = await started;
        assert.equal(result.cancelled, true);
        assert.deepEqual(tempFiles('cancel-me-early'), []);
    } finally {
        server.closeAllConnections();
        server.close();
    }
});

test('a download that was not cancelled is unchanged: it finishes with its file', async () => {
    const body = Buffer.alloc(40 * 1024, 7);
    const server = http.createServer((request, response) => {
        response.writeHead(200, { 'Content-Length': body.length });
        response.end(body);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
        const result = await downloads.download(`http://127.0.0.1:${server.address().port}/plain-download.mp3`, true, () => {});
        assert.equal(result.success, true);
        assert.equal(fs.statSync(result.filePath).size, body.length);
        fs.unlinkSync(result.filePath);
    } finally {
        server.close();
    }
});

test('cancelCoverSearch says false when no scan is running', () => {
    assert.equal(scanner.cancelCoverSearch(), false);
});

test('the album art search stops on cancel, the library is already saved, and the scan ends by itself', { timeout: 60000 }, async () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cancel-covers-'));
    const music = path.join(work, 'music');
    const output = path.join(work, 'output');
    fs.mkdirSync(music);
    fs.mkdirSync(output);
    const COUNT = 900;
    for (let i = 0; i < COUNT; i++) fs.writeFileSync(path.join(music, `song-${String(i).padStart(4, '0')}.mp3`), Buffer.alloc(3000, i % 251));

    const batches = [];
    let cancelRequested = null;
    let complete;
    const finished = new Promise((resolve) => (complete = resolve));
    try {
        await scanner.scanFolder(music, output, {
            streamed: true,
            onCoverBatch: (batch) => {
                batches.push(batch);
                if (cancelRequested === null) cancelRequested = scanner.cancelCoverSearch();
            },
            onScanComplete: (code, info) => complete({ code, info })
        });
        const { code, info } = await finished;
        assert.equal(cancelRequested, true, 'the search was running when cancel was asked');
        assert.equal(code, 0, 'the scan ended normally');
        assert.deepEqual(info, { cancelled: true });
        const last = batches.at(-1);
        assert.equal(last.cancelled, true, 'the last batch says it was cut short');
        assert.ok(last.processed < COUNT, `stopped after ${last.processed} of ${COUNT}`);
        const store = JSON.parse(fs.readFileSync(path.join(output, 'songs.json'), 'utf8'));
        assert.equal((store.songs || store).length, COUNT, 'every song is in the saved library');
        assert.equal(scanner.cancelCoverSearch(), false, 'nothing is left to cancel');
    } finally {
        fs.rmSync(work, { recursive: true, force: true });
    }
});

test('an uncancelled scan reports that it was not cancelled', { timeout: 60000 }, async () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-covers-'));
    const music = path.join(work, 'music');
    const output = path.join(work, 'output');
    fs.mkdirSync(music);
    fs.mkdirSync(output);
    for (let i = 0; i < 30; i++) fs.writeFileSync(path.join(music, `song-${i}.mp3`), Buffer.alloc(3000, i));
    let complete;
    const finished = new Promise((resolve) => (complete = resolve));
    try {
        await scanner.scanFolder(music, output, { streamed: true, onScanComplete: (code, info) => complete({ code, info }) });
        const { code, info } = await finished;
        assert.equal(code, 0);
        assert.deepEqual(info, { cancelled: false });
    } finally {
        fs.rmSync(work, { recursive: true, force: true });
    }
});

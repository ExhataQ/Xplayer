// Task C2: what a link would download, asked with a light HEAD request (electron/downloads.js probeUrl).
// A real local server; only the 'electron' module is a stand-in. Nothing is written to disk.
//
// Run:   node --test tools/tests/play-from-url-probe.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const http = require('node:http');
const Module = require('node:module');

const realLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === 'electron') return { app: { getPath: () => os.tmpdir() } };
    return realLoad.call(this, request, ...rest);
};
const downloads = require('../../electron/downloads');
Module._load = realLoad;

function server(handler) {
    const seen = [];
    const instance = http.createServer((request, response) => {
        seen.push(`${request.method} ${request.url}`);
        handler(request, response);
    });
    return new Promise((resolve) => instance.listen(0, '127.0.0.1', () => resolve({ instance, seen, base: `http://127.0.0.1:${instance.address().port}` })));
}
const stop = (s) => {
    s.instance.closeAllConnections();
    s.instance.close();
};

test('a link that answers gives the saved name, the size and the type, using HEAD only', async () => {
    const s = await server((req, res) => {
        res.writeHead(200, { 'Content-Type': 'audio/mpeg; charset=binary', 'Content-Length': 4404019 });
        res.end();
    });
    try {
        const info = await downloads.probeUrl(`${s.base}/music/My%20Song.mp3?token=1`);
        assert.deepEqual(info, { success: true, name: 'My Song.mp3', size: 4404019, type: 'audio/mpeg' });
        assert.deepEqual(s.seen, ['HEAD /music/My%20Song.mp3?token=1']);
    } finally {
        stop(s);
    }
});

test('only what the server told is returned', async () => {
    const s = await server((req, res) => {
        res.writeHead(200, { 'Content-Type': 'not a type' });
        res.end();
    });
    try {
        assert.deepEqual(await downloads.probeUrl(`${s.base}/a.mp3`), { success: true, name: 'a.mp3' });
    } finally {
        stop(s);
    }
});

test('a redirect is followed, and the name is the one a download would use after it', async () => {
    const s = await server((req, res) => {
        if (req.url === '/start') {
            res.writeHead(302, { Location: '/files/final.flac' });
            res.end();
            return;
        }
        res.writeHead(200, { 'Content-Type': 'audio/flac', 'Content-Length': 10 });
        res.end();
    });
    try {
        const info = await downloads.probeUrl(`${s.base}/start`);
        assert.equal(info.name, 'final.flac');
        assert.equal(info.size, 10);
    } finally {
        stop(s);
    }
});

test('a redirect loop, a refused HEAD and a missing file all give { success: false }', async () => {
    const s = await server((req, res) => {
        if (req.url === '/loop') {
            res.writeHead(302, { Location: '/loop' });
            res.end();
        } else if (req.url === '/nohead') {
            res.writeHead(405);
            res.end();
        } else {
            res.writeHead(404);
            res.end();
        }
    });
    try {
        for (const path of ['/loop', '/nohead', '/missing']) assert.deepEqual(await downloads.probeUrl(`${s.base}${path}`), { success: false }, path);
    } finally {
        stop(s);
    }
});

test('anything but a plain http(s) link, and a server that is not there, give { success: false }', async () => {
    for (const bad of ['', 'not a url', 'file:///C:/a.mp3', 'ftp://example.com/a.mp3', 'javascript:alert(1)', null, undefined, 42]) {
        assert.deepEqual(await downloads.probeUrl(bad), { success: false }, String(bad));
    }
    const s = await server(() => {});
    const base = s.base;
    stop(s);
    assert.deepEqual(await downloads.probeUrl(`${base}/a.mp3`), { success: false });
});

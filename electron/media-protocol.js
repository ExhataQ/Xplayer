'use strict';

// The media protocol: how the equalizer gets to hear the music (task: equalizer).
//
// The player's audio is a file:// url, and the page runs with web security on. Web Audio (the equalizer is a chain of filters) is silent for media
// that is not same-origin or CORS-approved, and a file:// url is neither: the music would simply stop. So when the equalizer is on, the page asks for
// the same file through this protocol instead (xplayer-media://media/<the file url, percent-encoded>), and the main process answers with the bytes
// and the header that approves it (Access-Control-Allow-Origin). Seeking needs byte ranges, so Range is answered here with 206 and Content-Range.
//
// What it will serve is what electron/audio-bytes.js already will: an audio file by extension, a regular file, nothing else, never a write. An
// https url is passed through (Play from URL) so a stream keeps playing while the equalizer is on; nothing else is.

const fs = require('fs');
const { Readable } = require('stream');
const { candidatePaths } = require('./audio-bytes');

const SCHEME = 'xplayer-media';

const TYPES = {
    '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.oga': 'audio/ogg',
    '.opus': 'audio/ogg',
    '.wav': 'audio/wav',
    '.wma': 'audio/x-ms-wma',
    '.aif': 'audio/aiff',
    '.aiff': 'audio/aiff',
    '.webm': 'audio/webm',
    '.mka': 'audio/x-matroska'
};

/** Call before the app is ready: a scheme must be declared privileged first. */
function registerScheme(protocol) {
    if (!protocol || typeof protocol.registerSchemesAsPrivileged !== 'function') return; // a test's fake electron has no protocol
    protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
}

/** The file url (or https url) a request stands for, or '' when it is not one of ours. */
function targetOf(requestUrl) {
    try {
        const url = new URL(requestUrl);
        if (url.protocol !== `${SCHEME}:`) return '';
        return decodeURIComponent(url.pathname.slice(1));
    } catch (_) {
        return '';
    }
}

/** 'bytes=a-b' | 'bytes=a-' | 'bytes=-n' -> { start, end } inside a file of `size` bytes, null for no range, 'invalid' for one that cannot be served. */
function parseRange(header, size) {
    if (!header) return null;
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
    if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
    let start;
    let end;
    if (m[1] === '') {
        const suffix = Number(m[2]);
        if (suffix === 0) return 'invalid';
        start = Math.max(0, size - suffix);
        end = size - 1;
    } else {
        start = Number(m[1]);
        end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start >= size || start > end) return 'invalid';
    return { start, end };
}

function cors(headers = {}) {
    return { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', ...headers };
}

async function serveFile(request, fileUrl) {
    for (const filePath of candidatePaths(fileUrl)) {
        let stat;
        try {
            stat = await fs.promises.stat(filePath);
        } catch (_) {
            continue;
        }
        if (!stat.isFile()) continue;
        const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
        const base = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
        const range = parseRange(request.headers.get('range'), stat.size);
        if (range === 'invalid') return new Response(null, { status: 416, headers: cors({ ...base, 'Content-Range': `bytes */${stat.size}` }) });
        const part = range || { start: 0, end: Math.max(0, stat.size - 1) };
        if (stat.size === 0) return new Response(null, { status: 200, headers: cors({ ...base, 'Content-Length': '0' }) });
        const body = Readable.toWeb(fs.createReadStream(filePath, { start: part.start, end: part.end }));
        const headers = cors({ ...base, 'Content-Length': String(part.end - part.start + 1) });
        if (range) headers['Content-Range'] = `bytes ${part.start}-${part.end}/${stat.size}`;
        return new Response(body, { status: range ? 206 : 200, headers });
    }
    return new Response(null, { status: 404, headers: cors() });
}

async function serveWeb(request, webUrl, net) {
    const headers = {};
    const range = request.headers.get('range');
    if (range) headers.Range = range;
    const upstream = await net.fetch(webUrl, { headers, redirect: 'follow' });
    const out = new Headers(upstream.headers);
    out.set('Access-Control-Allow-Origin', '*');
    out.set('Cache-Control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}

function makeHandler(net) {
    return async function handle(request) {
        try {
            const target = targetOf(request.url);
            if (/^https:\/\//i.test(target)) return await serveWeb(request, target, net);
            if (!target) return new Response(null, { status: 400, headers: cors() });
            return await serveFile(request, target);
        } catch (_) {
            return new Response(null, { status: 500, headers: cors() });
        }
    };
}

/** Call once the app is ready. */
function install(protocol, net) {
    if (!protocol || typeof protocol.handle !== 'function') return;
    protocol.handle(SCHEME, makeHandler(net));
}

module.exports = { SCHEME, registerScheme, install, makeHandler, parseRange, targetOf };

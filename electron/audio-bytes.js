// Read-only access to an audio file's bytes for the waveform (task C-02, request R-C8, decision D15).
//
// A renderer cannot read a file by itself (fetch() does not support file:// and the page runs with web security on),
// so the page asks the main process. This does the least that is useful and safe: only an audio file (by extension,
// like get-audio-metadata), only a regular file, only up to a size limit, never a write, and a plain answer on
// failure. The result is handed to decodeAudioData in the page, which holds the whole decoded track in memory, so the
// page also skips long tracks before asking.

const fs = require('fs');
const path = require('path');
const checks = require('./ipc-checks');

const MAX_BYTES = 200 * 1024 * 1024;

// Song urls are built raw ('file:///' + the path with forward slashes, tag-builder.js), not percent-encoded, so a name
// such as "100% #1.mp3" must not go through URL parsing. A percent-encoded url (from elsewhere) is tried second.
function candidatePaths(fileUrl) {
    if (typeof fileUrl !== 'string' || !fileUrl) return [];
    let raw;
    if (/^file:\/\/\/[A-Za-z]:/.test(fileUrl)) raw = fileUrl.slice('file:///'.length);
    else if (fileUrl.startsWith('file:///')) raw = fileUrl.slice('file://'.length);
    else if (/^file:/i.test(fileUrl)) return [];
    else raw = fileUrl;
    const list = [raw];
    try {
        const decoded = decodeURIComponent(raw);
        if (decoded !== raw) list.push(decoded);
    } catch (_) {
        /* not percent-encoded */
    }
    return list.map((p) => path.normalize(p)).filter((p) => checks.isAudioPath(p));
}

/** Resolves { success: true, data: ArrayBuffer } or { success: false, reason: 'not-audio' | 'too-large' | 'read-failed' }. */
async function readAudioBytes(fileUrl, { maxBytes = MAX_BYTES } = {}) {
    const candidates = candidatePaths(fileUrl);
    if (!candidates.length) return { success: false, reason: 'not-audio' };
    for (const filePath of candidates) {
        let stat;
        try {
            stat = await fs.promises.stat(filePath);
        } catch (_) {
            continue;
        }
        if (!stat.isFile()) continue;
        if (stat.size > maxBytes) return { success: false, reason: 'too-large' };
        try {
            const buffer = await fs.promises.readFile(filePath);
            return { success: true, data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) };
        } catch (_) {
            return { success: false, reason: 'read-failed' };
        }
    }
    return { success: false, reason: 'read-failed' };
}

module.exports = { readAudioBytes, candidatePaths, MAX_BYTES };

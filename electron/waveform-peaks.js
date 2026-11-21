// Saved waveform peaks (task PC-03, decision DP10 b). The renderer decodes a whole track to draw its waveform (about one
// second of work for a long song), so the 1000 bytes it ends up with are kept on disk and read back the next time the track
// plays. One small file per track in the settings folder, named by a hash of the key the renderer builds (which holds the
// scaling version, so peaks from an older scaling are never reused). Nothing here reads a path from the page: the key is only
// ever hashed. Plain Node, no Electron needed.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getPeaksDir } = require('./storage-paths');

const MAX_KEY = 1000; // characters; a key is a version, an id, a duration and a url
const MAX_BYTES = 4096; // the renderer saves 1000; anything much bigger is not peaks
const MAX_FILES = 20000; // about 20 MB; beyond this the least recently written files go first
const KEEP_AFTER_PRUNE = 18000;

const fileFor = (dir, key) => path.join(dir, crypto.createHash('sha1').update(key).digest('hex') + '.bin');
const validKey = (key) => typeof key === 'string' && key.length > 0 && key.length <= MAX_KEY && !key.includes('\0');

let pruned = false;
function pruneOnce(dir) {
    if (pruned) return;
    pruned = true; // looked at once per run, on the first save
    try {
        const files = fs.readdirSync(dir).filter((name) => name.endsWith('.bin'));
        if (files.length <= MAX_FILES) return;
        const aged = files.map((name) => ({ name, at: fs.statSync(path.join(dir, name)).mtimeMs })).sort((a, b) => a.at - b.at);
        for (const { name } of aged.slice(0, files.length - KEEP_AFTER_PRUNE)) fs.unlinkSync(path.join(dir, name));
    } catch (_) {
        /* a failed clean-up only leaves more files; saving and reading still work */
    }
}

/** Resolves { success: true, data: Uint8Array } or { success: false }. A missing or damaged file is simply a miss. */
async function readPeaks(key, { dir = getPeaksDir() } = {}) {
    if (!validKey(key)) return { success: false };
    try {
        const buffer = await fs.promises.readFile(fileFor(dir, key));
        if (!buffer.length || buffer.length > MAX_BYTES) return { success: false };
        return { success: true, data: new Uint8Array(buffer) };
    } catch (_) {
        return { success: false };
    }
}

/** `bytes` is any Uint8Array or ArrayBuffer of 1 to 4096 bytes. Resolves { success: boolean }. */
async function writePeaks(key, bytes, { dir = getPeaksDir() } = {}) {
    if (!validKey(key)) return { success: false };
    const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
    if (!(view instanceof Uint8Array) || !view.length || view.length > MAX_BYTES) return { success: false };
    try {
        await fs.promises.mkdir(dir, { recursive: true });
        pruneOnce(dir);
        const target = fileFor(dir, key);
        const temp = target + '.tmp';
        await fs.promises.writeFile(temp, view);
        await fs.promises.rename(temp, target); // a half-written file is never read as peaks
        return { success: true };
    } catch (_) {
        return { success: false };
    }
}

module.exports = { readPeaks, writePeaks, MAX_BYTES, MAX_KEY };

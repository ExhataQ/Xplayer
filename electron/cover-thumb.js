// Read-only access to a cover image as a small PNG, for the colors of a list's header (src/ui-next/views/library/cover-palette.js).
//
// The page cannot read the pixels of a file:// image: the canvas is tainted (the page runs with web security on, like for the
// waveform, see audio-bytes.js). So the page asks the main process, which decodes the cover, shrinks it to SIZE x SIZE and
// hands back a PNG of a few hundred bytes. The page makes a blob of it and reads that: a blob is the page's own, never tainted.
// Only an image file (by extension), only a regular file, only up to a size limit, never a write, and a plain answer on failure.

const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const checks = require('./ipc-checks');

const SIZE = 32;
const MAX_BYTES = 25 * 1024 * 1024;

/** Where a cover url lives on disk. A library that is not the web root keeps its covers elsewhere (app-paths.js installCoverRoute): the page sees webRoot/covers/x, the file is in libraryDir/covers/x. */
function coverPath(fileUrl, layout) {
    if (typeof fileUrl !== 'string' || !/^file:/i.test(fileUrl)) return '';
    let file;
    try {
        file = path.normalize(fileURLToPath(fileUrl));
    } catch (_) {
        return '';
    }
    if (!layout || !layout.webRoot || !layout.libraryDir || layout.libraryDir === layout.webRoot) return file;
    const fold = process.platform === 'win32' ? (text) => text.toLowerCase() : (text) => text;
    const from = path.join(layout.webRoot, 'covers') + path.sep;
    if (!fold(file).startsWith(fold(from))) return file;
    return path.join(layout.libraryDir, 'covers', file.slice(from.length));
}

/**
 * Resolves { success: true, data: ArrayBuffer (a PNG, SIZE x SIZE) } or { success: false, reason: 'not-image' | 'too-large' | 'read-failed' }.
 * `nativeImage` and `layout` are the Electron nativeImage and app-paths layout; tests pass their own.
 */
async function readCoverThumb(fileUrl, { nativeImage, layout, size = SIZE, maxBytes = MAX_BYTES } = {}) {
    const file = coverPath(fileUrl, layout);
    if (!checks.isImagePath(file)) return { success: false, reason: 'not-image' };
    try {
        const stat = await fs.promises.stat(file);
        if (!stat.isFile()) return { success: false, reason: 'read-failed' };
        if (stat.size > maxBytes) return { success: false, reason: 'too-large' };
        const image = (nativeImage || require('electron').nativeImage).createFromPath(file);
        if (!image || image.isEmpty()) return { success: false, reason: 'not-image' };
        const png = image.resize({ width: size, height: size, quality: 'good' }).toPNG();
        return { success: true, data: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) };
    } catch (_) {
        return { success: false, reason: 'read-failed' };
    }
}

module.exports = { readCoverThumb, coverPath, SIZE, MAX_BYTES };

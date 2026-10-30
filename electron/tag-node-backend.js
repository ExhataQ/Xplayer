'use strict';

// The Node tag backend (task PD-01, decision DP7): the same three calls and the same answers as the Python backend in
// metadata-editor.js, so the tag service and the screens do not know which one ran.
//
// Safety, because a wrong writer damages people's music files: every write first copies the file, writes, reads the file back from
// disk, and checks that (a) the patched tags now hold the new values, (b) every tag that was NOT in the patch still holds what it
// held before, and (c) the cover is as expected. Any failure puts the copy back and answers with a `reason`:
//   'no-library'    the package is not installed (nothing was touched)
//   'unsupported'   this kind of file is not handled here (nothing was touched)
//   'verify-failed' the file did not come back as expected (the original was restored)
//   'failed'        anything else (the original was restored)
// tag-backend.js sends the first three to the Python backend.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { readMetadata, applyPatch, clean, multiValues, multiTagValues, ALL_FIELDS } = require('./tag-rules');
const { openFile, AdapterError } = require('./tag-lib-adapter');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
const CHECKED_TEXT = ['title', 'album', 'comment'];
const CHECKED_MULTI = ['artist', 'albumArtist', 'genre', 'composer'];
// Fields that share storage: a patch to one can change the other, so neither is compared as "untouched".
const LINKED = [['label', 'publisher'], ['track', 'trackTotal'], ['discNumber', 'discTotal']];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const year4 = (v) => String(v || '').slice(0, 4);

function problemsAfterWrite(before, after, patch, coverBuffer) {
    const problems = [];
    const keys = Object.keys(patch || {}).filter((k) => !k.startsWith('__'));
    for (const k of CHECKED_TEXT) if (keys.includes(k) && clean(patch[k]) !== after[k]) problems.push(`${k} was not saved`);
    for (const k of CHECKED_MULTI) if (keys.includes(k) && !same(multiTagValues(multiValues(patch[k])), after[k])) problems.push(`${k} was not saved`);
    const skip = new Set(keys);
    for (const group of LINKED) if (group.some((k) => skip.has(k))) group.forEach((k) => skip.add(k));
    for (const f of ALL_FIELDS) {
        if (skip.has(f)) continue;
        const a = f === 'year' ? year4(before[f]) : before[f];
        const b = f === 'year' ? year4(after[f]) : after[f];
        if (!same(a, b)) problems.push(`${f} changed although it was not edited`);
    }
    if (!same(before.otherTags, after.otherTags)) problems.push('other tags changed');
    if (coverBuffer) { if (!after.cover || after.cover.data !== coverBuffer.toString('base64')) problems.push('the cover was not saved'); }
    else if (!same(before.cover, after.cover)) problems.push('the cover changed although it was not edited');
    return problems;
}

function failure(error) {
    const message = error && error.message ? error.message : String(error);
    if (error && (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') && /node-taglib-sharp/.test(message)) {
        return { success: false, reason: 'no-library', error: 'The tag library (node-taglib-sharp) is not installed. Run: npm install node-taglib-sharp' };
    }
    if (error instanceof AdapterError) return { success: false, reason: 'unsupported', error: message };
    if (error && error.reason) return { success: false, reason: error.reason, error: message };
    return { success: false, reason: 'failed', error: message };
}
const unsupported = (ext) => Object.assign(new Error(`Tags in ${ext || 'this file type'} files are not handled by the Node backend`), { reason: 'unsupported' });

function createNodeBackend({ toPath, open = openFile, tmpdir = os.tmpdir } = {}) {
    async function snapshot(filePath) {
        const h = await open(filePath);
        try {
            if (h.kind === 'unsupported') throw unsupported(path.extname(filePath));
            return readMetadata(h.kind, h.model, h.readCover());
        } finally { h.close(); }
    }

    async function guarded(filePath, work) {
        if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return { success: false, reason: 'failed', error: 'Audio file not found' };
        let backup = '';
        let touched = false;
        try {
            backup = path.join(fs.mkdtempSync(path.join(tmpdir(), 'metadata-backup-')), path.basename(filePath));
            fs.copyFileSync(filePath, backup); // no copy, no edit
            return await work(() => { touched = true; });
        } catch (e) {
            if (touched) { try { fs.copyFileSync(backup, filePath); } catch (restoreError) { /* reported below */ } }
            return failure(e);
        } finally {
            if (backup) { try { fs.rmSync(path.dirname(backup), { recursive: true, force: true }); } catch (e) { /* temp folder */ } }
        }
    }

    // One session: open, apply, save, read back, check. `touch` marks the moment the file may have changed.
    function edit(filePath, patch, coverPath) {
        const hasFields = Object.keys(patch || {}).some((k) => !k.startsWith('__'));
        if (!hasFields && !coverPath) return snapshot(filePath).then((metadata) => ({ success: true, metadata }), failure);
        return guarded(filePath, async (touch) => {
            const before = await snapshot(filePath);
            const coverBuffer = coverPath ? fs.readFileSync(coverPath) : null;
            const h = await open(filePath);
            let skipped = [];
            try {
                if (hasFields) skipped = applyPatch(h.kind, h.model, patch);
                if (coverBuffer) h.writeCover(coverBuffer, MIME[path.extname(coverPath).toLowerCase()] || 'application/octet-stream');
                touch();
                h.save();
            } finally { h.close(); }
            const after = await snapshot(filePath);
            const problems = problemsAfterWrite(before, after, patch, coverBuffer);
            if (problems.length) throw Object.assign(new Error(`The saved file did not match the edit (${problems.join('; ')}). The original was restored.`), { reason: 'verify-failed' });
            return skipped.length ? { success: true, metadata: after, skipped } : { success: true, metadata: after };
        });
    }

    return {
        async getAudioMetadata(fileUrl) {
            const filePath = toPath(fileUrl);
            if (!filePath || !fs.existsSync(filePath)) return { success: false, reason: 'failed', error: 'Audio file not found' };
            try { return { success: true, metadata: await snapshot(filePath) }; } catch (e) { return failure(e); }
        },
        saveAudioMetadata: (fileUrl, metadata, coverPath = '') => edit(toPath(fileUrl), { ...(metadata || {}) }, coverPath || ''),
        saveAudioCover: (fileUrl, imagePath) => (imagePath && fs.existsSync(imagePath) ? edit(toPath(fileUrl), {}, imagePath) : Promise.resolve({ success: false, reason: 'failed', error: 'Cover image not found' }))
    };
}

module.exports = { createNodeBackend, problemsAfterWrite };

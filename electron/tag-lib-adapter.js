'use strict';

// The ONLY file that talks to node-taglib-sharp (task PD-01, decision DP7). It turns one open file into the small model that
// tag-rules.js works on. Written from the library's documented API; it has not been run against the real package in the
// environment that built it (no network there), so tools/tests/tag-parity.test.js must pass on a machine that has the package.
// Anything about the library that does not look as expected throws AdapterError, which the backend reports as 'unsupported'
// (and the caller falls back to Python) instead of writing a file through a guess.

const path = require('path');

const RETRY_MS = 30000;
const ID3_EXT = new Set(['.mp3', '.mp2', '.mp1', '.wav', '.wave', '.aif', '.aiff']);
const VORBIS_EXT = new Set(['.flac', '.ogg', '.oga', '.opus']);
const MAX_COVER = 6 * 1024 * 1024;

class AdapterError extends Error {}

let loading = null;
let failedAt = 0;
// The package may be CommonJS or an ES module; both are tried. A missing package is remembered for RETRY_MS so a folder of songs
// does not retry per song, and installing it needs no restart after that.
function loadLibrary(importer = (name) => import(name), requirer = require) {
    if (loading && (!failedAt || Date.now() - failedAt < RETRY_MS)) return loading;
    failedAt = 0;
    loading = (async () => {
        try { return requirer('node-taglib-sharp'); } catch (e) {
            if (e && e.code === 'MODULE_NOT_FOUND') throw e;
            if (!e || e.code !== 'ERR_REQUIRE_ESM') throw e;
        }
        return importer('node-taglib-sharp');
    })().catch((e) => { failedAt = Date.now(); throw e; });
    return loading;
}

const need = (value, what) => { if (value === undefined || value === null) throw new AdapterError(`node-taglib-sharp does not provide ${what}`); return value; };
const strings = (v) => (Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)]);

function id3Model(lib, tag) {
    const { Id3v2TextInformationFrame, Id3v2UserTextInformationFrame, Id3v2CommentsFrame, Id3v2FrameIdentifiers, StringType } = lib;
    need(Id3v2TextInformationFrame, 'Id3v2TextInformationFrame'); need(Id3v2UserTextInformationFrame, 'Id3v2UserTextInformationFrame');
    need(Id3v2CommentsFrame, 'Id3v2CommentsFrame'); need(Id3v2FrameIdentifiers, 'Id3v2FrameIdentifiers'); need(StringType, 'StringType');
    const frames = () => need(tag.frames, 'Id3v2Tag.frames');
    const idOf = (f) => String(f.frameId);
    const isUser = (f) => f instanceof Id3v2UserTextInformationFrame;
    const isComment = (f) => f instanceof Id3v2CommentsFrame;
    const isText = (f) => f instanceof Id3v2TextInformationFrame;
    const find = (key) => {
        if (key.startsWith('TXXX:')) { const desc = key.slice(5); return frames().filter((f) => isUser(f) && f.description === desc); }
        return frames().filter((f) => isText(f) && !isUser(f) && idOf(f) === key);
    };
    return {
        get: (key) => find(key).flatMap((f) => strings(f.text)),
        del: (key) => { for (const f of find(key)) tag.removeFrame(f); },
        set(key, values) {
            this.del(key);
            if (!values.length) return;
            let frame;
            if (key.startsWith('TXXX:')) frame = Id3v2UserTextInformationFrame.fromDescription(key.slice(5), StringType.UTF8);
            else frame = Id3v2TextInformationFrame.fromIdentifier(need(Id3v2FrameIdentifiers[key], `frame ${key}`), StringType.UTF8);
            frame.text = values;
            tag.addFrame(frame);
        },
        comments: () => frames().filter(isComment).map((f) => ({ desc: f.description || '', lang: f.language || 'eng', text: String(f.text ?? '') })),
        removeComment(desc) { for (const f of frames().filter((x) => isComment(x) && (x.description || '') === desc)) tag.removeFrame(f); },
        addComment({ desc, lang, text }) {
            const frame = Id3v2CommentsFrame.fromDescription(desc, lang, StringType.UTF8);
            frame.text = text;
            tag.addFrame(frame);
        },
        entries() {
            const out = [];
            for (const f of frames()) {
                const id = idOf(f);
                if (id === 'APIC') continue;
                const key = isUser(f) ? `TXXX:${f.description}` : id;
                if (isComment(f)) out.push({ key: `COMM:${f.description || ''}`, values: [String(f.text ?? '')] });
                else if (isText(f)) out.push({ key, values: strings(f.text) });
                else if (f.url !== undefined) out.push({ key, values: [String(f.url)] });
            }
            return out;
        }
    };
}

function xiphModel(tag) {
    const upper = (k) => String(k).toUpperCase();
    return {
        get: (key) => strings(tag.getField(upper(key))),
        set: (key, values) => tag.setFieldAsStrings(upper(key), ...values),
        del: (key) => tag.removeField(upper(key)),
        entries: () => need(tag.fieldNames, 'XiphComment.fieldNames').map((name) => ({ key: String(name).toLowerCase(), values: strings(tag.getField(name)) }))
    };
}

// ID3 is saved as v2.4, like the Python script does.
async function openFile(filePath, { library = loadLibrary } = {}) {
    const lib = await library();
    const { File, TagTypes } = lib;
    need(File, 'File'); need(TagTypes, 'TagTypes');
    if (lib.Id3v2Settings) { lib.Id3v2Settings.defaultVersion = 4; lib.Id3v2Settings.forceDefaultVersion = true; }
    const ext = path.extname(filePath).toLowerCase();
    const file = File.createFromPath(filePath);
    const close = () => { try { file.dispose(); } catch (e) { /* already closed */ } };
    try {
        let kind = 'unsupported';
        let model = null;
        // getTag(types, create) answers undefined when the tag is not there and cannot be created (File docs), so that is not a crash.
        // The docs' own example spells the enum member ID3v2; both spellings are accepted.
        if (ID3_EXT.has(ext)) { kind = 'id3'; model = id3Model(lib, need(file.getTag(need(TagTypes.Id3v2 ?? TagTypes.ID3v2, 'TagTypes.Id3v2'), true), 'an ID3v2 tag')); }
        else if (VORBIS_EXT.has(ext)) { kind = 'vorbis'; model = xiphModel(need(file.getTag(need(TagTypes.Xiph, 'TagTypes.Xiph'), true), 'a Xiph comment')); }
        const pictures = () => Array.from(need(file.tag, 'File.tag').pictures || []);
        return {
            kind, model,
            readCover() {
                const list = pictures();
                if (!list.length) return null;
                const pic = list.find((p) => p.type === (lib.PictureType ? lib.PictureType.FrontCover : 3)) || list[0];
                const bytes = pic.data && pic.data.data;
                if (!bytes || bytes.length > MAX_COVER) return null;
                return { data: Buffer.from(bytes).toString('base64'), mime: pic.mimeType || 'image/jpeg' };
            },
            writeCover(buffer, mime) {
                const { Picture, ByteVector, PictureType } = lib;
                need(Picture, 'Picture'); need(ByteVector, 'ByteVector');
                const pic = Picture.fromData(ByteVector.fromByteArray(new Uint8Array(buffer)));
                pic.mimeType = mime;
                pic.type = PictureType ? PictureType.FrontCover : 3;
                pic.description = 'Cover';
                file.tag.pictures = [pic];
            },
            // "Files with unknown corruptions should not be written" (File docs): refuse before a byte is written.
            save() {
                if (file.isPossiblyCorrupt) throw new AdapterError(`The file looks damaged and is not written: ${(file.corruptionReasons || []).join('; ') || 'unknown reason'}`);
                file.save();
            },
            close
        };
    } catch (e) { close(); throw e; }
}

module.exports = { openFile, loadLibrary, AdapterError, ID3_EXT, VORBIS_EXT };

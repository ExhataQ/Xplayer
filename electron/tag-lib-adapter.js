'use strict';

// The ONLY file that talks to node-taglib-sharp (task PD-01, decision DP7). It turns one open file into the small model that
// tag-rules.js works on. tools/tests/tag-parity.test.js runs it against the real package on real files.
// Anything about the library that does not look as expected throws AdapterError, which the backend reports as 'unsupported'
// instead of writing a file through a guess.

const path = require('path');

const RETRY_MS = 30000;
const ID3_EXT = new Set(['.mp3', '.mp2', '.mp1', '.wav', '.wave', '.aif', '.aiff']);
const VORBIS_EXT = new Set(['.flac', '.ogg', '.oga', '.opus']);
const MP4_EXT = new Set(['.m4a', '.mp4', '.m4b']);
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

// MP4 / M4A. Atoms are addressed by name (see tag-rules.js); the library has no way to list them, so entries() reads its item box.
function mp4Model(lib, tag) {
    const { ByteVector, StringType } = lib;
    need(ByteVector, 'ByteVector'); need(StringType, 'StringType');
    const MEAN = 'com.apple.iTunes';
    const atom = (key) => ByteVector.fromString(key, StringType.Latin1);
    const freeform = (key) => (key.startsWith('----:') ? key.slice(5) : null);
    const whole = (text, what) => {
        const m = /^\s*(\d*)\s*(?:\/\s*(\d*))?\s*$/.exec(String(text));
        if (!m) throw new Error(`${what} must be a number or "n/total", got "${text}"`);
        const a = Number(m[1] || 0), b = Number(m[2] || 0);
        if (a > 65535 || b > 65535) throw new Error(`${what} is too large for an MP4 file`);
        return [a, b];
    };
    const pair = (a, b) => (a > 0 || b > 0 ? [`${a > 0 ? a : ''}${b > 0 ? '/' + b : ''}`] : []);
    const asText = (n) => (n > 0 ? [String(Math.round(n))] : []);
    return {
        get(key) {
            const name = freeform(key);
            if (name !== null) return strings(tag.getItunesStrings(MEAN, name));
            if (key === 'trkn') return pair(tag.track, tag.trackCount);
            if (key === 'disk') return pair(tag.disc, tag.discCount);
            if (key === 'tmpo') return asText(tag.beatsPerMinute);
            if (key === 'cpil') return tag.isCompilation ? ['1'] : [];
            if (key === '\u00a9gen') return strings(tag.genres); // also reads the numeric genre atom
            return strings(tag.getQuickTimeStrings(atom(key)));
        },
        set(key, values) {
            const name = freeform(key);
            if (name !== null) return tag.setItunesStrings(MEAN, name, ...values);
            if (key === 'trkn') { const [a, b] = whole(values[0] ?? '', 'The track number'); tag.track = a; tag.trackCount = b; return undefined; }
            if (key === 'disk') { const [a, b] = whole(values[0] ?? '', 'The disc number'); tag.disc = a; tag.discCount = b; return undefined; }
            if (key === 'tmpo') {
                const n = values.length ? Number(values[0]) : 0;
                if (!Number.isFinite(n) || n < 0 || n > 65535) throw new Error(`The BPM must be a number from 0 to 65535, got "${values[0]}"`);
                tag.beatsPerMinute = Math.round(n);
                return undefined;
            }
            if (key === 'cpil') { tag.isCompilation = values.length > 0; return undefined; }
            return tag.setQuickTimeStrings(atom(key), values.length ? values : undefined);
        },
        del(key) { this.set(key, []); },
        entries() {
            const out = [];
            const items = need(tag._ilstBox, 'the MP4 item box').children || [];
            const latin = (v) => v.toString(StringType.Latin1);
            for (const item of items) {
                const kind = latin(item.boxType);
                if (kind === 'covr') continue;
                const kids = item.children || [];
                const texts = kids.filter((c) => typeof c.text === 'string' && c.text !== '' && !(c.constructor && /AdditionalInfo/.test(c.constructor.name))).map((c) => c.text);
                let key = kind;
                if (kind === '----') {
                    const info = kids.filter((c) => c.constructor && /AdditionalInfo/.test(c.constructor.name));
                    const mean = info.find((c) => latin(c.boxType) === 'mean');
                    const label = info.find((c) => latin(c.boxType) === 'name');
                    if (!label || !label.text) continue;
                    key = `----:${label.text}`;
                    if (mean && mean.text && mean.text !== MEAN) key = `----:${mean.text}:${label.text}`;
                }
                if (texts.length) out.push({ key, values: texts });
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

// ID3 is saved as v2.4.
async function openFile(filePath, { library = loadLibrary } = {}) {
    const lib = await library();
    const { File, TagTypes } = lib;
    need(File, 'File'); need(TagTypes, 'TagTypes');
    if (lib.Id3v2Settings) { lib.Id3v2Settings.defaultVersion = 4; lib.Id3v2Settings.forceDefaultVersion = true; }
    const ext = path.extname(filePath).toLowerCase();
    const file = File.createFromPath(filePath);
    // The library adds an ID3v1 tag to an MP3 on save, filled from the tags as they were before the edit, and it never updates it: a stale
    // copy that readers like music-metadata then mix in (the old track number next to the new total). So one that was not in the file is removed again.
    const hadId3v1 = (file.tagTypesOnDisk & (TagTypes.Id3v1 ?? 2)) !== 0;
    const close = () => { try { file.dispose(); } catch (e) { /* already closed */ } };
    try {
        let kind = 'unsupported';
        let model = null;
        // getTag(types, create) answers undefined when the tag is not there and cannot be created (File docs), so that is not a crash.
        // The docs' own example spells the enum member ID3v2; both spellings are accepted.
        if (ID3_EXT.has(ext)) { kind = 'id3'; model = id3Model(lib, need(file.getTag(need(TagTypes.Id3v2 ?? TagTypes.ID3v2, 'TagTypes.Id3v2'), true), 'an ID3v2 tag')); }
        else if (MP4_EXT.has(ext)) { kind = 'mp4'; model = mp4Model(lib, need(file.getTag(need(TagTypes.Apple, 'TagTypes.Apple'), true), 'an Apple (MP4) tag')); }
        else if (VORBIS_EXT.has(ext)) { kind = 'vorbis'; model = xiphModel(need(file.getTag(need(TagTypes.Xiph, 'TagTypes.Xiph'), true), 'a Xiph comment')); }
        const pictures = () => Array.from(need(file.tag, 'File.tag').pictures || []);
        return {
            kind, model,
            readCover() {
                const list = pictures();
                if (!list.length) return null;
                const pic = list.find((p) => p.type === (lib.PictureType ? lib.PictureType.FrontCover : 3)) || list[0];
                const bytes = pic.data && typeof pic.data.toByteArray === 'function' ? pic.data.toByteArray() : null; // a ByteVector has no .data property
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
                if (kind === 'id3' && !hadId3v1 && /^\.mp[123]$/.test(ext) && typeof file.removeTags === 'function') file.removeTags(TagTypes.Id3v1 ?? 2);
                file.save();
            },
            close
        };
    } catch (e) { close(); throw e; }
}

module.exports = { openFile, loadLibrary, AdapterError, ID3_EXT, VORBIS_EXT, MP4_EXT };

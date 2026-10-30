'use strict';

// The tag rules of electron/metadata-editor.py, in Node, with no audio library and no files (task PD-01, decision DP7).
// They work on a small "model" of one file's tags, so they can be tested without a library and the library adapter
// (tag-lib-adapter.js) stays thin. Keep this file and the Python script saying the same thing until the Python path is removed.
//
// Model for an ID3 file (MP3, WAV, AIFF): keys are frame ids ('TIT2') or 'TXXX:<description>'.
//   get(key) -> string[]      set(key, values) (empty list deletes)      del(key)
//   comments() -> [{ desc, lang, text }]    removeComment(desc)    addComment({ desc, lang, text })
//   entries() -> [{ key, values }]   every text or url frame except pictures
// Model for a Vorbis-comment file (FLAC, OGG, Opus): keys are lower case.
//   get(key) -> string[]      set(key, values) (empty list deletes)      del(key)      entries() -> [{ key, values }]

const MULTI = ['artist', 'albumArtist', 'composer', 'genre', 'conductor', 'remixer', 'musicBrainzArtistId'];
const ALL_FIELDS = [
    'title', 'artist', 'album', 'albumArtist', 'composer', 'genre', 'year', 'track', 'trackTotal',
    'discNumber', 'discTotal', 'label', 'copyright', 'comment', 'conductor', 'remixer', 'sortTitle',
    'sortArtist', 'sortAlbum', 'grouping', 'bpm', 'compilation', 'isrc', 'musicBrainzTrackId',
    'musicBrainzAlbumId', 'musicBrainzOriginalAlbumId', 'musicBrainzArtistId', 'publisher',
    'encodedBy', 'producer', 'lyricist', 'writer', 'description', 'mood', 'language', 'mediaKind',
    'sortComposer', 'musicBrainzReleaseGroupId'
];
const ID3_KNOWN = new Set([
    'TIT2', 'TPE1', 'TALB', 'TPE2', 'TCOM', 'TCON', 'TDRC', 'TPUB', 'TCOP', 'TPE3', 'TPE4', 'TBPM',
    'TSRC', 'TENC', 'TRCK', 'TPOS', 'COMM', 'TSOT', 'TSOP', 'TSOA', 'TSOC', 'APIC', 'TPRO', 'TEXT',
    'TOLY', 'TIT3', 'TMOO', 'TLAN', 'TMED'
]);
const ID3_KNOWN_TXXX = new Set([
    'TXXX:SORT_TITLE', 'TXXX:SORT_ARTIST', 'TXXX:SORT_ALBUM', 'TXXX:GROUPING', 'TXXX:COMPILATION',
    'TXXX:MusicBrainz Track Id', 'TXXX:MusicBrainz Album Id', 'TXXX:MusicBrainz Artist Id',
    'TXXX:MusicBrainz Release Group Id', 'TXXX:MusicBrainz Original Album Id', 'TXXX:DESCRIPTION',
    'TXXX:MOOD', 'TXXX:WRITER'
]);
const VORBIS_KNOWN = new Set([
    'title', 'artist', 'album', 'albumartist', 'album artist', 'composer', 'genre', 'date', 'year',
    'label', 'copyright', 'comment', 'conductor', 'remixer', 'titlesort', 'artistsort', 'albumsort',
    'grouping', 'bpm', 'compilation', 'isrc', 'musicbrainz_trackid', 'musicbrainz_albumid',
    'musicbrainz_artistid', 'musicbrainz_releasegroupid', 'publisher', 'encoded-by', 'producer',
    'lyricist', 'writer', 'description', 'mood', 'language', 'media kind', 'mediakind', 'sortcomposer',
    'tracknumber', 'discnumber'
]);
const VORBIS_TEXT = {
    title: 'title', album: 'album', year: 'date', label: 'label', copyright: 'copyright',
    comment: 'comment', sortTitle: 'titlesort', sortArtist: 'artistsort', sortAlbum: 'albumsort',
    grouping: 'grouping', bpm: 'bpm', compilation: 'compilation', isrc: 'isrc',
    musicBrainzTrackId: 'musicbrainz_trackid', musicBrainzAlbumId: 'musicbrainz_albumid',
    musicBrainzOriginalAlbumId: 'musicbrainz_originalalbumid', publisher: 'publisher', encodedBy: 'encoded-by'
};
const VORBIS_MULTI = {
    artist: 'artist', albumArtist: 'albumartist', composer: 'composer', genre: 'genre',
    conductor: 'conductor', remixer: 'remixer', musicBrainzArtistId: 'musicbrainz_artistid'
};
const VORBIS_NUMBERED = new Set(['track', 'trackTotal', 'discNumber', 'discTotal']);

// Values of a frame or field: no empty entries, and NUL separates values (some old taggers write several values in one string).
function vals(list) {
    const raw = (Array.isArray(list) ? list : list == null ? [] : [list]).filter((x) => x != null && String(x) !== '').map(String);
    const out = [];
    for (const item of raw) for (const part of item.split('\u0000')) if (part !== '') out.push(part);
    return out;
}
// Commas are NOT separators ("Earth, Wind & Fire" is one name). Only NUL and ';' are.
function multiTagValues(list) {
    const out = [];
    for (const item of vals(list)) for (const raw of item.split(';')) { const part = raw.trim(); if (part && !out.includes(part)) out.push(part); }
    return out;
}
const first = (model, key) => vals(model.get(key))[0] || '';
const frameValues = (model, key) => multiTagValues(model.get(key));
function splitNum(model, key) {
    const s = first(model, key);
    if (s.includes('/')) { const i = s.indexOf('/'); return [s.slice(0, i).trim(), s.slice(i + 1).trim()]; }
    return [s.trim(), ''];
}
// The editor's "Comment" is the COMM frame with an empty description, else the first one that is not an iTunes frame.
function userComment(comments) {
    return comments.find((f) => (f.desc || '') === '') || comments.find((f) => !(f.desc || '').toLowerCase().startsWith('itun')) || null;
}
function clean(v) {
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(', ');
    return String(v ?? '').trim();
}
// The editor already sends one entry per artist or genre, so values are never split again.
function multiValues(v) {
    if (v == null) return [];
    const out = [];
    for (const item of Array.isArray(v) ? v : [v]) { const text = item == null ? '' : String(item).trim(); if (text && !out.includes(text)) out.push(text); }
    return out;
}

function otherTags(kind, model) {
    const result = [];
    try {
        for (const { key, values } of model.entries()) {
            if (kind === 'id3') {
                const id = String(key).split(':')[0];
                if (ID3_KNOWN.has(id) || ID3_KNOWN_TXXX.has(String(key)) || id === 'APIC') continue;
            } else if (VORBIS_KNOWN.has(String(key).toLowerCase())) continue;
            const v = vals(values);
            if (v.length) result.push({ key: String(key), values: v });
        }
    } catch (e) { /* an unreadable extra frame must not hide the known tags */ }
    return result.sort((a, b) => (a.key.toLowerCase() < b.key.toLowerCase() ? -1 : a.key.toLowerCase() > b.key.toLowerCase() ? 1 : 0));
}

function readMetadata(kind, model, cover = null) {
    const r = {};
    for (const k of ALL_FIELDS) r[k] = MULTI.includes(k) ? [] : '';
    if (kind === 'id3') {
        Object.assign(r, {
            title: first(model, 'TIT2'), artist: frameValues(model, 'TPE1'), album: first(model, 'TALB'),
            albumArtist: frameValues(model, 'TPE2'), composer: frameValues(model, 'TCOM'),
            genre: frameValues(model, 'TCON'), year: first(model, 'TDRC'), label: first(model, 'TPUB'),
            copyright: first(model, 'TCOP'), conductor: frameValues(model, 'TPE3'), remixer: frameValues(model, 'TPE4'),
            bpm: first(model, 'TBPM'), isrc: first(model, 'TSRC'),
            sortTitle: first(model, 'TSOT') || first(model, 'TXXX:SORT_TITLE'),
            sortArtist: first(model, 'TSOP') || first(model, 'TXXX:SORT_ARTIST'),
            sortAlbum: first(model, 'TSOA') || first(model, 'TXXX:SORT_ALBUM'),
            grouping: first(model, 'TXXX:GROUPING'), compilation: first(model, 'TXXX:COMPILATION'),
            encodedBy: first(model, 'TENC'), producer: first(model, 'TPRO'),
            lyricist: first(model, 'TEXT') || first(model, 'TOLY'), writer: first(model, 'TXXX:WRITER'),
            description: first(model, 'TIT3') || first(model, 'TXXX:DESCRIPTION'),
            mood: first(model, 'TMOO') || first(model, 'TXXX:MOOD'), language: first(model, 'TLAN'),
            mediaKind: first(model, 'TMED'), sortComposer: first(model, 'TSOC'),
            musicBrainzReleaseGroupId: first(model, 'TXXX:MusicBrainz Release Group Id'),
            musicBrainzTrackId: first(model, 'TXXX:MusicBrainz Track Id'),
            musicBrainzAlbumId: first(model, 'TXXX:MusicBrainz Album Id'),
            musicBrainzOriginalAlbumId: first(model, 'TXXX:MusicBrainz Original Album Id'),
            musicBrainzArtistId: frameValues(model, 'TXXX:MusicBrainz Artist Id')
        });
        [r.track, r.trackTotal] = splitNum(model, 'TRCK');
        [r.discNumber, r.discTotal] = splitNum(model, 'TPOS');
        const c = userComment(model.comments());
        r.comment = c && c.text ? String(c.text) : '';
    } else if (kind === 'vorbis') {
        const ev = (k) => multiTagValues(model.get(k));
        Object.assign(r, {
            title: first(model, 'title'), artist: ev('artist'), album: first(model, 'album'),
            albumArtist: ev('albumartist').length ? ev('albumartist') : ev('album artist'), composer: ev('composer'),
            genre: ev('genre'), year: first(model, 'date') || first(model, 'year'), label: first(model, 'label'),
            copyright: first(model, 'copyright'), comment: first(model, 'comment'), conductor: ev('conductor'),
            remixer: ev('remixer'), sortTitle: first(model, 'titlesort'), sortArtist: first(model, 'artistsort'),
            sortAlbum: first(model, 'albumsort'), grouping: first(model, 'grouping'), bpm: first(model, 'bpm'),
            compilation: first(model, 'compilation'), isrc: first(model, 'isrc'),
            musicBrainzTrackId: first(model, 'musicbrainz_trackid'), musicBrainzAlbumId: first(model, 'musicbrainz_albumid'),
            musicBrainzOriginalAlbumId: first(model, 'musicbrainz_originalalbumid'), musicBrainzArtistId: ev('musicbrainz_artistid'),
            musicBrainzReleaseGroupId: first(model, 'musicbrainz_releasegroupid'), publisher: first(model, 'publisher'),
            encodedBy: first(model, 'encoded-by'), producer: first(model, 'producer'), lyricist: first(model, 'lyricist'),
            writer: first(model, 'writer'), description: first(model, 'description'), mood: first(model, 'mood'),
            language: first(model, 'language'), mediaKind: first(model, 'media kind') || first(model, 'mediakind'),
            sortComposer: first(model, 'composer sort')
        });
        [r.track, r.trackTotal] = splitNum(model, 'tracknumber');
        [r.discNumber, r.discTotal] = splitNum(model, 'discnumber');
    }
    r.otherTags = model ? otherTags(kind, model) : [];
    r.cover = cover;
    return r;
}

function writeId3(model, d) {
    const setText = (id, key) => { if (!(key in d)) return; const v = clean(d[key]); model.set(id, v ? [v] : []); };
    const setMulti = (id, key) => { if (key in d) model.set(id, multiValues(d[key])); };
    const setTxxx = (desc, key, multi) => {
        if (!(key in d)) return;
        const values = multi ? multiValues(d[key]) : (clean(d[key]) ? [clean(d[key])] : []);
        model.set('TXXX:' + desc, values);
    };
    setText('TIT2', 'title'); setMulti('TPE1', 'artist'); setText('TALB', 'album');
    setMulti('TPE2', 'albumArtist'); setMulti('TCOM', 'composer'); setMulti('TCON', 'genre');
    setText('TDRC', 'year'); setText('TCOP', 'copyright'); setMulti('TPE3', 'conductor');
    setMulti('TPE4', 'remixer'); setText('TBPM', 'bpm'); setText('TSRC', 'isrc');
    setText('TENC', 'encodedBy'); setText('TPRO', 'producer'); setText('TEXT', 'lyricist');
    setText('TIT3', 'description'); setText('TMOO', 'mood'); setText('TLAN', 'language');
    setText('TMED', 'mediaKind'); setText('TSOC', 'sortComposer');
    // Label and Publisher are one ID3 frame (TPUB); the editor reads it as "label".
    const tpub = 'label' in d ? 'label' : 'publisher' in d ? 'publisher' : null;
    if (tpub) setText('TPUB', tpub);
    for (const [desc, key, multi] of [
        ['SORT_TITLE', 'sortTitle', false], ['SORT_ARTIST', 'sortArtist', false], ['SORT_ALBUM', 'sortAlbum', false],
        ['GROUPING', 'grouping', false], ['COMPILATION', 'compilation', false], ['WRITER', 'writer', false],
        ['MusicBrainz Track Id', 'musicBrainzTrackId', false], ['MusicBrainz Album Id', 'musicBrainzAlbumId', false],
        ['MusicBrainz Original Album Id', 'musicBrainzOriginalAlbumId', false],
        ['MusicBrainz Artist Id', 'musicBrainzArtistId', true], ['MusicBrainz Release Group Id', 'musicBrainzReleaseGroupId', false]
    ]) setTxxx(desc, key, multi);
    for (const [id, key] of [['TSOT', 'sortTitle'], ['TSOP', 'sortArtist'], ['TSOA', 'sortAlbum']]) setText(id, key);
    // "n/total" frames: if only one half changed, keep the other half from the file.
    for (const [id, numKey, totKey] of [['TRCK', 'track', 'trackTotal'], ['TPOS', 'discNumber', 'discTotal']]) {
        if (!(numKey in d) && !(totKey in d)) continue;
        const [curNum, curTot] = splitNum(model, id);
        const num = numKey in d ? clean(d[numKey]) : curNum;
        const tot = totKey in d ? clean(d[totKey]) : curTot;
        model.set(id, num ? [num + (tot ? '/' + tot : '')] : []);
    }
    if ('comment' in d) {
        // Only the user's comment is replaced; iTunNORM, iTunSMPB and other COMM frames stay.
        const target = userComment(model.comments());
        const desc = target ? target.desc || '' : '';
        const lang = target ? target.lang || 'eng' : 'eng';
        if (target) model.removeComment(desc);
        const comment = clean(d.comment);
        if (comment) model.addComment({ desc, lang, text: comment });
    }
    return [];
}

function writeVorbis(model, d) {
    const put = (key, values) => { if (values.length) model.set(key, values); else model.del(key); };
    for (const [src, key] of Object.entries(VORBIS_TEXT)) if (src in d) { const v = clean(d[src]); put(key, v ? [v] : []); }
    for (const [src, key] of Object.entries(VORBIS_MULTI)) if (src in d) put(key, multiValues(d[src]));
    for (const [key, numKey, totKey] of [['tracknumber', 'track', 'trackTotal'], ['discnumber', 'discNumber', 'discTotal']]) {
        if (!(numKey in d) && !(totKey in d)) continue;
        const [curNum, curTot] = splitNum(model, key);
        const num = numKey in d ? clean(d[numKey]) : curNum;
        const tot = totKey in d ? clean(d[totKey]) : curTot;
        put(key, num ? [num + (tot ? '/' + tot : '')] : []);
    }
    const supported = new Set([...Object.keys(VORBIS_TEXT), ...Object.keys(VORBIS_MULTI), ...VORBIS_NUMBERED]);
    return Object.keys(d).filter((k) => !supported.has(k)).sort();
}

// `patch` is a PATCH: a key that is absent is left alone; a key that is present is written, and an empty value clears it.
// Returns the keys that could not be saved for this kind of file.
function applyPatch(kind, model, patch) {
    const d = {};
    for (const k of Object.keys(patch || {})) if (!k.startsWith('__')) d[k] = patch[k];
    return kind === 'id3' ? writeId3(model, d) : writeVorbis(model, d);
}

module.exports = { readMetadata, applyPatch, vals, multiTagValues, userComment, clean, multiValues, ALL_FIELDS, MULTI };

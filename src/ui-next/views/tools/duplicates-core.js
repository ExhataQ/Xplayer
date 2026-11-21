// DUPLICATE FINDER, the part that thinks. Pure: no DOM, no storage, no engine. tools/tests/logic/duplicates-core.test.js imports this file directly.
//
// How a duplicate finder works (the same ideas as MusicBrainz Picard, dupeGuru, beets and MediaMonkey):
//   1. It never trusts one thing. A file name, a title or a length can each match by accident, so a group is built from signals and says which
//      ones agreed: that is its confidence.
//   2. Cheap signals first. Size and length need no reading of the file; tags need no reading either (the library scan already has them). Only
//      the person's own tags can be wrong, so the title and the artist are normalised before they are compared (case, accents, punctuation,
//      "feat. ...", "(2011 Remaster)") but a word that makes a different recording ("live", "remix", "acoustic", "instrumental", ...) stays in the
//      key: a live version is not a copy of the studio one.
//   3. A match needs the length as well (within a couple of seconds) so two different songs with one title are not joined.
//   4. It only recognises. It suggests which file to keep (lossless first, then bitrate, then complete tags, then what the person used) and
//      never decides: hiding or removing is the person's click (library/duplicates-hidden.js).
// What it does not do: listen to the audio (an acoustic fingerprint finds the same recording under different tags; that needs a native tool
// and is left for later). So two files whose tags differ and whose size differs are not found.
//
//   findDuplicateGroups(songs, options)   the groups, best matches first
//   rankSongs(songs, usage)               the songs best first, each with the reasons it ranks there
//   titleKey, artistKey, secondsOf        the pieces, exported for the tests

const LOSSLESS = new Set(['.flac', '.wav', '.wave', '.aif', '.aiff', '.ape', '.wv', '.alac']);

/** Seconds from the scan's "m:ss" or "h:mm:ss" text (or a number). 0 when unknown. */
export function secondsOf(duration) {
    if (typeof duration === 'number') return Number.isFinite(duration) && duration > 0 ? duration : 0;
    const parts = String(duration ?? '').trim().split(':');
    if (!parts.length || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return 0;
    return parts.reduce((total, p) => total * 60 + Number(p), 0);
}

// Words that make a different recording. A bracket that holds one of them stays in the title's key.
const DIFFERENT_VERSION = /\b(live|remix|rmx|acoustic|instrumental|karaoke|demo|cover|unplugged|a cappella|acapella|session|radio edit|extended|club mix|dub|rehearsal|reprise|edit)\b/;
// Words that name the same recording in another release: dropped from the key.
const SAME_RECORDING = /\b(remaster(ed)?|mono|stereo|deluxe|bonus( track)?|explicit|clean|album version|single version|original version|digital|hd|hq|official|video|audio|lyrics?)\b|\b(19|20)\d\d\b/;
const SAME_RECORDING_ALL = new RegExp(SAME_RECORDING.source, 'g');
const FEATURING = /\b(feat|ft|featuring|with)\b\.?/;

function plain(text) {
    return String(text ?? '')
        .normalize('NFKD')
        .replace(/[̀-ًͯ-ٰٟـ]/g, '') // accents, Arabic vowel marks, tatweel
        .replace(/[يى]/g, 'ی') // Arabic yeh forms -> Persian yeh
        .replace(/ك/g, 'ک') // Arabic kaf -> Persian kaf
        .toLowerCase()
        .replace(/&/g, ' and ');
}

const squash = (text) => text.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** What a title is compared by: case, accents and punctuation gone, release noise gone, "live"/"remix"-like words kept. */
export function titleKey(title) {
    let text = plain(title).replace(/^\s*\d{1,3}\s*[-._)]\s+/, ''); // "01 - Title" from a file name
    const kept = [];
    // Brackets and the tail after " - ": each part is kept or dropped on what it says.
    text = text.replace(/[([{]([^)\]}]*)[)\]}]/g, (_, inner) => {
        if (DIFFERENT_VERSION.test(inner)) kept.push(inner);
        return ' ';
    });
    const dash = text.split(/\s[-–—]\s/);
    const head = dash.shift();
    for (const tail of dash) if (DIFFERENT_VERSION.test(tail) && !SAME_RECORDING.test(tail.replace(DIFFERENT_VERSION, ''))) kept.push(tail);
    else if (DIFFERENT_VERSION.test(tail)) kept.push(tail.replace(SAME_RECORDING_ALL, ''));
    const base = squash(head.split(FEATURING)[0]);
    const extra = kept.map((part) => squash(part.replace(SAME_RECORDING_ALL, ' '))).filter(Boolean).sort().join(' ');
    return extra ? `${base} | ${extra}` : base;
}

/** The main artist as a key: the first one named ("A feat. B", "A, B", "A & B" are all A). '' when there is none. */
export function artistKey(artist) {
    const first = plain(artist).split(/[;,/]|\s(?:feat|ft|featuring|with|and|x|vs)\b\.?\s/)[0];
    const key = squash(first || '');
    return key === 'unknown artist' || key === 'unknown' || key === 'various artists' ? '' : key;
}

const extensionOf = (url) => {
    const match = /\.[a-z0-9]+$/.exec(String(url ?? '').split(/[?#]/)[0].toLowerCase());
    return match ? match[0] : '';
};

const numberOf = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

class Groups {
    constructor(ids) {
        this.parent = new Map(ids.map((id) => [id, id]));
    }
    find(id) {
        let root = id;
        while (this.parent.get(root) !== root) root = this.parent.get(root);
        while (this.parent.get(id) !== root) {
            const next = this.parent.get(id);
            this.parent.set(id, root);
            id = next;
        }
        return root;
    }
    join(a, b) {
        const x = this.find(a);
        const y = this.find(b);
        if (x !== y) this.parent.set(y, x);
    }
}

// Songs with one key, split where the length differs by more than `tolerance` seconds from the one before (sorted by length).
function byLength(members, tolerance) {
    const known = members.filter((m) => m.seconds > 0).sort((a, b) => a.seconds - b.seconds);
    const runs = [];
    for (const m of known) {
        const run = runs[runs.length - 1];
        if (run && m.seconds - run[run.length - 1].seconds <= tolerance) run.push(m);
        else runs.push([m]);
    }
    return runs.filter((run) => run.length > 1);
}

function hashOf(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

/** A group's identity: the same members always give the same id, a new copy gives another one (so "not duplicates" does not hide a new copy). */
export const groupSignature = (urls) => [...urls].sort().join('\n');

/** How much the group can be trusted: 'same' (the same file or the same recording id), 'likely', or 'possible'. */
function confidenceOf(signals, members) {
    if (signals.has('file') || signals.has('recording')) return 'same';
    const albums = new Set(members.map((m) => m.song.album && plain(m.song.album).trim()).filter(Boolean));
    const spread = Math.max(...members.map((m) => m.seconds)) - Math.min(...members.map((m) => m.seconds));
    return signals.has('tags') && albums.size <= 1 && spread <= 1 ? 'likely' : 'possible';
}

/**
 * Groups of songs that look like the same recording.
 *   songs     the library's songs (id, url, title, artist, album, duration, size, musicBrainzTrackId)
 *   options   { tolerance: seconds the lengths may differ for a tags match (default 2),
 *               byTags, bySize, byRecording: switch a signal off (default on),
 *               ignored: Set of group signatures the person said are not duplicates }
 * Each group: { id, signature, confidence, reasons: ['file' | 'recording' | 'tags'], songIds, urls }.
 */
export function findDuplicateGroups(songs, options = {}) {
    const { tolerance = 2, byTags = true, bySize = true, byRecording = true, ignored = new Set() } = options;
    const list = (songs || []).filter((song) => song && song.url);
    const members = list.map((song) => ({ song, id: song.id, seconds: secondsOf(song.duration), size: numberOf(song.size) }));
    const groups = new Groups(members.map((m) => m.id));
    const signals = new Map(); // id of a member -> signals that joined it (kept per root afterwards)
    const joined = [];
    const link = (a, b, signal) => {
        groups.join(a.id, b.id);
        joined.push([a.id, signal], [b.id, signal]);
    };

    if (bySize) {
        // Same size in bytes and the same length to the second: a copy of the file, whatever it is called or tagged.
        const bySizeKey = new Map();
        for (const m of members) if (m.size > 50 * 1024 && m.seconds > 0) {
            const key = `${m.size}|${Math.round(m.seconds)}`;
            if (!bySizeKey.has(key)) bySizeKey.set(key, []);
            bySizeKey.get(key).push(m);
        }
        for (const run of bySizeKey.values()) for (let i = 1; i < run.length; i++) link(run[0], run[i], 'file');
    }
    if (byRecording) {
        const byId = new Map();
        for (const m of members) {
            const id = String(m.song.musicBrainzTrackId || '').trim().toLowerCase();
            if (!id) continue;
            if (!byId.has(id)) byId.set(id, []);
            byId.get(id).push(m);
        }
        for (const run of byId.values()) for (let i = 1; i < run.length; i++) link(run[0], run[i], 'recording');
    }
    if (byTags) {
        const byKey = new Map();
        for (const m of members) {
            const title = titleKey(m.song.title);
            const artist = artistKey(m.song.artist);
            // A song with no artist, or a title that came from its file name, says too little to compare.
            if (!title || !artist || (Array.isArray(m.song.missingTags) && m.song.missingTags.includes('title'))) continue;
            const key = `${artist}\u0001${title}`;
            if (!byKey.has(key)) byKey.set(key, []);
            byKey.get(key).push(m);
        }
        for (const run of byKey.values()) {
            if (run.length < 2) continue;
            for (const part of byLength(run, tolerance)) for (let i = 1; i < part.length; i++) link(part[0], part[i], 'tags');
        }
    }

    const roots = new Map();
    for (const m of members) {
        const root = groups.find(m.id);
        if (!roots.has(root)) roots.set(root, []);
        roots.get(root).push(m);
    }
    const signalsOf = new Map();
    for (const [id, signal] of joined) {
        const root = groups.find(id);
        if (!signalsOf.has(root)) signalsOf.set(root, new Set());
        signalsOf.get(root).add(signal);
    }
    void signals;

    const out = [];
    for (const [root, run] of roots) {
        if (run.length < 2) continue;
        const urls = run.map((m) => m.song.url);
        const signature = groupSignature(urls);
        if (ignored.has(signature)) continue;
        const reasons = [...signalsOf.get(root)];
        out.push({ id: hashOf(signature), signature, confidence: confidenceOf(signalsOf.get(root), run), reasons, songIds: run.map((m) => m.id), urls });
    }
    const order = { same: 0, likely: 1, possible: 2 };
    return out.sort((a, b) => order[a.confidence] - order[b.confidence] || b.songIds.length - a.songIds.length || a.id.localeCompare(b.id));
}

/** How complete a song's tags are: how many of the useful ones have a value. */
function completeness(song) {
    return ['title', 'artist', 'album', 'year', 'track', 'genre', 'albumArtist'].filter((k) => String(song[k] ?? '').trim()).length + (song.cover ? 1 : 0);
}

/**
 * The songs of a group, the one to keep first. `usage` is { [id]: { plays, rating } } (what the person did with each song). Each result is
 * { song, why: [short reasons it ranks above the next one] }: lossless, a higher bitrate, more complete tags, played or rated more.
 */
export function rankSongs(songs, usage = {}) {
    const rows = songs.map((song) => {
        const used = usage[song.id] || {};
        return {
            song,
            lossless: LOSSLESS.has(extensionOf(song.url)) ? 1 : 0,
            bitrate: numberOf(song.bitrate),
            rate: numberOf(song.sampleRate),
            tags: completeness(song),
            used: numberOf(used.plays) + numberOf(used.rating) * 2 + (used.favorite ? 3 : 0),
            size: numberOf(song.size)
        };
    });
    const better = [
        ['lossless', 'Lossless'],
        ['bitrate', 'Higher bitrate'],
        ['rate', 'Higher sample rate'],
        ['tags', 'More complete tags'],
        ['used', 'Played, rated or liked more'],
        ['size', 'Larger file']
    ];
    rows.sort((a, b) => {
        for (const [key] of better) if (a[key] !== b[key]) return b[key] - a[key];
        return String(a.song.url).localeCompare(String(b.song.url));
    });
    return rows.map((row, i) => {
        const next = rows[i + 1];
        const why = next ? better.filter(([key]) => row[key] > next[key]).map(([, label]) => label) : [];
        return { song: row.song, why };
    });
}

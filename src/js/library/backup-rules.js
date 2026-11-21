// ==============================================================================
// BACKUP RULES
// ==============================================================================
// The pure part of Export / Import data: what a backup file looks like, whether a file is one, and how the songs in it find their way
// back into a library whose ids are different. No DOM, no storage, no state: tools/tests/logic/backup-rules.test.js imports this file directly.
// The buttons, the dialog and the saving are in library/03l-import-export.js.
//
// Why identities: a song's id is only a number given by the scanner in scan order. A rebuilt library, a moved music folder or another PC
// numbers the same files differently, so playlists, favorites and ratings saved by id would point at other songs. A backup therefore
// carries `songs`, a table { id: { url, title, artist, album, duration } } for every id it uses, and an import looks each one up again.

export const BACKUP_FORMAT = 'xplayer-backup';
export const BACKUP_VERSION = 2; // 1 (no number in the file): ids only. 2: adds format, version and the `songs` table.

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value) => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
const text = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

/** What says which song a song is, apart from its id. */
export function songIdentity(song) {
    return {
        url: text(song && song.url),
        title: text(song && song.title),
        artist: text(song && song.artist),
        album: text(song && song.album),
        duration: text(song && song.duration)
    };
}

// A file address in one spelling, so the same file written with a different case, slashes or %-escapes still matches.
function normalizeUrl(url) {
    let value = text(url).trim();
    try {
        value = decodeURIComponent(value);
    } catch (_) {
        /* a lone % stays as it is */
    }
    return value.replace(/\\/g, '/').toLowerCase();
}
const norm = (value) => text(value).trim().toLowerCase();
const fullKey = (i) => `${norm(i.title)}|${norm(i.artist)}|${norm(i.album)}|${norm(i.duration)}`;
const looseKey = (i) => `${norm(i.title)}|${norm(i.artist)}|${norm(i.duration)}`;
const AMBIGUOUS = Symbol('ambiguous');

/**
 * match(identity) for a library: the song with the same file address, else the only song with the same title, artist, album and
 * length, else the only one with the same title, artist and length. Two songs that fit equally are not guessed between: null.
 */
export function buildSongMatcher(library) {
    const byUrl = new Map();
    const byFull = new Map();
    const byLoose = new Map();
    const put = (map, key, song) => map.set(key, map.has(key) ? AMBIGUOUS : song);
    for (const song of Array.isArray(library) ? library : []) {
        if (!song || song.external || !isId(song.id)) continue;
        const identity = songIdentity(song);
        if (identity.url) byUrl.set(normalizeUrl(identity.url), byUrl.has(normalizeUrl(identity.url)) ? AMBIGUOUS : song);
        if (identity.title) {
            put(byFull, fullKey(identity), song);
            put(byLoose, looseKey(identity), song);
        }
    }
    const pick = (map, key) => {
        const hit = map.get(key);
        return hit && hit !== AMBIGUOUS ? hit : null;
    };
    return (identity) => {
        if (!identity) return null;
        if (identity.url) {
            const hit = pick(byUrl, normalizeUrl(identity.url));
            if (hit) return hit;
        }
        if (!norm(identity.title)) return null;
        return pick(byFull, fullKey(identity)) || pick(byLoose, looseKey(identity));
    };
}

/** Every song id the data refers to: playlists, favorites, ratings, history and recents. */
export function collectSongIds(data) {
    const ids = new Set();
    if (!isObject(data)) return ids;
    for (const playlist of Array.isArray(data.playlists) ? data.playlists : []) {
        for (const id of isObject(playlist) && Array.isArray(playlist.songs) ? playlist.songs : []) if (isId(id)) ids.add(id);
    }
    for (const id of Array.isArray(data.favorites) ? data.favorites : []) if (isId(id)) ids.add(id);
    if (isObject(data.ratings)) for (const id of Object.keys(data.ratings)) ids.add(/^-?\d+$/.test(id) ? Number(id) : id);
    for (const list of [data.playHistory, data.recentlyPlayed]) {
        for (const entry of Array.isArray(list) ? list : []) if (isObject(entry) && isId(entry.id)) ids.add(entry.id);
    }
    return ids;
}

/** The `songs` table for an export: an identity for each id the data uses that the library still has. getSong(id) returns the song or null. */
export function buildSongTable(data, getSong) {
    const table = {};
    for (const id of collectSongIds(data)) {
        const song = getSong(id);
        if (song && !song.external) table[String(id)] = songIdentity(song);
    }
    return table;
}

/** How much of each kind of thing the data holds. */
export function summarizeBackup(data) {
    const d = isObject(data) ? data : {};
    const count = (value) => (Array.isArray(value) ? value.length : 0);
    return {
        playlists: count(d.playlists),
        folders: count(d.folders),
        favorites: count(d.favorites),
        ratings: isObject(d.ratings) ? Object.keys(d.ratings).length : 0,
        history: count(d.playHistory),
        recents: count(d.recentlyPlayed),
        searches: count(d.searchHistory),
        pins: count(d.pinnedItems),
        hasSongTable: isObject(d.songs)
    };
}

/** The summary as one line for a dialog or a notification: "14 playlists, 230 favorites, 1 history entry". Empty when there is nothing. */
export function backupContentsText(summary) {
    const s = summary || {};
    return [
        [s.playlists, 'playlist'],
        [s.favorites, 'favorite'],
        [s.ratings, 'rating'],
        [s.folders, 'folder'],
        [s.history, 'history entry', 'history entries'],
        [s.recents, 'recent song']
    ]
        .filter(([count]) => count > 0)
        .map(([count, one, many]) => `${count} ${count === 1 ? one : many || one + 's'}`)
        .join(', ');
}

const LISTS = ['playlists', 'folders', 'favorites', 'playHistory', 'recentlyPlayed', 'searchHistory', 'pinnedItems'];

/**
 * Checks a parsed file. Returns { ok: false, error } for something that is not a usable backup, or
 * { ok: true, data, summary, skipped } where `data` holds only the parts with the right shape (`skipped` names the others),
 * and `summary` is what the dialog shows.
 */
export function validateBackup(raw) {
    if (!isObject(raw)) return { ok: false, error: 'This is not an Xplayer backup file.' };
    if (raw.format !== undefined && raw.format !== BACKUP_FORMAT) return { ok: false, error: 'This file is not an Xplayer backup.' };
    const version = raw.version === undefined ? 1 : raw.version;
    if (!Number.isInteger(version) || version < 1) return { ok: false, error: 'The backup file has an unreadable version.' };
    if (version > BACKUP_VERSION) return { ok: false, error: 'This backup was made by a newer version of Xplayer. Update Xplayer to import it.' };

    const data = {};
    const skipped = [];
    for (const key of LISTS) {
        if (raw[key] === undefined) continue;
        if (Array.isArray(raw[key])) data[key] = raw[key];
        else skipped.push(key);
    }
    if (raw.ratings !== undefined) {
        if (isObject(raw.ratings)) data.ratings = raw.ratings;
        else skipped.push('ratings');
    }
    if (raw.songs !== undefined) {
        if (isObject(raw.songs)) data.songs = raw.songs;
        else skipped.push('songs');
    }
    if (data.playlists) data.playlists = data.playlists.filter((p) => isObject(p) && isId(p.id) && (p.songs === undefined || Array.isArray(p.songs)));
    if (data.folders) data.folders = data.folders.filter((f) => isObject(f) && isId(f.id));
    if (data.favorites) data.favorites = data.favorites.filter(isId);
    if (data.pinnedItems) data.pinnedItems = data.pinnedItems.filter(isId);
    for (const key of ['playHistory', 'recentlyPlayed', 'searchHistory']) if (data[key]) data[key] = data[key].filter(isObject);

    const summary = { ...summarizeBackup(data), version, exportDate: typeof raw.exportDate === 'string' ? raw.exportDate : '' };
    const usable = LISTS.some((key) => data[key] !== undefined) || data.ratings !== undefined;
    if (!usable) return { ok: false, error: 'The file has nothing in it that Xplayer can import.' };
    return { ok: true, data, summary, skipped };
}

/**
 * Gives the data's song ids the ids of the same songs in `library`. Returns { data, stats }:
 *   data   a copy with every song reference rewritten; references to songs not found here are left out
 *   stats  { legacy, total, matched, missing }: `legacy` is true for a file without a songs table (its ids cannot be checked and are kept
 *          as they are, except that history and recents look their song up by the file address they carry).
 */
export function remapBackup(data, library) {
    const match = buildSongMatcher(library);
    const table = isObject(data.songs) ? data.songs : null;
    const legacy = !table;
    const known = new Set((Array.isArray(library) ? library : []).filter((s) => s && isId(s.id)).map((s) => s.id));
    const cache = new Map(); // id -> new id, or null for a song not found
    const stats = { legacy, total: 0, matched: 0, missing: 0 };

    const mapId = (id) => {
        if (cache.has(id)) return cache.get(id);
        let result;
        if (table) {
            const identity = table[String(id)];
            const song = identity ? match(identity) : null;
            result = song ? song.id : null;
        } else {
            result = known.has(id) ? id : null;
        }
        cache.set(id, result);
        stats.total += 1;
        if (result === null) stats.missing += 1;
        else stats.matched += 1;
        return result;
    };
    const mapEntry = (entry) => {
        const song = match(songIdentity(entry)) || null; // a history entry carries its own song's address and tags
        if (song) return { ...entry, id: song.id };
        const id = isId(entry.id) ? mapId(entry.id) : null;
        return id === null ? null : { ...entry, id };
    };

    const out = { ...data };
    delete out.songs;
    if (data.playlists) out.playlists = data.playlists.map((p) => ({ ...p, songs: (p.songs || []).map(mapId).filter((id) => id !== null) }));
    if (data.favorites) out.favorites = [...new Set(data.favorites.map(mapId).filter((id) => id !== null))];
    if (data.ratings) {
        const ratings = {};
        for (const [id, value] of Object.entries(data.ratings)) {
            const target = mapId(/^-?\d+$/.test(id) ? Number(id) : id);
            if (target !== null && !(String(target) in ratings)) ratings[String(target)] = value;
        }
        out.ratings = ratings;
    }
    for (const key of ['playHistory', 'recentlyPlayed']) {
        if (data[key]) out[key] = data[key].map(mapEntry).filter(Boolean);
    }
    return { data: out, stats };
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ BACKUP_FORMAT, BACKUP_VERSION, summarizeBackup, backupContentsText, songIdentity, buildSongMatcher, collectSongIds, buildSongTable, validateBackup, remapBackup });
}

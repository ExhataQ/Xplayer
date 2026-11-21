// ==============================================================================
// RATING RULES
// ==============================================================================
// The pure part of the rating system: what counts as a rating, how a rating weighs in Smart Shuffle, how a tag value reads as stars,
// and which songs the Home playlists "Top rated" and "Not rated" hold. No DOM, no storage, no state: tools/tests/logic/rating-rules.test.js
// imports this file directly. The saved ratings and the settings are in library/03h-ratings.js.
//
// A rating is stars from 0.5 to 5 in steps of half a star (0.5, 1, 1.5 ... 5). 0 means "no rating": a song without one is neutral everywhere (never "bad").

export const MAX_STARS = 5;

// The settings of the rating system. Off by default (the owner's decision). `shuffleWeight`: Smart Shuffle favours higher ratings.
// `writeTags`: also write the rating into the song file where the format has a rating field (not built yet: no switch is shown for it).
export const RATING_DEFAULTS = { enabled: false, shuffleWeight: true, writeTags: true };

/** Stars 0 to 5 in halves (the nearest half star). Accepts a number or a numeric string; anything else (or out of range) is 0. */
export function normalizeRating(value) {
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
    const stars = Math.round(n * 2) / 2;
    return stars >= 0.5 && stars <= MAX_STARS ? stars : 0;
}

// ----- the rating in a file's tags -----
// MP3, WAV and AIFF keep a rating in an ID3 "popularimeter" frame (POPM) as a byte, 0 to 255. Windows Media Player, MusicBee, MediaMonkey, Mp3tag and
// foobar2000 read it with this table, which is NOT a straight line (3 stars is 128, not 153): 1 star 1, 2 stars 64, 3 stars 128, 4 stars 196,
// 5 stars 255, and the half stars between (13, 54, 118, 186, 242). The tag service (electron/tag-rules.js) has the same table; a test keeps them equal.
export const POPM_BYTES = { 0.5: 13, 1: 1, 1.5: 54, 2: 64, 2.5: 118, 3: 128, 3.5: 186, 4: 196, 4.5: 242, 5: 255 };
const POPM_ENTRIES = Object.entries(POPM_BYTES).map(([stars, byte]) => [Number(stars), byte]);

/** The POPM byte for stars (0 is no rating, byte 0). */
export function popmByteFromStars(stars) {
    return POPM_BYTES[normalizeRating(stars)] || 0;
}

/** The stars for a POPM byte: the nearest entry of the table; 0 is no rating. */
export function starsFromPopmByte(byte) {
    const b = Math.round(Number(byte));
    if (!Number.isFinite(b) || b <= 0 || b > 255) return 0;
    let best = 0;
    let gap = Infinity;
    for (const [stars, value] of POPM_ENTRIES) {
        const d = Math.abs(b - value);
        if (d < gap) {
            gap = d;
            best = stars;
        }
    }
    return best;
}

// What kinds of file keep the rating in a tag the app can write today. FLAC, OGG, Opus and M4A are not here until they are checked with real files; they keep the rating in the app only.
export const RATING_TAG_KINDS = ['id3'];
const ID3_EXTENSIONS = ['.mp3', '.mp2', '.mp1', '.wav', '.wave', '.aif', '.aiff'];

/** 'id3' for the files whose rating is a POPM byte, '' for the others. Give the file's url or path. */
export function tagKindOf(location) {
    const text = String(location ?? '').split(/[?#]/)[0].toLowerCase();
    return ID3_EXTENSIONS.some((ext) => text.endsWith(ext)) ? 'id3' : '';
}

/**
 * Stars from the rating text the library scan read out of a file's tags. The scan (music-metadata) gives a rating as 0 to 1. For an ID3 file
 * that is the POPM byte over 255 ("0.502" is byte 128, which is 3 stars: the table above); for the other kinds it is taken as a straight line
 * ("0.8" is four stars). Anything that is not above 0 and at most 1 is no rating. `kind` is tagKindOf(the file).
 */
export function ratingFromTagText(text, kind = '') {
    const v = typeof text === 'number' ? text : Number(String(text ?? '').trim());
    if (!Number.isFinite(v) || v <= 0 || v > 1) return 0;
    if (kind === 'id3') return starsFromPopmByte(v * 255);
    return normalizeRating(Math.round(v * MAX_STARS * 2) / 2);
}

export function ratingLabel(stars) {
    const n = normalizeRating(stars);
    return n === 0 ? 'Not rated' : n === 1 ? '1 star' : `${n} stars`; // 0.5 stars, 1 star, 1.5 stars, 2 stars ...
}

// How much more or less often Smart Shuffle takes a song, by stars. 3 stars and no rating are both 1: the rating system never
// pushes an unrated song down. Meant to nudge the pick, not to rule it: even a 1-star song still comes up.
const WEIGHTS = { 0: 1, 0.5: 0.25, 1: 0.35, 1.5: 0.5, 2: 0.65, 2.5: 0.8, 3: 1, 3.5: 1.3, 4: 1.6, 4.5: 2, 5: 2.4 };

export function ratingWeight(stars) {
    return WEIGHTS[normalizeRating(stars)];
}

/** Every rating a song can have, from the best down: for the song menu. */
export const RATING_CHOICES = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];

/**
 * The items in a random order where the heavier ones tend to come first (weighted sampling without replacement: each item gets
 * the key random^(1/weight), highest first). With equal weights it is an ordinary shuffle. `random` is for tests.
 */
export function weightedOrder(items, weightOf, random = Math.random) {
    return items
        .map((item) => {
            const w = Number(weightOf(item));
            const weight = Number.isFinite(w) && w > 0 ? w : 1;
            return { item, key: Math.pow(Math.max(random(), 1e-12), 1 / weight) };
        })
        .sort((a, b) => b.key - a.key)
        .map((entry) => entry.item);
}

/** What is saved for the ratings: an object of song id to stars. Keeps only valid ratings (0.5 to 5), as an object with string keys. */
export function parseRatings(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    for (const [id, value] of Object.entries(raw)) {
        const stars = normalizeRating(value);
        if (stars) out[String(id)] = stars;
    }
    return out;
}

/** The saved settings, with every key checked: only true or false is taken, the rest falls back to the default. */
export function normalizeRatingSettings(raw) {
    const out = { ...RATING_DEFAULTS };
    if (raw && typeof raw === 'object') for (const key of Object.keys(RATING_DEFAULTS)) if (typeof raw[key] === 'boolean') out[key] = raw[key];
    return out;
}

export const TOP_RATED_FROM = 4;

/**
 * The songs of a Home playlist of ratings. `kind` is 'top-rated' (4 stars and up, best first) or 'not-rated' (no rating, in the given order).
 * `ratingOf(song)` gives each song's stars. Anything else gives an empty list.
 */
export function ratingPlaylist(kind, songs, ratingOf) {
    if (kind === 'top-rated') {
        return songs
            .map((song, index) => ({ song, index, stars: normalizeRating(ratingOf(song)) }))
            .filter((x) => x.stars >= TOP_RATED_FROM)
            .sort((a, b) => b.stars - a.stars || a.index - b.index)
            .map((x) => x.song);
    }
    if (kind === 'not-rated') return songs.filter((song) => normalizeRating(ratingOf(song)) === 0);
    return [];
}

// ----- the playlists Top rated and Not rated -----
// Two real playlists the rating system keeps up to date by itself (library/03i-rating-playlists.js): they exist while the system is on, hold
// what ratingPlaylist() says, and carry `smart: 'top-rated'` or `smart: 'not-rated'` so the app knows they are not the person's to edit.
// Each has its own cover (an inline SVG, so every list that draws a playlist cover shows it, the engine's rows and the new views alike): a lit
// star for the best songs, a dashed empty one for the songs still waiting for a rating. It is not the person's to change, so it is kept in step here.
const svgCover = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
export const RATING_PLAYLISTS = [
    { kind: 'top-rated', name: 'Top rated', cover: svgCover('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb84d"/><stop offset="1" stop-color="#e8452c"/></linearGradient><radialGradient id="h" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe8"/><stop offset="1" stop-color="#ffe08a"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><rect width="400" height="400" fill="url(#h)"/><g stroke="#fff" stroke-opacity=".22" stroke-width="6" stroke-linecap="round"><path d="M200 40v28M40 196h28M332 196h28M87 83l20 20M313 83l-20 20"/></g><polygon points="200.0,92.0 227.0,158.8 298.9,163.9 243.7,210.2 261.1,280.1 200.0,242.0 138.9,280.1 156.3,210.2 101.1,163.9 173.0,158.8" fill="#8a1f0f" opacity=".28" transform="translate(0 9)"/><polygon points="200.0,92.0 227.0,158.8 298.9,163.9 243.7,210.2 261.1,280.1 200.0,242.0 138.9,280.1 156.3,210.2 101.1,163.9 173.0,158.8" fill="url(#s)" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><g fill="#fff" fill-opacity=".9"><polygon points="92.0,296.0 97.3,310.7 112.9,311.2 100.6,320.8 104.9,335.8 92.0,327.0 79.1,335.8 83.4,320.8 71.1,311.2 86.7,310.7"/><polygon points="200.0,310.0 206.5,327.1 224.7,328.0 210.5,339.4 215.3,357.0 200.0,347.0 184.7,357.0 189.5,339.4 175.3,328.0 193.5,327.1"/><polygon points="308.0,296.0 313.3,310.7 328.9,311.2 316.6,320.8 320.9,335.8 308.0,327.0 295.1,335.8 299.4,320.8 287.1,311.2 302.7,310.7"/></g></svg>') },
    { kind: 'not-rated', name: 'Not rated', cover: svgCover('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a5278"/><stop offset="1" stop-color="#1c1f33"/></linearGradient><radialGradient id="h" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="400" height="400" fill="url(#g)"/><rect width="400" height="400" fill="url(#h)"/><polygon points="200.0,92.0 227.0,158.8 298.9,163.9 243.7,210.2 261.1,280.1 200.0,242.0 138.9,280.1 156.3,210.2 101.1,163.9 173.0,158.8" fill="#fff" fill-opacity=".06" stroke="#fff" stroke-opacity=".8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 22"/><g fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="5" stroke-linejoin="round"><polygon points="92.0,296.0 97.3,310.7 112.9,311.2 100.6,320.8 104.9,335.8 92.0,327.0 79.1,335.8 83.4,320.8 71.1,311.2 86.7,310.7"/><polygon points="200.0,310.0 206.5,327.1 224.7,328.0 210.5,339.4 215.3,357.0 200.0,347.0 184.7,357.0 189.5,339.4 175.3,328.0 193.5,327.1"/><polygon points="308.0,296.0 313.3,310.7 328.9,311.2 316.6,320.8 320.9,335.8 308.0,327.0 295.1,335.8 299.4,320.8 287.1,311.2 302.7,310.7"/></g></svg>') }
];

const sameIds = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);

/** True for a playlist the rating system keeps (give the playlist object). */
export const isRatingPlaylist = (playlist) => Boolean(playlist) && typeof playlist === 'object' && RATING_PLAYLISTS.some((p) => p.kind === playlist.smart);

/**
 * What the playlists should be now. Pure: nothing is saved here.
 *   enabled     is the rating system on (off: the two playlists are removed)
 *   playlists   all the playlists as saved
 *   songs       every song of the library; ratingOf(song) its stars
 *   makeId, now make the id and the date of a playlist that has to be created
 * A playlist is created only when it would hold at least one song, and kept (even empty) once it exists, so a list the person has open does not vanish
 * under them. Answers { playlists, changed, added: [ids], removed: [ids], touched: [ids] }; `playlists` is the same array when nothing changed, and
 * `touched` are the playlists that were created or whose songs changed (for redrawing the one that is open).
 */
export function planRatingPlaylists({ enabled, playlists, songs, ratingOf, makeId, now }) {
    if (!enabled) {
        const gone = playlists.filter(isRatingPlaylist);
        return gone.length ? { playlists: playlists.filter((p) => !isRatingPlaylist(p)), changed: true, added: [], removed: gone.map((p) => p.id), touched: [] } : { playlists, changed: false, added: [], removed: [], touched: [] };
    }
    let next = playlists;
    const added = [];
    const touched = [];
    for (const { kind, name, cover } of RATING_PLAYLISTS) {
        const wanted = ratingPlaylist(kind, songs, ratingOf).map((song) => song.id);
        const at = next.findIndex((p) => p && p.smart === kind);
        if (at === -1) {
            if (!wanted.length) continue;
            const made = { id: makeId(), name, songs: wanted, smart: kind, createdAt: now, cover };
            next = [...next, made];
            added.push(made.id);
            touched.push(made.id);
        } else if (!sameIds(next[at].songs || [], wanted)) {
            next = next.map((p, i) => (i === at ? { ...p, songs: wanted, cover } : p));
            touched.push(next[at].id);
        } else if (next[at].cover !== cover) {
            next = next.map((p, i) => (i === at ? { ...p, cover } : p)); // a list made before the covers existed
        }
    }
    return { playlists: next, changed: next !== playlists, added, removed: [], touched };
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ MAX_STARS, RATING_CHOICES, RATING_DEFAULTS, RATING_PLAYLISTS, POPM_BYTES, RATING_TAG_KINDS, popmByteFromStars, starsFromPopmByte, tagKindOf, isRatingPlaylist, planRatingPlaylists, normalizeRating, ratingFromTagText, ratingLabel, ratingWeight, weightedOrder, parseRatings, normalizeRatingSettings, ratingPlaylist });
}

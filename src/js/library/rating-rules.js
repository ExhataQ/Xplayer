// ==============================================================================
// RATING RULES (task B3)
// ==============================================================================
// The pure part of the rating system: what counts as a rating, how a rating weighs in Smart Shuffle, how a tag value reads as stars,
// and which songs the Home playlists "Top rated" and "Not rated" hold. No DOM, no storage, no state: tools/tests/rating-rules.test.js
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

/**
 * Stars from the rating text the library scan read out of a file's tags. The scan (music-metadata) gives a rating as 0 to 1
 * ("0.8" is four stars of five, "0.7" three and a half). Anything that is not above 0 and at most 1 is no rating.
 */
export function ratingFromTagText(text) {
    const v = typeof text === 'number' ? text : Number(String(text ?? '').trim());
    if (!Number.isFinite(v) || v <= 0 || v > 1) return 0;
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
export const RATING_PLAYLISTS = [
    { kind: 'top-rated', name: 'Top rated' },
    { kind: 'not-rated', name: 'Not rated' }
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
    for (const { kind, name } of RATING_PLAYLISTS) {
        const wanted = ratingPlaylist(kind, songs, ratingOf).map((song) => song.id);
        const at = next.findIndex((p) => p && p.smart === kind);
        if (at === -1) {
            if (!wanted.length) continue;
            const made = { id: makeId(), name, songs: wanted, smart: kind, createdAt: now };
            next = [...next, made];
            added.push(made.id);
            touched.push(made.id);
        } else if (!sameIds(next[at].songs || [], wanted)) {
            next = next.map((p, i) => (i === at ? { ...p, songs: wanted } : p));
            touched.push(next[at].id);
        }
    }
    return { playlists: next, changed: next !== playlists, added, removed: [], touched };
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ MAX_STARS, RATING_CHOICES, RATING_DEFAULTS, RATING_PLAYLISTS, isRatingPlaylist, planRatingPlaylists, normalizeRating, ratingFromTagText, ratingLabel, ratingWeight, weightedOrder, parseRatings, normalizeRatingSettings, ratingPlaylist });
}

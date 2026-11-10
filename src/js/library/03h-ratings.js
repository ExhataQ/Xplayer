// ==============================================================================
// RATINGS (task B3): the saved ratings and the Rating system settings
// ==============================================================================
// A rating is stars (0.5 to 5, in halves) saved per song id, like favorites. The app keeps its own copy always; writing it into the file's tags
// is a separate step (a switch under Rating system, not built yet). While the system is off the ratings stay saved but nothing shows
// and nothing uses them. The rules (what counts as a rating, the shuffle weight, the Home playlists) are in library/rating-rules.js.

export function getRatingSettings() {
    return normalizeRatingSettings(storageReadJson(STORAGE_KEYS.RATING_SETTINGS, {}));
}

export function isRatingSystemOn() {
    return getRatingSettings().enabled;
}

export function setRatingSetting(key, value) {
    if (!(key in RATING_DEFAULTS) || typeof value !== 'boolean') return getRatingSettings();
    const settings = { ...getRatingSettings(), [key]: value };
    storageWriteJson(STORAGE_KEYS.RATING_SETTINGS, settings);
    emit('ratingSettings:changed', { key, value, settings });
    return settings;
}

/** All saved ratings: { songId: stars }. */
export function getRatings() {
    return storageReadJson(STORAGE_KEYS.RATINGS, {}, parseRatings);
}

/** The stars (0 to 5) saved for one song id. 0 = none. Does not look at the setting: the callers do. */
export function getRating(songId) {
    return normalizeRating(getRatings()[String(songId)]);
}

/**
 * The stars of a song: the one saved here, else the one the library scan read from the file's tags (so a rating set in another
 * player shows at once). 0 = none.
 */
export function ratingOf(song) {
    if (!song) return 0;
    return getRating(song.id) || ratingFromTagText(song.rating);
}

/**
 * The stars (0 to 5) of many songs at once, in the order of the ids: for the song list, which asks for a whole batch of rows. One read of the
 * saved ratings and one index of the songs, instead of one of each per row.
 */
export function ratingsForSongIds(ids) {
    const saved = getRatings();
    const byId = new Map();
    if (typeof SONGS_DATA !== 'undefined') for (const song of SONGS_DATA) byId.set(String(song.id), song);
    return ids.map((id) => normalizeRating(saved[String(id)]) || ratingFromTagText((byId.get(String(id)) || {}).rating));
}

// Goes up whenever the saved ratings change: the sort of a list by rating remembers its last result and asks this to know it is still good.
let version = 0;
export const ratingsVersion = () => version;
export function bumpRatingsVersion() {
    version += 1;
}

/** Saves the stars for a song (0 clears it). Tells everyone listening with ratings:changed. Answers the stars saved. */
export function setRating(songId, stars) {
    const n = normalizeRating(stars);
    const ratings = getRatings();
    if (n) ratings[String(songId)] = n;
    else delete ratings[String(songId)];
    storageWriteJson(STORAGE_KEYS.RATINGS, ratings);
    bumpRatingsVersion();
    emit('ratings:changed', { songId, rating: n });
    return n;
}

/**
 * The songs in the order Smart Shuffle should try them. With the rating system on and "Smart Shuffle uses ratings" on, higher
 * ratings tend to come first (unrated songs are neutral); otherwise a plain random order, as it always was.
 */
export function songsInShuffleOrder(songs) {
    const settings = getRatingSettings();
    if (settings.enabled && settings.shuffleWeight) return weightedOrder(songs, (song) => ratingWeight(ratingOf(song)));
    return [...songs].sort(() => Math.random() - 0.5);
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ getRatingSettings, isRatingSystemOn, setRatingSetting, getRatings, getRating, ratingOf, ratingsForSongIds, ratingsVersion, bumpRatingsVersion, setRating, songsInShuffleOrder });
}

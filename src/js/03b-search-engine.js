// ==============================================================================
// SEARCH ENGINE
// One matcher / ranker / filter used by every song search in the app (main search box, the
// in-list search, search history, and next/previous while playing from search results).
// Pure functions: no DOM, no globals - they can be tested on their own.
// ==============================================================================

// "Beyoncé", "BEYONCE" and "beyonce" are the same; apostrophes are ignored ("Don't" = "Dont",
// which also matches titles the scanner stored without quotes); extra spaces collapse.
function normalizeSearchText(value) {
    return String(value === undefined || value === null ? '' : value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/['’‘`´]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const SEARCH_FIELD_WEIGHTS = { title: 100, artist: 70, album: 50, albumArtist: 40 };
const SEARCH_MATCH_FACTORS = { exact: 1, prefix: 0.8, wordPrefix: 0.6, substring: 0.35 };

// Normalized fields per song, cached by the raw values so a metadata edit is picked up.
const searchFieldCache = new WeakMap();
function getSearchFields(song) {
    const raw = [song.title, song.artist, song.album, song.albumArtist];
    const cached = searchFieldCache.get(song);
    if (cached && cached.raw.every((value, i) => value === raw[i])) return cached.fields;
    const fields = {
        title: normalizeSearchText(raw[0]),
        artist: normalizeSearchText(raw[1]),
        album: normalizeSearchText(raw[2]),
        albumArtist: normalizeSearchText(raw[3])
    };
    searchFieldCache.set(song, { raw, fields });
    return fields;
}

// How well `token` matches `text`: exact > starts with > starts a word > appears somewhere.
function matchFactor(text, token) {
    if (!text) return 0;
    if (text === token) return SEARCH_MATCH_FACTORS.exact;
    if (text.startsWith(token)) return SEARCH_MATCH_FACTORS.prefix;
    const at = text.indexOf(token);
    if (at === -1) return 0;
    if (text.indexOf(' ' + token) !== -1) return SEARCH_MATCH_FACTORS.wordPrefix;
    return SEARCH_MATCH_FACTORS.substring;
}

// Score of one song for a query, or 0 when it does not match. EVERY word of the query must be
// found (in any field), so "queen jazz" finds Queen's album Jazz.
function scoreSong(song, normalizedQuery, tokens) {
    const fields = getSearchFields(song);
    let total = 0;
    for (const token of tokens) {
        let best = 0;
        for (const field in SEARCH_FIELD_WEIGHTS) {
            const factor = matchFactor(fields[field], token);
            if (factor) best = Math.max(best, SEARCH_FIELD_WEIGHTS[field] * factor);
        }
        if (!best) return 0;
        total += best;
    }
    if (fields.title === normalizedQuery) total += 50;
    else if (fields.title.startsWith(normalizedQuery)) total += 25;
    return total;
}

function toFilterList(value) {
    if (value === undefined || value === null || value === '') return [];
    return (Array.isArray(value) ? value : [value]).map(normalizeSearchText).filter(Boolean);
}

// Filters (all optional, all combined with AND):
//   artist, album, genre : one value or a list; a song matches if it has ANY of them
//   yearFrom, yearTo     : inclusive
//   minDuration, maxDuration : seconds, inclusive
function applySongFilters(songs, filters) {
    if (!filters) return songs.slice();
    const artists = toFilterList(filters.artist);
    const albums = toFilterList(filters.album);
    const genres = toFilterList(filters.genre);
    const yearFrom = filters.yearFrom === undefined || filters.yearFrom === '' ? null : Number(filters.yearFrom);
    const yearTo = filters.yearTo === undefined || filters.yearTo === '' ? null : Number(filters.yearTo);
    const minDuration = filters.minDuration === undefined || filters.minDuration === '' ? null : Number(filters.minDuration);
    const maxDuration = filters.maxDuration === undefined || filters.maxDuration === '' ? null : Number(filters.maxDuration);

    return songs.filter((song) => {
        if (artists.length && !artists.includes(normalizeSearchText(song.artist))) return false;
        if (albums.length && !albums.includes(normalizeSearchText(song.album))) return false;
        if (genres.length) {
            const songGenres = normalizeSearchText(song.genre).split(/[,;/]/).map((g) => g.trim());
            if (!genres.some((g) => songGenres.includes(g))) return false;
        }
        if (yearFrom !== null || yearTo !== null) {
            const year = parseInt(song.year, 10);
            if (!Number.isFinite(year)) return false;
            if (yearFrom !== null && year < yearFrom) return false;
            if (yearTo !== null && year > yearTo) return false;
        }
        if (minDuration !== null || maxDuration !== null) {
            const duration = Number(song.duration);
            if (!Number.isFinite(duration)) return false;
            if (minDuration !== null && duration < minDuration) return false;
            if (maxDuration !== null && duration > maxDuration) return false;
        }
        return true;
    });
}

// The one search function.
//   options.rank    true (default): best matches first, ties keep the original order.
//                   false: keep the list's own order (use when filtering a playlist/album).
//   options.filters see applySongFilters. Works with an empty query too.
// Returns a new array; never throws on songs with missing fields.
function searchSongs(songs, query, options) {
    const list = Array.isArray(songs) ? songs : [];
    const opts = options || {};
    const candidates = opts.filters ? applySongFilters(list, opts.filters) : list.slice();
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return candidates;

    const tokens = normalizedQuery.split(' ');
    const scored = [];
    for (let i = 0; i < candidates.length; i++) {
        const score = scoreSong(candidates[i], normalizedQuery, tokens);
        if (score > 0) scored.push({ song: candidates[i], score, index: i });
    }
    if (opts.rank !== false) scored.sort((a, b) => b.score - a.score || a.index - b.index);
    return scored.map((entry) => entry.song);
}

// Search results for a query over the songs that are currently in the library (not deleted).
function getSearchResults(query, options) {
    return searchSongs(getActiveSongs(), query, options);
}

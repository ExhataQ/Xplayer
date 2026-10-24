// ==============================================================================
// SONG SORT (task PB-08, decision DP13 option A)
// The order of a song list when the person clicks Title, Album or Time in the track list header.
// One sort per list id ('all-songs', 'playlist-<id>', an album id, ...), kept in memory for this session. Nothing is stored on disk.
// getSongsForList (ui/07-views.js) and renderSongsList (ui/04a-ui-render-core.js) both call applyListSort, so the rows on screen, the
// positions a click reports, shift-select, the ghost lists and the play queue all read the same order.
// Pure functions (no DOM, no storage) so they can be tested on their own. This file is an ES module (see src/js/main.js).
// ==============================================================================

export const SORT_KEYS = ['title', 'album', 'time'];

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** A duration in seconds from a number (180), "3:05" or "1:02:03". Anything else (including '—') is null. */
export function parseDuration(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
    const parts = text.split(':');
    if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
    return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

function sortValue(song, key) {
    if (key === 'time') return parseDuration(song.duration);
    const text = (key === 'album' ? song.album : song.title) || '';
    return typeof text === 'string' && text.trim() ? text.trim() : null;
}

/** Compares two songs for one key. Missing values sort after every present value, whatever the direction. */
export function compareSongs(a, b, key, dir = 'asc') {
    const x = sortValue(a, key);
    const y = sortValue(b, key);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    const order = typeof x === 'number' ? x - y : collator.compare(x, y);
    return dir === 'desc' ? -order : order;
}

/** A new array in the requested order. The input is not changed. Equal songs keep their current order. */
export function sortSongs(songs, key, dir = 'asc') {
    if (!SORT_KEYS.includes(key)) return [...songs];
    return songs
        .map((song, index) => ({ song, index }))
        .sort((a, b) => compareSongs(a.song, b.song, key, dir) || a.index - b.index)
        .map(({ song }) => song);
}

const listSorts = new Map();
const sortedCache = new Map(); // see applyListSort

/** Lists that can be sorted: the ones whose rows are drawn by renderSongsList from the same songs getSongsForList returns. That is All
 *  Songs, Favorites, a playlist, an album and an artist. History, Recent and search results are left out: History draws its own rows by
 *  position (ui/04e renderHistoryView) and removes entries by position, and the other two are not stable lists, so a sort there would
 *  put the queue and the rows in different orders. */
export function isSongListSortable(listId) {
    if (typeof listId !== 'string') return false;
    if (listId === 'all-songs' || listId === 'favorites' || listId.startsWith('playlist-')) return true;
    return listId.length === 13 && (listId[0] === 'a' || listId[0] === 'r');
}

/** The sort of a list as { key, dir }, or null for the list's own order. */
export function getSongListSort(listId) {
    const sort = listSorts.get(listId);
    return sort ? { ...sort } : null;
}

/** Sets a list's sort. A key that is not Title, Album or Time clears it. A list that cannot be sorted is never given one. Returns what is set now. */
export function setSongListSort(listId, key, dir = 'asc') {
    if (!isSongListSortable(listId)) return null;
    sortedCache.delete(listId);
    if (!SORT_KEYS.includes(key)) {
        listSorts.delete(listId);
        return null;
    }
    const sort = { key, dir: dir === 'desc' ? 'desc' : 'asc' };
    listSorts.set(listId, sort);
    return { ...sort };
}

// The field a sort reads, as stored on the song (so an edit made in place is noticed).
const rawField = (song, key) => (key === 'time' ? song.duration : key === 'album' ? song.album : song.title);

// One remembered result per list. A sorted list is asked for on every click and every song change, and sorting 20,000 songs takes
// about 60 ms, so the last result is reused while the input is exactly what it was sorted from: the same songs, in the same order,
// with the same value in the sorted field. Checking that is one pass with no sorting. Anything else sorts again.
function cachedResult(listId, sort, songs) {
    const hit = sortedCache.get(listId);
    if (!hit || hit.key !== sort.key || hit.dir !== sort.dir || hit.refs.length !== songs.length) return null;
    for (let i = 0; i < songs.length; i++) {
        if (songs[i] !== hit.refs[i] || rawField(songs[i], sort.key) !== hit.values[i]) return null;
    }
    return hit.out;
}

/** The songs in the list's sort. With no sort set it returns the SAME array it was given, so callers that compare arrays are not affected. */
export function applyListSort(listId, songs) {
    const sort = listSorts.get(listId);
    if (!sort || !Array.isArray(songs) || songs.length < 2) return songs;
    const reused = cachedResult(listId, sort, songs);
    if (reused) return reused;
    const out = sortSongs(songs, sort.key, sort.dir);
    sortedCache.set(listId, { key: sort.key, dir: sort.dir, refs: songs.slice(), values: songs.map((song) => rawField(song, sort.key)), out });
    return out;
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ isSongListSortable, getSongListSort, setSongListSort, applyListSort });
}

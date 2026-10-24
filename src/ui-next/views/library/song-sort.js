// Song sort, header side (task PB-08): what a click on Title, Album or Time does. The sorting itself is the engine's
// (src/js/library/03n-song-sort.js, applied inside getSongsForList and renderSongsList, decision DP13 option A), so the rows,
// the clicks, shift-select and the play queue all follow one order. This file only decides the next state.
// A state is { key, dir } or null for the list's own order.

export const SORT_KEYS = ['title', 'album', 'time'];

/** What a header click does: a new column sorts ascending; the same column goes descending, then back to the list's own order. */
export function nextSort(current, key) {
    if (!SORT_KEYS.includes(key)) return current || null;
    if (!current || current.key !== key) return { key, dir: 'asc' };
    return current.dir === 'asc' ? { key, dir: 'desc' } : null;
}

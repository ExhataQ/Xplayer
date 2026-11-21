// Song sort, header side: what a click on Title, Album or Time does. The sorting itself is the engine's
// (src/js/library/03n-song-sort.js, applied inside getSongsForList and renderSongsList), so the rows,
// the clicks, shift-select and the play queue all follow one order. This file only decides the next state.
// A state is { key, dir } or null for the list's own order.

export const SORT_KEYS = ['title', 'album', 'time', 'rating'];

// The direction a column sorts in first. Names and times go from the start; the rating goes from the best (top to bottom: 5 stars first).
const FIRST_DIR = { rating: 'desc' };

/** The direction a column sorts in when it is chosen first (the rating: best first; the others ascending). */
export const firstDirection = (key) => FIRST_DIR[key] || 'asc';

/** What a header click does: a new column sorts in its first direction (ascending, the rating best first); the same column goes the other way, then back to the list's own order. */
export function nextSort(current, key) {
    if (!SORT_KEYS.includes(key)) return current || null;
    const first = FIRST_DIR[key] || 'asc';
    if (!current || current.key !== key) return { key, dir: first };
    return current.dir === first ? { key, dir: first === 'asc' ? 'desc' : 'asc' } : null;
}

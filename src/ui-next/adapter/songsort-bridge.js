// songsort-bridge (task PB-08): what the track list header may ask of the engine's song sort (library/03n-song-sort.js).
// It is separate from songlist-bridge.js, which has a size cap of its own (ui-next-songlist.test.js). Read and ask only; the sorting
// itself, and keeping the rows, the clicks and the play queue in one order, is the engine's (decision DP13, option A).

const engine = () => window;

/** True when the engine can sort this list: All Songs, Favorites, a playlist, an album or an artist. History and Recent cannot. */
export const canSortList = (view) => typeof engine().isSongListSortable === 'function' && engine().isSongListSortable(view);

/** A list's sort as { key: 'title' | 'album' | 'time', dir: 'asc' | 'desc' }, or null for the list's own order. */
export const listSort = (view) => (typeof engine().getSongListSort === 'function' ? engine().getSongListSort(view) : null);

/** Sets a list's sort (a key of null clears it). The engine draws the list again in the new order and keeps the playing row marked. */
export function changeListSort(view, key, dir) {
    if (typeof engine().changeSongListSort === 'function') engine().changeSongListSort(view, key, dir);
}

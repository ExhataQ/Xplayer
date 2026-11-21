// duplicates-bridge: what the Duplicates page asks of the engine (library/duplicates-hidden.js) and of the library.
//
//   librarySongs()                 every song that is in the library and not removed (hidden duplicates are in it, with hidden: true)
//   decisions()                    { hidden: [url], notDuplicates: [signature] }
//   hideSongs(urls), showSongs(urls | undefined)   hide, or show again (no argument: all)
//   notDuplicates(signature), forgetNotDuplicates()
//   moveToKept([{ from, to }])     playlists and favourites that hold a copy get the kept song instead; answers how many playlists changed
//   trashSongs(ids)                the files go to the Recycle Bin; answers how many were sent
//   usageOf(songs)                 { [id]: { plays, rating } }: what the person did with each song (for choosing the one to keep)
import { engineCall, engineEvent } from './engine-api.js';

const engine = () => window;

export function librarySongs() {
    const songs = Array.isArray(engine().SONGS_DATA) ? engine().SONGS_DATA : [];
    const deleted = engine().deletedSongIds;
    const hidden = new Set(decisions().hidden);
    return songs.filter((s) => !(deleted && deleted.has(s.id)) || hidden.has(s.url)).map((s) => (hidden.has(s.url) ? { ...s, hidden: true } : s));
}

export const decisions = () => engineCall('getDuplicateDecisions') || { hidden: [], notDuplicates: [] };
export const hideSongs = (urls) => engineCall('hideDuplicateSongs', urls);
export const showSongs = (urls) => engineCall('showHiddenDuplicates', urls);
export const notDuplicates = (signature) => engineCall('markNotDuplicates', signature);
export const forgetNotDuplicates = () => engineCall('forgetNotDuplicates');
export const moveToKept = (moves) => engineCall('moveToKeptSong', moves) || 0;
export const trashSongs = async (ids) => (await engineCall('trashDuplicateSongs', ids)) || 0;
export const onDuplicatesChanged = (callback) => engineEvent('duplicates:changed', callback);

export function usageOf(songs) {
    const out = {};
    const ids = songs.map((s) => s.id);
    const stars = engineCall('ratingsForSongIds', ids) || ids.map(() => 0);
    const favorites = new Set(engineCall('getFavorites') || []);
    songs.forEach((song, i) => {
        out[song.id] = { plays: Number(song.playCount) || 0, rating: Number(stars[i]) || 0, favorite: favorites.has(song.id) };
    });
    return out;
}

export function showInFolder(song) {
    const api = window.desktopApi;
    if (!api || typeof api.supports !== 'function' || !api.supports('files.showFileInExplorer')) return false;
    api.files.showFileInExplorer(String(song.url || '').replace('file:///', '').replace(/\//g, '\\'));
    return true;
}

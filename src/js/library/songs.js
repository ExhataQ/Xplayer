// ==============================================================================
// SONG LIBRARY HELPERS
// ==============================================================================

// Soft-delete bookkeeping over SONGS_DATA (declared in player.js, which is built from
// 99-player.js). Everything here reads SONGS_DATA at call time only.

export const deletedSongIds = new Set();

export function getActiveSongs() {
    return SONGS_DATA.filter((s) => !deletedSongIds.has(s.id));
}

export function markSongAsDeleted(songId) {
    deletedSongIds.add(songId);
}

export function filterDeletedSongs(songs) {
    if (!songs) return [];
    return songs.filter((s) => s && !deletedSongIds.has(s.id));
}

export function getActiveFavoritesCount() {
    return filterDeletedSongs(getFavorites().map((id) => SONGS_DATA.find((s) => s.id === id))).length;
}

// Classic scripts and inline handlers still call these by name; registered until the final flip.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        getActiveSongs,
        markSongAsDeleted,
        filterDeletedSongs,
        getActiveFavoritesCount,
        deletedSongIds
    });
}

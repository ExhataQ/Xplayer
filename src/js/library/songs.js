// ==============================================================================
// SONG LIBRARY HELPERS
// ==============================================================================

// Soft-delete bookkeeping over SONGS_DATA (declared in player.js, which is built from
// 99-player.js). Everything here reads SONGS_DATA at call time only.

const deletedSongIds = new Set();

function getActiveSongs() {
    return SONGS_DATA.filter((s) => !deletedSongIds.has(s.id));
}

function markSongAsDeleted(songId) {
    deletedSongIds.add(songId);
}

function filterDeletedSongs(songs) {
    if (!songs) return [];
    return songs.filter((s) => s && !deletedSongIds.has(s.id));
}

function getActiveFavoritesCount() {
    return filterDeletedSongs(getFavorites().map((id) => SONGS_DATA.find((s) => s.id === id))).length;
}

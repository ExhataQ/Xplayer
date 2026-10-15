// ==============================================================================
// PLAYBACK - SHUFFLE SYSTEM
// ==============================================================================
export function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

export function createShuffleOrder(songs, excludeSongId = null, isDeleted = (id) => deletedSongIds.has(id)) {
    let ids = songs
        .filter((song) => song && !isDeleted(song.id))
        .map((song) => song.id);

    if (excludeSongId !== null && ids.length > 1) {
        ids = ids.filter((id) => id !== excludeSongId);
    }

    return shuffleArray(ids);
}

export function resetShuffle(songs = null, excludeSongId = null, sourceId = currentView) {
    const sourceSongs = songs || getSongsForList(sourceId);
    shuffleOrder = createShuffleOrder(sourceSongs, excludeSongId);
    shuffleIndex = 0;
    shuffleSourceId = sourceId;
}

export function clearShuffle() {
    shuffleOrder = [];
    shuffleIndex = 0;
    shuffleSourceId = null;
    smartShuffleJourney = [];
    smartShuffleJourneyIndex = 0;
    smartShuffleSourceId = null;
    smartShufflePreviousSong = null;
}

export function getSongDurationSeconds(song) {
    const parts = String(song?.duration || '0:00').split(':').map(Number);
    return parts.length === 2 && parts.every(Number.isFinite) ? parts[0] * 60 + parts[1] : 0;
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ shuffleArray, createShuffleOrder, resetShuffle, clearShuffle, getSongDurationSeconds });
}

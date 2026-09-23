// ==============================================================================
// PLAYBACK - SHUFFLE STATE
// ==============================================================================
let shuffleOrder = [];
let shuffleIndex = 0;
let shuffleSourceId = null;
let smartShuffleJourney = [];
let smartShuffleJourneyIndex = 0;
let smartShuffleSourceId = null;
let smartShufflePreviousSong = null;

// ==============================================================================
// PLAYBACK - SHUFFLE SYSTEM
// ==============================================================================
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function createShuffleOrder(songs, excludeSongId = null) {
    let ids = songs
        .filter((song) => song && !deletedSongIds.has(song.id))
        .map((song) => song.id);

    if (excludeSongId !== null && ids.length > 1) {
        ids = ids.filter((id) => id !== excludeSongId);
    }

    return shuffleArray(ids);
}

function resetShuffle(songs = null, excludeSongId = null, sourceId = currentView) {
    const sourceSongs = songs || getSongsForList(sourceId);
    shuffleOrder = createShuffleOrder(sourceSongs, excludeSongId);
    shuffleIndex = 0;
    shuffleSourceId = sourceId;
}

function clearShuffle() {
    shuffleOrder = [];
    shuffleIndex = 0;
    shuffleSourceId = null;
    smartShuffleJourney = [];
    smartShuffleJourneyIndex = 0;
    smartShuffleSourceId = null;
    smartShufflePreviousSong = null;
}

function getSongDurationSeconds(song) {
    const parts = String(song?.duration || '0:00').split(':').map(Number);
    return parts.length === 2 && parts.every(Number.isFinite) ? parts[0] * 60 + parts[1] : 0;
}


// ==============================================================================
// RECENTLY PLAYED & PLAY HISTORY
// The saved lists only: the screens redraw from the events emitted here (04h-recents-history-events.js).
// ==============================================================================
// A file opened from Windows is not a saved song (it has no library id): it is left out of recents and history.
function isExternalSong(song) {
    const actual = song && (song.song || song);
    return Boolean(actual && actual.external);
}

export function saveToRecentlyPlayed(song) {
    if (isExternalSong(song)) return;
    // List logic (move-to-top instead of duplicating, cap, clean-up) lives in 03a-recents.js.
    const recentSongs = addToRecentList(storageReadJson(STORAGE_KEYS.RECENTLY_PLAYED, [], normalizeObjectList), song, Date.now(), MAX_RECENT_SONGS);

    // A failed save (for example the quota) is logged by storageWriteJson and must not stop playback.
    storageWriteJson(STORAGE_KEYS.RECENTLY_PLAYED, recentSongs);
    updateRecentCount();
    emit('recents:added', { song });
}


export function getRecentlyPlayed() {
    const recentSongs = storageReadJson(STORAGE_KEYS.RECENTLY_PLAYED, [], normalizeObjectList);
    return recentSongs;
}


export function updateRecentCount() {
    emit('recents:countChanged', { count: getRecentCount() });
}


export async function clearRecentlyPlayed() {
    const confirmed = await showConfirmDialog({
        title: 'Clear Recently Played',
        message: 'Clear all recently played songs? This cannot be undone.',
        okText: 'Clear',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        storageRemove(STORAGE_KEYS.RECENTLY_PLAYED);
        clearGhostList(VIEWS.RECENT);
        updateRecentCount();
        emit('recents:cleared');
    }
}


// ==============================================================================
// PLAY HISTORY
// ==============================================================================
export function saveToPlayHistory(song, playDuration) {
    if (isExternalSong(song)) return;
    const actualSong = song.song || song;

    let history = storageReadJson(STORAGE_KEYS.PLAY_HISTORY, [], normalizeObjectList);

    const ghostSlotId = addHistoryGhostSlot(actualSong.id);

    const historyEntry = {
        id: actualSong.id,
        title: actualSong.title,
        artist: actualSong.artist,
        album: actualSong.album,
        cover: actualSong.cover,
        duration: actualSong.duration,
        url: actualSong.url,
        playedAt: Date.now(),
        playedDate: new Date().toLocaleString(),
        playDurationSeconds: Math.floor(playDuration / 1000),
        ghostSlotId: ghostSlotId
    };

    history.unshift(historyEntry);

    if (history.length > MAX_HISTORY_ENTRIES) {
        history = history.slice(0, MAX_HISTORY_ENTRIES);
    }

    storageWriteJson(STORAGE_KEYS.PLAY_HISTORY, history);

    emit('history:added');
}


export function getPlayHistory() {
    return storageReadJson(STORAGE_KEYS.PLAY_HISTORY, [], normalizeObjectList);
}


export async function clearPlayHistory() {
    const confirmed = await showConfirmDialog({
        title: 'Clear History',
        message: 'Clear all play history? This cannot be undone.',
        okText: 'Clear',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        storageRemove(STORAGE_KEYS.PLAY_HISTORY);
        setHistoryGhostSlots([]);
        setNextHistorySlotId(1);
        emit('history:cleared');
    }
}

// Other files and inline handlers call these by name, so they are registered on window.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        saveToRecentlyPlayed,
        getRecentlyPlayed,
        updateRecentCount,
        clearRecentlyPlayed,
        saveToPlayHistory,
        getPlayHistory,
        clearPlayHistory
    });
}

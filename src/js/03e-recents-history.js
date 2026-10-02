// ==============================================================================
// RECENTLY PLAYED & PLAY HISTORY
// (split out of 03-storage.js)
// ==============================================================================
// Event-bus conversion: this file used to call renderPortableRecentlyPlayed(),
// renderHistoryView(), renderRecentlyPlayed(), updateExternalScrollbar() and
// showNotification() directly, and updateRecentCount() used to query the DOM
// itself. All of that moved to 04h-recents-history-events.js, which subscribes to
// the events emitted below. Every public function here keeps its original name
// and signature - saveToRecentlyPlayed/updateRecentCount/clearRecentlyPlayed/
// saveToPlayHistory/clearPlayHistory are still called directly from
// 03l-import-export.js, 04e-render-favorites-history.js, 06a-context-menus.js,
// 07-views.js, 15d/15e-controls-*.js, 17-song-selection.js and 99-player.js - none
// of those call sites needed to change.


// ==============================================================================
// RECENTLY PLAYED
// ==============================================================================
function saveToRecentlyPlayed(song) {
    // List logic (move-to-top instead of duplicating, cap, clean-up) lives in 03a-recents.js.
    const recentSongs = addToRecentList(getStoredJson(STORAGE_KEYS.RECENTLY_PLAYED, []), song, Date.now(), MAX_RECENT_SONGS);

    try {
        localStorage.setItem(STORAGE_KEYS.RECENTLY_PLAYED, JSON.stringify(recentSongs));
    } catch (e) {
        console.warn('Could not save the recently played list:', e);
    }
    updateRecentCount();
    emit('recents:added', { song });
}


function getRecentlyPlayed() {
    const recentSongs = getStoredJson(STORAGE_KEYS.RECENTLY_PLAYED, []);
    return recentSongs;
}


function updateRecentCount() {
    emit('recents:count-changed', { count: getRecentCount() });
}


async function clearRecentlyPlayed() {
    const confirmed = await showConfirmDialog({
        title: 'Clear Recently Played',
        message: 'Clear all recently played songs? This cannot be undone.',
        okText: 'Clear',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        localStorage.removeItem(STORAGE_KEYS.RECENTLY_PLAYED);
        clearGhostList(VIEWS.RECENT);
        updateRecentCount();
        emit('recents:cleared');
    }
}


// ==============================================================================
// PLAY HISTORY
// ==============================================================================
function saveToPlayHistory(song, playDuration) {
    const actualSong = song.song || song;

    let history = getStoredJson(STORAGE_KEYS.PLAY_HISTORY, []);

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

    localStorage.setItem(STORAGE_KEYS.PLAY_HISTORY, JSON.stringify(history));

    emit('history:added');
}


function getPlayHistory() {
    return getStoredJson(STORAGE_KEYS.PLAY_HISTORY, []);
}


async function clearPlayHistory() {
    const confirmed = await showConfirmDialog({
        title: 'Clear History',
        message: 'Clear all play history? This cannot be undone.',
        okText: 'Clear',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        localStorage.removeItem(STORAGE_KEYS.PLAY_HISTORY);
        setHistoryGhostSlots([]);
        setNextHistorySlotId(1);
        emit('history:cleared');
    }
}

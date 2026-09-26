// ==============================================================================
// RECENTLY PLAYED & PLAY HISTORY
// (split out of 03-storage.js, Phase 2 Checkpoint 5)
// ==============================================================================


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

    const recentPanel = document.getElementById('recently-played-content');
    if (recentPanel && recentPanel.classList.contains('active')) {
        renderPortableRecentlyPlayed();
    }
}


function getRecentlyPlayed() {
    const recentSongs = getStoredJson(STORAGE_KEYS.RECENTLY_PLAYED, []);
    return recentSongs;
}


function updateRecentCount() {
    const countElement = document.querySelector('.left-panel-item[onclick*="recent"] .song-count');
    if (countElement) {
        countElement.textContent = getRecentCount();
    }
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

        if (currentView === VIEWS.RECENT) {
            renderRecentlyPlayed();
            setTimeout(() => updateExternalScrollbar(), 100);
        }

        const recentPanel = document.getElementById('recently-played-content');
        if (recentPanel && recentPanel.classList.contains('active')) {
            renderPortableRecentlyPlayed();
        }

        showNotification('Recently played list cleared', 'success', 3000);
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

    if (currentView === VIEWS.HISTORY) {
        renderHistoryView();
    }
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
        historyGhostSlots = [];
        nextHistorySlotId = 1;

        if (currentView === VIEWS.HISTORY) {
            showHeroSection(true);
            updateHeroSection('Recents', 0, 'Playlist', 'History');
            renderHistoryView();
            setTimeout(() => {
                if (typeof updateExternalScrollbar === 'function') {
                    updateExternalScrollbar();
                }
            }, 100);
        }

        showNotification('Play history cleared', 'success', 3000);
    }
}

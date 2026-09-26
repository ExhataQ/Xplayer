// ==============================================================================
// SONG HIGHLIGHT SYSTEM
// ==============================================================================
function getSlotIdentifier(listId, playingSongId) {
    if (listId === VIEWS.HISTORY) {
        const history = getPlayHistory();
        const currentEntry = history.find((entry) => entry.id === playingSongId);
        return currentEntry ? currentEntry.ghostSlotId : null;
    }

    const slotProviders = {
        favorites: () => {
            const favorites = getFavorites();
            const favoriteSongs = favorites.map((id) => SONGS_DATA.find((s) => s.id === id)).filter((s) => s);
            const idx = favoriteSongs.findIndex((s) => s.id === playingSongId);
            return idx !== -1 ? `Favorites${String(idx + 1).padStart(5, '0')}` : null;
        },
        'playlist-': () => {
            const playlistId = listId.replace('playlist-', '');
            const songs = getPlaylistSongs(playlistId);
            const idx = songs.findIndex((s) => s.id === playingSongId);
            return idx !== -1 ? `Playlist${playlistId}-${String(idx + 1).padStart(5, '0')}` : null;
        },
        a: () => {
            const songs = getAlbumSongs(listId);
            const idx = songs.findIndex((s) => s.id === playingSongId);
            return idx !== -1 ? `Album-${listId}-${String(idx + 1).padStart(5, '0')}` : null;
        },
        r: () => {
            const songs = getArtistSongs(listId);
            const idx = songs.findIndex((s) => s.id === playingSongId);
            return idx !== -1 ? `Artist-${listId}-${String(idx + 1).padStart(5, '0')}` : null;
        }
    };

    for (const [prefix, getter] of Object.entries(slotProviders)) {
        if (prefix === 'playlist-' && listId && listId.startsWith(prefix)) {
            return getter();
        }
        if ((prefix === 'a' || prefix === 'r') && listId && listId.startsWith(prefix) && listId.length === 13) {
            return getter();
        }
        if (prefix === VIEWS.FAVORITES && listId === VIEWS.FAVORITES) {
            return getter();
        }
    }

    return null;
}

function paintEqOnNumberCell(item) {
    if (!item) return;
    const cell = item.querySelector('.song-number-item');
    if (!cell) return;
    if (cell.querySelector('.now-playing-indicator')) return;
    const idx = cell.getAttribute('data-song-index');
    cell.innerHTML = `<span class="now-playing-indicator"><span></span><span></span><span></span><span></span></span>`;
    cell.setAttribute('data-song-index', idx === null ? '' : idx);
}

function unpaintEqOnNumberCell(item) {
    if (!item) return;
    const cell = item.querySelector('.song-number-item');
    if (!cell) return;
    const eq = cell.querySelector('.now-playing-indicator');
    if (!eq) return;
    const idx = cell.getAttribute('data-song-index');
    cell.innerHTML = idx !== null && idx !== '' ? String(parseInt(idx, 10) + 1) : '0';
}

function updatePlayingHighlight(playingSongId, listId = currentView, clickedIndex = null) {
    document.querySelectorAll('.song-item.playing').forEach((item) => {
        item.classList.remove('playing');
        item.classList.remove('paused-song');
        unpaintEqOnNumberCell(item);
    });

    document.querySelectorAll('.left-panel-main-item.playing').forEach((item) => {
        item.classList.remove('playing');
        item.classList.remove('paused');
    });

    if (currentView === VIEWS.LYRICS) {
        if (typeof updateActiveHighlight === 'function') {
            updateActiveHighlight(null);
        }
        if (typeof updateSelectionHighlight === 'function') {
            updateSelectionHighlight();
        }
        return;
    }

    if (playingSongId === null || playingSongId === undefined) {
        for (const otherListId in activeSlotHighlights) {
            activeSlotHighlights[otherListId] = null;
        }
        updateSelectionHighlight();
        return;
    }

    let slotIdentifier = getSlotIdentifier(listId, playingSongId);
    if (slotIdentifier === null) {
        if (clickedIndex !== null) {
            slotIdentifier = clickedIndex;
        } else {
            slotIdentifier = getGhostSlotId(listId, playingSongId);
        }
    }

    for (const otherListId in activeSlotHighlights) {
        activeSlotHighlights[otherListId] = null;
    }

    if (slotIdentifier !== null) {
        activeSlotHighlights[listId] = slotIdentifier;

        const newPlayingItem = document.querySelector(`#song-list .song-item[data-song-id="${playingSongId}"]`);
        if (newPlayingItem && !newPlayingItem.classList.contains('playing')) {
            newPlayingItem.classList.add('playing');
            paintEqOnNumberCell(newPlayingItem);
        }
    }

    const sourceListId = listId;
    if (sourceListId) {
        const targetSelector = `.left-panel-main-item[data-view="${sourceListId}"]`;
        const targetItem = document.querySelector(targetSelector);
        if (targetItem) {
            targetItem.classList.remove('paused');
            targetItem.classList.add('playing');
        }
    }

    if (typeof updateActiveHighlight === 'function') {
        updateActiveHighlight(slotIdentifier);
    }

    if (typeof updateSelectionHighlight === 'function') {
        updateSelectionHighlight();
    }

    if (typeof updateHoverHighlightAfterScroll === 'function') {
        requestAnimationFrame(() => {
            if (lastMouseY > 0) {
                updateHoverHighlightAfterScroll();
            }
        });
    }
}

function applyStoredHighlight(listId) {
    document.querySelectorAll('.song-item.playing').forEach((item) => {
        item.classList.remove('playing');
        unpaintEqOnNumberCell(item);
    });

    if (currentView === VIEWS.LYRICS) {
        if (typeof updateActiveHighlight === 'function') {
            updateActiveHighlight(null);
        }
        return;
    }

    let currentPlayingSongId = null;
    let currentPlayingListId = null;
    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const item = playbackQueue[currentQueueIndex];
        const song = item.song || item;
        currentPlayingSongId = song.id;
        currentPlayingListId = item.listId || lastPlaybackListId || VIEWS.ALL_SONGS;
    }

    // A song can exist in several views.  The playing style belongs only to
    // the list that created the current queue item, not to every matching row.
    const isPlaybackList = currentPlayingListId === listId;

    if (currentPlayingSongId !== null && isPlaybackList) {
        const row = document.querySelector(`#song-list .song-item[data-song-id="${currentPlayingSongId}"]`);
        if (row) {
            row.classList.add('playing');
            paintEqOnNumberCell(row);
        }
    }

    const slotIdentifier = isPlaybackList ? activeSlotHighlights[listId] : null;
    if (typeof updateActiveHighlight === 'function') {
        updateActiveHighlight(slotIdentifier);
    }

    if (typeof refreshCurrentRowIndicator === 'function') {
        requestAnimationFrame(refreshCurrentRowIndicator);
    }
}

function reapplyHighlightAfterFilter(listId, filteredSongs) {
    document.querySelectorAll('.song-item.playing').forEach((item) => {
        item.classList.remove('playing');
        unpaintEqOnNumberCell(item);
    });

    if (typeof currentView !== 'undefined' && currentView === VIEWS.LYRICS) {
        if (typeof updateActiveHighlight === 'function') {
            updateActiveHighlight(null);
        }
        return;
    }

    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) {
        activeSlotHighlights[listId] = null;
        if (typeof updateActiveHighlight === 'function') {
            updateActiveHighlight(null);
        }
        return;
    }

    const currentItem = playbackQueue[currentQueueIndex];
    const currentSong = currentItem.song || currentItem;
    const currentListId = currentItem.listId || currentView;

    if (currentListId !== listId) {
        if (typeof updateActiveHighlight === 'function') {
            updateActiveHighlight(null);
        }
        return;
    }

    const newIndex = filteredSongs.findIndex((s) => s.id === currentSong.id);

    if (newIndex === -1) {
        activeSlotHighlights[listId] = null;
        if (typeof updateActiveHighlight === 'function') {
            updateActiveHighlight(null);
        }
        return;
    }

    activeSlotHighlights[listId] = newIndex;

    document.querySelectorAll('#song-list .song-item').forEach((item) => {
        const songIdAttr = item.getAttribute('data-song-id');
        if (songIdAttr !== null && parseInt(songIdAttr) === currentSong.id) {
            item.classList.add('playing');
        }
    });

    if (typeof updateActiveHighlight === 'function') {
        updateActiveHighlight(newIndex);
    }

    if (typeof refreshCurrentRowIndicator === 'function') {
        requestAnimationFrame(refreshCurrentRowIndicator);
    }
}

function applyHistoryStoredHighlight(listId) {
    document.querySelectorAll('.song-item.playing').forEach((item) => {
        item.classList.remove('playing');
        unpaintEqOnNumberCell(item);
    });

    let currentPlayingSongId = null;
    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const item = playbackQueue[currentQueueIndex];
        const song = item.song || item;
        currentPlayingSongId = song.id;
    }

    if (currentPlayingSongId !== null) {
        const row = document.querySelector(`#song-list .song-item[data-song-id="${currentPlayingSongId}"]`);
        if (row) {
            row.classList.add('playing');
            paintEqOnNumberCell(row);
        }
    }

    const slotId = activeSlotHighlights[listId];
    if (typeof updateActiveHighlight === 'function') {
        updateActiveHighlight(slotId);
    }

    if (typeof refreshCurrentRowIndicator === 'function') {
        refreshCurrentRowIndicator();
    }
}

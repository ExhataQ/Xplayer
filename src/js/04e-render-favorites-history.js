// ==============================================================================
// UI RENDER - FAVORITES & HISTORY
// ==============================================================================
function renderFavoritesView() {
    updateHeroCover('favorites');
    const favorites = getFavorites();
    const favoriteSongs = filterDeletedSongs(favorites.map((id) => getSongById(id)));
    const listId = 'favorites';
    const songListElement = document.getElementById('song-list');

    if (favoriteSongs.length === 0) {
        if (typeof teardownLazyLoading === 'function') {
            teardownLazyLoading();
        }
        songListElement.innerHTML = `
                <div class="empty-state-container">
                        <i class="fas fa-heart"></i>
                        <span>No favorite songs</span>
                        <small>Click the heart icon on any song to add it here</small>
                </div>
        `;
        clearGhostList(listId);
        return;
    }

    renderSongsList(favoriteSongs, listId);

    setTimeout(() => {
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 100);
}

function renderHistoryView() {
    updateHeroCover('history');
    const history = getPlayHistory().filter((entry) => !deletedSongIds.has(entry.id));
    const songList = document.getElementById('song-list');
    const listId = 'history';

    showHeroSection(true);
    showHeroClearButton(false);
    updateHeroSection('Recents', history.length, 'Playlist', 'History');

    if (history.length === 0) {
        if (typeof teardownLazyLoading === 'function') {
            teardownLazyLoading();
        }
        songList.innerHTML = `
                <div class="history-empty">
                        <i class="fas fa-history"></i>
                        <span>No play history</span>
                        <small>Play some songs to see them here</small>
                </div>
        `;
        clearGhostList(listId);
        return;
    }

    ghostLists[listId] = [];
    for (let i = 0; i < history.length; i++) {
        const ghostSlotId = history[i].ghostSlotId || `History${String(i + 1).padStart(5, '0')}`;
        ghostLists[listId].push(ghostSlotId);
    }

    const songsHtml = history
        .map((entry, index) => {
            const slotIndex = index;
            const isCurrentlyPlaying =
                currentQueueIndex >= 0 &&
                playbackQueue[currentQueueIndex] &&
                playbackQueue[currentQueueIndex].id === entry.id;
            const shouldHighlight = isCurrentlyPlaying && activeSlotHighlights[listId] === slotIndex;
            const ghostSlotValue =
                entry.ghostSlotId || getHistoryGhostSlotId(slotIndex) || `History${String(index + 1).padStart(5, '0')}`;

            return buildSongItemHTML({
                song: {
                    id: entry.id,
                    title: entry.title,
                    artist: entry.artist,
                    cover: entry.cover,
                    duration: entry.duration || '—',
                    album: entry.album || '',
                    largeCover: entry.cover || ''
                },
                index: index,
                highlight: shouldHighlight,
                listId: listId,
                ghostSlotValue: `${listId}-${ghostSlotValue}`,
                onClick: `playSongFromHistory(${entry.id})`,
                onContextMenu: `event.preventDefault(); showContextMenu(event, ${entry.id})`,
                showExtraButtons: false
            });
        })
        .join('');

    songList.innerHTML = songsHtml;

    applyHistoryStoredHighlight(listId);
}

function renderRecentlyPlayed() {
    const recentSongs = getRecentlyPlayedSongs();
    const listId = 'recent';

    if (typeof teardownLazyLoading === 'function') {
        teardownLazyLoading();
    }

    if (recentSongs.length === 0) {
        document.getElementById('song-list').innerHTML = `
            <div class="empty-state-container">
                <i class="fas fa-history"></i>
                <span>No recently played songs</span>
                <small>Play some songs to see them here</small>
            </div>
        `;
        clearGhostList(listId);
        return;
    }

    rebuildGhostListFromMain(listId, recentSongs);

    const songsHtml = recentSongs
        .map((song, index) => {
            return createSongItemHTML(song, index, listId);
        })
        .join('');

    document.getElementById('song-list').innerHTML = `
        <div class="recently-played-header">
            <div class="recently-played-title-row">
                <div class="recently-played-title">
                    <i class="fas fa-history"></i>
                    <span>Recently Played</span>
                </div>
                <button onclick="clearRecentlyPlayed()" class="clear-recent-btn" aria-label="Clear recently played list">
                    <i class="fas fa-trash-alt"></i>
                    Clear List
                </button>
            </div>
            <div class="recently-played-info">
                <i class="fas fa-info-circle"></i>
                Your last ${MAX_RECENT_SONGS} different songs, most recent first
            </div>
        </div>
        ${songsHtml}
    `;

    applyStoredHighlight(listId);
}

function renderPortableRecentlyPlayed() {
    const recentSongs = getRecentlyPlayedSongs();
    const recentList = document.getElementById('recently-played-list');

    if (!recentList) return;

    if (recentSongs.length === 0) {
        recentList.innerHTML = `
                <div class="empty-queue">
                        <i class="fas fa-history"></i>
                        <p>No recently played songs</p>
                        <small>Play songs for at least 5 seconds to see them here</small>
                </div>`;
        return;
    }

    const maxDisplay = 50;
    const displaySongs = recentSongs.slice(0, maxDisplay);

    let recentHTML = '';
    displaySongs.forEach((song) => {
        recentHTML += `
                ${renderRightPanelItem(song, {
                    title: escapeHtml(song.title),
                    artist: escapeHtml(song.artist),
                    onClick: `playSongFromList(${song.id}, 'history')`
                })}`;
    });

    if (recentSongs.length > maxDisplay) {
        recentHTML += `
                <div class="empty-queue" style="padding: 15px; margin-top: 10px;">
                        <i class="fas fa-ellipsis-h"></i>
                        <p>${recentSongs.length - maxDisplay} more songs</p>
                </div>`;
    }

    recentList.innerHTML = recentHTML;
    updateScrollbarById('right-panel-content');
}

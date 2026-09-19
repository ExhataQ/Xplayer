// ==============================================================================
// SONG SELECTION & UI SYNC
// ==============================================================================
function updateLeftPanelCounts() {
    const favoritesCount = getActiveFavoritesCount();

    const likedCountDisplay = document.getElementById('liked-count-display');
    if (likedCountDisplay) {
        likedCountDisplay.textContent = favoritesCount + (favoritesCount === 1 ? ' song' : ' songs');
    }

    const allSongsCount = getActiveSongs().length;
    const allSongsCountDisplay = document.getElementById('all-songs-count-display');
    if (allSongsCountDisplay) {
        allSongsCountDisplay.textContent = allSongsCount + (allSongsCount === 1 ? ' song' : ' songs');
    }

    if (typeof leftPanelVirtualState !== 'undefined' && leftPanelVirtualState.enabled && !currentOpenFolderId) {
        const items = getLeftPanelItemsArray();
        leftPanelVirtualState.currentItems = items;
        renderLeftPanelVisibleItems(false);
    } else {
        const allSongsItem = document.querySelector('.left-panel-main-item[data-view="all-songs"] .main-item-count');
        if (allSongsItem) {
            allSongsItem.textContent = allSongsCount + (allSongsCount === 1 ? ' song' : ' songs');
        }
        const likedItem = document.querySelector('.left-panel-main-item[data-view="favorites"] .main-item-count');
        if (likedItem) {
            likedItem.textContent = favoritesCount + (favoritesCount === 1 ? ' song' : ' songs');
        }
    }

    updateRecentCount();
}

function syncAllUIState() {
    updateLeftPanelCounts();
    updateAllCounts();

    if (currentView === 'favorites') {
        renderFavoritesView();
        const favorites = getFavorites();
        updateHeroSongCount(favorites.length);
    } else if (currentView === 'all-songs') {
        updateHeroSongCount(getActiveSongs().length);
    } else if (currentView && currentView.startsWith('playlist-')) {
        const playlistId = currentView.replace('playlist-', '');
        updateHeroSongCount(getPlaylistSongs(playlistId).length);
    } else if (currentView && currentView.startsWith('a') && currentView.length === 13) {
        updateHeroSongCount(getAlbumSongs(currentView).length);
    } else if (currentView && currentView.startsWith('r') && currentView.length === 13) {
        updateHeroSongCount(getArtistSongs(currentView).length);
    }

    updateScrollbarById('left-panel-main-content');
}

function onSongsChanged() {
    updateAllCounts();
    updateLeftPanelCounts();
    renderPlaylistsView();
    renderFoldersView();
    renderAlbumLeftPanelItems();
    renderArtistLeftPanelItems();
    refreshCurrentView();
    updateScrollbarById('left-panel-main-content');
}

function refreshCurrentViewAfterMutation() {
    document.querySelectorAll('#song-list .song-item.selected').forEach((item) => {
        const id = parseInt(item.getAttribute('data-song-id'));
        if (!isNaN(id) && !selectedSongIds.has(id)) {
            item.classList.remove('selected');
        }
    });

    selectionHighlights.forEach((el) => el.remove());
    selectionHighlights = [];

    if (currentView === 'favorites') {
        const validIds = new Set(
            getActiveFavoritesCount() > 0
                ? filterDeletedSongs(getFavorites().map((id) => SONGS_DATA.find((s) => s.id === id))).map((s) => s.id)
                : []
        );
        pruneSelectionSet(validIds);
        renderFavoritesView();
        updateHeroSongCount(validIds.size);
    } else if (currentView === 'all-songs') {
        const validIds = new Set(getActiveSongs().map((s) => s.id));
        pruneSelectionSet(validIds);
        if (virtualScrollState.enabled) {
            virtualScrollState.currentSongs = getActiveSongs();
        }
        updateHeroSongCount(validIds.size);
        reapplySelectionState();
    } else if (currentView === 'history') {
        const validIds = new Set(
            filterDeletedSongs(getPlayHistory().map((e) => SONGS_DATA.find((s) => s.id === e.id))).map((s) => s.id)
        );
        pruneSelectionSet(validIds);
        renderHistoryView();
        updateHeroSongCount(validIds.size);
    } else if (currentView && currentView.startsWith('playlist-')) {
        const playlistId = currentView.replace('playlist-', '');
        const songs = getPlaylistSongs(playlistId);
        const validIds = new Set(songs.map((s) => s.id));
        pruneSelectionSet(validIds);
        renderPlaylistDetailView(playlistId);
        updateHeroSongCount(songs.length);
    } else if (currentView && currentView.startsWith('a') && currentView.length === 13) {
        const songs = getAlbumSongs(currentView);
        const validIds = new Set(songs.map((s) => s.id));
        pruneSelectionSet(validIds);
        renderAlbumDetailView(currentView);
        updateHeroSongCount(songs.length);
    } else if (currentView && currentView.startsWith('r') && currentView.length === 13) {
        const songs = getArtistSongs(currentView);
        const validIds = new Set(songs.map((s) => s.id));
        pruneSelectionSet(validIds);
        renderArtistDetailView(currentView);
        updateHeroSongCount(songs.length);
    }

    setTimeout(() => {
        updateSelectionHighlight();
        if (typeof updateActiveHighlight === 'function') {
            const slot = activeSlotHighlights[currentView];
            updateActiveHighlight(slot !== null && slot !== undefined ? slot : null);
        }
    }, 30);

    updateLeftPanelCounts();
    updateAllCounts();
    updateScrollbarById('main-content');
    updateScrollbarById('left-panel-main-content');
}

function pruneSelectionSet(validIds) {
    [...selectedSongIds].forEach((id) => {
        if (!validIds.has(id)) {
            selectedSongIds.delete(id);
        }
    });

    if (selectedSongId !== null && !validIds.has(selectedSongId)) {
        selectedSongId = selectedSongIds.size > 0 ? selectedSongIds.values().next().value : null;
    }

    if (selectedSongId === null) {
        lastSelectedIndex = null;
    }

    if (selectedSongIds.size === 0) {
        document.querySelectorAll('.song-item.last-selected').forEach((el) => el.classList.remove('last-selected'));
    }
}

function toggleFavorite(songId, buttonElement) {
    const wasFav = isFavorite(songId);

    if (wasFav) {
        removeFavorite(songId);
    } else {
        saveFavorite(songId);
    }

    const nowFav = !wasFav;

    document.querySelectorAll(`.song-item[data-song-id="${songId}"] .favorite-btn`).forEach((btn) => {
        const icon = btn.querySelector('i');
        if (!icon) return;
        if (nowFav) {
            icon.classList.remove('unliked');
            icon.classList.add('liked');
            icon.style.color = 'var(--accent)';
            btn.title = 'Remove from favorites';
            btn.setAttribute('aria-label', 'Remove from favorites');
        } else {
            icon.classList.remove('liked');
            icon.classList.add('unliked');
            icon.style.color = '';
            btn.title = 'Add to favorites';
            btn.setAttribute('aria-label', 'Add to favorites');
        }
    });

    syncAllUIState();

    if (wasFav) {
        refreshCurrentViewAfterMutation();
    }

    showNotification(wasFav ? 'Removed from favorites' : 'Added to favorites', 'heart', 2000);
}

function toggleFavoriteFromMenu() {
    if (currentContextSongId === null) return;

    const idsToToggle =
        typeof selectedSongIds !== 'undefined' && selectedSongIds.size > 0
            ? [...selectedSongIds]
            : [currentContextSongId];

    const allAlreadyFavorited = idsToToggle.every((id) => isFavorite(id));

    idsToToggle.forEach((id) => {
        if (allAlreadyFavorited) {
            removeFavorite(id);
        } else if (!isFavorite(id)) {
            saveFavorite(id);
        }
    });

    idsToToggle.forEach((id) => {
        document.querySelectorAll(`.song-item[data-song-id="${id}"] .favorite-btn`).forEach((btn) => {
            const icon = btn.querySelector('i');
            if (!icon) return;
            if (allAlreadyFavorited) {
                icon.classList.remove('liked');
                icon.classList.add('unliked');
                icon.style.color = '';
                btn.title = 'Add to favorites';
                btn.setAttribute('aria-label', 'Add to favorites');
            } else {
                icon.classList.remove('unliked');
                icon.classList.add('liked');
                icon.style.color = 'var(--accent)';
                btn.title = 'Remove from favorites';
                btn.setAttribute('aria-label', 'Remove from favorites');
            }
        });
    });

    syncAllUIState();

    if (allAlreadyFavorited) {
        refreshCurrentViewAfterMutation();
    }

    showNotification(
        allAlreadyFavorited
            ? `Removed ${idsToToggle.length} song${idsToToggle.length === 1 ? '' : 's'} from favorites`
            : `Added ${idsToToggle.length} song${idsToToggle.length === 1 ? '' : 's'} to favorites`,
        'heart',
        2000
    );
}

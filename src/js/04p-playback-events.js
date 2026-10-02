// ==============================================================================
// PLAYBACK AND SELECTION - UI REACTIONS
// ==============================================================================
// Subscribes to the events 10b, 10c, 10d, 15b, 15c, 15d, 15e, 16 and 17 emit and does the actual DOM
// work, moved here verbatim from those files (EB-B1 to EB-B4). Emit sites keep the
// position the old call had, and handlers run synchronously, so the order of calls
// is unchanged.

on('playback:stateChanged', (e) => {
    updateSubheroPlayButton(e.detail.playing);
});

on('playback:recentViewChanged', () => {
    if (currentView === VIEWS.RECENT) {
        renderRecentlyPlayed();
    }
});

on('playback:recentPanelChanged', () => {
    const recentPanel = document.getElementById('recently-played-content');
    if (recentPanel && recentPanel.classList.contains('active')) {
        renderPortableRecentlyPlayed();
    }
});

on('shuffle:changed', () => {
    updateSubheroShuffleButton();
});

// Shuffle was toggled while repeat-one is active: the visible list is redrawn.
// The Recent view is redrawn only when shuffle was turned off (as before).
on('shuffle:listChanged', (e) => {
    if (!e.detail.isShuffled && currentView === VIEWS.RECENT) {
        renderRecentlyPlayed();
    } else if (currentView === VIEWS.ALL_SONGS) {
        renderSongsList(SONGS_DATA, VIEWS.ALL_SONGS);
    } else if ((currentView === VIEWS.SEARCH || currentView === VIEWS.SEARCH_ITEMS) && searchQuery) {
        const filteredSongs = getSearchResults(searchQuery);
        renderSongsList(filteredSongs, VIEWS.SEARCH_ITEMS);
    }
});

on('repeat:listChanged', () => {
    if (currentView === VIEWS.RECENT) {
        renderRecentlyPlayed();
    } else if (currentView === VIEWS.ALL_SONGS) {
        renderSongsList(SONGS_DATA);
    } else if ((currentView === VIEWS.SEARCH || currentView === VIEWS.SEARCH_ITEMS) && searchQuery) {
        const filteredSongs = getSearchResults(searchQuery);
        renderSongsList(filteredSongs, VIEWS.SEARCH_ITEMS);
    }
});

// A song was removed from the playback queue: the visible list is redrawn.
on('queue:songsChanged', () => {
    if (currentView === VIEWS.RECENT) {
        renderRecentlyPlayed();
    } else if (currentView === VIEWS.ALL_SONGS) {
        renderSongsList(getSongsForList(VIEWS.ALL_SONGS), VIEWS.ALL_SONGS);
    } else if (currentView === VIEWS.SEARCH || currentView === VIEWS.SEARCH_ITEMS) {
        renderSongsList(getSongsForList(VIEWS.SEARCH_ITEMS), VIEWS.SEARCH_ITEMS);
    }
});

// EB-B4: 17-song-selection.js. Bodies moved verbatim from syncAllUIState(), onSongsChanged(),
// refreshCurrentViewAfterMutation() and updateLeftPanelCounts().

// A favorite was added or removed.
on('favorites:changed', () => {
    updateLeftPanelCounts();
    updateAllCounts();

    if (currentView === VIEWS.FAVORITES) {
        renderFavoritesView();
        const favorites = getFavorites();
        updateHeroSongCount(favorites.length);
    } else if (currentView === VIEWS.ALL_SONGS) {
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
});

// Songs were edited, deleted or restored in the library.
on('songs:changed', () => {
    updateAllCounts();
    updateLeftPanelCounts();
    renderPlaylistsView();
    renderFoldersView();
    renderAlbumLeftPanelItems();
    renderArtistLeftPanelItems();
    refreshCurrentView();
    updateScrollbarById('left-panel-main-content');
});

// The songs shown in the current view changed after a mutation and the selection was pruned.
// count is the song count for the current view, or null when the view has no count to refresh.
on('viewSongs:changed', (e) => {
    if (currentView === VIEWS.FAVORITES) {
        renderFavoritesView();
        updateHeroSongCount(e.detail.count);
    } else if (currentView === VIEWS.ALL_SONGS) {
        if (virtualScrollState.enabled) {
            virtualScrollState.currentSongs = getActiveSongs();
        }
        updateHeroSongCount(e.detail.count);
        reapplySelectionState();
    } else if (currentView === VIEWS.HISTORY) {
        renderHistoryView();
        updateHeroSongCount(e.detail.count);
    } else if (currentView && currentView.startsWith('playlist-')) {
        const playlistId = currentView.replace('playlist-', '');
        renderPlaylistDetailView(playlistId);
        updateHeroSongCount(e.detail.count);
    } else if (currentView && currentView.startsWith('a') && currentView.length === 13) {
        renderAlbumDetailView(currentView);
        updateHeroSongCount(e.detail.count);
    } else if (currentView && currentView.startsWith('r') && currentView.length === 13) {
        renderArtistDetailView(currentView);
        updateHeroSongCount(e.detail.count);
    }

    updateLeftPanelCounts();
    updateAllCounts();
    updateScrollbarById('main-content');
    updateScrollbarById('left-panel-main-content');
});

// updateLeftPanelCounts() ran with the virtual left-panel list active: refresh its items.
on('leftPanelCounts:changed', () => {
    const items = getLeftPanelItemsArray();
    leftPanelVirtualState.currentItems = items;
    renderLeftPanelVisibleItems(false);
});

// 16-context-menu-actions.js: the user added a song to a playlist from the context menu.
// The open playlist view is redrawn so the new song shows up (check moved from addToPlaylistFromMenu()).
on('playlist:songAddedFromMenu', (e) => {
    const { playlistId } = e.detail;
    if (currentView === `playlist-${playlistId}`) {
        renderPlaylistDetailView(playlistId);
    }
});

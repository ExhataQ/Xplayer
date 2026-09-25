// ==============================================================================
// PLAYLISTS
// Split out of 03-storage.js; still uses the same localStorage helpers from that file
// (getStoredJson, updatePlaylistCount's siblings, etc.) and getSongById from 00-state.js.
// ==============================================================================

function getPlaylists() {
    return getStoredJson(STORAGE_KEYS.PLAYLISTS, []);
}

function updatePlaylistCount(playlistId, count) {
    const playlistItem = document.querySelector(`.left-panel-main-item[data-view="playlist-${playlistId}"]`);
    if (playlistItem) {
        const countSpan = playlistItem.querySelector('.main-item-count');
        if (countSpan) {
            countSpan.textContent = `${count} ${count === 1 ? 'song' : 'songs'}`;
        }
    }
}

function savePlaylists(playlists) {
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
}

function createPlaylist(name) {
    let playlists = getPlaylists();
    const newPlaylist = {
        id: generateLongId('p'),
        name: name,
        songs: [],
        createdAt: new Date().toLocaleString()
    };
    playlists.unshift(newPlaylist);
    savePlaylists(playlists);

    if (currentOpenFolderId) {
        addToFolder(currentOpenFolderId, newPlaylist.id, 'playlist', false);
    } else {
        let order = getPlayedItemOrder();
        order = order.filter((id) => id !== `playlist-${newPlaylist.id}`);
        order.unshift(`playlist-${newPlaylist.id}`);
        savePlayedItemOrder(order);
    }

    renderPlaylistsView();
    renderLeftPanelMainList();

    // Refresh virtual scroll
    if (typeof leftPanelVirtualState !== 'undefined' && leftPanelVirtualState.enabled) {
        const newItems = getLeftPanelItemsArray();
        leftPanelVirtualState.currentItems = newItems;
        if (typeof renderLeftPanelVisibleItems === 'function') {
            renderLeftPanelVisibleItems(false);
        }
    }

    updateScrollbarById('left-panel-main-content');

    return newPlaylist;
}

function deletePlaylist(playlistId) {
    let playlists = getPlaylists();
    const wasCurrentView =
        currentView &&
        currentView.startsWith('playlist-') &&
        (currentView.replace('playlist-', '') == playlistId || currentView.replace('playlist-', '') === playlistId);

    const remainingPlaylists = playlists.filter((p) => p.id != playlistId && p.id !== playlistId);

    let deletedIndex = -1;
    if (wasCurrentView) {
        const pinnedIds = getPinnedItems();
        const playedOrder = getPlayedItemOrder();
        const sortedPlaylists = sortByPinnedThenRecent(playlists, (p) => `playlist-${p.id}`, pinnedIds, playedOrder);
        deletedIndex = sortedPlaylists.findIndex((p) => p.id == playlistId || p.id === playlistId);
    }

    playlists = remainingPlaylists;
    savePlaylists(playlists);
    removeItemFromAllFolders(playlistId, 'playlist');

    if (currentView === 'playlists') {
        switchView('playlists');
    } else if (wasCurrentView) {
        if (playlists.length > 0) {
            const pinnedIds = getPinnedItems();
            const playedOrder = getPlayedItemOrder();
            const sortedRemaining = sortByPinnedThenRecent(playlists, (p) => `playlist-${p.id}`, pinnedIds, playedOrder);

            let targetPlaylist;
            if (deletedIndex < sortedRemaining.length) {
                targetPlaylist = sortedRemaining[deletedIndex];
            } else {
                targetPlaylist = sortedRemaining[sortedRemaining.length - 1];
            }

            switchView(`playlist-${targetPlaylist.id}`);
        } else {
            switchView('all-songs');
        }
    }

    renderPlaylistsView();
    renderLeftPanelMainList();

    // Refresh virtual scroll
    if (typeof leftPanelVirtualState !== 'undefined' && leftPanelVirtualState.enabled) {
        const newItems = getLeftPanelItemsArray();
        leftPanelVirtualState.currentItems = newItems;
        if (typeof renderLeftPanelVisibleItems === 'function') {
            renderLeftPanelVisibleItems(false);
        }
    }

    updateScrollbarById('left-panel-main-content');
}

async function deletePlaylistAndClose(playlistId) {
    const playlists = getPlaylists();
    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
    const playlistName = playlist ? playlist.name : 'Playlist';

    const confirmed = await showConfirmDialog({
        title: 'Delete Playlist',
        message: `Delete playlist "${playlistName}"? This cannot be undone.`,
        okText: 'Delete',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        deletePlaylist(playlistId);
        renderPlaylistsView();
        renderLeftPanelMainList();
        updateScrollbarById('left-panel-main-content');
        showNotification(`Playlist "${playlistName}" deleted`, 'error', 2000);
    }
}

function getPlaylistSongs(playlistId) {
    const playlists = getPlaylists();
    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
    if (!playlist) return [];
    return filterDeletedSongs(playlist.songs.map((songId) => getSongById(songId)));
}

function removeSongFromPlaylist(songId, playlistId) {
    let playlists = getPlaylists();
    const playlistIndex = playlists.findIndex((p) => p.id == playlistId || p.id === playlistId);
    if (playlistIndex === -1) return false;

    const originalLength = playlists[playlistIndex].songs.length;
    playlists[playlistIndex].songs = playlists[playlistIndex].songs.filter((id) => id !== songId);
    if (playlists[playlistIndex].songs.length === originalLength) return false;

    savePlaylists(playlists);
    updatePlaylistCount(playlistId, playlists[playlistIndex].songs.length);
    return true;
}

function addSongToPlaylist(songId, playlistId) {
    let playlists = getPlaylists();
    const playlistIndex = playlists.findIndex((p) => p.id == playlistId || p.id === playlistId);
    if (playlistIndex === -1) return false;

    if (!playlists[playlistIndex].songs.includes(songId)) {
        playlists[playlistIndex].songs.push(songId);
        savePlaylists(playlists);
        updatePlaylistCount(playlistId, playlists[playlistIndex].songs.length);
        return true;
    }
    return false;
}

// ==============================================================================
// CONTEXT MENU ACTIONS
// ==============================================================================
export function deleteHistoryEntry() {
    if (currentContextSongId === null) return;

    const history = getPlayHistory();

    const slotIndex = activeContextMenuSlot;

    if (slotIndex !== null && slotIndex < history.length) {
        removeHistoryGhostSlot(slotIndex);
        history.splice(slotIndex, 1);
        storageWriteJson(STORAGE_KEYS.PLAY_HISTORY, history);

        if (currentView === VIEWS.HISTORY) {
            refreshCurrentViewAfterMutation();
        }

        emit('playback:recentPanelChanged');

        showNotification('Entry deleted from history', 'error', 2000);
    }
}

export function addToPlaylistFromMenu(songId, playlistId) {
    if (songId === null || playlistId === null) return;

    const added = addSongToPlaylist(songId, playlistId);

    const song = SONGS_DATA.find((s) => s.id === songId);
    const playlists = getPlaylists();
    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);

    if (added) {
        showNotification(`Added "${song.title}" to ${playlist.name}`, 'success', 2000);
    } else {
        showNotification(`Song already in ${playlist.name}`, 'warning', 2000);
    }

    emit('playlist:songAddedFromMenu', { playlistId });
}

export function showFileLocation() {
    if (currentContextSongId === null) return;

    const currentSong = SONGS_DATA.find((s) => s.id === currentContextSongId);
    if (!currentSong) {
        showNotification('File information not available for this song', 'warning', 2000);
        return;
    }

    let filePath = currentSong.url.replace('file:///', '');
    let windowsPath = filePath.replace(/\//g, '\\');

    if (desktopApi.supports('files.showFileInExplorer')) {
        desktopApi.files.showFileInExplorer(windowsPath);
    }
}

export async function deleteSongFile() {
    if (currentContextSongId === null) return;

    const currentSong = SONGS_DATA.find((s) => s.id === currentContextSongId);
    if (!currentSong) {
        showNotification('File information not available for this song', 'warning', 2000);
        return;
    }

    const confirmed = await showConfirmDialog({
        title: 'Delete Song',
        message: `Delete "${currentSong.title}" from your computer? This will move it to the Recycle Bin.`,
        okText: 'Delete',
        cancelText: 'Cancel'
    });

    if (!confirmed) return;

    let filePath = currentSong.url.replace('file:///', '');
    let windowsPath = filePath.replace(/\//g, '\\');

    if (desktopApi.supports('files.deleteFile')) {
        markSongAsDeleted(currentContextSongId);

        const favorites = getFavorites();
        if (favorites.includes(currentContextSongId)) {
            removeFavorite(currentContextSongId);
        }

        const playlists = getPlaylists();
        let playlistChanged = false;
        playlists.forEach((p) => {
            if (p.songs.includes(currentContextSongId)) {
                p.songs = p.songs.filter((id) => id !== currentContextSongId);
                playlistChanged = true;
            }
        });
        if (playlistChanged) {
            savePlaylists(playlists);
        }

        for (const listId in activeSlotHighlights) {
            activeSlotHighlights[listId] = null;
        }

        onSongsChanged();
        refreshCurrentViewAfterMutation();
        desktopApi.files.deleteFile(windowsPath);
    } else {
        showNotification('Delete function not available', 'error', 2000);
    }
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        deleteHistoryEntry,
        addToPlaylistFromMenu,
        showFileLocation,
        deleteSongFile
    });
}

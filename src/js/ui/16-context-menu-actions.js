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

// The new interface registers a function that fills the "Add to playlist" submenu with a search field over the playlists (task B2).
let playlistPicker = null;

export function registerPlaylistPicker(mount) {
    playlistPicker = typeof mount === 'function' ? mount : null;
}

export function hasPlaylistPicker() {
    return playlistPicker !== null;
}

export function mountPlaylistPickerInto(host, songIds, onDone) {
    if (playlistPicker && host) playlistPicker(host, songIds, onDone);
}

// Adds every song to the playlist, tells the person, and lets the lists redraw. Answers { added, already, name }.
export function addSongsToPlaylistFromMenu(songIds, playlistId) {
    const playlist = getPlaylists().find((p) => p.id == playlistId);
    if (!playlist || !Array.isArray(songIds) || !songIds.length) return { added: 0, already: 0, name: '' };
    const added = songIds.filter((id) => addSongToPlaylist(id, playlistId)).length;
    const already = songIds.length - added;
    const song = songIds.length === 1 ? SONGS_DATA.find((s) => s.id === songIds[0]) : null;
    if (!added) showNotification(songIds.length === 1 ? `Song already in ${playlist.name}` : `Already in ${playlist.name}`, 'warning', 2000);
    else if (song) showNotification(`Added "${song.title}" to ${playlist.name}`, 'success', 2000);
    else showNotification(`Added ${added} ${added === 1 ? 'song' : 'songs'} to ${playlist.name}${already ? ` (${already} already there)` : ''}`, 'success', 2000);
    emit('playlist:songAddedFromMenu', { playlistId });
    return { added, already, name: playlist.name };
}

// Rate from the song menu (task B3): the stars (0 removes the rating) go to every chosen song: the whole selection when the clicked
// song is part of a multi-selection, else that song. Says what was done.
export function setRatingFromMenu(songId, stars) {
    if (songId === null || songId === undefined) return;
    const ids = typeof selectedSongIds !== 'undefined' && selectedSongIds.size > 1 && selectedSongIds.has(songId) ? [...selectedSongIds] : [songId];
    const n = normalizeRating(stars);
    ids.forEach((id) => setRating(id, n));
    const song = ids.length === 1 ? SONGS_DATA.find((s) => s.id === ids[0]) : null;
    const what = song ? `"${song.title}"` : `${ids.length} songs`;
    showNotification(n ? `Rated ${what} ${ratingLabel(n)}` : `Removed the rating of ${what}`, 'success', 2000);
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
        setRatingFromMenu,
        registerPlaylistPicker,
        hasPlaylistPicker,
        mountPlaylistPickerInto,
        addSongsToPlaylistFromMenu,
        showFileLocation,
        deleteSongFile
    });
}

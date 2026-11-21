// ==============================================================================
// PLAYLISTS
// Reads and writes through core/storage.js and uses getSongById from 00-state.js. The screens redraw from the events
// emitted here (04k-playlists-events.js). deletePlaylist() switches the view itself: which view depends on state computed at deletion time.
// ==============================================================================

const isRatingPlaylistSafe = (playlist) => typeof isRatingPlaylist === 'function' && isRatingPlaylist(playlist); // the rating rules are an engine global

export function getPlaylists() {
    return storageReadJson(STORAGE_KEYS.PLAYLISTS, [], normalizePlaylists);
}

export function savePlaylists(playlists) {
    storageWriteJson(STORAGE_KEYS.PLAYLISTS, playlists);
}

export function createPlaylist(name) {
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

    emit('playlist:listChanged');

    return newPlaylist;
}

export function deletePlaylist(playlistId) {
    let playlists = getPlaylists();
    if (isRatingPlaylistSafe(playlists.find((p) => p.id == playlistId))) return; // Top rated and Not rated go with the Rating system, not by hand
    const wasCurrentView =
        currentView &&
        currentView.startsWith('playlist-') &&
        (currentView.replace('playlist-', '') == playlistId || currentView.replace('playlist-', '') === playlistId);

    const remainingPlaylists = playlists.filter((p) => p.id != playlistId && p.id !== playlistId);

    playlists = remainingPlaylists;
    savePlaylists(playlists);
    removeItemFromAllFolders(playlistId, 'playlist');

    if (currentView === VIEWS.PLAYLISTS) {
        switchView(VIEWS.PLAYLISTS);
    } else if (wasCurrentView) {
        // The playlist you were looking at is gone: the engine falls back to All Songs (so the Library never shows a deleted list),
        // and the shell takes the person to Home (ui-next/shell/shell.js listens for this). Without a shell, All Songs stays.
        switchView(VIEWS.ALL_SONGS);
        window.dispatchEvent(new CustomEvent('xplayer:open-home'));
    }

    emit('playlist:listChanged');
}

export async function deletePlaylistAndClose(playlistId) {
    const playlists = getPlaylists();
    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
    if (isRatingPlaylistSafe(playlist)) {
        showNotification(`"${playlist.name}" follows your ratings. Turn the Rating system off to remove it.`, 'info', 3500);
        return;
    }
    const playlistName = playlist ? playlist.name : 'Playlist';

    const confirmed = await showConfirmDialog({
        title: 'Delete Playlist',
        message: `Delete playlist "${escapeHtml(playlistName)}"? This cannot be undone.`,
        okText: 'Delete',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        deletePlaylist(playlistId);
        // deletePlaylist() already emitted 'playlist:listChanged', which redraws the left panel;
        // the subscriber for this event only shows the notification.
        emit('playlist:deleted', { playlistName });
    }
}

export function getPlaylistSongs(playlistId) {
    const playlists = getPlaylists();
    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
    if (!playlist) return [];
    return filterDeletedSongs(playlist.songs.map((songId) => getSongById(songId)));
}

export function removeSongFromPlaylist(songId, playlistId) {
    let playlists = getPlaylists();
    const playlistIndex = playlists.findIndex((p) => p.id == playlistId || p.id === playlistId);
    if (playlistIndex === -1 || isRatingPlaylistSafe(playlists[playlistIndex])) return false; // a rating playlist is not edited by hand

    const originalLength = playlists[playlistIndex].songs.length;
    playlists[playlistIndex].songs = playlists[playlistIndex].songs.filter((id) => id !== songId);
    if (playlists[playlistIndex].songs.length === originalLength) return false;

    savePlaylists(playlists);
    emit('playlist:songCountChanged', { playlistId, count: playlists[playlistIndex].songs.length });
    return true;
}

export function addSongToPlaylist(songId, playlistId) {
    let playlists = getPlaylists();
    const playlistIndex = playlists.findIndex((p) => p.id == playlistId || p.id === playlistId);
    if (playlistIndex === -1 || isRatingPlaylistSafe(playlists[playlistIndex])) return false; // a rating playlist is not edited by hand

    if (!playlists[playlistIndex].songs.includes(songId)) {
        playlists[playlistIndex].songs.push(songId);
        savePlaylists(playlists);
        emit('playlist:songCountChanged', { playlistId, count: playlists[playlistIndex].songs.length, added: true }); // `added` lets the new screen pulse the row
        return true;
    }
    return false;
}

// Other files and inline handlers call these by name, so they are registered on window.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        getPlaylists,
        savePlaylists,
        createPlaylist,
        deletePlaylist,
        deletePlaylistAndClose,
        getPlaylistSongs,
        removeSongFromPlaylist,
        addSongToPlaylist
    });
}

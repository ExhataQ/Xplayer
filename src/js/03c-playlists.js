// ==============================================================================
// PLAYLISTS
// Split out of 03-storage.js; reads and writes through core/storage.js and uses getSongById
// from 00-state.js.
// ==============================================================================
// Event-bus conversion: createPlaylist/deletePlaylist/deletePlaylistAndClose/
// addSongToPlaylist/removeSongFromPlaylist used to call render/DOM functions
// directly; that moved to 04k-playlists-events.js. updatePlaylistCount() had zero
// external callers (checked before removing it) and was inlined into the
// 'playlist:songCountChanged' subscriber. createPlaylist() still returns the new
// playlist object exactly as before - 06b-modals.js relies on that return value.
// deletePlaylist()'s switchView(...) navigation calls stayed inline rather than
// moving to the subscriber: which view to switch to depends on state computed at
// deletion time (sortByPinnedThenRecent + deletedIndex), not a generic "something
// changed" reaction, so it isn't the same shape as the rest of this file.
//
// Bonus find while doing this: createPlaylist() and deletePlaylist() had a
// byte-identical 11-line "refresh playlists view + left panel + virtual scroll +
// scrollbar" tail. Both now emit the same 'playlist:listChanged' event, so that
// duplication is gone too, not just moved.

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

    if (currentView === VIEWS.PLAYLISTS) {
        switchView(VIEWS.PLAYLISTS);
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
            switchView(VIEWS.ALL_SONGS);
        }
    }

    emit('playlist:listChanged');
}

export async function deletePlaylistAndClose(playlistId) {
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
        // Note: deletePlaylist() above already emitted 'playlist:listChanged' (full
        // refresh). The subscriber for this event repeats a subset of it, exactly as
        // the inline code here did before the event-bus conversion - preserved as-is,
        // not removed, since dropping it would be a behavior change, not a refactor.
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
    if (playlistIndex === -1) return false;

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
    if (playlistIndex === -1) return false;

    if (!playlists[playlistIndex].songs.includes(songId)) {
        playlists[playlistIndex].songs.push(songId);
        savePlaylists(playlists);
        emit('playlist:songCountChanged', { playlistId, count: playlists[playlistIndex].songs.length });
        return true;
    }
    return false;
}

// Classic scripts and inline handlers still call these by name; registered until the final flip.
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

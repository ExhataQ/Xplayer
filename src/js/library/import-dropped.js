// ==============================================================================
// DROPPED FILE IMPORT
// ==============================================================================

// Imports audio files dropped onto the content area (the drop handler itself lives in
// the startup handler in player.js).
//
// `target` says where the files go after they are in the library (polish A4, set by ui/06m):
//   null                         the open view (a playlist that is open takes them)
//   { type: 'playlist', id }     that playlist
//   { type: 'favorites' }        Liked Songs
//   { type: 'library' }          nowhere else: they are only imported
//   { type: 'queue' }            the queue, after the songs added by hand

// Where in the queue songs added by hand end: right after the playing song and the manual songs that follow it.
function manualQueueEnd() {
    let index = currentQueueIndex + 1;
    while (index < playbackQueue.length && playbackQueue[index] && playbackQueue[index].addedManually) index++;
    return Math.max(0, index);
}

// The files are in the library (result.songs is the whole list); put them where the person dropped them.
function placeImported(result, target) {
    const fresh = result.newSongs || [];
    const known = result.known || [];
    if (fresh.length > 0) {
        SONGS_DATA.length = 0;
        Array.prototype.push.apply(SONGS_DATA, result.songs);
    }
    // A file that was deleted this session comes back when it is dropped on purpose.
    known.forEach((song) => deletedSongIds.delete(song.id));
    const ids = fresh.concat(known).map((song) => song.id);
    if (ids.length === 0) {
        showNotification('No new songs to import', 'warning', 3000);
        return;
    }
    onSongsChanged();

    if (target.type === 'library') {
        showNotification(fresh.length > 0 ? `Imported ${fresh.length} song(s)` : 'Already in your library', fresh.length > 0 ? 'success' : 'info', 3000);
    } else if (target.type === 'favorites') {
        let added = 0;
        ids.forEach((id) => {
            if (!isFavorite(id)) {
                saveFavorite(id);
                added++;
            }
        });
        if (added > 0) {
            syncAllUIState();
            showNotification(`Added ${added} item(s) to Liked Songs`, 'heart', 2000);
        } else {
            showNotification('Already in Liked Songs', 'warning', 2000);
        }
    } else if (target.type === 'playlist') {
        let added = 0;
        ids.forEach((id) => {
            if (addSongToPlaylist(id, target.id)) added++;
        });
        const playlist = getPlaylists().find((p) => p.id == target.id || p.id === target.id);
        if (added > 0) {
            showNotification(`Added ${added} item(s) to ${playlist ? playlist.name : 'playlist'}`, 'success', 2000);
            if (currentView === `playlist-${target.id}`) renderPlaylistDetailView(target.id);
            renderLeftPanelMainList();
        } else {
            showNotification('Already in playlist', 'warning', 2000);
        }
    } else if (target.type === 'queue') {
        const at = manualQueueEnd();
        let added = 0;
        ids.forEach((id) => {
            if (addSongToQueueAt(id, at + added)) added++;
        });
        showNotification(added > 0 ? `Added ${added} item(s) to queue` : 'Nothing to add to the queue', added > 0 ? 'success' : 'warning', 2000);
    }
}

const isRatingPlaylistSafe = (playlist) => typeof isRatingPlaylist === 'function' && isRatingPlaylist(playlist); // the rating rules are an engine global

export function importDroppedFiles(filePaths, target = null) {
    if (!desktopApi.supports('library.importDroppedFiles')) {
        showNotification('Import not available in browser mode', 'warning', 2000);
        return;
    }

    showNotification(`Importing ${filePaths.length} file(s)...`, 'info', 3000);

    desktopApi.library
        .importDroppedFiles(filePaths, currentView)
        .then((result) => {
            if (target && result.success) {
                placeImported(result, target);
                return;
            }
            if (result.success && result.newSongs && result.newSongs.length > 0) {
                SONGS_DATA.length = 0;
                Array.prototype.push.apply(SONGS_DATA, result.songs);

                if (currentView && currentView.startsWith('playlist-')) {
                    const playlistId = currentView.replace('playlist-', '');
                    const playlists = getPlaylists();
                    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
                    if (playlist && !isRatingPlaylistSafe(playlist)) {
                        result.newSongs.forEach((s) => {
                            if (!playlist.songs.includes(s.id)) {
                                playlist.songs.push(s.id);
                            }
                        });
                        savePlaylists(playlists);
                    }
                }

                onSongsChanged();

                if (currentView && currentView.startsWith('playlist-')) {
                    const playlistId = currentView.replace('playlist-', '');
                    openPlaylist(playlistId);
                }

                showNotification(`Imported ${result.newSongs.length} song(s)`, 'success', 3000);
            } else if (result.success && Array.isArray(result.known) && result.known.length > 0) {
                // The files are in the library already. After a delete the entry stays in the list, hidden for this session:
                // dropping the file again brings it back.
                const hidden = result.known.filter((song) => deletedSongIds.has(song.id));
                if (hidden.length === 0) {
                    showNotification('Already in your library', 'info', 2500);
                    return;
                }
                hidden.forEach((song) => deletedSongIds.delete(song.id));
                onSongsChanged();
                if (typeof refreshCurrentViewAfterMutation === 'function') refreshCurrentViewAfterMutation();
                showNotification(`Added back ${hidden.length} song(s)`, 'success', 3000);
            } else {
                showNotification(result.error ? `Could not import: ${result.error}` : 'No new songs to import', 'warning', 3000);
            }
        })
        .catch((err) => {
            showNotification('Failed to import files', 'error', 2000);
        });
}

// Other files and inline handlers call these by name, so they are registered on window.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        importDroppedFiles
    });
}

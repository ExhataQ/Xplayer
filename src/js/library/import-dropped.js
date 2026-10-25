// ==============================================================================
// DROPPED FILE IMPORT
// ==============================================================================

// Imports audio files dropped onto the content area (the drop handler itself lives in
// the startup handler in player.js).

export function importDroppedFiles(filePaths) {
    if (!desktopApi.supports('library.importDroppedFiles')) {
        showNotification('Import not available in browser mode', 'warning', 2000);
        return;
    }

    showNotification(`Importing ${filePaths.length} file(s)...`, 'info', 3000);

    desktopApi.library
        .importDroppedFiles(filePaths, currentView)
        .then((result) => {
            if (result.success && result.newSongs && result.newSongs.length > 0) {
                SONGS_DATA.length = 0;
                Array.prototype.push.apply(SONGS_DATA, result.songs);

                if (currentView && currentView.startsWith('playlist-')) {
                    const playlistId = currentView.replace('playlist-', '');
                    const playlists = getPlaylists();
                    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
                    if (playlist) {
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

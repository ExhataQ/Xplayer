// ==============================================================================
// LIBRARY REBUILD - UI REACTIONS
// ==============================================================================
// Subscribes to 'library:rebuilt', emitted by resetLibraryAfterRebuild() in
// 03j-library-locations.js after rebuildLibraryFromFolders() (03m) replaces
// SONGS_DATA and resets playback/ghost-list state. Moved here verbatim from
// rebuildLibraryFromFolders(), not rewritten: reset the now-playing display back
// to empty, then re-render every view that could show stale data.

on('library:rebuilt', () => {
    audioElement.pause();
    audioElement.src = '';
    playButton.innerHTML = '<i class="fas fa-play"></i>';
    document.querySelector('.player-song-info').classList.remove('has-song');
    document.getElementById('player-title').textContent = 'No song selected';
    document.getElementById('player-artist').textContent = '—';
    document.getElementById('player-cover').src = PLACEHOLDER_IMAGE;

    updateQueueDisplay();
    updateAlbumArt();

    updateAllCounts();
    updateLeftPanelCounts();
    renderPlaylistsView();
    renderAlbumLeftPanelItems();
    renderArtistLeftPanelItems();
    renderLeftPanelMainList();

    if (currentView === VIEWS.ALL_SONGS) {
        const songs = getSongsForList(VIEWS.ALL_SONGS);
        renderSongsList(songs, VIEWS.ALL_SONGS);
        setupHeroSection(true, 'All Songs', songs.length, 'Playlist');
    }
});

// 'covers:scanCompleted' is emitted by setupCoverStreamListeners() (03k-cover-sync.js) when the
// background cover scan finishes. The left panel is redrawn so rows pick up the new covers.
// The typeof guard moved here with the call, unchanged.
on('covers:scanCompleted', () => {
    if (typeof renderLeftPanelMainList === 'function') {
        renderLeftPanelMainList();
    }
});

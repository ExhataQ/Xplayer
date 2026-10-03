// ==============================================================================
// LEFT PANEL FILTER TAGS
// ==============================================================================

// Playlists / albums / artists filter tags above the left panel list.

function togglePlaylistsFilter() {
    deactivateAllFilterTags();
    const playlistsTag = document.getElementById('playlists-filter-tag');

    if (leftPanelFilterMode === 'playlists') {
        setLeftPanelFilterMode('all');
    } else {
        setLeftPanelFilterMode('playlists');
        playlistsTag.classList.add('active');
    }

    if (currentOpenFolderId) {
        renderFolderContents(currentOpenFolderId);
    } else {
        renderLeftPanelMainList();
        renderPlaylistsView();
        renderFoldersView();
    }
}

function toggleAlbumsFilter() {
    deactivateAllFilterTags();
    const albumsTag = document.getElementById('albums-filter-tag');

    if (leftPanelFilterMode === 'albums') {
        setLeftPanelFilterMode('all');
    } else {
        setLeftPanelFilterMode('albums');
        albumsTag.classList.add('active');
    }

    renderLeftPanelMainList();
    renderAlbumLeftPanelItems();
}

function toggleArtistsFilter() {
    deactivateAllFilterTags();
    const artistsTag = document.getElementById('artists-filter-tag');

    if (leftPanelFilterMode === 'artists') {
        setLeftPanelFilterMode('all');
    } else {
        setLeftPanelFilterMode('artists');
        artistsTag.classList.add('active');
    }

    renderLeftPanelMainList();
    renderArtistLeftPanelItems();
}

function deactivateAllFilterTags() {
    const playlistsTag = document.getElementById('playlists-filter-tag');
    const albumsTag = document.getElementById('albums-filter-tag');
    const artistsTag = document.getElementById('artists-filter-tag');
    if (playlistsTag) playlistsTag.classList.remove('active');
    if (albumsTag) albumsTag.classList.remove('active');
    if (artistsTag) artistsTag.classList.remove('active');
}

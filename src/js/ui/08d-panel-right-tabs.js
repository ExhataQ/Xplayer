// ==============================================================================
// RIGHT PANEL INFO / TABS
// ==============================================================================
registerActions({
    showCurrentSourceContextMenu
});

export function getCurrentSongForInfo() {
    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const queueItem = playbackQueue[currentQueueIndex];
        return queueItem.song || queueItem;
    }
    return null;
}

export function updateInfoButtonVisibility() {
    const btn = document.getElementById('track-info-btn');
    if (!btn) return;
    const tagsActive = tagsContentElement.classList.contains('active');
    const hasSong = currentQueueIndex >= 0 && playbackQueue[currentQueueIndex];
    btn.style.display = tagsActive && hasSong ? 'flex' : 'none';
}

export function switchRightPanelTab(tab) {
    document.querySelectorAll('.panel-content').forEach((c) => c.classList.remove('active'));
    document.getElementById(`${tab}-content`).classList.add('active');
    updateRightPanelHeader(tab);

    const headerContent = document.querySelector('.right-panel-header-content');
    if (headerContent) {
        headerContent.classList.remove('queue-mode', 'tags-mode', 'metadata-mode');
        if (tab === 'tags' || tab === 'metadata') {
            headerContent.classList.add(tab === 'metadata' ? 'metadata-mode' : 'tags-mode');
        } else {
            headerContent.classList.add('queue-mode');
        }
    }

    const moreInfoBtn = document.getElementById('right-panel-more-info');
    const closeBtn = document.getElementById('right-panel-close-btn');

    if (moreInfoBtn) moreInfoBtn.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';

    if (tab === 'tags') {
        if (moreInfoBtn && currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
            moreInfoBtn.style.display = 'flex';
            const currentSong = playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex];
            moreInfoBtn.setAttribute('title', `More options for ${currentSong.title.replace(/"/g, '&quot;')}`);
        }
    } else if (tab === 'queue' || tab === 'recently-played') {
        if (closeBtn) closeBtn.style.display = 'flex';
    }

    emit('rightPanel:tabChanged', { tab });

    updateInfoButtonVisibility();

    updateScrollbarById('right-panel-content');
}

export function updateRightPanelHeader(tab) {
    const headerTitle = document.getElementById('right-panel-header-title');
    const recentText = document.getElementById('recently-played-text');

    if (!headerTitle || !recentText) return;

    headerTitle.classList.remove('active-underline', 'source-name-header');
    recentText.classList.remove('active-underline');
    headerTitle.removeAttribute('onclick');
    headerTitle.removeAttribute('data-action-contextmenu');
    headerTitle.removeAttribute('data-args-contextmenu');

    if (tab === 'queue') {
        headerTitle.textContent = 'Queue';
        headerTitle.classList.add('active-underline');
        recentText.style.display = 'inline';
        headerTitle.style.pointerEvents = 'auto';
        headerTitle.style.cursor = 'pointer';
        headerTitle.setAttribute('data-action', 'switchToQueuePanel');
    } else if (tab === 'metadata') {
        headerTitle.textContent = 'Metadata';
        headerTitle.classList.add('active-underline');
        recentText.style.display = 'none';
        headerTitle.style.pointerEvents = 'auto';
        headerTitle.style.cursor = 'pointer';
        headerTitle.setAttribute('data-action', 'closeMetadataEditor');
    } else if (tab === 'tags') {
        const sourceName = getCurrentPlayingSourceName();
        headerTitle.textContent = sourceName;
        headerTitle.classList.add('source-name-header');
        headerTitle.style.pointerEvents = 'auto';
        headerTitle.style.cursor = 'pointer';
        headerTitle.setAttribute('data-action', 'navigateToCurrentSourceView');
        headerTitle.setAttribute('data-action-contextmenu', 'showCurrentSourceContextMenu');
        headerTitle.setAttribute('data-args-contextmenu', '["$event"]');
        recentText.style.display = 'none';
    } else if (tab === 'recently-played') {
        headerTitle.textContent = 'Queue';
        recentText.classList.add('active-underline');
        recentText.style.display = 'inline';
        headerTitle.style.pointerEvents = 'auto';
        headerTitle.style.cursor = 'pointer';
        headerTitle.setAttribute('data-action', 'switchToQueuePanel');
    }
}

export function getCurrentPlayingSourceName() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) {
        return 'Track Info';
    }

    const queueItem = playbackQueue[currentQueueIndex];
    const listId = queueItem.listId || VIEWS.ALL_SONGS;

    if (listId === VIEWS.ALL_SONGS) {
        return 'All Songs';
    } else if (listId === VIEWS.FAVORITES) {
        return 'Liked Songs';
    } else if (listId === VIEWS.HISTORY) {
        return 'Recents';
    } else if (listId && listId.startsWith('playlist-')) {
        const playlistId = listId.replace('playlist-', '');
        const playlists = getPlaylists();
        const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
        return playlist ? playlist.name : 'Playlist';
    } else if (listId && listId.startsWith('a') && listId.length === 13) {
        const albums = getAlbums();
        const album = albums.find((a) => a.id === listId);
        return album ? album.name : 'Album';
    } else if (listId && listId.startsWith('r') && listId.length === 13) {
        const artists = getArtists();
        const artist = artists.find((a) => a.id === listId);
        return artist ? artist.name : 'Artist';
    }

    return 'Track Info';
}

export function navigateToCurrentSourceView() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) {
        return;
    }

    const queueItem = playbackQueue[currentQueueIndex];
    const listId = queueItem.listId || VIEWS.ALL_SONGS;

    if (listId === VIEWS.ALL_SONGS) {
        switchView(VIEWS.ALL_SONGS);
    } else if (listId === VIEWS.FAVORITES) {
        switchView(VIEWS.FAVORITES);
    } else if (listId === VIEWS.HISTORY) {
        switchView(VIEWS.HISTORY);
    } else if (listId && listId.startsWith('playlist-')) {
        const playlistId = listId.replace('playlist-', '');
        openPlaylist(playlistId);
    } else if (listId && listId.startsWith('a') && listId.length === 13) {
        openDetailView(listId, 'album');
    } else if (listId && listId.startsWith('r') && listId.length === 13) {
        openDetailView(listId, 'artist');
    }
}

export function showCurrentSourceContextMenu(event) {
    event.stopPropagation();
    event.preventDefault();

    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return;

    const queueItem = playbackQueue[currentQueueIndex];
    const listId = queueItem.listId || VIEWS.ALL_SONGS;

    if (listId === VIEWS.ALL_SONGS) {
        showSpecialItemContextMenu(event, VIEWS.ALL_SONGS, 'All Songs');
    } else if (listId === VIEWS.FAVORITES) {
        showSpecialItemContextMenu(event, VIEWS.FAVORITES, 'Liked Songs');
    } else if (listId === VIEWS.HISTORY) {
        showSpecialItemContextMenu(event, VIEWS.HISTORY, 'Recents');
    } else if (listId.startsWith('playlist-')) {
        const playlistId = listId.replace('playlist-', '');
        showPlaylistContextMenu(event, playlistId);
    } else if (listId.startsWith('a') && listId.length === 13) {
        showAlbumContextMenu(event, listId);
    } else if (listId.startsWith('r') && listId.length === 13) {
        showArtistContextMenu(event, listId);
    }
}

export function switchToQueuePanel() {
    switchRightPanelTab('queue');
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        getCurrentSongForInfo,
        updateInfoButtonVisibility,
        switchRightPanelTab,
        updateRightPanelHeader,
        getCurrentPlayingSourceName,
        navigateToCurrentSourceView,
        showCurrentSourceContextMenu,
        switchToQueuePanel
    });
}

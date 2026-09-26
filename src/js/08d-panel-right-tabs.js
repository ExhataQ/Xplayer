// ==============================================================================
// RIGHT PANEL INFO / TABS
// ==============================================================================
function getCurrentSongForInfo() {
    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const queueItem = playbackQueue[currentQueueIndex];
        return queueItem.song || queueItem;
    }
    return null;
}

function hasEnabledExtendedFields() {
    const settings = getExtendedMetadataSettings();
    return EXTENDED_METADATA_FIELDS.some((f) => !f.hidden && settings[f.key]);
}

function updateInfoButtonVisibility() {
    const btn = document.getElementById('track-info-btn');
    if (!btn) return;
    const tagsActive = tagsContentElement.classList.contains('active');
    const hasSong = currentQueueIndex >= 0 && playbackQueue[currentQueueIndex];
    btn.style.display = tagsActive && hasSong ? 'flex' : 'none';
}

function openExtendedInfoPanel() {
    const overlay = document.getElementById('extended-info-overlay');
    const content = document.getElementById('extended-info-content');
    if (!overlay || !content) return;

    const song = getCurrentSongForInfo();
    if (!song) return;

    const settings = getExtendedMetadataSettings();
    const groups = {};
    const groupOrder = ['People', 'Structure', 'Publishing', 'Identifiers', 'Technical', 'Misc', 'Sort'];

    EXTENDED_METADATA_FIELDS.forEach((f) => {
        if (f.hidden) return;
        if (!settings[f.key]) return;
        const value = song[f.key];
        if (value === undefined || value === null || String(value).trim() === '') return;
        if (!groups[f.group]) groups[f.group] = [];
        groups[f.group].push({
            label: f.label,
            value: String(value)
        });
    });

    let bodyHTML = '';
    let totalRows = 0;
    groupOrder.forEach((groupName) => {
        if (!groups[groupName] || groups[groupName].length === 0) return;
        bodyHTML += `<div class="extended-info-group-label">${escapeHtml(groupName)}</div>`;
        groups[groupName].forEach((row) => {
            bodyHTML += `
                <div class="extended-info-row">
                    <span class="extended-info-label">${escapeHtml(row.label)}</span>
                    <span class="extended-info-value">${escapeHtml(row.value)}</span>
                </div>`;
            totalRows++;
        });
    });

    if (totalRows === 0) {
        bodyHTML = `<div class="extended-info-empty">No extended metadata available for this track</div>`;
    }

    content.innerHTML = `
        <div class="extended-info-header">
            <div class="extended-info-title">Track Information</div>
            <button class="extended-info-close" onclick="closeExtendedInfoPanel()" aria-label="Close">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
        <div class="extended-info-body">${bodyHTML}</div>
    `;

    overlay.classList.add('active');
    document.addEventListener('keydown', extendedInfoKeyHandler);
}

function closeExtendedInfoPanel() {
    const overlay = document.getElementById('extended-info-overlay');
    if (overlay) overlay.classList.remove('active');
    document.removeEventListener('keydown', extendedInfoKeyHandler);
}

function extendedInfoKeyHandler(e) {
    if (e.key === 'Escape') {
        closeExtendedInfoPanel();
    }
}

function showRightPanelContextMenu(event) {
    event.stopPropagation();
    event.preventDefault();

    const clickedMoreInfo = event.target.closest('.more-info');
    if (clickedMoreInfo) {
        temporarilySuppressTooltip(clickedMoreInfo);
    }

    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const currentSong = playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex];
        showContextMenu(event, currentSong.id);
    }
}

function switchRightPanelTab(tab) {
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

    if (tab === 'recently-played') {
        renderPortableRecentlyPlayed();
    }

    updateInfoButtonVisibility();

    updateScrollbarById('right-panel-content');
}

function updateRightPanelHeader(tab) {
    const headerTitle = document.getElementById('right-panel-header-title');
    const recentText = document.getElementById('recently-played-text');

    if (!headerTitle || !recentText) return;

    headerTitle.classList.remove('active-underline', 'source-name-header');
    recentText.classList.remove('active-underline');
    headerTitle.removeAttribute('oncontextmenu');

    if (tab === 'queue') {
        headerTitle.textContent = 'Queue';
        headerTitle.classList.add('active-underline');
        recentText.style.display = 'inline';
        headerTitle.style.pointerEvents = 'auto';
        headerTitle.style.cursor = 'pointer';
        headerTitle.setAttribute('onclick', 'switchToQueuePanel()');
    } else if (tab === 'metadata') {
        headerTitle.textContent = 'Metadata';
        headerTitle.classList.add('active-underline');
        recentText.style.display = 'none';
        headerTitle.style.pointerEvents = 'auto';
        headerTitle.style.cursor = 'pointer';
        headerTitle.setAttribute('onclick', 'closeMetadataEditor()');
    } else if (tab === 'tags') {
        const sourceName = getCurrentPlayingSourceName();
        headerTitle.textContent = sourceName;
        headerTitle.classList.add('source-name-header');
        headerTitle.style.pointerEvents = 'auto';
        headerTitle.style.cursor = 'pointer';
        headerTitle.setAttribute('onclick', 'navigateToCurrentSourceView()');
        headerTitle.setAttribute('oncontextmenu', 'showCurrentSourceContextMenu(event)');
        recentText.style.display = 'none';
    } else if (tab === 'recently-played') {
        headerTitle.textContent = 'Queue';
        recentText.classList.add('active-underline');
        recentText.style.display = 'inline';
        headerTitle.style.pointerEvents = 'auto';
        headerTitle.style.cursor = 'pointer';
        headerTitle.setAttribute('onclick', 'switchToQueuePanel()');
    }
}

function getCurrentPlayingSourceName() {
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

function navigateToCurrentSourceView() {
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

function showCurrentSourceContextMenu(event) {
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

function switchToRecentlyPlayedPanel() {
    if (!document.getElementById('recently-played-content').classList.contains('active')) {
        switchRightPanelTab('recently-played');
    }
}

function switchToQueuePanel() {
    switchRightPanelTab('queue');
}

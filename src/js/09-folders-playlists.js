// ==============================================================================
// PLAYLIST SYSTEM
// ==============================================================================
function handleLeftPanelCoverBtnClick(viewId) {
    if (!viewId) return;
    if (isViewCurrentlyPlaying(viewId)) {
        if (audioElement.paused) {
            audioElement.play();
        } else {
            audioElement.pause();
        }
        return;
    }

    const songs = getSongsForList(viewId);
    if (!songs || songs.length === 0) return;

    if (isShuffled) {
        resetShuffle();
    }

    playbackQueue = songs.map((s, idx) => ({
        song: s,
        listId: viewId,
        ghostSlot: idx
    }));
    currentQueueIndex = 0;

    updateQueueDisplay();
    playSongFromQueue(0);

    if (currentView === viewId) {
        applyStoredHighlight(viewId);
    }
}

document.addEventListener(
    'click',
    function (e) {
        const btn = e.target.closest('.left-panel-cover-play-btn');
        if (!btn) return;
        if (leftPanelCollapsed) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const viewId = btn.getAttribute('data-view');
        if (viewId) handleLeftPanelCoverBtnClick(viewId);
    },
    true
);

function playViewFromLeftPanel(viewId) {
    if (!viewId) return;
    const run = () => {
        if (typeof playCurrentViewFromStart === 'function') {
            playCurrentViewFromStart();
        }
    };
    if (viewId === currentView) {
        run();
        return;
    }
    if (viewId === 'all-songs' || viewId === 'favorites' || viewId === 'history') {
        switchView(viewId);
        setTimeout(run, 30);
    } else if (viewId.startsWith('playlist-')) {
        openPlaylist(viewId.replace('playlist-', ''), () => setTimeout(run, 30));
    } else if (viewId.startsWith('folder-')) {
        openFolder(viewId.replace('folder-', ''));
        setTimeout(run, 30);
    } else if (viewId.startsWith('a') && viewId.length === 13) {
        openDetailView(viewId, 'album');
        setTimeout(run, 30);
    } else if (viewId.startsWith('r') && viewId.length === 13) {
        openDetailView(viewId, 'artist');
        setTimeout(run, 30);
    } else {
        run();
    }
}

function removeSongFromPlaylistAndRefresh(songId, playlistId) {
    removeSongFromPlaylist(songId, playlistId);

    if (currentView === `playlist-${playlistId}`) {
        refreshCurrentViewAfterMutation();
    } else {
        renderPlaylistDetailView(playlistId);
    }

    renderLeftPanelMainList();
    updateScrollbarById('left-panel-main-content');
    updateLeftPanelCounts();
}

function openPlaylist(playlistId, callback = null) {
    const playlists = getPlaylists();
    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
    if (!playlist) return;

    if (currentView === 'lyrics') {
        if (typeof teardownLyricsView === 'function') {
            teardownLyricsView();
        }
        document.body.classList.remove('in-lyrics-view');
        const lyricsToggleBtn = document.getElementById('lyrics-toggle-btn');
        if (lyricsToggleBtn) lyricsToggleBtn.classList.remove('active');
    }

    const viewName = `playlist-${playlistId}`;

    if (currentView === viewName) {
        if (callback) callback();
        return;
    }

    pushViewToHistory(viewName);

    currentView = viewName;
    updateHeroCover(viewName);
    updateSubheroPlayButton(isCurrentViewPlaying());
    setSubheroVisibility(viewName);

    const gradientWrapper = document.querySelector('.content-gradient-wrapper');
    if (gradientWrapper) gradientWrapper.classList.remove('no-gradient');

    resetSubheroSearch();

    const subheroSearchIconTooltip = document.getElementById('subhero-search-icon');
    if (subheroSearchIconTooltip) {
        subheroSearchIconTooltip.setAttribute('title', 'Search in ' + playlist.name);
    }

    const playlistSongs = playlist.songs.map((songId) => SONGS_DATA.find((s) => s.id === songId)).filter((s) => s);
    setupHeroSection(true, playlist.name, playlistSongs.length, 'Playlist', playlist.id);

    renderPlaylistDetailView(playlistId);

    resetLeftPanelActiveState();
    activateLeftPanelItem('playlists');

    const playlistItem = document.querySelector(`.left-panel-main-item[data-view="${viewName}"]`);
    if (playlistItem) {
        playlistItem.classList.add('active');
    }

    resetViewScroll();

    if (typeof clearAllSelections === 'function') {
        clearAllSelections();
    }

    setTimeout(() => {
        applyStoredHighlight(currentView);
        if (callback) callback();
    }, 50);
}

// ==============================================================================
// FOLDER SYSTEM
// ==============================================================================
function toggleFolderExpandedFromUI(parentKey, folderId) {
    if (typeof toggleFolderExpanded !== 'function') return;
    const nowExpanded = toggleFolderExpanded(parentKey, folderId);
    const btn = document.querySelector(`.folder-chevron[data-folder-key="${parentKey}/${folderId}"]`);
    if (btn) {
        btn.classList.toggle('expanded', nowExpanded);
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = nowExpanded ? 'expand_less' : 'expand_more';
    }
    if (currentOpenFolderId) {
        renderFolderContents(currentOpenFolderId);
    } else {
        const container = document.getElementById('left-panel-main-content');
        const savedScroll = container ? container.scrollTop : 0;
        if (typeof leftPanelVirtualState !== 'undefined' && leftPanelVirtualState.enabled) {
            leftPanelVirtualState.currentItems = getLeftPanelItemsArray();
            renderLeftPanelVisibleItems(false);
        } else {
            renderLeftPanelMainList();
        }
        if (container) container.scrollTop = savedScroll;
        updateScrollbarById('left-panel-main-content');
    }
}

function openFolder(folderId) {
    const folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    if (currentView === 'lyrics') {
        if (typeof teardownLyricsView === 'function') {
            teardownLyricsView();
        }
        document.body.classList.remove('in-lyrics-view');
        const lyricsToggleBtn = document.getElementById('lyrics-toggle-btn');
        if (lyricsToggleBtn) lyricsToggleBtn.classList.remove('active');
    }

    if (currentOpenFolderId) {
        folderNavigationStack.push(currentOpenFolderId);
    }
    currentOpenFolderId = folderId;
    currentOpenFolderName = folder.name;

    const titleGroup = document.querySelector('.left-panel-header-title-group');
    const folderNavBar = document.getElementById('folder-nav-bar');
    const folderNameLabel = document.getElementById('folder-name-label');

    if (titleGroup) {
        const h3 = titleGroup.querySelector('h3');
        if (h3) h3.style.display = 'none';
    }
    if (folderNavBar) {
        folderNavBar.style.display = 'flex';
    }
    if (folderNameLabel) folderNameLabel.textContent = folder.name;

    const collapsedBackBtn = document.getElementById('collapsed-folder-back-btn');
    if (collapsedBackBtn) collapsedBackBtn.classList.add('visible');

    const leftPanelContent = document.getElementById('left-panel-main-content');
    if (leftPanelContent) {
        leftPanelContent.scrollTop = 0;
    }

    renderFolderContents(folderId);
    updateScrollbarById('left-panel-main-content');
}

function closeFolder() {
    if (folderNavigationStack.length > 0) {
        const parentFolderId = folderNavigationStack.pop();
        currentOpenFolderId = parentFolderId;

        const folders = getFolders();
        const folder = folders.find((f) => f.id === parentFolderId);
        currentOpenFolderName = folder ? folder.name : '';

        const folderNameLabel = document.getElementById('folder-name-label');
        if (folderNameLabel) folderNameLabel.textContent = currentOpenFolderName;

        renderFolderContents(parentFolderId);
        updateScrollbarById('left-panel-main-content');
        return;
    }

    currentOpenFolderId = null;
    currentOpenFolderName = '';
    folderNavigationStack = [];

    const titleGroup = document.querySelector('.left-panel-header-title-group');
    const folderNavBar = document.getElementById('folder-nav-bar');
    const folderNameLabel = document.getElementById('folder-name-label');

    if (titleGroup) {
        const h3 = titleGroup.querySelector('h3');
        if (h3) h3.style.display = '';
    }
    if (folderNavBar) {
        folderNavBar.style.display = 'none';
    }
    if (folderNameLabel) folderNameLabel.textContent = '';

    const collapsedBackBtn = document.getElementById('collapsed-folder-back-btn');
    if (collapsedBackBtn) collapsedBackBtn.classList.remove('visible');

    const leftPanelMainList = document.querySelector('.left-panel-main-list');
    if (leftPanelMainList) {
        leftPanelMainList.innerHTML = `
                <li class="left-panel-main-item active" onclick="switchView('all-songs')" oncontextmenu="showSpecialItemContextMenu(event, 'all-songs', 'All Songs'); return false;" data-view="all-songs" data-pin-id="all-songs" tabindex="0">
            <div class="subfolder-row">
                <div class="main-item-cover-wrapper">
                    <svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                        <rect width="400" height="400" rx="8" fill="var(--accent)"/>
                        <circle cx="200" cy="200" r="70" fill="none" stroke="#000000" stroke-width="12"/>
                        <polygon points="180,160 180,240 240,200" fill="#000000"/>
                    </svg>
                    <button class="left-panel-cover-play-btn" data-view="all-songs" onmousedown="event.stopPropagation()" aria-label="Play"></button>
                </div>
                <div class="main-item-info">
                    <span class="main-item-title">All Songs</span>
                    <span class="main-item-subtitle">
                        <span>Playlist</span>
                        <span class="main-item-dot">•</span>
                        <span class="main-item-count" id="all-songs-count-display">0 songs</span>
                    </span>
                </div>
                <span class="now-playing-indicator"><span></span><span></span><span></span><span></span></span>
            </div>
        </li>
        <li class="left-panel-main-item" onclick="switchView('favorites')" oncontextmenu="showSpecialItemContextMenu(event, 'favorites', 'Liked Songs'); return false;" data-view="favorites" data-pin-id="favorites" tabindex="0">
            <div class="subfolder-row">
                <div class="main-item-cover-wrapper">
                    <svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                        <defs>
                            <linearGradient id="likedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#450af5"/>
                                <stop offset="100%" style="stop-color:#c4efd9"/>
                            </linearGradient>
                        </defs>
                        <rect width="400" height="400" rx="8" fill="url(#likedGradient)"/>
                        <path d="M200 290 L170 260 C140 230 110 200 110 170 C110 140 135 115 165 115 C180 115 195 125 200 135 C205 125 220 115 235 115 C265 115 290 140 290 170 C290 200 260 230 230 260 L200 290Z" fill="#ffffff" stroke="none" transform="scale(0.6) translate(135, 100)"/>
                    </svg>
                    <button class="left-panel-cover-play-btn" data-view="favorites" onmousedown="event.stopPropagation()" aria-label="Play"></button>
                </div>
                <div class="main-item-info">
                    <span class="main-item-title">Liked Songs</span>
                    <span class="main-item-subtitle">
                        <span>Playlist</span>
                        <span class="main-item-dot">•</span>
                        <span class="main-item-count" id="liked-count-display">0 songs</span>
                    </span>
                </div>
                <span class="now-playing-indicator"><span></span><span></span><span></span><span></span></span>
            </div>
                </li>`;
    }
    const allSongsCount = SONGS_DATA.length;
    const allSongsCountDisplay = document.getElementById('all-songs-count-display');
    if (allSongsCountDisplay) {
        allSongsCountDisplay.textContent = allSongsCount + (allSongsCount === 1 ? ' song' : ' songs');
    }
    const favoritesCount = getActiveFavoritesCount();
    const likedCountDisplay = document.getElementById('liked-count-display');
    if (likedCountDisplay) {
        likedCountDisplay.textContent = favoritesCount + (favoritesCount === 1 ? ' song' : ' songs');
    }
    const allSongsMainItem = document.querySelector('.left-panel-main-item[data-view="all-songs"]');
    if (allSongsMainItem) {
        allSongsMainItem.classList.add('active');
    }
    const leftPanelContent = document.getElementById('left-panel-main-content');
    if (leftPanelContent) {
        leftPanelContent.scrollTop = 0;
    }

    renderLeftPanelMainList();
    renderPlaylistsView();
    renderFoldersView();
    renderAlbumLeftPanelItems();
    renderArtistLeftPanelItems();

    updateScrollbarById('left-panel-main-content');
}

async function confirmDeleteFolder(folderId, folderName) {
    const folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    const itemCount = folder ? folder.children.length : 0;

    if (itemCount > 0) {
        const confirmed = await showConfirmDialog({
            title: 'Delete Folder',
            message: `Delete folder "${folderName}" and all ${itemCount} item(s) inside it?\n\nThis will permanently delete all playlists and sub-folders inside this folder.\n\nClick Cancel to delete only the folder and move items to root level.`,
            okText: 'Delete All',
            cancelText: 'Delete Folder Only'
        });

        if (confirmed) {
            deleteFolder(folderId, true);
            showNotification(`Folder "${folderName}" and all contents deleted`, 'error', 2000);
        } else {
            deleteFolder(folderId, false);
            showNotification(`Folder "${folderName}" deleted, items moved to root level`, 'error', 2000);
        }
    } else {
        const confirmed = await showConfirmDialog({
            title: 'Delete Folder',
            message: `Delete folder "${folderName}"?`,
            okText: 'Delete',
            cancelText: 'Cancel'
        });

        if (confirmed) {
            deleteFolder(folderId, false);
            showNotification('Folder deleted', 'error', 2000);
        }
    }

    renderFoldersView();
    renderLeftPanelMainList();
    updateScrollbarById('left-panel-main-content');

    if (currentOpenFolderId === folderId) {
        closeFolder();
    }
}

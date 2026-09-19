// ==============================================================================
// DATA & INITIALIZATION
// ==============================================================================
const SONGS_DATA = {{SONGS_DATA}};

const deletedSongIds = new Set();

function getActiveSongs() {
    return SONGS_DATA.filter((s) => !deletedSongIds.has(s.id));
}

function markSongAsDeleted(songId) {
    deletedSongIds.add(songId);
}

function filterDeletedSongs(songs) {
    if (!songs) return [];
    return songs.filter((s) => s && !deletedSongIds.has(s.id));
}

function getActiveFavoritesCount() {
    return filterDeletedSongs(getFavorites().map((id) => SONGS_DATA.find((s) => s.id === id))).length;
}

const PLACEHOLDER_IMAGE = '{{PLACEHOLDER_IMAGE}}';
window.PLACEHOLDER_IMAGE = PLACEHOLDER_IMAGE;

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function generateLongId(prefix) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return prefix + result;
}

function generateConsistentId(prefix, name) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let h = 0;
    for (let i = 0; i < name.length; i++) {
        h = ((h << 5) - h + name.charCodeAt(i)) | 0;
    }
    let val = Math.abs(h);
    let result = '';
    for (let i = 0; i < 12; i++) {
        val = (val * 1103515245 + 12345) >>> 0;
        result += chars[val % chars.length];
    }
    return prefix + result;
}

function saveCurrentPlaybackState() {
    if (lastPlayedSong) {
        const playDuration = Date.now() - lastPlayedSongStartTime;
        saveToPlayHistory(lastPlayedSong, playDuration);

        if (shouldSaveToRecentlyPlayed(lastPlayedSong)) {
            saveToRecentlyPlayed(lastPlayedSong);
        }

        const songData = lastPlayedSong.song || lastPlayedSong;
        if (songData.isTemp && songData.tempFilePath && window.electronAPI && window.electronAPI.deleteFile) {
            const filePath = songData.tempFilePath;
            setTimeout(() => {
                window.electronAPI.deleteFile(filePath);
            }, 1000);
        }

        lastPlayedSong = null;
        lastPlayedSongStartTime = 0;
    }
}

function togglePlaylistsFilter() {
    deactivateAllFilterTags();
    const playlistsTag = document.getElementById('playlists-filter-tag');

    if (leftPanelFilterMode === 'playlists') {
        leftPanelFilterMode = 'all';
    } else {
        leftPanelFilterMode = 'playlists';
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
        leftPanelFilterMode = 'all';
    } else {
        leftPanelFilterMode = 'albums';
        albumsTag.classList.add('active');
    }

    renderLeftPanelMainList();
    renderAlbumLeftPanelItems();
}

function toggleArtistsFilter() {
    deactivateAllFilterTags();
    const artistsTag = document.getElementById('artists-filter-tag');

    if (leftPanelFilterMode === 'artists') {
        leftPanelFilterMode = 'all';
    } else {
        leftPanelFilterMode = 'artists';
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

function shouldSaveToRecentlyPlayed(song) {
    if (!lastPlayedSong) {
        return false;
    }

    if (lastPlayedSong.id !== song.id) {
        return false;
    }

    const playTime = Date.now() - lastPlayedSongStartTime;
    return playTime >= MIN_PLAY_TIME_TO_SAVE * 1000;
}

function isBelowCollapseThreshold() {
    return window.innerWidth < COLLAPSE_THRESHOLD;
}

function collapseLeftPanel() {
    leftPanelCollapsed = true;
    const leftPanel = leftPanelElement;
    const collapseBtn = document.getElementById('collapse-panel-btn');
    const titleGroup = document.querySelector('.left-panel-header-title-group');
    const collapseIcon = document.getElementById('collapse-panel-icon');

    leftPanel.classList.add('collapsed');
    if (collapseBtn) collapseBtn.classList.add('active');
    if (titleGroup) titleGroup.setAttribute('data-original-title', 'Open your library');
    if (collapseIcon) collapseIcon.textContent = 'left_panel_open';
    panelWidths.left = COLLAPSED_WIDTH;
    localStorage.setItem('leftPanelCollapsed', 'true');
    recalcLayoutWidths();
    setTimeout(function () {
        if (typeof updateSettingsMargins === 'function') updateSettingsMargins();
    }, 30);
}

function expandLeftPanel() {
    if (isBelowCollapseThreshold()) return;
    leftPanelCollapsed = false;
    const leftPanel = leftPanelElement;
    const collapseBtn = document.getElementById('collapse-panel-btn');
    const titleGroup = document.querySelector('.left-panel-header-title-group');
    const collapseIcon = document.getElementById('collapse-panel-icon');

    leftPanel.classList.remove('collapsed');
    if (collapseBtn) collapseBtn.classList.remove('active');
    if (titleGroup) titleGroup.setAttribute('data-original-title', 'Collapse your library');
    if (collapseIcon) collapseIcon.textContent = 'left_panel_close';
    panelWidths.left = MIN_PANEL_WIDTH;
    localStorage.setItem('leftPanelCollapsed', 'false');
    recalcLayoutWidths();
    setTimeout(function () {
        if (typeof updateSettingsMargins === 'function') updateSettingsMargins();
    }, 30);
}

function toggleLeftPanelCollapse() {
    if (leftPanelCollapsed) {
        expandLeftPanel();
    } else {
        collapseLeftPanel();
    }

    recalcLayoutWidths();
    updateScrollbarById('left-panel-main-content');
}

function importDroppedFiles(filePaths) {
    if (!window.electronAPI || !window.electronAPI.importDroppedFiles) {
        showNotification('Import not available in browser mode', 'warning', 2000);
        return;
    }

    showNotification(`Importing ${filePaths.length} file(s)...`, 'info', 3000);

    window.electronAPI
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
            } else {
                showNotification('No new songs to import', 'warning', 2000);
            }
        })
        .catch((err) => {
            showNotification('Failed to import files', 'error', 2000);
        });
}

window.addEventListener('resize', function () {
    if (isBelowCollapseThreshold() && !leftPanelCollapsed) {
        collapseLeftPanel();
        recalcLayoutWidths();
        updateScrollbarById('left-panel-main-content');
    } else if (!isBelowCollapseThreshold() && leftPanelCollapsed) {
        expandLeftPanel();
        recalcLayoutWidths();
        updateScrollbarById('left-panel-main-content');
    }
    if (typeof updateLibraryLocationsLayout === 'function') updateLibraryLocationsLayout();
});

function initPanelResize(panelId, options = {}) {
    const {
        handleSide = 'right',
        minWidth = SCREEN_WIDTH * (285 / 1920),
        maxWidth = SCREEN_WIDTH * (400 / 1920),
        onResize = null
    } = options;

    const panel = document.getElementById(panelId);
    if (!panel) return;

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'panel-resize-handle';
    panel.appendChild(resizeHandle);

    let isResizing = false;
    let startX, startWidth;

    function startResize(e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(getComputedStyle(panel).width, 10);
        document.body.classList.add('no-select');
        document.body.style.cursor = 'grabbing';
        if (panelId === 'left-panel') {
            const scrollbar = document.getElementById('left-panel-scrollbar');
            if (scrollbar) scrollbar.style.opacity = '0';
        }
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    }

    function doResize(e) {
        if (!isResizing) return;
        e.preventDefault();
        let delta = e.clientX - startX;
        if (handleSide === 'left') {
            delta = -delta;
        }
        const newWidth = startWidth + delta;

        if (panelId === 'left-panel' && typeof leftPanelCollapsed !== 'undefined') {
            const collapseAt = minWidth * 0.625;
            const expandAt = minWidth * 0.75;
            if (!leftPanelCollapsed && newWidth < collapseAt) {
                collapseLeftPanel();
                recalcLayoutWidths();
                updateScrollbarById('left-panel-main-content');
                startWidth = COLLAPSED_WIDTH;
                startX = e.clientX;
                return;
            }
            if (leftPanelCollapsed && newWidth > expandAt && !isBelowCollapseThreshold()) {
                expandLeftPanel();
                recalcLayoutWidths();
                updateScrollbarById('left-panel-main-content');
                panel.style.width = minWidth + 'px';
                startWidth = minWidth;
                startX = e.clientX;
                return;
            }
            if (leftPanelCollapsed) {
                return;
            }
        }

        const minMainWidth = SCREEN_WIDTH * (400 / 1920);
        const gapSize = 7;
        const rightPanelActive = document.getElementById('right-panel')?.classList.contains('active');
        const totalGaps = rightPanelActive ? gapSize * 4 : gapSize * 2;
        const appWidth = document.documentElement.clientWidth;

        let otherPanelWidth;
        if (panelId === 'left-panel') {
            otherPanelWidth = rightPanelActive ? panelWidths.right : 0;
        } else {
            otherPanelWidth = panelWidths.left;
        }

        const dynamicMax = appWidth - otherPanelWidth - totalGaps - minMainWidth;
        const effectiveMax = Math.min(maxWidth, dynamicMax);

        const finalWidth = Math.min(Math.max(newWidth, minWidth), effectiveMax);
        panel.style.width = finalWidth + 'px';
        panelWidths[panelId === 'left-panel' ? 'left' : 'right'] = finalWidth;
        if (onResize) onResize(finalWidth);
        void panel.offsetHeight;
    }

    function stopResize() {
        if (!isResizing) return;
        isResizing = false;
        document.body.classList.remove('no-select');
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
        if (panelId === 'left-panel') {
            const scrollbar = document.getElementById('left-panel-scrollbar');
            if (scrollbar) scrollbar.style.opacity = '';
        }
    }

    resizeHandle.addEventListener('mousedown', startResize);
}

// ==============================================================================
// LEFT PANEL RESIZE FUNCTIONALITY
// ==============================================================================

function initTracklistScrollEffect() {
    const content = document.querySelector('.content');
    const tracklistHeader = document.querySelector('.tracklist-header');
    const heroSection = document.querySelector('.playlist-hero-section');

    if (!content || !tracklistHeader || !heroSection) return;

    function updateHeaderBackground() {
        const tracklistRect = tracklistHeader.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const tracklistTop = tracklistRect.top - contentRect.top;

        if (tracklistTop <= 0) {
            tracklistHeader.classList.add('scrolled');
        } else {
            tracklistHeader.classList.remove('scrolled');
        }
    }

    content.addEventListener('scroll', updateHeaderBackground);
    window.addEventListener('resize', updateHeaderBackground);
    updateHeaderBackground();
}

// ==============================================================================
// INITIALIZATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', function () {
    if (typeof getWindowSettings === 'function' && window.electronAPI?.setMinimizeOnClose) {
        window.electronAPI.setMinimizeOnClose(getWindowSettings().minimizeOnClose);
    }
    updateAlbumArt();
    renderSongsList(SONGS_DATA);
    initTracklistScrollEffect();
    initLeftPanelResize();
    recalcLayoutWidths();
    updateLyricsTextScale();
    if (leftPanelCollapsed) {
        const leftPanel = leftPanelElement;
        const collapseBtn = document.getElementById('collapse-panel-btn');
        const titleGroup = document.querySelector('.left-panel-header-title-group');
        const collapseIcon = document.getElementById('collapse-panel-icon');
        if (leftPanel) leftPanel.classList.add('collapsed');
        if (collapseBtn) collapseBtn.classList.add('active');
        if (titleGroup) titleGroup.setAttribute('data-original-title', 'Open your library');
        if (collapseIcon) collapseIcon.textContent = 'left_panel_open';
    }

    if (rightPanelCollapsed) {
        const rightPanel = rightPanelElement;
        const collapseBtn = document.getElementById('right-panel-collapse-btn');
        const collapseIcon = document.getElementById('right-panel-collapse-icon');
        if (rightPanel) rightPanel.classList.add('collapsed');
        if (collapseBtn) collapseBtn.classList.add('active');
        if (collapseIcon) collapseIcon.textContent = 'left_panel_open';

        // Add expand toggle button on load if collapsed
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'right-panel-expand-toggle';
        toggleBtn.className = 'right-panel-expand-toggle';
        toggleBtn.innerHTML = '<span class="material-symbols-outlined" style="font-weight: 300;">chevron_left</span>';
        toggleBtn.setAttribute('data-original-title', 'Show now playing view');
        toggleBtn.onclick = function (e) {
            e.stopPropagation();
            temporarilySuppressTooltip(toggleBtn);
            expandRightPanel();
        };
        if (rightPanel) {
            rightPanel.appendChild(toggleBtn);
            rightPanel.style.cursor = 'pointer';
            rightPanel.onclick = function (e) {
                if (e.target === rightPanel || e.target.closest('.right-panel-expand-toggle')) {
                    expandRightPanel();
                }
            };
        }
    }

    window.addEventListener('resize', () => {
        if (window.screen.width !== SCREEN_WIDTH) {
            updateScreenWidth();
        }
        recalcLayoutWidths();
        adjustHeroTitleSize();
        if (typeof applyFooterWidths === 'function') {
            applyFooterWidths();
        }
    });

    window.addEventListener('resize', function () {
        if (typeof window.maximizeTransition === 'undefined') {
            window.maximizeTransition = setTimeout(function () {
                if (typeof recalcLayoutWidths === 'function') {
                    recalcLayoutWidths();
                }
                window.maximizeTransition = undefined;
            }, 50);
        }
    });

    updateQueueDisplay();
    resetSearchState();

    playbackHistoryStack.push({
        listId: 'all-songs',
        timestamp: Date.now(),
        queueIndex: -1
    });
    historyNavigationIndex = 0;
    updateNavigationButtons();

    initExternalScrollbar('main-content', 'external-scrollbar', 'external-scrollbar-thumb');
    initExternalScrollbar('right-panel-content', 'right-panel-scrollbar', 'right-panel-scrollbar-thumb');
    initExternalScrollbar('left-panel-main-content', 'left-panel-scrollbar', 'left-panel-scrollbar-thumb');

    window.addEventListener('load', () => recalcLayoutWidths());

    const rightPanelContent = document.getElementById('right-panel-content');
    const rightPanelHeaderContent = document.querySelector('.right-panel-header-content');
    if (rightPanelContent && rightPanelHeaderContent) {
        rightPanelContent.addEventListener('scroll', function () {
            if (rightPanelContent.scrollTop > 0) {
                rightPanelHeaderContent.classList.add('scrolled');
            } else {
                rightPanelHeaderContent.classList.remove('scrolled');
            }
        });
    }

    // Initialize repeat visual state and functionality
    repeatVisualState = repeatMode;
    repeatFunctionalityActive = (repeatMode > 0 && !isShuffled) || repeatMode === 2;

    // Set initial volume
    audioElement.volume = 0.5;
    updateVolume(0.5);

    initHistoryGhostSlots();

    // Initialize shuffle system if needed
    if (isShuffled) {
        resetShuffle();
    }

    // Player left section stays at fixed width
    const playerLeftSection = document.querySelector('.player-left-section');
    if (playerLeftSection) {
        playerLeftSection.style.width = '340px';
    }

    // Set default cover image on player load
    document.getElementById('player-cover').src = PLACEHOLDER_IMAGE;

    initThemeButtons();

    // Update recent songs count on load
    updateRecentCount();

    // Initialize favorites count on load
    const favoritesCount = getActiveFavoritesCount();
    const favoritesCountElement = document.querySelector('.left-panel-item[onclick*="favorites"] .song-count');
    if (favoritesCountElement) {
        favoritesCountElement.textContent = favoritesCount;
    }
    const favoritesCountDisplay = document.getElementById('favorites-count-display');
    if (favoritesCountDisplay) {
        favoritesCountDisplay.textContent = favoritesCount + (favoritesCount === 1 ? ' song' : ' songs');
    }
    const likedCountDisplay = document.getElementById('liked-count-display');
    if (likedCountDisplay) {
        likedCountDisplay.textContent = favoritesCount + (favoritesCount === 1 ? ' song' : ' songs');
    }
    const allSongsCount = SONGS_DATA.length;
    const allSongsCountDisplay = document.getElementById('all-songs-count-display');
    if (allSongsCountDisplay) {
        allSongsCountDisplay.textContent = allSongsCount + (allSongsCount === 1 ? ' song' : ' songs');
    }
    const allSongsMainItem = document.querySelector('.left-panel-main-item[data-view="all-songs"]');
    if (allSongsMainItem) {
        allSongsMainItem.classList.add('active');
    }

    leftPanelFilterMode = 'all';
    renderLeftPanelMainList();
    renderPlaylistsView();
    renderFoldersView();
    renderAlbumLeftPanelItems();
    renderArtistLeftPanelItems();

    // Initialize drag and drop
    initLeftPanelDragAndDrop();
    initSongDragToLeftPanel();

    // Ensure we're showing all songs on launch
    currentView = 'all-songs';
    document.body.classList.add('view-all-songs');
    document.body.classList.remove('view-favorites');

    updateContextMenuWidth();

    updateHeroSongCount(SONGS_DATA.length);
    showTracklistHeader(true);
    setupHeroSection(true, 'All Songs', SONGS_DATA.length, 'Playlist');
    updateHeroCover('all-songs');
    updateSubheroShuffleButton();

    const subheroMoreBtnInit = document.getElementById('subhero-more-btn');
    if (subheroMoreBtnInit) {
        subheroMoreBtnInit.setAttribute('title', 'More options for All Songs');
    }

    // Initialize right panel to show tags on launch
    // Force expand and show tags on first launch
    if (rightPanelCollapsed) {
        expandRightPanel();
    }
    if (!rightPanelElement.classList.contains('active')) {
        rightPanelElement.classList.add('active');
    }
    switchRightPanelTab('tags');
    updateAlbumArt();
    recalcLayoutWidths();
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            adjustHeroTitleSize();
        });
    });

    updateNavigationButtons();

    // Make entire search box clickable
    const searchBox = document.querySelector('.search-box');

    if (searchBox && searchInput) {
        searchBox.addEventListener('click', function (e) {
            // Don't interfere if clicking the button
            if (!e.target.closest('.search-btn')) {
                searchInput.focus();
            }
        });
    }

    // Also make search button focus the input
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', function (e) {
            document.getElementById('search-input').focus();
        });
    }

    const contentWrapper = document.querySelector('.content-wrapper');
    if (contentWrapper) {
        let dragCounter = 0;

        const isLibraryFolderDragTarget = function (event) {
            const target = event && event.target;
            if (!target || !target.closest) return false;
            return Boolean(target.closest('.library-locations-list') || target.closest('.library-location-item'));
        };

        contentWrapper.addEventListener('dragenter', function (e) {
            if (isLibraryFolderDragTarget(e)) return;
            e.preventDefault();
            e.stopPropagation();
            dragCounter++;
            contentWrapper.classList.add('drag-over');
        });

        contentWrapper.addEventListener('dragleave', function (e) {
            if (isLibraryFolderDragTarget(e)) return;
            e.preventDefault();
            e.stopPropagation();
            dragCounter--;
            if (dragCounter === 0) {
                contentWrapper.classList.remove('drag-over');
            }
        });

        contentWrapper.addEventListener('dragover', function (e) {
            if (isLibraryFolderDragTarget(e)) return;
            e.preventDefault();
            e.stopPropagation();
        });

        contentWrapper.addEventListener('drop', function (e) {
            if (isLibraryFolderDragTarget(e)) return;
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            contentWrapper.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length === 0) return;

            const supportedExtensions = [
                '.mp3',
                '.flac',
                '.m4a',
                '.mp4',
                '.aac',
                '.ogg',
                '.opus',
                '.wma',
                '.wav',
                '.aiff',
                '.aif',
                '.ape',
                '.wv'
            ];
            const filePaths = [];
            for (let i = 0; i < files.length; i++) {
                const ext = '.' + files[i].name.split('.').pop().toLowerCase();
                if (supportedExtensions.includes(ext)) {
                    filePaths.push(files[i].path);
                }
            }

            if (filePaths.length === 0) {
                showNotification('No supported audio files found', 'warning', 2000);
                return;
            }

            importDroppedFiles(filePaths);
        });
    }

    if (rightPanelElement) {
        rightPanelElement.addEventListener('mouseenter', function () {
            if (rightPanelCollapsed) {
                // hover trigger handled by CSS
            }
        });
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const loadingScreen = document.getElementById('startup-loading-screen');
            if (loadingScreen) loadingScreen.remove();
            document.body.removeAttribute('aria-busy');
        });
    });
});

function closeApp() {
    if (window.electronAPI) {
        window.electronAPI.closeApp();
    }
}
function minimizeApp() {
    if (window.electronAPI) {
        window.electronAPI.minimizeApp();
    }
}

function maximizeApp() {
    if (!window.electronAPI) return;
    window.electronAPI.maximizeApp();
}

function updateMaximizeIcon(maximized) {
    const icon = document.getElementById('maximize-icon');
    const btn = document.getElementById('maximize-btn');
    if (!icon || !btn) return;
    if (maximized) {
        btn.setAttribute('aria-label', 'Restore');
        icon.innerHTML =
            '<path d="M1.5 3.5 L1.5 9.5 L7.5 9.5 L7.5 3.5 Z" stroke="currentColor" stroke-width="1" fill="none" shape-rendering="crispEdges"/><path d="M3.5 3.5 L3.5 0.5 L9.5 0.5 L9.5 6.5 L7.5 6.5" stroke="currentColor" stroke-width="1" fill="none" shape-rendering="crispEdges"/>';
    } else {
        btn.setAttribute('aria-label', 'Maximize');
        icon.innerHTML =
            '<rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" stroke-width="1" fill="none" shape-rendering="crispEdges"/>';
    }
}

// ==============================================================================
// ICONS
// ==============================================================================

document.getElementById('search-btn').onclick = () => {
    performSearch();
};

// Add click navigation to player song title only
const playerTitle = document.getElementById('player-title');
if (playerTitle) {
    playerTitle.style.cursor = 'pointer';
    playerTitle.addEventListener('click', navigateToCurrentSongInList);
    playerTitle.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
            const currentSong = playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex];
            showContextMenu(e, currentSong.id);
        }
    });
    if (typeof initMarqueeOnHover === 'function') {
        initMarqueeOnHover(playerTitle, { speed: 14, endPause: 1500 });
    }
}

const playerArtist = document.getElementById('player-artist');
if (playerArtist && typeof initMarqueeOnHover === 'function') {
    initMarqueeOnHover(playerArtist, { speed: 14, endPause: 1500 });
}
if (playerArtist) {
    playerArtist.style.cursor = 'pointer';
    playerArtist.addEventListener('click', navigateToCurrentArtist);
    playerArtist.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
            const currentSong = playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex];
            showContextMenu(e, currentSong.id);
        }
    });
}

// Add right-click context menu to player cover
const playerCover = document.getElementById('player-cover');
if (playerCover) {
    playerCover.style.cursor = 'pointer';
    playerCover.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
            const currentSong = playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex];
            showContextMenu(e, currentSong.id);
        }
    });
}

// Add click and context menu to album art in track info
const albumArtImage = document.getElementById('album-art-image');
if (albumArtImage) {
    albumArtImage.style.cursor = 'pointer';
    albumArtImage.addEventListener('click', openImageViewer);
    albumArtImage.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
            const currentSong = playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex];
            showContextMenu(e, currentSong.id);
        }
    });
}

// ==============================================================================
// DATA & INITIALIZATION
// ==============================================================================
const SONGS_DATA = {{SONGS_DATA}};

const PLACEHOLDER_IMAGE = '{{PLACEHOLDER_IMAGE}}';
window.PLACEHOLDER_IMAGE = PLACEHOLDER_IMAGE;

// ==============================================================================
// INITIALIZATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', function () {
    if (typeof getWindowSettings === 'function' && desktopApi.supports('window.setMinimizeOnClose')) {
        desktopApi.window.setMinimizeOnClose(getWindowSettings().minimizeOnClose);
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
        listId: VIEWS.ALL_SONGS,
        timestamp: Date.now(),
        queueIndex: -1
    });
    setHistoryNavigationIndex(0);
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
    setRepeatVisualState(repeatMode);
    setRepeatFunctionalityActive((repeatMode > 0 && !isShuffled) || repeatMode === 2);

    // Set initial volume
    window.lastVolume = 0.5;
    window.lastMutedVolume = 0.5;
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

    setLeftPanelFilterMode('all');
    renderLeftPanelMainList();
    renderPlaylistsView();
    renderFoldersView();
    renderAlbumLeftPanelItems();
    renderArtistLeftPanelItems();

    // Initialize drag and drop
    initLeftPanelDragAndDrop();
    initSongDragToLeftPanel();

    // Ensure we're showing all songs on launch
    setCurrentView(VIEWS.ALL_SONGS);
    document.body.classList.add('view-all-songs');
    document.body.classList.remove('view-favorites');

    updateContextMenuWidth();

    updateHeroSongCount(SONGS_DATA.length);
    showTracklistHeader(true);
    setupHeroSection(true, 'All Songs', SONGS_DATA.length, 'Playlist');
    updateHeroCover(VIEWS.ALL_SONGS);
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

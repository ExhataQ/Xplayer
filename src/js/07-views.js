// ==============================================================================
// VIEW HELPERS
// ==============================================================================

// code-cleanup-plan.md Agent 5, Checkpoint 2: single source of truth for the app's
// fixed, named view names - the ones ever assigned to or compared against currentView
// as a literal string, or passed to switchView(...). Values are unchanged from what
// they already were.
//
// Deliberately NOT included here (different, larger concepts that happen to share some
// of the same words):
// - Per-item detail views (an open playlist/album/artist/folder). currentView for those
//   is the item's own generated id (see getCurrentViewLabel() below, which detects an
//   album/artist id by prefix+length), not a fixed name - there's no finite list of
//   "every playlist" to put in a constant.
// - item.type / itemType tags ('playlist', 'folder', 'song', 'album', 'artist') used for
//   drag-and-drop, the folders system, and context menus. These classify a data item,
//   not a currentView value, even though a few of the words overlap (e.g. 'playlist').
const VIEWS = {
    ALL_SONGS: 'all-songs',
    FAVORITES: 'favorites',
    HISTORY: 'history',
    RECENT: 'recent',
    PLAYLISTS: 'playlists',
    ALBUMS: 'albums',
    ARTISTS: 'artists',
    LYRICS: 'lyrics',
    ONLINE_LYRICS: 'online-lyrics',
    SMART_LYRICS: 'smart-lyrics',
    SEARCH: 'search',
    SEARCH_ITEMS: 'search-items',
    SEARCH_HISTORY: 'search-history',
    SETTINGS: 'settings'
};

function getCurrentViewLabel() {
    if (currentView && currentView.startsWith('a') && currentView.length === 13) return 'Album';
    if (currentView && currentView.startsWith('r') && currentView.length === 13) return 'Artist';
    return 'Playlist';
}

function formatArtistNames(artist) {
    if (!artist) return '—';
    const names =
        typeof getArtistNamesForSong === 'function'
            ? getArtistNamesForSong({
                  artist: artist
              })
            : [];
    if (names.length === 0) return String(artist);
    return names.join(', ');
}

function buildPlayerArtistHTML(artist) {
    if (!artist) return '—';
    const names =
        typeof getArtistNamesForSong === 'function'
            ? getArtistNamesForSong({
                  artist: artist
              })
            : [];
    if (names.length === 0) return escapeHtml(String(artist));
    const artists = typeof getArtists === 'function' ? getArtists() : [];
    const idByName = {};
    for (const a of artists) idByName[a.name] = a.id;
    return names
        .map((name) => {
            const artistId = idByName[name];
            if (!artistId) return `<span class="player-artist-name">${escapeHtml(name)}</span>`;
            return `<span class="player-artist-name" onclick="event.stopPropagation(); openArtist('${artistId}')">${escapeHtml(
                name
            )}</span>`;
        })
        .join('<span class="player-artist-sep">, </span>');
}

function resetViewScroll() {
    if (
        currentView !== VIEWS.LYRICS &&
        typeof lyricsPreView !== 'undefined' &&
        lyricsPreView !== null &&
        currentView === lyricsPreView
    ) {
        return;
    }

    const content = document.querySelector('.content');
    if (content) {
        content.scrollTop = 0;
    }

    const tracklistHeader = document.querySelector('.tracklist-header');
    if (tracklistHeader) {
        tracklistHeader.classList.remove('scrolled');
    }
}

function resetLeftPanelActiveState() {
    document.querySelectorAll('.left-panel-main-item').forEach((item) => {
        item.classList.remove('active');
    });
    const settingsToggleBtn = document.querySelector('.settings-toggle-btn');
    if (settingsToggleBtn) {
        settingsToggleBtn.classList.remove('active');
    }
}

function activateLeftPanelItem(viewName) {
    const tagItem = document.querySelector(`.left-panel-tags .left-panel-item[onclick*="${viewName}"]`);
    if (tagItem) {
        tagItem.classList.add('active');
    }
    const mainItem = document.querySelector(`.left-panel-main-item[data-view="${viewName}"]`);
    if (mainItem) {
        mainItem.classList.add('active');
    }
}

function refreshUIAfterViewSwitch() {
    setTimeout(() => {
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 100);
}

function refreshSongCovers() {
    setTimeout(() => {
        document.querySelectorAll('.song-cover').forEach((img) => {
            const src = img.src;
            if (src && src !== PLACEHOLDER_IMAGE) {
                img.style.display = 'none';
                img.offsetHeight;
                img.style.display = '';
            }
        });
    }, 50);
}

function finalizeViewSwitch(listId) {
    applyStoredHighlight(listId);
    refreshSongCovers();
    refreshUIAfterViewSwitch();
}

function refreshCurrentView() {
    const songs = getSongsForList(currentView);
    renderSongsList(songs, currentView);
    setupHeroSection(true, getCurrentViewDisplayName(), songs.length, getCurrentViewLabel());
    if (currentView === VIEWS.ALL_SONGS) {
        const el = document.getElementById('all-songs-count-display');
        if (el) el.textContent = songs.length + (songs.length === 1 ? ' song' : ' songs');
    }
}

function updateAllCounts() {
    const activeSongs = getActiveSongs();
    const allSongsCountDisplay = document.getElementById('all-songs-count-display');
    if (allSongsCountDisplay) {
        allSongsCountDisplay.textContent = activeSongs.length + (activeSongs.length === 1 ? ' song' : ' songs');
    }
    const heroCount = document.getElementById('hero-song-count');
    if (heroCount && currentView === VIEWS.ALL_SONGS) {
        heroCount.textContent = activeSongs.length + (activeSongs.length === 1 ? ' song' : ' songs');
    }
}

function getCurrentViewDisplayName() {
    if (currentView === VIEWS.ALL_SONGS) return 'All Songs';
    if (currentView === VIEWS.FAVORITES) return 'Liked Songs';
    if (currentView === VIEWS.HISTORY) return 'Recents';
    if (currentView === VIEWS.ALBUMS) return 'Albums';
    if (currentView === VIEWS.SEARCH_ITEMS || currentView === VIEWS.SEARCH) return 'Search Results';
    if (currentView && currentView.startsWith('playlist-')) {
        const playlistId = currentView.replace('playlist-', '');
        const playlist = getPlaylists().find((p) => p.id == playlistId || p.id === playlistId);
        return playlist ? playlist.name : 'Playlist';
    }
    if (currentView && currentView.startsWith('a') && currentView.length === 13) {
        const albums = getAlbums();
        const album = albums.find((a) => a.id === currentView);
        return album ? album.name : 'Album';
    }
    if (currentView && currentView.startsWith('r') && currentView.length === 13) {
        const artists = getArtists();
        const artist = artists.find((a) => a.id === currentView);
        return artist ? artist.name : 'Artist';
    }
    return '';
}

// ==============================================================================
// SUBHERO CONTROLS
// ==============================================================================
function setSubheroVisibility(view) {
    const subheroSection = document.getElementById('subhero-section');
    if (!subheroSection) return;

    if (view === VIEWS.SETTINGS || view === VIEWS.SEARCH_HISTORY || view === VIEWS.LYRICS || view === VIEWS.ONLINE_LYRICS || view === VIEWS.SMART_LYRICS) {
        subheroSection.style.display = 'none';
    } else {
        subheroSection.style.display = '';
    }
}

function updateSubheroPlayButton(isPlaying) {
    const btn = document.getElementById('subhero-play-btn');
    if (!btn) return;
    const viewName = getCurrentViewDisplayName();
    if (isPlaying) {
        btn.innerHTML = '<i class="fas fa-pause"></i>';
        btn.setAttribute('title', 'Pause ' + viewName.toLowerCase());
    } else {
        btn.innerHTML = '<i class="fas fa-play"></i>';
        btn.setAttribute('title', 'Play ' + viewName.toLowerCase());
    }
    const subheroSearchIcon = document.getElementById('subhero-search-icon');
    if (subheroSearchIcon) {
        subheroSearchIcon.setAttribute('title', 'Search in ' + viewName);
    }
    const subheroSearchInputPlaceholder = document.getElementById('subhero-search-input');
    if (subheroSearchInputPlaceholder) {
        subheroSearchInputPlaceholder.setAttribute('placeholder', 'Search in ' + viewName.toLowerCase());
    }
    const subheroMoreBtn = document.getElementById('subhero-more-btn');
    if (subheroMoreBtn) {
        subheroMoreBtn.setAttribute('title', 'More options for ' + viewName);
    }
}

function updateSubheroShuffleButton() {
    const btn = document.getElementById('subhero-shuffle-btn');
    if (!btn) return;
    if (isShuffled) {
        btn.classList.add('active');
        btn.setAttribute('title', shuffleMode === 'smart' ? 'Smart Shuffle is on' : 'Shuffle is on');
    } else {
        btn.classList.remove('active');
        btn.setAttribute('title', 'Shuffle');
    }
}

function toggleShuffleFromSubhero() {
    shuffleButton.click();
    updateSubheroShuffleButton();
}

// ==============================================================================
// VIEW STATE CHECKS
// ==============================================================================
function isViewCurrentlyPlaying(viewId) {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return false;
    const curItem = playbackQueue[currentQueueIndex];
    const curListId = curItem.listId || VIEWS.ALL_SONGS;
    return curListId === viewId;
}

// ==============================================================================
// VIEW CONFIGS
// ==============================================================================
const viewConfigs = {
    [VIEWS.ALL_SONGS]: {
        heroTitle: 'All Songs',
        heroLabel: 'Playlist',
        showClear: false,
        showHero: true,
        getCount: () => getSongCountForList(VIEWS.ALL_SONGS),
        render: () => renderSongsList(getSongsForList(VIEWS.ALL_SONGS), VIEWS.ALL_SONGS),
        finalize: (listId) => finalizeViewSwitch(listId),
        updateCount: () => {
            const el = document.getElementById('all-songs-count-display');
            if (el)
                el.textContent =
                    getSongCountForList(VIEWS.ALL_SONGS) + (getSongCountForList(VIEWS.ALL_SONGS) === 1 ? ' song' : ' songs');
        }
    },
    [VIEWS.HISTORY]: {
        heroTitle: 'Recents',
        heroLabel: 'Playlist',
        showClear: false,
        showHero: true,
        idValue: 'History',
        getCount: () => getSongCountForList(VIEWS.HISTORY),
        render: () => renderHistoryView(),
        finalize: (listId) => finalizeViewSwitch(listId)
    },
    [VIEWS.FAVORITES]: {
        heroTitle: 'Liked Songs',
        heroLabel: 'Playlist',
        showClear: false,
        showHero: true,
        getCount: () => getSongCountForList(VIEWS.FAVORITES),
        render: () => renderFavoritesView(),
        finalize: (listId) => finalizeViewSwitch(listId)
    },
    [VIEWS.SETTINGS]: {
        heroTitle: '',
        heroLabel: '',
        showClear: false,
        showHero: false,
        getCount: () => 0,
        render: () => openSettingsPanel(),
        finalize: (listId) => refreshUIAfterViewSwitch()
    },
    [VIEWS.SEARCH_HISTORY]: {
        heroTitle: '',
        heroLabel: '',
        showClear: false,
        showHero: false,
        getCount: () => 0,
        render: () => renderSearchHistoryView(),
        finalize: (listId) => refreshUIAfterViewSwitch()
    },
    [VIEWS.ONLINE_LYRICS]: {
        heroTitle: '',
        heroLabel: '',
        showClear: false,
        showHero: false,
        getCount: () => 0,
        render: () => renderOnlineLyricsView(),
        finalize: (listId) => refreshUIAfterViewSwitch()
    },
    [VIEWS.SMART_LYRICS]: {
        heroTitle: '',
        heroLabel: '',
        showClear: false,
        showHero: false,
        getCount: () => 0,
        render: () => renderSmartLyricsFinder(),
        finalize: (listId) => refreshUIAfterViewSwitch()
    },
    [VIEWS.LYRICS]: {
        heroTitle: 'Lyrics',
        heroLabel: 'Now Playing',
        showClear: false,
        showHero: false,
        getCount: () => 0,
        render: () => renderLyricsView(),
        finalize: (listId) => refreshUIAfterViewSwitch()
    }
};

const viewHandlers = {
    [VIEWS.SETTINGS]: {
        enter: () => {
            closeSettingsPanelOnly();
            openSettingsPanel();
        }
    },
    [VIEWS.ONLINE_LYRICS]: {
        enter: () => {
            currentView = VIEWS.ONLINE_LYRICS;
            resetLeftPanelActiveState();
            resetViewScroll();
            setSubheroVisibility(VIEWS.ONLINE_LYRICS);
            showHeroSection(false);
            showTracklistHeader(false);
            updateHeroCover(VIEWS.ONLINE_LYRICS);
            renderOnlineLyricsView();
        }
    },
    [VIEWS.SMART_LYRICS]: {
        enter: () => {
            currentView = VIEWS.SMART_LYRICS;
            resetLeftPanelActiveState();
            resetViewScroll();
            setSubheroVisibility(VIEWS.SMART_LYRICS);
            showHeroSection(false);
            showTracklistHeader(false);
            updateHeroCover(VIEWS.SMART_LYRICS);
            renderSmartLyricsFinder();
        }
    },
    [VIEWS.LYRICS]: {
        enter: () => {
            currentView = VIEWS.LYRICS;
            resetLeftPanelActiveState();
            resetViewScroll();
            setSubheroVisibility(VIEWS.LYRICS);
            showHeroSection(false);
            showTracklistHeader(false);
            updateHeroCover(VIEWS.LYRICS);
            const lyricsToggleBtn = document.getElementById('lyrics-toggle-btn');
            if (lyricsToggleBtn) lyricsToggleBtn.classList.add('active');
            renderLyricsView();
        }
    },
    [VIEWS.SEARCH_ITEMS]: {
        enter: () => {
            const searchHistory = getSearchHistory();
            if (searchHistory.length > 0) {
                const lastSearch = searchHistory[0];
                searchInput.value = lastSearch.query;
                searchQuery = lastSearch.query.toLowerCase().trim();
                currentSearchSessionId = lastSearch.sessionId;
            }
            currentView = VIEWS.SEARCH_ITEMS;
            resetLeftPanelActiveState();
            closeSettingsPanel();
            resetViewScroll();
            showTracklistHeader(true);
            setupHeroSection(
                true,
                `"${searchQuery}"`,
                getSongCountForList(VIEWS.SEARCH_ITEMS),
                'Search Results',
                currentSearchSessionId,
                false
            );
            renderSongsList(getSongsForList(VIEWS.SEARCH_ITEMS), VIEWS.SEARCH_ITEMS);
            refreshUIAfterViewSwitch();
        }
    },
    playlist: {
        enter: (playlistId) => {
            const playlists = getPlaylists();
            const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
            if (playlist) {
                openPlaylist(playlistId);
            } else {
                switchView(VIEWS.PLAYLISTS);
            }
        }
    },
    default: {
        enter: (view) => {
            resetSearchState();
            resetSubheroSearch();

            const songListContainer = document.getElementById('song-list-container');
            if (songListContainer) songListContainer.style.display = '';
            const lyricsRoot = document.getElementById('lyrics-view-root');
            if (lyricsRoot) lyricsRoot.style.display = 'none';
            document.body.classList.remove('in-lyrics-view');

            currentView = view;
            resetLeftPanelActiveState();
            activateLeftPanelItem(view);
            updateHeroCover(view);
            updateSubheroPlayButton(isCurrentViewPlaying());
            setSubheroVisibility(view);

            const settingsToggleBtn = document.querySelector('.settings-toggle-btn');
            if (settingsToggleBtn) {
                settingsToggleBtn.classList.toggle('active', currentView === VIEWS.SETTINGS);
            }

            showTracklistHeader(true);
            setupHeroSection(true, 'All Songs', getSongCountForList(VIEWS.ALL_SONGS), 'Playlist');
            renderSongsList(getSongsForList(VIEWS.ALL_SONGS), VIEWS.ALL_SONGS);

            const allSongsCountDisplay = document.getElementById('all-songs-count-display');
            if (allSongsCountDisplay) {
                allSongsCountDisplay.textContent =
                    getSongCountForList(VIEWS.ALL_SONGS) + (getSongCountForList(VIEWS.ALL_SONGS) === 1 ? ' song' : ' songs');
            }

            refreshUIAfterViewSwitch();
        }
    }
};

// ==============================================================================
// LIST PROVIDERS
// ==============================================================================
const listProviders = {
    [VIEWS.ALL_SONGS]: {
        getSongs: () => getActiveSongs(),
        getCount: () => getActiveSongs().length
    },
    [VIEWS.SEARCH]: {
        getSongs: () => getSearchResults(searchQuery),
        getCount: () => listProviders.search.getSongs().length
    },
    [VIEWS.SEARCH_ITEMS]: {
        getSongs: () => listProviders.search.getSongs(),
        getCount: () => listProviders.search.getSongs().length
    },
    [VIEWS.FAVORITES]: {
        getSongs: () => {
            const favorites = getFavorites();
            return filterDeletedSongs(favorites.map((id) => SONGS_DATA.find((s) => s.id === id)));
        },
        getCount: () => getActiveFavoritesCount()
    },
    [VIEWS.HISTORY]: {
        getSongs: () => {
            const history = getPlayHistory();
            return filterDeletedSongs(history.map((entry) => SONGS_DATA.find((s) => s.id === entry.id)));
        },
        getCount: () => getPlayHistory().length
    },
    [VIEWS.ALBUMS]: {
        getSongs: () => {
            const albums = getAlbums();
            const allSongIds = [];
            for (const album of albums) {
                allSongIds.push(...album.songs);
            }
            return filterDeletedSongs(allSongIds.map((id) => SONGS_DATA.find((s) => s.id === id)));
        },
        getCount: () => listProviders.albums.getSongs().length
    },
    [VIEWS.ARTISTS]: {
        getSongs: () => {
            const artists = getArtists();
            const allSongIds = [];
            for (const artist of artists) {
                allSongIds.push(...artist.songs);
            }
            return filterDeletedSongs(allSongIds.map((id) => SONGS_DATA.find((s) => s.id === id)));
        },
        getCount: () => listProviders.artists.getSongs().length
    }
};

function getSongsForPrefixedList(listId) {
    if (!listId) return null;
    if (listId.startsWith('playlist-')) {
        return getPlaylistSongs(listId.replace('playlist-', ''));
    }
    if (listId.startsWith('a') && listId.length === 13) {
        return getAlbumSongs(listId);
    }
    if (listId.startsWith('r') && listId.length === 13) {
        return getArtistSongs(listId);
    }
    return null;
}

function getSongsForList(listId) {
    const prefixed = getSongsForPrefixedList(listId);
    if (prefixed !== null) return prefixed;

    const provider = listProviders[listId];
    if (!provider) return getActiveSongs();

    return provider.getSongs();
}

function getSongCountForList(listId) {
    const prefixed = getSongsForPrefixedList(listId);
    if (prefixed !== null) return prefixed.length;

    const provider = listProviders[listId];
    return provider ? provider.getCount() : 0;
}

// ==============================================================================
// VIEW NAVIGATION HISTORY
// ==============================================================================
function pushToHistoryStack(song) {
    if (!song || isNavigatingHistory) return;

    const actualSong = song.song || song;

    if (historyNavigationIndex < playbackHistoryStack.length - 1) {
        playbackHistoryStack = playbackHistoryStack.slice(0, historyNavigationIndex + 1);
    }

    const historyEntry = {
        id: actualSong.id,
        title: actualSong.title,
        artist: actualSong.artist,
        cover: actualSong.cover,
        duration: actualSong.duration,
        url: actualSong.url,
        timestamp: Date.now(),
        listId: currentView,
        queueIndex: currentQueueIndex
    };

    playbackHistoryStack.push(historyEntry);

    historyNavigationIndex = playbackHistoryStack.length - 1;

    if (playbackHistoryStack.length > 100) {
        playbackHistoryStack.shift();
        historyNavigationIndex--;
    }

    isManualPlay = false;
    isPrevNavigation = false;
}

function pushViewToHistory(view) {
    if (isNavigatingHistory) {
        return;
    }

    if (playbackHistoryStack.length > 0 && playbackHistoryStack[historyNavigationIndex]?.listId === view) {
        return;
    }

    if (historyNavigationIndex > 0 && playbackHistoryStack[historyNavigationIndex - 1]?.listId === view) {
        historyNavigationIndex--;
        updateNavigationButtons();
        return;
    }

    if (historyNavigationIndex < playbackHistoryStack.length - 1) {
        playbackHistoryStack = playbackHistoryStack.slice(0, historyNavigationIndex + 1);
    }

    playbackHistoryStack.push({
        listId: view,
        timestamp: Date.now(),
        queueIndex: currentQueueIndex
    });

    historyNavigationIndex = playbackHistoryStack.length - 1;

    if (playbackHistoryStack.length > 100) {
        playbackHistoryStack.shift();
        historyNavigationIndex--;
    }

    updateNavigationButtons();
}

function canGoBack() {
    return historyNavigationIndex > 0;
}

function canGoForward() {
    return historyNavigationIndex < playbackHistoryStack.length - 1;
}

function goBack() {
    if (!canGoBack()) {
        return;
    }

    isNavigatingHistory = true;
    historyNavigationIndex--;

    const historyEntry = playbackHistoryStack[historyNavigationIndex];
    let targetView = historyEntry.listId;

    if (targetView === '__navigate__' && canGoBack()) {
        historyNavigationIndex--;
        targetView = playbackHistoryStack[historyNavigationIndex].listId;
    }

    if (targetView && targetView.startsWith('playlist-')) {
        const playlistId = targetView.replace('playlist-', '');
        viewHandlers.playlist.enter(playlistId);
    } else if (targetView && targetView.startsWith('a') && targetView.length === 13) {
        openDetailView(targetView, 'album');
    } else if (targetView && targetView.startsWith('r') && targetView.length === 13) {
        openDetailView(targetView, 'artist');
    } else if (targetView === 'settings-advanced') {
        enterAdvancedSettingsFromHistory();
    } else if (targetView === VIEWS.SETTINGS) {
        enterSettingsFromHistory();
    } else if (targetView === VIEWS.SEARCH_ITEMS || targetView === VIEWS.SEARCH) {
        switchView(VIEWS.ALL_SONGS);
    } else if (targetView === VIEWS.LYRICS) {
        if (typeof switchToLyrics === 'function') switchToLyrics();
    } else {
        switchView(targetView);
    }

    isNavigatingHistory = false;
    updateNavigationButtons();
}

function goForward() {
    if (!canGoForward()) {
        return;
    }

    isNavigatingHistory = true;
    historyNavigationIndex++;

    const historyEntry = playbackHistoryStack[historyNavigationIndex];
    let targetView = historyEntry.listId;

    if (targetView === '__navigate__' && canGoForward()) {
        historyNavigationIndex++;
        targetView = playbackHistoryStack[historyNavigationIndex].listId;
    }

    if (targetView && targetView.startsWith('playlist-')) {
        const playlistId = targetView.replace('playlist-', '');
        viewHandlers.playlist.enter(playlistId);
    } else if (targetView && targetView.startsWith('a') && targetView.length === 13) {
        openDetailView(targetView, 'album');
    } else if (targetView && targetView.startsWith('r') && targetView.length === 13) {
        openDetailView(targetView, 'artist');
    } else if (targetView === 'settings-advanced') {
        enterAdvancedSettingsFromHistory();
    } else if (targetView === VIEWS.SETTINGS) {
        enterSettingsFromHistory();
    } else if (targetView === VIEWS.SEARCH_ITEMS || targetView === VIEWS.SEARCH) {
        switchView(VIEWS.ALL_SONGS);
    } else if (targetView === VIEWS.LYRICS) {
        if (typeof switchToLyrics === 'function') switchToLyrics();
    } else {
        switchView(targetView);
    }

    isNavigatingHistory = false;
    updateNavigationButtons();
}

function updateNavigationButtons() {
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');

    if (backBtn) {
        backBtn.disabled = !canGoBack();
        backBtn.style.opacity = canGoBack() ? '1' : '0.5';
        if (!canGoBack()) {
            backBtn.removeAttribute('title');
        } else {
            backBtn.setAttribute('title', 'Go back');
        }
    }
    if (forwardBtn) {
        forwardBtn.disabled = !canGoForward();
        forwardBtn.style.opacity = canGoForward() ? '1' : '0.5';
        if (!canGoForward()) {
            forwardBtn.removeAttribute('title');
        } else {
            forwardBtn.setAttribute('title', 'Go forward');
        }
    }
}

// ==============================================================================
// DETAIL VIEW OPENERS
// ==============================================================================
function openDetailView(id, type) {
    const items = type === 'album' ? getAlbums() : getArtists();
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (currentView === VIEWS.LYRICS) {
        if (typeof teardownLyricsView === 'function') {
            teardownLyricsView();
        }
        document.body.classList.remove('in-lyrics-view');
        const lyricsToggleBtn = document.getElementById('lyrics-toggle-btn');
        if (lyricsToggleBtn) lyricsToggleBtn.classList.remove('active');
    }

    const viewName = id;

    if (currentView === viewName) {
        return;
    }

    resetLeftPanelActiveState();

    if (type === 'album') {
        activateLeftPanelItem(VIEWS.ALBUMS);
    } else {
        activateLeftPanelItem(VIEWS.ARTISTS);
    }

    const detailItem = document.querySelector(`.left-panel-main-item[data-view="${viewName}"]`);
    if (detailItem) detailItem.classList.add('active');

    pushViewToHistory(viewName);

    currentView = viewName;
    updateHeroCover(viewName);
    updateSubheroPlayButton(isCurrentViewPlaying());
    setSubheroVisibility(viewName);
    resetSubheroSearch();
    resetViewScroll();

    const gradientWrapper = document.querySelector('.content-gradient-wrapper');
    if (gradientWrapper) gradientWrapper.classList.remove('no-gradient');

    if (typeof clearAllSelections === 'function') {
        clearAllSelections();
    }

    const subheroSearchIcon = document.getElementById('subhero-search-icon');
    if (subheroSearchIcon) {
        subheroSearchIcon.setAttribute('title', 'Search in ' + item.name);
    }

    const shortId = item.id.substring(1, 11).toUpperCase();
    setupHeroSection(true, item.name, item.songCount, type === 'album' ? 'Album' : 'Artist', shortId);
    showTracklistHeader(true);

    if (type === 'album') {
        renderAlbumDetailView(id);
    } else {
        renderArtistDetailView(id);
    }

    resetSearchState();

    setTimeout(() => {
        applyStoredHighlight(currentView);
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 50);
}

function openAlbum(albumId) {
    openDetailView(albumId, 'album');
}

function openArtist(artistId) {
    openDetailView(artistId, 'artist');
}

// ==============================================================================
// VIEW SWITCHING
// ==============================================================================
function switchToLyrics() {
    const lyricsToggleBtn = document.getElementById('lyrics-toggle-btn');

    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) {
        if (lyricsToggleBtn && lyricsToggleBtn.disabled) return;
        return;
    }

    if (currentView === VIEWS.SETTINGS) {
        closeSettingsPanelOnly();
    }

    if (currentView === VIEWS.LYRICS) {
        if (lyricsToggleBtn) lyricsToggleBtn.classList.remove('active');

        document.body.classList.remove('in-lyrics-view');

        const songListContainer = document.getElementById('song-list-container');
        if (songListContainer) songListContainer.style.display = '';

        if (typeof teardownLyricsView === 'function') {
            teardownLyricsView();
        }

        if (canGoBack()) {
            goBack();
        } else {
            switchView(VIEWS.ALL_SONGS);
        }

        const songListContainerAfter = document.getElementById('song-list-container');
        if (songListContainerAfter) songListContainerAfter.style.display = '';

        updateNavigationButtons();

        const content = document.querySelector('.content');
        if (content && lyricsPreView === currentView) {
            const savedTop = lyricsPreScrollTop;
            let lastAppliedTop = -1;

            const restoreScrollPosition = () => {
                content.scrollTop = savedTop;
                if (content.scrollTop === lastAppliedTop) return;
                lastAppliedTop = content.scrollTop;
                if (typeof renderVirtualScrollImmediate === 'function') {
                    renderVirtualScrollImmediate(content);
                }
                if (typeof updateExternalScrollbar === 'function') {
                    updateExternalScrollbar();
                }
            };

            restoreScrollPosition();

            requestAnimationFrame(() => {
                restoreScrollPosition();
                requestAnimationFrame(() => {
                    restoreScrollPosition();
                    lyricsPreView = null;
                    lyricsPreScrollTop = 0;
                });
            });
        } else {
            lyricsPreView = null;
            lyricsPreScrollTop = 0;
        }
        return;
    }

    if (lyricsPreView === null) {
        const content = document.querySelector('.content');
        lyricsPreScrollTop = content ? content.scrollTop : 0;
        lyricsPreView = currentView;
    }

    document.body.classList.add('in-lyrics-view');
    switchView(VIEWS.LYRICS);
}

function switchView(view) {
    let isSameView = currentView === view;

    if ((currentView === VIEWS.LYRICS || currentView === VIEWS.ONLINE_LYRICS || currentView === VIEWS.SMART_LYRICS) && view !== VIEWS.LYRICS && view !== VIEWS.ONLINE_LYRICS && view !== VIEWS.SMART_LYRICS) {
        if (typeof teardownLyricsView === 'function') {
            teardownLyricsView();
        }
        isSameView = false;
    }

    if (currentView === VIEWS.SMART_LYRICS && view !== VIEWS.SMART_LYRICS) {
        if (typeof teardownSmartLyricsVirtualScroll === 'function') {
            teardownSmartLyricsVirtualScroll();
        }
    }
    
    if (view !== VIEWS.LYRICS && view !== VIEWS.ONLINE_LYRICS && view !== VIEWS.SMART_LYRICS) {
        const lyricsRoot = document.getElementById('lyrics-view-root');
        if (lyricsRoot) lyricsRoot.style.display = 'none';
        const songListContainer = document.getElementById('song-list-container');
        if (songListContainer) songListContainer.style.display = '';
        document.body.classList.remove('in-lyrics-view');
        const trackLyricsBody = document.getElementById('track-lyrics-body');
        if (trackLyricsBody) trackLyricsBody.scrollTop = 0;
        if (typeof applyTrackLyricsExpandedState === 'function') {
            applyTrackLyricsExpandedState();
            requestAnimationFrame(() => applyTrackLyricsExpandedState());
        }
    } else {
        document.body.classList.toggle('in-lyrics-view', view === VIEWS.LYRICS);
        if (typeof applyTrackLyricsExpandedState === 'function') {
            applyTrackLyricsExpandedState();
            requestAnimationFrame(() => applyTrackLyricsExpandedState());
        }
    }

    if (virtualScrollState.enabled && view !== currentView) {
        if (typeof teardownLazyLoading === 'function') {
            teardownLazyLoading();
        }
    }

    if (isSameView) {
        if (view !== VIEWS.SETTINGS) {
            return;
        }
    }

    pushViewToHistory(view);

    if (view !== VIEWS.LYRICS) {
        resetLeftPanelActiveState();
    }

    const lyricsToggleBtn = document.getElementById('lyrics-toggle-btn');
    if (lyricsToggleBtn) {
        lyricsToggleBtn.classList.toggle('active', view === VIEWS.LYRICS);
    }

    if (view !== VIEWS.LYRICS && view !== VIEWS.ONLINE_LYRICS && view !== VIEWS.SMART_LYRICS) {
        if (view && view.startsWith('playlist-')) {
            activateLeftPanelItem(VIEWS.PLAYLISTS);
            const playlistItem = document.querySelector(`.left-panel-main-item[data-view="${view}"]`);
            if (playlistItem) {
                playlistItem.classList.add('active');
            }
        } else if (view === VIEWS.ALL_SONGS || view === VIEWS.FAVORITES) {
            activateLeftPanelItem(view);
        } else {
            activateLeftPanelItem(view);
        }
    }

    resetViewScroll();

    if (typeof clearAllSelections === 'function') {
        clearAllSelections();
    }

    resetSearchState();
    resetSubheroSearch();

    currentView = view;
    document.body.classList.toggle('view-all-songs', view === VIEWS.ALL_SONGS);
    document.body.classList.toggle('view-favorites', view === VIEWS.FAVORITES);
    updateHeroCover(view);
    updateSubheroPlayButton(isCurrentViewPlaying());

    setSubheroVisibility(view);

    const settingsToggleBtn = document.querySelector('.settings-toggle-btn');
    if (settingsToggleBtn) {
        settingsToggleBtn.classList.toggle('active', currentView === VIEWS.SETTINGS);
    }

    if (typeof setOnlineLyricsSearchButtonActive === 'function') {
        setOnlineLyricsSearchButtonActive(currentView === VIEWS.ONLINE_LYRICS);
    }

    if (view === VIEWS.ALBUMS) {
        showTracklistHeader(false);
        setupHeroSection(true, 'Albums', getAlbums().length, 'Collection');
        renderAlbumsView();
        renderAlbumLeftPanelItems();
        updateHeroCover(VIEWS.ALBUMS);
        refreshUIAfterViewSwitch();
        return;
    }

    if (view && view.startsWith('a') && view.length === 13) {
        openDetailView(view, 'album');
        return;
    }

    if (view && view.startsWith('r') && view.length === 13) {
        openDetailView(view, 'artist');
        return;
    }

    const gradientWrapper = document.querySelector('.content-gradient-wrapper');

    if (view === VIEWS.PLAYLISTS || view === VIEWS.SETTINGS || view === VIEWS.SEARCH_HISTORY || view === VIEWS.LYRICS || view === VIEWS.ONLINE_LYRICS || view === VIEWS.SMART_LYRICS) {
        showTracklistHeader(false);
        setupHeroSection(false);
        if (view === VIEWS.SETTINGS && gradientWrapper) {
            gradientWrapper.classList.add('no-gradient');
        } else if (gradientWrapper) {
            gradientWrapper.classList.remove('no-gradient');
        }
    } else if (view && view.startsWith('playlist-')) {
        showTracklistHeader(true);
        if (gradientWrapper) gradientWrapper.classList.remove('no-gradient');
    } else {
        showTracklistHeader(true);
        if (gradientWrapper) gradientWrapper.classList.remove('no-gradient');
    }

    if (!virtualScrollState.enabled || virtualScrollState.currentListId !== view) {
        if (typeof teardownLazyLoading === 'function') {
            teardownLazyLoading();
        }
    }

    if (view === VIEWS.PLAYLISTS) {
        return;
    }

    if (view === VIEWS.SEARCH_ITEMS) {
        const searchHistory = getSearchHistory();
        const lastSearch = searchHistory.find((entry) => entry.sessionId === currentSearchSessionId);
        if (lastSearch) {
            viewConfigs[VIEWS.SEARCH_ITEMS].heroTitle = `"${lastSearch.query}"`;
        }
    }

    const config = viewConfigs[view];

    if (config) {
        if (config.showHero) {
            const count = config.getCount();
            setupHeroSection(true, config.heroTitle, count, config.heroLabel, config.idValue || null, config.showClear);
        } else {
            setupHeroSection(false);
        }

        config.render();

        if (config.updateCount) {
            config.updateCount();
        }

        if (config.finalize) {
            config.finalize(view);
        }
    } else {
        setupHeroSection(false);
        songListElement.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <i class="fas fa-cog fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i><br>
                <span>${view.replace('-', ' ').toUpperCase()} view coming soon!</span>
            </div>
        `;
        refreshUIAfterViewSwitch();
    }

    if (typeof applyTrackLyricsExpandedState === 'function') {
        applyTrackLyricsExpandedState();
    }
}

// ==============================================================================
// SETTINGS/HISTORY NAVIGATION HELPERS
// ==============================================================================
function switchToHistoryFromSettings() {
    switchView(VIEWS.HISTORY);
}

function switchToSearchHistoryFromSettings() {
    switchView(VIEWS.SEARCH_HISTORY);
}

function handleHeroClear() {
    if (currentView === VIEWS.HISTORY) {
        clearPlayHistory();
    } else if (currentView === VIEWS.SEARCH_HISTORY) {
        clearSearchHistory();
    } else if (currentView === VIEWS.SEARCH_ITEMS && currentSearchSessionId) {
        deleteSearchHistoryEntry(currentSearchSessionId);
    }
}

function openSearchHistoryChild(sessionId, query) {
    searchInput.value = query;
    searchQuery = query.toLowerCase().trim();

    const filteredSongs = getSearchResults(searchQuery);

    pushViewToHistory(VIEWS.SEARCH_ITEMS);

    currentView = VIEWS.SEARCH_ITEMS;
    currentSearchSessionId = sessionId;

    resetViewScroll();

    ghostLists[VIEWS.SEARCH_ITEMS] = [];
    for (let i = 0; i < filteredSongs.length; i++) {
        ghostLists[VIEWS.SEARCH_ITEMS].push(`SearchItem${String(i + 1).padStart(5, '0')}`);
    }
    nextSearchItemSlotId = filteredSongs.length + 1;

    setupHeroSection(true, escapeHtml(query), filteredSongs.length, 'Search', sessionId, true);

    renderSongsList(filteredSongs, VIEWS.SEARCH_ITEMS);
    reapplyHighlightAfterFilter(VIEWS.SEARCH_ITEMS, filteredSongs);
    reapplySelectionAfterFilter(VIEWS.SEARCH_ITEMS, filteredSongs);

    resetLeftPanelActiveState();

    refreshUIAfterViewSwitch();
}

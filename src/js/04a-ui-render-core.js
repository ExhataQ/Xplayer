// ==============================================================================
// UI RENDER - HERO SECTION
// ==============================================================================
function updateHeroSongCount(count) {
    const heroCountElement = document.getElementById('hero-song-count');
    if (heroCountElement) {
        heroCountElement.textContent = count + (count === 1 ? ' song' : ' songs');
    }
}

function updateHeroSection(title, count, label = 'Playlist', idValue = null) {
    const heroTitle = document.getElementById('hero-title');
    const heroCount = document.getElementById('hero-song-count');
    const heroLabel = document.querySelector('.playlist-hero-label');

    if (heroTitle) {
        heroTitle.textContent = title;
        heroTitle.style.fontSize = '';
        heroTitle.style.textOverflow = '';
        heroTitle.style.overflow = '';
    }
    if (heroCount) {
        if (idValue !== null) {
            if (idValue === 'History') {
                heroCount.textContent = `History • ${count} ${count === 1 ? 'play' : 'plays'}`;
            } else if (idValue === 'Searches') {
                heroCount.textContent = `Searches • ${count} ${count === 1 ? 'search' : 'searches'}`;
                showHeroClearButton(true);
            } else {
                heroCount.textContent = `#${idValue} • ${count} ${count === 1 ? 'song' : 'songs'}`;
                showHeroClearButton(false);
            }
        } else {
            heroCount.textContent = count + (count === 1 ? ' song' : ' songs');
            showHeroClearButton(false);
        }
    }
    if (heroLabel) {
        heroLabel.textContent = label;
    }

    setTimeout(() => {
        adjustHeroTitleSize();
    }, 0);
}

function showHeroClearButton(show) {
    const clearBtn = document.getElementById('hero-clear-btn');
    if (clearBtn) {
        clearBtn.style.display = show ? 'flex' : 'none';
    }
}

function showHeroSection(show) {
    const heroSection = document.getElementById('playlist-hero-section');
    if (heroSection) {
        heroSection.style.display = show ? 'flex' : 'none';
    }
}

function setupHeroSection(show, title, count, label = 'Playlist', idValue = null, showClear = false) {
    showHeroSection(show);
    showHeroClearButton(showClear);
    if (show) {
        updateHeroSection(title, count, label, idValue);
    }
}

function showTracklistHeader(show) {
    const tracklistHeader = document.querySelector('.tracklist-header');
    if (tracklistHeader) {
        tracklistHeader.style.display = show ? 'flex' : 'none';
    }
}

function updateHeroCover(view) {
    document.body.classList.toggle('view-all-songs', view === 'all-songs');
    document.body.classList.toggle('view-favorites', view === 'favorites');
    const defaultSvg = document.getElementById('hero-cover-svg');
    const heartSvg = document.getElementById('hero-cover-svg-heart');
    const historySvg = document.getElementById('hero-cover-svg-history');
    const playlistSvg = document.getElementById('hero-cover-svg-playlist');
    const heroImage = document.getElementById('hero-cover-image');

    defaultSvg.style.display = 'none';
    heartSvg.style.display = 'none';
    historySvg.style.display = 'none';
    playlistSvg.style.display = 'none';
    heroImage.style.display = 'none';

    const heroCover = document.querySelector('.playlist-hero-cover');
    if (heroCover) heroCover.classList.remove('artist-view');

    let coverUrlForColor = null;

    if (view === 'favorites') {
        heartSvg.style.display = 'block';
    } else if (view === 'history') {
        historySvg.style.display = 'block';
    } else if (view === 'albums') {
        playlistSvg.style.display = 'block';
    } else if (view && view.startsWith('playlist-')) {
        const playlistId = view.replace('playlist-', '');
        const playlists = getPlaylists();
        const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
        if (playlist && playlist.cover) {
            heroImage.src = playlist.cover;
            heroImage.style.display = 'block';
            coverUrlForColor = playlist.cover;
        } else {
            playlistSvg.style.display = 'block';
        }
    } else if (view && view.startsWith('a') && view.length === 13) {
        const albums = getAlbums();
        const album = albums.find((a) => a.id === view);
        if (album && album.cover) {
            heroImage.src = album.cover;
            heroImage.style.display = 'block';
            coverUrlForColor = album.cover;
        } else {
            playlistSvg.style.display = 'block';
        }
    } else if (view && view.startsWith('r') && view.length === 13) {
        document.querySelector('.playlist-hero-cover').classList.add('artist-view');
        const artists = getArtists();
        const artist = artists.find((a) => a.id === view);
        if (artist && artist.cover) {
            heroImage.src = artist.cover;
            heroImage.style.display = 'block';
            coverUrlForColor = artist.cover;
        } else {
            defaultSvg.style.display = 'block';
        }
    } else {
        defaultSvg.style.display = 'block';
    }

    if (typeof applyViewColorFromCover === 'function') {
        applyViewColorFromCover(coverUrlForColor);
    }
}

function collectAllLeftPanelItems() {
    const items = [];
    const pinnedIds = getPinnedItems();
    const playedOrder = getPlayedItemOrder();

    const allSongsCount = getActiveSongs().length;
    items.push({
        type: 'all-songs',
        title: 'All Songs',
        viewId: 'all-songs',
        pinId: 'all-songs',
        count: allSongsCount,
        isPinned: pinnedIds.includes('all-songs'),
        playedIndex: playedOrder.indexOf('all-songs')
    });

    const favoritesCount = getActiveFavoritesCount();
    items.push({
        type: 'favorites',
        title: 'Liked Songs',
        viewId: 'favorites',
        pinId: 'favorites',
        count: favoritesCount,
        isPinned: pinnedIds.includes('favorites'),
        playedIndex: playedOrder.indexOf('favorites')
    });

    const playlists = getPlaylists();
    playlists.forEach((playlist) => {
        if (!isItemInAnyFolder(playlist.id, 'playlist')) {
            items.push({
                type: 'playlist',
                id: playlist.id,
                title: playlist.name,
                viewId: `playlist-${playlist.id}`,
                pinId: `playlist-${playlist.id}`,
                count: `${playlist.songs.length} ${playlist.songs.length === 1 ? 'song' : 'songs'}`,
                cover: playlist.cover,
                isPinned: pinnedIds.includes(`playlist-${playlist.id}`),
                playedIndex: playedOrder.indexOf(`playlist-${playlist.id}`)
            });
        }
    });

    const folders = getFolders();
    folders.forEach((folder) => {
        if (!isItemInAnyFolder(folder.id, 'folder')) {
            items.push({
                type: 'folder',
                id: folder.id,
                title: folder.name,
                viewId: `folder-${folder.id}`,
                pinId: `folder-${folder.id}`,
                countText: updateFolderCount(folder.id),
                isPinned: pinnedIds.includes(`folder-${folder.id}`),
                playedIndex: playedOrder.indexOf(`folder-${folder.id}`)
            });
        }
    });

    if (leftPanelFilterMode === 'albums' || leftPanelFilterMode === 'all') {
        const albums = getAlbums();
        albums.forEach((album) => {
            items.push({
                type: 'album',
                id: album.id,
                title: album.name,
                viewId: album.id,
                pinId: album.id,
                count: album.songCount,
                cover: album.cover,
                isPinned: pinnedIds.includes(album.id),
                playedIndex: playedOrder.indexOf(album.id)
            });
        });
    }

    if (leftPanelFilterMode === 'artists' || leftPanelFilterMode === 'all') {
        const artists = getArtists();
        artists.forEach((artist) => {
            items.push({
                type: 'artist',
                id: artist.id,
                title: artist.name,
                viewId: artist.id,
                pinId: artist.id,
                count: artist.songCount,
                cover: artist.cover,
                isPinned: pinnedIds.includes(artist.id),
                playedIndex: playedOrder.indexOf(artist.id)
            });
        });
    }

    items.sort((a, b) => {
        if (a.isPinned && b.isPinned)
            return (a.playedIndex !== -1 ? a.playedIndex : 999) - (b.playedIndex !== -1 ? b.playedIndex : 999);
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const aPlayed = a.playedIndex !== -1 ? a.playedIndex : 999;
        const bPlayed = b.playedIndex !== -1 ? b.playedIndex : 999;
        if (aPlayed !== bPlayed) return aPlayed - bPlayed;
        return 0;
    });

    return items;
}

// ==============================================================================
// UI RENDER - SONG ITEMS
// ==============================================================================
function createSongItemHTML(song, index = null, listId = null) {
    const currentQueueItem = currentQueueIndex >= 0 ? playbackQueue[currentQueueIndex] : null;
    const currentSongId = currentQueueItem
        ? currentQueueItem.song
            ? currentQueueItem.song.id
            : currentQueueItem.id
        : null;
    const isCurrentlyPlaying = currentSongId === song.id;
    const slotIndex = getGhostSlotId(listId, song.id);
    const shouldHighlight = isCurrentlyPlaying && activeSlotHighlights[listId] === slotIndex;
    const isSelected = typeof selectedSongIds !== 'undefined' && selectedSongIds.has(song.id);

    const ghostList = ghostLists[listId];
    let ghostSlotValue = null;
    if (listId === 'all-songs') {
        ghostSlotValue = index !== null ? `${listId}-${index}` : null;
    } else if (ghostList && index !== null && ghostList[index] !== undefined) {
        ghostSlotValue = `${listId}-${ghostList[index]}`;
    }

    return buildSongItemHTML({
        song: song,
        index: index,
        highlight: shouldHighlight,
        selected: isSelected,
        listId: listId,
        ghostSlotValue: ghostSlotValue,
        onClick: `playSongFromList(${song.id}, '${listId}', ${index !== null ? index : 'null'})`,
        onContextMenu: `event.preventDefault(); showContextMenu(event, ${song.id})`,
        showExtraButtons: true
    });
}

function buildSongArtistHTML(song) {
    if (!song || !song.artist) return '';
    const names = typeof getArtistNamesForSong === 'function' ? getArtistNamesForSong(song) : [String(song.artist)];
    if (names.length === 0) return escapeHtml(String(song.artist));
    const artists = typeof getArtists === 'function' ? getArtists() : [];
    const idByName = {};
    for (const a of artists) idByName[a.name] = a.id;
    return names
        .map((name) => {
            const artistId = idByName[name];
            if (!artistId) return `<span class="song-artist-name">${escapeHtml(name)}</span>`;
            return `<span class="song-artist-name" onclick="event.stopPropagation(); openArtist('${artistId}')" onmousedown="event.stopPropagation();">${escapeHtml(
                name
            )}</span>`;
        })
        .join('<span class="song-artist-sep">, </span>');
}

function buildSongAlbumHTML(song) {
    if (!song || !song.album || song.album.trim() === '') return '';
    const albums = typeof getAlbums === 'function' ? getAlbums() : [];
    const album = albums.find((a) => a.name === song.album);
    const name = escapeHtml(song.album);
    if (!album) return `<span class="song-album-name">${name}</span>`;
    return `<span class="song-album-name" onclick="event.stopPropagation(); openAlbum('${album.id}')" onmousedown="event.stopPropagation();">${name}</span>`;
}

function buildSongItemHTML(config) {
    const {
        song,
        index = null,
        highlight = false,
        selected = false,
        listId = '',
        ghostSlotValue = null,
        onClick = '',
        onContextMenu = '',
        showExtraButtons = true
    } = config;

    let numberHTML = '';
    if (index !== null) {
        numberHTML = `<div class="song-number-item" onclick="event.stopPropagation(); handleNumberCellClick(${
            song.id
        }, '${listId}', ${index})" ondblclick="event.stopPropagation()" data-song-index="${index}">${
            index + 1
        }</div>`;
    } else {
        numberHTML = '<div class="song-number-item hidden-number" data-song-index="">0</div>';
    }

    const ghostSlot = ghostSlotValue || `${listId}-${index !== null ? index : ''}`;
    const isFav = isFavorite(song.id);
    const langBadge = song._detectedLanguage && song._detectedLanguage !== 'undetected'
        ? ` <span class="song-lang-badge" title="Detected language: ${escapeHtml(song._detectedLanguage)}${song._detectedLanguageSource ? ' (' + escapeHtml(song._detectedLanguageSource) + ')' : ''}">[${escapeHtml(song._detectedLanguage)}]</span>`
        : '';

    let extraButtonsHTML = '';
    if (showExtraButtons) {
        extraButtonsHTML = `
                <div class="song-action-buttons" ondblclick="event.stopPropagation()">
                        <button class="add-to-queue-btn" 
                                onclick="event.stopPropagation(); addSongToQueueNext(${song.id})"
                                ondblclick="event.stopPropagation()"
                                title="Add to queue"
                                aria-label="Add to queue next">
                                <i class="fas fa-plus"></i>
                        </button>
                        <button class="favorite-btn" 
                                onclick="event.stopPropagation(); toggleFavorite(${song.id}, this)"
                                ondblclick="event.stopPropagation()"
                                title="${isFav ? 'Remove from favorites' : 'Add to favorites'}"
                                aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                            <i class="fas fa-heart ${isFav ? 'liked' : 'unliked'}"></i>
                        </button>
                </div>`;
    }

    return `
    <div class="song-item ${highlight ? 'playing' : ''} ${selected ? 'selected' : ''}" 
         onclick="selectSongItem(this, ${song.id}, '${listId}', ${index !== null ? index : 'null'}, event)"
         ondblclick="playSongFromList(${song.id}, '${listId}', ${index !== null ? index : 'null'})"
         oncontextmenu="${onContextMenu}"
         tabindex="0"
         onkeydown="if(event.key === 'Enter') playSongFromList(${song.id}, '${listId}', ${
        index !== null ? index : 'null'
    })"
         aria-label="Play ${song.title} by ${song.artist}"
         data-song-id="${song.id}"
         data-ghost-slot="${ghostSlot}"
         data-cover="${song.largeCover || song.cover || ''}">
            ${numberHTML}
            <div class="left-song-item">
                    <img class="song-cover" 
                         src="${song.cover || PLACEHOLDER_IMAGE}" 
                         alt="Cover for ${song.title}"
                         onerror="this.onerror=null; this.src=PLACEHOLDER_IMAGE"
                         onload="if(this.naturalWidth > 0 && this.naturalWidth < 200) this.style.opacity='0.5'">
                    <div class="song-info">
                            <div class="song-title">${song.title}</div>
                            <div class="song-artist">${buildSongArtistHTML(song)}${langBadge}</div>
                    </div>
            </div>
            <div class="song-album">${buildSongAlbumHTML(song)}</div>
            <div class="right-song-item">
                    ${extraButtonsHTML}
                    <div class="song-duration">${song.duration}</div>
                    <div class="more-info" onclick="event.stopPropagation(); ${onContextMenu}" ondblclick="event.stopPropagation()" title="More options for ${song.title.replace(
        /"/g,
        '&quot;'
    )}">
                            <span class="material-symbols-outlined">more_horiz</span>
                    </div>
            </div>
    </div>
    `;
}

function renderRightPanelItem(song, config = {}) {
    const {
        isNowPlaying = false,
        onClick = '',
        contextMenuArgs = `${song.id}`,
        extraClass = '',
        title = song.title || 'Unknown Title',
        artist = song.artist || 'Unknown Artist'
    } = config;

    return `
            <div class="queue-item ${extraClass}"
                 ${onClick ? `onclick="${onClick}"` : ''}
                 oncontextmenu="event.preventDefault(); showContextMenu(event, ${contextMenuArgs})">
                    <img class="queue-item-cover" 
                         src="${song.cover || PLACEHOLDER_IMAGE}"
                         alt="Cover" 
                         onerror="this.src=PLACEHOLDER_IMAGE">
                    <div class="queue-item-info">
                            <div class="queue-item-title"${
                                isNowPlaying ? ' style="color: var(--accent); font-weight: 600;"' : ''
                            }>${title}</div>
                            <div class="queue-item-artist">${artist}</div>
                    </div>
                    <div class="more-info" onclick="event.stopPropagation(); showContextMenu(event, ${contextMenuArgs})" title="More options for ${title.replace(
        /"/g,
        '&quot;'
    )}">
                            <span class="material-symbols-outlined">more_horiz</span>
                    </div>
            </div>`;
}

// ==============================================================================
// UI RENDER - SONG LISTS
// ==============================================================================
function renderSongsList(songs, listId = 'all-songs') {
    if (currentView === 'settings') return;

    const songListContainer = document.getElementById('song-list-container');
    if (songListContainer && songListContainer.style.display === 'none') {
        songListContainer.style.display = '';
    }
    const lyricsRoot = document.getElementById('lyrics-view-root');
    if (lyricsRoot && lyricsRoot.style.display !== 'none') {
        lyricsRoot.style.display = 'none';
    }

    if (!songs || songs.length === 0) {
        document.getElementById('song-list').innerHTML = `
            <div class="empty-state-container">
                <i class="fas fa-music"></i>
                <span>No songs found</span>
            </div>
        `;
        clearGhostList(listId);
        updateHeroSongCount(0);
        return;
    }

    if (listId === 'search-items') {
        ghostLists['search-items'] = [];
        for (let i = 0; i < songs.length; i++) {
            ghostLists['search-items'].push(`SearchItem${String(i + 1).padStart(5, '0')}`);
        }
        nextSearchItemSlotId = songs.length + 1;
    } else if (listId === 'favorites') {
        ghostLists['favorites'] = [];
        for (let i = 0; i < songs.length; i++) {
            ghostLists['favorites'].push(`Favorites${String(i + 1).padStart(5, '0')}`);
        }
        nextFavoriteSlotId = songs.length + 1;
    } else if (listId && listId.startsWith('playlist-')) {
        ghostLists[listId] = [];
        for (let i = 0; i < songs.length; i++) {
            ghostLists[listId].push(`${listId}-${String(i + 1).padStart(5, '0')}`);
        }
    } else {
        rebuildGhostListFromMain(listId, songs);
    }

    const shouldBeVirtual = shouldUseVirtualScroll(songs);
    const isVirtual = virtualScrollState.enabled && virtualScrollState.currentListId === listId;

    if (shouldBeVirtual && isVirtual) {
        virtualScrollState.currentSongs = songs;
        virtualScrollState.visibleItems = [];
        virtualScrollState.firstVisibleIndex = -1;
        virtualScrollState.lastVisibleIndex = -1;
        renderVisibleItems(virtualScrollState.container, false);
        virtualScrollState.lastRenderedStart = virtualScrollState.firstVisibleIndex;
        virtualScrollState.lastRenderedEnd = virtualScrollState.lastVisibleIndex;
        applyStoredHighlight(listId);
    } else if (shouldBeVirtual) {
        initLazyLoading(songs, listId);
    } else {
        if (typeof teardownLazyLoading === 'function') {
            teardownLazyLoading();
        }

        const songsHtml = songs
            .map((song, index) => {
                return createSongItemHTML(song, index, listId);
            })
            .join('');

        document.getElementById('song-list').innerHTML = songsHtml;
        applyStoredHighlight(listId);
    }

    if (listId === 'all-songs') {
        updateHeroSongCount(songs.length);
    }
    if (listId === 'favorites') {
        updateHeroSongCount(songs.length);
    }

    setTimeout(() => {
        updateExternalScrollbar();
    }, 50);

    setTimeout(() => {
        initHoverLayer();
    }, 100);
}

// ==============================================================================
// HOVER HIGHLIGHT SYSTEM
// ==============================================================================
let hoverLayer = null;
let activeHighlightEl = null;
let selectionHighlightLayer = null;
let hoveredSongIndex = -1;
let activeSongSlot = null;
let hoveredRowEl = null;
const ROW_EDGE_INSET = 25;
const HOVER_SCROLL_THROTTLE_MS = 80;
let hoverHighlightThrottleTimer = null;
let hoverHighlightTrailingPending = false;

function scheduleHoverHighlightUpdate() {
    if (hoverHighlightThrottleTimer) {
        hoverHighlightTrailingPending = true;
        return;
    }
    updateHoverHighlightAfterScroll();
    hoverHighlightThrottleTimer = setTimeout(() => {
        hoverHighlightThrottleTimer = null;
        if (hoverHighlightTrailingPending) {
            hoverHighlightTrailingPending = false;
            scheduleHoverHighlightUpdate();
        }
    }, HOVER_SCROLL_THROTTLE_MS);
}

function createHighlightDiv() {
    const div = document.createElement('div');
    div.style.cssText = `position: absolute; left: ${ROW_EDGE_INSET}px; right: ${ROW_EDGE_INSET}px; border-radius: var(--radius-xs); pointer-events: none; z-index: 0;`;
    return div;
}

function getItemPosition(item) {
    const content = document.querySelector('.content');
    const contentRect = content.getBoundingClientRect();
    const scrollTop = content.scrollTop;
    const itemRect = item.getBoundingClientRect();
    return {
        top: itemRect.top - contentRect.top + scrollTop,
        height: itemRect.height
    };
}

function initHoverLayer() {
    if (hoverLayer) return;

    const content = document.querySelector('.content');
    if (!content) return;

    hoverLayer = document.createElement('div');
    hoverLayer.className = 'active-hover-styles-set';
    hoverLayer.id = 'active-hover-styles-set';
    hoverLayer.style.cssText =
        'position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; z-index: 0; will-change: transform;';

    activeHighlightEl = createHighlightDiv();
    activeHighlightEl.style.background = 'rgba(var(--accent-rgb), 0.15)';
    activeHighlightEl.style.display = 'none';
    hoverLayer.appendChild(activeHighlightEl);

    content.appendChild(hoverLayer);

    selectionHighlightLayer = document.createElement('div');
    selectionHighlightLayer.className = 'selection-styles-set';
    selectionHighlightLayer.id = 'selection-styles-set';
    selectionHighlightLayer.style.cssText =
        'position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; z-index: 0;';
    content.appendChild(selectionHighlightLayer);

    content.addEventListener('mousemove', handleHoverMouseMove);
    content.addEventListener('mouseleave', handleHoverMouseLeave);

    function blockRowEdgeDeadZone(e) {
        const item = e.target.closest('.song-item');
        if (!item) return;
        if (e.target.closest('.song-action-buttons, .add-to-queue-btn, .favorite-btn, .more-info')) return;
        const rect = item.getBoundingClientRect();
        if (e.clientX < rect.left + ROW_EDGE_INSET || e.clientX > rect.right - ROW_EDGE_INSET) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }
    content.addEventListener('click', blockRowEdgeDeadZone, true);
    content.addEventListener('dblclick', blockRowEdgeDeadZone, true);

    let scrollRAF = null;
    content.addEventListener(
        'scroll',
        () => {
            if (document.body.classList.contains('dragging-scrollbar')) {
                hideHoverHighlight();
                hoveredSongIndex = -1;
            }

            if (!scrollRAF) {
                scrollRAF = requestAnimationFrame(() => {
                    scrollRAF = null;
                    if (activeSongSlot !== null) {
                        updateActiveHighlight(activeSongSlot);
                    }
                    if (!document.body.classList.contains('dragging-scrollbar')) {
                        scheduleHoverHighlightUpdate();
                    }
                });
            }
        },
        {
            passive: true
        }
    );
    window.addEventListener('resize', () => {
        if (activeSongSlot !== null) {
            updateActiveHighlight(activeSongSlot);
        }
        if (document.querySelector('.song-item.selected')) {
            updateSelectionHighlight();
        }
    });
}

function handleHoverMouseMove(e) {
    if (document.body.classList.contains('dragging-scrollbar')) return;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    const songList = document.getElementById('song-list');
    const songItems = songList ? songList.querySelectorAll('.song-item') : [];
    if (!songList || songItems.length === 0) {
        hideHoverHighlight();
        hoveredSongIndex = -1;
        return;
    }

    const listRect = songList.getBoundingClientRect();
    if (
        e.clientX < listRect.left ||
        e.clientX > listRect.right ||
        e.clientY < listRect.top ||
        e.clientY > listRect.bottom
    ) {
        hideHoverHighlight();
        hoveredSongIndex = -1;
        return;
    }

    let foundIndex = -1;
    let foundItem = null;

    songItems.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const inDeadZone = e.clientX < rect.left + ROW_EDGE_INSET || e.clientX > rect.right - ROW_EDGE_INSET;
        if (e.clientY >= rect.top && e.clientY <= rect.bottom && !inDeadZone) {
            foundIndex = index;
            foundItem = item;
        }
    });

    if (foundIndex !== hoveredSongIndex || foundItem !== hoveredRowEl) {
        hoveredSongIndex = foundIndex;
        updateHoverHighlight(foundItem);
    }
}

function updateHoverHighlight(foundItem) {
    let hoverEl = document.getElementById('hover-highlight-single');
    if (document.body.classList.contains('dragging-song')) {
        if (hoverEl) hoverEl.style.display = 'none';
        if (hoveredRowEl) {
            hoveredRowEl.classList.remove('row-hover-active');
            hoveredRowEl = null;
        }
        hoveredSongIndex = -1;
        return;
    }

    if (hoveredRowEl && hoveredRowEl !== foundItem) {
        hoveredRowEl.classList.remove('row-hover-active');
        hoveredRowEl = null;
    }

    if (typeof currentView !== 'undefined' && currentView === 'lyrics') {
        if (hoverEl) hoverEl.style.display = 'none';
        return;
    }

    if (!foundItem || foundItem.classList.contains('selected')) {
        if (hoverEl) hoverEl.style.display = 'none';
        return;
    }

    if (!hoverEl) {
        hoverEl = createHighlightDiv();
        hoverEl.id = 'hover-highlight-single';
        hoverEl.style.background = 'var(--bg-hover)';
        if (hoverLayer) hoverLayer.appendChild(hoverEl);
    }

    const pos = getItemPosition(foundItem);
    hoverEl.style.top = pos.top + 'px';
    hoverEl.style.height = pos.height + 'px';
    hoverEl.style.display = 'block';
    hoverLayer.style.zIndex = '0';

    foundItem.classList.add('row-hover-active');
    hoveredRowEl = foundItem;
}

function handleHoverMouseLeave() {
    if (!document.body.classList.contains('dragging-scrollbar')) {
        hideHoverHighlight();
        hoveredSongIndex = -1;
    }
}

function hideHoverHighlight() {
    clearTimeout(hoverHighlightThrottleTimer);
    hoverHighlightThrottleTimer = null;
    hoverHighlightTrailingPending = false;
    const hoverEl = document.getElementById('hover-highlight-single');
    if (hoverEl) hoverEl.style.display = 'none';
    if (hoveredRowEl) {
        hoveredRowEl.classList.remove('row-hover-active');
        hoveredRowEl = null;
    }
}

function updateHoverHighlightAfterScroll() {
    if (document.body.classList.contains('dragging-scrollbar')) {
        hideHoverHighlight();
        hoveredSongIndex = -1;
        return;
    }

    const songList = document.getElementById('song-list');
    const songItems = songList ? songList.querySelectorAll('.song-item') : [];
    if (!songList || songItems.length === 0) {
        hideHoverHighlight();
        hoveredSongIndex = -1;
        return;
    }

    const listRect = songList.getBoundingClientRect();
    if (
        lastMouseX < listRect.left ||
        lastMouseX > listRect.right ||
        lastMouseY < listRect.top ||
        lastMouseY > listRect.bottom
    ) {
        hideHoverHighlight();
        hoveredSongIndex = -1;
        return;
    }

    let foundItem = null;
    songItems.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const inDeadZone = lastMouseX < rect.left + ROW_EDGE_INSET || lastMouseX > rect.right - ROW_EDGE_INSET;
        if (lastMouseY >= rect.top && lastMouseY <= rect.bottom && !inDeadZone) {
            foundItem = item;
        }
    });

    if (foundItem) {
        updateHoverHighlight(foundItem);
    } else {
        hideHoverHighlight();
        hoveredSongIndex = -1;
    }
}

// ==============================================================================
// SELECTION SYSTEM
// ==============================================================================
let selectedSongId = null;
let selectedSongIds = new Set();
let lastSelectedIndex = null;
let selectionHighlights = [];

document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const target = document.activeElement;
        if (
            target &&
            (target.id === 'search-input' ||
                target.id === 'subhero-search-input' ||
                target.id === 'left-panel-search-input' ||
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable)
        )
            return;

        const visibleItems = document.querySelectorAll('#song-list .song-item:not(.lazy-skeleton)');
        if (visibleItems.length === 0) return;

        e.preventDefault();
        clearAllSelections();

        let songs;
        if (
            virtualScrollState.enabled &&
            virtualScrollState.currentSongs &&
            virtualScrollState.currentSongs.length > 0
        ) {
            songs = virtualScrollState.currentSongs;
        } else {
            songs = getSongsForList(currentView);
        }

        if (!songs || songs.length === 0) return;

        for (let i = 0; i < songs.length; i++) {
            selectedSongIds.add(songs[i].id);
        }
        lastSelectedIndex = songs.length - 1;
        selectedSongId = songs[0].id;

        visibleItems.forEach((item) => {
            item.classList.add('selected');
        });

        const lastItem = visibleItems[visibleItems.length - 1];
        if (lastItem) lastItem.classList.add('last-selected');

        updateSelectionHighlight();
    }
    if (e.key === 'Escape') {
        const target = document.activeElement;
        if (
            target &&
            (target.id === 'search-input' ||
                target.id === 'subhero-search-input' ||
                target.id === 'left-panel-search-input')
        )
            return;
        if (selectedSongIds.size > 0) {
            e.preventDefault();
            clearAllSelections();
        }
    }
});

function selectSongItem(element, songId, listId, index, event = null) {
    const ctrlHeld = event && (event.ctrlKey || event.metaKey);
    const shiftHeld = event && event.shiftKey;

    if (ctrlHeld) {
        if (selectedSongIds.has(songId)) {
            element.classList.remove('selected');
            selectedSongIds.delete(songId);
        } else {
            element.classList.add('selected');
            selectedSongIds.add(songId);
        }
        lastSelectedIndex = index;
        selectedSongId = selectedSongIds.size > 0 ? songId : null;
        updateSelectionHighlight();
        document.querySelectorAll('.song-item.last-selected').forEach((el) => el.classList.remove('last-selected'));
        element.classList.add('last-selected');
        hideHoverHighlight();
        hoveredSongIndex = -1;
        return;
    }

    if (shiftHeld && lastSelectedIndex !== null && index !== null) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);

        const allVisibleItems = document.querySelectorAll('#song-list .song-item:not(.lazy-skeleton)');
        allVisibleItems.forEach((item) => {
            const itemSongId = parseInt(item.getAttribute('data-song-id'));
            if (!isNaN(itemSongId)) {
                const songIndex = getSongIndexById(itemSongId, listId);
                if (songIndex >= start && songIndex <= end) {
                    item.classList.add('selected');
                }
            }
        });

        const currentSongs =
            virtualScrollState.enabled && virtualScrollState.currentSongs
                ? virtualScrollState.currentSongs
                : getSongsForList(listId || currentView);
        for (let i = start; i <= end; i++) {
            if (i < currentSongs.length) {
                selectedSongIds.add(currentSongs[i].id);
            }
        }

        selectedSongId = songId;
        updateSelectionHighlight();
        document.querySelectorAll('.song-item.last-selected').forEach((el) => el.classList.remove('last-selected'));
        element.classList.add('last-selected');
        hideHoverHighlight();
        hoveredSongIndex = -1;
        return;
    }

    clearAllSelections();

    selectedSongId = songId;
    selectedSongIds.add(songId);
    lastSelectedIndex = index;
    element.classList.add('selected');
    updateSelectionHighlight();
    document.querySelectorAll('.song-item.last-selected').forEach((el) => el.classList.remove('last-selected'));
    element.classList.add('last-selected');
}

function clearAllSelections() {
    document.querySelectorAll('.song-item.selected').forEach((item) => {
        item.classList.remove('selected');
    });
    document.querySelectorAll('.song-item.last-selected').forEach((el) => el.classList.remove('last-selected'));
    selectedSongId = null;
    selectedSongIds.clear();
    lastSelectedIndex = null;
    updateSelectionHighlight();
    hideHoverHighlight();
    hoveredSongIndex = -1;
    selectionHighlights.forEach((el) => el.remove());
    selectionHighlights = [];
}

function reapplySelectionAfterFilter(listId, filteredSongs) {
    document.querySelectorAll('.song-item.selected').forEach((item) => {
        item.classList.remove('selected');
    });
    document.querySelectorAll('.song-item.last-selected').forEach((item) => {
        item.classList.remove('last-selected');
    });

    if (selectedSongIds.size === 0) {
        selectedSongId = null;
        lastSelectedIndex = null;
        updateSelectionHighlight();
        return;
    }

    document.querySelectorAll('#song-list .song-item:not(.lazy-skeleton)').forEach((item) => {
        const id = parseInt(item.getAttribute('data-song-id'));
        if (!isNaN(id) && selectedSongIds.has(id)) {
            item.classList.add('selected');
        }
    });

    if (selectedSongId !== null && !selectedSongIds.has(selectedSongId)) {
        selectedSongId = selectedSongIds.values().next().value;
    }

    if (selectedSongId !== null) {
        const el = document.querySelector(`#song-list .song-item[data-song-id="${selectedSongId}"]`);
        if (el) el.classList.add('last-selected');
        lastSelectedIndex = filteredSongs.findIndex((s) => s.id === selectedSongId);
        if (lastSelectedIndex === -1) lastSelectedIndex = null;
    } else {
        lastSelectedIndex = null;
    }

    updateSelectionHighlight();
}

function getSongIndexById(songId, listId) {
    const songs =
        virtualScrollState.enabled && virtualScrollState.currentSongs
            ? virtualScrollState.currentSongs
            : getSongsForList(listId || currentView);
    for (let i = 0; i < songs.length; i++) {
        if (songs[i].id === songId) return i;
    }
    return -1;
}

function updateSelectionHighlight() {
    selectionHighlights.forEach((el) => el.remove());
    selectionHighlights = [];

    const allSongItems = document.querySelectorAll('#song-list .song-item');
    const selectedItems = document.querySelectorAll('.song-item.selected');
    if (selectedItems.length === 0) return;

    const selectedSet = new Set();
    const selectedIndexes = [];
    allSongItems.forEach((item, i) => {
        if (item.classList.contains('selected')) {
            selectedSet.add(i);
            selectedIndexes.push(i);
        }
    });

    selectedIndexes.forEach((index) => {
        const item = allSongItems[index];
        const pos = getItemPosition(item);

        const hasSelectedAbove = selectedSet.has(index - 1);
        const hasSelectedBelow = selectedSet.has(index + 1);

        let borderRadius;
        if (hasSelectedAbove && hasSelectedBelow) {
            borderRadius = '0';
        } else if (hasSelectedAbove) {
            borderRadius = '0 0 var(--radius-xs) var(--radius-xs)';
        } else if (hasSelectedBelow) {
            borderRadius = 'var(--radius-xs) var(--radius-xs) 0 0';
        } else {
            borderRadius = 'var(--radius-xs)';
        }

        const highlight = createHighlightDiv();
        highlight.style.top = pos.top + 'px';
        highlight.style.height = pos.height + 'px';
        highlight.style.background = 'rgba(255, 255, 255, 0.30)';
        highlight.style.borderRadius = borderRadius;

        const layer = document.getElementById('selection-styles-set') || document.querySelector('.content');
        if (layer) layer.appendChild(highlight);

        selectionHighlights.push(highlight);
    });
}

function updateActiveHighlight(slotIdentifier) {
    if (!activeHighlightEl) return;
    activeHighlightEl.style.display = 'none';
    activeSongSlot = slotIdentifier;
}

// ==============================================================================
// UI RENDER - LEFT PANEL
// ==============================================================================
function renderLeftPanelMainList() {
    if (currentOpenFolderId) {
        renderFolderContents(currentOpenFolderId);
        return;
    }

    if (leftPanelVirtualState.enabled) {
        refreshLeftPanelLazy();
    } else {
        initLeftPanelLazyLoading();
    }
}

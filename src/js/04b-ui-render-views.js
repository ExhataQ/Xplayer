// ==============================================================================
// UI RENDER - PLAYLISTS
// ==============================================================================
function renderPlaylistsView() {
    const playlists = getPlaylists();
    const leftPanelMainList = document.querySelector('.left-panel-main-list');

    const existingPlaylistItems = leftPanelMainList.querySelectorAll('.playlist-child-item');
    existingPlaylistItems.forEach((item) => item.remove());

    if (playlists.length === 0) {
        return;
    }

    const pinnedIds = getPinnedItems();
    const playedOrder = getPlayedItemOrder();
    const sortedPlaylists = [...playlists].sort((a, b) => {
        const aId = `playlist-${a.id}`;
        const bId = `playlist-${b.id}`;
        const aPinned = pinnedIds.includes(aId);
        const bPinned = pinnedIds.includes(bId);

        if (aPinned && bPinned) {
            const aIndex = pinnedIds.indexOf(aId);
            const bIndex = pinnedIds.indexOf(bId);
            return aIndex - bIndex;
        }
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        const aPlayedIndex = playedOrder.indexOf(aId);
        const bPlayedIndex = playedOrder.indexOf(bId);
        if (aPlayedIndex !== -1 && bPlayedIndex !== -1) return aPlayedIndex - bPlayedIndex;
        if (aPlayedIndex !== -1) return -1;
        if (bPlayedIndex !== -1) return 1;
        return 0;
    });

    const currentItem =
        currentQueueIndex >= 0 && playbackQueue[currentQueueIndex] ? playbackQueue[currentQueueIndex] : null;
    const currentListId = currentItem ? currentItem.listId || 'all-songs' : null;
    const isPlayingGlobal = !!currentItem;
    const isPausedGlobal = isPlayingGlobal && audioElement.paused;

    sortedPlaylists.forEach((playlist) => {
        const playlistItem = document.createElement('li');
        playlistItem.className = 'left-panel-main-item playlist-child-item';
        playlistItem.setAttribute('onclick', `openPlaylist('${playlist.id}')`);
        playlistItem.setAttribute('oncontextmenu', `showPlaylistContextMenu(event, '${playlist.id}'); return false;`);
        playlistItem.setAttribute('data-view', `playlist-${playlist.id}`);
        playlistItem.setAttribute('data-pin-id', `playlist-${playlist.id}`);
        playlistItem.setAttribute('tabindex', '0');

        const viewId = `playlist-${playlist.id}`;
        const isPlaying = isPlayingGlobal && currentListId === viewId;
        const isPaused = isPlaying && isPausedGlobal;
        if (isPlaying) {
            playlistItem.classList.add('playing');
            if (isPaused) playlistItem.classList.add('paused');
        }

        const coverHTML = playlist.cover
            ? `<img class="main-item-cover-img album-cover-img" src="${playlist.cover}" alt="" style="width: 45px; height: 45px; border-radius: 8px; object-fit: cover;">`
            : `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                    <rect width="400" height="400" rx="8" fill="#2a2a2a"/>
                    <rect x="140" y="140" width="120" height="30" rx="6" fill="var(--accent)"/>
                    <rect x="140" y="185" width="120" height="30" rx="6" fill="var(--accent)" opacity="0.7"/>
                    <rect x="140" y="230" width="120" height="30" rx="6" fill="var(--accent)" opacity="0.4"/>
               </svg>`;

        playlistItem.innerHTML = `
                <div class="subfolder-row">
                        <div class="main-item-cover-wrapper">
                                ${coverHTML}
                                <button class="left-panel-cover-play-btn" data-view="playlist-${
                                    playlist.id
                                }" onmousedown="event.stopPropagation()" aria-label="Play"></button>
                        </div>
                        <div class="main-item-info">
                                <span class="main-item-title">${escapeHtml(playlist.name)}</span>
                                <span class="main-item-subtitle">
                                        <span>Playlist</span>
                                        <span class="main-item-dot">•</span>
                                        <span class="main-item-count">${playlist.songs.length} ${
            playlist.songs.length === 1 ? 'song' : 'songs'
        }</span>
                                </span>
                        </div>
                        <span class="left-panel-playing-icon"><span class="material-symbols-outlined">volume_up</span></span>
                </div>
        `;

        leftPanelMainList.appendChild(playlistItem);
    });

    renderLeftPanelMainList();
    updateLeftPanelCounts();
    updateScrollbarById('left-panel-main-content');
}

function renderFoldersView() {
    const folders = getFolders();
    const leftPanelMainList = document.querySelector('.left-panel-main-list');

    const existingFolderItems = leftPanelMainList.querySelectorAll('.folder-child-item');
    existingFolderItems.forEach((item) => item.remove());

    if (folders.length === 0) return;

    const pinnedIds = getPinnedItems();
    const playedOrder = getPlayedItemOrder();
    const sortedFolders = [...folders].sort((a, b) => {
        const aId = `folder-${a.id}`;
        const bId = `folder-${b.id}`;
        const aPinned = pinnedIds.includes(aId);
        const bPinned = pinnedIds.includes(bId);

        if (aPinned && bPinned) return pinnedIds.indexOf(aId) - pinnedIds.indexOf(bId);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        const aPlayed = playedOrder.indexOf(aId);
        const bPlayed = playedOrder.indexOf(bId);
        if (aPlayed !== -1 && bPlayed !== -1) return aPlayed - bPlayed;
        if (aPlayed !== -1) return -1;
        if (bPlayed !== -1) return 1;
        return 0;
    });

    sortedFolders.forEach((folder) => {
        const folderItem = document.createElement('li');
        folderItem.className = 'left-panel-main-item folder-child-item';
        folderItem.setAttribute('onclick', `openFolder('${folder.id}')`);
        folderItem.setAttribute('oncontextmenu', `showFolderContextMenu(event, '${folder.id}'); return false;`);
        folderItem.setAttribute('data-view', `folder-${folder.id}`);
        folderItem.setAttribute('data-pin-id', `folder-${folder.id}`);
        folderItem.setAttribute('tabindex', '0');

        const countText = updateFolderCount(folder.id);

        folderItem.innerHTML = `
                <div class="subfolder-row">
                        <div class="main-item-cover-wrapper">
                                <svg class="main-item-cover-svg folder-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                                        <rect class="folder-cover-bg" width="400" height="400" rx="8"/>
                                        <path d="M108 173 L108 148 Q108 130 126 130 L172 130 Q180 130 186 136 L200 150 Q206 155 214 155 L274 155 Q292 155 292 173 L292 272 Q292 290 274 290 L126 290 Q108 290 108 272 Z" fill="#212121" stroke="none"/>
                                        <path d="M108 173 L108 148 Q108 130 126 130 L172 130 Q180 130 186 136 L200 150 Q206 155 214 155 L274 155 Q292 155 292 173 L292 272 Q292 290 274 290 L126 290 Q108 290 108 272 Z" fill="none" stroke="#c0c0c0" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/>
                                </svg>
                        </div>
                        <div class="main-item-info">
                                <span class="main-item-title">${escapeHtml(folder.name)}</span>
                                <span class="main-item-subtitle">
                                        <span>Folder</span>
                                        <span class="main-item-dot">•</span>
                                        <span class="main-item-count">${countText}</span>
                                </span>
                        </div>
                        <span class="left-panel-playing-icon"><span class="material-symbols-outlined">volume_up</span></span>
                </div>
        `;

        leftPanelMainList.appendChild(folderItem);
    });

    renderLeftPanelMainList();
    updateScrollbarById('left-panel-main-content');
}

function renderFolderContents(folderId) {
    if (typeof teardownLeftPanelLazyLoading === 'function') {
        teardownLeftPanelLazyLoading();
    }

    const leftPanelMainList = document.querySelector('.left-panel-main-list');
    const leftPanelContent = document.getElementById('left-panel-main-content');

    if (leftPanelContent) {
        leftPanelContent.scrollTop = 0;
    }

    leftPanelMainList.innerHTML = '';

    const directChildren = buildFolderChildItems(folderId, folderId);

    if (directChildren.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'left-panel-main-item';
        emptyItem.style.cursor = 'default';
        emptyItem.innerHTML = `
                <div class="main-item-info" style="text-align: center; padding: 20px;">
                        <span class="main-item-subtitle">Empty folder</span>
                </div>
        `;
        leftPanelMainList.appendChild(emptyItem);
        updateScrollbarById('left-panel-main-content');
        return;
    }

    const flat = [];
    flattenLeftPanelItems(directChildren, 0, folderId, flat, new Set([folderId]));

    flat.forEach((item) => {
        const listItem = document.createElement('li');
        listItem.className = 'left-panel-main-item folder-contents-item';
        listItem.setAttribute('data-pin-id', item.pinId);
        listItem.setAttribute('data-view', item.viewId);
        listItem.setAttribute('data-depth', String(item.depth || 0));
        listItem.setAttribute('data-parent-folder', folderId);
        listItem.setAttribute('tabindex', '0');
        const indentPx = Math.min(item.depth || 0, 5) * 15;
        listItem.style.setProperty('--indent', indentPx + 'px');
        if (currentView === item.viewId) listItem.classList.add('active');
        const currentItem =
            currentQueueIndex >= 0 && playbackQueue[currentQueueIndex] ? playbackQueue[currentQueueIndex] : null;
        const currentListId = currentItem ? currentItem.listId || 'all-songs' : null;
        const isPlaying = !!(currentItem && currentListId === item.viewId);
        const isPaused = isPlaying && audioElement.paused;
        if (isPlaying) {
            listItem.classList.add('playing');
            if (isPaused) listItem.classList.add('paused');
        }

        const shortcutBadge = item.isShortcut
            ? '<span class="shortcut-indicator" title="Shortcut">&#10548;</span>'
            : '';

        let coverHTML = '';
        let typeLabel = '';

        if (item.type === 'folder') {
            coverHTML = `<svg class="main-item-cover-svg folder-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                                    <rect class="folder-cover-bg" width="400" height="400" rx="8"/>
                                    <path d="M108 173 L108 148 Q108 130 126 130 L172 130 Q180 130 186 136 L200 150 Q206 155 214 155 L274 155 Q292 155 292 173 L292 272 Q292 290 274 290 L126 290 Q108 290 108 272 Z" fill="#212121" stroke="none"/>
                                    <path d="M108 173 L108 148 Q108 130 126 130 L172 130 Q180 130 186 136 L200 150 Q206 155 214 155 L274 155 Q292 155 292 173 L292 272 Q292 290 274 290 L126 290 Q108 290 108 272 Z" fill="none" stroke="#c0c0c0" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/>
                            </svg>`;
            typeLabel = 'Folder';
            listItem.setAttribute('onclick', `openFolder('${item.id}')`);
            listItem.setAttribute('oncontextmenu', `showFolderContextMenu(event, '${item.id}'); return false;`);
        } else if (item.type === 'playlist') {
            coverHTML = item.cover
                ? `<img class="main-item-cover-img album-cover-img" src="${item.cover}" alt="" style="width: 45px; height: 45px; border-radius: 8px; object-fit: cover;">`
                : `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                        <rect width="400" height="400" rx="8" fill="#2a2a2a"/>
                        <rect x="140" y="140" width="120" height="30" rx="6" fill="var(--accent)"/>
                        <rect x="140" y="185" width="120" height="30" rx="6" fill="var(--accent)" opacity="0.7"/>
                        <rect x="140" y="230" width="120" height="30" rx="6" fill="var(--accent)" opacity="0.4"/>
                   </svg>`;
            typeLabel = 'Playlist';
            listItem.setAttribute('onclick', `openPlaylist('${item.id}')`);
            listItem.setAttribute('oncontextmenu', `showPlaylistContextMenu(event, '${item.id}'); return false;`);
        } else if (item.type === 'album') {
            coverHTML = item.cover
                ? `<img class="main-item-cover-img album-cover-img" src="${item.cover}" alt="">`
                : `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                        <rect width="400" height="400" rx="8" fill="#1a1a1a"/>
                        <circle cx="200" cy="200" r="115" fill="none" stroke="#fff" stroke-width="8"/>
                        <circle cx="200" cy="200" r="30" fill="#fff"/>
                        <circle cx="200" cy="200" r="10" fill="#1a1a1a"/>
                   </svg>`;
            typeLabel = 'Album';
            listItem.setAttribute('onclick', `openAlbum('${item.id}')`);
            listItem.setAttribute('oncontextmenu', `showAlbumContextMenu(event, '${item.id}'); return false;`);
        } else if (item.type === 'artist') {
            coverHTML = item.cover
                ? `<img class="main-item-cover-img artist-cover-img" src="${item.cover}" alt="">`
                : `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                        <rect width="400" height="400" rx="200" fill="#2a2a2a"/>
                        <circle cx="200" cy="155" r="70" fill="var(--accent)"/>
                        <ellipse cx="200" cy="320" rx="110" ry="45" fill="var(--accent)"/>
                   </svg>`;
            typeLabel = 'Artist';
            listItem.setAttribute('onclick', `openArtist('${item.id}')`);
            listItem.setAttribute('oncontextmenu', `showArtistContextMenu(event, '${item.id}'); return false;`);
        } else if (item.type === 'special') {
            const isAllSongs = item.id === 'all-songs';
            const isFavorites = item.id === 'favorites';
            if (isAllSongs) {
                coverHTML = `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                        <rect width="400" height="400" rx="8" fill="var(--accent)"/>
                        <circle cx="200" cy="200" r="70" fill="none" stroke="#000000" stroke-width="12"/>
                        <polygon points="180,160 180,240 240,200" fill="#000000"/>
                </svg>`;
                typeLabel = 'Playlist';
            } else if (isFavorites) {
                coverHTML = `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                        <defs><linearGradient id="likedGradientFldr" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#450af5"/><stop offset="100%" style="stop-color:#c4efd9"/>
                        </linearGradient></defs>
                        <rect width="400" height="400" rx="8" fill="url(#likedGradientFldr)"/>
                        <path d="M200 290 L170 260 C140 230 110 200 110 170 C110 140 135 115 165 115 C180 115 195 125 200 135 C205 125 220 115 235 115 C265 115 290 140 290 170 C290 200 260 230 230 260 L200 290Z" fill="#ffffff" stroke="none" transform="scale(0.6) translate(135, 100)"/>
                </svg>`;
                typeLabel = 'Playlist';
            }
            listItem.setAttribute('onclick', `switchView('${item.id}')`);
            listItem.setAttribute(
                'oncontextmenu',
                `showSpecialItemContextMenu(event, '${item.id}', '${item.title}'); return false;`
            );
        }

        const subtitleParts = [];
        if (item.isPinned) subtitleParts.push('<i class="fas fa-thumbtack pinned-indicator"></i>');
        if (item.isShortcut) subtitleParts.push(shortcutBadge);
        subtitleParts.push(`<span>${typeLabel}</span>`);
        const countText =
            item.countText || (item.count !== undefined ? `${item.count} ${item.count === 1 ? 'song' : 'songs'}` : '');
        if (countText) {
            subtitleParts.push('<span class="main-item-dot">•</span>');
            subtitleParts.push(`<span class="main-item-count">${countText}</span>`);
        }

        let chevronHTML = '';
        if (item.type === 'folder' && (item.childCount > 0 || item.isExpanded)) {
            const icon = item.isExpanded ? 'expand_less' : 'expand_more';
            chevronHTML = `<button class="folder-chevron ${item.isExpanded ? 'expanded' : ''}" data-folder-key="${
                item.parentKey
            }/${item.id}" onclick="event.stopPropagation(); toggleFolderExpandedFromUI('${item.parentKey}', '${
                item.id
            }')" aria-label="${
                item.isExpanded ? 'Collapse folder' : 'Expand folder'
            }"><span class="material-symbols-outlined">${icon}</span></button>`;
        }

        listItem.innerHTML = `
                <div class="subfolder-row" style="padding-left: ${indentPx + 10}px;">
                        <div class="main-item-cover-wrapper">
                                ${coverHTML}
                                <button class="left-panel-cover-play-btn${
                                    isPlaying && !isPaused ? ' is-pause' : ''
                                }" data-view="${item.viewId}" onmousedown="event.stopPropagation()" aria-label="${
            isPlaying && !isPaused ? 'Pause' : 'Play'
        }"></button>
                        </div>
                        <div class="main-item-info">
                                <span class="main-item-title">${escapeHtml(item.title)}</span>
                                <span class="main-item-subtitle">
                                        ${subtitleParts.join('')}
                                </span>
                        </div>
                        <span class="left-panel-playing-icon"><span class="material-symbols-outlined">volume_up</span></span>
                        ${chevronHTML}
                </div>
        `;

        leftPanelMainList.appendChild(listItem);
    });

    updateScrollbarById('left-panel-main-content');
}

function renderPlaylistDetailView(playlistId) {
    const playlists = getPlaylists();
    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
    if (!playlist) {
        switchView('playlists');
        return;
    }

    const playlistSongs = playlist.songs.map((songId) => SONGS_DATA.find((s) => s.id === songId)).filter((s) => s);
    const listId = `playlist-${playlistId}`;

    showHeroSection(true);
    updateHeroSection(playlist.name, playlistSongs.length, 'Playlist', playlist.id);
    showTracklistHeader(true);
    updateHeroCover(`playlist-${playlistId}`);

    if (!ghostLists[listId]) {
        ghostLists[listId] = [];
    }

    ghostLists[listId] = [];
    for (let i = 0; i < playlistSongs.length; i++) {
        ghostLists[listId].push(`Playlist${playlistId}-${String(i + 1).padStart(5, '0')}`);
    }

    if (playlistSongs.length === 0) {
        showTracklistHeader(false);
        document.getElementById('song-list').innerHTML = `
                <div class="empty-state-container">
                        <i class="fas fa-music"></i>
                        <span>No songs in this playlist</span>
                        <small>Right-click on any song and select "Add to playlist"</small>
                </div>
        `;
        return;
    }

    showTracklistHeader(true);

    renderSongsList(playlistSongs, listId);

    setTimeout(() => {
        document.querySelectorAll('.remove-from-playlist-btn').forEach((btn) => {
            const parentItem = btn.closest('.song-item');
            if (parentItem) {
                parentItem.addEventListener('mouseenter', () => {
                    btn.style.opacity = '1';
                });
                parentItem.addEventListener('mouseleave', () => {
                    btn.style.opacity = '0';
                });
            }
        });
        applyStoredHighlight(listId);
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 100);
}

// ==============================================================================
// UI RENDER - ALBUMS
// ==============================================================================
function renderAlbumsView() {
    const albums = getAlbums();
    const songListElement = document.getElementById('song-list');

    showHeroSection(true);
    updateHeroSection('Albums', albums.length, 'Collection');
    showTracklistHeader(false);
    updateHeroCover('albums');

    if (albums.length === 0) {
        songListElement.innerHTML = `
                <div class="empty-state-container">
                        <i class="fas fa-compact-disc"></i>
                        <span>No albums found</span>
                        <small>Songs with album metadata will appear here</small>
                </div>`;
        return;
    }

    const pinnedIds = getPinnedItems();
    const playedOrder = getPlayedItemOrder();
    const sortedAlbums = [...albums].sort((a, b) => {
        const aPinned = pinnedIds.includes(a.id);
        const bPinned = pinnedIds.includes(b.id);

        if (aPinned && bPinned) {
            return pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id);
        }
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        const aPlayed = playedOrder.indexOf(a.id);
        const bPlayed = playedOrder.indexOf(b.id);
        if (aPlayed !== -1 && bPlayed !== -1) return aPlayed - bPlayed;
        if (aPlayed !== -1) return -1;
        if (bPlayed !== -1) return 1;
        return 0;
    });

    const albumsHtml = sortedAlbums
        .map((album, index) => {
            const coverSrc = album.cover || PLACEHOLDER_IMAGE;
            return `
        <div class="song-item" 
             onclick="openAlbum('${album.id}')"
             oncontextmenu="event.preventDefault(); showAlbumContextMenu(event, '${album.id}')"
             tabindex="0"
             onkeydown="if(event.key === 'Enter') openAlbum('${album.id}')"
             data-album-id="${album.id}">
                <div class="left-song-item">
                        <div class="song-number">${index + 1}</div>
                        <img class="song-cover" 
                             src="${coverSrc}" 
                             alt="Cover for ${album.name}"
                             onerror="this.src=PLACEHOLDER_IMAGE">
                        <div class="song-info">
                                <div class="song-title">${escapeHtml(album.name)}</div>
                                <div class="song-artist">${album.songCount} ${
                album.songCount === 1 ? 'song' : 'songs'
            }</div>
                        </div>
                </div>
                <div class="song-album"></div>
                <div class="right-song-item">
                        <div class="song-duration"></div>
                        <div class="more-info" onclick="event.stopPropagation(); showAlbumContextMenu(event, '${
                            album.id
                        }')" title="More options">
                                <span class="material-symbols-outlined">more_horiz</span>
                        </div>
                </div>
        </div>`;
        })
        .join('');

    songListElement.innerHTML = albumsHtml;
}

function renderAlbumDetailView(albumId) {
    const albums = getAlbums();
    const album = albums.find((a) => a.id === albumId);
    if (!album) {
        switchView('albums');
        return;
    }

    const albumSongs = getAlbumSongs(albumId);
    const listId = albumId;

    showHeroSection(true);
    const shortId = album.id.substring(1, 11).toUpperCase();
    updateHeroSection(album.name, albumSongs.length, 'Album', shortId);
    showTracklistHeader(true);
    updateHeroCover(albumId);

    if (!ghostLists[listId]) {
        ghostLists[listId] = [];
    }

    initGhostSlots(listId, albumSongs, `Album-${albumId}`);

    if (albumSongs.length === 0) {
        showTracklistHeader(false);
        document.getElementById('song-list').innerHTML = `
                <div class="empty-state-container">
                        <i class="fas fa-music"></i>
                        <span>No songs in this album</span>
                </div>`;
        return;
    }

    showTracklistHeader(true);

    renderSongsList(albumSongs, listId);

    setTimeout(() => {
        applyStoredHighlight(listId);
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 50);
}

function renderAlbumLeftPanelItems() {
    const albums = getAlbums();
    const leftPanelMainList = document.querySelector('.left-panel-main-list');

    const existingAlbumItems = leftPanelMainList.querySelectorAll('.album-child-item');
    existingAlbumItems.forEach((item) => item.remove());

    if (albums.length === 0) return;

    const pinnedIds = getPinnedItems();
    const playedOrder = getPlayedItemOrder();
    const sortedAlbums = [...albums].sort((a, b) => {
        const aPinned = pinnedIds.includes(a.id);
        const bPinned = pinnedIds.includes(b.id);

        if (aPinned && bPinned) return pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        const aPlayed = playedOrder.indexOf(a.id);
        const bPlayed = playedOrder.indexOf(b.id);
        if (aPlayed !== -1 && bPlayed !== -1) return aPlayed - bPlayed;
        if (aPlayed !== -1) return -1;
        if (bPlayed !== -1) return 1;
        return 0;
    });

    sortedAlbums.forEach((album) => {
        const albumItem = document.createElement('li');
        albumItem.className = 'left-panel-main-item album-child-item';
        albumItem.setAttribute('onclick', `openAlbum('${album.id}')`);
        albumItem.setAttribute('oncontextmenu', `showAlbumContextMenu(event, '${album.id}'); return false;`);
        albumItem.setAttribute('data-view', album.id);
        albumItem.setAttribute('data-pin-id', album.id);
        albumItem.setAttribute('tabindex', '0');

        const coverContent = album.cover
            ? `<img class="main-item-cover-img album-cover-img" src="${album.cover}" alt="">`
            : `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                    <rect width="400" height="400" rx="8" fill="#1a1a1a"/>
                    <circle cx="200" cy="200" r="115" fill="none" stroke="#fff" stroke-width="8"/>
                    <circle cx="200" cy="200" r="30" fill="#fff"/>
                    <circle cx="200" cy="200" r="10" fill="#1a1a1a"/>
               </svg>`;

        albumItem.innerHTML = `
                <div class="subfolder-row">
                        <div class="main-item-cover-wrapper">
                                ${coverContent}
                                <button class="left-panel-cover-play-btn" data-view="${
                                    album.id
                                }" onmousedown="event.stopPropagation()" aria-label="Play"></button>
                        </div>
                        <div class="main-item-info">
                                <span class="main-item-title">${escapeHtml(album.name)}</span>
                                <span class="main-item-subtitle">
                                        <span>Album</span>
                                        <span class="main-item-dot">•</span>
                                        <span class="main-item-count">${album.songCount} ${
            album.songCount === 1 ? 'song' : 'songs'
        }</span>
                                </span>
                        </div>
                        <span class="left-panel-playing-icon"><span class="material-symbols-outlined">volume_up</span></span>
                </div>
        `;

        leftPanelMainList.appendChild(albumItem);
    });

    renderLeftPanelMainList();
    updateScrollbarById('left-panel-main-content');
}

// ==============================================================================
// UI RENDER - ARTISTS
// ==============================================================================
function renderArtistDetailView(artistId) {
    const artists = getArtists();
    const artist = artists.find((a) => a.id === artistId);
    if (!artist) {
        switchView('artists');
        return;
    }

    const artistSongs = getArtistSongs(artistId);
    const listId = artistId;

    showHeroSection(true);
    const shortId = artist.id.substring(1, 11).toUpperCase();
    updateHeroSection(artist.name, artistSongs.length, 'Artist', shortId);
    showTracklistHeader(true);
    updateHeroCover(artistId);

    if (!ghostLists[listId]) {
        ghostLists[listId] = [];
    }

    initGhostSlots(listId, artistSongs, `Artist-${artistId}`);

    if (artistSongs.length === 0) {
        showTracklistHeader(false);
        document.getElementById('song-list').innerHTML = `
                <div class="empty-state-container">
                        <i class="fas fa-music"></i>
                        <span>No songs by this artist</span>
                </div>`;
        return;
    }

    showTracklistHeader(true);

    renderSongsList(artistSongs, listId);

    setTimeout(() => {
        applyStoredHighlight(listId);
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 50);
}

function renderArtistLeftPanelItems() {
    const artists = getArtists();
    const leftPanelMainList = document.querySelector('.left-panel-main-list');

    const existingArtistItems = leftPanelMainList.querySelectorAll('.artist-child-item');
    existingArtistItems.forEach((item) => item.remove());

    if (artists.length === 0) return;

    const pinnedIds = getPinnedItems();
    const playedOrder = getPlayedItemOrder();
    const sortedArtists = [...artists].sort((a, b) => {
        const aPinned = pinnedIds.includes(a.id);
        const bPinned = pinnedIds.includes(b.id);

        if (aPinned && bPinned) return pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        const aPlayed = playedOrder.indexOf(a.id);
        const bPlayed = playedOrder.indexOf(b.id);
        if (aPlayed !== -1 && bPlayed !== -1) return aPlayed - bPlayed;
        if (aPlayed !== -1) return -1;
        if (bPlayed !== -1) return 1;
        return 0;
    });

    sortedArtists.forEach((artist) => {
        const artistItem = document.createElement('li');
        artistItem.className = 'left-panel-main-item artist-child-item';
        artistItem.setAttribute('onclick', `openArtist('${artist.id}')`);
        artistItem.setAttribute('oncontextmenu', `showArtistContextMenu(event, '${artist.id}'); return false;`);
        artistItem.setAttribute('data-view', artist.id);
        artistItem.setAttribute('data-pin-id', artist.id);
        artistItem.setAttribute('tabindex', '0');

        const coverContent = artist.cover
            ? `<img class="main-item-cover-img artist-cover-img" src="${artist.cover}" alt="">`
            : `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                    <rect width="400" height="400" rx="200" fill="#2a2a2a"/>
                    <circle cx="200" cy="155" r="70" fill="var(--accent)"/>
                    <ellipse cx="200" cy="320" rx="110" ry="45" fill="var(--accent)"/>
               </svg>`;

        artistItem.innerHTML = `
                <div class="subfolder-row">
                        <div class="main-item-cover-wrapper">
                                ${coverContent}
                                <button class="left-panel-cover-play-btn" data-view="${
                                    artist.id
                                }" onmousedown="event.stopPropagation()" aria-label="Play"></button>
                        </div>
                        <div class="main-item-info">
                                <span class="main-item-title">${escapeHtml(artist.name)}</span>
                                <span class="main-item-subtitle">
                                        <span>Artist</span>
                                        <span class="main-item-dot">•</span>
                                        <span class="main-item-count">${artist.songCount} ${
            artist.songCount === 1 ? 'song' : 'songs'
        }</span>
                                </span>
                        </div>
                        <span class="left-panel-playing-icon"><span class="material-symbols-outlined">volume_up</span></span>
                </div>
        `;

        leftPanelMainList.appendChild(artistItem);
    });

    renderLeftPanelMainList();
    updateScrollbarById('left-panel-main-content');
}

// ==============================================================================
// UI RENDER - FAVORITES & HISTORY
// ==============================================================================
function renderFavoritesView() {
    updateHeroCover('favorites');
    const favorites = getFavorites();
    const favoriteSongs = filterDeletedSongs(favorites.map((id) => SONGS_DATA.find((song) => song.id === id)));
    const listId = 'favorites';
    const songListElement = document.getElementById('song-list');

    if (favoriteSongs.length === 0) {
        if (typeof teardownLazyLoading === 'function') {
            teardownLazyLoading();
        }
        songListElement.innerHTML = `
                <div class="empty-state-container">
                        <i class="fas fa-heart"></i>
                        <span>No favorite songs</span>
                        <small>Click the heart icon on any song to add it here</small>
                </div>
        `;
        clearGhostList(listId);
        return;
    }

    renderSongsList(favoriteSongs, listId);

    setTimeout(() => {
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 100);
}

function renderHistoryView() {
    updateHeroCover('history');
    const history = getPlayHistory().filter((entry) => !deletedSongIds.has(entry.id));
    const songList = document.getElementById('song-list');
    const listId = 'history';

    showHeroSection(true);
    showHeroClearButton(false);
    updateHeroSection('Recents', history.length, 'Playlist', 'History');

    if (history.length === 0) {
        if (typeof teardownLazyLoading === 'function') {
            teardownLazyLoading();
        }
        songList.innerHTML = `
                <div class="history-empty">
                        <i class="fas fa-history"></i>
                        <span>No play history</span>
                        <small>Play some songs to see them here</small>
                </div>
        `;
        clearGhostList(listId);
        return;
    }

    ghostLists[listId] = [];
    for (let i = 0; i < history.length; i++) {
        const ghostSlotId = history[i].ghostSlotId || `History${String(i + 1).padStart(5, '0')}`;
        ghostLists[listId].push(ghostSlotId);
    }

    const songsHtml = history
        .map((entry, index) => {
            const slotIndex = index;
            const isCurrentlyPlaying =
                currentQueueIndex >= 0 &&
                playbackQueue[currentQueueIndex] &&
                playbackQueue[currentQueueIndex].id === entry.id;
            const shouldHighlight = isCurrentlyPlaying && activeSlotHighlights[listId] === slotIndex;
            const ghostSlotValue =
                entry.ghostSlotId || getHistoryGhostSlotId(slotIndex) || `History${String(index + 1).padStart(5, '0')}`;

            return buildSongItemHTML({
                song: {
                    id: entry.id,
                    title: entry.title,
                    artist: entry.artist,
                    cover: entry.cover,
                    duration: entry.duration || '—',
                    album: entry.album || '',
                    largeCover: entry.cover || ''
                },
                index: index,
                highlight: shouldHighlight,
                listId: listId,
                ghostSlotValue: `${listId}-${ghostSlotValue}`,
                onClick: `playSongFromHistory(${entry.id})`,
                onContextMenu: `event.preventDefault(); showContextMenu(event, ${entry.id})`,
                showExtraButtons: false
            });
        })
        .join('');

    songList.innerHTML = songsHtml;

    applyHistoryStoredHighlight(listId);
}

function renderRecentlyPlayed() {
    const recentSongs = filterDeletedSongs(getRecentlyPlayed());
    const listId = 'recent';

    if (recentSongs.length === 0) {
        document.getElementById('song-list').innerHTML = `
            <div class="empty-state-container">
                <i class="fas fa-history"></i>
                <span>No recently played songs</span>
                <small>Play some songs to see them here</small>
            </div>
        `;
        clearGhostList(listId);
        return;
    }

    rebuildGhostListFromMain(listId, recentSongs);

    const songsHtml = recentSongs
        .map((song, index) => {
            return createSongItemHTML(song, index, listId);
        })
        .join('');

    document.getElementById('song-list').innerHTML = `
        <div class="recently-played-header">
            <div class="recently-played-title-row">
                <div class="recently-played-title">
                    <i class="fas fa-history"></i>
                    <span>Recently Played</span>
                </div>
                <button onclick="clearRecentlyPlayed()" class="clear-recent-btn" aria-label="Clear recently played list">
                    <i class="fas fa-trash-alt"></i>
                    Clear List
                </button>
            </div>
            <div class="recently-played-info">
                <i class="fas fa-info-circle"></i>
                Shows last ${MAX_RECENT_SONGS} songs in play order
            </div>
        </div>
        ${songsHtml}
    `;

    applyStoredHighlight(listId);
}

function renderPortableRecentlyPlayed() {
    const recentSongs = filterDeletedSongs(getRecentlyPlayed());
    const recentList = document.getElementById('recently-played-list');

    if (!recentList) return;

    if (recentSongs.length === 0) {
        recentList.innerHTML = `
                <div class="empty-queue">
                        <i class="fas fa-history"></i>
                        <p>No recently played songs</p>
                        <small>Play songs for at least 5 seconds to see them here</small>
                </div>`;
        return;
    }

    const maxDisplay = 50;
    const displaySongs = recentSongs.slice(0, maxDisplay);

    let recentHTML = '';
    displaySongs.forEach((song) => {
        recentHTML += `
                ${renderRightPanelItem(song, {
                    title: escapeHtml(song.title),
                    artist: escapeHtml(song.artist),
                    onClick: `playSongFromList(${song.id}, 'history')`
                })}`;
    });

    if (recentSongs.length > maxDisplay) {
        recentHTML += `
                <div class="empty-queue" style="padding: 15px; margin-top: 10px;">
                        <i class="fas fa-ellipsis-h"></i>
                        <p>${recentSongs.length - maxDisplay} more songs</p>
                </div>`;
    }

    recentList.innerHTML = recentHTML;
    updateScrollbarById('right-panel-content');
}

// ==============================================================================
// UI RENDER - SEARCH HISTORY
// ==============================================================================
function renderSearchHistoryView() {
    const searchHistory = getSearchHistory();
    const songList = document.getElementById('song-list');

    showHeroSection(false);
    showTracklistHeader(false);

    if (searchHistory.length === 0) {
        songList.innerHTML = `
                <div style="padding: 0 20px;">
                        <div class="search-history-header">
                                <div class="search-history-title-row">
                                        <div class="search-history-title">
                                                <i class="fas fa-search"></i>
                                                <span>Search History</span>
                                        </div>
                                        <button onclick="clearSearchHistory()" class="clear-history-btn">
                                                <i class="fas fa-trash-alt"></i>
                                                Clear List
                                        </button>
                                </div>
                        </div>
                        <div class="search-history-empty">
                                <i class="fas fa-search"></i>
                                <span>No search history</span>
                                <small>Search for songs to see them here</small>
                        </div>
                </div>
        `;
        return;
    }

    const historyHtml = searchHistory
        .map((entry, index) => {
            const date = new Date(entry.timestamp);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            let timeDisplay;
            if (date.toDateString() === today.toDateString()) {
                timeDisplay =
                    'Today ' +
                    date.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
            } else if (date.toDateString() === yesterday.toDateString()) {
                timeDisplay =
                    'Yesterday ' +
                    date.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
            } else {
                timeDisplay =
                    date.toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric'
                    }) +
                    ' ' +
                    date.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
            }

            return `
        <div class="song-item search-history-item" 
             onclick="openSearchHistoryChild('${entry.sessionId}', '${entry.query.replace(/'/g, "\\'")}')">
                <div class="left-song-item">
                        <div class="song-number">${index + 1}</div>
                        <div class="song-info">
                                <div class="song-title search-history-query">
                                        <i class="fas fa-search"></i>
                                        "${escapeHtml(entry.query)}"
                                </div>
                                <div class="song-artist search-history-meta">${
                                    entry.resultCount
                                } results • ${timeDisplay}</div>
                        </div>
                </div>
                <div class="song-album">${entry.resultCount} results</div>
                <div class="right-song-item">
                        <div class="song-duration">${timeDisplay.split(' ')[0]}</div>
                        <div class="more-info" onclick="event.stopPropagation(); deleteSearchHistoryEntry('${
                            entry.sessionId
                        }')">
                                <span class="material-symbols-outlined">delete</span>
                        </div>
                </div>
        </div>
        `;
        })
        .join('');

    songList.innerHTML = `
            <div style="padding: 0 20px;">
                    <div class="search-history-header">
                            <div class="search-history-title-row">
                                    <div class="search-history-title">
                                            <i class="fas fa-history"></i>
                                            <span>Search History</span>
                                    </div>
                                    <button onclick="clearSearchHistory()" class="clear-history-btn">
                                            <i class="fas fa-trash-alt"></i>
                                            Clear List
                                    </button>
                            </div>
                            <div class="search-history-info">
                                    <i class="fas fa-info-circle"></i>
                                    Last ${MAX_SEARCH_HISTORY} searches
                            </div>
                    </div>
                    ${historyHtml}
            </div>
    `;

    setTimeout(() => updateExternalScrollbar(), 100);
}

// ==============================================================================
// UI RENDER - LYRICS VIEW
// ==============================================================================
function renderLyricsView() {
    let container = document.getElementById('lyrics-view-root');
    const songListContainer = document.getElementById('song-list-container');
    const mainContentInner = document.querySelector('.main-content-inner');

    if (!container) {
        container = document.createElement('div');
        container.id = 'lyrics-view-root';
        container.className = 'lyrics-view-root';
        if (mainContentInner) {
            mainContentInner.appendChild(container);
        } else {
            return;
        }
    }

    if (songListContainer) songListContainer.style.display = 'none';
    container.style.display = 'block';

    let currentSong = null;
    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const queueItem = playbackQueue[currentQueueIndex];
        currentSong = queueItem.song || queueItem;
    }

    if (!currentSong) {
        container.innerHTML = `
            <div class="lyrics-view-container">
                <div class="lyrics-view-empty">
                    <i class="fas fa-align-left"></i>
                    <p>No song playing</p>
                    <small>Play a song to see its lyrics</small>
                </div>
            </div>
        `;
        setTimeout(() => {
            if (typeof updateExternalScrollbar === 'function') updateExternalScrollbar();
        }, 50);
        return;
    }

    const lyrics = getLyricsForSong(currentSong);
    const hasLyrics = lyrics && String(lyrics).trim() !== '';
    const isInstrumental = currentSong.instrumental === true;

    const hasSynced = typeof initSyncedLyrics === 'function' && initSyncedLyrics(currentSong);

    let lyricsBody = '';
    if (hasSynced) {
        const linesHTML = syncedLyricsState.entries
            .map((entry, i) => {
                if (entry.instrumental) {
                    return (
                        '<div class="lyrics-line lyrics-line-instrumental" data-sync-index="' +
                        i +
                        '"><span class="material-symbols-outlined">music_note</span></div>'
                    );
                }
                if (entry.text.trim() === '') {
                    return '<div class="lyrics-line lyrics-line-empty" data-sync-index="' + i + '"></div>';
                }
                return '<div class="lyrics-line" data-sync-index="' + i + '">' + escapeHtml(entry.text) + '</div>';
            })
            .join('');
        lyricsBody = `<div class="lyrics-view-text lyrics-view-synced">${linesHTML}</div>`;
    } else if (hasLyrics) {
        const normalizedLyrics = String(lyrics).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lyricsLines = normalizedLyrics.split('\n');
        const lyricsHTML = lyricsLines
            .map((line) => {
                if (line.trim() === '') {
                    return '<div class="lyrics-line lyrics-line-empty"></div>';
                }
                return `<div class="lyrics-line">${escapeHtml(line)}</div>`;
            })
            .join('');
        lyricsBody = `<div class="lyrics-view-text">${lyricsHTML}</div>`;
    } else if (isInstrumental) {
        lyricsBody = `<div class="lyrics-view-text">
                <div class="lyrics-line lyrics-line-instrumental-block" title="Verified by LRCLIB">
                    <span class="material-symbols-outlined">music_note</span>
                    <span>Instrumental</span>
                </div>
           </div>`;
    } else {
        lyricsBody = `<div class="lyrics-view-text">
                <div class="lyrics-line">No lyrics for this song</div>
           </div>`;
    }

    container.innerHTML = `
        <div class="lyrics-view-container">
            ${lyricsBody}
            <div class="lyrics-view-footer">
                <button class="lyrics-view-edit-btn" onclick="openLyricsEditor()" aria-label="Insert or edit lyrics">
                    <span class="material-symbols-outlined">edit</span>
                    <span>${hasLyrics ? 'Edit Lyrics' : 'Add Lyrics'}</span>
                </button>
                <button class="lyrics-view-edit-btn" onclick="openSyncEditor()" aria-label="Open sync editor">
                    <span class="material-symbols-outlined">graphic_eq</span>
                    <span>Sync</span>
                </button>
                <button class="lyrics-view-edit-btn" onclick="importLrcFile()" aria-label="Import LRC file">
                    <span class="material-symbols-outlined">upload_file</span>
                    <span>Import .lrc</span>
                </button>
                <button class="lyrics-view-edit-btn" onclick="openLrcPasteDialog()" aria-label="Paste LRC text">
                    <span class="material-symbols-outlined">content_paste</span>
                    <span>Paste LRC</span>
                </button>
                <button class="lyrics-view-edit-btn lyrics-online-btn" onclick="openOnlineLyricsView()" aria-label="Find lyrics or LRC online">
                    <span class="material-symbols-outlined">language</span>
                    <span>Find lyrics / LRC online</span>
                </button>
            </div>
            ${(() => {
                const entry =
                    typeof getSyncedLyricsVariantsForSong === 'function'
                        ? getSyncedLyricsVariantsForSong(currentSong)
                        : null;
                if (!entry || !entry.variants || entry.variants.length === 0) return '';
                const rows = entry.variants
                    .map((v) => {
                        const isActive = v.id === entry.activeId;
                        const created = new Date(v.createdAt || Date.now()).toLocaleDateString();
                        return `
                        <div class="synced-variant-row ${isActive ? 'active' : ''}" data-variant-id="${v.id}">
                            <span class="synced-variant-radio" onclick="selectSyncedVariant('${v.id}')">${
                            isActive ? '●' : '○'
                        }</span>
                            <span class="synced-variant-name" onclick="selectSyncedVariant('${v.id}')">${escapeHtml(
                            v.name
                        )}</span>
                            <span class="synced-variant-meta">${created}</span>
                            <button class="synced-variant-icon-btn" onclick="renameSyncedVariant('${
                                v.id
                            }')" title="Rename"><span class="material-symbols-outlined">edit</span></button>
                            <button class="synced-variant-icon-btn" onclick="deleteSyncedVariant('${
                                v.id
                            }')" title="Delete"><span class="material-symbols-outlined">delete</span></button>
                        </div>
                    `;
                    })
                    .join('');
                return `<div class="synced-variants-list">${rows}</div>`;
            })()}
        </div>
    `;

    if (hasSynced) {
        const wrappers = container.querySelectorAll('.lyrics-line');
        syncedLyricsState.lineElements = Array.from(wrappers);
        syncedLyricsState.container = document.querySelector('.content');
        syncedLyricsState.lineElements.forEach((el, i) => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => seekToSyncedLine(i));
        });
        attachSyncedLyricsScrollWatcher();
        updateSyncedLyricsHighlight(audioElement.currentTime || 0);
    } else {
        syncedLyricsState.entries = null;
        syncedLyricsState.lineElements = [];
        syncedLyricsState.activeIndex = -1;
        resetSyncedLyricsFollowState();
    }

    setTimeout(() => {
        if (typeof updateExternalScrollbar === 'function') updateExternalScrollbar();
    }, 50);
}

function teardownLyricsView() {
    const container = document.getElementById('lyrics-view-root');
    if (container) container.style.display = 'none';
    const lyricsToggleBtn = document.getElementById('lyrics-toggle-btn');
    if (lyricsToggleBtn) lyricsToggleBtn.classList.remove('active');
    if (typeof resetSyncedLyricsFollowState === 'function') {
        resetSyncedLyricsFollowState();
    }
}

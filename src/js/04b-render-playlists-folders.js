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
    const sortedPlaylists = sortByPinnedThenRecent(playlists, (p) => `playlist-${p.id}`, pinnedIds, playedOrder);

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
    const sortedFolders = sortByPinnedThenRecent(folders, (f) => `folder-${f.id}`, pinnedIds, playedOrder);

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

    const playlistSongs = playlist.songs.map((songId) => getSongById(songId)).filter((s) => s);
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
        if (typeof teardownLazyLoading === 'function') {
            teardownLazyLoading();
        }
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

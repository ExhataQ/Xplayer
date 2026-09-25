// ==============================================================================
// CONTEXT MENU STATE
// ==============================================================================
let activeContextMenu = null;
let activeContextMenuSlot = null;
let currentContextSongId = null;
let currentContextPlaylistId = null;
let contextMenuMouseDownOutside = false;

const CONTEXT_MENU_TYPE_LABELS = {
    playlist: 'Playlist',
    folder: 'Folder',
    album: 'Album',
    artist: 'Artist',
    special: 'Item'
};

// ==============================================================================
// CONTEXT MENU - BUILD
// ==============================================================================
function buildFolderSubmenuHTML(itemId, itemType, mode) {
    const folders = getFolders();
    const currentFolderId = currentOpenFolderId;
    if (folders.length === 0) {
        return '<div class="context-menu-item" style="cursor: default;"><span>No folders</span></div>';
    }
    const action = mode === 'add' ? 'addToFolderFromMenu' : 'moveToFolderFromMenu';
    return folders
        .map((f) => {
            if (mode === 'add' && currentFolderId === f.id) return '';
            if (itemType === 'folder' && f.id === itemId) return '';
            const hasIt = f.children.some((c) => c.id === itemId && c.type === itemType);
            const check = hasIt ? '<i class="fas fa-check"></i>' : '<i class="far fa-folder"></i>';
            return `
            <div class="context-menu-item" onclick="event.stopPropagation(); ${action}('${
                f.id
            }', '${itemId}', '${itemType}'); closeContextMenu();">
                ${check}
                <span>${escapeHtml(f.name)}</span>
            </div>
        `;
        })
        .join('');
}

function addToFolderFromMenu(folderId, itemId, itemType) {
    const added = addToFolder(folderId, itemId, itemType, true);
    if (added) {
        const folder = getFolders().find((f) => f.id === folderId);
        showNotification(
            `Added ${CONTEXT_MENU_TYPE_LABELS[itemType] || 'Item'} shortcut to "${folder ? folder.name : 'folder'}"`,
            'success',
            2000
        );
        renderFoldersView();
        renderLeftPanelMainList();
        updateScrollbarById('left-panel-main-content');
        if (currentOpenFolderId) renderFolderContents(currentOpenFolderId);
    } else {
        showNotification('Already in folder', 'warning', 2000);
    }
}

function moveToFolderFromMenu(folderId, itemId, itemType) {
    const added = addToFolder(folderId, itemId, itemType, false);
    if (added) {
        const folder = getFolders().find((f) => f.id === folderId);
        showNotification(
            `Moved ${CONTEXT_MENU_TYPE_LABELS[itemType] || 'Item'} to "${folder ? folder.name : 'folder'}"`,
            'success',
            2000
        );
        renderFoldersView();
        renderLeftPanelMainList();
        updateScrollbarById('left-panel-main-content');
        if (currentOpenFolderId) renderFolderContents(currentOpenFolderId);
    } else {
        showNotification('Item already in that folder', 'warning', 2000);
    }
}

function removeFromFolderFromMenu(folderId, itemId, itemType) {
    const state = getItemFolderState(folderId, itemId, itemType);
    if (!state) {
        showNotification('Item is not in this folder', 'warning', 2000);
        return;
    }

    const label = CONTEXT_MENU_TYPE_LABELS[itemType] || 'Item';

    const removed = removeItemFromFolder(folderId, itemId, itemType);
    if (!removed) {
        showNotification('Failed to remove from folder', 'error', 2000);
        return;
    }

    if (state.shortcut) {
        showNotification(`Removed ${label} shortcut from folder`, 'info', 2000);
    } else {
        showNotification(`Moved ${label} back to library root`, 'info', 2000);
    }

    renderFoldersView();
    renderLeftPanelMainList();
    updateScrollbarById('left-panel-main-content');
    if (currentOpenFolderId === folderId) {
        renderFolderContents(folderId);
    } else if (currentOpenFolderId) {
        renderFolderContents(currentOpenFolderId);
    }
}

function buildContextMenu(songId, options = {}) {
    const {
        showAddToPlaylist = true,
        showRemoveFromCurrentPlaylist = false,
        currentPlaylistId = null,
        currentPlaylistName = null,
        showFavorite = true,
        showAddToQueue = true,
        showFileActions = true,
        showDeleteFromHistory = false
    } = options;

    const relevantIds =
        typeof selectedSongIds !== 'undefined' && selectedSongIds.size > 1 && selectedSongIds.has(songId)
            ? [...selectedSongIds]
            : [songId];
    const isFav = relevantIds.every((id) => isFavorite(id));
    const favoriteIcon = isFav ? 'fas fa-heart liked' : 'fas fa-heart unliked';
    const favoriteText = isFav ? 'Remove from favorites' : 'Add to favorites';

    let menuHTML = '';

    if (showAddToPlaylist) {
        menuHTML += `
        <div class="context-menu-item submenu-parent" style="position: relative;">
                <i class="fas fa-plus"></i>
                <span>Add to playlist</span>
                <i class="fas fa-chevron-right"></i>
                <div class="context-submenu">
                        ${(() => {
                            const playlists = getPlaylists();
                            if (playlists.length === 0) {
                                return '<div class="context-menu-item" style="cursor: default;"><span>No playlists</span></div>';
                            }
                            const pinnedIds = getPinnedItems();
                            const playedOrder = getPlayedItemOrder();
                            const sortedPlaylists = sortByPinnedThenRecent(
                                playlists,
                                (p) => `playlist-${p.id}`,
                                pinnedIds,
                                playedOrder
                            );
                            return sortedPlaylists
                                .map((p) => {
                                    if (showRemoveFromCurrentPlaylist && p.id === currentPlaylistId) {
                                        return `<div class="context-menu-item" onclick="event.stopPropagation(); removeSongFromPlaylistAndRefresh(${songId}, '${currentPlaylistId}'); closeContextMenu();">
                                            <i class="fas fa-trash-alt"></i>
                                            <span>${escapeHtml(p.name)} (remove)</span>
                                        </div>`;
                                    } else {
                                        const isInPlaylist = p.songs.includes(songId);
                                        return `<div class="context-menu-item" onclick="event.stopPropagation(); addToPlaylistFromMenu(${songId}, '${p.id}'); closeContextMenu();">
                                            <i class="${isInPlaylist ? 'fas fa-check' : 'far fa-plus-square'}"></i>
                                            <span>${escapeHtml(p.name)}${isInPlaylist ? ' (added)' : ''}</span>
                                        </div>`;
                                    }
                                })
                                .join('');
                        })()}
                </div>
        </div>
        `;
    }

    if (showRemoveFromCurrentPlaylist && currentPlaylistName) {
        menuHTML += `
        <div class="context-menu-item" onclick="removeSongFromPlaylistAndRefresh(${songId}, '${currentPlaylistId}'); closeContextMenu();">
                <i class="fas fa-trash-alt"></i>
                <span>Remove from "${escapeHtml(currentPlaylistName)}"</span>
        </div>
        `;
    }

    if (showFavorite) {
        menuHTML += `
        <div class="context-menu-item" onclick="toggleFavoriteFromMenu(); closeContextMenu();">
                <i class="${favoriteIcon}"></i>
                <span>${favoriteText}</span>
        </div>
        `;
    }

    if (showAddToQueue) {
        menuHTML += `
        <div class="context-menu-item" onclick="addToQueueNextFromMenu(); closeContextMenu();">
                <i class="fas fa-list"></i>
                <span>Add to queue</span>
        </div>
        `;
    }

    if (songId !== null && songId !== undefined) {
        const ctxSong = SONGS_DATA.find((s) => s.id === songId);
        const hasLyrics =
            ctxSong && typeof getLyricsForSong === 'function' && String(getLyricsForSong(ctxSong) || '').trim() !== '';
        menuHTML += `
        <div class="context-menu-item" onclick="openLyricsEditorForSong(${songId}); closeContextMenu();">
                <i class="fas fa-align-left"></i>
                <span>${hasLyrics ? 'Edit lyrics' : 'Add lyrics'}</span>
        </div>
        <div class="context-menu-item" onclick="showSongMetadataModal(${songId}); closeContextMenu();">
                <i class="fas fa-info-circle"></i>
                <span>Show metadata</span>
        </div>
        `;
    }

    if (options.queueIndex !== undefined) {
        menuHTML += `
        <div class="context-menu-item" onclick="removeFromQueue(${options.queueIndex}); closeContextMenu();">
                <i class="fas fa-times"></i>
                <span>Remove from queue</span>
        </div>
        `;
    }

    if (showFileActions) {
        menuHTML += `
        <div class="context-menu-item context-menu-separator" onclick="showFileLocation(); closeContextMenu();">
                <i class="fas fa-folder-open"></i>
                <span>Show file location</span>
        </div>
        <div class="context-menu-item" onclick="deleteSongFile(); closeContextMenu();">
                <i class="fas fa-trash-alt"></i>
                <span>Delete from computer</span>
        </div>
        `;
    }

    if (options.showPlayedData && songId) {
        menuHTML += `
        <div class="context-menu-separator" style="border-top: 1px solid var(--border); margin: 4px 0; padding-top: 0;"></div>
        <div class="context-menu-item" onclick="showPlayedDataModal(${songId}); closeContextMenu();">
                <i class="fas fa-chart-bar"></i>
                <span>View play history</span>
        </div>
        `;
    }

    if (showDeleteFromHistory) {
        menuHTML += `
        <div class="context-menu-item" onclick="deleteHistoryEntry(); closeContextMenu();">
                <i class="fas fa-trash-alt"></i>
                <span>Delete from history</span>
        </div>
        `;
    }

    return menuHTML;
}

// ==============================================================================
// CONTEXT MENU - SHOW / CLOSE
// ==============================================================================
function showContextMenu(event, songId, options = {}) {
    event.stopPropagation();
    event.preventDefault();

    const clickedMoreInfo = event.target.closest('.more-info');
    if (clickedMoreInfo) {
        temporarilySuppressTooltip(clickedMoreInfo);
    }

    if (activeContextMenu && currentContextSongId === songId) {
        closeContextMenu();
        return;
    }

    closeContextMenu();

    currentContextSongId = songId;
    const songElement = event.target.closest('.song-item');
    if (songElement) {
        const ghostSlotAttr = songElement.getAttribute('data-ghost-slot');
        if (ghostSlotAttr) {
            if (currentView === 'history') {
                const history = getPlayHistory();
                const parts = ghostSlotAttr.split('-');
                const slotId = parts[parts.length - 1];
                activeContextMenuSlot = history.findIndex((entry) => entry.ghostSlotId === slotId);
            } else {
                const parts = ghostSlotAttr.split('-');
                activeContextMenuSlot = parseInt(parts[parts.length - 1]);
            }
        }
    }

    const menuOptions = {
        showAddToPlaylist: true,
        showRemoveFromCurrentPlaylist: options.showRemoveFromCurrentPlaylist || false,
        currentPlaylistId: options.currentPlaylistId || null,
        currentPlaylistName: options.currentPlaylistName || null,
        showFavorite: true,
        showAddToQueue: true,
        showFileActions: true,
        showDeleteFromHistory: currentView === 'history',
        showPlayedData: currentView === 'history',
        queueIndex: options.queueIndex
    };

    const menuHTML = buildContextMenu(songId, menuOptions);

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.id = 'context-menu';
    menu.style.display = 'block';
    menu.style.visibility = 'hidden';
    menu.innerHTML = menuHTML;

    document.body.appendChild(menu);

    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let posX = event.clientX;
    let posY = event.clientY + 5;

    const spaceToRight = windowWidth - event.clientX;
    if (spaceToRight < menuWidth) {
        posX = event.clientX - menuWidth - 7;
    }
    if (posX < 7) {
        posX = 7;
    }

    const spaceToBottom = windowHeight - event.clientY;
    if (spaceToBottom < menuHeight) {
        posY = event.clientY - menuHeight - 7;
    }
    if (posY < 7) {
        posY = 7;
    }

    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';
    menu.style.visibility = 'visible';

    setTimeout(() => {
        menu.classList.add('active');
    }, 10);

    activeContextMenu = menu;
    menu._originalX = event.clientX;
    menu._originalY = event.clientY;
    menu._flippedX = spaceToRight < menuWidth;
    menu._flippedY = spaceToBottom < menuHeight;

    setTimeout(() => {
        positionSubmenus(menu);
    }, 10);
}

function closeContextMenu() {
    if (activeContextMenu) {
        activeContextMenu.remove();
        activeContextMenu = null;
        currentContextSongId = null;
        currentContextPlaylistId = null;
    }
    contextMenuMouseDownOutside = false;
}

// ==============================================================================
// CONTEXT MENU - SUBMENU POSITIONING
// ==============================================================================
function positionSubmenus(menu) {
    const submenus = menu.querySelectorAll('.context-submenu');
    submenus.forEach((submenu) => {
        const parentItem = submenu.closest('.context-menu-item');
        if (!parentItem) return;

        submenu.classList.remove('right-aligned', 'bottom-aligned', 'bottom-right-aligned');

        submenu.style.visibility = 'hidden';
        submenu.style.display = 'block';

        const submenuRect = submenu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const needsRightAlign = submenuRect.right > windowWidth;
        const needsBottomAlign = submenuRect.bottom > windowHeight;

        submenu.style.display = '';
        submenu.style.visibility = '';

        if (needsRightAlign && needsBottomAlign) {
            submenu.classList.add('bottom-right-aligned');
        } else if (needsRightAlign) {
            submenu.classList.add('right-aligned');
        } else if (needsBottomAlign) {
            submenu.classList.add('bottom-aligned');
        }
    });
}

// ==============================================================================
// CONTEXT MENU - SPECIALIZED SHOW FUNCTIONS
// ==============================================================================
function getContainingFolderIdFromEvent(event) {
    if (currentOpenFolderId) return currentOpenFolderId;
    if (!event || !event.target) return null;
    const item = event.target.closest('.left-panel-main-item');
    if (!item) return null;
    const parent = item.getAttribute('data-parent-folder');
    if (parent && parent !== 'root') return parent;
    return null;
}

function showLeftPanelItemContextMenu(event, itemId, itemName, itemType) {
    event.stopPropagation();
    event.preventDefault();

    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.id = 'context-menu';
    menu.style.display = 'block';
    menu.style.visibility = 'hidden';

    const containingFolderId = getContainingFolderIdFromEvent(event);
    const insideFolder = !!containingFolderId;
    const isPinned = insideFolder ? isItemPinnedInFolder(containingFolderId, itemId) : isItemPinned(itemId);
    const pinLabel = insideFolder
        ? isPinned
            ? 'Unpin inside this folder'
            : 'Pin inside this folder'
        : isPinned
        ? 'Unpin from top'
        : 'Pin to top';
    const pinAction = insideFolder
        ? `togglePinItemInFolder('${containingFolderId}', '${itemId}', '${itemName.replace(/'/g, "\\'")}')`
        : `togglePinItem('${itemId}', '${itemName.replace(/'/g, "\\'")}')`;

    let menuHTML = '';

    if (itemType === 'playlist' || itemType === 'folder') {
        const rawId = itemType === 'playlist' ? itemId.replace('playlist-', '') : itemId.replace('folder-', '');
        menuHTML += `
        <div class="context-menu-item submenu-parent" style="position: relative;">
                <i class="fas fa-folder-minus"></i>
                <span>Move to folder</span>
                <i class="fas fa-chevron-right"></i>
                <div class="context-submenu">
                        ${buildFolderSubmenuHTML(rawId, itemType, 'move')}
                </div>
        </div>
        `;
    }

    {
        let rawId = itemId;
        if (itemType === 'playlist') rawId = itemId.replace('playlist-', '');
        else if (itemType === 'folder') rawId = itemId.replace('folder-', '');
        menuHTML += `
        <div class="context-menu-item submenu-parent" style="position: relative;">
                <i class="fas fa-share"></i>
                <span>Add shortcut to...</span>
                <i class="fas fa-chevron-right"></i>
                <div class="context-submenu">
                        ${buildFolderSubmenuHTML(rawId, itemType, 'add')}
                </div>
        </div>
        `;
    }

    if (currentOpenFolderId) {
        let rawId = itemId;
        if (itemType === 'playlist') rawId = itemId.replace('playlist-', '');
        else if (itemType === 'folder') rawId = itemId.replace('folder-', '');

        const state = getItemFolderState(currentOpenFolderId, rawId, itemType);
        if (state) {
            const removeLabel = state.shortcut ? 'Remove shortcut from folder' : 'Remove from folder';
            menuHTML += `
                <div class="context-menu-item" onclick="removeFromFolderFromMenu('${currentOpenFolderId}', '${rawId}', '${itemType}'); closeContextMenu();">
                        <i class="fas fa-times"></i>
                        <span>${removeLabel}</span>
                </div>
            `;
        }
    }

    menuHTML += `
        <div class="context-menu-item" onclick="${pinAction}; closeContextMenu();">
                <i class="fas fa-thumbtack"></i>
                <span>${pinLabel}</span>
        </div>
    `;

    if (itemType === 'artist') {
        const artistId = itemId;
        menuHTML =
            `
                <div class="context-menu-item" onclick="closeContextMenu(); openArtist('${artistId}'); setTimeout(() => playCurrentViewFromStart(), 100);">
                        <i class="fas fa-play"></i>
                        <span>Play</span>
                </div>
                <div class="context-menu-item" onclick="addArtistToQueue('${artistId}'); closeContextMenu();">
                        <i class="fas fa-list"></i>
                        <span>Add to queue</span>
                </div>
        ` + menuHTML;
    }

    if (itemType === 'album') {
        const albumId = itemId;
        menuHTML =
            `
                <div class="context-menu-item" onclick="closeContextMenu(); openAlbum('${albumId}'); setTimeout(() => playCurrentViewFromStart(), 100);">
                        <i class="fas fa-play"></i>
                        <span>Play</span>
                </div>
                <div class="context-menu-item" onclick="addAlbumToQueue('${albumId}'); closeContextMenu();">
                        <i class="fas fa-list"></i>
                        <span>Add to queue</span>
                </div>
        ` + menuHTML;
    }

    if (itemType === 'playlist') {
        const playlistId = itemId.replace('playlist-', '');
        menuHTML =
            `
                <div class="context-menu-item" onclick="closeContextMenu(); openPlaylist('${playlistId}', () => playCurrentViewFromStart());">
                        <i class="fas fa-play"></i>
                        <span>Play</span>
                </div>
                <div class="context-menu-item" onclick="addPlaylistToQueue('${playlistId}'); closeContextMenu();">
                        <i class="fas fa-list"></i>
                        <span>Add to queue</span>
                </div>
        ` + menuHTML;
        menuHTML += `
                <div class="context-menu-item" onclick="showEditPlaylistDialog('${playlistId}'); closeContextMenu();">
                        <i class="fas fa-pen"></i>
                        <span>Edit details</span>
                </div>
                <div class="context-menu-item context-menu-separator" onclick="deletePlaylistAndClose('${playlistId}'); closeContextMenu();">
                        <i class="fas fa-trash-alt"></i>
                        <span>Delete playlist</span>
                </div>
        `;
    }

    if (itemType === 'special') {
        menuHTML =
            `
                <div class="context-menu-item" onclick="closeContextMenu(); switchView('${itemId}'); setTimeout(() => playCurrentViewFromStart(), 100);">
                        <i class="fas fa-play"></i>
                        <span>Play</span>
                </div>
        ` + menuHTML;
    }

    menu.innerHTML = menuHTML;

    document.body.appendChild(menu);

    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let posX = event.clientX;
    let posY = event.clientY + 5;

    const spaceToRight = windowWidth - event.clientX;
    if (spaceToRight < menuWidth) {
        posX = event.clientX - menuWidth - 7;
    }
    if (posX < 7) {
        posX = 7;
    }

    const spaceToBottom = windowHeight - event.clientY;
    if (spaceToBottom < menuHeight) {
        posY = event.clientY - menuHeight - 7;
    }
    if (posY < 7) {
        posY = 7;
    }

    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';
    menu.style.visibility = 'visible';

    setTimeout(() => {
        menu.classList.add('active');
    }, 10);

    activeContextMenu = menu;
    menu._originalX = event.clientX;
    menu._originalY = event.clientY;
    menu._flippedX = spaceToRight < menuWidth;
    menu._flippedY = spaceToBottom < menuHeight;
}

function showSpecialItemContextMenu(event, itemId, itemName) {
    showLeftPanelItemContextMenu(event, itemId, itemName, 'special');
}

function showPlaylistContextMenu(event, playlistId) {
    const playlists = getPlaylists();
    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
    const name = playlist ? playlist.name : 'Playlist';
    showLeftPanelItemContextMenu(event, `playlist-${playlistId}`, name, 'playlist');
}

function showFolderContextMenu(event, folderId) {
    const folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    const name = folder ? folder.name : 'Folder';

    event.stopPropagation();
    event.preventDefault();

    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.id = 'context-menu';
    menu.style.display = 'block';
    menu.style.visibility = 'hidden';

    const containingFolderId = getContainingFolderIdFromEvent(event);
    const insideFolder = !!containingFolderId && containingFolderId !== folderId;
    const isPinned = insideFolder
        ? isItemPinnedInFolder(containingFolderId, `folder-${folderId}`)
        : isItemPinned(`folder-${folderId}`);
    const pinLabel = insideFolder
        ? isPinned
            ? 'Unpin inside this folder'
            : 'Pin inside this folder'
        : isPinned
        ? 'Unpin from top'
        : 'Pin to top';
    const pinAction = insideFolder
        ? `togglePinItemInFolder('${containingFolderId}', 'folder-${folderId}', '${name.replace(/'/g, "\\'")}')`
        : `togglePinItem('folder-${folderId}', '${name.replace(/'/g, "\\'")}')`;

    let menuHTML = `
        <div class="context-menu-item" onclick="openFolder('${folderId}'); closeContextMenu();">
                <i class="fas fa-folder-open"></i>
                <span>Open</span>
        </div>
        <div class="context-menu-item submenu-parent" style="position: relative;">
                <i class="fas fa-folder-minus"></i>
                <span>Move to folder</span>
                <i class="fas fa-chevron-right"></i>
                <div class="context-submenu">
                        ${buildFolderSubmenuHTML(folderId, 'folder', 'move')}
                </div>
        </div>
        <div class="context-menu-item submenu-parent" style="position: relative;">
                <i class="fas fa-share"></i>
                <span>Add shortcut to...</span>
                <i class="fas fa-chevron-right"></i>
                <div class="context-submenu">
                        ${buildFolderSubmenuHTML(folderId, 'folder', 'add')}
                </div>
        </div>
    `;

    if (currentOpenFolderId && currentOpenFolderId !== folderId) {
        const state = getItemFolderState(currentOpenFolderId, folderId, 'folder');
        if (state) {
            const removeLabel = state.shortcut ? 'Remove shortcut from folder' : 'Remove from folder';
            menuHTML += `
                <div class="context-menu-item" onclick="removeFromFolderFromMenu('${currentOpenFolderId}', '${folderId}', 'folder'); closeContextMenu();">
                        <i class="fas fa-times"></i>
                        <span>${removeLabel}</span>
                </div>
            `;
        }
    }

    menuHTML += `
        <div class="context-menu-item" onclick="${pinAction}; closeContextMenu();">
                <i class="fas fa-thumbtack"></i>
                <span>${pinLabel}</span>
        </div>
        <div class="context-menu-item" onclick="showEditFolderDialog('${folderId}'); closeContextMenu();">
                <i class="fas fa-pen"></i>
                <span>Rename</span>
        </div>
        <div class="context-menu-item context-menu-separator" onclick="confirmDeleteFolder('${folderId}', '${name.replace(
        /'/g,
        "\\'"
    )}'); closeContextMenu();">
                <i class="fas fa-trash-alt"></i>
                <span>Delete folder</span>
        </div>
    `;

    menu.innerHTML = menuHTML;

    document.body.appendChild(menu);

    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let posX = event.clientX;
    let posY = event.clientY + 5;

    const spaceToRight = windowWidth - event.clientX;
    if (spaceToRight < menuWidth) {
        posX = event.clientX - menuWidth - 7;
    }
    if (posX < 7) {
        posX = 7;
    }

    const spaceToBottom = windowHeight - event.clientY;
    if (spaceToBottom < menuHeight) {
        posY = event.clientY - menuHeight - 7;
    }
    if (posY < 7) {
        posY = 7;
    }

    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';
    menu.style.visibility = 'visible';

    setTimeout(() => {
        menu.classList.add('active');
    }, 10);

    activeContextMenu = menu;
    menu._originalX = event.clientX;
    menu._originalY = event.clientY;
    menu._flippedX = spaceToRight < menuWidth;
    menu._flippedY = spaceToBottom < menuHeight;
}

function showAlbumContextMenu(event, albumId) {
    const albums = getAlbums();
    const album = albums.find((a) => a.id === albumId);
    const name = album ? album.name : 'Album';
    showLeftPanelItemContextMenu(event, albumId, name, 'album');
}

function showArtistContextMenu(event, artistId) {
    const artists = getArtists();
    const artist = artists.find((a) => a.id === artistId);
    const name = artist ? artist.name : 'Artist';
    showLeftPanelItemContextMenu(event, artistId, name, 'artist');
}

function getViewItemType(viewId) {
    if (!viewId) return 'special';
    if (viewId.startsWith('playlist-')) return 'playlist';
    if (viewId.startsWith('a') && viewId.length === 13) return 'album';
    if (viewId.startsWith('r') && viewId.length === 13) return 'artist';
    return 'special';
}

function showSubheroContextMenu(event) {
    const clickedMoreInfo = event.target.closest('.subhero-more-btn, .more-info');
    if (clickedMoreInfo) {
        temporarilySuppressTooltip(clickedMoreInfo);
    }

    let itemId = currentView;
    let itemName = getCurrentViewDisplayName();
    let itemType = getViewItemType(currentView);

    if (currentView === 'history') {
        event.stopPropagation();
        event.preventDefault();

        closeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.id = 'context-menu';
        menu.style.display = 'block';
        menu.style.visibility = 'hidden';

        const isPinned = isItemPinned(itemId);

        let menuHTML = `
                <div class="context-menu-item" onclick="togglePinItem('${itemId}', '${itemName.replace(
            /'/g,
            "\\'"
        )}'); closeContextMenu();">
                        <i class="fas fa-thumbtack"></i>
                        <span>${isPinned ? 'Unpin from top' : 'Pin to top'}</span>
                </div>
                <div class="context-menu-item context-menu-separator" onclick="clearPlayHistory(); closeContextMenu();">
                        <i class="fas fa-trash-alt"></i>
                        <span>Clear history</span>
                </div>
        `;

        menu.innerHTML = menuHTML;

        document.body.appendChild(menu);

        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let posX = event.clientX;
        let posY = event.clientY + 5;

        const spaceToRight = windowWidth - event.clientX;
        if (spaceToRight < menuWidth) {
            posX = event.clientX - menuWidth - 5;
        }
        if (posX < 5) {
            posX = 5;
        }

        const spaceToBottom = windowHeight - event.clientY;
        if (spaceToBottom < menuHeight) {
            posY = event.clientY - menuHeight - 5;
        }
        if (posY < 5) {
            posY = 5;
        }

        menu.style.left = posX + 'px';
        menu.style.top = posY + 'px';
        menu.style.visibility = 'visible';

        setTimeout(() => {
            menu.classList.add('active');
        }, 10);

        activeContextMenu = menu;
        menu._originalX = event.clientX;
        menu._originalY = event.clientY;
        menu._flippedX = spaceToRight < menuWidth;
        menu._flippedY = spaceToBottom < menuHeight;
        return;
    }

    showLeftPanelItemContextMenu(event, itemId, itemName, itemType);
}

// ==============================================================================
// CONTEXT MENU - EVENT LISTENERS
// ==============================================================================
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        if (notificationPanelOpen) {
            closeNotificationPanel();
            return;
        }
        closeContextMenu();
    }
});

document.addEventListener('mousedown', function (event) {
    if (!activeContextMenu) return;
    const inside = !!event.target.closest('.context-menu');
    const onMoreInfo = !!event.target.closest('.more-info');
    contextMenuMouseDownOutside = !inside && !onMoreInfo;
});

document.addEventListener('click', function (event) {
    if (!event.target.closest('.more-info') && !event.target.closest('.context-menu')) {
        if (contextMenuMouseDownOutside) {
            closeContextMenu();
        }
        contextMenuMouseDownOutside = false;
    }
    if (typeof selectedSongIds !== 'undefined' && selectedSongIds.size > 0) {
        const insideSongItem = event.target.closest('#song-list .song-item');
        const insideContextMenu = event.target.closest('.context-menu');
        const insideModal = event.target.closest(
            '.playlist-modal, .playlist-modal-overlay, .lyrics-editor-overlay, .sync-editor-overlay, .extended-info-overlay, .image-viewer'
        );
        if (!insideSongItem && !insideContextMenu && !insideModal) {
            clearAllSelections();
        }
    }
});

window.addEventListener('resize', function () {
    if (activeContextMenu) {
        const menu = activeContextMenu;
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let posX = menu._flippedX ? menu._originalX - menuWidth - 7 : menu._originalX;
        let posY = menu._flippedY ? menu._originalY - menuHeight - 7 : menu._originalY + 5;

        if (posX + menuWidth > windowWidth - 7) {
            posX = windowWidth - menuWidth - 7;
        }
        if (posX < 7) {
            posX = 7;
        }

        if (posY + menuHeight > windowHeight - 7) {
            posY = windowHeight - menuHeight - 7;
        }
        if (posY < 7) {
            posY = 7;
        }

        menu.style.left = posX + 'px';
        menu.style.top = posY + 'px';

        positionSubmenus(menu);
    }
});

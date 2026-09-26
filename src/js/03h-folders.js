// ==============================================================================
// FOLDERS (CRUD, tree building, expand state)
// (split out of 03-storage.js, Phase 2 Checkpoint 5)
// ==============================================================================


// ==============================================================================
// FOLDERS
// ==============================================================================
function getFolders() {
    return getStoredJson(STORAGE_KEYS.FOLDERS, []);
}


function saveFolders(folders) {
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
}


function createFolder(name) {
    let folders = getFolders();
    const newFolder = {
        id: generateLongId('f'),
        name: name,
        children: [],
        createdAt: new Date().toLocaleString()
    };
    folders.unshift(newFolder);
    saveFolders(folders);

    let order = getPlayedItemOrder();
    order = order.filter((id) => id !== `folder-${newFolder.id}`);
    order.unshift(`folder-${newFolder.id}`);
    savePlayedItemOrder(order);

    renderFoldersView();
    renderLeftPanelMainList();

    // Refresh virtual scroll
    if (typeof leftPanelVirtualState !== 'undefined' && leftPanelVirtualState.enabled) {
        const newItems = getLeftPanelItemsArray();
        leftPanelVirtualState.currentItems = newItems;
        if (typeof renderLeftPanelVisibleItems === 'function') {
            renderLeftPanelVisibleItems(false);
        }
    }

    updateScrollbarById('left-panel-main-content');

    return newFolder;
}


function deleteFolder(folderId, deleteContents = false) {
    let folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    const wasCurrentView =
        currentView && currentView.startsWith('folder-') && currentView.replace('folder-', '') === folderId;

    if (deleteContents && folder.children.length > 0) {
        for (const child of [...folder.children]) {
            if (child.type === 'folder') {
                deleteFolder(child.id, true);
            } else if (child.type === 'playlist') {
                let playlists = getPlaylists();
                playlists = playlists.filter((p) => p.id !== child.id);
                savePlaylists(playlists);
                removeItemFromAllFolders(child.id, 'playlist');
            }
        }
    }

    for (const f of folders) {
        if (f.id !== folderId) {
            f.children = f.children.filter((c) => c.id !== folderId);
        }
    }

    folders = folders.filter((f) => f.id !== folderId);
    saveFolders(folders);
    removeItemFromAllFolders(folderId, 'folder');

    if (wasCurrentView) {
        switchView(VIEWS.ALL_SONGS);
    }

    renderFoldersView();
    renderLeftPanelMainList();

    // Refresh virtual scroll
    if (typeof leftPanelVirtualState !== 'undefined' && leftPanelVirtualState.enabled) {
        const newItems = getLeftPanelItemsArray();
        leftPanelVirtualState.currentItems = newItems;
        if (typeof renderLeftPanelVisibleItems === 'function') {
            renderLeftPanelVisibleItems(false);
        }
    }

    updateScrollbarById('left-panel-main-content');
}


function getFolderContents(folderId) {
    const folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder)
        return {
            folders: [],
            playlists: [],
            albums: [],
            artists: [],
            specials: []
        };

    const childFolders = [];
    const childPlaylists = [];
    const childAlbums = [];
    const childArtists = [];
    const childSpecials = [];

    for (const child of folder.children) {
        if (child.type === 'folder') {
            const f = folders.find((f) => f.id === child.id);
            if (f)
                childFolders.push({
                    data: f,
                    shortcut: !!child.shortcut
                });
        } else if (child.type === 'playlist') {
            const playlists = getPlaylists();
            const p = playlists.find((p) => p.id === child.id);
            if (p)
                childPlaylists.push({
                    data: p,
                    shortcut: !!child.shortcut
                });
        } else if (child.type === 'album') {
            const albums = getAlbums();
            const a = albums.find((a) => a.id === child.id);
            if (a)
                childAlbums.push({
                    data: a,
                    shortcut: !!child.shortcut
                });
        } else if (child.type === 'artist') {
            const artists = getArtists();
            const a = artists.find((a) => a.id === child.id);
            if (a)
                childArtists.push({
                    data: a,
                    shortcut: !!child.shortcut
                });
        } else if (child.type === 'special') {
            childSpecials.push({
                data: {
                    id: child.id,
                    name: child.id === VIEWS.ALL_SONGS ? 'All Songs' : child.id === VIEWS.FAVORITES ? 'Liked Songs' : child.id
                },
                shortcut: !!child.shortcut
            });
        }
    }

    return {
        folders: childFolders,
        playlists: childPlaylists,
        albums: childAlbums,
        artists: childArtists,
        specials: childSpecials
    };
}


function addToFolder(folderId, itemId, itemType, asShortcut = false) {
    if (itemType === 'folder' && folderId === itemId) return false;
    let folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return false;

    const existingIndex = folder.children.findIndex((c) => c.id === itemId && c.type === itemType);

    if (existingIndex !== -1) {
        if (asShortcut || !folder.children[existingIndex].shortcut) {
            return false;
        }
        folder.children.splice(existingIndex, 1);
    }

    if (!asShortcut) {
        for (const f of folders) {
            if (f.id !== folderId) {
                f.children = f.children.filter((c) => !(c.id === itemId && c.type === itemType && !c.shortcut));
            }
        }
    }

    folder.children.push({
        id: itemId,
        type: itemType,
        shortcut: asShortcut
    });
    saveFolders(folders);
    return true;
}


function removeItemFromAllFolders(itemId, itemType) {
    let folders = getFolders();
    let changed = false;
    for (const f of folders) {
        const before = f.children.length;
        f.children = f.children.filter((c) => !(c.id === itemId && c.type === itemType));
        if (f.children.length !== before) changed = true;
    }
    if (changed) saveFolders(folders);
    return changed;
}


function removeItemFromFolder(folderId, itemId, itemType) {
    let folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return false;

    const before = folder.children.length;
    folder.children = folder.children.filter((c) => !(c.id === itemId && c.type === itemType));
    if (folder.children.length !== before) {
        saveFolders(folders);
        return true;
    }
    return false;
}


function updateFolderCount(folderId) {
    const folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (folder) {
        const playlistItems = folder.children.filter((c) => c.type === 'playlist').length;
        const folderItems = folder.children.filter((c) => c.type === 'folder').length;
        let countText = '';
        if (folderItems > 0) countText += `${folderItems} folder${folderItems !== 1 ? 's' : ''}`;
        if (playlistItems > 0) {
            if (countText) countText += ' • ';
            countText += `${playlistItems} playlist${playlistItems !== 1 ? 's' : ''}`;
        }
        return countText || 'Empty';
    }
    return 'Empty';
}


function isItemInAnyFolder(itemId, itemType) {
    const folders = getFolders();
    for (const folder of folders) {
        if (folder.children.some((c) => c.id === itemId && c.type === itemType && !c.shortcut)) {
            return true;
        }
    }
    return false;
}


function getItemFolderState(folderId, itemId, itemType) {
    const folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return null;
    const child = folder.children.find((c) => c.id === itemId && c.type === itemType);
    if (!child) return null;
    return {
        shortcut: !!child.shortcut
    };
}


function getExpandedFolderKeys() {
    return getStoredJson(STORAGE_KEYS.EXPANDED_FOLDERS, []);
}


function saveExpandedFolderKeys(keys) {
    localStorage.setItem(STORAGE_KEYS.EXPANDED_FOLDERS, JSON.stringify(keys));
}


function isFolderExpanded(parentKey, folderId) {
    const keys = getExpandedFolderKeys();
    return keys.includes(parentKey + '/' + folderId);
}


function toggleFolderExpanded(parentKey, folderId) {
    const key = parentKey + '/' + folderId;
    let keys = getExpandedFolderKeys();
    if (keys.includes(key)) {
        keys = keys.filter((k) => k !== key);
    } else {
        keys.push(key);
    }
    saveExpandedFolderKeys(keys);
    return keys.includes(key);
}


function countFolderChildren(folderId) {
    const c = getFolderContents(folderId);
    return c.folders.length + c.playlists.length + c.albums.length + c.artists.length + c.specials.length;
}


function buildFolderChildItems(folderId, parentKey) {
    const { folders, playlists, albums, artists, specials } = getFolderContents(folderId);
    const pinnedIds = getFolderPinnedItems(folderId);
    const playedOrder = getPlayedItemOrder();
    const items = [];

    folders.forEach((f) => {
        items.push({
            type: 'folder',
            id: f.data.id,
            title: f.data.name,
            viewId: `folder-${f.data.id}`,
            pinId: `folder-${f.data.id}`,
            countText: updateFolderCount(f.data.id),
            isPinned: pinnedIds.includes(`folder-${f.data.id}`),
            playedIndex: playedOrder.indexOf(`folder-${f.data.id}`),
            isShortcut: !!f.shortcut,
            parentKey: parentKey
        });
    });
    playlists.forEach((p) => {
        items.push({
            type: 'playlist',
            id: p.data.id,
            title: p.data.name,
            viewId: `playlist-${p.data.id}`,
            pinId: `playlist-${p.data.id}`,
            count: `${p.data.songs.length} ${p.data.songs.length === 1 ? 'song' : 'songs'}`,
            cover: p.data.cover,
            isPinned: pinnedIds.includes(`playlist-${p.data.id}`),
            playedIndex: playedOrder.indexOf(`playlist-${p.data.id}`),
            isShortcut: !!p.shortcut,
            parentKey: parentKey
        });
    });
    albums.forEach((a) => {
        items.push({
            type: 'album',
            id: a.data.id,
            title: a.data.name,
            viewId: a.data.id,
            pinId: a.data.id,
            count: a.data.songCount,
            cover: a.data.cover,
            isPinned: pinnedIds.includes(a.data.id),
            playedIndex: playedOrder.indexOf(a.data.id),
            isShortcut: !!a.shortcut,
            parentKey: parentKey
        });
    });
    artists.forEach((a) => {
        items.push({
            type: 'artist',
            id: a.data.id,
            title: a.data.name,
            viewId: a.data.id,
            pinId: a.data.id,
            count: a.data.songCount,
            cover: a.data.cover,
            isPinned: pinnedIds.includes(a.data.id),
            playedIndex: playedOrder.indexOf(a.data.id),
            isShortcut: !!a.shortcut,
            parentKey: parentKey
        });
    });
    specials.forEach((s) => {
        items.push({
            type: 'special',
            id: s.data.id,
            title: s.data.name,
            viewId: s.data.id,
            pinId: s.data.id,
            countText: '',
            isPinned: pinnedIds.includes(s.data.id),
            playedIndex: playedOrder.indexOf(s.data.id),
            isShortcut: !!s.shortcut,
            parentKey: parentKey
        });
    });

    items.sort((a, b) => {
        if (a.isPinned && b.isPinned) return pinnedIds.indexOf(a.pinId) - pinnedIds.indexOf(b.pinId);
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const aPlayed = a.playedIndex !== -1 ? a.playedIndex : 999;
        const bPlayed = b.playedIndex !== -1 ? b.playedIndex : 999;
        if (aPlayed !== bPlayed) return aPlayed - bPlayed;
        return 0;
    });
    return items;
}


function flattenLeftPanelItems(items, depth, parentKey, out, visited) {
    if (depth > 50) return;
    for (const item of items) {
        const cloned = Object.assign({}, item);
        cloned.depth = depth;
        cloned.parentKey = parentKey;
        if (cloned.type === 'folder') {
            cloned.childCount = countFolderChildren(cloned.id);
            cloned.isExpanded = isFolderExpanded(parentKey, cloned.id);
            cloned.isFolder = true;
        } else {
            cloned.isFolder = false;
            cloned.isExpanded = false;
        }
        out.push(cloned);
        if (cloned.type === 'folder' && cloned.isExpanded) {
            const branch = visited ? new Set(visited) : new Set();
            if (branch.has(cloned.id)) continue;
            branch.add(cloned.id);
            const children = buildFolderChildItems(cloned.id, cloned.id);
            flattenLeftPanelItems(children, depth + 1, cloned.id, out, branch);
        }
    }
}

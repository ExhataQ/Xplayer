// ==============================================================================
// CONSTANTS
// ==============================================================================
const MAX_RECENT_SONGS = 50;

const MAX_HISTORY_ENTRIES = 500;

const MAX_SEARCH_HISTORY = 20;

function getStoredJson(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
        return fallback;
    }
}

// ==============================================================================
// RECENTLY PLAYED
// ==============================================================================
function saveToRecentlyPlayed(song) {
    // List logic (move-to-top instead of duplicating, cap, clean-up) lives in 03a-recents.js.
    const recentSongs = addToRecentList(getStoredJson(STORAGE_KEYS.RECENTLY_PLAYED, []), song, Date.now(), MAX_RECENT_SONGS);

    try {
        localStorage.setItem(STORAGE_KEYS.RECENTLY_PLAYED, JSON.stringify(recentSongs));
    } catch (e) {
        console.warn('Could not save the recently played list:', e);
    }
    updateRecentCount();

    const recentPanel = document.getElementById('recently-played-content');
    if (recentPanel && recentPanel.classList.contains('active')) {
        renderPortableRecentlyPlayed();
    }
}

function getRecentlyPlayed() {
    const recentSongs = getStoredJson(STORAGE_KEYS.RECENTLY_PLAYED, []);
    return recentSongs;
}

function updateRecentCount() {
    const countElement = document.querySelector('.left-panel-item[onclick*="recent"] .song-count');
    if (countElement) {
        countElement.textContent = getRecentCount();
    }
}

async function clearRecentlyPlayed() {
    const confirmed = await showConfirmDialog({
        title: 'Clear Recently Played',
        message: 'Clear all recently played songs? This cannot be undone.',
        okText: 'Clear',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        localStorage.removeItem(STORAGE_KEYS.RECENTLY_PLAYED);
        clearGhostList(VIEWS.RECENT);
        updateRecentCount();

        if (currentView === VIEWS.RECENT) {
            renderRecentlyPlayed();
            setTimeout(() => updateExternalScrollbar(), 100);
        }

        const recentPanel = document.getElementById('recently-played-content');
        if (recentPanel && recentPanel.classList.contains('active')) {
            renderPortableRecentlyPlayed();
        }

        showNotification('Recently played list cleared', 'success', 3000);
    }
}

// ==============================================================================
// PLAY HISTORY
// ==============================================================================
function saveToPlayHistory(song, playDuration) {
    const actualSong = song.song || song;

    let history = getStoredJson(STORAGE_KEYS.PLAY_HISTORY, []);

    const ghostSlotId = addHistoryGhostSlot(actualSong.id);

    const historyEntry = {
        id: actualSong.id,
        title: actualSong.title,
        artist: actualSong.artist,
        album: actualSong.album,
        cover: actualSong.cover,
        duration: actualSong.duration,
        url: actualSong.url,
        playedAt: Date.now(),
        playedDate: new Date().toLocaleString(),
        playDurationSeconds: Math.floor(playDuration / 1000),
        ghostSlotId: ghostSlotId
    };

    history.unshift(historyEntry);

    if (history.length > MAX_HISTORY_ENTRIES) {
        history = history.slice(0, MAX_HISTORY_ENTRIES);
    }

    localStorage.setItem(STORAGE_KEYS.PLAY_HISTORY, JSON.stringify(history));

    if (currentView === VIEWS.HISTORY) {
        renderHistoryView();
    }
}

function getPlayHistory() {
    return getStoredJson(STORAGE_KEYS.PLAY_HISTORY, []);
}

async function clearPlayHistory() {
    const confirmed = await showConfirmDialog({
        title: 'Clear History',
        message: 'Clear all play history? This cannot be undone.',
        okText: 'Clear',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        localStorage.removeItem(STORAGE_KEYS.PLAY_HISTORY);
        historyGhostSlots = [];
        nextHistorySlotId = 1;

        if (currentView === VIEWS.HISTORY) {
            showHeroSection(true);
            updateHeroSection('Recents', 0, 'Playlist', 'History');
            renderHistoryView();
            setTimeout(() => {
                if (typeof updateExternalScrollbar === 'function') {
                    updateExternalScrollbar();
                }
            }, 100);
        }

        showNotification('Play history cleared', 'success', 3000);
    }
}

// ==============================================================================
// FAVORITES
// ==============================================================================
function getFavorites() {
    return getStoredJson(STORAGE_KEYS.FAVORITES, []);
}

const DEFAULT_SMART_SHUFFLE_SETTINGS = {
    journeySize: 50,
    groupSize: 5,
    genreFlow: 'gentle',
    artistSeparation: 'normal',
    recentLimit: 50,
    favoriteWeight: 'neutral',
    discoveryWeight: 'neutral',
    durationVariety: true
};

const DEFAULT_AUDIO_PLAYBACK_SETTINGS = {
    crossfadeEnabled: false,
    crossfadeDuration: 4,
    gaplessEnabled: true,
    fadeInEnabled: true,
    fadeInDuration: 1,
    fadeOutEnabled: true,
    fadeOutDuration: 1.25,
    replayGainEnabled: true,
    replayGainMode: 'track',
    replayGainTrimDb: 0,
    replayGainLimiter: true
};

function getSmartShuffleSettings() {
    return {
        ...DEFAULT_SMART_SHUFFLE_SETTINGS,
        ...getStoredJson(STORAGE_KEYS.SMART_SHUFFLE_SETTINGS, {})
    };
}

function getAudioPlaybackSettings() {
    const settings = {
        ...DEFAULT_AUDIO_PLAYBACK_SETTINGS,
        ...getStoredJson(STORAGE_KEYS.AUDIO_PLAYBACK_SETTINGS, {})
    };
    // Both modes control the same transition and cannot run together. Preserve
    // the gapless preference for settings saved by older builds with both on.
    if (settings.gaplessEnabled && settings.crossfadeEnabled) {
        settings.crossfadeEnabled = false;
    }
    return settings;
}

function saveAudioPlaybackSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.AUDIO_PLAYBACK_SETTINGS, JSON.stringify(settings));
}

function setAudioPlaybackSetting(key, value) {
    const settings = getAudioPlaybackSettings();
    settings[key] = value;

    if (key === 'gaplessEnabled' && value) settings.crossfadeEnabled = false;
    if (key === 'crossfadeEnabled' && value) settings.gaplessEnabled = false;

    saveAudioPlaybackSettings(settings);

    if (typeof document !== 'undefined') {
        document.querySelectorAll('[data-playback-setting]').forEach((input) => {
            const settingKey = input.getAttribute('data-playback-setting');
            if (input.type === 'checkbox' && settingKey in settings) {
                input.checked = Boolean(settings[settingKey]);
            }
        });
    }

    if (key === 'gaplessEnabled' || key === 'crossfadeEnabled') {
        if (settings.gaplessEnabled && typeof prepareGaplessNextTrack === 'function') {
            prepareGaplessNextTrack();
        } else if (typeof clearGaplessPreload === 'function') {
            clearGaplessPreload();
        }
    }

    if (
        ['replayGainEnabled', 'replayGainMode', 'replayGainTrimDb', 'replayGainLimiter'].includes(key) &&
        typeof applyTrackVolume === 'function' &&
        typeof getCurrentSongForInfo === 'function'
    ) {
        applyTrackVolume(getCurrentSongForInfo());
    }

    return settings;
}

function getWindowSettings() {
    return {
        minimizeOnClose: localStorage.getItem(STORAGE_KEYS.MINIMIZE_ON_CLOSE) === 'true'
    };
}

function setMinimizeOnClose(enabled) {
    const value = Boolean(enabled);
    localStorage.setItem(STORAGE_KEYS.MINIMIZE_ON_CLOSE, String(value));
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.setMinimizeOnClose) {
        window.electronAPI.setMinimizeOnClose(value);
    }
}

function saveSmartShuffleSetting(key, value) {
    const settings = getSmartShuffleSettings();
    settings[key] = value;
    localStorage.setItem(STORAGE_KEYS.SMART_SHUFFLE_SETTINGS, JSON.stringify(settings));
}

function saveFavorite(songId) {
    let favorites = getFavorites();
    if (!favorites.includes(songId)) {
        favorites.unshift(songId);
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    }
}

function removeFavorite(songId) {
    let favorites = getFavorites();
    favorites = favorites.filter((id) => id !== songId);
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
}

function isFavorite(songId) {
    const favorites = getFavorites();
    return favorites.includes(songId);
}

// ==============================================================================
// PINNED ITEMS & ITEM ORDER
// ==============================================================================
function getPinnedItems() {
    return getStoredJson(STORAGE_KEYS.PINNED_ITEMS, []);
}

function savePinnedItems(pinnedIds) {
    localStorage.setItem(STORAGE_KEYS.PINNED_ITEMS, JSON.stringify(pinnedIds));
}

function isItemPinned(itemId) {
    const pinned = getPinnedItems();
    return pinned.includes(itemId);
}

function togglePinItem(itemId, itemName) {
    let pinned = getPinnedItems();

    if (pinned.includes(itemId)) {
        pinned = pinned.filter((id) => id !== itemId);
        // Move to first position in unpinned section by updating played order
        let playedOrder = getPlayedItemOrder();
        playedOrder = playedOrder.filter((id) => id !== itemId);
        playedOrder.unshift(itemId);
        savePlayedItemOrder(playedOrder);
        showNotification(`"${itemName}" unpinned`, 'info', 2000);
    } else {
        pinned.push(itemId);
        showNotification(`"${itemName}" pinned`, 'success', 2000);
    }

    savePinnedItems(pinned);
    renderLeftPanelMainList();

    // Refresh virtual scroll to reflect new pin order
    if (leftPanelVirtualState.enabled) {
        const newItems = getLeftPanelItemsArray();
        leftPanelVirtualState.currentItems = newItems;
        renderLeftPanelVisibleItems(false);
    }

    updateScrollbarById('left-panel-main-content');
}

function getPlayedItemOrder() {
    return getStoredJson(STORAGE_KEYS.PLAYED_ITEM_ORDER, []);
}

function savePlayedItemOrder(order) {
    localStorage.setItem(STORAGE_KEYS.PLAYED_ITEM_ORDER, JSON.stringify(order));
}

function movePlayedItemToTop(listId) {
    if (
        listId === VIEWS.ALL_SONGS ||
        listId === VIEWS.FAVORITES ||
        listId === VIEWS.ALBUMS ||
        listId === VIEWS.ARTISTS ||
        (listId &&
            (listId.startsWith('playlist-') ||
                (listId.startsWith('a') && listId.length === 13) ||
                (listId.startsWith('r') && listId.length === 13)))
    ) {
        const pinnedIds = getPinnedItems();
        if (pinnedIds.includes(listId)) return;

        let order = getPlayedItemOrder();
        if (order[0] === listId) return;

        order = order.filter((id) => id !== listId);
        order.unshift(listId);
        savePlayedItemOrder(order);
        renderPlaylistsView();
        renderAlbumLeftPanelItems();
        renderArtistLeftPanelItems();

        // Refresh virtual scroll (no auto-scroll)
        if (typeof leftPanelVirtualState !== 'undefined' && leftPanelVirtualState.enabled) {
            const currentScrollTop = leftPanelVirtualState.container?.scrollTop || 0;
            const newItems = getLeftPanelItemsArray();
            leftPanelVirtualState.currentItems = newItems;
            if (typeof renderLeftPanelVisibleItems === 'function') {
                renderLeftPanelVisibleItems(false);
            }
            // Restore original scroll position
            if (leftPanelVirtualState.container) {
                leftPanelVirtualState.container.scrollTop = currentScrollTop;
            }
        }

        updateScrollbarById('left-panel-main-content');
    }
}

// ==============================================================================
// FOLDER-SCOPED PINNED ITEMS
// ==============================================================================
function getFolderPinnedItemsMap() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.FOLDER_PINNED_ITEMS);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.warn('[folderPinnedItems] failed to parse saved value, using empty map', e);
    }
    return {};
}

function saveFolderPinnedItemsMap(map) {
    localStorage.setItem(STORAGE_KEYS.FOLDER_PINNED_ITEMS, JSON.stringify(map));
}

function getFolderPinnedItems(folderId) {
    if (!folderId) return [];
    const map = getFolderPinnedItemsMap();
    return Array.isArray(map[folderId]) ? map[folderId] : [];
}

function isItemPinnedInFolder(folderId, itemId) {
    return getFolderPinnedItems(folderId).includes(itemId);
}

function togglePinItemInFolder(folderId, itemId, itemName) {
    const map = getFolderPinnedItemsMap();
    const current = Array.isArray(map[folderId]) ? map[folderId] : [];
    const isPinned = current.includes(itemId);
    if (isPinned) {
        map[folderId] = current.filter((id) => id !== itemId);
    } else {
        map[folderId] = [...current, itemId];
    }
    saveFolderPinnedItemsMap(map);
    showNotification(isPinned ? `"${itemName}" unpinned` : `"${itemName}" pinned`, isPinned ? 'info' : 'success', 2000);
    refreshLeftPanelAfterFolderPinChange(folderId);
}

function refreshLeftPanelAfterFolderPinChange(folderId) {
    if (currentOpenFolderId === folderId) {
        renderFolderContents(folderId);
    } else {
        if (leftPanelVirtualState.enabled) {
            leftPanelVirtualState.currentItems = getLeftPanelItemsArray();
            renderLeftPanelVisibleItems(false);
        } else {
            renderLeftPanelMainList();
        }
    }
    updateScrollbarById('left-panel-main-content');
}

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

// ==============================================================================
// SEARCH HISTORY
// ==============================================================================
function getSearchHistory() {
    return getStoredJson(STORAGE_KEYS.SEARCH_HISTORY, []);
}

function saveSearchToHistory(searchQuery, searchSessionId, resultCount) {
    let searchHistory = getStoredJson(STORAGE_KEYS.SEARCH_HISTORY, []);

    const searchEntry = {
        sessionId: searchSessionId,
        query: searchQuery,
        resultCount: resultCount,
        timestamp: Date.now(),
        displayTime: new Date().toLocaleString()
    };

    searchHistory = searchHistory.filter((entry) => entry.sessionId !== searchSessionId);
    searchHistory.unshift(searchEntry);

    if (searchHistory.length > MAX_SEARCH_HISTORY) {
        searchHistory = searchHistory.slice(0, MAX_SEARCH_HISTORY);
    }

    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(searchHistory));
}

async function clearSearchHistory() {
    const confirmed = await showConfirmDialog({
        title: 'Clear Search History',
        message: 'Clear all search history? This cannot be undone.',
        okText: 'Clear',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);

        if (currentView === VIEWS.SEARCH_HISTORY) {
            renderSearchHistoryView();
        }

        showNotification('Search history cleared', 'success', 3000);
    }
}

// ==============================================================================
// LIBRARY LOCATIONS (MULTI-FOLDER SUPPORT)
// ==============================================================================

let libraryLocationsPanelOpen = false;

async function loadLibraryLocations() {
    const api = typeof window !== 'undefined' ? window.electronAPI : null;
    if (!api || !api.getMusicFolders) {
        return [];
    }
    try {
        const folders = await api.getMusicFolders();
        return folders;
    } catch (e) {
        return [];
    }
}

async function getFolderStats(folderPath) {
    const api = typeof window !== 'undefined' ? window.electronAPI : null;
    if (!api || !api.getFolderStats) {
        return {
            songCount: 0,
            addedTime: null
        };
    }
    try {
        return await api.getFolderStats(folderPath);
    } catch (e) {
        return {
            songCount: 0,
            addedTime: null
        };
    }
}

let selectedLibraryFolders = [];

function selectLibraryFolder(element, folderPath, event) {
    const list = document.getElementById('library-locations-list');
    if (list) list.focus();
    const items = Array.from(document.querySelectorAll('.library-location-item'));
    const itemIndex = items.indexOf(element);
    const lastIndex = selectedLibraryFolders.length
        ? items.findIndex((item) => item.dataset.folder === selectedLibraryFolders[selectedLibraryFolders.length - 1])
        : -1;

    const isSameSingleSelection = !event?.shiftKey && !event?.ctrlKey && !event?.metaKey && selectedLibraryFolders.length === 1 && selectedLibraryFolders[0] === folderPath;

    if (isSameSingleSelection) {
        selectedLibraryFolders = [];
    } else if (event && event.shiftKey && lastIndex >= 0) {
        const start = Math.min(lastIndex, itemIndex);
        const end = Math.max(lastIndex, itemIndex);
        selectedLibraryFolders = items.slice(start, end + 1).map((item) => item.dataset.folder);
    } else if (event && (event.ctrlKey || event.metaKey)) {
        if (selectedLibraryFolders.includes(folderPath)) {
            selectedLibraryFolders = selectedLibraryFolders.filter((folder) => folder !== folderPath);
        } else {
            selectedLibraryFolders = [...selectedLibraryFolders, folderPath];
        }
    } else {
        selectedLibraryFolders = [folderPath];
    }

    items.forEach((item) => item.classList.toggle('selected', selectedLibraryFolders.includes(item.dataset.folder)));
}

function clearLibraryFolderSelection() {
    selectedLibraryFolders = [];
    const items = document.querySelectorAll('.library-location-item');
    items.forEach((item) => item.classList.remove('selected'));
}

function normalizeDroppedFolderPath(rawValue) {
    if (!rawValue || typeof rawValue !== 'string') return null;

    let value = rawValue.trim();
    if (!value) return null;

    value = value.replace(/^['"]+|['"]+$/g, '');

    if (value.startsWith('file:///')) {
        value = decodeURIComponent(value.replace(/^file:\/\//i, ''));
    }

    if (value.startsWith('\\\\') || value.startsWith('\\')) {
        value = value.replace(/^\\\\?/, '').replace(/\\/g, '\\');
    } else if (value.startsWith('file://')) {
        value = decodeURIComponent(value.replace(/^file:\/\//i, ''));
    }

    return value || null;
}

function isFolderPathCandidate(rawValue) {
    const value = normalizeDroppedFolderPath(rawValue);
    if (!value) return false;

    const lower = value.toLowerCase();
    const ignoredExtensions = [
        '.mp3', '.flac', '.m4a', '.mp4', '.aac', '.ogg', '.opus', '.wma', '.wav',
        '.aiff', '.aif', '.ape', '.wv', '.m4b', '.mpc', '.alac', '.webm'
    ];

    if (ignoredExtensions.some((ext) => lower.endsWith(ext))) {
        return false;
    }

    return value.length > 1;
}

async function addFolderPathFromInput(rawValue, label = 'Folder') {
    if (!rawValue || !isFolderPathCandidate(rawValue)) {
        return false;
    }

    const folderPath = normalizeDroppedFolderPath(rawValue);
    if (!folderPath) {
        return false;
    }

    try {
        const result = await window.electronAPI.addMusicFolder(folderPath);
        if (result && result.success) {
            await renderLibraryLocations();
            showNotification(`${label} added`, 'success', 2500);
            return true;
        }
        if (result && result.reason === 'duplicate') {
            showNotification('Folder already in library', 'warning', 2000);
            return true;
        }
        showNotification(`Could not add ${label.toLowerCase()}`, 'error', 2000);
        return false;
    } catch (error) {
        showNotification(`Could not add ${label.toLowerCase()}`, 'error', 2000);
        return false;
    }
}

async function handleDroppedLibraryFolder(event) {
    if (!event || !event.dataTransfer) return;
    event.preventDefault();
    event.stopPropagation();

    const list = document.getElementById('library-locations-list');
    if (list) {
        list.classList.remove('drag-over-folder');
    }

    let folderPath = null;
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    const firstFilePath = droppedFiles.find((file) => file && file.path)?.path;
    if (firstFilePath) {
        folderPath = firstFilePath;
    }

    if (!folderPath) {
        const uriList = event.dataTransfer.getData('text/uri-list');
        if (uriList) {
            const firstUri = uriList.split(/\r?\n/).find((entry) => entry && entry.startsWith('file://'));
            if (firstUri) folderPath = firstUri;
        }
    }

    if (!folderPath) {
        const plainText = event.dataTransfer.getData('text/plain');
        if (plainText) folderPath = plainText;
    }

    if (!folderPath) return;

    await addFolderPathFromInput(folderPath, 'Folder from drag/drop');
}

async function handlePastedLibraryFolder(event) {
    if (!event || !event.clipboardData) return;
    const pastedText = event.clipboardData.getData('text');
    if (!pastedText || !pastedText.trim()) return;

    const importText = pastedText.trim();
    if (!isFolderPathCandidate(importText)) return;

    event.preventDefault();
    event.stopPropagation();
    await addFolderPathFromInput(importText, 'Pasted folder');
}

async function renderLibraryLocations() {
    const container = document.getElementById('library-locations-list');
    if (!container) return;

    const folders = await loadLibraryLocations();

    if (!folders || folders.length === 0) {
        container.innerHTML = `
            <div class="empty-queue" style="padding: 40px 20px; text-align: center;">
                <i class="fas fa-folder-open" style="font-size: 32px; opacity: 0.5;"></i>
                <p style="margin-top: 12px;">No folders added</p>
                <small>Click "Add Folder" to include music locations</small>
            </div>
        `;
        selectedLibraryFolders = [];
        return;
    }

    const foldersWithStats = await Promise.all(folders.map(async (folder) => {
        const stats = await getFolderStats(folder);
        const folderName = folder.split('\\').pop() || folder;
        const escapedFolderForClick = folder.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return {
            folder,
            folderName,
            escapedFolderForClick,
            songCount: Number(stats.songCount) || 0
        };
    }));

    container.innerHTML = foldersWithStats
        .map(
            (item) => `
        <div class="library-location-item" data-folder="${escapeHtml(
            item.folder
        )}" onclick="selectLibraryFolder(this, '${item.escapedFolderForClick}', event)">
            <div class="library-location-name">
                <i class="fas fa-folder"></i>
                <span>${escapeHtml(item.folderName)}</span>
            </div>
            <div class="library-location-path" title="${escapeHtml(item.folder)}">${escapeHtml(item.folder)}</div>
            <div class="library-location-song-count">${item.songCount} song${item.songCount !== 1 ? 's' : ''}</div>
        </div>
    `
        )
        .join('');

    selectedLibraryFolders = selectedLibraryFolders.filter((folder) => folders.includes(folder));

    if (!document.body.dataset.librarySelectionOutsideHook) {
        document.addEventListener('pointerdown', (event) => {
            const list = document.getElementById('library-locations-list');
            const section = document.querySelector('.library-locations-section');
            if (!list || selectedLibraryFolders.length === 0) return;
            if (list.contains(event.target) || (section && section.contains(event.target))) return;
            clearLibraryFolderSelection();
        });
        document.body.dataset.librarySelectionOutsideHook = '1';
    }

    container.tabIndex = 0;
    container.onkeydown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            selectedLibraryFolders = folders.slice();
            container.querySelectorAll('.library-location-item').forEach((item) => item.classList.add('selected'));
        }
    };
    container.onpaste = handlePastedLibraryFolder;
    container.onpointerdown = (event) => {
        const target = event.target.closest('.library-location-item');
        if (!target && selectedLibraryFolders.length > 0) {
            clearLibraryFolderSelection();
        }
    };
    container.ondragenter = (event) => {
        const transfer = event.dataTransfer;
        if (!transfer || !Array.from(transfer.types || []).includes('Files')) {
            return;
        }
        const hasFolderCandidate = Array.from(transfer.files || []).some((file) => file && file.path) ||
            transfer.getData('text/uri-list') || transfer.getData('text/plain');
        if (!hasFolderCandidate) return;
        container.classList.add('drag-over-folder');
    };
    container.ondragleave = (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            container.classList.remove('drag-over-folder');
        }
    };
    container.ondragover = (event) => {
        const transfer = event.dataTransfer;
        if (!transfer) return;
        const hasFolderCandidate = Array.from(transfer.files || []).some((file) => file && file.path) ||
            transfer.getData('text/uri-list') || transfer.getData('text/plain');
        if (!hasFolderCandidate) {
            event.preventDefault();
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        container.classList.add('drag-over-folder');
    };
    container.ondrop = handleDroppedLibraryFolder;
    container.querySelectorAll('.library-location-item').forEach((item) => {
        item.classList.toggle('selected', selectedLibraryFolders.includes(item.dataset.folder));
    });
}

async function removeSelectedLibraryFolder() {
    if (selectedLibraryFolders.length === 0) {
        showNotification('No folder selected', 'warning', 2000);
        return;
    }

    const foldersToRemove = [...selectedLibraryFolders];
    const folderNames = foldersToRemove.map((folderPath) => folderPath.split('\\').pop() || folderPath);

    const confirmed = await showConfirmDialog({
        title: 'Remove Music Folder',
        message: `Remove ${foldersToRemove.length} selected folder${foldersToRemove.length !== 1 ? 's' : ''} from your music library?\n\nSongs from these folders will be removed from the player.`,
        okText: 'Remove',
        cancelText: 'Cancel'
    });

    if (!confirmed) return;

    if (!window.electronAPI || (!window.electronAPI.removeMusicFolders && !window.electronAPI.removeMusicFolder)) {
        showNotification('Not available', 'warning', 2000);
        return;
    }

    const result = window.electronAPI.removeMusicFolders
        ? await window.electronAPI.removeMusicFolders(foldersToRemove)
        : await Promise.all(foldersToRemove.map((folderPath) => window.electronAPI.removeMusicFolder(folderPath))).then(
              (results) => ({ success: results.every((item) => item && item.success) })
          );

    if (result && result.success) {
        selectedLibraryFolders = [];
        await renderLibraryLocations();
        showNotification(
            `Removed ${folderNames.length} folder${folderNames.length !== 1 ? 's' : ''}. Click "Save and Apply Changes" to update songs.`,
            'info',
            4000
        );
    } else {
        showNotification('Failed to remove folder', 'error', 2000);
    }
}

async function addLibraryLocation() {
    if (!window.electronAPI || !window.electronAPI.addMusicFolder) {
        showNotification('Not available', 'warning', 2000);
        return;
    }

    const result = await window.electronAPI.addMusicFolder();

    if (result && result.success) {
        await renderLibraryLocations();
        showNotification('Folder added. Click "Rebuild Library" to scan it.', 'success', 3000);
    } else if (result && result.reason === 'duplicate') {
        showNotification('Folder already in library', 'warning', 2000);
    } else {
        showNotification('Failed to add folder', 'error', 2000);
    }
}

async function rebuildLibraryFromFolders() {
    if (!window.electronAPI || !window.electronAPI.rebuildFromFolders) {
        showNotification('Not available', 'warning', 2000);
        return;
    }

    const folders = await loadLibraryLocations();

    const confirmed = await showConfirmDialog({
        title: 'Save and Apply Music Folders',
        message: folders.length
            ? `Scan ${folders.length} selected folder(s) and update your music library?`
            : 'Remove all music folders and clear the current library?',
        okText: 'Apply',
        cancelText: 'Cancel'
    });

    if (!confirmed) return;

    showNotification(
        folders.length ? `Scanning ${folders.length} folder(s)...` : 'Clearing the music library...',
        'info',
        3000
    );

    const result = await window.electronAPI.rebuildFromFolders();

    if (result && result.success && Array.isArray(result.songs)) {
        SONGS_DATA.length = 0;
        Array.prototype.push.apply(SONGS_DATA, result.songs);

        clearGhostList(VIEWS.ALL_SONGS);
        clearGhostList(VIEWS.FAVORITES);
        clearGhostList(VIEWS.HISTORY);

        for (const key in activeSlotHighlights) {
            activeSlotHighlights[key] = null;
        }

        currentQueueIndex = -1;
        playbackQueue = [];
        audioElement.pause();
        audioElement.src = '';
        playButton.innerHTML = '<i class="fas fa-play"></i>';
        document.querySelector('.player-song-info').classList.remove('has-song');
        document.getElementById('player-title').textContent = 'No song selected';
        document.getElementById('player-artist').textContent = '—';
        document.getElementById('player-cover').src = PLACEHOLDER_IMAGE;

        updateQueueDisplay();
        updateAlbumArt();

        updateAllCounts();
        updateLeftPanelCounts();
        renderPlaylistsView();
        renderAlbumLeftPanelItems();
        renderArtistLeftPanelItems();
        renderLeftPanelMainList();

        if (currentView === VIEWS.ALL_SONGS) {
            const songs = getSongsForList(VIEWS.ALL_SONGS);
            renderSongsList(songs, VIEWS.ALL_SONGS);
            setupHeroSection(true, 'All Songs', songs.length, 'Playlist');
        }

        await renderLibraryLocations();

        showNotification(
            folders.length
                ? `Loaded ${result.songs.length} songs from ${folders.length} folder(s)`
                : 'Music library cleared',
            'success',
            4000
        );
    } else {
        const errorMsg = result ? result.reason || result.error || 'Unknown error' : 'No response';
        showNotification(`Failed to rebuild library: ${errorMsg}`, 'error', 4000);
    }
}

// Pixel-perfect swap: decode the new thumb off-screen first, then assign it, so a row never
// shows a half-decoded image, and clear any inline style left over from the placeholder stage.
function swapCoverSrc(img, url) {
    if (!img || !url) return;
    img.style.opacity = '';
    if (img.getAttribute('src') === url) return;
    const apply = () => {
        if (img.isConnected) img.src = url;
    };
    preloadCover(url).then(apply, apply);
}

// Left-panel album/artist rows have no <img> until a cover exists (they show an SVG), so they are
// patched in place. This is intentionally cheap (no getAlbums/getArtists) - the exact
// "most common cover" choice is re-derived by the full re-render when extraction completes.
function applyCoverToLeftPanelRow(playBtn, type, url) {
    const wrapper = playBtn.closest('.main-item-cover-wrapper');
    if (!wrapper) return;
    const existing = wrapper.querySelector('img');
    if (existing) return;
    const svg = wrapper.querySelector('.main-item-cover-svg');
    if (!svg) return;
    preloadCover(url).then(() => {
        if (!wrapper.isConnected || wrapper.querySelector('img')) return;
        const img = new Image();
        img.className = `main-item-cover-img ${type}-cover-img`;
        img.alt = '';
        img.decoding = 'sync';
        img.src = url;
        svg.replaceWith(img);
    });
}

function applyCoverBatchToUI(updates) {
    const leftItemByView = new Map();
    if (typeof leftPanelVirtualState !== 'undefined' && leftPanelVirtualState.currentItems) {
        for (const it of leftPanelVirtualState.currentItems) {
            if ((it.type === 'album' || it.type === 'artist') && it.viewId) leftItemByView.set(it.viewId, it);
        }
    }

    for (const update of updates) {
        const song = SONGS_DATA[update.id];
        if (!song) continue;
        song.cover = update.cover;
        song.largeCover = update.largeCover;

        // main list rows
        const img = document.querySelector(`#song-list .song-item[data-song-id="${update.id}"] .song-cover`);
        swapCoverSrc(img, update.cover);

        // left panel: album + artist rows this song belongs to
        const targets = [];
        if (song.album && String(song.album).trim() !== '') {
            targets.push(['album', generateConsistentId('a', String(song.album).trim())]);
        }
        for (const name of getArtistNamesForSong(song)) {
            targets.push(['artist', generateConsistentId('r', name)]);
        }
        for (const [type, viewId] of targets) {
            const item = leftItemByView.get(viewId);
            if (item && !item.cover) item.cover = update.cover; // rows rebuilt by scrolling pick it up
            const playBtns = document.querySelectorAll(
                `.left-panel-main-list .left-panel-cover-play-btn[data-view="${viewId}"]`
            );
            playBtns.forEach((btn) => applyCoverToLeftPanelRow(btn, type, update.cover));
        }
    }
}

function setupCoverStreamListeners() {
    if (typeof window === 'undefined') return;
    const api = window.electronAPI;
    if (!api || !api.onScanCoverBatch || window._coverStreamListenersAttached) return;
    window._coverStreamListenersAttached = true;

    let coverStreamActive = false;

    api.onScanCoverBatch((batch) => {
        if (typeof showCoverProgressNotification === 'function') {
            showCoverProgressNotification(batch.processed, batch.total, batch.found);
        }
        applyCoverBatchToUI(batch.updates || []);
    });

    api.onScanCoversComplete(() => {
        if (typeof completeCoverProgressNotification === 'function') {
            completeCoverProgressNotification();
        }
        if (typeof renderLeftPanelMainList === 'function') {
            renderLeftPanelMainList();
        }
    });
}

if (typeof window !== 'undefined') {
    setupCoverStreamListeners();
}

function changeMusicFolder() {
    if (!window.electronAPI || !window.electronAPI.changeMusicFolder) {
        showNotification('Not available in browser mode', 'warning', 2000);
        return;
    }

    showNotification('Selecting folder...', 'info', 5000);

    window.electronAPI
        .changeMusicFolder()
        .then((result) => {
            if (!result.success) {
                if (result.reason !== 'cancelled') {
                    showNotification('Failed to change folder', 'error', 3000);
                }
                return;
            }

            SONGS_DATA.length = 0;
            Array.prototype.push.apply(SONGS_DATA, result.songs);

            clearGhostList(VIEWS.ALL_SONGS);
            clearGhostList(VIEWS.FAVORITES);
            clearGhostList(VIEWS.HISTORY);

            for (const key in activeSlotHighlights) {
                activeSlotHighlights[key] = null;
            }

            currentQueueIndex = -1;
            playbackQueue = [];
            audioElement.pause();
            audioElement.src = '';
            playButton.innerHTML = '<i class="fas fa-play"></i>';
            playButton.setAttribute('title', 'Play');
            document.querySelector('.player-song-info').classList.remove('has-song');
            document.getElementById('player-title').textContent = 'No song selected';
            document.getElementById('player-artist').textContent = '—';
            document.getElementById('player-cover').src = PLACEHOLDER_IMAGE;

            updateQueueDisplay();
            updateAlbumArt();

            updateAllCounts();
            updateLeftPanelCounts();
            renderPlaylistsView();
            renderAlbumLeftPanelItems();
            renderArtistLeftPanelItems();
            renderLeftPanelMainList();

            updateAllCounts();
            if (currentView === VIEWS.ALL_SONGS) {
                const songs = getSongsForList(VIEWS.ALL_SONGS);
                renderSongsList(songs, VIEWS.ALL_SONGS);
                setupHeroSection(true, 'All Songs', songs.length, 'Playlist');
            }

            showNotification(`Loaded ${result.songs.length} songs from new folder`, 'success', 3000);
        })
        .catch((err) => {
            showNotification('Error changing folder', 'error', 3000);
        });
}

function deleteSearchHistoryEntry(sessionId) {
    let searchHistory = getStoredJson(STORAGE_KEYS.SEARCH_HISTORY, []);
    searchHistory = searchHistory.filter((entry) => entry.sessionId !== sessionId);
    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(searchHistory));

    if (currentView === VIEWS.SEARCH_HISTORY) {
        renderSearchHistoryView();
    }

    showNotification('Search removed from history', 'error', 2000);
}

// ==============================================================================
// IMPORT / EXPORT
// ==============================================================================
function exportAllData() {
    const data = {
        playlists: getPlaylists(),
        folders: getFolders(),
        favorites: getFavorites(),
        playHistory: getPlayHistory(),
        recentlyPlayed: getRecentlyPlayed(),
        searchHistory: getSearchHistory(),
        pinnedItems: getPinnedItems(),
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `music_player_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification('Data exported successfully', 'success', 2000);
}

function importAllData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                showImportChoiceModal(data, file.name);
            } catch (err) {
                showNotification('Invalid backup file', 'error', 2000);
            }
        };

        reader.readAsText(file);
    };

    input.click();
}

function showImportChoiceModal(data, filename) {
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closeImportChoiceModal);
    modal.onclick = (e) => e.stopPropagation();

    modal.innerHTML = `
                        <h3 class="playlist-modal-title">Import Data</h3>
                        <p style="color: var(--text-secondary); font-size: 13px; margin: 10px 0;">
                                File: ${escapeHtml(filename)}
                        </p>
                        <p style="color: var(--text-secondary); font-size: 13px; margin: 10px 0;">
                                How would you like to import?
                        </p>
                        <div class="playlist-modal-buttons" style="flex-direction: column; gap: 8px;">
                                <button onclick="doImportMerge(${JSON.stringify(data).replace(
                                    /"/g,
                                    '&quot;'
                                )}); closeImportChoiceModal();" class="playlist-modal-create-btn" style="width: 100%;">
                                        <i class="fas fa-plus"></i> Merge with existing data
                                </button>
                                <button onclick="doImportReplace(${JSON.stringify(data).replace(
                                    /"/g,
                                    '&quot;'
                                )}); closeImportChoiceModal();" class="playlist-modal-cancel-btn" style="width: 100%;">
                                        <i class="fas fa-sync-alt"></i> Replace all existing data
                                </button>
                        </div>
                `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function closeImportChoiceModal() {
    const modal = document.querySelector('.playlist-modal');
    const overlay = document.querySelector('.playlist-modal-overlay');
    if (modal) modal.remove();
    if (overlay) overlay.remove();
}

function doImportMerge(data) {
    if (data.playlists) {
        const existing = getPlaylists();
        const merged = [...existing];
        data.playlists.forEach((p) => {
            if (!merged.find((e) => e.id === p.id)) {
                merged.push(p);
            }
        });
        savePlaylists(merged);
    }
    if (data.favorites) {
        const existing = getFavorites();
        const merged = [...new Set([...existing, ...data.favorites])];
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(merged));
    }
    if (data.pinnedItems) {
        const existing = getPinnedItems();
        const merged = [...new Set([...existing, ...data.pinnedItems])];
        savePinnedItems(merged);
    }
    if (data.folders) {
        const existing = getFolders();
        const merged = [...existing];
        data.folders.forEach((f) => {
            if (!merged.find((e) => e.id === f.id)) {
                merged.push(f);
            }
        });
        saveFolders(merged);
    }
    finishImport();
}

function doImportReplace(data) {
    if (data.playlists) savePlaylists(data.playlists);
    if (data.favorites) localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(data.favorites));
    if (data.playHistory) localStorage.setItem(STORAGE_KEYS.PLAY_HISTORY, JSON.stringify(data.playHistory));
    if (data.recentlyPlayed) localStorage.setItem(STORAGE_KEYS.RECENTLY_PLAYED, JSON.stringify(data.recentlyPlayed));
    if (data.searchHistory) localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(data.searchHistory));
    if (data.pinnedItems) savePinnedItems(data.pinnedItems);
    if (data.folders) saveFolders(data.folders);
    finishImport();
}

function finishImport() {
    renderPlaylistsView();
    renderFoldersView();
    renderLeftPanelMainList();
    updateRecentCount();
    showNotification('Data imported successfully', 'success', 2000);
}

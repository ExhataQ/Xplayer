// ==============================================================================
// PINNED ITEMS & ITEM ORDER (global + per-folder)
// (split out of 03-storage.js, Phase 2 Checkpoint 5)
// ==============================================================================


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


// Phase 2 Checkpoint 3: the exact same "pinned items first (tied by pin order), then
// most-recently-played order, else stable" comparator was duplicated byte-for-byte in
// 04b-render-playlists-folders.js (x2), 04c-render-albums.js (x2), 04d-render-artists.js,
// 06a-context-menus.js, and 03c-playlists.js (x2) — 8 call sites total, only differing in
// how each item's id string is derived (idFn). Verified every call site's idFn before
// replacing it below; do not assume they're interchangeable if adding a new caller.
function sortByPinnedThenRecent(items, idFn, pinnedIds, playedOrder) {
    return [...items].sort((a, b) => {
        const aId = idFn(a);
        const bId = idFn(b);
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

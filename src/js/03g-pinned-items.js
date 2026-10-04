// ==============================================================================
// PINNED ITEMS & ITEM ORDER (global + per-folder)
// (split out of 03-storage.js)
// ==============================================================================
// Event-bus conversion: togglePinItem/movePlayedItemToTop/togglePinItemInFolder
// used to call renderLeftPanelMainList()/renderPlaylistsView()/showNotification()/
// etc. directly; that DOM work moved to 04j-pinned-items-events.js, which
// subscribes to the events emitted below. refreshLeftPanelAfterFolderPinChange()
// had zero external callers, so it was inlined into the 'folderPin:changed'
// subscriber rather than kept as a standalone function. Every function still
// called from outside this file (togglePinItem, movePlayedItemToTop,
// togglePinItemInFolder, isItemPinned, isItemPinnedInFolder, getFolderPinnedItems -
// called from 06a-context-menus.js, 10d-playback-song.js, 03h-folders.js,
// 06g-drag-drop-left-panel.js) kept its exact name and signature.


// ==============================================================================
// PINNED ITEMS & ITEM ORDER
// ==============================================================================
function getPinnedItems() {
    return storageReadJson(STORAGE_KEYS.PINNED_ITEMS, [], normalizeIdList);
}


function savePinnedItems(pinnedIds) {
    storageWriteJson(STORAGE_KEYS.PINNED_ITEMS, pinnedIds);
}


function isItemPinned(itemId) {
    const pinned = getPinnedItems();
    return pinned.includes(itemId);
}


function togglePinItem(itemId, itemName) {
    let pinned = getPinnedItems();
    let nowPinned;

    if (pinned.includes(itemId)) {
        pinned = pinned.filter((id) => id !== itemId);
        // Move to first position in unpinned section by updating played order
        let playedOrder = getPlayedItemOrder();
        playedOrder = playedOrder.filter((id) => id !== itemId);
        playedOrder.unshift(itemId);
        savePlayedItemOrder(playedOrder);
        nowPinned = false;
    } else {
        pinned.push(itemId);
        nowPinned = true;
    }

    savePinnedItems(pinned);
    emit('pinned:changed', { itemId, itemName, pinned: nowPinned });
}


function getPlayedItemOrder() {
    return storageReadJson(STORAGE_KEYS.PLAYED_ITEM_ORDER, [], normalizeStringList);
}


function savePlayedItemOrder(order) {
    storageWriteJson(STORAGE_KEYS.PLAYED_ITEM_ORDER, order);
}


// The exact same "pinned items first (tied by pin order), then
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
        emit('playedOrder:changed', { listId });
    }
}


// ==============================================================================
// FOLDER-SCOPED PINNED ITEMS
// ==============================================================================
function getFolderPinnedItemsMap() {
    return storageReadJson(STORAGE_KEYS.FOLDER_PINNED_ITEMS, {}, normalizePinnedMap);
}


function saveFolderPinnedItemsMap(map) {
    storageWriteJson(STORAGE_KEYS.FOLDER_PINNED_ITEMS, map);
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
    emit('folderPin:changed', { folderId, itemId, itemName, pinned: !isPinned });
}

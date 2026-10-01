// ==============================================================================
// PINNED ITEMS - UI REACTIONS
// ==============================================================================
// Subscribes to the events 03g-pinned-items.js emits and does the actual DOM
// work, moved here verbatim from togglePinItem/movePlayedItemToTop/
// togglePinItemInFolder (including the inlined body of the old
// refreshLeftPanelAfterFolderPinChange(), which had no other callers).

on('pinned:changed', (e) => {
    const { itemName, pinned } = e.detail;
    showNotification(pinned ? `"${itemName}" pinned` : `"${itemName}" unpinned`, pinned ? 'success' : 'info', 2000);

    renderLeftPanelMainList();

    // Refresh virtual scroll to reflect new pin order
    if (leftPanelVirtualState.enabled) {
        const newItems = getLeftPanelItemsArray();
        leftPanelVirtualState.currentItems = newItems;
        renderLeftPanelVisibleItems(false);
    }

    updateScrollbarById('left-panel-main-content');
});

on('playedOrder:changed', () => {
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
});

on('folderPin:changed', (e) => {
    const { folderId, itemName, pinned } = e.detail;
    showNotification(pinned ? `"${itemName}" pinned` : `"${itemName}" unpinned`, pinned ? 'success' : 'info', 2000);

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
});

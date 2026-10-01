// ==============================================================================
// FOLDERS - UI REACTIONS
// ==============================================================================
// Subscribes to the event 03h-folders.js emits and does the actual DOM work, moved
// here verbatim from createFolder()/deleteFolder(), which used to each carry a
// byte-identical copy of this block.

on('folder:listChanged', () => {
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
});

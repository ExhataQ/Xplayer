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
        refreshLeftPanelItems();
    }

    updateScrollbarById('left-panel-main-content');
});

// Nothing to register: this file only subscribes to events while it loads. The empty export makes it a module.
export {};

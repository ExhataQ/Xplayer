// ==============================================================================
// IMPORT / EXPORT - UI REACTIONS
// ==============================================================================
// Subscribes to 'data:imported', emitted at the end of doImportMerge()/
// doImportReplace() in 03l-import-export.js. This is the body of the old
// finishImport(), moved verbatim (it had no other callers).

on('data:imported', () => {
    renderPlaylistsView();
    renderFoldersView();
    renderLeftPanelMainList();
    updateRecentCount();
    showNotification('Data imported successfully', 'success', 2000);
});

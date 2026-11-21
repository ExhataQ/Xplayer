// ==============================================================================
// IMPORT / EXPORT - UI REACTIONS
// ==============================================================================
// Subscribes to 'data:imported', emitted at the end of doImportMerge()/
// doImportReplace() in 03l-import-export.js.

on('data:imported', (detail) => {
    renderPlaylistsView();
    renderFoldersView();
    renderLeftPanelMainList();
    updateRecentCount();
    // `stats` comes from remapBackup (backup-rules.js): songs of the file that this library does not have are left out, and the person is told.
    const missing = detail && detail.stats ? detail.stats.missing : 0;
    const contents = detail && detail.summary ? backupContentsText(detail.summary) : '';
    const done = contents ? `Data imported: ${contents}` : 'Data imported successfully'; // kept in the notification list, with what came in
    if (missing > 0) {
        showNotification(`${done}. ${missing} song${missing === 1 ? '' : 's'} from the backup ${missing === 1 ? 'was' : 'were'} not found in this library and left out.`, 'info', 6000);
    } else {
        showNotification(done, 'success', 3000);
    }
});

// Nothing to register: this file only subscribes to events while it loads. The empty export makes it a module.
export {};

'use strict';

// Event-bus call-sequence scenarios owned by Agent A: data (03*), 09, 99.
// Format and workflow: see helpers/sequence-suite.js.
// Spy only on UI functions that live in D's files; keep scenarios small (one reaction each).

const SPY = ['renderFoldersView', 'renderLeftPanelMainList', 'renderLeftPanelVisibleItems', 'updateScrollbarById', 'closeFolder', 'showNotification'];

const SCENARIOS = {
    // 09's confirmDeleteFolder() calls deleteFolder() (which now emits folder:listChanged and
    // refreshes the folder list) and then repeats a smaller copy of the same refresh itself.
    'folders: confirm-delete an empty folder from the folders list': {
        spy: SPY,
        setup: "window.showConfirmDialog = async () => true; const f = createFolder('Z'); window.__fid = f.id;",
        run: "await confirmDeleteFolder(window.__fid, 'Z');"
    },
    'folders: confirm-delete the folder that is currently open': {
        spy: SPY,
        setup: "window.showConfirmDialog = async () => true; const f = createFolder('Z'); window.__fid = f.id; currentOpenFolderId = f.id;",
        run: "await confirmDeleteFolder(window.__fid, 'Z');"
    }
};

module.exports = { SCENARIOS };

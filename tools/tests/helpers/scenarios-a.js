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

// changeMusicFolder() (03j) runs the same "replace SONGS_DATA, reset playback, redraw everything"
// work as resetLibraryAfterRebuild() + the 'library:rebuilt' subscriber, but as an inline copy.
const CHANGE_FOLDER_SPY = [
    'clearGhostList', 'updateQueueDisplay', 'updateAlbumArt', 'updateAllCounts', 'updateLeftPanelCounts',
    'renderPlaylistsView', 'renderAlbumLeftPanelItems', 'renderArtistLeftPanelItems', 'renderLeftPanelMainList',
    'renderSongsList', 'setupHeroSection', 'showNotification'
];
const CHANGE_FOLDER_SETUP = "window.__songs = SONGS_DATA.slice(0, 5); window.electronAPI = { changeMusicFolder: async () => ({ success: true, songs: window.__songs }) };";
const CHANGE_FOLDER_RUN = 'changeMusicFolder(); await new Promise((r) => setTimeout(r, 150));';

Object.assign(SCENARIOS, {
    'library: change music folder while All Songs is open': {
        spy: CHANGE_FOLDER_SPY,
        setup: CHANGE_FOLDER_SETUP + " currentView = VIEWS.ALL_SONGS;",
        run: CHANGE_FOLDER_RUN
    },
    'library: change music folder while another view is open': {
        spy: CHANGE_FOLDER_SPY,
        setup: CHANGE_FOLDER_SETUP + " currentView = VIEWS.FAVORITES;",
        run: CHANGE_FOLDER_RUN
    }
});

Object.assign(SCENARIOS, {
    // 03k: when the background cover scan finishes, the left panel is redrawn.
    'covers: background cover scan completes': {
        spy: ['completeCoverProgressNotification', 'renderLeftPanelMainList', 'renderLeftPanelVisibleItems', 'updateScrollbarById'],
        setup: "window._coverStreamListenersAttached = false; window.electronAPI = { onScanCoverBatch() {}, onScanCoversComplete(fn) { window.__done = fn; } }; setupCoverStreamListeners();",
        run: 'window.__done();'
    }
});

// 09: removing a song from a playlist through the context menu. removeSongFromPlaylist() (03c)
// saves and emits 'playlist:songCountChanged'; the wrapper then redraws.
const REMOVE_SONG_SPY = [
    'refreshCurrentViewAfterMutation', 'renderPlaylistDetailView', 'renderLeftPanelMainList',
    'updateScrollbarById', 'updateLeftPanelCounts', 'renderPlaylistsView'
];
Object.assign(SCENARIOS, {
    'playlists: remove a song while that playlist is open': {
        spy: REMOVE_SONG_SPY,
        setup: "const p = createPlaylist('R'); addSongToPlaylist(SONGS_DATA[0].id, p.id); window.__pid = p.id; window.__sid = SONGS_DATA[0].id; currentView = 'playlist-' + p.id;",
        run: 'removeSongFromPlaylistAndRefresh(window.__sid, window.__pid);'
    },
    'playlists: remove a song while another view is open': {
        spy: REMOVE_SONG_SPY,
        setup: "const p = createPlaylist('R'); addSongToPlaylist(SONGS_DATA[0].id, p.id); window.__pid = p.id; window.__sid = SONGS_DATA[0].id; currentView = VIEWS.ALL_SONGS;",
        run: 'removeSongFromPlaylistAndRefresh(window.__sid, window.__pid);'
    }
});

module.exports = { SCENARIOS };

// ==============================================================================
// PLAYLISTS - UI REACTIONS
// ==============================================================================
// Subscribes to the events 03c-playlists.js emits and does the actual DOM work
// for createPlaylist/deletePlaylist/deletePlaylistAndClose/addSongToPlaylist/removeSongFromPlaylist.

// Shared by createPlaylist() and deletePlaylist().
on('playlist:listChanged', () => {
    renderPlaylistsView();
    renderLeftPanelMainList();
    updateScrollbarById('left-panel-main-content');
});

// deletePlaylist() already emitted 'playlist:listChanged' (it redraws the left panel), so only the notification is left here.
on('playlist:deleted', (e) => {
    showNotification(`Playlist "${e.detail.playlistName}" deleted`, 'error', 2000);
});

on('playlist:songCountChanged', (e) => {
    const { playlistId, count } = e.detail;
    const playlistItem = document.querySelector(`.left-panel-main-item[data-view="playlist-${playlistId}"]`);
    if (playlistItem) {
        const countSpan = playlistItem.querySelector('.main-item-count');
        if (countSpan) {
            countSpan.textContent = `${count} ${count === 1 ? 'song' : 'songs'}`;
        }
    }
});

// 'playlist:songRemovedFromView' is emitted by removeSongFromPlaylistAndRefresh() (09), the
// context-menu "remove from playlist" action. It redraws the playlist view.
on('playlist:songRemovedFromView', (e) => {
    const { playlistId } = e.detail;

    if (currentView === `playlist-${playlistId}`) {
        refreshCurrentViewAfterMutation();
    } else {
        renderPlaylistDetailView(playlistId);
    }

    renderLeftPanelMainList();
    updateScrollbarById('left-panel-main-content');
    updateLeftPanelCounts();
});

// Nothing to register: this file only subscribes to events while it loads. The empty export makes it a module.
export {};

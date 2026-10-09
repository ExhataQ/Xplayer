// ==============================================================================
// UI SHELL ACTIONS (data-action handlers for markup the UI shell owns)
// ==============================================================================
// Names that the data-action attributes in build/music_player.html and in the 04e, 04f and
// 04g renderers may call (see core/LEGACY.md). Each entry calls the global function of the same
// name when the event happens, as a plain call with the arguments the inline handler passed.
// Like an inline handler that only called fn(), it calls fn without the element as `this` and
// ignores the return value (the bridge would treat a returned false as preventDefault).
// The functions live in other files that load later, so they are looked up at call time.
registerActions({
    goBack: function () {
        goBack(...arguments);
    },
    goForward: function () {
        goForward(...arguments);
    },
    performSearch: function () {
        performSearch(...arguments);
    },
    showAddLinkDialog: function () {
        showAddLinkDialog(...arguments);
    },
    toggleOnlineLyricsSearchView: function () {
        toggleOnlineLyricsSearchView(...arguments);
    },
    toggleNotificationPanel: function () {
        toggleNotificationPanel(...arguments);
    },
    toggleSettingsPanel: function () {
        toggleSettingsPanel(...arguments);
    },
    minimizeApp: function () {
        minimizeApp(...arguments);
    },
    maximizeApp: function () {
        maximizeApp(...arguments);
    },
    closeApp: function () {
        closeApp(...arguments);
    },
    clearAllNotifications: function () {
        clearAllNotifications(...arguments);
    },
    toggleLeftPanelCollapse: function () {
        toggleLeftPanelCollapse(...arguments);
    },
    closeFolder: function () {
        closeFolder(...arguments);
    },
    showCreateItemDialog: function () {
        showCreateItemDialog(...arguments);
    },
    focusLeftPanelSearch: function () {
        focusLeftPanelSearch(...arguments);
    },
    performLeftPanelSearch: function () {
        performLeftPanelSearch(...arguments);
    },
    handleLeftPanelSearchBlur: function () {
        handleLeftPanelSearchBlur(...arguments);
    },
    clearLeftPanelSearch: function () {
        clearLeftPanelSearch(...arguments);
    },
    handleHeroClear: function () {
        handleHeroClear(...arguments);
    },
    togglePlayAllFromCurrentView: function () {
        togglePlayAllFromCurrentView(...arguments);
    },
    toggleShuffleFromSubhero: function () {
        toggleShuffleFromSubhero(...arguments);
    },
    focusSubheroSearch: function () {
        focusSubheroSearch(...arguments);
    },
    performSubheroSearch: function () {
        performSubheroSearch(...arguments);
    },
    handleSubheroSearchBlur: function () {
        handleSubheroSearchBlur(...arguments);
    },
    clearSubheroSearch: function () {
        clearSubheroSearch(...arguments);
    },
    toggleRightPanelCollapse: function () {
        toggleRightPanelCollapse(...arguments);
    },
    switchToQueuePanel: function () {
        switchToQueuePanel(...arguments);
    },
    switchToRecentlyPlayedPanel: function () {
        switchToRecentlyPlayedPanel(...arguments);
    },
    toggleRightPanel: function () {
        toggleRightPanel(...arguments);
    },
    navigateToCurrentSourceView: function () {
        navigateToCurrentSourceView(...arguments);
    },
    navigateToCurrentArtist: function () {
        navigateToCurrentArtist(...arguments);
    },
    switchToLyrics: function () {
        switchToLyrics(...arguments);
    },
    scrollTrackLyricsToActive: function () {
        scrollTrackLyricsToActive(...arguments);
    },
    toggleTrackLyricsExpand: function () {
        toggleTrackLyricsExpand(...arguments);
    },
    openTagsTab: function () {
        openTagsTab(...arguments);
    },
    toggleTimeDisplay: function () {
        toggleTimeDisplay(...arguments);
    },
    toggleMute: function () {
        toggleMute(...arguments);
    },
    clearRecentlyPlayed: function () {
        clearRecentlyPlayed(...arguments);
    },
    clearSearchHistory: function () {
        clearSearchHistory(...arguments);
    },
    openSearchHistoryChild: function () {
        openSearchHistoryChild(...arguments);
    },
    setLyricsDisplayMode: function () {
        setLyricsDisplayMode(...arguments);
    },
    openLyricsEditor: function () {
        openLyricsEditor(...arguments);
    },
    openSyncEditor: function () {
        openSyncEditor(...arguments);
    },
    importLrcFile: function () {
        importLrcFile(...arguments);
    },
    openLrcPasteDialog: function () {
        openLrcPasteDialog(...arguments);
    },
    openOnlineLyricsView: function () {
        openOnlineLyricsView(...arguments);
    },
    selectSyncedVariant: function () {
        selectSyncedVariant(...arguments);
    },
    renameSyncedVariant: function () {
        renameSyncedVariant(...arguments);
    },
    deleteSyncedVariant: function () {
        deleteSyncedVariant(...arguments);
    }
});

// ------------------------------------------------------------------------------
// Left-panel items, album cards, song rows and shell controls (D-05, slices 2 and 3)
// ------------------------------------------------------------------------------
// Renderers that build elements with createElement copy the attributes of an actionAttrs(...)
// string onto the element with this helper.
function applyActionAttrs(element, attributeString) {
    const holder = document.createElement('template');
    holder.innerHTML = `<i ${attributeString}></i>`;
    for (const attribute of holder.content.firstChild.attributes) element.setAttribute(attribute.name, attribute.value);
}

const ITEM_CONTEXT_MENUS = {
    playlist: (event, id) => showPlaylistContextMenu(event, id),
    folder: (event, id) => showFolderContextMenu(event, id),
    album: (event, id) => showAlbumContextMenu(event, id),
    artist: (event, id) => showArtistContextMenu(event, id),
    special: (event, id, name) => showSpecialItemContextMenu(event, id, name)
};

registerActions({
    // Context menu on a left-panel item or album card; the old attribute ended with "return false".
    itemContextMenu: function (event, kind, ...args) {
        ITEM_CONTEXT_MENUS[kind](event, ...args);
        return false;
    },
    // Same, for the places where the old handler called event.preventDefault() first.
    itemContextMenuPrevent: function (event, kind, ...args) {
        event.preventDefault();
        ITEM_CONTEXT_MENUS[kind](event, ...args);
        return false;
    },
    openAlbumOnEnter: function (event, albumId) {
        if (event.key === 'Enter') openAlbum(albumId);
    },
    // Right-panel rows (queue, recent, online-lyrics picker): the menu may take extra arguments such as { queueIndex }.
    rightPanelItemMenu: function (event, ...args) {
        event.preventDefault();
        showContextMenu(event, ...args);
    },
    addSongToQueueNext: function () {
        addSongToQueueNext(...arguments);
    },
    playFromQueue: function () {
        playFromQueue(...arguments);
    },
    selectOnlineLyricsPickerSong: function () {
        selectOnlineLyricsPickerSong(...arguments);
    },
    songContextMenu: function (event, songId) {
        event.preventDefault();
        showContextMenu(event, songId);
    },
    playSongFromListOnEnter: function (event, songId, listId, index) {
        if (event.key === 'Enter') playSongFromList(songId, listId, index);
    },
    // Cover images (called with the image as this): fall back to the placeholder once (the old handler cleared onerror first).
    useImagePlaceholder: function () {
        const image = this;
        image.removeAttribute('data-action-error');
        image.src = PLACEHOLDER_IMAGE;
    },
    setImagePlaceholder: function () {
        const image = this;
        image.removeAttribute('data-action-error');
        image.src = PLACEHOLDER_IMAGE;
    },
    openPlaylist: function () {
        openPlaylist(...arguments);
    },
    openFolder: function () {
        openFolder(...arguments);
    },
    openAlbum: function () {
        openAlbum(...arguments);
    },
    openArtist: function () {
        openArtist(...arguments);
    },
    togglePlaylistsFilter: function () {
        togglePlaylistsFilter(...arguments);
    },
    toggleArtistsFilter: function () {
        toggleArtistsFilter(...arguments);
    },
    toggleAlbumsFilter: function () {
        toggleAlbumsFilter(...arguments);
    },
    selectSongItem: function () {
        selectSongItem(...arguments);
    },
    playSongFromList: function () {
        playSongFromList(...arguments);
    },
    handleNumberCellClick: function () {
        handleNumberCellClick(...arguments);
    },
    toggleFavorite: function () {
        toggleFavorite(...arguments);
    },
    removeNotificationItem: function () {
        removeNotificationItem(...arguments);
    },
    showRightPanelContextMenu: function () {
        showRightPanelContextMenu(...arguments);
    },
    showSubheroContextMenu: function () {
        showSubheroContextMenu(...arguments);
    },
    openMetadataEditor: function () {
        openMetadataEditor(...arguments);
    },
    closeExtendedInfoPanel: function () {
        closeExtendedInfoPanel(...arguments);
    },
    closeImageViewer: function () {
        closeImageViewer(...arguments);
    },
    startSeek: function () {
        startSeek(...arguments);
    },
    setVolume: function () {
        setVolume(...arguments);
    },
    toggleFolderExpandedFromUI: function () {
        toggleFolderExpandedFromUI(...arguments);
    },
    showAlbumContextMenu: function () {
        showAlbumContextMenu(...arguments);
    },
    deleteSearchHistoryEntry: function () {
        deleteSearchHistoryEntry(...arguments);
    }
});

// Dialog buttons built by 06b-modals.js.
registerActions({
    createItemChoice: function (kind) {
        closeCreateItemModal();
        if (kind === 'playlist') showCreatePlaylistDialog();
        else showCreateFolderDialog();
    },
    pickEditPlaylistCover: function () {
        document.getElementById('edit-playlist-cover-input').click();
    },
    // The edit dialog creates this function on window while it is open and removes it on close.
    handleEditPlaylistCover: function () {
        window.handleEditPlaylistCover(...arguments);
    },
    closePlaylistModal: function () {
        closePlaylistModal(...arguments);
    },
    confirmCreatePlaylist: function () {
        confirmCreatePlaylist(...arguments);
    },
    confirmCreateFolder: function () {
        confirmCreateFolder(...arguments);
    },
    confirmEditPlaylist: function () {
        confirmEditPlaylist(...arguments);
    },
    confirmEditFolder: function () {
        confirmEditFolder(...arguments);
    },
    closeAddLinkModal: function () {
        closeAddLinkModal(...arguments);
    },
    closePlayedDataModal: function () {
        closePlayedDataModal(...arguments);
    },
    playFromUrl: function () {
        playFromUrl(...arguments);
    }
});

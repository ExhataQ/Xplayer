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

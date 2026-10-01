// ==============================================================================
// STATE NAVIGATION
// ==============================================================================
// Current view, search text and back/forward history.
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

function setCurrentView(value) {
    currentView = value;
    emit('view:changed', { view: value });
}

function setSearchQuery(value) {
    searchQuery = value;
}

function setHistoryNavigationIndex(value) {
    historyNavigationIndex = value;
}

function setPlaybackHistoryStack(value) {
    playbackHistoryStack = value;
}

function setIsNavigatingHistory(value) {
    isNavigatingHistory = value;
}

function setLyricsPreView(value) {
    lyricsPreView = value;
}

function setLyricsPreScrollTop(value) {
    lyricsPreScrollTop = value;
}

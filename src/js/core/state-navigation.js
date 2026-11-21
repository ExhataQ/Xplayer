// ==============================================================================
// STATE NAVIGATION
// ==============================================================================
// Current view, search text and back/forward history.
// Setters only: each one assigns a variable that is declared in another file. Listed in core/SETTERS.md.

export function setCurrentView(value) {
    currentView = value;
    emit('view:changed', { view: value });
}

export function setSearchQuery(value) {
    searchQuery = value;
}

export function setHistoryNavigationIndex(value) {
    historyNavigationIndex = value;
}

export function setPlaybackHistoryStack(value) {
    playbackHistoryStack = value;
}

export function setIsNavigatingHistory(value) {
    isNavigatingHistory = value;
}

export function setLyricsPreView(value) {
    lyricsPreView = value;
}

export function setLyricsPreScrollTop(value) {
    lyricsPreScrollTop = value;
}

// Other files and inline handlers call these by name, so they are registered on window.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        setCurrentView,
        setSearchQuery,
        setHistoryNavigationIndex,
        setPlaybackHistoryStack,
        setIsNavigatingHistory,
        setLyricsPreView,
        setLyricsPreScrollTop
    });
}

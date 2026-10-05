// ==============================================================================
// STATE NAVIGATION
// ==============================================================================
// Current view, search text and back/forward history.
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

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

// Classic scripts and inline handlers still call these by name; registered until the final flip.
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

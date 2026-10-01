// ==============================================================================
// SEARCH HISTORY
// (split out of 03-storage.js, Phase 2 Checkpoint 5)
// ==============================================================================
// Event-bus conversion: clearSearchHistory()/deleteSearchHistoryEntry() used to call
// renderSearchHistoryView() and showNotification() directly; that moved to
// 04l-search-history-events.js. Both keep their exact names and signatures.


// ==============================================================================
// SEARCH HISTORY
// ==============================================================================
function getSearchHistory() {
    return getStoredJson(STORAGE_KEYS.SEARCH_HISTORY, []);
}


function saveSearchToHistory(searchQuery, searchSessionId, resultCount) {
    let searchHistory = getStoredJson(STORAGE_KEYS.SEARCH_HISTORY, []);

    const searchEntry = {
        sessionId: searchSessionId,
        query: searchQuery,
        resultCount: resultCount,
        timestamp: Date.now(),
        displayTime: new Date().toLocaleString()
    };

    searchHistory = searchHistory.filter((entry) => entry.sessionId !== searchSessionId);
    searchHistory.unshift(searchEntry);

    if (searchHistory.length > MAX_SEARCH_HISTORY) {
        searchHistory = searchHistory.slice(0, MAX_SEARCH_HISTORY);
    }

    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(searchHistory));
}


async function clearSearchHistory() {
    const confirmed = await showConfirmDialog({
        title: 'Clear Search History',
        message: 'Clear all search history? This cannot be undone.',
        okText: 'Clear',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
        emit('searchHistory:cleared');
    }
}


function deleteSearchHistoryEntry(sessionId) {
    let searchHistory = getStoredJson(STORAGE_KEYS.SEARCH_HISTORY, []);
    searchHistory = searchHistory.filter((entry) => entry.sessionId !== sessionId);
    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(searchHistory));
    emit('searchHistory:entryDeleted', { sessionId });
}

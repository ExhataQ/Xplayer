// ==============================================================================
// SEARCH HISTORY
// (split out of 03-storage.js)
// ==============================================================================
// Event-bus conversion: clearSearchHistory()/deleteSearchHistoryEntry() used to call
// renderSearchHistoryView() and showNotification() directly; that moved to
// 04l-search-history-events.js. Both keep their exact names and signatures.


// ==============================================================================
// SEARCH HISTORY
// ==============================================================================
function getSearchHistory() {
    return storageReadJson(STORAGE_KEYS.SEARCH_HISTORY, [], normalizeObjectList);
}


function saveSearchToHistory(searchQuery, searchSessionId, resultCount) {
    let searchHistory = storageReadJson(STORAGE_KEYS.SEARCH_HISTORY, [], normalizeObjectList);

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

    storageWriteJson(STORAGE_KEYS.SEARCH_HISTORY, searchHistory);
}


async function clearSearchHistory() {
    const confirmed = await showConfirmDialog({
        title: 'Clear Search History',
        message: 'Clear all search history? This cannot be undone.',
        okText: 'Clear',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        storageRemove(STORAGE_KEYS.SEARCH_HISTORY);
        emit('searchHistory:cleared');
    }
}


function deleteSearchHistoryEntry(sessionId) {
    let searchHistory = storageReadJson(STORAGE_KEYS.SEARCH_HISTORY, [], normalizeObjectList);
    searchHistory = searchHistory.filter((entry) => entry.sessionId !== sessionId);
    storageWriteJson(STORAGE_KEYS.SEARCH_HISTORY, searchHistory);
    emit('searchHistory:entryDeleted', { sessionId });
}

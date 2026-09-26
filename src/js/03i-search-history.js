// ==============================================================================
// SEARCH HISTORY
// (split out of 03-storage.js, Phase 2 Checkpoint 5)
// ==============================================================================


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

        if (currentView === VIEWS.SEARCH_HISTORY) {
            renderSearchHistoryView();
        }

        showNotification('Search history cleared', 'success', 3000);
    }
}


function deleteSearchHistoryEntry(sessionId) {
    let searchHistory = getStoredJson(STORAGE_KEYS.SEARCH_HISTORY, []);
    searchHistory = searchHistory.filter((entry) => entry.sessionId !== sessionId);
    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(searchHistory));

    if (currentView === VIEWS.SEARCH_HISTORY) {
        renderSearchHistoryView();
    }

    showNotification('Search removed from history', 'error', 2000);
}

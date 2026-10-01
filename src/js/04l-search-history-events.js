// ==============================================================================
// SEARCH HISTORY - UI REACTIONS
// ==============================================================================
// Subscribes to the events 03i-search-history.js emits. The DOM/render/notification
// code below is moved verbatim from clearSearchHistory()/deleteSearchHistoryEntry().

on('searchHistory:cleared', () => {
    if (currentView === VIEWS.SEARCH_HISTORY) {
        renderSearchHistoryView();
    }

    showNotification('Search history cleared', 'success', 3000);
});

on('searchHistory:entryDeleted', () => {
    if (currentView === VIEWS.SEARCH_HISTORY) {
        renderSearchHistoryView();
    }

    showNotification('Search removed from history', 'error', 2000);
});

// ==============================================================================
// RECENTS & HISTORY - UI REACTIONS
// ==============================================================================
// Subscribes to the events 03e-recents-history.js emits and does the actual DOM
// work, so 03e itself has zero DOM dependency. A different UI layer (e.g. the UI
// Playground) can subscribe to the same events with its own rendering instead of
// this file, without 03e changing at all.
//
// Each handler below is exactly the DOM-touching code that used to live inline in
// 03e's saveToRecentlyPlayed/updateRecentCount/clearRecentlyPlayed/
// saveToPlayHistory/clearPlayHistory - moved here verbatim, not rewritten.

on('recents:count-changed', (e) => {
    const countElement = document.querySelector('.left-panel-item[onclick*="recent"] .song-count');
    if (countElement) {
        countElement.textContent = e.detail.count;
    }
});

on('recents:added', () => {
    const recentPanel = document.getElementById('recently-played-content');
    if (recentPanel && recentPanel.classList.contains('active')) {
        renderPortableRecentlyPlayed();
    }
});

on('recents:cleared', () => {
    if (currentView === VIEWS.RECENT) {
        renderRecentlyPlayed();
        setTimeout(() => updateExternalScrollbar(), 100);
    }

    const recentPanel = document.getElementById('recently-played-content');
    if (recentPanel && recentPanel.classList.contains('active')) {
        renderPortableRecentlyPlayed();
    }

    showNotification('Recently played list cleared', 'success', 3000);
});

on('history:added', () => {
    if (currentView === VIEWS.HISTORY) {
        renderHistoryView();
    }
});

on('history:cleared', () => {
    if (currentView === VIEWS.HISTORY) {
        showHeroSection(true);
        updateHeroSection('Recents', 0, 'Playlist', 'History');
        renderHistoryView();
        setTimeout(() => {
            if (typeof updateExternalScrollbar === 'function') {
                updateExternalScrollbar();
            }
        }, 100);
    }

    showNotification('Play history cleared', 'success', 3000);
});

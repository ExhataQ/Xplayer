// ==============================================================================
// UI RENDER - LYRICS VIEW (the empty base page)
// ==============================================================================
// The main view does not show lyrics: they are read in the right panel (ui-next/views/playback/right-panel-content.js). The Lyrics
// item of the rail is Find, Batch, Write and Sync (ui-next/views/tools/lyrics.js); Find and Batch draw their own pages (lyrics/19).
// The engine's 'lyrics' page is only the blank page those modes start from, so it draws nothing: it hides the song list and empties
// the page root. (It used to draw the lyrics with a Synced / Plain toggle, Import and Paste buttons and a version list, which showed
// for a moment before the shell moved on to Find, and stayed visible in some states.)
export function renderLyricsView() {
    // 'lyrics:changed' is also sent while another page is open (Find, Batch, the editors, any other view); drawing then would hide that
    // page. So this only acts on its own view.
    if (typeof currentView !== 'undefined' && currentView !== VIEWS.LYRICS) return;
    const songListContainer = document.getElementById('song-list-container');
    if (songListContainer) songListContainer.style.display = 'none';
    const container = document.getElementById('lyrics-view-root');
    if (container) {
        container.replaceChildren();
        container.style.display = 'none';
    }
    syncedLyricsState.entries = null;
    syncedLyricsState.lineElements = [];
    syncedLyricsState.activeIndex = -1;
    resetSyncedLyricsFollowState();
}

export function teardownLyricsView() {
    const container = document.getElementById('lyrics-view-root');
    if (container) container.style.display = 'none';
    const lyricsToggleBtn = document.getElementById('lyrics-toggle-btn');
    if (lyricsToggleBtn) lyricsToggleBtn.classList.remove('active');
    if (typeof resetSyncedLyricsFollowState === 'function') {
        resetSyncedLyricsFollowState();
    }
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        renderLyricsView,
        teardownLyricsView
    });
}

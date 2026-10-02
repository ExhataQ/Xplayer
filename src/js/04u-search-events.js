// ==============================================================================
// SEARCH - UI REACTIONS
// ==============================================================================
// Subscribes to the events 08h-panel-search.js emits and does the DOM work, moved here
// unchanged from performSearchNow(), performSubheroSearch() and performLeftPanelSearch().
// Order inside one search is kept by the emitters: summaryChanged (hero) comes before
// resultsChanged (list), exactly as setupHeroSection() came before renderSongsList().

// The visible song list was replaced by a new set of songs (main search, subhero filter).
on('search:resultsChanged', (e) => {
    const { view, songs } = e.detail;
    renderSongsList(songs, view);
    reapplyHighlightAfterFilter(view, songs);
    reapplySelectionAfterFilter(view, songs);
});

// The search header (hero) now shows a new query, result count and search session.
on('search:summaryChanged', (e) => {
    const { query, count, sessionId } = e.detail;
    setupHeroSection(true, `"${escapeHtml(query)}"`, count, 'Search Results', sessionId, false);
    updateHeroCover(VIEWS.SEARCH_ITEMS);
});

// The left panel search box was emptied: restore the full list.
on('leftPanelSearch:cleared', () => {
    renderLeftPanelMainList();
});

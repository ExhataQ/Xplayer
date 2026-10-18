// search-bridge (task B-04): the one place the search view touches the engine. The engine's search is driven by its hidden
// #search-input (ui/08h performSearchNow reads it), and it draws the results into the song list, so this file sets that
// input's value and calls the engine's own search functions. Scoring, history entries and result lists are the engine's.

const engine = () => window;
const input = () => document.getElementById('search-input');

/** Searches for `text`: empty text goes back to All Songs at once, anything else is debounced like the old search box. */
export function runSearch(text) {
    const box = input();
    if (!box) return;
    box.value = text;
    if (text.trim() === '') engine().performSearchNow();
    else engine().performSearch();
}

/** Recent searches, newest first: [{ sessionId, query, resultCount, timestamp }]. */
export const recentSearches = () => (typeof engine().getSearchHistory === 'function' ? engine().getSearchHistory() : []);

/** Shows the saved results of one recent search. */
export const openRecentSearch = (entry) => engine().openSearchHistoryChild(String(entry.sessionId), entry.query);

export const deleteRecentSearch = (entry) => engine().deleteSearchHistoryEntry(entry.sessionId);

/** Asks first (the engine's dialog), then clears all recent searches. */
export const clearRecentSearches = () => engine().clearSearchHistory();

/** Forgets the current query in the engine (used when the search view is left). */
export const resetSearch = () => {
    if (typeof engine().resetSearchState === 'function') engine().resetSearchState();
};

/** Calls `callback` whenever the recent-search list may have changed. Returns an unsubscribe function. */
export function onRecentSearchesChange(callback) {
    if (typeof engine().on !== 'function') return () => {};
    const stops = ['search:summaryChanged', 'searchHistory:cleared', 'searchHistory:entryDeleted'].map((name) => engine().on(name, callback));
    return () => stops.forEach((stop) => stop());
}

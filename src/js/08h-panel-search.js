// ==============================================================================
// SEARCH PANEL
// ==============================================================================
function resetSearchState() {
    const searchInput = getCachedEl('search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    searchQuery = '';
    currentSearchSessionId = null;
}

function resetSubheroSearch() {
    const input = getCachedEl('subhero-search-input');
    if (input) {
        input.value = '';
        input.classList.remove('active');
    }
    const wrapper = getCachedEl('subhero-search-wrapper');
    if (wrapper) {
        wrapper.classList.remove('expanded');
        wrapper.classList.add('collapsed');
        wrapper.onmousedown = null;
    }
}

// A typing burst in the main search box is ONE search-history entry: while the user keeps editing the
// same search, that entry is updated instead of a new one being created on every pause.
let searchTypingSessionId = null;
const SEARCH_DEBOUNCE_MS = 300;

// Phase 2 Checkpoint 2: performSearch is the debounced entry point every keystroke
// calls; performSearchNow is the actual search logic, unchanged, just renamed and
// no longer responsible for its own timer bookkeeping.
function performSearchNow() {
    searchQuery = getCachedEl('search-input').value.toLowerCase().trim();

    if (searchQuery === '') {
        searchTypingSessionId = null;
        pushViewToHistory(VIEWS.ALL_SONGS);
        currentView = VIEWS.ALL_SONGS;
        currentSearchSessionId = null;
        const allSongs = getSongsForList(VIEWS.ALL_SONGS);
        emit('search:resultsChanged', { view: VIEWS.ALL_SONGS, songs: allSongs });
        getCachedEl('all-songs-count').textContent = allSongs.length;
        resetLeftPanelActiveState();
        activateLeftPanelItem(VIEWS.ALL_SONGS);
    } else {
        const filteredSongs = getSongsForList(VIEWS.SEARCH);

        pushViewToHistory(VIEWS.SEARCH_ITEMS);
        currentView = VIEWS.SEARCH_ITEMS;

        const continuingSearch =
            currentSearchSessionId !== null && currentSearchSessionId === searchTypingSessionId;
        if (!continuingSearch) {
            currentSearchSessionId = 'Search' + Date.now();
            searchTypingSessionId = currentSearchSessionId;
        }
        ghostLists[VIEWS.SEARCH] = [currentSearchSessionId];

        ghostLists[VIEWS.SEARCH_ITEMS] = [];
        for (let i = 0; i < filteredSongs.length; i++) {
            ghostLists[VIEWS.SEARCH_ITEMS].push(`SearchItem${String(i + 1).padStart(5, '0')}`);
        }
        nextSearchItemSlotId = filteredSongs.length + 1;

        saveSearchToHistory(searchQuery, currentSearchSessionId, filteredSongs.length);

        showTracklistHeader(true);
        emit('search:summaryChanged', {
            query: searchQuery,
            count: filteredSongs.length,
            sessionId: currentSearchSessionId
        });

        const countElement = getCachedEl('all-songs-count');
        if (countElement) {
            countElement.textContent = filteredSongs.length;
        }
        emit('search:resultsChanged', { view: VIEWS.SEARCH_ITEMS, songs: filteredSongs });

        resetLeftPanelActiveState();
    }

    setTimeout(() => {
        updateExternalScrollbar();
    }, 100);
}
const performSearch = debounce(performSearchNow, SEARCH_DEBOUNCE_MS);

function focusSubheroSearch() {
    const input = getCachedEl('subhero-search-input');
    const wrapper = getCachedEl('subhero-search-wrapper');
    if (!input) return;
    if (input.classList.contains('active')) return;
    input.classList.add('active');
    input.focus();
    if (wrapper) {
        wrapper.classList.remove('collapsed');
        wrapper.classList.add('expanded');
        wrapper.onmousedown = function (e) {
            input.focus();
        };
    }
}

function clearSubheroSearch() {
    const input = getCachedEl('subhero-search-input');
    if (!input) return;
    input.value = '';
    performSubheroSearch();
    input.focus();
}

function handleSubheroSearchBlur() {
    setTimeout(() => {
        const input = getCachedEl('subhero-search-input');
        const wrapper = getCachedEl('subhero-search-wrapper');
        const activeEl = document.activeElement;
        if (!input) return;
        if (activeEl === input) return;
        if (input.value.trim() === '') {
            input.classList.remove('active');
            if (wrapper) {
                wrapper.classList.remove('expanded');
                wrapper.classList.add('collapsed');
                wrapper.onmousedown = null;
            }
        }
    }, 100);
}

function performSubheroSearch() {
    const input = getCachedEl('subhero-search-input');
    const clearBtn = document.getElementById('subhero-search-clear');
    if (!input) return;
    const query = input.value.toLowerCase().trim();
    const songs = getSongsForList(currentView);

    if (clearBtn) {
        if (input.value.length > 0) {
            clearBtn.classList.add('has-text');
        } else {
            clearBtn.classList.remove('has-text');
        }
    }

    if (query === '') {
        emit('search:resultsChanged', { view: currentView, songs });
        return;
    }

    // rank: false - filtering an album/playlist must keep that list's own order
    const filtered = searchSongs(songs, query, { rank: false });

    emit('search:resultsChanged', { view: currentView, songs: filtered });
}

function focusLeftPanelSearch() {
    const input = getCachedEl('left-panel-search-input');
    const wrapper = getCachedEl('left-panel-search-wrapper');
    if (!input) return;
    if (input.classList.contains('active')) return;
    input.classList.add('active');
    input.focus();
    if (wrapper) {
        wrapper.classList.remove('collapsed');
        wrapper.classList.add('expanded');
        wrapper.onmousedown = function (e) {
            input.focus();
        };
    }
}

function clearLeftPanelSearch() {
    const input = getCachedEl('left-panel-search-input');
    if (!input) return;
    input.value = '';
    performLeftPanelSearch();
    input.focus();
}

function handleLeftPanelSearchBlur() {
    setTimeout(() => {
        const input = getCachedEl('left-panel-search-input');
        const wrapper = getCachedEl('left-panel-search-wrapper');
        const activeEl = document.activeElement;
        if (!input) return;
        if (activeEl === input) return;
        if (input.value.trim() === '') {
            input.classList.remove('active');
            if (wrapper) {
                wrapper.classList.remove('expanded');
                wrapper.classList.add('collapsed');
                wrapper.onmousedown = null;
            }
        }
    }, 100);
}

function performLeftPanelSearch() {
    const input = getCachedEl('left-panel-search-input');
    const clearBtn = document.getElementById('left-panel-search-clear');
    if (!input) return;
    const query = input.value.toLowerCase().trim();

    if (clearBtn) {
        if (input.value.length > 0) {
            clearBtn.classList.add('has-text');
        } else {
            clearBtn.classList.remove('has-text');
        }
    }

    const leftPanelMainList = document.querySelector('.left-panel-main-list');
    if (!leftPanelMainList) return;

    const allItems = leftPanelMainList.querySelectorAll('.left-panel-main-item');

    if (query === '') {
        allItems.forEach((item) => {
            item.style.display = '';
        });
        emit('leftPanelSearch:cleared');
        return;
    }

    allItems.forEach((item) => {
        const title = item.querySelector('.main-item-title');
        const subtitle = item.querySelector('.main-item-subtitle');
        const itemText = (title ? title.textContent : '') + ' ' + (subtitle ? subtitle.textContent : '');

        if (normalizeSearchText(itemText).includes(normalizeSearchText(query))) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });

    updateScrollbarById('left-panel-main-content');
}

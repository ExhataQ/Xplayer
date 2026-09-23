// ==============================================================================
// SEARCH PANEL
// ==============================================================================
function resetSearchState() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    searchQuery = '';
    currentSearchSessionId = null;
}

function resetSubheroSearch() {
    const input = document.getElementById('subhero-search-input');
    if (input) {
        input.value = '';
        input.classList.remove('active');
    }
    const wrapper = document.getElementById('subhero-search-wrapper');
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

function performSearch() {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
        searchQuery = document.getElementById('search-input').value.toLowerCase().trim();

        if (searchQuery === '') {
            searchTypingSessionId = null;
            pushViewToHistory('all-songs');
            currentView = 'all-songs';
            currentSearchSessionId = null;
            const allSongs = getSongsForList('all-songs');
            renderSongsList(allSongs, 'all-songs');
            reapplyHighlightAfterFilter('all-songs', allSongs);
            reapplySelectionAfterFilter('all-songs', allSongs);
            document.getElementById('all-songs-count').textContent = allSongs.length;
            resetLeftPanelActiveState();
            activateLeftPanelItem('all-songs');
        } else {
            const filteredSongs = getSongsForList('search');

            pushViewToHistory('search-items');
            currentView = 'search-items';

            const continuingSearch =
                currentSearchSessionId !== null && currentSearchSessionId === searchTypingSessionId;
            if (!continuingSearch) {
                currentSearchSessionId = 'Search' + Date.now();
                searchTypingSessionId = currentSearchSessionId;
            }
            ghostLists['search'] = [currentSearchSessionId];

            ghostLists['search-items'] = [];
            for (let i = 0; i < filteredSongs.length; i++) {
                ghostLists['search-items'].push(`SearchItem${String(i + 1).padStart(5, '0')}`);
            }
            nextSearchItemSlotId = filteredSongs.length + 1;

            saveSearchToHistory(searchQuery, currentSearchSessionId, filteredSongs.length);

            showTracklistHeader(true);
            setupHeroSection(
                true,
                `"${escapeHtml(searchQuery)}"`,
                filteredSongs.length,
                'Search Results',
                currentSearchSessionId,
                false
            );
            updateHeroCover('search-items');

            const countElement = document.getElementById('all-songs-count');
            if (countElement) {
                countElement.textContent = filteredSongs.length;
            }
            renderSongsList(filteredSongs, 'search-items');
            reapplyHighlightAfterFilter('search-items', filteredSongs);
            reapplySelectionAfterFilter('search-items', filteredSongs);

            resetLeftPanelActiveState();
        }

        setTimeout(() => {
            updateExternalScrollbar();
        }, 100);
    }, SEARCH_DEBOUNCE_MS);
}

function focusSubheroSearch() {
    const input = document.getElementById('subhero-search-input');
    const wrapper = document.getElementById('subhero-search-wrapper');
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
    const input = document.getElementById('subhero-search-input');
    if (!input) return;
    input.value = '';
    performSubheroSearch();
    input.focus();
}

function handleSubheroSearchBlur() {
    setTimeout(() => {
        const input = document.getElementById('subhero-search-input');
        const wrapper = document.getElementById('subhero-search-wrapper');
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
    const input = document.getElementById('subhero-search-input');
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
        renderSongsList(songs, currentView);
        reapplyHighlightAfterFilter(currentView, songs);
        reapplySelectionAfterFilter(currentView, songs);
        return;
    }

    // rank: false - filtering an album/playlist must keep that list's own order
    const filtered = searchSongs(songs, query, { rank: false });

    renderSongsList(filtered, currentView);
    reapplyHighlightAfterFilter(currentView, filtered);
    reapplySelectionAfterFilter(currentView, filtered);
}

function focusLeftPanelSearch() {
    const input = document.getElementById('left-panel-search-input');
    const wrapper = document.getElementById('left-panel-search-wrapper');
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
    const input = document.getElementById('left-panel-search-input');
    if (!input) return;
    input.value = '';
    performLeftPanelSearch();
    input.focus();
}

function handleLeftPanelSearchBlur() {
    setTimeout(() => {
        const input = document.getElementById('left-panel-search-input');
        const wrapper = document.getElementById('left-panel-search-wrapper');
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
    const input = document.getElementById('left-panel-search-input');
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
        renderLeftPanelMainList();
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

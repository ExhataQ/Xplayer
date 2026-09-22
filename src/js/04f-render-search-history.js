// ==============================================================================
// UI RENDER - SEARCH HISTORY
// ==============================================================================
function renderSearchHistoryView() {
    const searchHistory = getSearchHistory();
    const songList = document.getElementById('song-list');

    showHeroSection(false);
    showTracklistHeader(false);

    if (searchHistory.length === 0) {
        songList.innerHTML = `
                <div style="padding: 0 20px;">
                        <div class="search-history-header">
                                <div class="search-history-title-row">
                                        <div class="search-history-title">
                                                <i class="fas fa-search"></i>
                                                <span>Search History</span>
                                        </div>
                                        <button onclick="clearSearchHistory()" class="clear-history-btn">
                                                <i class="fas fa-trash-alt"></i>
                                                Clear List
                                        </button>
                                </div>
                        </div>
                        <div class="search-history-empty">
                                <i class="fas fa-search"></i>
                                <span>No search history</span>
                                <small>Search for songs to see them here</small>
                        </div>
                </div>
        `;
        return;
    }

    const historyHtml = searchHistory
        .map((entry, index) => {
            const date = new Date(entry.timestamp);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            let timeDisplay;
            if (date.toDateString() === today.toDateString()) {
                timeDisplay =
                    'Today ' +
                    date.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
            } else if (date.toDateString() === yesterday.toDateString()) {
                timeDisplay =
                    'Yesterday ' +
                    date.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
            } else {
                timeDisplay =
                    date.toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric'
                    }) +
                    ' ' +
                    date.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
            }

            return `
        <div class="song-item search-history-item" 
             onclick="openSearchHistoryChild('${entry.sessionId}', '${entry.query.replace(/'/g, "\\'")}')">
                <div class="left-song-item">
                        <div class="song-number">${index + 1}</div>
                        <div class="song-info">
                                <div class="song-title search-history-query">
                                        <i class="fas fa-search"></i>
                                        "${escapeHtml(entry.query)}"
                                </div>
                                <div class="song-artist search-history-meta">${
                                    entry.resultCount
                                } results • ${timeDisplay}</div>
                        </div>
                </div>
                <div class="song-album">${entry.resultCount} results</div>
                <div class="right-song-item">
                        <div class="song-duration">${timeDisplay.split(' ')[0]}</div>
                        <div class="more-info" onclick="event.stopPropagation(); deleteSearchHistoryEntry('${
                            entry.sessionId
                        }')">
                                <span class="material-symbols-outlined">delete</span>
                        </div>
                </div>
        </div>
        `;
        })
        .join('');

    songList.innerHTML = `
            <div style="padding: 0 20px;">
                    <div class="search-history-header">
                            <div class="search-history-title-row">
                                    <div class="search-history-title">
                                            <i class="fas fa-history"></i>
                                            <span>Search History</span>
                                    </div>
                                    <button onclick="clearSearchHistory()" class="clear-history-btn">
                                            <i class="fas fa-trash-alt"></i>
                                            Clear List
                                    </button>
                            </div>
                            <div class="search-history-info">
                                    <i class="fas fa-info-circle"></i>
                                    Last ${MAX_SEARCH_HISTORY} searches
                            </div>
                    </div>
                    ${historyHtml}
            </div>
    `;

    setTimeout(() => updateExternalScrollbar(), 100);
}

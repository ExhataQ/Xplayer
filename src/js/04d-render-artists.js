// ==============================================================================
// UI RENDER - ARTISTS
// ==============================================================================
function renderArtistDetailView(artistId) {
    const artists = getArtists();
    const artist = artists.find((a) => a.id === artistId);
    if (!artist) {
        switchView('artists');
        return;
    }

    const artistSongs = getArtistSongs(artistId);
    const listId = artistId;

    showHeroSection(true);
    const shortId = artist.id.substring(1, 11).toUpperCase();
    updateHeroSection(artist.name, artistSongs.length, 'Artist', shortId);
    showTracklistHeader(true);
    updateHeroCover(artistId);

    if (!ghostLists[listId]) {
        ghostLists[listId] = [];
    }

    initGhostSlots(listId, artistSongs, `Artist-${artistId}`);

    if (artistSongs.length === 0) {
        showTracklistHeader(false);
        if (typeof teardownLazyLoading === 'function') {
            teardownLazyLoading();
        }
        document.getElementById('song-list').innerHTML = `
                <div class="empty-state-container">
                        <i class="fas fa-music"></i>
                        <span>No songs by this artist</span>
                </div>`;
        return;
    }

    showTracklistHeader(true);

    renderSongsList(artistSongs, listId);

    setTimeout(() => {
        applyStoredHighlight(listId);
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 50);
}

function renderArtistLeftPanelItems() {
    const artists = getArtists();
    const leftPanelMainList = document.querySelector('.left-panel-main-list');

    const existingArtistItems = leftPanelMainList.querySelectorAll('.artist-child-item');
    existingArtistItems.forEach((item) => item.remove());

    if (artists.length === 0) return;

    const pinnedIds = getPinnedItems();
    const playedOrder = getPlayedItemOrder();
    const sortedArtists = sortByPinnedThenRecent(artists, (item) => item.id, pinnedIds, playedOrder);

    sortedArtists.forEach((artist) => {
        const artistItem = document.createElement('li');
        artistItem.className = 'left-panel-main-item artist-child-item';
        artistItem.setAttribute('onclick', `openArtist('${artist.id}')`);
        artistItem.setAttribute('oncontextmenu', `showArtistContextMenu(event, '${artist.id}'); return false;`);
        artistItem.setAttribute('data-view', artist.id);
        artistItem.setAttribute('data-pin-id', artist.id);
        artistItem.setAttribute('tabindex', '0');

        const coverContent = artist.cover
            ? `<img class="main-item-cover-img artist-cover-img" src="${artist.cover}" alt="">`
            : `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                    <rect width="400" height="400" rx="200" fill="#2a2a2a"/>
                    <circle cx="200" cy="155" r="70" fill="var(--accent)"/>
                    <ellipse cx="200" cy="320" rx="110" ry="45" fill="var(--accent)"/>
               </svg>`;

        artistItem.innerHTML = `
                <div class="subfolder-row">
                        <div class="main-item-cover-wrapper">
                                ${coverContent}
                                <button class="left-panel-cover-play-btn" data-view="${
                                    artist.id
                                }" onmousedown="event.stopPropagation()" aria-label="Play"></button>
                        </div>
                        <div class="main-item-info">
                                <span class="main-item-title">${escapeHtml(artist.name)}</span>
                                <span class="main-item-subtitle">
                                        <span>Artist</span>
                                        <span class="main-item-dot">•</span>
                                        <span class="main-item-count">${artist.songCount} ${
            artist.songCount === 1 ? 'song' : 'songs'
        }</span>
                                </span>
                        </div>
                        <span class="left-panel-playing-icon"><span class="material-symbols-outlined">volume_up</span></span>
                </div>
        `;

        leftPanelMainList.appendChild(artistItem);
    });

    renderLeftPanelMainList();
    updateScrollbarById('left-panel-main-content');
}

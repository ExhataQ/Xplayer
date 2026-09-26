// ==============================================================================
// UI RENDER - ALBUMS
// ==============================================================================
function renderAlbumsView() {
    const albums = getAlbums();
    const songListElement = document.getElementById('song-list');

    if (typeof teardownLazyLoading === 'function') {
        teardownLazyLoading();
    }

    showHeroSection(true);
    updateHeroSection('Albums', albums.length, 'Collection');
    showTracklistHeader(false);
    updateHeroCover(VIEWS.ALBUMS);

    if (albums.length === 0) {
        songListElement.innerHTML = `
                <div class="empty-state-container">
                        <i class="fas fa-compact-disc"></i>
                        <span>No albums found</span>
                        <small>Songs with album metadata will appear here</small>
                </div>`;
        return;
    }

    const pinnedIds = getPinnedItems();
    const playedOrder = getPlayedItemOrder();
    const sortedAlbums = sortByPinnedThenRecent(albums, (item) => item.id, pinnedIds, playedOrder);

    const albumsHtml = sortedAlbums
        .map((album, index) => {
            const coverSrc = album.cover || PLACEHOLDER_IMAGE;
            return `
        <div class="song-item" 
             onclick="openAlbum('${album.id}')"
             oncontextmenu="event.preventDefault(); showAlbumContextMenu(event, '${album.id}')"
             tabindex="0"
             onkeydown="if(event.key === 'Enter') openAlbum('${album.id}')"
             data-album-id="${album.id}">
                <div class="left-song-item">
                        <div class="song-number">${index + 1}</div>
                        <img class="song-cover" 
                             src="${coverSrc}" 
                             alt="Cover for ${album.name}"
                             onerror="this.src=PLACEHOLDER_IMAGE">
                        <div class="song-info">
                                <div class="song-title">${escapeHtml(album.name)}</div>
                                <div class="song-artist">${album.songCount} ${
                album.songCount === 1 ? 'song' : 'songs'
            }</div>
                        </div>
                </div>
                <div class="song-album"></div>
                <div class="right-song-item">
                        <div class="song-duration"></div>
                        <div class="more-info" onclick="event.stopPropagation(); showAlbumContextMenu(event, '${
                            album.id
                        }')" title="More options">
                                <span class="material-symbols-outlined">more_horiz</span>
                        </div>
                </div>
        </div>`;
        })
        .join('');

    songListElement.innerHTML = albumsHtml;
}

function renderAlbumDetailView(albumId) {
    const albums = getAlbums();
    const album = albums.find((a) => a.id === albumId);
    if (!album) {
        switchView(VIEWS.ALBUMS);
        return;
    }

    const albumSongs = getAlbumSongs(albumId);
    const listId = albumId;

    showHeroSection(true);
    const shortId = album.id.substring(1, 11).toUpperCase();
    updateHeroSection(album.name, albumSongs.length, 'Album', shortId);
    showTracklistHeader(true);
    updateHeroCover(albumId);

    if (!ghostLists[listId]) {
        ghostLists[listId] = [];
    }

    initGhostSlots(listId, albumSongs, `Album-${albumId}`);

    if (albumSongs.length === 0) {
        showTracklistHeader(false);
        if (typeof teardownLazyLoading === 'function') {
            teardownLazyLoading();
        }
        document.getElementById('song-list').innerHTML = `
                <div class="empty-state-container">
                        <i class="fas fa-music"></i>
                        <span>No songs in this album</span>
                </div>`;
        return;
    }

    showTracklistHeader(true);

    renderSongsList(albumSongs, listId);

    setTimeout(() => {
        applyStoredHighlight(listId);
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 50);
}

function renderAlbumLeftPanelItems() {
    const albums = getAlbums();
    const leftPanelMainList = document.querySelector('.left-panel-main-list');

    const existingAlbumItems = leftPanelMainList.querySelectorAll('.album-child-item');
    existingAlbumItems.forEach((item) => item.remove());

    if (albums.length === 0) return;

    const pinnedIds = getPinnedItems();
    const playedOrder = getPlayedItemOrder();
    const sortedAlbums = sortByPinnedThenRecent(albums, (item) => item.id, pinnedIds, playedOrder);

    sortedAlbums.forEach((album) => {
        const albumItem = document.createElement('li');
        albumItem.className = 'left-panel-main-item album-child-item';
        albumItem.setAttribute('onclick', `openAlbum('${album.id}')`);
        albumItem.setAttribute('oncontextmenu', `showAlbumContextMenu(event, '${album.id}'); return false;`);
        albumItem.setAttribute('data-view', album.id);
        albumItem.setAttribute('data-pin-id', album.id);
        albumItem.setAttribute('tabindex', '0');

        const coverContent = album.cover
            ? `<img class="main-item-cover-img album-cover-img" src="${album.cover}" alt="">`
            : `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                    <rect width="400" height="400" rx="8" fill="#1a1a1a"/>
                    <circle cx="200" cy="200" r="115" fill="none" stroke="#fff" stroke-width="8"/>
                    <circle cx="200" cy="200" r="30" fill="#fff"/>
                    <circle cx="200" cy="200" r="10" fill="#1a1a1a"/>
               </svg>`;

        albumItem.innerHTML = `
                <div class="subfolder-row">
                        <div class="main-item-cover-wrapper">
                                ${coverContent}
                                <button class="left-panel-cover-play-btn" data-view="${
                                    album.id
                                }" onmousedown="event.stopPropagation()" aria-label="Play"></button>
                        </div>
                        <div class="main-item-info">
                                <span class="main-item-title">${escapeHtml(album.name)}</span>
                                <span class="main-item-subtitle">
                                        <span>Album</span>
                                        <span class="main-item-dot">•</span>
                                        <span class="main-item-count">${album.songCount} ${
            album.songCount === 1 ? 'song' : 'songs'
        }</span>
                                </span>
                        </div>
                        <span class="left-panel-playing-icon"><span class="material-symbols-outlined">volume_up</span></span>
                </div>
        `;

        leftPanelMainList.appendChild(albumItem);
    });

    renderLeftPanelMainList();
    updateScrollbarById('left-panel-main-content');
}

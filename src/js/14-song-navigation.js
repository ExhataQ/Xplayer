// ==============================================================================
// SONG NAVIGATION
// ==============================================================================
function navigateToCurrentArtist() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return;
    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;
    const names = typeof getArtistNamesForSong === 'function' ? getArtistNamesForSong(song) : [];
    if (names.length === 0) return;
    const artists = getArtists();
    const artist = artists.find((a) => a.name === names[0]);
    if (!artist) return;
    openDetailView(artist.id, 'artist');
}

function navigateToCurrentSongInList() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return;

    const currentItem = playbackQueue[currentQueueIndex];
    const currentSong = currentItem.song || currentItem;
    const sourceListId = currentItem.listId || 'all-songs';

    let targetView = sourceListId;
    let songIndex = -1;
    let songList = [];

    if (sourceListId === 'all-songs') {
        songList = SONGS_DATA;
        songIndex = songList.findIndex((s) => s.id === currentSong.id);
        targetView = 'all-songs';
    } else if (sourceListId === 'favorites') {
        const favorites = getFavorites();
        songList = SONGS_DATA.filter((s) => favorites.includes(s.id));
        songIndex = songList.findIndex((s) => s.id === currentSong.id);
        targetView = 'favorites';
    } else if (sourceListId === 'search' && currentItem.searchQuery) {
        songList = SONGS_DATA.filter(
            (s) =>
                s.title.toLowerCase().includes(currentItem.searchQuery) ||
                s.artist.toLowerCase().includes(currentItem.searchQuery) ||
                s.album.toLowerCase().includes(currentItem.searchQuery)
        );
        songIndex = songList.findIndex((s) => s.id === currentSong.id);
        targetView = 'search';
        searchInput.value = currentItem.searchQuery;
        searchQuery = currentItem.searchQuery;
    } else if (sourceListId === 'history') {
        const history = getPlayHistory();
        songIndex = history.findIndex((e) => e.id === currentSong.id);
        targetView = 'history';
    } else if (sourceListId && sourceListId.startsWith('a') && sourceListId.length === 13) {
        const albumSongs = getAlbumSongs(sourceListId);
        songList = albumSongs;
        songIndex = songList.findIndex((s) => s.id === currentSong.id);
        targetView = sourceListId;
    } else if (sourceListId && sourceListId.startsWith('r') && sourceListId.length === 13) {
        const artistSongs = getArtistSongs(sourceListId);
        songList = artistSongs;
        songIndex = songList.findIndex((s) => s.id === currentSong.id);
        targetView = sourceListId;
    } else if (sourceListId && sourceListId.startsWith('playlist-')) {
        const playlistId = sourceListId.replace('playlist-', '');
        const playlists = getPlaylists();
        const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
        if (playlist) {
            songList = playlist.songs.map((songId) => SONGS_DATA.find((s) => s.id === songId)).filter((s) => s);
            songIndex = songList.findIndex((s) => s.id === currentSong.id);
            targetView = sourceListId;
        } else {
            songList = SONGS_DATA;
            songIndex = songList.findIndex((s) => s.id === currentSong.id);
            targetView = 'all-songs';
        }
    } else if (sourceListId === 'search-history') {
        songList = SONGS_DATA;
        songIndex = songList.findIndex((s) => s.id === currentSong.id);
        targetView = 'all-songs';
    } else if (sourceListId === 'playlists') {
        songList = SONGS_DATA;
        songIndex = songList.findIndex((s) => s.id === currentSong.id);
        targetView = 'all-songs';
    } else {
        songList = getActiveSongs();
        songIndex = songList.findIndex((s) => s.id === currentSong.id);
        targetView = 'all-songs';
    }

    if (targetView === currentView && songIndex !== -1) {
        scrollToSongItem(songIndex);
    } else {
        pushViewToHistory('__navigate__');
        switchToViewAndScroll(targetView, songIndex, currentSong.id, sourceListId);
    }
}

function scrollToSongItem(songIndex) {
    const content = document.querySelector('.content');
    if (!content) return;

    if (virtualScrollState.enabled) {
        const viewportHeight = content.clientHeight;
        const itemHeight = typeof ITEM_HEIGHT !== 'undefined' ? ITEM_HEIGHT : 56;

        const songList = songListElement;
        if (!songList) return;

        const songListRect = songList.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const offsetAboveSongList = songListRect.top - contentRect.top + content.scrollTop;

        const targetScrollTop = Math.max(
            0,
            songIndex * itemHeight - viewportHeight / 2 + itemHeight / 2 + offsetAboveSongList
        );
        content.scrollTop = targetScrollTop;

        virtualScrollState.visibleItems = [];
        virtualScrollState.firstVisibleIndex = -1;
        virtualScrollState.lastVisibleIndex = -1;
        if (typeof renderVisibleItems === 'function') {
            renderVisibleItems(content, false);
            virtualScrollState.lastRenderedStart = virtualScrollState.firstVisibleIndex;
            virtualScrollState.lastRenderedEnd = virtualScrollState.lastVisibleIndex;
        }

        setTimeout(() => {
            if (typeof renderVisibleItems === 'function') {
                renderVisibleItems(content, false);
                virtualScrollState.lastRenderedStart = virtualScrollState.firstVisibleIndex;
                virtualScrollState.lastRenderedEnd = virtualScrollState.lastVisibleIndex;
            }
            applyStoredHighlight(virtualScrollState.currentListId);
        }, 50);

        const scrollbar = document.getElementById('external-scrollbar');
        if (scrollbar) scrollbar.classList.add('visible');
        return;
    }

    const songItems = document.querySelectorAll('.song-item:not(.lazy-skeleton)');
    if (songIndex >= 0 && songIndex < songItems.length) {
        const targetItem = songItems[songIndex];
        const containerRect = content.getBoundingClientRect();
        const itemRect = targetItem.getBoundingClientRect();
        const offset = itemRect.top - containerRect.top - containerRect.height / 2 + itemRect.height / 2;
        content.scrollTop += offset;
        const scrollbar = document.getElementById('external-scrollbar');
        if (scrollbar) scrollbar.classList.add('visible');
    }
}

function applyScrollToSong(songId, listId) {
    const content = document.querySelector('.content');
    if (!content) return false;

    const songList = document.getElementById('song-list');
    if (!songList) return false;

    if (
        typeof virtualScrollState !== 'undefined' &&
        virtualScrollState.enabled &&
        virtualScrollState.currentListId === listId
    ) {
        const idx = virtualScrollState.currentSongs.findIndex((s) => s.id === songId);
        if (idx === -1) return false;

        const itemHeight = typeof ITEM_HEIGHT !== 'undefined' ? ITEM_HEIGHT : 56;
        const songListRect = songList.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const offsetAboveSongList = songListRect.top - contentRect.top + content.scrollTop;
        const viewportHeight = content.clientHeight;
        const target = Math.max(
            0,
            idx * itemHeight - viewportHeight / 2 + itemHeight / 2 + offsetAboveSongList
        );

        content.scrollTop = target;

        virtualScrollState.visibleItems = [];
        virtualScrollState.firstVisibleIndex = -1;
        virtualScrollState.lastVisibleIndex = -1;
        if (typeof renderVisibleItems === 'function') {
            renderVisibleItems(content, false);
            virtualScrollState.lastRenderedStart = virtualScrollState.firstVisibleIndex;
            virtualScrollState.lastRenderedEnd = virtualScrollState.lastVisibleIndex;
        }
        if (typeof applyStoredHighlight === 'function') {
            applyStoredHighlight(listId);
        }

        const scrollbar = document.getElementById('external-scrollbar');
        if (scrollbar) scrollbar.classList.add('visible');

        return Math.abs(content.scrollTop - target) < 4;
    }

    const items = songList.querySelectorAll('.song-item:not(.lazy-skeleton)');
    for (let i = 0; i < items.length; i++) {
        const id = parseInt(items[i].getAttribute('data-song-id'));
        if (id === songId) {
            const containerRect = content.getBoundingClientRect();
            const itemRect = items[i].getBoundingClientRect();
            const offset = itemRect.top - containerRect.top - containerRect.height / 2 + itemRect.height / 2;
            content.scrollTop += offset;

            const scrollbar = document.getElementById('external-scrollbar');
            if (scrollbar) scrollbar.classList.add('visible');
            return true;
        }
    }

    return false;
}

function scrollToSongInCurrentView(songId, listId) {
    let attempts = 0;
    const tryScroll = () => {
        const ok = applyScrollToSong(songId, listId);
        attempts++;
        if (!ok && attempts < 12) {
            requestAnimationFrame(tryScroll);
        }
    };
    tryScroll();
}

function switchToViewAndScroll(targetView, songIndex, songId, sourceListId) {
    if (targetView && targetView.startsWith('playlist-')) {
        const playlistId = targetView.replace('playlist-', '');
        const playlists = getPlaylists();
        const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
        if (playlist) {
            openPlaylist(playlistId, () => {
                scrollToSongInCurrentView(songId, targetView);
            });
        }
        return;
    }

    if (targetView && targetView.startsWith('a') && targetView.length === 13) {
        openDetailView(targetView, 'album');
        scrollToSongInCurrentView(songId, targetView);
        return;
    }

    if (targetView && targetView.startsWith('r') && targetView.length === 13) {
        openDetailView(targetView, 'artist');
        scrollToSongInCurrentView(songId, targetView);
        return;
    }

    switchView(targetView);
    scrollToSongInCurrentView(songId, targetView);
}

// ==============================================================================
// PLAYER BAR WIRING
// ==============================================================================

// Runs at load: attaches click / context-menu handlers to the search button, the player
// title, artist and cover, and the album art. Must load after the scripts that define
// the handlers it references.

document.getElementById('search-btn').onclick = () => {
    performSearch();
};

// Add click navigation to player song title only
const playerTitle = document.getElementById('player-title');
if (playerTitle) {
    playerTitle.style.cursor = 'pointer';
    playerTitle.addEventListener('click', () => navigateToCurrentSongInList());
    playerTitle.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
            const currentSong = playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex];
            showContextMenu(e, currentSong.id);
        }
    });
    if (typeof initMarqueeOnHover === 'function') {
        initMarqueeOnHover(playerTitle, { speed: 14, endPause: 1500 });
    }
}

const playerArtist = document.getElementById('player-artist');
if (playerArtist && typeof initMarqueeOnHover === 'function') {
    initMarqueeOnHover(playerArtist, { speed: 14, endPause: 1500 });
}
if (playerArtist) {
    playerArtist.style.cursor = 'pointer';
    playerArtist.addEventListener('click', () => navigateToCurrentArtist());
    playerArtist.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
            const currentSong = playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex];
            showContextMenu(e, currentSong.id);
        }
    });
}

// Add right-click context menu to player cover
const playerCover = document.getElementById('player-cover');
if (playerCover) {
    playerCover.style.cursor = 'pointer';
    playerCover.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
            const currentSong = playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex];
            showContextMenu(e, currentSong.id);
        }
    });
}

// Add click and context menu to album art in track info
const albumArtImage = document.getElementById('album-art-image');
if (albumArtImage) {
    albumArtImage.style.cursor = 'pointer';
    albumArtImage.addEventListener('click', openImageViewer);
    albumArtImage.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
            const currentSong = playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex];
            showContextMenu(e, currentSong.id);
        }
    });
}

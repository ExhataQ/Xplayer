// ==============================================================================
// COVER / THUMBNAIL UI SYNC
// (split out of 03-storage.js, Phase 2 Checkpoint 5)
// ==============================================================================


// Pixel-perfect swap: decode the new thumb off-screen first, then assign it, so a row never
// shows a half-decoded image, and clear any inline style left over from the placeholder stage.
function swapCoverSrc(img, url) {
    if (!img || !url) return;
    img.style.opacity = '';
    if (img.getAttribute('src') === url) return;
    const apply = () => {
        if (img.isConnected) img.src = url;
    };
    preloadCover(url).then(apply, apply);
}


// Left-panel album/artist rows have no <img> until a cover exists (they show an SVG), so they are
// patched in place. This is intentionally cheap (no getAlbums/getArtists) - the exact
// "most common cover" choice is re-derived by the full re-render when extraction completes.
function applyCoverToLeftPanelRow(playBtn, type, url) {
    const wrapper = playBtn.closest('.main-item-cover-wrapper');
    if (!wrapper) return;
    const existing = wrapper.querySelector('img');
    if (existing) return;
    const svg = wrapper.querySelector('.main-item-cover-svg');
    if (!svg) return;
    preloadCover(url).then(() => {
        if (!wrapper.isConnected || wrapper.querySelector('img')) return;
        const img = new Image();
        img.className = `main-item-cover-img ${type}-cover-img`;
        img.alt = '';
        img.decoding = 'sync';
        img.src = url;
        svg.replaceWith(img);
    });
}


function applyCoverBatchToUI(updates) {
    const leftItemByView = new Map();
    if (typeof leftPanelVirtualState !== 'undefined' && leftPanelVirtualState.currentItems) {
        for (const it of leftPanelVirtualState.currentItems) {
            if ((it.type === 'album' || it.type === 'artist') && it.viewId) leftItemByView.set(it.viewId, it);
        }
    }

    for (const update of updates) {
        const song = SONGS_DATA[update.id];
        if (!song) continue;
        song.cover = update.cover;
        song.largeCover = update.largeCover;

        // main list rows
        const img = document.querySelector(`#song-list .song-item[data-song-id="${update.id}"] .song-cover`);
        swapCoverSrc(img, update.cover);

        // left panel: album + artist rows this song belongs to
        const targets = [];
        if (song.album && String(song.album).trim() !== '') {
            targets.push(['album', generateConsistentId('a', String(song.album).trim())]);
        }
        for (const name of getArtistNamesForSong(song)) {
            targets.push(['artist', generateConsistentId('r', name)]);
        }
        for (const [type, viewId] of targets) {
            const item = leftItemByView.get(viewId);
            if (item && !item.cover) item.cover = update.cover; // rows rebuilt by scrolling pick it up
            const playBtns = document.querySelectorAll(
                `.left-panel-main-list .left-panel-cover-play-btn[data-view="${viewId}"]`
            );
            playBtns.forEach((btn) => applyCoverToLeftPanelRow(btn, type, update.cover));
        }
    }
}


function setupCoverStreamListeners() {
    if (typeof window === 'undefined') return;
    const api = window.electronAPI;
    if (!api || !api.onScanCoverBatch || window._coverStreamListenersAttached) return;
    window._coverStreamListenersAttached = true;

    let coverStreamActive = false;

    api.onScanCoverBatch((batch) => {
        if (typeof showCoverProgressNotification === 'function') {
            showCoverProgressNotification(batch.processed, batch.total, batch.found);
        }
        applyCoverBatchToUI(batch.updates || []);
    });

    api.onScanCoversComplete(() => {
        if (typeof completeCoverProgressNotification === 'function') {
            completeCoverProgressNotification();
        }
        if (typeof renderLeftPanelMainList === 'function') {
            renderLeftPanelMainList();
        }
    });
}

// Phase 2 Checkpoint 5: this call was originally sitting between setupCoverStreamListeners()
// and changeMusicFolder() in the pre-split 03-storage.js -- moved here (right after the
// function it invokes) rather than staying attached to changeMusicFolder in
// 03j-library-locations.js, which would have called it before it was even defined.
if (typeof window !== 'undefined') {
    setupCoverStreamListeners();
}


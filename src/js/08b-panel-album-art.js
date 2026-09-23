// ==============================================================================
// ALBUM ART & RIGHT PANEL TABS
// ==============================================================================
function updateAlbumArt() {
    const albumArtImage = document.getElementById('album-art-image');
    const tagTitle = document.getElementById('tag-title');
    const tagArtist = document.getElementById('tag-artist');
    const tagAlbum = document.getElementById('tag-album');
    const tagTrack = document.getElementById('tag-track');
    const tagComposer = document.getElementById('tag-composer');
    const tagGenre = document.getElementById('tag-genre');
    const tagYear = document.getElementById('tag-year');
    const tagDuration = document.getElementById('tag-duration');

    if (!tagTitle || !tagArtist || !tagAlbum || !tagTrack || !tagComposer || !tagGenre || !tagYear || !tagDuration) {
        return;
    }

    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const queueItem = playbackQueue[currentQueueIndex];
        const currentSong = queueItem.song || queueItem;
        const largeCover =
            typeof currentSong.largeCover === 'string' && currentSong.largeCover.trim() !== ''
                ? currentSong.largeCover
                : typeof currentSong.cover === 'string' && currentSong.cover.trim() !== ''
                ? currentSong.cover
                : PLACEHOLDER_IMAGE;

        albumArtImage.src = largeCover;

        const header = document.querySelector('.track-info-header');
        if (header) header.style.display = '';

        tagTitle.oncontextmenu = function (e) {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e, currentSong.id);
        };
        tagArtist.oncontextmenu = function (e) {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e, currentSong.id);
        };

        tagTitle.textContent = currentSong.title || '—';
        tagArtist.textContent = currentSong.artist || '—';
        tagAlbum.textContent = currentSong.album || '';
        tagTrack.textContent = currentSong.track || '';
        tagComposer.textContent = currentSong.composer || '';
        tagGenre.textContent = currentSong.genre || '';
        tagYear.textContent = currentSong.year || '';
        tagDuration.textContent = currentSong.duration || '';

        clearTrackPlaceholders();
        updateTrackInfoBoxVisibility();
        renderTrackLyricsBox();
        updateTrackNextBox();

        const moreInfoBtn = document.getElementById('right-panel-more-info');
        if (moreInfoBtn) {
            const tagsActive = tagsContentElement.classList.contains('active');
            if (tagsActive) {
                moreInfoBtn.style.display = 'flex';
                moreInfoBtn.setAttribute('title', `More options for ${currentSong.title.replace(/"/g, '&quot;')}`);
            } else {
                moreInfoBtn.style.display = 'none';
            }
        }

        if (tagsContentElement.classList.contains('active')) {
            const sourceName =
                typeof getCurrentPlayingSourceName === 'function' ? getCurrentPlayingSourceName() : 'Track Info';
            const headerTitle = document.getElementById('right-panel-header-title');
            if (headerTitle) {
                headerTitle.textContent = sourceName;
                headerTitle.classList.remove('active-underline');
                headerTitle.classList.add('source-name-header');
                headerTitle.setAttribute('oncontextmenu', 'showCurrentSourceContextMenu(event)');
            }
        }
    } else {
        const moreInfoBtn = document.getElementById('right-panel-more-info');
        if (moreInfoBtn) {
            moreInfoBtn.style.display = 'none';
        }
        albumArtImage.src = PLACEHOLDER_IMAGE;

        tagTitle.oncontextmenu = null;
        tagArtist.oncontextmenu = null;

        const header = document.querySelector('.track-info-header');
        if (header) header.style.display = 'none';

        tagTitle.textContent = '';
        tagArtist.textContent = '';

        tagAlbum.textContent = '';
        tagTrack.textContent = '';
        tagComposer.textContent = '';
        tagGenre.textContent = '';
        tagYear.textContent = '';
        tagDuration.textContent = '';

        showTrackPlaceholders();
    }

    updateInfoButtonVisibility();

    if (currentView === 'lyrics') {
        renderLyricsView();
    }
}

function updateTrackInfoBoxVisibility() {
    const box = document.getElementById('track-info-box');
    const columnsWrap = document.getElementById('track-info-columns');
    if (!box || !columnsWrap) return;

    let visibleRows = 0;
    columnsWrap.querySelectorAll('.track-info-row').forEach((row) => {
        const value = row.querySelector('.track-info-value');
        const isEmpty = !value || value.textContent.trim() === '';
        row.style.display = isEmpty ? 'none' : '';
        if (!isEmpty) visibleRows++;
    });

    if (visibleRows === 0) {
        box.style.display = 'none';
        return;
    }

    box.style.display = '';

    if (visibleRows === 2) {
        columnsWrap.setAttribute('data-layout', 'two-side');
    } else if (visibleRows === 4) {
        columnsWrap.setAttribute('data-layout', 'four-grid');
    } else if (visibleRows >= 5) {
        columnsWrap.setAttribute('data-layout', 'double');
    } else {
        columnsWrap.setAttribute('data-layout', 'single');
    }
}

function showTrackPlaceholders() {
    const albumArtImage = document.getElementById('album-art-image');
    const albumArtContainer = document.querySelector('.album-art-container');
    const tagDetails = document.getElementById('tag-details');
    const infoBox = document.getElementById('track-info-box');
    const lyricsBox = document.getElementById('track-lyrics-box');
    const nextBox = document.getElementById('track-next-box');

    if (albumArtImage) {
        albumArtImage.style.display = 'none';
        albumArtImage.removeAttribute('src');
    }
    if (albumArtContainer) {
        removePlaceholder('placeholder-album-art');
        const ph = document.createElement('div');
        ph.id = 'placeholder-album-art';
        ph.className = 'album-art-placeholder';
        albumArtContainer.appendChild(ph);
    }

    const albumArtSection = document.getElementById('album-art-section');
    if (albumArtSection) {
        albumArtSection.classList.add('showing-placeholders');
    }
    const rightPanelWrapper = document.querySelector('.right-panel-content-wrapper');
    if (rightPanelWrapper) {
        rightPanelWrapper.classList.add('showing-placeholders');
    }

    if (tagDetails) {
        removePlaceholder('placeholder-track-header');
        const ph = document.createElement('div');
        ph.id = 'placeholder-track-header';
        ph.className = 'track-placeholder-header';
        ph.innerHTML = `
            <div class="skeleton-bar placeholder-title"></div>
            <div class="skeleton-bar placeholder-artist"></div>
        `;
        tagDetails.insertBefore(ph, tagDetails.firstChild);
    }

    if (infoBox) {
        infoBox.style.display = 'none';
        removePlaceholder('placeholder-info-box');
        const ph = document.createElement('div');
        ph.id = 'placeholder-info-box';
        ph.className = 'track-placeholder-box placeholder-info';
        ph.innerHTML = `
            <div class="placeholder-info-title-row">
                <div class="skeleton-bar"></div>
                <div class="skeleton-circle"></div>
            </div>
            <div class="placeholder-info-grid">
                <div class="placeholder-info-row">
                    <div class="skeleton-bar value"></div>
                    <div class="skeleton-bar label"></div>
                </div>
                <div class="placeholder-info-row">
                    <div class="skeleton-bar value"></div>
                    <div class="skeleton-bar label"></div>
                </div>
                <div class="placeholder-info-row">
                    <div class="skeleton-bar value"></div>
                    <div class="skeleton-bar label"></div>
                </div>
                <div class="placeholder-info-row">
                    <div class="skeleton-bar value"></div>
                    <div class="skeleton-bar label"></div>
                </div>
            </div>
        `;
        infoBox.parentNode.insertBefore(ph, infoBox);
    }

    if (lyricsBox) {
        lyricsBox.style.display = 'none';
        removePlaceholder('placeholder-lyrics-box');
        const ph = document.createElement('div');
        ph.id = 'placeholder-lyrics-box';
        ph.className = 'track-placeholder-box placeholder-lyrics';
        ph.innerHTML = `
            <div class="placeholder-lyrics-header">
                <div class="skeleton-bar"></div>
                <div class="skeleton-bar open-btn"></div>
            </div>
            <div class="placeholder-lyrics-body">
                <div class="skeleton-bar"></div>
                <div class="skeleton-bar"></div>
                <div class="skeleton-bar"></div>
            </div>
        `;
        lyricsBox.parentNode.insertBefore(ph, lyricsBox);
    }

    if (nextBox) {
        nextBox.style.display = 'none';
        removePlaceholder('placeholder-next-box');
        const ph = document.createElement('div');
        ph.id = 'placeholder-next-box';
        ph.className = 'track-placeholder-box placeholder-next';
        ph.innerHTML = `
            <div class="placeholder-next-header">
                <div class="skeleton-bar"></div>
                <div class="skeleton-bar open-btn"></div>
            </div>
            <div class="placeholder-next-item">
                <div class="placeholder-next-cover"></div>
                <div class="placeholder-next-info">
                    <div class="skeleton-bar title"></div>
                    <div class="skeleton-bar artist"></div>
                </div>
            </div>
        `;
        nextBox.parentNode.insertBefore(ph, nextBox);
    }
}

function removePlaceholder(id) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
}

function clearTrackPlaceholders() {
    removePlaceholder('placeholder-track-header');
    removePlaceholder('placeholder-info-box');
    removePlaceholder('placeholder-lyrics-box');
    removePlaceholder('placeholder-next-box');
    removePlaceholder('placeholder-album-art');
    const albumArtImage = document.getElementById('album-art-image');
    if (albumArtImage) {
        albumArtImage.style.display = '';
    }
    const albumArtSection = document.getElementById('album-art-section');
    if (albumArtSection) {
        albumArtSection.classList.remove('showing-placeholders');
    }
    const rightPanelWrapper = document.querySelector('.right-panel-content-wrapper');
    if (rightPanelWrapper) {
        rightPanelWrapper.classList.remove('showing-placeholders');
    }
}

function updateTrackNextBox() {
    const box = document.getElementById('track-next-box');
    const body = document.getElementById('track-next-body');
    if (!box || !body) return;

    let nextItem = null;
    if (currentQueueIndex >= 0 && currentQueueIndex + 1 < playbackQueue.length) {
        nextItem = playbackQueue[currentQueueIndex + 1];
    }

    if (!nextItem) {
        box.style.display = 'none';
        body.innerHTML = '';
        return;
    }

    const song = nextItem.song || nextItem;
    const title = escapeHtml(song.title || 'Unknown title');
    const artist = escapeHtml(song.artist || 'Unknown artist');
    const cover = song.cover || PLACEHOLDER_IMAGE;

    const nextIndex = currentQueueIndex + 1;

    box.style.display = '';
    body.innerHTML = `
        <div class="track-next-item" onclick="playFromQueue(${nextIndex})">
            <div class="track-next-cover-wrapper">
                <img class="track-next-cover" src="${cover}" alt="" onerror="this.onerror=null; this.src=PLACEHOLDER_IMAGE">
                <button class="track-next-play-btn" onclick="event.stopPropagation(); playFromQueue(${nextIndex})" aria-label="Play next"></button>
            </div>
            <div class="track-next-info">
                <div class="track-next-song-title">${title}</div>
                <div class="track-next-song-artist">${artist}</div>
            </div>
        </div>
    `;
}

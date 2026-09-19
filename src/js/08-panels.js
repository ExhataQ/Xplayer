// ==============================================================================
// RIGHT PANEL - TOGGLE / COLLAPSE / EXPAND
// ==============================================================================
function toggleRightPanel() {
    const rightPanel = rightPanelElement;
    const playerToggleButton = document.querySelector('.queue-toggle-btn');
    const queueContent = document.getElementById('queue-content');
    const tagsContent = tagsContentElement;
    const recentlyPlayedContent = document.getElementById('recently-played-content');

    const isInQueueOrRecents =
        queueContent.classList.contains('active') || recentlyPlayedContent.classList.contains('active');
    const isInTags =
        tagsContent.classList.contains('active') ||
        document.getElementById('metadata-content')?.classList.contains('active');

    if (isInQueueOrRecents) {
        if (lastRightPanelStateBeforeQueue.wasTab === 'tags') {
            if (lastRightPanelStateBeforeQueue.wasCollapsed) {
                collapseRightPanel();
            } else {
                expandRightPanel();
            }
            switchRightPanelTab('tags');
            playerToggleButton.classList.remove('active');
            playerToggleButton.setAttribute('aria-label', 'Open right panel');
        } else {
            collapseRightPanel();
            playerToggleButton.classList.remove('active');
            playerToggleButton.setAttribute('aria-label', 'Open right panel');
        }
        return;
    }

    if (isInTags) {
        lastRightPanelStateBeforeQueue = {
            wasCollapsed: rightPanelCollapsed,
            wasTab: 'tags'
        };

        if (rightPanelCollapsed) {
            expandRightPanel();
        }
        if (!rightPanel.classList.contains('active')) {
            rightPanel.classList.add('active');
        }
        switchRightPanelTab('queue');
        playerToggleButton.classList.add('active');
        playerToggleButton.setAttribute('aria-label', 'Close right panel');
        updateAlbumArt();
        updateScrollbarById('right-panel-content');
        return;
    }

    if (rightPanelCollapsed || !rightPanel.classList.contains('active')) {
        lastRightPanelStateBeforeQueue = {
            wasCollapsed: true,
            wasTab: 'queue'
        };

        expandRightPanel();
        rightPanel.classList.add('active');
        switchRightPanelTab('queue');
        playerToggleButton.classList.add('active');
        playerToggleButton.setAttribute('aria-label', 'Close right panel');
        updateAlbumArt();
        updateScrollbarById('right-panel-content');
        return;
    }
}

function openTagsTab() {
    const rightPanel = rightPanelElement;
    const playerToggleButton = document.querySelector('.queue-toggle-btn');
    const queueContent = document.getElementById('queue-content');
    const recentlyPlayedContent = document.getElementById('recently-played-content');
    const tagsContent = tagsContentElement;

    const metadataContent = document.getElementById('metadata-content');
    const isInMetadata = metadataContent?.classList.contains('active');
    const isInQueueOrRecents =
        queueContent.classList.contains('active') || recentlyPlayedContent.classList.contains('active');

    if (isInMetadata) {
        switchRightPanelTab('tags');
        playerToggleButton.classList.remove('active');
        playerToggleButton.setAttribute('aria-label', 'Open right panel');
        updateScrollbarById('right-panel-content');
        return;
    }

    if (isInQueueOrRecents) {
        switchRightPanelTab('tags');
        playerToggleButton.classList.remove('active');
        playerToggleButton.setAttribute('aria-label', 'Open right panel');
        updateScrollbarById('right-panel-content');
        return;
    }

    if (rightPanelCollapsed || !rightPanel.classList.contains('active')) {
        expandRightPanel();
        rightPanel.classList.add('active');
        switchRightPanelTab('tags');
        playerToggleButton.classList.remove('active');
        playerToggleButton.setAttribute('aria-label', 'Open right panel');
        updateAlbumArt();
        updateScrollbarById('right-panel-content');
        return;
    }

    if (tagsContent.classList.contains('active') && rightPanel.classList.contains('active')) {
        collapseRightPanel();
        playerToggleButton.classList.remove('active');
        playerToggleButton.setAttribute('aria-label', 'Open right panel');
        return;
    }
}

function collapseRightPanel() {
    rightPanelCollapsed = true;
    const rightPanel = rightPanelElement;
    const collapseBtn = document.getElementById('right-panel-collapse-btn');
    const collapseIcon = document.getElementById('right-panel-collapse-icon');

    rightPanel.classList.add('collapsed');
    if (collapseBtn) collapseBtn.classList.add('active');
    if (collapseIcon) collapseIcon.textContent = 'left_panel_open';
    localStorage.setItem('rightPanelCollapsed', 'true');

    document.querySelectorAll('.queue-toggle-btn').forEach((btn) => {
        btn.classList.remove('active');
    });

    const rightPanelContent = document.querySelector('.right-panel-content');
    if (rightPanelContent) {
        rightPanelContent.style.display = 'none';
    }

    let toggleBtn = document.getElementById('right-panel-expand-toggle');
    if (!toggleBtn) {
        toggleBtn = document.createElement('div');
        toggleBtn.id = 'right-panel-expand-toggle';
        toggleBtn.className = 'right-panel-expand-toggle';
        toggleBtn.innerHTML = '<span class="material-symbols-outlined" style="font-weight: 300;">chevron_left</span>';
        toggleBtn.setAttribute('data-original-title', 'Show now playing view');
        toggleBtn.onclick = function (e) {
            e.stopPropagation();
            temporarilySuppressTooltip(toggleBtn);
            expandRightPanel();
        };
        rightPanel.appendChild(toggleBtn);
        rightPanel.style.cursor = 'pointer';
        rightPanel.onclick = function (e) {
            if (e.target === rightPanel || e.target.closest('.right-panel-expand-toggle')) {
                expandRightPanel();
            }
        };
    }

    recalcLayoutWidths();
    setTimeout(function () {
        if (typeof updateSettingsMargins === 'function') updateSettingsMargins();
    }, 30);
}

function expandRightPanel() {
    rightPanelCollapsed = false;
    const rightPanel = rightPanelElement;
    const collapseBtn = document.getElementById('right-panel-collapse-btn');
    const collapseIcon = document.getElementById('right-panel-collapse-icon');

    rightPanel.classList.remove('collapsed');
    if (collapseBtn) collapseBtn.classList.remove('active');
    if (collapseIcon) collapseIcon.textContent = 'left_panel_close';
    localStorage.setItem('rightPanelCollapsed', 'false');

    const rightPanelContent = document.querySelector('.right-panel-content');
    if (rightPanelContent) {
        rightPanelContent.style.display = '';
    }

    const toggleBtn = document.getElementById('right-panel-expand-toggle');
    if (toggleBtn) {
        toggleBtn.remove();
    }
    if (rightPanelElement) {
        rightPanelElement.style.cursor = '';
        rightPanelElement.onclick = null;
    }

    const queueToggleBtn = document.querySelector('.queue-toggle-btn');
    if (queueToggleBtn && tagsContentElement.classList.contains('active')) {
        queueToggleBtn.classList.remove('active');
    }

    recalcLayoutWidths();
    setTimeout(function () {
        if (typeof updateSettingsMargins === 'function') updateSettingsMargins();
    }, 30);
}

function toggleRightPanelCollapse() {
    const btn = document.getElementById('right-panel-collapse-btn');
    if (btn) temporarilySuppressTooltip(btn);

    if (rightPanelCollapsed) {
        expandRightPanel();
    } else {
        collapseRightPanel();
    }
}

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

let trackLyricsExpanded = false;
let trackLyricsEntries = null;
let trackLyricsActiveIndex = -1;
let trackLyricsLineElements = [];
let trackLyricsProgrammaticScroll = false;
let trackLyricsUserScrolledAway = false;
let trackLyricsScrollCleanup = null;

function getTrackLyricsForCurrentSong() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return null;
    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;
    if (!song) return null;
    return song;
}

function renderTrackLyricsBox() {
    const box = document.getElementById('track-lyrics-box');
    const text = document.getElementById('track-lyrics-text');
    if (!box || !text) return;

    if (getHideRightPanelLyrics()) {
        box.style.display = 'none';
        return;
    }

    const song = getTrackLyricsForCurrentSong();
    if (!song) {
        box.style.display = 'none';
        return;
    }

    const hasSynced =
        typeof initSyncedLyrics === 'function' && typeof getSyncedLyricsForSong === 'function' ? false : false;

    let syncedText = null;
    if (typeof getSyncedLyricsForSong === 'function') {
        syncedText = getSyncedLyricsForSong(song);
    }

    const parsedSynced = syncedText && typeof parseLRC === 'function' ? parseLRC(syncedText) : null;

    const plainText = typeof getLyricsForSong === 'function' ? getLyricsForSong(song) : '';

    const hasNoLyrics =
        (!parsedSynced || parsedSynced.length === 0) && (!plainText || String(plainText).trim() === '');

    if (hasNoLyrics && song.instrumental === true) {
        box.style.display = '';
        text.classList.remove('track-lyrics-synced');
        text.innerHTML = `<div class="track-lyrics-line track-lyrics-line-instrumental-block" title="Verified by LRCLIB"><span class="material-symbols-outlined">music_note</span><span>Instrumental</span></div>`;
        trackLyricsEntries = null;
        trackLyricsLineElements = [];
        trackLyricsActiveIndex = -1;
        hideTrackLyricsSyncButton();
        applyTrackLyricsExpandedState();
        setTimeout(() => updateScrollbarById('track-lyrics-body'), 60);
        return;
    }

    if (hasNoLyrics) {
        box.style.display = 'none';
        trackLyricsEntries = null;
        trackLyricsLineElements = [];
        trackLyricsActiveIndex = -1;
        return;
    }

    box.style.display = '';

    trackLyricsUserScrolledAway = false;

    if (parsedSynced && parsedSynced.length > 0) {
        trackLyricsEntries = parsedSynced;
        text.classList.add('track-lyrics-synced');
        text.innerHTML = parsedSynced
            .map((entry, i) => {
                if (entry.instrumental) {
                    return `<div class="track-lyrics-line track-lyrics-line-instrumental" data-index="${i}"><span class="material-symbols-outlined">music_note</span></div>`;
                }
                if (entry.text.trim() === '') {
                    return `<div class="track-lyrics-line track-lyrics-line-empty" data-index="${i}"></div>`;
                }
                return `<div class="track-lyrics-line" data-index="${i}">${escapeHtml(entry.text)}</div>`;
            })
            .join('');

        trackLyricsLineElements = Array.from(text.querySelectorAll('.track-lyrics-line'));
        trackLyricsLineElements.forEach((el, i) => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => seekTrackLyricsToLine(i));
        });

        updateTrackLyricsHighlight(audioElement.currentTime || 0);
        attachTrackLyricsScrollWatcher();
    } else {
        trackLyricsEntries = null;
        const normalized = String(plainText).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        text.classList.remove('track-lyrics-synced');
        text.innerHTML = normalized
            .split('\n')
            .map((line) => {
                if (line.trim() === '') return `<div class="track-lyrics-line track-lyrics-line-empty"></div>`;
                return `<div class="track-lyrics-line">${escapeHtml(line)}</div>`;
            })
            .join('');
        trackLyricsLineElements = [];
        trackLyricsActiveIndex = -1;
        hideTrackLyricsSyncButton();
    }

    applyTrackLyricsExpandedState();

    const scrollContent = document.getElementById('track-lyrics-body');
    if (scrollContent) {
        scrollContent.scrollTop = 0;
    }

    setTimeout(() => {
        if (typeof initExternalScrollbar === 'function') {
            initExternalScrollbar('track-lyrics-body', 'track-lyrics-scrollbar', 'track-lyrics-scrollbar-thumb');
        }
        updateScrollbarById('track-lyrics-body');
        attachTrackLyricsWheelGuard();
    }, 60);

    setTimeout(() => updateScrollbarById('track-lyrics-body'), 200);
}

function applyTrackLyricsExpandedState() {
    const container = document.querySelector('.track-lyrics-body-container');
    const icon = document.getElementById('track-lyrics-expand-icon');
    if (!container) return;
    const inLyricsView = document.body.classList.contains('in-lyrics-view');
    const shouldExpand = !inLyricsView && trackLyricsExpanded;

    container.classList.toggle('expanded', shouldExpand);
    if (icon) icon.textContent = shouldExpand ? 'expand_less' : 'expand_more';

    const targetHeight = shouldExpand ? 280 : 78;
    container.style.transition = 'height 0.25s ease, max-height 0.25s ease';
    container.style.height = targetHeight + 'px';
    container.style.maxHeight = targetHeight + 'px';

    setTimeout(() => {
        if (typeof updateScrollbarById === 'function') {
            updateScrollbarById('track-lyrics-body');
        }
        if (shouldExpand && trackLyricsActiveIndex >= 0 && trackLyricsLineElements[trackLyricsActiveIndex]) {
            trackLyricsUserScrolledAway = false;
            hideTrackLyricsSyncButton();
            const body = document.getElementById('track-lyrics-body');
            if (body) {
                const el = trackLyricsLineElements[trackLyricsActiveIndex];
                const containerRect = body.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                const offset = elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;
                trackLyricsProgrammaticScroll = true;
                body.scrollTo({
                    top: body.scrollTop + offset,
                    behavior: 'smooth'
                });
                clearTimeout(window._trackLyricsScrollTimeout);
                window._trackLyricsScrollTimeout = setTimeout(() => {
                    trackLyricsProgrammaticScroll = false;
                }, 700);
            }
        }
    }, 300);
}

function toggleTrackLyricsExpand() {
    if (document.body.classList.contains('in-lyrics-view')) return;
    trackLyricsExpanded = !trackLyricsExpanded;
    applyTrackLyricsExpandedState();
}

function updateTrackLyricsHighlight(currentTime) {
    if (!trackLyricsEntries || trackLyricsLineElements.length === 0) return;
    if (document.body.classList.contains('in-lyrics-view')) return;

    let lo = 0;
    let hi = trackLyricsEntries.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (trackLyricsEntries[mid].time <= currentTime) {
            found = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    if (found === trackLyricsActiveIndex) return;

    if (trackLyricsActiveIndex >= 0 && trackLyricsLineElements[trackLyricsActiveIndex]) {
        trackLyricsLineElements[trackLyricsActiveIndex].classList.remove('synced-active');
    }

    trackLyricsActiveIndex = found;

    if (found >= 0 && trackLyricsLineElements[found]) {
        trackLyricsLineElements[found].classList.add('synced-active');
        if (!trackLyricsUserScrolledAway) {
            scrollTrackLyricsToActive(true);
        }
    }
}

function seekTrackLyricsToLine(index) {
    if (!trackLyricsEntries || index < 0 || index >= trackLyricsEntries.length) return;
    const entry = trackLyricsEntries[index];
    if (!entry || !audioElement.src) return;
    audioElement.currentTime = entry.time;
    if (audioElement.paused) audioElement.play().catch(() => {});
    updateTrackLyricsHighlight(audioElement.currentTime);
}

function scrollTrackLyricsToActive(silent) {
    const container = document.getElementById('track-lyrics-body');
    if (!container) return;
    if (document.body.classList.contains('in-lyrics-view')) return;
    if (trackLyricsActiveIndex < 0 || !trackLyricsLineElements[trackLyricsActiveIndex]) return;

    trackLyricsProgrammaticScroll = true;
    const el = trackLyricsLineElements[trackLyricsActiveIndex];
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offset = elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;
    container.scrollTo({
        top: container.scrollTop + offset,
        behavior: 'smooth'
    });

    clearTimeout(window._trackLyricsScrollTimeout);
    window._trackLyricsScrollTimeout = setTimeout(() => {
        trackLyricsProgrammaticScroll = false;
    }, 700);

    if (!silent) {
        trackLyricsUserScrolledAway = false;
        hideTrackLyricsSyncButton();
    }
}

function attachTrackLyricsScrollWatcher() {
    const container = document.getElementById('track-lyrics-body');
    if (!container) return;

    if (trackLyricsScrollCleanup) {
        trackLyricsScrollCleanup();
    }

    let scrollEndTimeout = null;

    function onScroll() {
        if (trackLyricsProgrammaticScroll) return;
        clearTimeout(scrollEndTimeout);
        scrollEndTimeout = setTimeout(() => {
            if (trackLyricsActiveIndex < 0 || !trackLyricsLineElements[trackLyricsActiveIndex]) return;
            const containerRect = container.getBoundingClientRect();
            const elRect = trackLyricsLineElements[trackLyricsActiveIndex].getBoundingClientRect();
            const distance = Math.abs(elRect.top + elRect.height / 2 - (containerRect.top + containerRect.height / 2));
            if (distance > containerRect.height * 0.5) {
                trackLyricsUserScrolledAway = true;
                showTrackLyricsSyncButton();
            } else {
                trackLyricsUserScrolledAway = false;
                hideTrackLyricsSyncButton();
            }
        }, 150);
    }

    container.addEventListener('scroll', onScroll, { passive: true });
    trackLyricsScrollCleanup = () => {
        container.removeEventListener('scroll', onScroll);
        clearTimeout(scrollEndTimeout);
    };
}

function attachTrackLyricsWheelGuard() {
    const container = document.getElementById('track-lyrics-body');
    if (!container || container._wheelGuardAttached) return;
    container._wheelGuardAttached = true;

    container.addEventListener(
        'wheel',
        (e) => {
            const atTop = container.scrollTop <= 0;
            const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
            const goingUp = e.deltaY < 0;
            const goingDown = e.deltaY > 0;

            if ((atTop && goingUp) || (atBottom && goingDown)) {
                e.preventDefault();
                e.stopPropagation();
            }
        },
        { passive: false }
    );
}

function showTrackLyricsSyncButton() {
    const btn = document.getElementById('track-lyrics-sync');
    if (btn) btn.style.display = '';
}

function hideTrackLyricsSyncButton() {
    const btn = document.getElementById('track-lyrics-sync');
    if (btn) btn.style.display = 'none';
}

function clearTrackLyricsBox() {
    const box = document.getElementById('track-lyrics-box');
    if (box) box.style.display = 'none';
    trackLyricsEntries = null;
    trackLyricsLineElements = [];
    trackLyricsActiveIndex = -1;
    trackLyricsUserScrolledAway = false;
    if (trackLyricsScrollCleanup) {
        trackLyricsScrollCleanup();
        trackLyricsScrollCleanup = null;
    }
    hideTrackLyricsSyncButton();
}

function getCurrentSongForInfo() {
    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const queueItem = playbackQueue[currentQueueIndex];
        return queueItem.song || queueItem;
    }
    return null;
}

function hasEnabledExtendedFields() {
    const settings = getExtendedMetadataSettings();
    return EXTENDED_METADATA_FIELDS.some((f) => !f.hidden && settings[f.key]);
}

function updateInfoButtonVisibility() {
    const btn = document.getElementById('track-info-btn');
    if (!btn) return;
    const tagsActive = tagsContentElement.classList.contains('active');
    const hasSong = currentQueueIndex >= 0 && playbackQueue[currentQueueIndex];
    btn.style.display = tagsActive && hasSong ? 'flex' : 'none';
}

function openExtendedInfoPanel() {
    const overlay = document.getElementById('extended-info-overlay');
    const content = document.getElementById('extended-info-content');
    if (!overlay || !content) return;

    const song = getCurrentSongForInfo();
    if (!song) return;

    const settings = getExtendedMetadataSettings();
    const groups = {};
    const groupOrder = ['People', 'Structure', 'Publishing', 'Identifiers', 'Technical', 'Misc', 'Sort'];

    EXTENDED_METADATA_FIELDS.forEach((f) => {
        if (f.hidden) return;
        if (!settings[f.key]) return;
        const value = song[f.key];
        if (value === undefined || value === null || String(value).trim() === '') return;
        if (!groups[f.group]) groups[f.group] = [];
        groups[f.group].push({
            label: f.label,
            value: String(value)
        });
    });

    let bodyHTML = '';
    let totalRows = 0;
    groupOrder.forEach((groupName) => {
        if (!groups[groupName] || groups[groupName].length === 0) return;
        bodyHTML += `<div class="extended-info-group-label">${escapeHtml(groupName)}</div>`;
        groups[groupName].forEach((row) => {
            bodyHTML += `
                <div class="extended-info-row">
                    <span class="extended-info-label">${escapeHtml(row.label)}</span>
                    <span class="extended-info-value">${escapeHtml(row.value)}</span>
                </div>`;
            totalRows++;
        });
    });

    if (totalRows === 0) {
        bodyHTML = `<div class="extended-info-empty">No extended metadata available for this track</div>`;
    }

    content.innerHTML = `
        <div class="extended-info-header">
            <div class="extended-info-title">Track Information</div>
            <button class="extended-info-close" onclick="closeExtendedInfoPanel()" aria-label="Close">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
        <div class="extended-info-body">${bodyHTML}</div>
    `;

    overlay.classList.add('active');
    document.addEventListener('keydown', extendedInfoKeyHandler);
}

function closeExtendedInfoPanel() {
    const overlay = document.getElementById('extended-info-overlay');
    if (overlay) overlay.classList.remove('active');
    document.removeEventListener('keydown', extendedInfoKeyHandler);
}

function extendedInfoKeyHandler(e) {
    if (e.key === 'Escape') {
        closeExtendedInfoPanel();
    }
}

function showRightPanelContextMenu(event) {
    event.stopPropagation();
    event.preventDefault();

    const clickedMoreInfo = event.target.closest('.more-info');
    if (clickedMoreInfo) {
        temporarilySuppressTooltip(clickedMoreInfo);
    }

    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const currentSong = playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex];
        showContextMenu(event, currentSong.id);
    }
}

function switchRightPanelTab(tab) {
    document.querySelectorAll('.panel-content').forEach((c) => c.classList.remove('active'));
    document.getElementById(`${tab}-content`).classList.add('active');
    updateRightPanelHeader(tab);

    const headerContent = document.querySelector('.right-panel-header-content');
    if (headerContent) {
        headerContent.classList.remove('queue-mode', 'tags-mode', 'metadata-mode');
        if (tab === 'tags' || tab === 'metadata') {
            headerContent.classList.add(tab === 'metadata' ? 'metadata-mode' : 'tags-mode');
        } else {
            headerContent.classList.add('queue-mode');
        }
    }

    const moreInfoBtn = document.getElementById('right-panel-more-info');
    const closeBtn = document.getElementById('right-panel-close-btn');

    if (moreInfoBtn) moreInfoBtn.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';

    if (tab === 'tags') {
        if (moreInfoBtn && currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
            moreInfoBtn.style.display = 'flex';
            const currentSong = playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex];
            moreInfoBtn.setAttribute('title', `More options for ${currentSong.title.replace(/"/g, '&quot;')}`);
        }
    } else if (tab === 'queue' || tab === 'recently-played') {
        if (closeBtn) closeBtn.style.display = 'flex';
    }

    if (tab === 'recently-played') {
        renderPortableRecentlyPlayed();
    }

    updateInfoButtonVisibility();

    updateScrollbarById('right-panel-content');
}

function updateRightPanelHeader(tab) {
    const headerTitle = document.getElementById('right-panel-header-title');
    const recentText = document.getElementById('recently-played-text');

    if (!headerTitle || !recentText) return;

    headerTitle.classList.remove('active-underline', 'source-name-header');
    recentText.classList.remove('active-underline');
    headerTitle.removeAttribute('oncontextmenu');

    if (tab === 'queue') {
        headerTitle.textContent = 'Queue';
        headerTitle.classList.add('active-underline');
        recentText.style.display = 'inline';
        headerTitle.style.pointerEvents = 'auto';
        headerTitle.style.cursor = 'pointer';
        headerTitle.setAttribute('onclick', 'switchToQueuePanel()');
    } else if (tab === 'metadata') {
        headerTitle.textContent = 'Metadata';
        headerTitle.classList.add('active-underline');
        recentText.style.display = 'none';
        headerTitle.style.pointerEvents = 'auto';
        headerTitle.style.cursor = 'pointer';
        headerTitle.setAttribute('onclick', 'closeMetadataEditor()');
    } else if (tab === 'tags') {
        const sourceName = getCurrentPlayingSourceName();
        headerTitle.textContent = sourceName;
        headerTitle.classList.add('source-name-header');
        headerTitle.style.pointerEvents = 'auto';
        headerTitle.style.cursor = 'pointer';
        headerTitle.setAttribute('onclick', 'navigateToCurrentSourceView()');
        headerTitle.setAttribute('oncontextmenu', 'showCurrentSourceContextMenu(event)');
        recentText.style.display = 'none';
    } else if (tab === 'recently-played') {
        headerTitle.textContent = 'Queue';
        recentText.classList.add('active-underline');
        recentText.style.display = 'inline';
        headerTitle.style.pointerEvents = 'auto';
        headerTitle.style.cursor = 'pointer';
        headerTitle.setAttribute('onclick', 'switchToQueuePanel()');
    }
}

function getCurrentPlayingSourceName() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) {
        return 'Track Info';
    }

    const queueItem = playbackQueue[currentQueueIndex];
    const listId = queueItem.listId || 'all-songs';

    if (listId === 'all-songs') {
        return 'All Songs';
    } else if (listId === 'favorites') {
        return 'Liked Songs';
    } else if (listId === 'history') {
        return 'Recents';
    } else if (listId && listId.startsWith('playlist-')) {
        const playlistId = listId.replace('playlist-', '');
        const playlists = getPlaylists();
        const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
        return playlist ? playlist.name : 'Playlist';
    } else if (listId && listId.startsWith('a') && listId.length === 13) {
        const albums = getAlbums();
        const album = albums.find((a) => a.id === listId);
        return album ? album.name : 'Album';
    } else if (listId && listId.startsWith('r') && listId.length === 13) {
        const artists = getArtists();
        const artist = artists.find((a) => a.id === listId);
        return artist ? artist.name : 'Artist';
    }

    return 'Track Info';
}

function navigateToCurrentSourceView() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) {
        return;
    }

    const queueItem = playbackQueue[currentQueueIndex];
    const listId = queueItem.listId || 'all-songs';

    if (listId === 'all-songs') {
        switchView('all-songs');
    } else if (listId === 'favorites') {
        switchView('favorites');
    } else if (listId === 'history') {
        switchView('history');
    } else if (listId && listId.startsWith('playlist-')) {
        const playlistId = listId.replace('playlist-', '');
        openPlaylist(playlistId);
    } else if (listId && listId.startsWith('a') && listId.length === 13) {
        openDetailView(listId, 'album');
    } else if (listId && listId.startsWith('r') && listId.length === 13) {
        openDetailView(listId, 'artist');
    }
}

function showCurrentSourceContextMenu(event) {
    event.stopPropagation();
    event.preventDefault();

    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return;

    const queueItem = playbackQueue[currentQueueIndex];
    const listId = queueItem.listId || 'all-songs';

    if (listId === 'all-songs') {
        showSpecialItemContextMenu(event, 'all-songs', 'All Songs');
    } else if (listId === 'favorites') {
        showSpecialItemContextMenu(event, 'favorites', 'Liked Songs');
    } else if (listId === 'history') {
        showSpecialItemContextMenu(event, 'history', 'Recents');
    } else if (listId.startsWith('playlist-')) {
        const playlistId = listId.replace('playlist-', '');
        showPlaylistContextMenu(event, playlistId);
    } else if (listId.startsWith('a') && listId.length === 13) {
        showAlbumContextMenu(event, listId);
    } else if (listId.startsWith('r') && listId.length === 13) {
        showArtistContextMenu(event, listId);
    }
}

function switchToRecentlyPlayedPanel() {
    if (!document.getElementById('recently-played-content').classList.contains('active')) {
        switchRightPanelTab('recently-played');
    }
}

function switchToQueuePanel() {
    switchRightPanelTab('queue');
}

// ==============================================================================
// SETTINGS PANEL
// ==============================================================================
function openSettingsPanel() {
    if (advancedSettingsOpen) {
        renderAdvancedSettingsPanel();
        return;
    }

    const songList = songListElement;
    const songListContainer = document.getElementById('song-list-container');
    const settingsButton = document.querySelector('.settings-toggle-btn');

    if (!songList || !songListContainer) {
        return;
    }

    resetLeftPanelActiveState();
    if (settingsButton) {
        settingsButton.classList.add('active');
    }
    if (typeof updateActiveHighlight === 'function') {
        updateActiveHighlight(null);
    }
    pushViewToHistory('settings');
    const smartShuffleSettings = getSmartShuffleSettings();

    showHeroSection(false);
    showTracklistHeader(false);

    setSubheroVisibility('settings');

    const gradientWrapper = document.querySelector('.content-gradient-wrapper');
    if (gradientWrapper) gradientWrapper.classList.add('no-gradient');

    songList.style.display = 'flex';
    songList.style.justifyContent = 'center';
    songList.innerHTML = `
    <div class="settings-panel-content">
            <h3 class="settings-panel-title">Settings</h3>
                <div class="settings-panel-actions">
                    <button class="settings-action-btn" onclick="switchToHistoryFromSettings();">
                        <i class="fas fa-history"></i>
                        <span>View Play History</span>
                    </button>
                    <button class="settings-action-btn" onclick="switchToSearchHistoryFromSettings();">
                        <i class="fas fa-search"></i>
                        <span>Search History</span>
                    </button>
                    <div class="settings-section">
                        <div class="settings-section-title">Theme Color</div>
                        <div class="settings-theme-selector" id="settings-theme-selector">
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Right Panel</div>
                        <label class="settings-toggle-row">
                            <input
                                type="checkbox"
                                id="settings-hide-right-panel-lyrics"
                                onchange="toggleHideRightPanelLyrics(this.checked)"
                            >
                            <span>Remove right panel lyrics</span>
                        </label>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Window</div>
                        <label class="settings-toggle-row">
                        <input
                            type="checkbox"
                            ${getWindowSettings().minimizeOnClose ? 'checked' : ''}
                            onchange="setMinimizeOnClose(this.checked)"
                        >
                        <span>Minimize to taskbar when closed</span>
                        </label>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Playback & Audio</div>
                        <label class="settings-toggle-row"><input type="checkbox" ${getAudioPlaybackSettings().crossfadeEnabled ? 'checked' : ''} onchange="setAudioPlaybackSetting('crossfadeEnabled', this.checked)"><span>Crossfade between tracks</span></label>
                        <div class="settings-threshold-row"><span>Crossfade length</span><input type="range" min="0.5" max="10" step="0.5" value="${Number(getAudioPlaybackSettings().crossfadeDuration) || 4}" oninput="setAudioPlaybackSetting('crossfadeDuration', Number(this.value)); this.nextElementSibling.textContent = this.value + 's'" aria-label="Crossfade duration"><span>${Number(getAudioPlaybackSettings().crossfadeDuration) || 4}s</span></div>
                        <label class="settings-toggle-row"><input type="checkbox" ${getAudioPlaybackSettings().gaplessEnabled ? 'checked' : ''} onchange="setAudioPlaybackSetting('gaplessEnabled', this.checked)"><span>Gapless playback</span></label>
                        <label class="settings-toggle-row"><input type="checkbox" ${getAudioPlaybackSettings().fadeInEnabled ? 'checked' : ''} onchange="setAudioPlaybackSetting('fadeInEnabled', this.checked)"><span>Fade in</span></label>
                        <div class="settings-threshold-row"><span>Fade in length</span><input type="range" min="0.2" max="5" step="0.1" value="${Number(getAudioPlaybackSettings().fadeInDuration) || 1}" oninput="setAudioPlaybackSetting('fadeInDuration', Number(this.value)); this.nextElementSibling.textContent = this.value + 's'" aria-label="Fade in duration"><span>${Number(getAudioPlaybackSettings().fadeInDuration) || 1}s</span></div>
                        <label class="settings-toggle-row"><input type="checkbox" ${getAudioPlaybackSettings().fadeOutEnabled ? 'checked' : ''} onchange="setAudioPlaybackSetting('fadeOutEnabled', this.checked)"><span>Fade out</span></label>
                        <div class="settings-threshold-row"><span>Fade out length</span><input type="range" min="0.2" max="5" step="0.1" value="${Number(getAudioPlaybackSettings().fadeOutDuration) || 1.25}" oninput="setAudioPlaybackSetting('fadeOutDuration', Number(this.value)); this.nextElementSibling.textContent = this.value + 's'" aria-label="Fade out duration"><span>${Number(getAudioPlaybackSettings().fadeOutDuration) || 1.25}s</span></div>
                        <label class="settings-toggle-row"><input type="checkbox" ${getAudioPlaybackSettings().replayGainEnabled ? 'checked' : ''} onchange="setAudioPlaybackSetting('replayGainEnabled', this.checked)"><span>ReplayGain / loudness normalization</span></label>
                        <div class="settings-threshold-row"><span>Gain mode</span><select onchange="setAudioPlaybackSetting('replayGainMode', this.value)">
                            ${['track', 'album'].map((value) => `<option value="${value}" ${getAudioPlaybackSettings().replayGainMode === value ? 'selected' : ''}>${value.charAt(0).toUpperCase() + value.slice(1)}</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Trim</span><input type="range" min="-6" max="6" step="0.5" value="${Number(getAudioPlaybackSettings().replayGainTrimDb) || 0}" oninput="setAudioPlaybackSetting('replayGainTrimDb', Number(this.value)); this.nextElementSibling.textContent = (Number(this.value) > 0 ? '+' : '') + this.value + ' dB'" aria-label="ReplayGain trim"><span>${(Number(getAudioPlaybackSettings().replayGainTrimDb) || 0) > 0 ? '+' : ''}${Number(getAudioPlaybackSettings().replayGainTrimDb) || 0} dB</span></div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Smart Shuffle v1</div>
                        <div class="settings-threshold-hint" style="margin-bottom: 12px;">Uses local metadata, favorites, and playback history. It is available in lists with more than 50 songs.</div>
                        <div class="settings-threshold-row"><span>Journey size</span><select onchange="setSmartShuffleSetting('journeySize', this.value)">
                            ${[25, 50, 100, 250, 500].map((size) => `<option value="${size}" ${Number(smartShuffleSettings.journeySize) === size ? 'selected' : ''}>${size} songs</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Custom journey size</span><input type="number" min="1" value="${Number(smartShuffleSettings.journeySize) || 50}" onchange="setSmartShuffleSetting('journeySize', this.value)" aria-label="Custom journey size"></div>
                        <div class="settings-threshold-row"><span>Similar-song group</span><select onchange="setSmartShuffleSetting('groupSize', this.value)">
                            ${[1, 3, 5, 10].map((size) => `<option value="${size}" ${Number(smartShuffleSettings.groupSize) === size ? 'selected' : ''}>${size} songs</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Genre flow</span><select onchange="setSmartShuffleSetting('genreFlow', this.value)">
                            ${['off', 'gentle', 'strong'].map((value) => `<option value="${value}" ${smartShuffleSettings.genreFlow === value ? 'selected' : ''}>${value.charAt(0).toUpperCase() + value.slice(1)}</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Artist separation</span><select onchange="setSmartShuffleSetting('artistSeparation', this.value)">
                            ${['off', 'normal', 'strong'].map((value) => `<option value="${value}" ${smartShuffleSettings.artistSeparation === value ? 'selected' : ''}>${value.charAt(0).toUpperCase() + value.slice(1)}</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Avoid recently played</span><select onchange="setSmartShuffleSetting('recentLimit', this.value)">
                            ${[0, 25, 50, 100].map((size) => `<option value="${size}" ${Number(smartShuffleSettings.recentLimit) === size ? 'selected' : ''}>${size === 0 ? 'Off' : `${size} songs`}</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Favorites</span><select onchange="setSmartShuffleSetting('favoriteWeight', this.value)">
                            ${['neutral', 'prefer', 'strong'].map((value) => `<option value="${value}" ${smartShuffleSettings.favoriteWeight === value ? 'selected' : ''}>${value.charAt(0).toUpperCase() + value.slice(1)}</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Discovery</span><select onchange="setSmartShuffleSetting('discoveryWeight', this.value)">
                            ${['neutral', 'prefer', 'strong'].map((value) => `<option value="${value}" ${smartShuffleSettings.discoveryWeight === value ? 'selected' : ''}>${value.charAt(0).toUpperCase() + value.slice(1)}</option>`).join('')}
                        </select></div>
                        <label class="settings-toggle-row"><input type="checkbox" ${smartShuffleSettings.durationVariety ? 'checked' : ''} onchange="setSmartShuffleSetting('durationVariety', this.checked)"><span>Balance song durations</span></label>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Music Library</div>
                        <button class="settings-action-btn settings-action-btn-full" onclick="changeMusicFolder()">
                            <i class="fas fa-folder-open"></i>
                            <span>Change Music Folder (Legacy)</span>
                        </button>
                    </div>
<div class="library-locations-section">
<div class="library-locations-header">
<span class="library-locations-title">Music Library Folders</span>
<div class="library-locations-header-buttons">
<button class="library-locations-add-btn" onclick="addLibraryLocation()">
<i class="fas fa-plus"></i>
Add Folder
</button>
<button class="library-locations-add-btn" onclick="removeSelectedLibraryFolder()" style="border-color: #ff4444; color: #ff4444;">
<i class="fas fa-trash-alt"></i>
Remove Folder
</button>
</div>
</div>
<div class="library-locations-list-container">
<div class="library-locations-list" id="library-locations-list">
<div class="empty-queue" style="padding: 20px; text-align: center;">
<i class="fas fa-folder-open"></i>
<p>No folders added</p>
<small>Click "Add Folder" to include music locations</small>
</div>
</div>
</div>
<div class="library-locations-footer">
<button class="library-locations-rebuild-btn" onclick="rebuildLibraryFromFolders()">
<i class="fas fa-save"></i>
Save and Apply Changes
</button>
</div>
</div>
                    <div class="settings-section">
                        <div class="settings-section-title">Play from URL — Save Location</div>
                        <div class="settings-url-save-row">
                            <div class="settings-url-save-path" id="url-save-path-display" title="">—</div>
                            <button class="settings-action-btn settings-action-btn-half" onclick="changeUrlSaveFolder()">
                                <i class="fas fa-folder-open"></i>
                                <span>Change</span>
                            </button>
                            <button class="settings-action-btn settings-action-btn-half" onclick="resetUrlSaveFolder()">
                                <i class="fas fa-undo"></i>
                                <span>Reset</span>
                            </button>
                        </div>
                        <div class="settings-threshold-hint" style="margin-top: 8px;">
                            Songs downloaded via "Play from URL → Download & Stream" will be saved here.
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Backup & Restore</div>
                        <div class="settings-backup-row">
                            <button class="settings-action-btn settings-action-btn-half" onclick="exportAllData()">
                                <i class="fas fa-download"></i>
                                <span>Export Data</span>
                            </button>
                            <button class="settings-action-btn settings-action-btn-half" onclick="importAllData()">
                                <i class="fas fa-upload"></i>
                                <span>Import Data</span>
                            </button>
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Advanced</div>
                        <button class="settings-action-btn settings-action-btn-full" onclick="openAdvancedSettings()">
                            <i class="fas fa-sliders-h"></i>
                            <span>Advanced Settings</span>
                        </button>
                    </div>
                </div>
            </div>
    `;

    renderLibraryLocations();
    refreshUrlSaveFolderDisplay();
    updateSettingsMargins();

    const currentTheme = document.body.classList.contains('theme-pink')
        ? 'pink'
        : document.body.classList.contains('theme-purple')
        ? 'purple'
        : document.body.classList.contains('theme-yellow')
        ? 'yellow'
        : document.body.classList.contains('theme-white')
        ? 'white'
        : 'green';

    const themes = [
        {
            name: 'green',
            color: '#1db954'
        },
        {
            name: 'pink',
            color: '#ff6b9d'
        },
        {
            name: 'purple',
            color: '#9d4edd'
        },
        {
            name: 'yellow',
            color: '#ffd43b'
        },
        {
            name: 'white',
            color: '#f8f9fa'
        }
    ];

    const themeSelector = document.getElementById('settings-theme-selector');
    if (themeSelector) {
        themeSelector.innerHTML = themes
            .map(
                (t) =>
                    `<button class="settings-theme-btn${t.name === currentTheme ? ' active' : ''}" data-theme="${
                        t.name
                    }" aria-label="${t.name.charAt(0).toUpperCase() + t.name.slice(1)} theme">
                    <i class="fas fa-circle settings-theme-icon" style="color: ${t.color};"></i>
            </button>`
            )
            .join('');
    }

    const hideLyricsCheckbox = document.getElementById('settings-hide-right-panel-lyrics');
    if (hideLyricsCheckbox) {
        hideLyricsCheckbox.checked = getHideRightPanelLyrics();
    }

    initThemeButtons();

    setTimeout(() => {
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 50);
}

function setSmartShuffleSetting(key, value) {
    const numericSettings = ['journeySize', 'groupSize', 'recentLimit'];
    saveSmartShuffleSetting(key, numericSettings.includes(key) ? Number(value) : value);
    showNotification('Smart Shuffle setting saved', 'success', 1500);
}

function openAdvancedSettings() {
    pushViewToHistory('settings-advanced');
    advancedSettingsOpen = true;
    renderAdvancedSettingsPanel();
}

function closeAdvancedSettings() {
    pushViewToHistory('settings');
    advancedSettingsOpen = false;
    openSettingsPanel();
}

function renderAdvancedSettingsPanel() {
    const songList = songListElement;

    const settings = getExtendedMetadataSettings();
    const groupOrder = ['People', 'Structure', 'Publishing', 'Identifiers', 'Technical', 'Misc', 'Sort'];
    const groups = {};
    EXTENDED_METADATA_FIELDS.forEach((f) => {
        if (!groups[f.group]) groups[f.group] = [];
        groups[f.group].push(f);
    });

    let checkboxHTML = '';
    groupOrder.forEach((groupName) => {
        if (!groups[groupName]) return;
        const visibleFields = groups[groupName].filter((f) => !f.hidden);
        if (visibleFields.length === 0) return;
        checkboxHTML += `<div class="extended-fields-group-label">${escapeHtml(groupName)}</div>`;
        visibleFields.forEach((f) => {
            const checked = settings[f.key] ? 'checked' : '';
            checkboxHTML += `
                <label class="extended-field-checkbox-row">
                    <input type="checkbox" ${checked}
                           onchange="toggleExtendedMetadataField('${f.key}', this.checked)">
                    <span>${escapeHtml(f.label)}</span>
                </label>`;
        });
    });

    songList.style.display = 'flex';
    songList.style.justifyContent = 'center';
    songList.innerHTML = `
    <div class="settings-panel-content">
            <div class="settings-advanced-header">
                    <button class="settings-advanced-back-btn" onclick="closeAdvancedSettings()" aria-label="Back to settings">
                            <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h3 class="settings-panel-title" style="margin: 0; border-bottom: none; padding-bottom: 0;">Advanced Settings</h3>
            </div>
            <div class="settings-advanced-body">
                    <div class="settings-section">
                            <div class="settings-section-title">Virtual Scroll Threshold</div>
                            <div class="settings-threshold-row">
                                    <input type="range" class="settings-threshold-slider" id="threshold-slider"
                                           min="${MIN_VIRTUAL_SCROLL_THRESHOLD}"
                                           max="${MAX_VIRTUAL_SCROLL_THRESHOLD}"
                                           step="50"
                                           value="${VIRTUAL_SCROLL_THRESHOLD}"
                                           oninput="handleThresholdInput(this.value)"
                                           aria-label="Virtual scroll threshold">
                                    <div class="settings-threshold-value" id="threshold-value-display">${VIRTUAL_SCROLL_THRESHOLD}</div>
                            </div>
                            <div class="settings-threshold-hint">
                                    Lists with more than <span id="threshold-hint-value">${VIRTUAL_SCROLL_THRESHOLD}</span> items will use virtual scrolling.
                            </div>
                    </div>
                    <div class="settings-section">
                            <div class="settings-section-title">Extended Track Info</div>
                            <div class="settings-threshold-hint" style="margin-bottom: 12px;">
                                    Enable fields to extract and display below the standard Track Info section.
                            </div>
                            <div class="extended-fields-list">
                                    ${checkboxHTML}
                            </div>
                    </div>
<div class="library-locations-section">
<div class="library-locations-header">
<span class="library-locations-title">Saved Lyrics</span>
<div class="library-locations-header-buttons">
<button class="library-locations-add-btn" onclick="removeAllSavedLyrics()" style="border-color: #ff4444; color: #ff4444;">
<i class="fas fa-trash-alt"></i>
Remove All
</button>
</div>
</div>
<div class="library-locations-list-container">
<div class="library-locations-list" id="saved-lyrics-list">
</div>
</div>
</div>
            </div>
    </div>
    `;

    renderSavedLyricsList();

    updateSettingsMargins();

    updateThresholdSliderFill(VIRTUAL_SCROLL_THRESHOLD);

    setTimeout(() => {
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 50);
}

function handleThresholdInput(value) {
    if (typeof snapVirtualScrollThreshold !== 'function') return;

    const v = snapVirtualScrollThreshold(value);

    const display = document.getElementById('threshold-value-display');
    if (display) display.textContent = v;

    const hint = document.getElementById('threshold-hint-value');
    if (hint) hint.textContent = v;

    updateThresholdSliderFill(v);

    if (typeof setVirtualScrollThreshold === 'function') {
        setVirtualScrollThreshold(v);
    }
}

function updateThresholdSliderFill(value) {
    const slider = document.getElementById('threshold-slider');
    if (!slider) return;
    const min = parseInt(slider.min, 10) || 0;
    const max = parseInt(slider.max, 10) || 100;
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--bg-hover) ${pct}%, var(--bg-hover) 100%)`;
}

function enterSettingsFromHistory() {
    advancedSettingsOpen = false;
    currentView = 'settings';
    resetLeftPanelActiveState();
    resetViewScroll();
    setSubheroVisibility('settings');
    showHeroSection(false);
    showTracklistHeader(false);
    updateHeroCover('settings');

    const settingsToggleBtn = document.querySelector('.settings-toggle-btn');
    if (settingsToggleBtn) settingsToggleBtn.classList.add('active');

    openSettingsPanel();
}

function enterAdvancedSettingsFromHistory() {
    advancedSettingsOpen = true;
    currentView = 'settings';
    resetLeftPanelActiveState();
    resetViewScroll();
    setSubheroVisibility('settings');
    showHeroSection(false);
    showTracklistHeader(false);
    updateHeroCover('settings');

    const settingsToggleBtn = document.querySelector('.settings-toggle-btn');
    if (settingsToggleBtn) settingsToggleBtn.classList.add('active');

    renderAdvancedSettingsPanel();
}

function closeSettingsPanelOnly() {
    advancedSettingsOpen = false;
    if (currentView === 'all-songs') {
        teardownLazyLoading();
    }

    const settingsButton = document.querySelector('.settings-toggle-btn');
    const songList = songListElement;

    if (settingsButton) {
        settingsButton.classList.remove('active');
    }
    if (songList) {
        songList.style.display = '';
        songList.style.justifyContent = '';
    }

    const gradientWrapper = document.querySelector('.content-gradient-wrapper');
    if (gradientWrapper) gradientWrapper.classList.remove('no-gradient');

    const viewToRestore = currentView === 'settings' ? 'all-songs' : currentView;
    switchView(viewToRestore);
    updateSettingsMargins();
}

function closeSettingsPanel() {
    closeSettingsPanelOnly();
}

function toggleSettingsPanel() {
    if (currentView === 'settings' && advancedSettingsOpen) {
        closeAdvancedSettings();
        return;
    }
    if (currentView === 'settings') {
        closeSettingsPanelOnly();
    } else {
        if (currentView === 'lyrics' || currentView === 'online-lyrics') {
            if (typeof teardownLyricsView === 'function') {
                teardownLyricsView();
            }
            document.body.classList.remove('in-lyrics-view');
            const songListContainer = document.getElementById('song-list-container');
            if (songListContainer) songListContainer.style.display = '';
            const lyricsToggleBtn = document.getElementById('lyrics-toggle-btn');
            if (lyricsToggleBtn) lyricsToggleBtn.classList.remove('active');
            lyricsSavedView = null;
        }

        advancedSettingsOpen = false;
        pushViewToHistory('settings');
        currentView = 'settings';
        resetLeftPanelActiveState();
        resetViewScroll();

        if (typeof clearAllSelections === 'function') {
            clearAllSelections();
        }

        resetSearchState();
        resetSubheroSearch();

        const settingsToggleBtn = document.querySelector('.settings-toggle-btn');
        if (settingsToggleBtn) {
            settingsToggleBtn.classList.add('active');
        }

        setSubheroVisibility('settings');
        showHeroSection(false);
        showTracklistHeader(false);
        openSettingsPanel();

        updateHeroCover('settings');

        setTimeout(() => {
            if (typeof updateExternalScrollbar === 'function') {
                updateExternalScrollbar();
            }
        }, 50);
    }
}

async function refreshUrlSaveFolderDisplay() {
    const el = document.getElementById('url-save-path-display');
    if (!el) return;
    if (!window.electronAPI || !window.electronAPI.getDownloadFolder) {
        el.textContent = 'Not available in browser mode';
        el.title = '';
        return;
    }
    try {
        const res = await window.electronAPI.getDownloadFolder();
        if (res && res.folder) {
            el.textContent = res.folder;
            el.title = res.folder;
        } else {
            el.textContent = '—';
            el.title = '';
        }
    } catch (e) {
        el.textContent = '—';
        el.title = '';
    }
}

async function changeUrlSaveFolder() {
    if (!window.electronAPI || !window.electronAPI.pickDownloadFolder) {
        showNotification('Not available in browser mode', 'warning', 2000);
        return;
    }
    const res = await window.electronAPI.pickDownloadFolder();
    if (res && res.success) {
        await refreshUrlSaveFolderDisplay();
        showNotification('Download folder updated', 'success', 2000);
    } else if (res && res.reason !== 'cancelled') {
        showNotification('Failed to change folder', 'error', 2000);
    }
}

async function resetUrlSaveFolder() {
    if (!window.electronAPI || !window.electronAPI.pickDownloadFolder) {
        showNotification('Not available in browser mode', 'warning', 2000);
        return;
    }
    const confirmed = await showConfirmDialog({
        title: 'Reset Download Folder',
        message: 'Reset the Play-from-URL save location back to your system Downloads folder?',
        okText: 'Reset',
        cancelText: 'Cancel'
    });
    if (!confirmed) return;
    const res = await window.electronAPI.resetDownloadFolder?.();
    if (res && res.success) {
        await refreshUrlSaveFolderDisplay();
        showNotification('Reset to default Downloads folder', 'success', 2000);
    } else {
        await refreshUrlSaveFolderDisplay();
        showNotification('Reset to default Downloads folder', 'success', 2000);
    }
}

// ==============================================================================
// EXTENDED METADATA SETTINGS
// ==============================================================================
function getExtendedMetadataSettings() {
    try {
        const saved = localStorage.getItem('extendedMetadataEnabled');
        if (saved) {
            const parsed = JSON.parse(saved);
            const result = {};
            EXTENDED_METADATA_FIELDS.forEach((f) => {
                if (f.hidden) {
                    result[f.key] = false;
                    return;
                }
                result[f.key] = parsed[f.key] !== undefined ? !!parsed[f.key] : !!f.defaultOn;
            });
            return result;
        }
    } catch (e) {}
    const defaults = {};
    EXTENDED_METADATA_FIELDS.forEach((f) => {
        defaults[f.key] = f.hidden ? false : !!f.defaultOn;
    });
    return defaults;
}

function saveExtendedMetadataSettings(settings) {
    localStorage.setItem('extendedMetadataEnabled', JSON.stringify(settings));
}

function toggleExtendedMetadataField(fieldKey, enabled) {
    const settings = getExtendedMetadataSettings();
    settings[fieldKey] = !!enabled;
    saveExtendedMetadataSettings(settings);
    updateInfoButtonVisibility();
}

function getHideRightPanelLyrics() {
    return localStorage.getItem('hideRightPanelLyrics') === 'true';
}

function setHideRightPanelLyrics(value) {
    localStorage.setItem('hideRightPanelLyrics', value ? 'true' : 'false');
    if (typeof renderTrackLyricsBox === 'function') {
        renderTrackLyricsBox();
    }
}

function toggleHideRightPanelLyrics(checked) {
    setHideRightPanelLyrics(!!checked);
}

// ==============================================================================
// SAVED LYRICS MANAGEMENT
// ==============================================================================
function getSavedLyricsEntries() {
    const store = getCustomLyricsStore();
    const entries = [];
    const activeSongs = getActiveSongs();

    for (const key in store) {
        const text = store[key];
        if (!text || String(text).trim() === '') continue;

        let song = null;

        if (isNaN(parseInt(key, 10)) || String(parseInt(key, 10)) !== key) {
            song = activeSongs.find((s) => s.url === key);
        }
        if (!song) {
            const idNum = parseInt(key, 10);
            if (!isNaN(idNum)) {
                song = activeSongs.find((s) => s.id === idNum);
            }
        }

        entries.push({
            key: key,
            text: String(text),
            song: song,
            title: song ? song.title : 'Unknown Track',
            artist: song ? song.artist : 'Unknown Artist',
            duration: song ? song.duration : '—',
            missing: !song
        });
    }

    entries.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    return entries;
}

function renderSavedLyricsList() {
    const container = document.getElementById('saved-lyrics-list');
    if (!container) return;

    const entries = getSavedLyricsEntries();

    if (entries.length === 0) {
        container.innerHTML = `
            <div class="empty-queue" style="padding: 40px 20px; text-align: center;">
                <i class="fas fa-align-left" style="font-size: 32px; opacity: 0.5;"></i>
                <p style="margin-top: 12px;">No saved lyrics</p>
                <small>Edited or added lyrics will appear here</small>
            </div>
        `;
        return;
    }

    container.innerHTML = entries
        .map((entry, idx) => {
            const safeKey = escapeHtml(entry.key);
            const titleText = escapeHtml(entry.title || 'Unknown Track');
            const artistText = entry.missing ? 'File not found' : escapeHtml(entry.artist || 'Unknown Artist');
            const icon = entry.missing ? 'fa-unlink' : 'fa-file-alt';
            const iconColor = entry.missing ? '#ff4444' : '';

            return `
            <div class="library-location-item" data-lyrics-key="${safeKey}" onclick="openSavedLyricsViewer('${safeKey.replace(
                /'/g,
                "\\'"
            )}')">
                <div class="library-location-name">
                    <i class="fas ${icon}" style="${iconColor ? 'color: ' + iconColor + ';' : ''}"></i>
                    <span>${titleText}</span>
                </div>
                <div class="library-location-path" title="${escapeHtml(
                    entry.text.substring(0, 200)
                )}">${artistText}</div>
                <div class="library-location-song-count">${entry.duration}</div>
            </div>
        `;
        })
        .join('');
}

function openSavedLyricsViewer(key) {
    const store = getCustomLyricsStore();
    if (store[key] === undefined) return;

    let song = null;
    const activeSongs = getActiveSongs();

    if (isNaN(parseInt(key, 10)) || String(parseInt(key, 10)) !== key) {
        song = activeSongs.find((s) => s.url === key);
    }
    if (!song) {
        const idNum = parseInt(key, 10);
        if (!isNaN(idNum)) song = activeSongs.find((s) => s.id === idNum);
    }

    const title = song ? song.title : 'Unknown Track';
    const artist = song ? song.artist : 'Unknown Artist';
    const lyricsText = store[key];

    let overlay = document.getElementById('saved-lyrics-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'saved-lyrics-overlay';
        overlay.className = 'extended-info-overlay';
        overlay.onclick = closeSavedLyricsViewer;
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="extended-info-modal saved-lyrics-modal" onclick="event.stopPropagation()">
            <div class="extended-info-header">
                <div>
                    <div class="extended-info-title">${escapeHtml(title)}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(
                        artist
                    )}</div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="extended-info-close" onclick="deleteSavedLyricsEntry('${key.replace(
                        /'/g,
                        "\\'"
                    )}')" title="Delete lyrics" aria-label="Delete lyrics" style="color: #ff4444;">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                    <button class="extended-info-close" onclick="closeSavedLyricsViewer()" aria-label="Close">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
            </div>
            <div class="extended-info-body saved-lyrics-body">${escapeHtml(
                String(lyricsText).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
            )}</div>
        </div>
    `;

    overlay.classList.add('active');
    document.addEventListener('keydown', savedLyricsKeyHandler);
}

function closeSavedLyricsViewer() {
    const overlay = document.getElementById('saved-lyrics-overlay');
    if (overlay) overlay.classList.remove('active');
    document.removeEventListener('keydown', savedLyricsKeyHandler);
}

function savedLyricsKeyHandler(e) {
    if (e.key === 'Escape') {
        closeSavedLyricsViewer();
    }
}

function deleteSavedLyricsEntry(key) {
    const store = getCustomLyricsStore();
    delete store[key];
    saveCustomLyricsStore(store);

    closeSavedLyricsViewer();
    renderSavedLyricsList();

    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const queueItem = playbackQueue[currentQueueIndex];
        const song = queueItem.song || queueItem;
        if (song.url === key || String(song.id) === key) {
            if (currentView === 'lyrics') renderLyricsView();
            if (typeof renderTrackLyricsBox === 'function') renderTrackLyricsBox();
        }
    }
}

async function removeAllSavedLyrics() {
    const entries = getSavedLyricsEntries();
    if (entries.length === 0) {
        showNotification('No saved lyrics to remove', 'warning', 2000);
        return;
    }

    const confirmed = await showConfirmDialog({
        title: 'Remove All Saved Lyrics',
        message: `Remove all ${entries.length} saved lyrics entries? This cannot be undone.`,
        okText: 'Remove All',
        cancelText: 'Cancel'
    });

    if (!confirmed) return;

    saveCustomLyricsStore({});
    renderSavedLyricsList();
    showNotification(`Removed ${entries.length} saved lyrics`, 'success', 2000);

    if (currentView === 'lyrics') {
        renderLyricsView();
    }
}

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

function performSearch() {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
        searchQuery = document.getElementById('search-input').value.toLowerCase().trim();

        if (searchQuery === '') {
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

            currentSearchSessionId = 'Search' + Date.now();
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
    }, 500);
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

    const filtered = songs.filter(
        (s) =>
            s.title.toLowerCase().includes(query) ||
            s.artist.toLowerCase().includes(query) ||
            s.album.toLowerCase().includes(query)
    );

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

        if (itemText.toLowerCase().includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });

    updateScrollbarById('left-panel-main-content');
}

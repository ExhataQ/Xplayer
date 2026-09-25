// ==============================================================================
// TRACK LYRICS BOX
// ==============================================================================
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

    const songForMode = song;
    const storedMode = typeof getLyricsDisplayMode === 'function' ? getLyricsDisplayMode(songForMode) : 'auto';
    const hasSyncedForBox = parsedSynced && parsedSynced.length > 0;
    const hasPlainForBox = plainText && String(plainText).trim() !== '';
    let boxMode = 'auto';
    if (hasSyncedForBox && hasPlainForBox) {
        boxMode = storedMode === 'plain' ? 'plain' : 'synced';
    } else if (hasSyncedForBox) {
        boxMode = 'synced';
    } else if (hasPlainForBox) {
        boxMode = 'plain';
    }

    if (boxMode === 'synced' && parsedSynced && parsedSynced.length > 0) {
        trackLyricsEntries = parsedSynced;
        text.classList.add('track-lyrics-synced');
        text.innerHTML = parsedSynced
            .map((entry, i) => {
                if (entry.instrumental) {
                    return `<div class="track-lyrics-line track-lyrics-line-instrumental" data-index="${i}" dir="auto"><span class="material-symbols-outlined">music_note</span></div>`;
                }
                if (entry.text.trim() === '') {
                    return `<div class="track-lyrics-line track-lyrics-line-empty" data-index="${i}" dir="auto"></div>`;
                }
                return `<div class="track-lyrics-line" data-index="${i}" dir="auto">${escapeHtml(entry.text)}</div>`;
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
                if (line.trim() === '') return `<div class="track-lyrics-line track-lyrics-line-empty" dir="auto"></div>`;
                return `<div class="track-lyrics-line" dir="auto">${escapeHtml(line)}</div>`;
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

    const checkScrollSettled = debounce(() => {
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

    function onScroll() {
        if (trackLyricsProgrammaticScroll) return;
        checkScrollSettled();
    }

    container.addEventListener('scroll', onScroll, { passive: true });
    trackLyricsScrollCleanup = () => {
        container.removeEventListener('scroll', onScroll);
        checkScrollSettled.cancel();
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

// The (non-editor) synced-lyrics display: mode/highlight/scroll/follow-button. The LRC parser is lyrics/lrc-parser.js.

let syncedLyricsState = {
    entries: null,
    activeIndex: -1,
    lineElements: [],
    container: null,
    autoScroll: true,
    userScrolledAway: false,
    programmaticScroll: false,
    scrollCleanup: null
};

let lyricsDisplayMode = {
    songId: null,
    mode: 'auto'
};

export function getLyricsDisplayMode(song) {
    if (!song) return 'auto';
    if (lyricsDisplayMode.songId !== song.id) return 'auto';
    return lyricsDisplayMode.mode;
}

export function setLyricsDisplayMode(mode) {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return;
    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;
    if (!song) return;

    const wasSynced = lyricsDisplayMode.songId === song.id && lyricsDisplayMode.mode === 'synced';

    lyricsDisplayMode.songId = song.id;
    lyricsDisplayMode.mode = mode;

    if (currentView === VIEWS.LYRICS) {
        emit('lyrics:changed', { songId: song.id });
    }

    if (typeof renderTrackLyricsBox === 'function') {
        renderTrackLyricsBox();
    }

    if (mode === 'synced' && !wasSynced) {
        refreshSyncedHighlight();
    }
}

export function refreshSyncedHighlight() {
    if (!syncedLyricsState.entries || syncedLyricsState.entries.length === 0) return;
    updateSyncedLyricsHighlight(audioElement.currentTime || 0);
}

export function resetLyricsDisplayMode(songId) {
    lyricsDisplayMode.songId = songId || null;
    lyricsDisplayMode.mode = 'auto';
}

export function initSyncedLyrics(song) {
    resetSyncedLyricsFollowState();
    syncedLyricsState.entries = null;
    syncedLyricsState.activeIndex = -1;
    syncedLyricsState.lineElements = [];

    if (!song) return false;

    const lrc = getSyncedLyricsForSong(song);
    if (!lrc) return false;

    const parsed = parseLRC(lrc);
    if (!parsed) return false;

    syncedLyricsState.entries = parsed;
    return true;
}

export function updateSyncedLyricsHighlight(currentTime) {
    const state = syncedLyricsState;
    if (!state.entries || state.entries.length === 0) return;
    if (!state.lineElements || state.lineElements.length === 0) return;

    let lo = 0,
        hi = state.entries.length - 1,
        found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (state.entries[mid].time <= currentTime) {
            found = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    if (found === state.activeIndex) return;

    const previousIndex = state.activeIndex;

    if (previousIndex >= 0 && state.lineElements[previousIndex]) {
        state.lineElements[previousIndex].classList.remove('synced-active');
    }

    state.activeIndex = found;

    if (found >= 0 && state.lineElements[found]) {
        const el = state.lineElements[found];
        el.classList.add('synced-active');

        for (let i = 0; i < state.lineElements.length; i++) {
            const lineEl = state.lineElements[i];
            if (!lineEl) continue;
            lineEl.classList.toggle('synced-past', i < found);
        }

        if (state.autoScroll && state.container && !state.userScrolledAway) {
            smoothScrollToLine(el);
        }
    } else {
        for (let i = 0; i < state.lineElements.length; i++) {
            const lineEl = state.lineElements[i];
            if (lineEl) lineEl.classList.remove('synced-past');
        }

        if (
            found === -1 &&
            previousIndex !== -1 &&
            state.container &&
            state.autoScroll &&
            !state.userScrolledAway
        ) {
            state.programmaticScroll = true;
            state.container.scrollTo({ top: 0, behavior: 'smooth' });
            markProgrammaticScroll(state);
        }
    }
}

export function smoothScrollToLine(el) {
    const state = syncedLyricsState;
    if (!state.container) return;

    const container = state.container;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offset = elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;
    const targetTop = container.scrollTop + offset;

    state.programmaticScroll = true;
    container.scrollTo({
        top: targetTop,
        behavior: 'smooth'
    });

    markProgrammaticScroll(state);
}

export function markProgrammaticScroll(state) {
    clearTimeout(state._programmaticScrollTimeout);
    state._programmaticScrollTimeout = setTimeout(() => {
        state.programmaticScroll = false;
        state._programmaticScrollTimeout = null;
    }, 700);
}

export function attachSyncedLyricsScrollWatcher() {
    const state = syncedLyricsState;
    if (state.scrollCleanup) {
        state.scrollCleanup();
        state.scrollCleanup = null;
    }

    if (!state.container) return;

    const container = state.container;

    const checkScrollSettled = debounce(() => {
        if (!state.entries || state.activeIndex < 0 || !state.lineElements[state.activeIndex]) return;
        if (state.programmaticScroll) return;

        const containerRect = container.getBoundingClientRect();
        const activeEl = state.lineElements[state.activeIndex];
        const elRect = activeEl.getBoundingClientRect();

        const distanceFromCenter = Math.abs(
            elRect.top + elRect.height / 2 - (containerRect.top + containerRect.height / 2)
        );

        if (distanceFromCenter > containerRect.height * 0.4) {
            state.userScrolledAway = true;
            showFollowLyricsButton();
        } else {
            state.userScrolledAway = false;
            hideFollowLyricsButton();
        }
    }, 180);

    function onScroll() {
        if (state.programmaticScroll) {
            markProgrammaticScroll(state);
            return;
        }

        checkScrollSettled();
    }

    container.addEventListener('scroll', onScroll, {
        passive: true
    });
    state.scrollCleanup = () => {
        container.removeEventListener('scroll', onScroll);
        checkScrollSettled.cancel();
    };
}

export function showFollowLyricsButton() {
    let btn = document.getElementById('follow-lyrics-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'follow-lyrics-btn';
        btn.className = 'follow-lyrics-btn';
        btn.innerHTML = '<span class="material-symbols-outlined">my_location</span><span>Sync</span>';
        btn.onclick = () => {
            syncedLyricsState.userScrolledAway = false;
            hideFollowLyricsButton();
            if (syncedLyricsState.activeIndex >= 0 && syncedLyricsState.lineElements[syncedLyricsState.activeIndex]) {
                smoothScrollToLine(syncedLyricsState.lineElements[syncedLyricsState.activeIndex]);
            }
        };
        document.body.appendChild(btn);
    }
    requestAnimationFrame(() => btn.classList.add('visible'));
}

export function hideFollowLyricsButton() {
    const btn = document.getElementById('follow-lyrics-btn');
    if (!btn) return;
    btn.classList.remove('visible');
}

export function resetSyncedLyricsFollowState() {
    syncedLyricsState.userScrolledAway = false;
    syncedLyricsState.programmaticScroll = false;
    hideFollowLyricsButton();
    if (syncedLyricsState.scrollCleanup) {
        syncedLyricsState.scrollCleanup();
        syncedLyricsState.scrollCleanup = null;
    }
    clearTimeout(syncedLyricsState._programmaticScrollTimeout);
    syncedLyricsState._programmaticScrollTimeout = null;
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        getLyricsDisplayMode,
        setLyricsDisplayMode,
        refreshSyncedHighlight,
        resetLyricsDisplayMode,
        initSyncedLyrics,
        updateSyncedLyricsHighlight,
        smoothScrollToLine,
        markProgrammaticScroll,
        attachSyncedLyricsScrollWatcher,
        showFollowLyricsButton,
        hideFollowLyricsButton,
        resetSyncedLyricsFollowState,
        syncedLyricsState,
        lyricsDisplayMode
    });
}

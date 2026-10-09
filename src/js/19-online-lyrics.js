// ============================================================================
// MULTI-SONG LYRICS FINDER
// ============================================================================
registerActions({
    clearOnlineLyricsSearchInputs,
    clearSmartLyricsSelection,
    closeOnlineLyricsPicker,
    closeOnlineLyricsResult,
    confirmOnlineLyricsPicker,
    copyOnlineLyrics,
    downloadOnlineLyrics,
    handleOnlineLyricsPickerInput,
    handleSmartLyricsFinderSearch,
    nextOnlineLyricsPage,
    openOnlineLyricsPicker,
    openOnlineLyricsResult,
    openSmartLyricsFinder,
    previousOnlineLyricsPage,
    runSmartLyricsFinder,
    searchOnlineLyrics,
    selectAllSmartLyricsSongs,
    selectOnlineLyricsType,
    setSmartLyricsMode,
    stopSmartLyricsFinder,
    switchView: function (...args) {
        return switchView.apply(this, args);
    },
    toggleSmartLyricsSkipExisting,
    toggleSmartLyricsSong,
    useOnlineLyrics
});

const SMART_LYRICS_CONCURRENCY = 5;

let smartLyricsFinderState = {
    mode: 'lrc',
    query: '',
    selectedIds: new Set(),
    processing: false,
    currentIndex: -1,
    results: new Map(),
    status: '',
    stopRequested: false,
    skipExisting: true,
    lrclibCache: new Map()
};

export function openSmartLyricsFinder() {
    smartLyricsFinderState = {
        mode: 'lrc',
        query: '',
        selectedIds: new Set(),
        processing: false,
        currentIndex: -1,
        results: new Map(),
        status: '',
        stopRequested: false,
        skipExisting: true,
        lrclibCache: new Map()
    };
    switchView(VIEWS.SMART_LYRICS);
}

export function getSmartLyricsFinderSongs() {
    const query = String(smartLyricsFinderState.query || '').toLowerCase().trim();
    const songs = typeof SONGS_DATA !== 'undefined' ? SONGS_DATA : (typeof getActiveSongs === 'function' ? getActiveSongs() : []);
    if (!query) return songs;
    const tokens = query.split(/\s+/).filter(Boolean);
    return songs.filter(song => {
        const haystack = `${song.title || ''} ${song.artist || ''} ${song.album || ''}`.toLowerCase();
        return tokens.every(token => haystack.includes(token));
    });
}

export function stopSmartLyricsFinder() {
    if (!smartLyricsFinderState.processing) return;
    smartLyricsFinderState.stopRequested = true;
    smartLyricsFinderState.status = 'Stopping…';
    updateSmartLyricsFinderProgress();
    updateSmartLyricsFinderToolbarState();
}

export function toggleSmartLyricsSkipExisting(checked) {
    if (smartLyricsFinderState.processing) return;
    smartLyricsFinderState.skipExisting = !!checked;
}

export function toggleSmartLyricsSong(songId) {
    if (smartLyricsFinderState.processing) return;
    if (smartLyricsFinderState.selectedIds.has(songId)) smartLyricsFinderState.selectedIds.delete(songId);
    else smartLyricsFinderState.selectedIds.add(songId);
    updateSmartLyricsFinderList();
    updateSmartLyricsFinderSelectionCount();
}

export function selectAllSmartLyricsSongs() {
    if (smartLyricsFinderState.processing) return;
    getSmartLyricsFinderSongs().forEach(song => smartLyricsFinderState.selectedIds.add(song.id));
    updateSmartLyricsFinderList();
    updateSmartLyricsFinderSelectionCount();
}

export function clearSmartLyricsSelection() {
    if (smartLyricsFinderState.processing) return;
    smartLyricsFinderState.selectedIds.clear();
    updateSmartLyricsFinderList();
    updateSmartLyricsFinderSelectionCount();
}

export function setSmartLyricsMode(mode) {
    if (smartLyricsFinderState.processing) return;
    smartLyricsFinderState.mode = mode === 'lyrics' ? 'lyrics' : 'lrc';
    renderSmartLyricsFinder();
}

export function handleSmartLyricsFinderSearch(value) {
    smartLyricsFinderState.query = value || '';
    updateSmartLyricsFinderList();
    updateSmartLyricsFinderSelectionCount();
}

export function updateSmartLyricsFinderSelectionCount() {
    const el = document.getElementById('smart-lyrics-selection-count');
    if (el) el.textContent = `${smartLyricsFinderState.selectedIds.size} selected`;
    updateSmartLyricsFinderToolbarState();
}

export function updateSmartLyricsFinderProgress() {
    const el = document.getElementById('smart-lyrics-progress');
    if (el) el.textContent = smartLyricsFinderState.status || '';
}

export function updateSmartLyricsFinderToolbarState() {
    const processing = smartLyricsFinderState.processing;
    const stopBtn = document.getElementById('smart-lyrics-stop-btn');
    const findSelectedBtn = document.getElementById('smart-lyrics-find-selected');
    const findAllBtn = document.getElementById('smart-lyrics-find-all');
    const skipCheckbox = document.getElementById('smart-lyrics-skip-existing');

    if (stopBtn) stopBtn.style.display = processing ? '' : 'none';
    if (findSelectedBtn) findSelectedBtn.disabled = processing || smartLyricsFinderState.selectedIds.size === 0;
    if (findAllBtn) findAllBtn.disabled = processing;
    if (skipCheckbox) skipCheckbox.disabled = processing;
}

export function buildSmartLyricsRowHTML(song, index) {
    const selected = smartLyricsFinderState.selectedIds.has(song.id);
    const result = smartLyricsFinderState.results.get(song.id);
    const stateClass = result ? (result.success ? 'found' : 'failed') : '';
    const stateText = result ? (result.success ? (result.type === 'lrc' ? 'LRC found' : 'Lyrics found') : 'Not found') : '';
    const coverSrc = song.cover || PLACEHOLDER_IMAGE;
    const artistText = buildSongArtistHTML(song) || escapeHtml(song.artist || 'Unknown artist');
    const albumText = buildSongAlbumHTML(song) || escapeHtml(song.album || '');

    return `
    <div class="song-item smart-lyrics-song-row ${selected ? 'selected' : ''} ${stateClass}" ${actionAttrs('toggleSmartLyricsSong', [song.id])} data-song-id="${song.id}">
        <div class="song-number-item smart-lyrics-checkbox">
            <span class="material-symbols-outlined">${selected ? 'check_box' : 'check_box_outline_blank'}</span>
        </div>
        <div class="left-song-item">
            <img class="song-cover" src="${coverSrc}" alt="Cover for ${escapeHtml(song.title || 'Unknown title')}" data-action-error="replaceBrokenCoverWithPlaceholder" data-args-error='["$this"]'>
            <div class="song-info">
                <div class="song-title">${escapeHtml(song.title || 'Unknown title')}</div>
                <div class="song-artist">${artistText}</div>
            </div>
        </div>
        <div class="song-album">${albumText}</div>
        <div class="right-song-item">
            <div class="song-duration smart-lyrics-song-status">${escapeHtml(stateText)}</div>
        </div>
    </div>`;
}

export function updateSmartLyricsFinderList() {
    const list = document.getElementById('smart-lyrics-song-list');
    if (!list) return;
    const songs = getSmartLyricsFinderSongs();
    if (!songs.length) {
        if (typeof teardownSmartLyricsVirtualScroll === 'function') {
            teardownSmartLyricsVirtualScroll();
        }
        list.innerHTML = '<div class="smart-lyrics-empty"><span class="material-symbols-outlined">search_off</span><span>No songs match</span></div>';
        return;
    }
    if (typeof refreshSmartLyricsVirtualScroll === 'function') {
        refreshSmartLyricsVirtualScroll(songs);
    } else {
        list.innerHTML = songs.map((song, index) => buildSmartLyricsRowHTML(song, index)).join('');
    }
}

export function buildSmartLyricsCacheKey(song) {
    const artist = String(song.artist || '').trim().toLowerCase();
    const title = String(song.title || '').trim().toLowerCase();
    const album = String(song.album || '').trim().toLowerCase();
    const duration = parseSongDurationSeconds(song.duration);
    return `${artist}|${title}|${album}|${duration}`;
}

export async function searchLyricsForSmartSong(song, mode) {
    const cacheKey = buildSmartLyricsCacheKey(song);

    let rawResult = smartLyricsFinderState.lrclibCache.get(cacheKey);
    if (!rawResult) {
        rawResult = await desktopApi.lyrics.searchOnlineLyrics({
            artist: String(song.artist || ''),
            title: String(song.title || ''),
            album: String(song.album || ''),
            duration: parseSongDurationSeconds(song.duration)
        });
        if (!rawResult || rawResult.success === false) {
            throw new Error((rawResult && rawResult.error) || 'Search failed');
        }
        smartLyricsFinderState.lrclibCache.set(cacheKey, rawResult);
    }

    const type = mode === 'lyrics' ? 'lyrics' : 'lrc';
    const results = Array.isArray(rawResult.results) ? rawResult.results : [];
    const match = results.find(item =>
        String(type === 'lrc' ? item.syncedLyrics || '' : item.plainLyrics || '').trim()
    );
    if (!match) return { success: false, type, error: 'No matching lyrics found' };
    const text = getOnlineLyricsText(match, type);
    const isInstrumental = Boolean(match.instrumental);
    return {
        success: Boolean(applyOnlineLyricsToSong(song.id, text, type, isInstrumental)),
        type,
        error: ''
    };
}

export async function runSmartLyricsFinder(allSongs = false) {
    if (smartLyricsFinderState.processing) return;

    const songs = getSmartLyricsFinderSongs();
    let targets = allSongs ? songs : songs.filter(song => smartLyricsFinderState.selectedIds.has(song.id));

    if (smartLyricsFinderState.skipExisting) {
        const mode = smartLyricsFinderState.mode;
        targets = targets.filter(song => {
            if (mode === 'lrc') {
                const existing = typeof getSyncedLyricsForSong === 'function' ? getSyncedLyricsForSong(song) : null;
                return !existing || String(existing).trim() === '';
            }
            const existing = typeof getLyricsForSong === 'function' ? getLyricsForSong(song) : '';
            return !existing || String(existing).trim() === '';
        });
    }

    if (!targets.length) {
        showNotification(
            allSongs ? 'No songs need fetching' : 'Select at least one song without existing lyrics',
            'warning',
            2000
        );
        return;
    }

    smartLyricsFinderState.processing = true;
    smartLyricsFinderState.stopRequested = false;
    smartLyricsFinderState.results.clear();
    smartLyricsFinderState.currentIndex = 0;

    const total = targets.length;
    let cursor = 0;
    let completed = 0;
    let found = 0;

    smartLyricsFinderState.status = `Finding ${smartLyricsFinderState.mode === 'lrc' ? 'LRC' : 'lyrics'}… (0/${total})`;
    renderSmartLyricsFinder();

    async function worker() {
        while (true) {
            if (smartLyricsFinderState.stopRequested) return;
            const i = cursor++;
            if (i >= total) return;

            const song = targets[i];
            try {
                const result = await searchLyricsForSmartSong(song, smartLyricsFinderState.mode);
                smartLyricsFinderState.results.set(song.id, result);
                if (result.success) found++;
            } catch (error) {
                smartLyricsFinderState.results.set(song.id, {
                    success: false,
                    type: smartLyricsFinderState.mode,
                    error: error.message || 'Search failed'
                });
            }

            completed++;
            smartLyricsFinderState.currentIndex = i;
            smartLyricsFinderState.status = `Finding ${
                smartLyricsFinderState.mode === 'lrc' ? 'LRC' : 'lyrics'
            }: ${song.title || 'Unknown title'} (${completed}/${total})`;
            updateSmartLyricsFinderProgress();
            updateSmartLyricsFinderList();
        }
    }

    const workers = [];
    const workerCount = Math.min(SMART_LYRICS_CONCURRENCY, total);
    for (let w = 0; w < workerCount; w++) {
        workers.push(worker());
    }

    await Promise.all(workers);

    const wasStopped = smartLyricsFinderState.stopRequested;
    smartLyricsFinderState.processing = false;
    smartLyricsFinderState.stopRequested = false;
    smartLyricsFinderState.currentIndex = -1;

    smartLyricsFinderState.status = wasStopped
        ? `Stopped: ${found} of ${completed} songs found (${total - completed} skipped)`
        : `Finished: ${found} of ${total} songs found`;

    renderSmartLyricsFinder();
}

export function renderSmartLyricsFinder() {
    const mainContentInner = document.querySelector('.main-content-inner');
    if (!mainContentInner) return;
    let root = document.getElementById('lyrics-view-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'lyrics-view-root';
        root.className = 'lyrics-view-root';
        mainContentInner.appendChild(root);
    }
    const songs = getSmartLyricsFinderSongs();
    const selectedCount = smartLyricsFinderState.selectedIds.size;
    root.style.display = 'block';
    root.innerHTML = `<div class="online-lyrics-view-container smart-lyrics-finder-container">
        <div class="online-lyrics-header">
            <div><h2>Find multi song lyrics &amp; LRC</h2><p>Choose songs and automatically find and save synced LRC or plain lyrics.</p></div>
            <button class="lyrics-view-edit-btn" ${actionAttrs('switchView', [VIEWS.LYRICS])}><span class="material-symbols-outlined">arrow_back</span>Back to Lyrics</button>
        </div>
        <div class="smart-lyrics-toolbar">
            <input class="smart-lyrics-search" placeholder="Search songs..." value="${escapeOnlineLyricsAttribute(smartLyricsFinderState.query)}" data-action-input="handleSmartLyricsFinderSearch" data-args-input='["$value"]' ${smartLyricsFinderState.processing ? 'disabled' : ''}>
            <div class="smart-lyrics-mode">
                <button class="lyrics-view-edit-btn ${smartLyricsFinderState.mode === 'lrc' ? 'active' : ''}" data-action="setSmartLyricsMode" data-args='["lrc"]' ${smartLyricsFinderState.processing ? 'disabled' : ''}>Synced LRC</button>
                <button class="lyrics-view-edit-btn ${smartLyricsFinderState.mode === 'lyrics' ? 'active' : ''}" data-action="setSmartLyricsMode" data-args='["lyrics"]' ${smartLyricsFinderState.processing ? 'disabled' : ''}>Plain lyrics</button>
            </div>
            <button class="lyrics-view-edit-btn" data-action="selectAllSmartLyricsSongs" ${smartLyricsFinderState.processing ? 'disabled' : ''}>Select visible</button>
            <button class="lyrics-view-edit-btn" data-action="clearSmartLyricsSelection" ${smartLyricsFinderState.processing ? 'disabled' : ''}>Clear</button>
        </div>
        <div class="smart-lyrics-actions"><span id="smart-lyrics-selection-count">${selectedCount} selected</span><div>
            <button class="lyrics-view-edit-btn lyrics-online-btn" id="smart-lyrics-find-selected" data-action="runSmartLyricsFinder" data-args='[false]' ${smartLyricsFinderState.processing || !selectedCount ? 'disabled' : ''}>Find for selected</button>
            <button class="lyrics-view-edit-btn lyrics-online-btn" id="smart-lyrics-stop-btn" data-action="stopSmartLyricsFinder" style="${smartLyricsFinderState.processing ? '' : 'display:none;'}">Stop</button>
            <button class="lyrics-view-edit-btn lyrics-online-btn" id="smart-lyrics-find-all" data-action="runSmartLyricsFinder" data-args='[true]' ${smartLyricsFinderState.processing || !songs.length ? 'disabled' : ''}>Find for all songs</button>
            <label class="smart-lyrics-skip-existing" title="Skip songs that already have lyrics saved">
                <input type="checkbox" id="smart-lyrics-skip-existing" ${smartLyricsFinderState.skipExisting ? 'checked' : ''} ${smartLyricsFinderState.processing ? 'disabled' : ''} data-action-change="toggleSmartLyricsSkipExisting" data-args-change='["$checked"]'>
                <span>Skip existing</span>
            </label>
        </div></div>
        <div id="smart-lyrics-progress" class="smart-lyrics-progress">${escapeHtml(smartLyricsFinderState.status || '')}</div>
        <div class="smart-lyrics-list" id="smart-lyrics-song-list"></div>
    </div>`;
    updateSmartLyricsFinderList();
    updateSmartLyricsFinderToolbarState();
}

// ============================================================================
// ONLINE LYRICS / LRCLIB
// ============================================================================
let onlineLyricsState = {
    song: null,
    artist: '',
    title: '',
    album: '',
    duration: '',
    results: [],
    exact: false,
    loading: false,
    error: '',
    selectedIndex: -1,
    selectedType: 'lrc',
    page: 0,
    pageSize: 10,
    originalQuery: null,
    pickerOpen: false,
    pickerQuery: '',
    pickerIndex: -1,
    pickerType: 'lrc',
    pickerSelectedSongId: null
};

let onlineLyricsPickerMouseDownOutside = false;

export function getCurrentPlaybackSong() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return null;
    const item = playbackQueue[currentQueueIndex];
    return item.song || item;
}

export function parseSongDurationSeconds(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const text = String(value || '').trim();
    const parts = text.split(':').map(Number);
    if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function escapeOnlineLyricsAttribute(text) {
    return escapeHtml(String(text || '')).replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
}

export function formatOnlineLyricsDuration(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value <= 0) return '';
    const total = Math.round(value);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function openOnlineLyricsView() {
    const song = getCurrentPlaybackSong();
    if (!song) {
        showNotification('No song playing', 'warning', 2000);
        return;
    }

    openOnlineLyricsSearchView(song, true);
}

export function setOnlineLyricsSearchButtonActive(active) {
    const btn = document.getElementById('online-lyrics-search-btn');
    if (!btn) return;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
}

export function toggleOnlineLyricsSearchView() {
    if (currentView === VIEWS.ONLINE_LYRICS) {
        setOnlineLyricsSearchButtonActive(false);
        if (canGoBack()) {
            goBack();
        } else {
            switchView(lastPlaybackListId || VIEWS.ALL_SONGS);
        }
        return;
    }
    setOnlineLyricsSearchButtonActive(true);
    openOnlineLyricsSearchView();
}

export function openOnlineLyricsSearchView(song = null, autoSearch = false) {
    const fromHeader = !song;
    onlineLyricsState = {
        song: song || null,
        artist: song?.artist || '',
        title: song?.title || '',
        album: song?.album || '',
        duration: song?.duration || '',
        results: [],
        exact: false,
        loading: false,
        error: '',
        selectedIndex: -1,
        selectedType: 'lrc',
        page: 0,
        pageSize: 10,
        fromHeader: fromHeader,
        originalQuery: fromHeader
            ? null
            : {
                  artist: song?.artist || '',
                  title: song?.title || '',
                  album: song?.album || ''
              },
        searched: false,
        pickerOpen: false,
        pickerQuery: '',
        pickerIndex: -1,
        pickerType: 'lrc',
        pickerSelectedSongId: null
    };

    switchView(VIEWS.ONLINE_LYRICS);
    if (autoSearch) searchOnlineLyrics();
}

export async function searchOnlineLyrics() {
    const artistInput = document.getElementById('online-lyrics-artist');
    const titleInput = document.getElementById('online-lyrics-title');
    const albumInput = document.getElementById('online-lyrics-album');

    const artist = artistInput ? artistInput.value.trim() : onlineLyricsState.artist.trim();
    const title = titleInput ? titleInput.value.trim() : onlineLyricsState.title.trim();
    const album = albumInput ? albumInput.value.trim() : onlineLyricsState.album.trim();

    if (!title && !artist) {
        showNotification('Enter an artist or title', 'warning', 2000);
        return;
    }

    onlineLyricsState.artist = artist;
    onlineLyricsState.title = title;
    onlineLyricsState.album = album;
    onlineLyricsState.loading = true;
    onlineLyricsState.error = '';
    onlineLyricsState.results = [];
    onlineLyricsState.selectedIndex = -1;
    onlineLyricsState.selectedType = 'lrc';
    onlineLyricsState.page = 0;
    onlineLyricsState.searched = true;
    updateOnlineLyricsResultsSection();

    try {
        const result = await desktopApi.lyrics.searchOnlineLyrics({
            artist,
            title,
            album,
            duration: parseSongDurationSeconds(onlineLyricsState.duration)
        });

        if (!result || result.success === false) {
            throw new Error((result && result.error) || 'Could not search LRCLIB');
        }

        onlineLyricsState.results = Array.isArray(result.results) ? result.results : [];
        onlineLyricsState.exact = Boolean(result.exact);
        onlineLyricsState.loading = false;
        updateOnlineLyricsResultsSection();
    } catch (error) {
        onlineLyricsState.loading = false;
        onlineLyricsState.error = error.message || 'Could not search LRCLIB';
        updateOnlineLyricsResultsSection();
    }
}

export function openOnlineLyricsResult(index) {
    if (index < 0 || index >= onlineLyricsState.results.length) return;
    if (onlineLyricsState.selectedIndex === index) return;
    onlineLyricsState.selectedIndex = index;
    updateOnlineLyricsResultsSection();
}

export function closeOnlineLyricsResult() {
    onlineLyricsState.selectedIndex = -1;
    updateOnlineLyricsResultsSection();
}

export function selectOnlineLyricsType(index, type) {
    if (index < 0 || index >= onlineLyricsState.results.length) return;
    if (type !== 'lrc' && type !== 'lyrics') return;

    onlineLyricsState.selectedIndex = index;
    onlineLyricsState.selectedType = type;
    updateOnlineLyricsResultsSection();
}

export function getOnlineLyricsText(result, type) {
    if (!result) return '';
    return type === 'lrc' ? String(result.syncedLyrics || '') : String(result.plainLyrics || '');
}

export function hasOnlineLyricsQueryChanged() {
    if (onlineLyricsState.fromHeader) return true;
    const orig = onlineLyricsState.originalQuery;
    if (!orig) return true;
    return (
        (onlineLyricsState.title || '') !== (orig.title || '') ||
        (onlineLyricsState.artist || '') !== (orig.artist || '') ||
        (onlineLyricsState.album || '') !== (orig.album || '')
    );
}

export async function copyOnlineLyrics(index, type) {
    const result = onlineLyricsState.results[index];
    const text = getOnlineLyricsText(result, type);
    if (!text.trim()) {
        showNotification(`No ${type === 'lrc' ? 'LRC' : 'plain lyrics'} available`, 'warning', 2000);
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        showNotification(`${type === 'lrc' ? 'LRC' : 'Lyrics'} copied`, 'success', 1800);
    } catch (error) {
        showNotification('Could not copy to clipboard', 'error', 2000);
    }
}

export async function downloadOnlineLyrics(index, type) {
    const result = onlineLyricsState.results[index];
    const text = getOnlineLyricsText(result, type);
    if (!text.trim()) {
        showNotification(`No ${type === 'lrc' ? 'LRC' : 'plain lyrics'} available`, 'warning', 2000);
        return;
    }

    const saved = await desktopApi.lyrics.downloadOnlineLyrics({
        title: result.trackName || onlineLyricsState.title,
        artist: result.artistName || onlineLyricsState.artist,
        type,
        contents: text
    });

    if (saved && saved.success) {
        showNotification(`${type === 'lrc' ? 'LRC' : 'Lyrics'} saved to download folder`, 'success', 2200);
    } else {
        showNotification((saved && saved.error) || 'Could not save lyrics', 'error', 2500);
    }
}

export function useOnlineLyrics(index, type) {
    const result = onlineLyricsState.results[index];
    const text = getOnlineLyricsText(result, type);
    const song = onlineLyricsState.song || getCurrentPlaybackSong();

    if (!song || !text.trim()) {
        showNotification('No lyrics available', 'warning', 2000);
        return;
    }

    applyOnlineLyricsToSong(song.id, text, type, Boolean(result && result.instrumental));
}

export function markSongInstrumental(songId) {
    const song = SONGS_DATA.find((s) => s.id === songId);
    if (!song) return;
    song.instrumental = true;
}

export function applyOnlineLyricsToSong(songId, text, type, isInstrumental = false) {
    if (!text || !text.trim()) {
        showNotification('No lyrics available', 'warning', 2000);
        return false;
    }

    if (type === 'lrc') {
        if (typeof parseLRC !== 'function' || !parseLRC(text)) {
            showNotification('The returned LRC is invalid', 'error', 2200);
            return false;
        }
        setSyncedLyricsForSong(songId, text);
        showNotification('LRC saved to song', 'success', 2200);
    } else {
        setLyricsForSong(songId, text);
        showNotification('Lyrics saved to song', 'success', 2200);
    }

    if (isInstrumental) {
        markSongInstrumental(songId);
    }

    if (currentView === VIEWS.ONLINE_LYRICS) {
        updateOnlineLyricsResultsSection();
    }
    if (currentView === VIEWS.LYRICS) {
        emit('lyrics:changed', { songId });
    }
    return true;
}

export function openOnlineLyricsPicker(index, type, anchorEvent) {
    const result = onlineLyricsState.results[index];
    if (!result) return;

    const prefillParts = [result.trackName || '', result.artistName || ''].filter((p) => p.trim() !== '');

    closeOnlineLyricsPicker();

    onlineLyricsState.pickerOpen = true;
    onlineLyricsState.pickerIndex = index;
    onlineLyricsState.pickerType = type;
    onlineLyricsState.pickerQuery = prefillParts.join(' ');
    onlineLyricsState.pickerSelectedSongId = null;

    const picker = document.createElement('div');
    picker.className = 'online-lyrics-picker';
    picker.id = 'online-lyrics-picker';
    picker.style.display = 'flex';
    picker.style.flexDirection = 'column';
    picker.style.visibility = 'hidden';
    picker.innerHTML = `
        <div class="online-lyrics-picker-search">
            <i class="fas fa-search online-lyrics-picker-search-icon"></i>
            <input
                type="text"
                id="online-lyrics-picker-input"
                class="online-lyrics-picker-input"
                placeholder="Search songs..."
                value="${escapeOnlineLyricsAttribute(onlineLyricsState.pickerQuery)}"
                data-action-input="handleOnlineLyricsPickerInput" data-args-input='["$value"]'
                autocomplete="off"
            />
        </div>
        <div class="custom-scrollbar-container online-lyrics-picker-list-container">
            <div class="custom-scrollbar-content" id="online-lyrics-picker-list-content">
                <div class="queue-list" id="online-lyrics-picker-list"></div>
            </div>
            <div class="custom-scrollbar" id="online-lyrics-picker-scrollbar">
                <div class="custom-scrollbar-thumb" id="online-lyrics-picker-scrollbar-thumb"></div>
            </div>
        </div>
        <div class="online-lyrics-picker-footer">
            <button class="lyrics-editor-btn" data-action="closeOnlineLyricsPicker">Cancel</button>
            <button class="lyrics-editor-btn lyrics-editor-btn-primary" id="online-lyrics-picker-confirm" data-action="confirmOnlineLyricsPicker" disabled>Save to song</button>
        </div>
    `;

    document.body.appendChild(picker);

    picker.style.height = '460px';
    picker.style.maxHeight = 'calc(100vh - 40px)';

    const menuWidth = picker.offsetWidth;
    const menuHeight = picker.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const anchorX = anchorEvent ? anchorEvent.clientX : 0;
    const anchorY = anchorEvent ? anchorEvent.clientY : 0;

    let posX = anchorX;
    let posY = anchorY + 5;

    const spaceToRight = windowWidth - anchorX;
    if (spaceToRight < menuWidth) {
        posX = anchorX - menuWidth - 7;
    }
    if (posX < 7) {
        posX = 7;
    }

    const spaceToBottom = windowHeight - anchorY;
    if (spaceToBottom < menuHeight) {
        posY = anchorY - menuHeight - 7;
    }
    if (posY < 7) {
        posY = 7;
    }

    picker.style.left = posX + 'px';
    picker.style.top = posY + 'px';
    picker.style.visibility = 'visible';

    setTimeout(() => {
        picker.classList.add('active');
    }, 10);

    updateOnlineLyricsPickerList();

    setTimeout(() => {
        const input = document.getElementById('online-lyrics-picker-input');
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
        if (typeof initExternalScrollbar === 'function') {
            initExternalScrollbar(
                'online-lyrics-picker-list-content',
                'online-lyrics-picker-scrollbar',
                'online-lyrics-picker-scrollbar-thumb'
            );
        }
        updateScrollbarById('online-lyrics-picker-list-content');
    }, 30);

    document.addEventListener('keydown', onlineLyricsPickerKeyHandler);
    setTimeout(() => {
        if (onlineLyricsState.pickerOpen) {
            document.addEventListener('mousedown', onlineLyricsPickerMouseDownHandler, true);
            document.addEventListener('click', onlineLyricsPickerOutsideHandler, true);
        }
    }, 0);
}

export function closeOnlineLyricsPicker() {
    onlineLyricsState.pickerOpen = false;
    onlineLyricsState.pickerIndex = -1;
    onlineLyricsState.pickerType = 'lrc';
    onlineLyricsState.pickerSelectedSongId = null;
    const picker = document.getElementById('online-lyrics-picker');
    if (picker) picker.remove();
    document.removeEventListener('keydown', onlineLyricsPickerKeyHandler);
    document.removeEventListener('mousedown', onlineLyricsPickerMouseDownHandler, true);
    document.removeEventListener('click', onlineLyricsPickerOutsideHandler, true);
    onlineLyricsPickerMouseDownOutside = false;
}

export function onlineLyricsPickerKeyHandler(e) {
    if (e.key === 'Escape' && onlineLyricsState.pickerOpen) {
        e.preventDefault();
        closeOnlineLyricsPicker();
    }
}

export function onlineLyricsPickerMouseDownHandler(e) {
    if (!onlineLyricsState.pickerOpen) return;
    const picker = document.getElementById('online-lyrics-picker');
    if (!picker) {
        onlineLyricsPickerMouseDownOutside = false;
        return;
    }
    const inside =
        picker.contains(e.target) ||
        (e.target.closest && e.target.closest('.online-lyrics-primary-btn')) ||
        (e.target.closest && e.target.closest('#online-lyrics-picker'));
    onlineLyricsPickerMouseDownOutside = !inside;
}

export function onlineLyricsPickerOutsideHandler(e) {
    if (!onlineLyricsState.pickerOpen) return;
    if (!onlineLyricsPickerMouseDownOutside) return;
    const picker = document.getElementById('online-lyrics-picker');
    if (!picker) {
        closeOnlineLyricsPicker();
        return;
    }
    if (picker.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.online-lyrics-primary-btn')) return;
    if (e.target.closest && e.target.closest('#online-lyrics-picker')) return;
    closeOnlineLyricsPicker();
}

export function getOnlineLyricsPickerSongs() {
    const rawQuery = (onlineLyricsState.pickerQuery || '').toLowerCase().trim();
    const songs = getActiveSongs();
    if (!rawQuery) return songs;

    const tokens = rawQuery
        .replace(/[&\-–—,]/g, ' ')
        .split(/\s+/)
        .filter((token) => token && token !== 'by' && token !== 'feat' && token !== 'ft' && token !== 'with');

    if (tokens.length === 0) return songs;

    const scored = [];
    for (const song of songs) {
        const title = String(song.title || '').toLowerCase();
        const artist = String(song.artist || '').toLowerCase();
        const album = String(song.album || '').toLowerCase();
        const haystack = `${title} ${artist} ${album}`;

        const allInHaystack = tokens.every((token) => haystack.includes(token));
        if (!allInHaystack) continue;

        const titleHit = tokens.some((token) => title.includes(token));
        const artistHit = tokens.some((token) => artist.includes(token));
        const score = (titleHit ? 2 : 0) + (artistHit ? 1 : 0);
        scored.push({ song, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((entry) => entry.song);
}

window.addEventListener('resize', function () {
    if (!onlineLyricsState.pickerOpen) return;
    const picker = document.getElementById('online-lyrics-picker');
    if (!picker) return;

    const menuWidth = picker.offsetWidth;
    const menuHeight = picker.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let posX = parseInt(picker.style.left, 10) || 7;
    let posY = parseInt(picker.style.top, 10) || 7;

    if (posX + menuWidth > windowWidth - 7) {
        posX = windowWidth - menuWidth - 7;
    }
    if (posX < 7) posX = 7;

    if (posY + menuHeight > windowHeight - 7) {
        posY = windowHeight - menuHeight - 7;
    }
    if (posY < 7) posY = 7;

    picker.style.left = posX + 'px';
    picker.style.top = posY + 'px';
});

export function updateOnlineLyricsPickerList() {
    const list = document.getElementById('online-lyrics-picker-list');
    if (!list) return;

    const songs = getOnlineLyricsPickerSongs();
    if (songs.length === 0) {
        list.innerHTML = `
            <div class="online-lyrics-picker-empty">
                <span class="material-symbols-outlined">search_off</span>
                <span>No songs match</span>
            </div>
        `;
        updateScrollbarById('online-lyrics-picker-list-content');
        return;
    }

    list.innerHTML = songs
        .map((song) => {
            const isSelected = onlineLyricsState.pickerSelectedSongId === song.id;
            return renderRightPanelItem(song, {
                action: ['selectOnlineLyricsPickerSong', [song.id]],
                extraClass: `online-lyrics-picker-row${isSelected ? ' selected' : ''}`
            });
        })
        .join('');
    updateScrollbarById('online-lyrics-picker-list-content');
}

export function selectOnlineLyricsPickerSong(songId) {
    onlineLyricsState.pickerSelectedSongId = songId;
    updateOnlineLyricsPickerList();
    updateOnlineLyricsPickerConfirmButton();
}

export function updateOnlineLyricsPickerConfirmButton() {
    const btn = document.getElementById('online-lyrics-picker-confirm');
    if (!btn) return;
    btn.disabled = onlineLyricsState.pickerSelectedSongId === null;
}

export function confirmOnlineLyricsPicker() {
    if (onlineLyricsState.pickerSelectedSongId === null) return;
    if (onlineLyricsState.pickerIndex < 0) return;
    const result = onlineLyricsState.results[onlineLyricsState.pickerIndex];
    if (!result) return;
    const text = getOnlineLyricsText(result, onlineLyricsState.pickerType);
    const applied = applyOnlineLyricsToSong(
        onlineLyricsState.pickerSelectedSongId,
        text,
        onlineLyricsState.pickerType,
        Boolean(result.instrumental)
    );
    if (applied) closeOnlineLyricsPicker();
}

export function handleOnlineLyricsPickerInput(value) {
    onlineLyricsState.pickerQuery = value;
    updateOnlineLyricsPickerList();
}

export function getOnlineLyricsPageCount() {
    return Math.max(1, Math.ceil(onlineLyricsState.results.length / onlineLyricsState.pageSize));
}

export function setOnlineLyricsPage(page) {
    const pageCount = getOnlineLyricsPageCount();
    onlineLyricsState.page = Math.max(0, Math.min(page, pageCount - 1));
    onlineLyricsState.selectedIndex = -1;
    onlineLyricsState.selectedType = 'lrc';
    updateOnlineLyricsResultsSection();
}

export function nextOnlineLyricsPage() {
    setOnlineLyricsPage(onlineLyricsState.page + 1);
}

export function previousOnlineLyricsPage() {
    setOnlineLyricsPage(onlineLyricsState.page - 1);
}

export function renderOnlineLyricsResult(result, index) {
    const selected = onlineLyricsState.selectedIndex === index;
    const synced = Boolean(String(result.syncedLyrics || '').trim());
    const plain = Boolean(String(result.plainLyrics || '').trim());
    const isInstrumental = Boolean(result.instrumental);
    const activeType = (onlineLyricsState.selectedType === 'lyrics' && plain) || (!synced && plain) ? 'lyrics' : 'lrc';
    const duration = formatOnlineLyricsDuration(result.duration);
    const album = result.albumName || '';
    const activeText = activeType === 'lrc' ? result.syncedLyrics : result.plainLyrics;

    return `
        <div class="online-lyrics-result ${selected ? 'selected' : ''}" ${selected ? '' : `${actionAttrs('openOnlineLyricsResult', [index])}`}>
            <button class="online-lyrics-result-header" ${actionAttrs('openOnlineLyricsResult', [index], { stop: true })}>
                <span class="online-lyrics-result-title">${escapeHtml(result.trackName || 'Unknown title')}</span>
                <span class="online-lyrics-result-artist">${escapeHtml(result.artistName || 'Unknown artist')}</span>
                <span class="online-lyrics-result-album">${escapeHtml(album || '—')}</span>
                <span class="online-lyrics-result-meta">${escapeHtml(duration)}</span>
                <span class="material-symbols-outlined online-lyrics-expand" ${selected ? actionAttrs('closeOnlineLyricsResult', [], { stop: true }) : actionAttrs('openOnlineLyricsResult', [index], { stop: true })}>${selected ? 'expand_less' : 'expand_more'}</span>
            </button>
            <div class="online-lyrics-badges">
                ${synced ? `<button class="online-lyrics-badge synced ${selected && activeType === 'lrc' ? 'active' : ''}" ${actionAttrs('selectOnlineLyricsType', [index, 'lrc'], { stop: true })}>Synced LRC</button>` : ''}
                ${plain ? `<button class="online-lyrics-badge ${selected && activeType === 'lyrics' ? 'active' : ''}" ${actionAttrs('selectOnlineLyricsType', [index, 'lyrics'], { stop: true })}>Lyrics</button>` : ''}
                ${isInstrumental ? '<span class="online-lyrics-badge instrumental" title="Marked as instrumental by LRCLIB">Instrumental</span>' : ''}
                ${!synced && !plain ? '<span class="online-lyrics-badge unavailable">No lyrics</span>' : ''}
            </div>
            ${selected ? `
                <div class="online-lyrics-preview">
                    <pre>${escapeHtml(activeText || 'No lyrics available')}</pre>
                    <div class="online-lyrics-actions">
                        ${activeType === 'lrc' && synced ? `
                            <button class="lyrics-view-edit-btn" ${actionAttrs('copyOnlineLyrics', [index, 'lrc'], { stop: true })}>Copy LRC</button>
                            <button class="lyrics-view-edit-btn" ${actionAttrs('downloadOnlineLyrics', [index, 'lrc'], { stop: true })}>Download LRC</button>
                            ${onlineLyricsState.fromHeader
                                ? `<button class="lyrics-view-edit-btn online-lyrics-primary-btn" ${actionAttrs('openOnlineLyricsPicker', [index, 'lrc', '$event'], { stop: true })}>Save LRC to a song</button>`
                                : hasOnlineLyricsQueryChanged()
                                ? `<button class="lyrics-view-edit-btn online-lyrics-primary-btn" ${actionAttrs('useOnlineLyrics', [index, 'lrc'], { stop: true })}>Use LRC for this song</button>`
                                : ''}
                        ` : ''}
                        ${activeType === 'lyrics' && plain ? `
                            <button class="lyrics-view-edit-btn" ${actionAttrs('copyOnlineLyrics', [index, 'lyrics'], { stop: true })}>Copy Lyrics</button>
                            <button class="lyrics-view-edit-btn" ${actionAttrs('downloadOnlineLyrics', [index, 'lyrics'], { stop: true })}>Download Lyrics</button>
                            ${onlineLyricsState.fromHeader
                                ? `<button class="lyrics-view-edit-btn online-lyrics-primary-btn" ${actionAttrs('openOnlineLyricsPicker', [index, 'lyrics', '$event'], { stop: true })}>Save Lyrics to a song</button>`
                                : hasOnlineLyricsQueryChanged()
                                ? `<button class="lyrics-view-edit-btn online-lyrics-primary-btn" ${actionAttrs('useOnlineLyrics', [index, 'lyrics'], { stop: true })}>Use Lyrics for this song</button>`
                                : ''}
                        ` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

export function clearOnlineLyricsSearchInputs() {
    const artistInput = document.getElementById('online-lyrics-artist');
    const titleInput = document.getElementById('online-lyrics-title');
    const albumInput = document.getElementById('online-lyrics-album');
    if (artistInput) artistInput.value = '';
    if (titleInput) titleInput.value = '';
    if (albumInput) albumInput.value = '';
    onlineLyricsState.artist = '';
    onlineLyricsState.title = '';
    onlineLyricsState.album = '';
    onlineLyricsState.results = [];
    onlineLyricsState.selectedIndex = -1;
    onlineLyricsState.selectedType = 'lrc';
    onlineLyricsState.page = 0;
    onlineLyricsState.searched = false;
    onlineLyricsState.error = '';
    updateOnlineLyricsResultsSection();
}

export function renderOnlineLyricsView() {
    let container = document.getElementById('lyrics-view-root');
    const songListContainer = document.getElementById('song-list-container');
    const mainContentInner = document.querySelector('.main-content-inner');

    // The online lyrics view can be opened directly from the global header,
    // before the regular Lyrics view has ever created its root container.
    if (!container) {
        container = document.createElement('div');
        container.id = 'lyrics-view-root';
        container.className = 'lyrics-view-root';
        if (mainContentInner) {
            mainContentInner.appendChild(container);
        } else {
            return;
        }
    }

    if (songListContainer) songListContainer.style.display = 'none';
    container.style.display = 'block';

    const state = onlineLyricsState;

    const headerActionsHTML = `
        <div class="online-lyrics-header-actions">
            ${
                state.fromHeader
                    ? ''
                    : `<button class="lyrics-view-edit-btn" ${actionAttrs('switchView', [VIEWS.LYRICS])}>
                            <span class="material-symbols-outlined">arrow_back</span>
                            Back to Lyrics
                        </button>`
            }
            <button class="lyrics-view-edit-btn" data-action="openSmartLyricsFinder">
                <span class="material-symbols-outlined">library_music</span>
                Find multi song lyrics &amp; LRC
            </button>
        </div>
    `;

    container.innerHTML = `
        <div class="online-lyrics-view-container">
            <div class="online-lyrics-header">
                <div>
                    <h2>Find lyrics &amp; LRC</h2>
                    <p>Search LRCLIB by artist and title, then use or download the result.</p>
                </div>
                ${headerActionsHTML}
            </div>

            <div class="online-lyrics-search-panel">
                <input id="online-lyrics-title" value="${escapeOnlineLyricsAttribute(state.title)}" placeholder="Song title">
                <input id="online-lyrics-artist" value="${escapeOnlineLyricsAttribute(state.artist)}" placeholder="Artist name">
                <input id="online-lyrics-album" value="${escapeOnlineLyricsAttribute(state.album)}" placeholder="Album">
                <button class="lyrics-view-edit-btn online-lyrics-search-btn" data-action="searchOnlineLyrics">
                    Search
                </button>
                <button class="lyrics-view-edit-btn online-lyrics-search-btn" data-action="clearOnlineLyricsSearchInputs" title="Clear search fields">
                    Clear
                </button>
            </div>

            <div id="online-lyrics-results-section"></div>
        </div>
    `;

    updateOnlineLyricsResultsSection();

    setTimeout(() => {
        if (typeof updateExternalScrollbar === 'function') updateExternalScrollbar();
    }, 50);
}

export function updateOnlineLyricsResultsSection() {
    const section = document.getElementById('online-lyrics-results-section');
    if (!section) return;

    const state = onlineLyricsState;
    const pageCount = getOnlineLyricsPageCount();
    const pageStart = state.page * state.pageSize;
    const pageResults = state.results.slice(pageStart, pageStart + state.pageSize);
    const resultsHTML = state.results.length
        ? pageResults.map((result, index) => renderOnlineLyricsResult(result, pageStart + index)).join('')
        : state.loading
        ? '<div class="online-lyrics-status"><span class="material-symbols-outlined online-lyrics-spinner">progress_activity</span><span>Searching LRCLIB…</span></div>'
        : state.error
        ? `<div class="online-lyrics-status error"><span class="material-symbols-outlined">error</span><span>${escapeHtml(state.error)}</span></div>`
        : state.searched
        ? '<div class="online-lyrics-status"><span class="material-symbols-outlined">search_off</span><span>No results found</span></div>'
        : '<div class="online-lyrics-status"><span class="material-symbols-outlined">search</span><span>Enter an artist or title and press Search</span></div>';

    section.innerHTML = `
        <div class="online-lyrics-result-heading">
            <span>Results</span>
            ${state.results.length ? `<small>${pageStart + 1}-${Math.min(pageStart + pageResults.length, state.results.length)} of ${state.results.length}${state.exact && state.page === 0 ? ' · Exact match first' : ''}</small>` : ''}
        </div>
        <div class="online-lyrics-results">${resultsHTML}</div>
        ${state.results.length > state.pageSize ? `
            <div class="online-lyrics-pagination">
                <button class="lyrics-view-edit-btn" data-action="previousOnlineLyricsPage" ${state.page === 0 ? 'disabled' : ''}>
                    <span class="material-symbols-outlined">chevron_left</span>
                    Previous
                </button>
                <span class="online-lyrics-page-indicator">Page ${state.page + 1} of ${pageCount}</span>
                <button class="lyrics-view-edit-btn" data-action="nextOnlineLyricsPage" ${state.page >= pageCount - 1 ? 'disabled' : ''}>
                    Next
                    <span class="material-symbols-outlined">chevron_right</span>
                </button>
            </div>
        ` : ''}
    `;

    setTimeout(() => {
        if (typeof updateExternalScrollbar === 'function') updateExternalScrollbar();
    }, 30);
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        openSmartLyricsFinder,
        getSmartLyricsFinderSongs,
        stopSmartLyricsFinder,
        toggleSmartLyricsSkipExisting,
        toggleSmartLyricsSong,
        selectAllSmartLyricsSongs,
        clearSmartLyricsSelection,
        setSmartLyricsMode,
        handleSmartLyricsFinderSearch,
        updateSmartLyricsFinderSelectionCount,
        updateSmartLyricsFinderProgress,
        updateSmartLyricsFinderToolbarState,
        buildSmartLyricsRowHTML,
        updateSmartLyricsFinderList,
        buildSmartLyricsCacheKey,
        searchLyricsForSmartSong,
        runSmartLyricsFinder,
        renderSmartLyricsFinder,
        getCurrentPlaybackSong,
        parseSongDurationSeconds,
        escapeOnlineLyricsAttribute,
        formatOnlineLyricsDuration,
        openOnlineLyricsView,
        setOnlineLyricsSearchButtonActive,
        toggleOnlineLyricsSearchView,
        openOnlineLyricsSearchView,
        searchOnlineLyrics,
        openOnlineLyricsResult,
        closeOnlineLyricsResult,
        selectOnlineLyricsType,
        getOnlineLyricsText,
        hasOnlineLyricsQueryChanged,
        copyOnlineLyrics,
        downloadOnlineLyrics,
        useOnlineLyrics,
        markSongInstrumental,
        applyOnlineLyricsToSong,
        openOnlineLyricsPicker,
        closeOnlineLyricsPicker,
        onlineLyricsPickerKeyHandler,
        onlineLyricsPickerMouseDownHandler,
        onlineLyricsPickerOutsideHandler,
        getOnlineLyricsPickerSongs,
        updateOnlineLyricsPickerList,
        selectOnlineLyricsPickerSong,
        updateOnlineLyricsPickerConfirmButton,
        confirmOnlineLyricsPicker,
        handleOnlineLyricsPickerInput,
        getOnlineLyricsPageCount,
        setOnlineLyricsPage,
        nextOnlineLyricsPage,
        previousOnlineLyricsPage,
        renderOnlineLyricsResult,
        clearOnlineLyricsSearchInputs,
        renderOnlineLyricsView,
        updateOnlineLyricsResultsSection
    });
}

function parseLrcLine(rawLine) {
    const line = String(rawLine).trim();
    if (!line) return null;
    if (/^\[(ti|ar|al|by|re|ve|length|offset):/i.test(line)) return null;

    const timestampRegex = /\[(\d+):(\d+)(?:[.:](\d{1,3}))?\]/g;
    timestampRegex.lastIndex = 0;
    const times = [];
    let m;
    let lastIndex = 0;

    while ((m = timestampRegex.exec(line)) !== null) {
        const minutes = parseInt(m[1], 10);
        const seconds = parseInt(m[2], 10);
        let frac = m[3] || '0';
        if (frac.length === 1) frac = frac + '00';
        else if (frac.length === 2) frac = frac + '0';
        const centis = parseInt(frac, 10);
        times.push(minutes * 60 + seconds + centis / 1000);
        lastIndex = timestampRegex.lastIndex;
    }

    if (times.length === 0) return null;

    const text = line.substring(lastIndex).trim();
    return {
        times: times,
        text: text,
        instrumental: text === ''
    };
}

function parseLRC(lrcText) {
    if (!lrcText) return null;

    const lines = String(lrcText).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const entries = [];

    for (const rawLine of lines) {
        const parsed = parseLrcLine(rawLine);
        if (!parsed) continue;
        for (const t of parsed.times) {
            entries.push({
                time: t,
                text: parsed.text,
                instrumental: parsed.instrumental
            });
        }
    }

    if (entries.length === 0) return null;

    entries.sort((a, b) => a.time - b.time);
    return entries;
}

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

function initSyncedLyrics(song) {
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

function updateSyncedLyricsHighlight(currentTime) {
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

    if (state.activeIndex >= 0 && state.lineElements[state.activeIndex]) {
        state.lineElements[state.activeIndex].classList.remove('synced-active');
    }

    state.activeIndex = found;

    if (found >= 0 && state.lineElements[found]) {
        const el = state.lineElements[found];
        el.classList.add('synced-active');
        if (state.autoScroll && state.container && !state.userScrolledAway) {
            smoothScrollToLine(el);
        }
    }
}

function smoothScrollToLine(el) {
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

    clearTimeout(state._programmaticScrollTimeout);
    const clearFlag = () => {
        state.programmaticScroll = false;
    };
    if ('onscrollend' in container) {
        container.addEventListener('scrollend', clearFlag, {
            once: true
        });
        state._programmaticScrollTimeout = setTimeout(clearFlag, 1500);
    } else {
        state._programmaticScrollTimeout = setTimeout(clearFlag, 500);
    }
}

function attachSyncedLyricsScrollWatcher() {
    const state = syncedLyricsState;
    if (state.scrollCleanup) {
        state.scrollCleanup();
        state.scrollCleanup = null;
    }

    if (!state.container) return;

    const container = state.container;
    let scrollEndTimeout = null;

    function onScroll() {
        if (state.programmaticScroll) return;

        clearTimeout(scrollEndTimeout);
        scrollEndTimeout = setTimeout(() => {
            if (!state.entries || state.activeIndex < 0 || !state.lineElements[state.activeIndex]) return;

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
        }, 150);
    }

    container.addEventListener('scroll', onScroll, {
        passive: true
    });
    state.scrollCleanup = () => {
        container.removeEventListener('scroll', onScroll);
        clearTimeout(scrollEndTimeout);
    };
}

function showFollowLyricsButton() {
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

function hideFollowLyricsButton() {
    const btn = document.getElementById('follow-lyrics-btn');
    if (!btn) return;
    btn.classList.remove('visible');
}

function resetSyncedLyricsFollowState() {
    syncedLyricsState.userScrolledAway = false;
    syncedLyricsState.programmaticScroll = false;
    hideFollowLyricsButton();
    if (syncedLyricsState.scrollCleanup) {
        syncedLyricsState.scrollCleanup();
        syncedLyricsState.scrollCleanup = null;
    }
    clearTimeout(syncedLyricsState._programmaticScrollTimeout);
}

function importLrcFile() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) {
        showNotification('No song playing', 'warning', 2000);
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.lrc,text/plain';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            const parsed = parseLRC(text);
            if (!parsed || parsed.length === 0) {
                showNotification('Invalid LRC file', 'error', 2000);
                return;
            }

            const queueItem = playbackQueue[currentQueueIndex];
            const song = queueItem.song || queueItem;
            setSyncedLyricsForSong(song.id, text);

            showNotification(`Imported ${parsed.length} synced lines`, 'success', 2000);

            if (currentView === 'lyrics') {
                renderLyricsView();
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

function openLrcPasteDialog() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) {
        showNotification('No song playing', 'warning', 2000);
        return;
    }

    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;
    const existingLrc = getSyncedLyricsForSong(song) || '';

    let overlay = document.getElementById('lrc-paste-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'lrc-paste-overlay';
        overlay.className = 'lyrics-editor-overlay';
        overlay.onclick = closeLrcPasteDialog;
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="lyrics-editor-modal" onclick="event.stopPropagation()">
            <div class="lyrics-editor-header">
                <div class="lyrics-editor-title">Paste LRC</div>
                <div class="lyrics-editor-song">${escapeHtml(song.title || 'Unknown')} — ${escapeHtml(
        song.artist || 'Unknown Artist'
    )}</div>
            </div>
            <textarea class="lyrics-editor-textarea" id="lrc-paste-textarea" placeholder="[00:19.26] Sittin' all alone&#10;[00:21.66] Mouth full of gum&#10;[00:23.73] In the driveway&#10;..."></textarea>
            <div class="lyrics-editor-actions">
                <button class="lyrics-editor-btn lyrics-editor-btn-danger" onclick="clearSyncedLyricsForCurrentSong()">Clear Synced</button>
                <div class="lyrics-editor-actions-right">
                    <button class="lyrics-editor-btn" onclick="closeLrcPasteDialog()">Cancel</button>
                    <button class="lyrics-editor-btn lyrics-editor-btn-primary" onclick="saveLrcPaste()">Save</button>
                </div>
            </div>
        </div>
    `;

    const textarea = document.getElementById('lrc-paste-textarea');
    if (textarea) textarea.value = existingLrc;

    requestAnimationFrame(() => {
        overlay.classList.add('active');
        if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
    });

    document.addEventListener('keydown', lrcPasteKeyHandler);
}

function closeLrcPasteDialog() {
    const overlay = document.getElementById('lrc-paste-overlay');
    if (overlay) overlay.classList.remove('active');
    document.removeEventListener('keydown', lrcPasteKeyHandler);
}

function lrcPasteKeyHandler(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        closeLrcPasteDialog();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveLrcPaste();
    }
}

function saveLrcPaste() {
    const textarea = document.getElementById('lrc-paste-textarea');
    if (!textarea) return;

    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) {
        closeLrcPasteDialog();
        return;
    }

    const text = textarea.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (text.trim() === '') {
        clearSyncedLyricsForCurrentSong();
        return;
    }

    const parsed = parseLRC(text);
    if (!parsed || parsed.length === 0) {
        showNotification('No valid LRC timestamps found', 'error', 2500);
        return;
    }

    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;
    setSyncedLyricsForSong(song.id, text);

    closeLrcPasteDialog();
    showNotification(`Saved ${parsed.length} synced lines`, 'success', 2000);

    if (currentView === 'lyrics') {
        renderLyricsView();
    }
}

function clearSyncedLyricsForCurrentSong() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return;
    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;
    clearSyncedLyricsForSong(song.id);
    closeLrcPasteDialog();
    showNotification('Synced lyrics cleared', 'info', 2000);
    if (currentView === 'lyrics') {
        renderLyricsView();
    }
}

function formatLrcTime(seconds) {
    if (seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const centis = Math.round((seconds - Math.floor(seconds)) * 100);
    const cs = Math.min(99, Math.max(0, centis));
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
}

function parseManualTime(str) {
    if (!str) return null;
    let s = String(str).trim();
    if (s === '') return null;
    const colonMatch = s.match(/^(\d+):(\d+)(?:[.:](\d{1,3}))?$/);
    if (colonMatch) {
        const mins = parseInt(colonMatch[1], 10);
        const secs = parseInt(colonMatch[2], 10);
        let frac = colonMatch[3] || '0';
        if (frac.length === 1) frac = frac + '00';
        else if (frac.length === 2) frac = frac + '0';
        const cs = parseInt(frac, 10);
        return mins * 60 + secs + cs / 1000;
    }
    const numeric = parseFloat(s);
    if (!isNaN(numeric) && numeric >= 0) return numeric;
    return null;
}

function pushSyncHistory(label) {
    if (!syncEditorState.history) syncEditorState.history = [];
    syncEditorState.redoStack = [];

    const snapshot = {
        label: label || 'edit',
        focusedIndex: syncEditorState.focusedIndex,
        lines: syncEditorState.lines.map((l) => ({
            text: l.text,
            time: typeof l.time === 'number' ? l.time : null
        }))
    };

    const last = syncEditorState.history[syncEditorState.history.length - 1];
    if (
        last &&
        JSON.stringify(last.lines) === JSON.stringify(snapshot.lines) &&
        last.focusedIndex === snapshot.focusedIndex
    ) {
        return;
    }

    syncEditorState.history.push(snapshot);
    if (syncEditorState.history.length > 50) {
        syncEditorState.history.shift();
    }
}

function undoSync() {
    if (!syncEditorState.history || syncEditorState.history.length === 0) {
        showNotification('Nothing to undo', 'info', 1200);
        return;
    }

    if (!syncEditorState.redoStack) syncEditorState.redoStack = [];
    syncEditorState.redoStack.push({
        label: 'redo',
        focusedIndex: syncEditorState.focusedIndex,
        lines: syncEditorState.lines.map((l) => ({
            text: l.text,
            time: typeof l.time === 'number' ? l.time : null
        }))
    });

    const prev = syncEditorState.history.pop();
    syncEditorState.lines = prev.lines.map((l) => ({
        text: l.text,
        time: l.time
    }));
    syncEditorState.focusedIndex = prev.focusedIndex;

    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function redoSync() {
    if (!syncEditorState.redoStack || syncEditorState.redoStack.length === 0) {
        showNotification('Nothing to redo', 'info', 1200);
        return;
    }

    if (!syncEditorState.history) syncEditorState.history = [];
    syncEditorState.history.push({
        label: 'undo',
        focusedIndex: syncEditorState.focusedIndex,
        lines: syncEditorState.lines.map((l) => ({
            text: l.text,
            time: typeof l.time === 'number' ? l.time : null
        }))
    });

    const next = syncEditorState.redoStack.pop();
    syncEditorState.lines = next.lines.map((l) => ({
        text: l.text,
        time: l.time
    }));
    syncEditorState.focusedIndex = next.focusedIndex;

    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

let syncEditorState = {
    open: false,
    songId: null,
    lines: [],
    focusedIndex: -1,
    offset: 0,
    sourceVariantId: null,
    active: false
};

function openSyncEditor() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) {
        showNotification('No song playing', 'warning', 2000);
        return;
    }
    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;

    syncEditorState = {
        open: true,
        songId: song.id,
        lines: [],
        focusedIndex: -1,
        offset: 0,
        sourceVariantId: null,
        active: true,
        history: [],
        redoStack: [],
        liveFollow: false,
        pasteOpen: false
    };

    renderSyncEditor();

    syncEditorState._miniTick = () => updateSyncMiniPlayer();
    syncEditorState._miniVolumeTick = () => updateSyncMiniVolume();
    syncEditorState._endedTrap = (e) => {
        if (!syncEditorState.open) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        audioElement.pause();
        if (audioElement.duration && isFinite(audioElement.duration)) {
            audioElement.currentTime = audioElement.duration;
        }
        updateSyncMiniPlayer();
    };
    audioElement.addEventListener('timeupdate', syncEditorState._miniTick);
    audioElement.addEventListener('play', syncEditorState._miniTick);
    audioElement.addEventListener('pause', syncEditorState._miniTick);
    audioElement.addEventListener('loadedmetadata', syncEditorState._miniTick);
    audioElement.addEventListener('volumechange', syncEditorState._miniVolumeTick);
    audioElement.addEventListener('ended', syncEditorState._endedTrap, {
        capture: true
    });
    updateSyncMiniPlayer();

    document.addEventListener('keydown', syncEditorKeyHandler);
}

function closeSyncEditor() {
    if (syncEditorState._miniTick) {
        audioElement.removeEventListener('timeupdate', syncEditorState._miniTick);
        audioElement.removeEventListener('play', syncEditorState._miniTick);
        audioElement.removeEventListener('pause', syncEditorState._miniTick);
        audioElement.removeEventListener('loadedmetadata', syncEditorState._miniTick);
        syncEditorState._miniTick = null;
    }
    if (syncEditorState._miniVolumeTick) {
        audioElement.removeEventListener('volumechange', syncEditorState._miniVolumeTick);
        syncEditorState._miniVolumeTick = null;
    }
    if (syncEditorState._endedTrap) {
        audioElement.removeEventListener('ended', syncEditorState._endedTrap, {
            capture: true
        });
        syncEditorState._endedTrap = null;
    }
    closeSyncLineContextMenu();
    syncEditorState.open = false;
    syncEditorState.active = false;
    const overlay = document.getElementById('sync-editor-overlay');
    if (overlay) overlay.classList.remove('active');
    document.removeEventListener('keydown', syncEditorKeyHandler);
}

function syncEditorKeyHandler(e) {
    if (!syncEditorState.open) return;

    const target = document.activeElement;
    const inTextInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (!inTextInput && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) redoSync();
        else undoSync();
        return;
    }
    if (!inTextInput && (e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        e.stopPropagation();
        redoSync();
        return;
    }

    if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        stampFocusedLine();
        return;
    }

    if (e.key === 'Escape') {
        if (inTextInput) return;
        e.preventDefault();
        attemptCancelSyncEditor();
        return;
    }

    if (inTextInput) return;

    if (e.key === ' ') {
        e.preventDefault();
        syncMiniTogglePlay();
        return;
    }

    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        syncMiniSeekBy(e.shiftKey ? -5 : -1);
        return;
    }

    if (e.key === 'ArrowRight') {
        e.preventDefault();
        syncMiniSeekBy(e.shiftKey ? 5 : 1);
        return;
    }
}

function attemptCancelSyncEditor() {
    const hasStamps = syncEditorState.lines.some((l) => typeof l.time === 'number');
    if (hasStamps) {
        showConfirmDialog({
            title: 'Discard Sync?',
            message: 'You have unsaved timings. This will discard them.',
            okText: 'Discard',
            cancelText: 'Keep Editing'
        }).then((confirmed) => {
            if (confirmed) closeSyncEditor();
        });
    } else {
        closeSyncEditor();
    }
}

function renderSyncEditor() {
    let overlay = document.getElementById('sync-editor-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sync-editor-overlay';
        overlay.className = 'sync-editor-overlay';
        document.body.appendChild(overlay);
    }

    const song = SONGS_DATA.find((s) => s.id === syncEditorState.songId);
    const variants = song ? getSyncedLyricsVariantsForSong(song)?.variants || [] : [];

    const variantOptions = variants
        .map((v) => '<option value="' + v.id + '">' + escapeHtml(v.name) + '</option>')
        .join('');

    overlay.innerHTML = `
        <div class="sync-editor-modal" onclick="event.stopPropagation()">
            <div class="sync-editor-header">
                <div>
                    <div class="sync-editor-title">Sync Editor</div>
                    <div class="sync-editor-song">${escapeHtml(song ? song.title : 'Unknown')} — ${escapeHtml(
        song ? song.artist : 'Unknown Artist'
    )}</div>
                </div>
                <button class="sync-editor-close" onclick="attemptCancelSyncEditor()" aria-label="Close">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="sync-editor-body">
                <div class="sync-editor-left">
                    <div class="sync-editor-source-bar">
                        <select class="sync-editor-select" id="sync-source-variant">
                            <option value="">Load from variant…</option>
                            ${variantOptions}
                        </select>
                        <button class="sync-editor-mini-btn" onclick="loadPlainLyricsIntoEditor()">Load Plain Lyrics</button>
                        <button class="sync-editor-mini-btn" onclick="importLrcIntoEditor()">Import .lrc</button>
                    </div>
                    <div class="sync-editor-lines" id="sync-editor-lines"></div>
                </div>
                <div class="sync-editor-right">
                    <div class="sync-editor-miniplayer">
                        <div class="sync-editor-timecodes">
                            <div class="sync-editor-timecode" id="sync-timecode-current">00:00.00</div>
                            <button class="sync-editor-copy-time" onclick="copySyncCurrentTime()" title="Copy current time">
                                <span class="material-symbols-outlined">content_copy</span>
                            </button>
                            <div class="sync-editor-timecode-sep">/</div>
                            <div class="sync-editor-timecode-total" id="sync-timecode-total">${escapeHtml(
                                song ? song.duration : '00:00.00'
                            )}</div>
                            <button class="sync-editor-live-follow-btn" id="sync-live-follow-btn" onclick="toggleLiveFollow()" title="Follow playing line">
                                <span class="material-symbols-outlined">playlist_play</span>
                            </button>
                        </div>
                        <div class="sync-editor-scrubber" id="sync-scrubber" onmousedown="startSyncScrub(event)">
                            <div class="sync-editor-scrubber-fill" id="sync-scrubber-fill"></div>
                            <div class="sync-editor-scrubber-knob" id="sync-scrubber-knob"></div>
                        </div>
                        <div class="sync-editor-mini-controls">
                            <button class="sync-editor-miniplayer-btn" onclick="syncMiniSeekBy(-5)" title="Back 5s">−5s</button>
                            <button class="sync-editor-miniplayer-btn" onclick="syncMiniSeekBy(-2)" title="Back 2s">−2s</button>
                            <button class="sync-editor-miniplayer-btn" onclick="syncMiniSeekBy(-1)" title="Back 1s">−1s</button>
                            <button class="sync-editor-miniplayer-btn sync-editor-miniplayer-btn-primary" id="sync-mini-play-btn" onclick="syncMiniTogglePlay()" title="Play/Pause">
                                <span class="material-symbols-outlined" id="sync-mini-play-icon">play_arrow</span>
                            </button>
                            <button class="sync-editor-miniplayer-btn" onclick="syncMiniSeekBy(1)" title="Forward 1s">+1s</button>
                            <button class="sync-editor-miniplayer-btn" onclick="syncMiniSeekBy(2)" title="Forward 2s">+2s</button>
                            <button class="sync-editor-miniplayer-btn" onclick="syncMiniSeekBy(5)" title="Forward 5s">+5s</button>
                            <div class="sync-editor-volume">
                                <span class="material-symbols-outlined sync-editor-volume-icon" id="sync-volume-icon" onclick="syncMiniToggleMute()">volume_up</span>
                                <div class="sync-editor-volume-slider" id="sync-volume-slider" onmousedown="startSyncVolumeDrag(event)">
                                    <div class="sync-editor-volume-fill" id="sync-volume-fill"></div>
                                    <div class="sync-editor-volume-knob" id="sync-volume-knob"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="sync-editor-meta">
                        <div class="sync-editor-meta-row"><span>Duration</span><span>${escapeHtml(
                            song ? song.duration : '—'
                        )}</span></div>
                        <div class="sync-editor-meta-row"><span>Progress</span><span id="sync-progress-count">0 / 0</span></div>
                    </div>
                    <div class="sync-editor-preview-label">LRC Preview</div>
                    <textarea class="sync-editor-preview" id="sync-lrc-preview" readonly></textarea>
                </div>
            </div>
            <div class="sync-editor-footer">
                <div class="sync-editor-footer-left">
                    <button class="sync-editor-btn" onclick="clearAllSyncStamps()">Clear All Stamps</button>
                    <button class="sync-editor-btn" onclick="discardSyncChanges()">Discard Changes</button>
                </div>
                <div class="sync-editor-footer-right">
                    <button class="sync-editor-btn" onclick="saveSyncAsFile('lrc')">Save as .lrc</button>
                    <button class="sync-editor-btn" onclick="saveSyncAsFile('txt')">Save as .txt</button>
                    <button class="sync-editor-btn sync-editor-btn-primary" onclick="saveSyncEditor()">Save</button>
                    <button class="sync-editor-btn" onclick="attemptCancelSyncEditor()">Cancel</button>
                </div>
            </div>
        </div>
    `;

    const select = document.getElementById('sync-source-variant');
    if (select) {
        select.onchange = (e) => {
            const id = e.target.value;
            if (id) loadVariantIntoEditor(id);
            e.target.value = '';
        };
    }

    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();

    requestAnimationFrame(() => overlay.classList.add('active'));
    updateLiveFollowButton();
}

function formatSyncTimecode(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const cs = Math.floor((seconds - Math.floor(seconds)) * 100);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
}

function updateSyncMiniPlayer() {
    if (!syncEditorState.open) return;
    const cur = document.getElementById('sync-timecode-current');
    if (cur) cur.textContent = formatSyncTimecode(audioElement.currentTime || 0);

    const total = document.getElementById('sync-timecode-total');
    if (total && audioElement.duration && isFinite(audioElement.duration)) {
        total.textContent = formatSyncTimecode(audioElement.duration);
    }

    const pct = audioElement.duration ? (audioElement.currentTime / audioElement.duration) * 100 : 0;
    const fill = document.getElementById('sync-scrubber-fill');
    const knob = document.getElementById('sync-scrubber-knob');
    if (fill) fill.style.width = pct + '%';
    if (knob) knob.style.left = pct + '%';

    const icon = document.getElementById('sync-mini-play-icon');
    if (icon) icon.textContent = audioElement.paused ? 'play_arrow' : 'pause';

    updateSyncMiniVolume();
    if (syncEditorState.liveFollow && !audioElement.paused) {
        followPlayingLine();
    }
}

function syncMiniTogglePlay() {
    if (!audioElement.src) return;
    if (audioElement.paused) audioElement.play().catch(() => {});
    else audioElement.pause();
    updateSyncMiniPlayer();
}

function syncMiniSeekBy(delta) {
    if (!audioElement.src) return;
    const dur = audioElement.duration || 0;
    let t = (audioElement.currentTime || 0) + delta;
    if (t < 0) t = 0;
    if (dur > 0 && t > dur) t = dur;
    audioElement.currentTime = t;
    updateSyncMiniPlayer();
}

function startSyncScrub(event) {
    if (!audioElement.src) return;
    event.preventDefault();
    const scrubber = document.getElementById('sync-scrubber');
    if (!scrubber) return;
    const dur = audioElement.duration || 0;
    if (dur <= 0) return;

    const wasPlaying = !audioElement.paused;
    if (wasPlaying) audioElement.pause();

    function compute(clientX) {
        const rect = scrubber.getBoundingClientRect();
        let x = clientX - rect.left;
        if (x < 0) x = 0;
        if (x > rect.width) x = rect.width;
        return (x / rect.width) * dur;
    }

    function onMove(e) {
        audioElement.currentTime = compute(e.clientX);
        updateSyncMiniPlayer();
    }

    function onUp(e) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (wasPlaying) audioElement.play().catch(() => {});
    }

    audioElement.currentTime = compute(event.clientX);
    updateSyncMiniPlayer();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function renderSyncEditorLines() {
    const container = document.getElementById('sync-editor-lines');
    if (!container) return;

    if (syncEditorState.lines.length === 0) {
        const pasteOpen = syncEditorState.pasteOpen === true;
        container.innerHTML = `
            <div class="sync-editor-empty">
                <i class="fas fa-align-left"></i>
                <p>No lines loaded</p>
                <small>Choose a source above, or start from scratch.</small>
                <div class="sync-editor-empty-actions">
                    <button class="sync-editor-mini-btn" onclick="togglePasteArea()">Paste Lyrics</button>
                    <button class="sync-editor-mini-btn sync-editor-mini-btn-primary" onclick="startBlankSyncSession()">Start Blank</button>
                </div>
                ${
                    pasteOpen
                        ? `
                    <div class="sync-editor-paste-area">
                        <textarea class="sync-editor-paste" id="sync-editor-paste" placeholder="Paste lyrics here (one line per row)…"></textarea>
                        <button class="sync-editor-mini-btn sync-editor-mini-btn-primary" onclick="loadPastedIntoEditor()">Load Pasted Lyrics</button>
                    </div>
                `
                        : ''
                }
            </div>
        `;
        if (pasteOpen) {
            const ta = document.getElementById('sync-editor-paste');
            if (ta) ta.focus();
        }
        return;
    }

    const html = syncEditorState.lines
        .map((line, i) => {
            const isFocused = i === syncEditorState.focusedIndex;
            const isInstrumental = line.instrumental === true;
            const isBlank = !isInstrumental && line.text.trim() === '';
            const timeStr = typeof line.time === 'number' ? formatLrcTime(line.time) : '--:--.--';
            const focusedClass = isFocused ? ' sync-editor-line-focused' : '';
            const blankClass = isBlank ? ' sync-editor-line-blank' : '';
            const instrClass = isInstrumental ? ' sync-editor-line-instrumental' : '';
            const textContent = isInstrumental
                ? '<span class="sync-editor-instr-glyph"><span class="material-symbols-outlined">music_note</span></span>'
                : isBlank
                ? '&nbsp;'
                : escapeHtml(line.text);

            return `
                            <div class="sync-editor-line${focusedClass}${blankClass}${instrClass}" data-index="${i}" onclick="selectSyncLine(${i})">
                <div class="sync-editor-insert">
                    <button class="sync-editor-insert-btn" onclick="event.stopPropagation(); insertSyncLineAbove(${i})" title="Add line above">+</button>
                    <button class="sync-editor-insert-btn" onclick="event.stopPropagation(); insertSyncLineBelow(${i})" title="Add line below">+</button>
                </div>
                <div class="sync-editor-text" ondblclick="event.stopPropagation(); ${
                    isInstrumental ? '' : `editSyncLineText(${i})`
                }" title="${isInstrumental ? 'Instrumental marker' : 'Double-click to edit'}">${textContent}</div>
                <div class="sync-editor-time" onclick="event.stopPropagation(); editSyncLineTime(${i})" oncontextmenu="event.preventDefault(); event.stopPropagation(); clearSyncLineTime(${i});">
                    ${timeStr}
                </div>
                <div class="sync-editor-shift-group">
                    <button class="sync-editor-shift-btn" onclick="event.stopPropagation(); shiftSyncLineTime(${i}, -1)" title="−1s">−1</button>
                    <button class="sync-editor-shift-btn" onclick="event.stopPropagation(); shiftSyncLineTime(${i}, -0.5)" title="−0.5s">−.5</button>
                    <button class="sync-editor-shift-btn" onclick="event.stopPropagation(); shiftSyncLineTime(${i}, -0.1)" title="−0.1s">−.1</button>
                    <button class="sync-editor-shift-btn" onclick="event.stopPropagation(); shiftSyncLineTime(${i}, 0.1)" title="+0.1s">+.1</button>
                    <button class="sync-editor-shift-btn" onclick="event.stopPropagation(); shiftSyncLineTime(${i}, 0.5)" title="+0.5s">+.5</button>
                    <button class="sync-editor-shift-btn" onclick="event.stopPropagation(); shiftSyncLineTime(${i}, 1)" title="+1s">+1</button>
                </div>
                <div class="sync-editor-actions">
                    ${
                        isFocused && (isInstrumental || !isBlank)
                            ? '<button class="sync-editor-icon-btn sync-editor-icon-btn-primary" onclick="event.stopPropagation(); stampFocusedLine()" title="Stamp current time (F1)">+</button>'
                            : ''
                    }
                    ${
                        isFocused
                            ? `<button class="sync-editor-icon-btn ${
                                  isInstrumental ? 'sync-editor-icon-btn-active' : ''
                              }" onclick="event.stopPropagation(); toggleSyncLineInstrumental(${i})" title="${
                                  isInstrumental ? 'Mark as lyric' : 'Mark as instrumental'
                              }"><span class="material-symbols-outlined">music_note</span></button>`
                            : ''
                    }
                </div>
            </div>
        `;
        })
        .join('');

    container.innerHTML = html;

    container.querySelectorAll('.sync-editor-line').forEach((row) => {
        row.addEventListener('contextmenu', (e) => {
            const idx = parseInt(row.getAttribute('data-index'), 10);
            if (isNaN(idx)) return;
            e.preventDefault();
            e.stopPropagation();
            showSyncLineContextMenu(e, idx);
        });
    });
}

function loadPastedIntoEditor() {
    const textarea = document.getElementById('sync-editor-paste');
    if (!textarea) return;
    syncEditorState.pasteOpen = false;
    setSyncEditorLinesFromText(textarea.value);
}

function togglePasteArea() {
    syncEditorState.pasteOpen = !syncEditorState.pasteOpen;
    renderSyncEditorLines();
}

function startBlankSyncSession() {
    pushSyncHistory('Start blank');
    syncEditorState.lines = [
        {
            text: '',
            time: null
        }
    ];
    syncEditorState.focusedIndex = 0;
    syncEditorState.pasteOpen = false;
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
    setTimeout(() => editSyncLineText(0), 30);
}

function setSyncEditorLinesFromText(text) {
    pushSyncHistory('Load lyrics');
    const normalized = String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
    const lines = normalized
        .split('\n')
        .filter((t) => t.trim() !== '')
        .map((t) => ({
            text: t,
            time: null
        }));
    syncEditorState.lines = lines;
    syncEditorState.focusedIndex = 0;
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function loadPlainLyricsIntoEditor() {
    const song = SONGS_DATA.find((s) => s.id === syncEditorState.songId);
    if (!song) return;
    const plain = getLyricsForSong(song);
    if (!plain || String(plain).trim() === '') {
        showNotification('No plain lyrics available', 'warning', 2000);
        return;
    }
    const stripped = String(plain).replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, '');
    setSyncEditorLinesFromText(stripped);
}

function loadVariantIntoEditor(variantId) {
    const song = SONGS_DATA.find((s) => s.id === syncEditorState.songId);
    if (!song) return;
    const entry = getSyncedLyricsVariantsForSong(song);
    if (!entry) return;
    const variant = entry.variants.find((v) => v.id === variantId);
    if (!variant) return;

    const sourceLines = variant.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    const lines = [];
    for (const raw of sourceLines) {
        const parsed = parseLrcLine(raw);
        if (!parsed) continue;
        for (const t of parsed.times) {
            lines.push({
                text: parsed.text,
                time: t,
                instrumental: parsed.instrumental
            });
        }
    }

    lines.sort((a, b) => (a.time || 0) - (b.time || 0));

    syncEditorState.lines = lines;
    syncEditorState.focusedIndex = 0;
    syncEditorState.sourceVariantId = variantId;
    syncEditorState.offset = typeof variant.offset === 'number' ? variant.offset : 0;

    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function importLrcIntoEditor() {
    if (window.electronAPI && window.electronAPI.readLyricsFile) {
        window.electronAPI.readLyricsFile().then((result) => {
            if (!result || !result.success) return;
            applyImportedLrcText(result.contents);
        });
    } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.lrc,text/plain';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => applyImportedLrcText(ev.target.result);
            reader.readAsText(file);
        };
        input.click();
    }
}

function applyImportedLrcText(text) {
    const normalized = String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
    const lines = [];

    for (const raw of normalized.split('\n')) {
        const parsed = parseLrcLine(raw);
        if (!parsed) continue;
        for (const t of parsed.times) {
            lines.push({
                text: parsed.text,
                time: t,
                instrumental: parsed.instrumental
            });
        }
    }

    if (lines.length === 0) {
        showNotification('No valid LRC timestamps found', 'error', 2500);
        return;
    }

    lines.sort((a, b) => (a.time || 0) - (b.time || 0));

    syncEditorState.lines = lines;
    syncEditorState.focusedIndex = 0;
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
    showNotification('Imported ' + lines.length + ' lines', 'success', 2000);
}

function focusSyncLine(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    syncEditorState.focusedIndex = index;
    renderSyncEditorLines();
    scrollSyncLineIntoView(index);
}

function scrollSyncLineIntoView(index) {
    const container = document.getElementById('sync-editor-lines');
    if (!container) return;
    const el = container.querySelector('.sync-editor-line[data-index="' + index + '"]');
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (elRect.top < containerRect.top || elRect.bottom > containerRect.bottom) {
        el.scrollIntoView({
            block: 'center',
            behavior: 'smooth'
        });
    }
}

function stampFocusedLine() {
    if (!syncEditorState.open) return;
    const idx = syncEditorState.focusedIndex;
    if (idx < 0 || idx >= syncEditorState.lines.length) return;
    const line = syncEditorState.lines[idx];
    if (!line) return;
    if (!line.instrumental && line.text.trim() === '') return;

    pushSyncHistory('Stamp');
    line.time = Math.max(0, audioElement.currentTime || 0);

    let next = -1;
    for (let i = idx + 1; i < syncEditorState.lines.length; i++) {
        const l = syncEditorState.lines[i];
        if (l.instrumental || l.text.trim() !== '') {
            next = i;
            break;
        }
    }
    if (next !== -1) syncEditorState.focusedIndex = next;

    renderSyncEditorLines();
    if (next !== -1) scrollSyncLineIntoView(next);
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function clearSyncLineTime(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    pushSyncHistory('Clear stamp');
    syncEditorState.lines[index].time = null;
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function editSyncLineTime(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    const container = document.getElementById('sync-editor-lines');
    if (!container) return;
    const row = container.querySelector('.sync-editor-line[data-index="' + index + '"]');
    if (!row) return;
    const timeCell = row.querySelector('.sync-editor-time');
    if (!timeCell) return;

    const current = syncEditorState.lines[index].time;
    const currentStr = typeof current === 'number' ? formatLrcTime(current) : '';

    timeCell.innerHTML = '<input type="text" class="sync-editor-time-input" value="' + currentStr + '" />';
    const input = timeCell.querySelector('input');
    if (!input) return;
    input.focus();
    input.select();

    let committed = false;
    const commit = () => {
        if (committed) return;
        committed = true;
        const parsed = parseManualTime(input.value);
        if (parsed === null) {
            renderSyncEditorLines();
            return;
        }
        syncEditorState.lines[index].time = parsed;
        renderSyncEditorLines();
        updateSyncEditorPreview();
        updateSyncEditorProgress();
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            committed = true;
            renderSyncEditorLines();
        }
    });
    input.addEventListener('blur', commit);
}

function editSyncLineText(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    const container = document.getElementById('sync-editor-lines');
    if (!container) return;
    const row = container.querySelector('.sync-editor-line[data-index="' + index + '"]');
    if (!row) return;
    const textCell = row.querySelector('.sync-editor-text');
    if (!textCell) return;

    const original = syncEditorState.lines[index].text;
    textCell.innerHTML = '<textarea class="sync-editor-text-input" rows="1">' + escapeHtml(original) + '</textarea>';
    const input = textCell.querySelector('textarea');
    if (!input) return;
    input.focus();
    input.select();

    let committed = false;

    const commit = (splitLine) => {
        if (committed) return;
        committed = true;

        if (splitLine) {
            const cursorPos = input.selectionStart;
            const before = input.value.substring(0, cursorPos);
            const after = input.value.substring(cursorPos);
            pushSyncHistory('Edit line text');
            syncEditorState.lines[index].text = before;
            syncEditorState.lines[index].instrumental = false;
            syncEditorState.lines.splice(index + 1, 0, {
                text: after,
                time: null
            });
            if (after.trim() === '') {
                for (let i = index + 2; i < syncEditorState.lines.length; i++) {
                    if (syncEditorState.lines[i].text.trim() !== '') {
                        syncEditorState.focusedIndex = i;
                        break;
                    }
                }
            } else {
                syncEditorState.focusedIndex = index + 1;
            }
        } else {
            pushSyncHistory('Edit line text');
            syncEditorState.lines[index].text = input.value;
            syncEditorState.lines[index].instrumental = false;
        }

        renderSyncEditorLines();
        updateSyncEditorPreview();
        updateSyncEditorProgress();
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit(true);
        } else if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = input.value.substring(0, start) + '\n' + input.value.substring(end);
            input.selectionStart = input.selectionEnd = start + 1;
        } else if (e.key === 'Escape') {
            e.preventDefault();
            committed = true;
            renderSyncEditorLines();
        }
    });
    input.addEventListener('blur', () => commit(false));
}

function clearAllSyncStamps() {
    if (syncEditorState.lines.length === 0) return;
    pushSyncHistory('Clear all stamps');
    syncEditorState.lines.forEach((l) => {
        l.time = null;
    });
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function discardSyncChanges() {
    if (!syncEditorState.open) return;
    const hasWork = syncEditorState.lines.length > 0 || (syncEditorState.history && syncEditorState.history.length > 0);
    if (!hasWork) return;

    showConfirmDialog({
        title: 'Discard Changes',
        message: 'Discard all changes and go back to the source picker?',
        okText: 'Discard',
        cancelText: 'Cancel'
    }).then((confirmed) => {
        if (!confirmed) return;
        syncEditorState.lines = [];
        syncEditorState.focusedIndex = -1;
        syncEditorState.sourceVariantId = null;
        syncEditorState.history = [];
        syncEditorState.redoStack = [];
        syncEditorState.pasteOpen = false;
        renderSyncEditorLines();
        updateSyncEditorPreview();
        updateSyncEditorProgress();
    });
}

function copySyncCurrentTime() {
    const t = formatSyncTimecode(audioElement.currentTime || 0);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
            .writeText(t)
            .then(() => {
                showNotification('Copied ' + t, 'success', 1500);
            })
            .catch(() => {
                showNotification('Copy failed', 'error', 1500);
            });
    } else {
        const ta = document.createElement('textarea');
        ta.value = t;
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            showNotification('Copied ' + t, 'success', 1500);
        } catch (e) {}
        ta.remove();
    }
}

function updateSyncMiniVolume() {
    if (!syncEditorState.open) return;
    const vol = audioElement.volume || 0;
    const fill = document.getElementById('sync-volume-fill');
    const knob = document.getElementById('sync-volume-knob');
    if (fill) fill.style.width = vol * 100 + '%';
    if (knob) knob.style.left = vol * 100 + '%';

    const icon = document.getElementById('sync-volume-icon');
    if (icon) {
        if (audioElement.muted || vol === 0) icon.textContent = 'volume_off';
        else if (vol < 0.4) icon.textContent = 'volume_down';
        else icon.textContent = 'volume_up';
    }
}

function syncMiniToggleMute() {
    audioElement.muted = !audioElement.muted;
    updateSyncMiniVolume();
    if (typeof updateVolume === 'function') updateVolume(audioElement.volume);
}

function startSyncVolumeDrag(event) {
    event.preventDefault();
    const slider = document.getElementById('sync-volume-slider');
    if (!slider) return;

    function compute(clientX) {
        const rect = slider.getBoundingClientRect();
        let x = clientX - rect.left;
        if (x < 0) x = 0;
        if (x > rect.width) x = rect.width;
        return x / rect.width;
    }

    function onMove(e) {
        const v = compute(e.clientX);
        audioElement.volume = v;
        audioElement.muted = false;
        updateSyncMiniVolume();
        if (typeof updateVolume === 'function') updateVolume(audioElement.volume);
    }

    function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    }

    const v = compute(event.clientX);
    audioElement.volume = v;
    audioElement.muted = false;
    updateSyncMiniVolume();
    if (typeof updateVolume === 'function') updateVolume(audioElement.volume);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function generateLrcFromEditor() {
    const timed = syncEditorState.lines.filter((l) => {
        if (typeof l.time !== 'number') return false;
        if (l.instrumental) return true;
        return l.text.trim() !== '';
    });
    timed.sort((a, b) => a.time - b.time);

    let out = '';
    const song = SONGS_DATA.find((s) => s.id === syncEditorState.songId);
    if (song) {
        if (song.title) out += '[ti:' + song.title + ']\n';
        if (song.artist) out += '[ar:' + song.artist + ']\n';
        if (song.album) out += '[al:' + song.album + ']\n';
    }
    out += '\n';
    for (const l of timed) {
        if (l.instrumental) {
            out += '[' + formatLrcTime(l.time) + ']\n';
        } else {
            out += '[' + formatLrcTime(l.time) + '] ' + l.text + '\n';
        }
    }
    return out;
}

function updateSyncEditorPreview() {
    const ta = document.getElementById('sync-lrc-preview');
    if (ta) ta.value = generateLrcFromEditor();
}

function updateSyncEditorProgress() {
    const el = document.getElementById('sync-progress-count');
    if (!el) return;
    const nonBlank = syncEditorState.lines.filter((l) => l.text.trim() !== '');
    const timed = nonBlank.filter((l) => typeof l.time === 'number');
    el.textContent = timed.length + ' / ' + nonBlank.length;
}

function saveSyncAsFile(format) {
    const song = SONGS_DATA.find((s) => s.id === syncEditorState.songId);
    if (!song) return;
    const contents = generateLrcFromEditor();
    if (!contents || contents.trim() === '') {
        showNotification('Nothing to save', 'warning', 2000);
        return;
    }
    const safeTitle = (song.title || 'lyrics').replace(/[\\/:*?"<>|]/g, '_');
    const safeArtist = (song.artist || '').replace(/[\\/:*?"<>|]/g, '_');
    const defaultName = (safeArtist ? safeArtist + ' - ' : '') + safeTitle + '.' + format;

    if (window.electronAPI && window.electronAPI.saveLyricsFile) {
        window.electronAPI.saveLyricsFile(defaultName, contents).then((result) => {
            if (result && result.success) {
                showNotification('Saved', 'success', 2000);
            }
        });
    } else {
        const blob = new Blob([contents], {
            type: 'text/plain'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('Saved', 'success', 2000);
    }
}

function saveSyncEditor() {
    const song = SONGS_DATA.find((s) => s.id === syncEditorState.songId);
    if (!song) {
        closeSyncEditor();
        return;
    }

    const nonBlank = syncEditorState.lines.filter((l) => l.text.trim() !== '');
    const untimedCount = nonBlank.filter((l) => typeof l.time !== 'number').length;
    const timedCount = nonBlank.length - untimedCount;

    if (timedCount === 0) {
        showNotification('No lines have been timed yet', 'warning', 2500);
        return;
    }

    const finish = () => {
        const contents = generateLrcFromEditor();
        const variant = addSyncedLyricsVariant(song.id, contents, syncEditorState.offset);
        if (!variant) {
            showNotification('Failed to save', 'error', 2000);
            return;
        }
        setActiveSyncedLyricsVariant(song.id, variant.id);
        closeSyncEditor();
        showNotification('Saved as ' + variant.name, 'success', 2000);
        if (currentView === 'lyrics') renderLyricsView();
    };

    if (untimedCount > 0) {
        showConfirmDialog({
            title: 'Untimed Lines',
            message:
                untimedCount +
                ' line' +
                (untimedCount === 1 ? '' : 's') +
                ' ha' +
                (untimedCount === 1 ? 's' : 've') +
                ' no timestamp and will be omitted. Continue?',
            okText: 'Save Anyway',
            cancelText: 'Cancel'
        }).then((confirmed) => {
            if (confirmed) finish();
        });
    } else {
        finish();
    }
}

function seekToSyncedLine(index) {
    if (!syncedLyricsState.entries || index < 0 || index >= syncedLyricsState.entries.length) return;
    const entry = syncedLyricsState.entries[index];
    if (!entry) return;

    const targetTime = entry.time;

    if (!audioElement.src) return;

    audioElement.currentTime = targetTime;

    if (audioElement.paused) {
        audioElement.play().catch(() => {});
        if (typeof playButton !== 'undefined') {
            playButton.innerHTML = '<i class="fas fa-pause"></i>';
            playButton.setAttribute('aria-label', 'Pause');
            playButton.setAttribute('title', 'Pause');
        }
    }

    updateSyncedLyricsHighlight(audioElement.currentTime);
}

function toggleLiveFollow() {
    syncEditorState.liveFollow = !syncEditorState.liveFollow;
    updateLiveFollowButton();
    if (syncEditorState.liveFollow) {
        followPlayingLine();
    }
}

function updateLiveFollowButton() {
    const btn = document.getElementById('sync-live-follow-btn');
    if (!btn) return;
    btn.classList.toggle('active', !!syncEditorState.liveFollow);
}

function followPlayingLine() {
    if (!syncEditorState.liveFollow) return;
    if (!syncEditorState.entries && (!syncEditorState.lines || syncEditorState.lines.length === 0)) return;

    const t = audioElement.currentTime || 0;
    let targetIndex = -1;
    for (let i = 0; i < syncEditorState.lines.length; i++) {
        const l = syncEditorState.lines[i];
        if (typeof l.time === 'number' && l.time <= t) {
            targetIndex = i;
        }
    }

    if (targetIndex === -1 || targetIndex === syncEditorState.focusedIndex) return;

    syncEditorState.focusedIndex = targetIndex;
    renderSyncEditorLines();
    scrollSyncLineIntoView(targetIndex);
}

function insertSyncLineAbove(index) {
    pushSyncHistory('Insert line above');
    syncEditorState.lines.splice(index, 0, {
        text: '',
        time: null
    });
    syncEditorState.focusedIndex = index;
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
    scrollSyncLineIntoView(index);
    setTimeout(() => editSyncLineText(index), 30);
}

function insertSyncLineBelow(index) {
    pushSyncHistory('Insert line below');
    syncEditorState.lines.splice(index + 1, 0, {
        text: '',
        time: null
    });
    syncEditorState.focusedIndex = index + 1;
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
    scrollSyncLineIntoView(index + 1);
    setTimeout(() => editSyncLineText(index + 1), 30);
}

function deleteSyncLine(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    pushSyncHistory('Delete line');
    syncEditorState.lines.splice(index, 1);
    if (syncEditorState.focusedIndex >= syncEditorState.lines.length) {
        syncEditorState.focusedIndex = syncEditorState.lines.length - 1;
    }
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function setSyncLineTimeToNow(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    pushSyncHistory('Set time');
    syncEditorState.lines[index].time = Math.max(0, audioElement.currentTime || 0);
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function toggleSyncLineInstrumental(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    pushSyncHistory('Toggle instrumental');
    const line = syncEditorState.lines[index];
    line.instrumental = !line.instrumental;
    if (line.instrumental) line.text = '';
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function shiftSyncLineTime(index, delta) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    const line = syncEditorState.lines[index];
    if (typeof line.time !== 'number') {
        showNotification('Line has no time to shift', 'warning', 1500);
        return;
    }
    pushSyncHistory('Shift time');
    let t = line.time + delta;
    if (t < 0) t = 0;
    line.time = t;
    renderSyncEditorLines();
    updateSyncEditorPreview();
}

let _syncLineContextMenu = null;
let _syncLineContextMenuOpenedAt = 0;
let _syncLineContextMenuDocHandler = null;

function showSyncLineContextMenu(event, index) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    closeSyncLineContextMenu();
    if (index < 0 || index >= syncEditorState.lines.length) return;

    const menu = document.createElement('div');
    menu.className = 'sync-line-context-menu';
    menu.style.position = 'fixed';
    menu.style.zIndex = '100050';
    menu.style.background = '#282828';
    menu.style.borderRadius = '4px';
    menu.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    menu.style.minWidth = '190px';
    menu.style.padding = '4px 0';
    menu.style.display = 'block';

    const line = syncEditorState.lines[index];
    const isInstrumental = line && line.instrumental === true;
    const items = [
        {
            icon: 'fa-crosshairs',
            label: 'Focus',
            handler: () => focusSyncLine(index)
        },
        {
            icon: 'fa-clock',
            label: 'Set the time',
            handler: () => setSyncLineTimeToNow(index)
        },
        {
            icon: 'fa-music',
            label: isInstrumental ? 'Mark as lyric' : 'Mark as instrumental',
            handler: () => toggleSyncLineInstrumental(index)
        },
        {
            icon: 'fa-plus',
            label: 'Add new line below',
            handler: () => insertSyncLineBelow(index)
        },
        {
            icon: 'fa-plus',
            label: 'Add new line above',
            handler: () => insertSyncLineAbove(index)
        },
        {
            icon: 'fa-trash-alt',
            label: 'Delete line',
            handler: () => deleteSyncLine(index)
        },
        {
            icon: 'fa-pen',
            label: 'Edit line',
            handler: () => editSyncLineText(index)
        }
    ];

    menu.innerHTML = items
        .map(
            (it) => `
        <div class="sync-line-context-item" style="display:flex;align-items:center;padding:10px 12px;cursor:pointer;font-size:13px;color:#fff;">
            <i class="fas ${it.icon}" style="width:20px;margin-right:12px;color:#b3b3b3;"></i>
            <span>${it.label}</span>
        </div>
    `
        )
        .join('');

    document.body.appendChild(menu);

    menu.querySelectorAll('.sync-line-context-item').forEach((el, i) => {
        el.addEventListener('mouseenter', () => (el.style.background = 'rgba(255,255,255,0.1)'));
        el.addEventListener('mouseleave', () => (el.style.background = 'transparent'));
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            closeSyncLineContextMenu();
            const item = items[i];
            if (item && typeof item.handler === 'function') {
                try {
                    item.handler();
                } catch (err) {}
            }
        });
    });

    const menuWidth = menu.offsetWidth || 190;
    const menuHeight = menu.offsetHeight || 220;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let posX = event.clientX;
    let posY = event.clientY + 5;

    if (windowWidth - event.clientX < menuWidth) posX = event.clientX - menuWidth - 7;
    if (posX < 7) posX = 7;

    if (windowHeight - event.clientY < menuHeight) posY = event.clientY - menuHeight - 7;
    if (posY < 7) posY = 7;

    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';

    _syncLineContextMenu = menu;
    _syncLineContextMenuOpenedAt = Date.now();

    _syncLineContextMenuDocHandler = (e) => {
        if (!_syncLineContextMenu) return;
        if (Date.now() - _syncLineContextMenuOpenedAt < 100) return;
        if (_syncLineContextMenu.contains(e.target)) return;
        closeSyncLineContextMenu();
    };

    setTimeout(() => {
        document.addEventListener('mousedown', _syncLineContextMenuDocHandler, true);
        document.addEventListener('contextmenu', _syncLineContextMenuDocHandler, true);
    }, 50);
}

function closeSyncLineContextMenu() {
    if (_syncLineContextMenu) {
        _syncLineContextMenu.remove();
        _syncLineContextMenu = null;
    }
    if (_syncLineContextMenuDocHandler) {
        document.removeEventListener('mousedown', _syncLineContextMenuDocHandler, true);
        document.removeEventListener('contextmenu', _syncLineContextMenuDocHandler, true);
        _syncLineContextMenuDocHandler = null;
    }
}

function selectSyncLine(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    if (index === syncEditorState.focusedIndex) return;
    syncEditorState.focusedIndex = index;
    renderSyncEditorLines();
}

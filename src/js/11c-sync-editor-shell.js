// Sync editor: time helpers, undo/redo history, and the editor shell (open/close/render).

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

    const song = getSongById(syncEditorState.songId);
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

// Importing/pasting LRC text onto the currently playing song (outside the sync editor).

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

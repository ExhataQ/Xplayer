// Sync editor: mini-player volume plus generate/save/seek/live-follow.

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
    const song = getSongById(syncEditorState.songId);
    if (song) {
        if (song.title) out += '[ti:' + song.title + ']\n';
        if (song.artist) out += '[ar:' + song.artist + ']\n';
        if (song.album) out += '[al:' + song.album + ']\n';
    }
    out += '\n';
    for (const l of timed) {
        if (l.instrumental) {
            out += '[' + formatLrcTime(l.time) + '] [instrumental]\n';
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
    const song = getSongById(syncEditorState.songId);
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
    const song = getSongById(syncEditorState.songId);
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

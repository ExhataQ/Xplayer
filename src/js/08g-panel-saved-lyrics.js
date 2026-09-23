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

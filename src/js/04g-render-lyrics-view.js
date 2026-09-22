// ==============================================================================
// UI RENDER - LYRICS VIEW
// ==============================================================================
function renderLyricsView() {
    let container = document.getElementById('lyrics-view-root');
    const songListContainer = document.getElementById('song-list-container');
    const mainContentInner = document.querySelector('.main-content-inner');

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

    let currentSong = null;
    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const queueItem = playbackQueue[currentQueueIndex];
        currentSong = queueItem.song || queueItem;
    }

    if (!currentSong) {
        container.innerHTML = `
            <div class="lyrics-view-container">
                <div class="lyrics-view-empty">
                    <i class="fas fa-align-left"></i>
                    <p>No song playing</p>
                    <small>Play a song to see its lyrics</small>
                </div>
            </div>
        `;
        setTimeout(() => {
            if (typeof updateExternalScrollbar === 'function') updateExternalScrollbar();
        }, 50);
        return;
    }

    const lyrics = getLyricsForSong(currentSong);
    const hasLyrics = lyrics && String(lyrics).trim() !== '';
    const isInstrumental = currentSong.instrumental === true;

    const hasSynced = typeof initSyncedLyrics === 'function' && initSyncedLyrics(currentSong);

    if (lyricsDisplayMode.songId !== currentSong.id) {
        resetLyricsDisplayMode(currentSong.id);
    }

    const storedMode = getLyricsDisplayMode(currentSong);
    let effectiveMode = 'auto';
    if (hasSynced && hasLyrics) {
        effectiveMode = storedMode === 'plain' ? 'plain' : 'synced';
    } else if (hasSynced) {
        effectiveMode = 'synced';
    } else if (hasLyrics) {
        effectiveMode = 'plain';
    }

    const showSynced = effectiveMode === 'synced' && hasSynced;
    const showPlain = effectiveMode === 'plain' && hasLyrics;

    let lyricsBody = '';
    if (showSynced) {
        const linesHTML = syncedLyricsState.entries
            .map((entry, i) => {
                if (entry.instrumental) {
                    return (
                        '<div class="lyrics-line lyrics-line-instrumental" data-sync-index="' +
                        i +
                        '" dir="auto"><span class="material-symbols-outlined">music_note</span></div>'
                    );
                }
                if (entry.text.trim() === '') {
                    return '<div class="lyrics-line lyrics-line-empty" data-sync-index="' + i + '" dir="auto"></div>';
                }
                return '<div class="lyrics-line" data-sync-index="' + i + '" dir="auto">' + escapeHtml(entry.text) + '</div>';
            })
            .join('');
        lyricsBody = `<div class="lyrics-view-text lyrics-view-synced">${linesHTML}</div>`;
    } else if (showPlain) {
        const normalizedLyrics = String(lyrics).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lyricsLines = normalizedLyrics.split('\n');
        const lyricsHTML = lyricsLines
            .map((line) => {
                if (line.trim() === '') {
                    return '<div class="lyrics-line lyrics-line-empty" dir="auto"></div>';
                }
                return `<div class="lyrics-line" dir="auto">${escapeHtml(line)}</div>`;
            })
            .join('');
        lyricsBody = `<div class="lyrics-view-text">${lyricsHTML}</div>`;
    } else if (isInstrumental) {
        lyricsBody = `<div class="lyrics-view-text">
                <div class="lyrics-line lyrics-line-instrumental-block" title="Verified by LRCLIB">
                    <span class="material-symbols-outlined">music_note</span>
                    <span>Instrumental</span>
                </div>
           </div>`;
    } else {
        lyricsBody = `<div class="lyrics-view-text">
                <div class="lyrics-line">No lyrics for this song</div>
           </div>`;
    }

    container.innerHTML = `
        <div class="lyrics-view-container">
            ${lyricsBody}
            <div class="lyrics-view-footer">
                ${(() => {
                    if (!hasSynced && !hasLyrics) return '';
                    const syncedActive = showSynced ? ' active' : '';
                    const plainActive = showPlain ? ' active' : '';
                    const syncedDisabled = !hasSynced || showSynced ? ' disabled' : '';
                    const plainDisabled = !hasLyrics || showPlain ? ' disabled' : '';
                    return `
                        <button class="lyrics-view-edit-btn lyrics-view-mode-btn${syncedActive}${syncedDisabled}" ${syncedDisabled ? 'disabled aria-disabled="true"' : ''} onclick="${syncedDisabled ? '' : `setLyricsDisplayMode('synced')`}" aria-label="Show synced LRC lyrics">
                            <span class="material-symbols-outlined">graphic_eq</span>
                            <span>Synced (LRC)</span>
                        </button>
                        <button class="lyrics-view-edit-btn lyrics-view-mode-btn${plainActive}${plainDisabled}" ${plainDisabled ? 'disabled aria-disabled="true"' : ''} onclick="${plainDisabled ? '' : `setLyricsDisplayMode('plain')`}" aria-label="Show plain lyrics">
                            <span class="material-symbols-outlined">notes</span>
                            <span>Plain Lyrics</span>
                        </button>
                    `;
                })()}
                <button class="lyrics-view-edit-btn" onclick="openLyricsEditor()" aria-label="Insert or edit lyrics">
                    <span class="material-symbols-outlined">edit</span>
                    <span>${hasLyrics ? 'Edit Lyrics' : 'Add Lyrics'}</span>
                </button>
                <button class="lyrics-view-edit-btn" onclick="openSyncEditor()" aria-label="Open sync editor">
                    <span class="material-symbols-outlined">graphic_eq</span>
                    <span>Sync</span>
                </button>
                <button class="lyrics-view-edit-btn" onclick="importLrcFile()" aria-label="Import LRC file">
                    <span class="material-symbols-outlined">upload_file</span>
                    <span>Import .lrc</span>
                </button>
                <button class="lyrics-view-edit-btn" onclick="openLrcPasteDialog()" aria-label="Paste LRC text">
                    <span class="material-symbols-outlined">content_paste</span>
                    <span>Paste LRC</span>
                </button>
                <button class="lyrics-view-edit-btn lyrics-online-btn" onclick="openOnlineLyricsView()" aria-label="Find lyrics or LRC online">
                    <span class="material-symbols-outlined">language</span>
                    <span>Find lyrics / LRC online</span>
                </button>
            </div>
            ${(() => {
                if (!showSynced) return '';
                const entry =
                    typeof getSyncedLyricsVariantsForSong === 'function'
                        ? getSyncedLyricsVariantsForSong(currentSong)
                        : null;
                if (!entry || !entry.variants || entry.variants.length === 0) return '';
                const rows = entry.variants
                    .map((v) => {
                        const isActive = v.id === entry.activeId;
                        const created = new Date(v.createdAt || Date.now()).toLocaleDateString();
                        return `
                        <div class="synced-variant-row ${isActive ? 'active' : ''}" data-variant-id="${v.id}">
                            <span class="synced-variant-radio" onclick="selectSyncedVariant('${v.id}')">${
                            isActive ? '●' : '○'
                        }</span>
                            <span class="synced-variant-name" onclick="selectSyncedVariant('${v.id}')">${escapeHtml(
                            v.name
                        )}</span>
                            <span class="synced-variant-meta">${created}</span>
                            <button class="synced-variant-icon-btn" onclick="renameSyncedVariant('${
                                v.id
                            }')" title="Rename"><span class="material-symbols-outlined">edit</span></button>
                            <button class="synced-variant-icon-btn" onclick="deleteSyncedVariant('${
                                v.id
                            }')" title="Delete"><span class="material-symbols-outlined">delete</span></button>
                        </div>
                    `;
                    })
                    .join('');
                return `<div class="synced-variants-list">${rows}</div>`;
            })()}
        </div>
    `;

    if (showSynced) {
        const wrappers = container.querySelectorAll('.lyrics-line');
        syncedLyricsState.lineElements = Array.from(wrappers);
        syncedLyricsState.container = document.querySelector('.content');
        syncedLyricsState.lineElements.forEach((el, i) => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => seekToSyncedLine(i));
        });
        attachSyncedLyricsScrollWatcher();
        updateSyncedLyricsHighlight(audioElement.currentTime || 0);
    } else {
        syncedLyricsState.entries = null;
        syncedLyricsState.lineElements = [];
        syncedLyricsState.activeIndex = -1;
        resetSyncedLyricsFollowState();
    }

    setTimeout(() => {
        if (typeof updateExternalScrollbar === 'function') updateExternalScrollbar();
    }, 50);
}

function teardownLyricsView() {
    const container = document.getElementById('lyrics-view-root');
    if (container) container.style.display = 'none';
    const lyricsToggleBtn = document.getElementById('lyrics-toggle-btn');
    if (lyricsToggleBtn) lyricsToggleBtn.classList.remove('active');
    if (typeof resetSyncedLyricsFollowState === 'function') {
        resetSyncedLyricsFollowState();
    }
}

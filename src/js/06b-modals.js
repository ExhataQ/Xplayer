// ==============================================================================
// MODAL DIALOGS
// ==============================================================================

let downloadProgressActive = false;
let downloadNotifyIndex = -1;

function createModal(modalClassName, overlayClassName, closeFunction) {
    const existingModal = document.querySelector(`.${modalClassName}`);
    const existingOverlay = document.querySelector(`.${overlayClassName}`);
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.className = overlayClassName;
    overlay.onclick = closeFunction;

    const modal = document.createElement('div');
    modal.className = modalClassName;

    return {
        modal,
        overlay
    };
}

function closePlaylistModal() {
    const overlay = document.querySelector('.playlist-modal-overlay');
    if (overlay) {
        if (overlay._cleanup) overlay._cleanup();
        overlay.remove();
    }
    const modal = document.querySelector('.playlist-modal');
    if (modal) modal.remove();
    document.querySelectorAll('.playlist-modal-overlay').forEach((el) => {
        if (el._cleanup) el._cleanup();
        el.remove();
    });
    document.querySelectorAll('.playlist-modal').forEach((el) => el.remove());
}

function closeAddLinkModal() {
    const overlay = document.querySelector('.playlist-modal-overlay');
    if (overlay) overlay.remove();
    const modal = document.querySelector('.playlist-modal');
    if (modal) modal.remove();
    downloadProgressActive = false;
}

function closeCreateItemModal() {
    const overlay = document.querySelector('.playlist-modal-overlay');
    if (overlay) {
        if (overlay._cleanup) overlay._cleanup();
        overlay.remove();
    }
    const modal = document.querySelector('.playlist-modal');
    if (modal) modal.remove();
}

function closePlayedDataModal() {
    const overlay = document.querySelector('.playlist-modal-overlay');
    if (overlay) {
        if (overlay._cleanup) overlay._cleanup();
        overlay.remove();
    }
    const modal = document.querySelector('.playlist-modal');
    if (modal) modal.remove();
}

function closeSongMetadataModal() {
    const overlay = document.querySelector('.song-metadata-modal-overlay');
    if (overlay) {
        if (overlay._cleanup) overlay._cleanup();
        overlay.remove();
    }
}

function showSongMetadataModal(songId) {
    const song = typeof SONGS_DATA !== 'undefined' ? SONGS_DATA.find((item) => item.id === songId) : null;
    if (!song) {
        showNotification('Song metadata is unavailable', 'warning', 2000);
        return;
    }

    closeSongMetadataModal();

    const fields = [
        ['Title', song.title],
        ['Artist', song.artist],
        ['Album', song.album],
        ['Genre', song.genre],
        ['Year', song.year],
        ['Track number', song.trackNumber ?? song.track],
        ['Language', song.language || song._detectedLanguage],
        ['Composer', song.composer],
        ['Comment', Array.isArray(song.comment) ? song.comment.join(', ') : song.comment],
        ['BPM', song.bpm]
    ];

    const overlay = document.createElement('div');
    overlay.className = 'song-metadata-modal-overlay';
    overlay.onclick = closeSongMetadataModal;

    const modal = document.createElement('div');
    modal.className = 'song-metadata-modal';
    modal.onclick = (event) => event.stopPropagation();
    modal.innerHTML = `
        <div class="song-metadata-modal-header">
            <h3>Song metadata</h3>
            <button type="button" class="song-metadata-modal-close" aria-label="Close" title="Close">&times;</button>
        </div>
        <div class="song-metadata-list">
            ${fields
                .map(
                    ([label, value]) => `
                        <div class="song-metadata-row">
                            <span class="song-metadata-label">${escapeHtml(label)}</span>
                            <span class="song-metadata-value">${escapeHtml(String(value ?? '—')) || '—'}</span>
                        </div>
                    `
                )
                .join('')}
        </div>
    `;

    modal.querySelector('.song-metadata-modal-close').onclick = closeSongMetadataModal;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const handleKeydown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeSongMetadataModal();
        }
    };
    document.addEventListener('keydown', handleKeydown);
    overlay._cleanup = () => document.removeEventListener('keydown', handleKeydown);
}

function showConfirmDialog(options) {
    return new Promise((resolve) => {
        const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', function () {
            resolve(false);
            closeConfirmDialog();
        });
        modal.onclick = (e) => e.stopPropagation();

        if (typeof syncEditorState !== 'undefined' && syncEditorState && syncEditorState.open) {
            overlay.style.zIndex = '100060';
        }

        modal.innerHTML = `
                <h3 class="playlist-modal-title">${options.title || 'Confirm'}</h3>
                <p style="color: var(--text-secondary); font-size: 13px; margin: 15px 0 20px 0; line-height: 1.5;">${
                    options.message
                }</p>
                <div class="playlist-modal-buttons">
                        <button id="confirm-cancel-btn" class="playlist-modal-cancel-btn">
                                ${options.cancelText || 'Cancel'}
                        </button>
                        <button id="confirm-ok-btn" class="playlist-modal-create-btn">
                                ${options.okText || 'OK'}
                        </button>
                </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const closeConfirmDialog = function () {
            if (overlay._cleanup) overlay._cleanup();
            overlay.remove();
        };

        const handleOk = function () {
            closeConfirmDialog();
            resolve(true);
        };

        const handleCancel = function () {
            closeConfirmDialog();
            resolve(false);
        };

        document.getElementById('confirm-ok-btn').onclick = handleOk;
        document.getElementById('confirm-cancel-btn').onclick = handleCancel;

        const handleKeydown = function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleOk();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        };

        document.addEventListener('keydown', handleKeydown);

        overlay._cleanup = function () {
            document.removeEventListener('keydown', handleKeydown);
        };

        setTimeout(() => {
            const okBtn = document.getElementById('confirm-ok-btn');
            if (okBtn) okBtn.focus();
        }, 50);
    });
}

function showCreatePlaylistDialog() {
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closePlaylistModal);
    modal.onclick = (e) => e.stopPropagation();

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Create New Playlist</h3>
        <input type="text" id="playlist-name-input" class="playlist-modal-input" placeholder="Playlist name">
        <div class="playlist-modal-buttons">
                <button onclick="closePlaylistModal()" class="playlist-modal-cancel-btn">
                        Cancel
                </button>
                <button onclick="confirmCreatePlaylist()" class="playlist-modal-create-btn">
                        Create
                </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const handleKeydown = function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            confirmCreatePlaylist();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closePlaylistModal();
        }
    };

    document.addEventListener('keydown', handleKeydown);

    overlay._cleanup = function () {
        document.removeEventListener('keydown', handleKeydown);
    };

    const originalClose = closePlaylistModal;
    closePlaylistModal = function () {
        if (overlay._cleanup) overlay._cleanup();
        document.removeEventListener('keydown', handleKeydown);
        originalClose();
    };

    setTimeout(() => {
        const input = document.getElementById('playlist-name-input');
        if (input) {
            input.focus();
            input.click();
        }
    }, 100);
}

function confirmCreatePlaylist() {
    const input = document.getElementById('playlist-name-input');
    const name = input ? input.value.trim() : '';

    if (name === '') {
        showNotification('Please enter a playlist name', 'warning', 2000);
        return;
    }

    const newPlaylist = createPlaylist(name);
    closePlaylistModal();

    if (currentOpenFolderId) {
        renderFolderContents(currentOpenFolderId);
    } else {
        renderPlaylistsView();
        renderLeftPanelMainList();
    }
    showNotification(`Playlist "${escapeHtml(name)}" created`, 'success', 2000);
    updateScrollbarById('left-panel-main-content');
}

function showEditPlaylistDialog(playlistId) {
    const playlists = getPlaylists();
    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
    if (!playlist) return;

    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closePlaylistModal);
    modal.onclick = (e) => e.stopPropagation();

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Edit Playlist</h3>
        <div style="display: flex; align-items: center; gap: 16px; margin: 15px 0;">
                <div style="width: 100px; height: 100px; border-radius: 8px; overflow: hidden; background: var(--bg-card); flex-shrink: 0; position: relative; cursor: pointer;" id="edit-playlist-cover-preview" onclick="document.getElementById('edit-playlist-cover-input').click()">
                        ${
                            playlist.cover
                                ? `<img src="${escapeHtmlAttr(playlist.cover)}" style="width: 100%; height: 100%; object-fit: cover;">`
                                : `
<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>                                        <rect x="140" y="230" width="120" height="30" rx="6" fill="var(--accent)" opacity="0.4"/>
                        </svg>`
                        }
                        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); text-align: center; padding: 4px; font-size: 10px; color: #fff;">Edit</div>
                </div>
                <div style="flex: 1;">
                        <input type="text" id="edit-playlist-name-input" class="playlist-modal-input" value="${escapeHtml(
                            playlist.name
                        )}" placeholder="Playlist name" style="margin: 0;">
                </div>
        </div>
        <input type="file" id="edit-playlist-cover-input" accept="image/png, image/jpeg, image/jpg, image/webp" style="display: none;" onchange="handleEditPlaylistCover(this)">
        <div class="playlist-modal-buttons">
                <button onclick="closePlaylistModal()" class="playlist-modal-cancel-btn">
                        Cancel
                </button>
                <button onclick="confirmEditPlaylist('${playlistId}')" class="playlist-modal-create-btn">
                        Save
                </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    let tempCoverData = null;
    window._editPlaylistTempCover = null;

    window.handleEditPlaylistCover = function (input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            window._editPlaylistTempCover = e.target.result;
            const preview = document.getElementById('edit-playlist-cover-preview');
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;"><div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); text-align: center; padding: 4px; font-size: 10px; color: #fff;">Edit</div>`;
            }
        };
        reader.readAsDataURL(file);
    };

    const handleKeydown = function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmEditPlaylist(playlistId);
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            closePlaylistModal();
        }
    };
    document.addEventListener('keydown', handleKeydown);
    overlay._cleanup = function () {
        document.removeEventListener('keydown', handleKeydown);
        delete window.handleEditPlaylistCover;
        delete window._editPlaylistTempCover;
    };

    const originalClose = closePlaylistModal;
    closePlaylistModal = function () {
        if (overlay._cleanup) overlay._cleanup();
        originalClose();
    };

    setTimeout(() => {
        const input = document.getElementById('edit-playlist-name-input');
        if (input) input.focus();
    }, 100);
}

function confirmEditPlaylist(playlistId) {
    const input = document.getElementById('edit-playlist-name-input');
    const name = input ? input.value.trim() : '';

    if (name === '') {
        showNotification('Please enter a playlist name', 'warning', 2000);
        return;
    }

    let playlists = getPlaylists();
    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
    if (!playlist) return;

    playlist.name = name;
    if (window._editPlaylistTempCover) {
        playlist.cover = window._editPlaylistTempCover;
    }

    savePlaylists(playlists);
    closePlaylistModal();

    renderPlaylistsView();
    renderLeftPanelMainList();
    updateScrollbarById('left-panel-main-content');

    if (currentView === `playlist-${playlistId}`) {
        updateHeroCover(`playlist-${playlistId}`);
        const songs = getPlaylistSongs(playlistId);
        setupHeroSection(true, playlist.name, songs.length, 'Playlist', playlist.id);
    }

    showNotification('Playlist updated', 'success', 2000);
}

function showCreateFolderDialog() {
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closePlaylistModal);
    modal.onclick = (e) => e.stopPropagation();

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Create New Folder</h3>
        <input type="text" id="folder-name-input" class="playlist-modal-input" placeholder="Folder name">
        <div class="playlist-modal-buttons">
                <button onclick="closePlaylistModal()" class="playlist-modal-cancel-btn">
                        Cancel
                </button>
                <button onclick="confirmCreateFolder()" class="playlist-modal-create-btn">
                        Create
                </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const handleKeydown = function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            confirmCreateFolder();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closePlaylistModal();
        }
    };

    document.addEventListener('keydown', handleKeydown);

    overlay._cleanup = function () {
        document.removeEventListener('keydown', handleKeydown);
    };

    const originalClose = closePlaylistModal;
    closePlaylistModal = function () {
        if (overlay._cleanup) overlay._cleanup();
        document.removeEventListener('keydown', handleKeydown);
        originalClose();
    };

    setTimeout(() => {
        const input = document.getElementById('folder-name-input');
        if (input) input.focus();
    }, 100);
}

function confirmCreateFolder() {
    const input = document.getElementById('folder-name-input');
    const name = input ? input.value.trim() : '';

    if (name === '') {
        showNotification('Please enter a folder name', 'warning', 2000);
        return;
    }

    const newFolder = createFolder(name);

    if (currentOpenFolderId) {
        addToFolder(currentOpenFolderId, newFolder.id, 'folder');
    }

    closePlaylistModal();

    if (currentOpenFolderId) {
        renderFolderContents(currentOpenFolderId);
    } else {
        renderFoldersView();
        renderLeftPanelMainList();
    }
    showNotification(`Folder "${escapeHtml(name)}" created`, 'success', 2000);
    updateScrollbarById('left-panel-main-content');
}

function showEditFolderDialog(folderId) {
    const folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closePlaylistModal);
    modal.onclick = (e) => e.stopPropagation();

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Rename Folder</h3>
        <input type="text" id="edit-folder-name-input" class="playlist-modal-input" value="${escapeHtml(
            folder.name
        )}" placeholder="Folder name">
        <div class="playlist-modal-buttons">
                <button onclick="closePlaylistModal()" class="playlist-modal-cancel-btn">
                        Cancel
                </button>
                <button onclick="confirmEditFolder('${folderId}')" class="playlist-modal-create-btn">
                        Save
                </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const handleKeydown = function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmEditFolder(folderId);
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            closePlaylistModal();
        }
    };
    document.addEventListener('keydown', handleKeydown);
    overlay._cleanup = function () {
        document.removeEventListener('keydown', handleKeydown);
    };

    const originalClose = closePlaylistModal;
    closePlaylistModal = function () {
        if (overlay._cleanup) overlay._cleanup();
        originalClose();
    };

    setTimeout(() => {
        const input = document.getElementById('edit-folder-name-input');
        if (input) input.focus();
    }, 100);
}

function confirmEditFolder(folderId) {
    const input = document.getElementById('edit-folder-name-input');
    const name = input ? input.value.trim() : '';

    if (name === '') {
        showNotification('Please enter a folder name', 'warning', 2000);
        return;
    }

    let folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    folder.name = name;
    saveFolders(folders);
    closePlaylistModal();

    renderFoldersView();
    renderLeftPanelMainList();
    updateScrollbarById('left-panel-main-content');

    if (currentOpenFolderId === folderId) {
        const folderNameLabel = document.getElementById('folder-name-label');
        if (folderNameLabel) folderNameLabel.textContent = name;
        renderFolderContents(folderId);
    }

    showNotification('Folder renamed', 'success', 2000);
}

function showCreateItemDialog() {
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closeCreateItemModal);
    modal.onclick = (e) => e.stopPropagation();

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Create New</h3>
        <div class="playlist-modal-buttons" style="flex-direction: column; gap: 8px;">
                <button onclick="closeCreateItemModal(); showCreatePlaylistDialog();" class="playlist-modal-create-btn" style="width: 100%;">
                        <i class="fas fa-music"></i> Playlist
                </button>
                <button onclick="closeCreateItemModal(); showCreateFolderDialog();" class="playlist-modal-cancel-btn" style="width: 100%;">
                        <i class="fas fa-folder"></i> Folder
                </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const handleKeydown = function (e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeCreateItemModal();
        }
    };
    document.addEventListener('keydown', handleKeydown);
    overlay._cleanup = function () {
        document.removeEventListener('keydown', handleKeydown);
    };
}

function showAddLinkDialog() {
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closeAddLinkModal);
    modal.onclick = (e) => e.stopPropagation();

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Play from URL</h3>
        <input type="text" id="link-url-input" class="playlist-modal-input" placeholder="Paste URL (e.g. https://example.com/song.mp3)">
        <div class="playlist-modal-buttons" id="link-modal-buttons">
                <button onclick="closeAddLinkModal()" class="playlist-modal-cancel-btn">
                        Cancel
                </button>
                <button onclick="playFromUrl(false)" class="playlist-modal-cancel-btn">
                        Stream Only
                </button>
                <button onclick="playFromUrl(true)" class="playlist-modal-create-btn">
                        Download & Stream
                </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const handleKeydown = function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            playFromUrl(true);
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeAddLinkModal();
        }
    };

    document.addEventListener('keydown', handleKeydown);

    const originalClose = closeAddLinkModal;
    closeAddLinkModal = function () {
        document.removeEventListener('keydown', handleKeydown);
        originalClose();
    };

    function focusInput() {
        const input = document.getElementById('link-url-input');
        if (input) {
            input.focus();
            input.click();
        }
    }

    focusInput();

    modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target.closest('.playlist-modal-buttons')) {
            setTimeout(focusInput, 10);
        }
    });

    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
            setTimeout(focusInput, 10);
        }
    });

    setTimeout(focusInput, 50);
}

function playFromUrl(saveToFolder) {
    if (downloadProgressActive) return;

    const input = document.getElementById('link-url-input');
    const value = input ? input.value.trim() : '';

    if (!value) {
        showNotification('Please enter a URL', 'warning', 2000);
        return;
    }

    closeAddLinkModal();

    downloadProgressActive = true;
    showDownloadNotification(0, 'Connecting...');

    const isTemp = !saveToFolder;

    if (window.electronAPI && window.electronAPI.downloadAndScan) {
        window.electronAPI
            .downloadAndScan(value, isTemp)
            .then((result) => {
                updateDownloadNotification(100, 'Processing...');

                setTimeout(() => {
                    removeDownloadNotification();
                    downloadProgressActive = false;
                    document.body.classList.remove('suppress-tooltips');

                    if (result.success && result.newSongs && result.newSongs.length > 0) {
                        const songToPlay = result.newSongs[0];

                        if (isTemp) {
                            songToPlay.isTemp = true;
                            songToPlay.tempFilePath = result.filePath;
                            addSongToQueueAndPlay(songToPlay);
                        } else {
                            SONGS_DATA.length = 0;
                            Array.prototype.push.apply(SONGS_DATA, result.songs);

                            updateAllCounts();
                            renderLeftPanelMainList();
                            renderPlaylistsView();
                            renderAlbumLeftPanelItems();
                            renderArtistLeftPanelItems();

                            if (currentView === VIEWS.ALL_SONGS) {
                                renderSongsList(SONGS_DATA, VIEWS.ALL_SONGS);
                                setupHeroSection(true, 'All Songs', SONGS_DATA.length, 'Playlist');
                            }

                            addSongToQueueAndPlay(songToPlay);
                        }

                        showNotification(
                            isTemp ? `Streaming: ${songToPlay.title}` : `Saved: ${songToPlay.title}`,
                            'success',
                            2000
                        );
                    } else {
                        showNotification('Failed to process audio file', 'error', 2000);
                    }
                }, 500);
            })
            .catch(() => {
                removeDownloadNotification();
                downloadProgressActive = false;
                showNotification('Failed to download', 'error');
            });
    }
}

function showDownloadNotification(percent, status) {
    const message = `📥 Downloading... ${Math.round(percent)}% — ${status}`;

    if (downloadNotifyIndex === -1) {
        notificationHistory.unshift({
            message: message,
            type: 'info',
            timestamp: Date.now(),
            isDownloadProgress: true,
            percent: percent,
            status: status
        });
        downloadNotifyIndex = 0;
    } else {
        notificationHistory[downloadNotifyIndex].message = message;
        notificationHistory[downloadNotifyIndex].percent = percent;
        notificationHistory[downloadNotifyIndex].status = status;
        notificationHistory[downloadNotifyIndex].timestamp = Date.now();
    }

    if (notificationHistory.length > 50) {
        if (downloadNotifyIndex >= 50) downloadNotifyIndex = -1;
        notificationHistory = notificationHistory.slice(0, 50);
    }

    renderNotificationPanel();

    if (!notificationPanelOpen) {
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.style.display = 'flex';
            badge.textContent = notificationHistory.length;
        }
    }
}

function updateDownloadNotification(percent, status) {
    if (downloadNotifyIndex === -1) return;
    showDownloadNotification(percent, status);
}

function removeDownloadNotification() {
    if (downloadNotifyIndex !== -1) {
        notificationHistory.splice(downloadNotifyIndex, 1);
        downloadNotifyIndex = -1;
        renderNotificationPanel();
    }
}

function showPlayedDataModal(songId) {
    const song = SONGS_DATA.find((s) => s.id === songId);
    if (!song) return;

    const history = getPlayHistory();
    const songPlays = history.filter((entry) => entry.id === songId);

    const totalPlays = songPlays.length;
    const totalDuration = songPlays.reduce((sum, entry) => sum + (entry.playDurationSeconds || 0), 0);
    const totalMins = Math.floor(totalDuration / 60);
    const totalSecs = totalDuration % 60;

    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closePlayedDataModal);
    modal.onclick = (e) => e.stopPropagation();

    let playsListHTML = '';
    if (songPlays.length === 0) {
        playsListHTML =
            '<p style="color: var(--text-secondary); font-size: 13px; text-align: center; padding: 20px;">No play history for this song</p>';
    } else {
        playsListHTML = songPlays
            .map((entry, index) => {
                const mins = Math.floor((entry.playDurationSeconds || 0) / 60);
                const secs = (entry.playDurationSeconds || 0) % 60;
                return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                    <span style="font-size: 12px; color: var(--text-secondary);">${entry.playedDate || 'Unknown'}</span>
                    <span style="font-size: 12px; color: var(--text-primary); font-family: monospace;">${mins}:${secs
                    .toString()
                    .padStart(2, '0')}</span>
            </div>`;
            })
            .join('');
    }

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Play History</h3>
        <p style="color: var(--text-primary); font-size: 14px; margin: 5px 0;">${escapeHtml(song.title)}</p>
        <p style="color: var(--text-secondary); font-size: 12px; margin: 5px 0;">${escapeHtml(song.artist)}</p>
        <div style="display: flex; gap: 20px; margin: 15px 0; padding: 10px; background: var(--bg-card); border-radius: 6px;">
                <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: 700; color: var(--accent);">${totalPlays}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">Plays</div>
                </div>
                <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: 700; color: var(--accent);">${totalMins}m ${totalSecs}s</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">Total Duration</div>
                </div>
        </div>
        <div style="max-height: 200px; overflow-y: auto; margin: 10px 0;">
                ${playsListHTML}
        </div>
        <div class="playlist-modal-buttons">
                <button onclick="closePlayedDataModal()" class="playlist-modal-cancel-btn">
                        Close
                </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const handleKeydown = function (e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closePlayedDataModal();
        }
    };

    document.addEventListener('keydown', handleKeydown);

    overlay._cleanup = function () {
        document.removeEventListener('keydown', handleKeydown);
    };
}

function showWelcomeDialog() {
    if (SONGS_DATA.length > 0) return;
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', null);
    modal.onclick = (e) => e.stopPropagation();
    overlay.style.pointerEvents = 'none';
    modal.style.pointerEvents = 'all';

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Welcome to Music Player</h3>
        <p style="color: var(--text-secondary); font-size: 13px; margin: 10px 0;">No music folder selected. Would you like to select your music folder now?</p>
        <div class="playlist-modal-buttons">
                <button id="welcome-continue-empty" class="playlist-modal-cancel-btn">
                        Continue Empty
                </button>
                <button id="welcome-select-folder" class="playlist-modal-create-btn">
                        Select Folder
                </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('welcome-select-folder').onclick = async () => {
        if (window.electronAPI && window.electronAPI.invoke) {
            const result = await window.electronAPI.invoke('welcome-select-folder');
            if (result && result.selected) {
                overlay.remove();
            }
        }
    };

    document.getElementById('welcome-continue-empty').onclick = () => {
        overlay.remove();
    };
}

function addSongToQueueAndPlay(song) {
    saveCurrentPlaybackState();

    const queueItem = {
        song: song,
        listId: VIEWS.ALL_SONGS,
        ghostSlot: null,
        source: 'url',
        addedManually: true
    };

    playbackQueue.splice(currentQueueIndex + 1, 0, queueItem);
    currentQueueIndex = currentQueueIndex + 1;

    playSongFromQueue(currentQueueIndex);
    updateQueueDisplay();
}

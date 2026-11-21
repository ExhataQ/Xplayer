// ==============================================================================
// MODAL DIALOGS
// ==============================================================================

import { isHttpLink, linkPreviewText, linkDialogHtml } from '../core/link-check.js';

let downloadProgressActive = false;

// Cleanups that closePlaylistModal / closeAddLinkModal run before they close anything, newest first. A dialog that
// attaches a document keydown listener (or a window helper) adds one here when it opens. Before D-09d-1 each dialog
// instead replaced the close function with a wrapper that ran its cleanup and then the previous function: the same
// list, built as a chain, newest first, never shortened. A module cannot do that reassignment (registerLegacyGlobals
// would keep the original function on window), so the list is explicit. Like the chain, it is kept for the life of
// the page, and an older dialog's cleanup still runs when a newer dialog closes (createModal removes an older
// dialog's elements without running its cleanup).
const playlistModalCleanups = [];
const addLinkModalCleanups = [];

function runModalCleanups(cleanups) {
    for (let i = cleanups.length - 1; i >= 0; i--) cleanups[i]();
}

// An overlay closes its dialog only when the click lands on the overlay itself. The dialog sits
// inside the overlay and marks itself data-stop, which keeps the click from the page-level
// listeners, but the overlay's own listener still sees clicks that bubble up from the dialog.
function closeOnOverlayClick(overlay, closeFunction) {
    if (typeof closeFunction !== 'function') return null;
    return function (event) {
        if (event.target === overlay) closeFunction(event);
    };
}

export function createModal(modalClassName, overlayClassName, closeFunction) {
    const existingModal = document.querySelector(`.${modalClassName}`);
    const existingOverlay = document.querySelector(`.${overlayClassName}`);
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.className = overlayClassName;
    overlay.onclick = closeOnOverlayClick(overlay, closeFunction);

    const modal = document.createElement('div');
    modal.className = modalClassName;

    return {
        modal,
        overlay
    };
}

export function closePlaylistModal() {
    runModalCleanups(playlistModalCleanups);
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

export function closeAddLinkModal() {
    runModalCleanups(addLinkModalCleanups);
    const overlay = document.querySelector('.playlist-modal-overlay');
    if (overlay) overlay.remove();
    const modal = document.querySelector('.playlist-modal');
    if (modal) modal.remove();
    downloadProgressActive = false;
}

export function closeCreateItemModal() {
    const overlay = document.querySelector('.playlist-modal-overlay');
    if (overlay) {
        if (overlay._cleanup) overlay._cleanup();
        overlay.remove();
    }
    const modal = document.querySelector('.playlist-modal');
    if (modal) modal.remove();
}

export function closePlayedDataModal() {
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

// The Copy button of a row (new interface only: the old interface's style sheet hides it). The two drawings swap by CSS while the
// button has data-copied; Lucide's copy and check (ISC), drawn like the new interface's icons.
const SONG_METADATA_COPY_ICONS =
    '<svg class="song-metadata-copy-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>' +
    '<svg class="song-metadata-copy-done" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

export function showSongMetadataModal(songId) {
    const song = typeof SONGS_DATA !== 'undefined' ? SONGS_DATA.find((item) => item.id === songId) : null;
    if (!song) {
        showNotification('Song metadata is unavailable', 'warning', 2000);
        return;
    }

    closeSongMetadataModal();

    const fields = [
        ['Album', song.album],
        ['Genre', song.genre],
        ...(typeof isRatingSystemOn === 'function' && isRatingSystemOn() ? [['Rating', ratingOf(song) ? ratingLabel(ratingOf(song)) : '']] : []), // while the Rating system is on: "3.5 stars", or a dash
        ['Year', song.year],
        ['Track number', song.trackNumber ?? song.track],
        ['Language', song.language || song._detectedLanguage],
        ['Composer', song.composer],
        ['Comment', Array.isArray(song.comment) ? song.comment.join(', ') : song.comment],
        ['BPM', song.bpm]
    ];

    const overlay = document.createElement('div');
    overlay.className = 'song-metadata-modal-overlay';
    // The text can be selected, and a drag that starts in the window and ends outside it makes the browser report a click on the
    // overlay. Only a press that also began on the overlay closes the window.
    let pressedOnOverlay = true;
    overlay.onmousedown = (event) => {
        pressedOnOverlay = event.target === overlay;
    };
    overlay.onclick = (event) => {
        if (pressedOnOverlay) closeOnOverlayClick(overlay, closeSongMetadataModal)(event);
    };

    const modal = document.createElement('div');
    modal.className = 'song-metadata-modal';
    modal.setAttribute('data-stop', '');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'song-metadata-heading');
    // The title and artist lead the window (with the cover); the other fields are rows. A field the song does not have shows a dash.
    const cover = song.cover
        ? `<img class="song-metadata-cover" src="${escapeHtmlAttr(song.cover)}" alt="">`
        : '<div class="song-metadata-cover song-metadata-cover--empty" aria-hidden="true">&#9834;</div>';
    modal.innerHTML = `
        <div class="song-metadata-modal-header">
            <h3 id="song-metadata-heading">Song metadata</h3>
            <button type="button" class="song-metadata-modal-close" aria-label="Close" title="Close">&times;</button>
        </div>
        <div class="song-metadata-hero">
            ${cover}
            <div class="song-metadata-heading">
                <div class="song-metadata-title">${escapeHtml(String(song.title || 'Unknown title'))}</div>
                <div class="song-metadata-artist">${escapeHtml(String(song.artist || 'Unknown artist'))}</div>
            </div>
        </div>
        <div class="song-metadata-list" role="list">
            ${fields
                .map(([label, value]) => {
                    const text = String(value ?? '').trim();
                    return `
                        <div class="song-metadata-row" role="listitem">
                            <span class="song-metadata-label">${escapeHtml(label)}</span>
                            <span class="song-metadata-value${text ? '' : ' song-metadata-value--empty'}">${escapeHtml(text) || '—'}</span>
                            ${text ? `<button type="button" class="song-metadata-copy" aria-label="Copy ${escapeHtmlAttr(label)}" title="Copy">${SONG_METADATA_COPY_ICONS}</button>` : ''}
                        </div>
                    `;
                })
                .join('')}
        </div>
    `;

    const closeButton = modal.querySelector('.song-metadata-modal-close');
    closeButton.onclick = closeSongMetadataModal;
    // One handler for every row. The copied text is what the row shows; the button says so for a moment (data-copied).
    modal.querySelector('.song-metadata-list').addEventListener('click', async (event) => {
        const button = event.target.closest('.song-metadata-copy');
        if (!button) return;
        const value = button.closest('.song-metadata-row')?.querySelector('.song-metadata-value');
        try {
            await navigator.clipboard.writeText(value ? value.textContent : '');
        } catch (error) {
            showNotification('Could not copy to clipboard', 'error', 2000);
            return;
        }
        button.setAttribute('data-copied', '');
        clearTimeout(button._copiedTimer);
        button._copiedTimer = setTimeout(() => button.removeAttribute('data-copied'), 1500);
    });
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    closeButton.focus({ preventScroll: true }); // the keys work at once: Escape closes, Tab walks the close button and the Copy buttons

    const handleKeydown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeSongMetadataModal();
        }
    };
    document.addEventListener('keydown', handleKeydown);
    overlay._cleanup = () => document.removeEventListener('keydown', handleKeydown);
}

export function showConfirmDialog(options) {
    return new Promise((resolve) => {
        const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', function () {
            resolve(false);
            closeConfirmDialog();
        });
        modal.setAttribute('data-stop', '');

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

export function showCreatePlaylistDialog() {
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closePlaylistModal);
    modal.setAttribute('data-stop', '');

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Create New Playlist</h3>
        <input type="text" id="playlist-name-input" class="playlist-modal-input" placeholder="Playlist name">
        <div class="playlist-modal-buttons">
                <button data-action="closePlaylistModal" class="playlist-modal-cancel-btn">
                        Cancel
                </button>
                <button data-action="confirmCreatePlaylist" class="playlist-modal-create-btn">
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

    playlistModalCleanups.push(function () {
        if (overlay._cleanup) overlay._cleanup();
        document.removeEventListener('keydown', handleKeydown);
    });

    setTimeout(() => {
        const input = document.getElementById('playlist-name-input');
        if (input) {
            input.focus();
            input.click();
        }
    }, 100);
}

export function confirmCreatePlaylist() {
    const input = document.getElementById('playlist-name-input');
    const name = input ? input.value.trim() : '';

    if (name === '') {
        showNotification('Please enter a playlist name', 'warning', 2000);
        return;
    }

    createPlaylist(name);
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

export function showEditPlaylistDialog(playlistId) {
    const playlists = getPlaylists();
    const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
    if (!playlist) return;

    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closePlaylistModal);
    modal.setAttribute('data-stop', '');

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Edit Playlist</h3>
        <div style="display: flex; align-items: center; gap: 16px; margin: 15px 0;">
                <div style="width: 100px; height: 100px; border-radius: 8px; overflow: hidden; background: var(--bg-card); flex-shrink: 0; position: relative; cursor: pointer;" id="edit-playlist-cover-preview" data-action="pickEditPlaylistCover">
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
        <input type="file" id="edit-playlist-cover-input" accept="image/png, image/jpeg, image/jpg, image/webp" style="display: none;" data-action-change="handleEditPlaylistCover" data-args-change="[&quot;$this&quot;]">
        <div class="playlist-modal-buttons">
                <button data-action="closePlaylistModal" class="playlist-modal-cancel-btn">
                        Cancel
                </button>
                <button ${actionAttrs('confirmEditPlaylist', [String(playlistId)])} class="playlist-modal-create-btn">
                        Save
                </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

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

    playlistModalCleanups.push(function () {
        if (overlay._cleanup) overlay._cleanup();
    });

    setTimeout(() => {
        const input = document.getElementById('edit-playlist-name-input');
        if (input) input.focus();
    }, 100);
}

export function confirmEditPlaylist(playlistId) {
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

export function showCreateFolderDialog() {
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closePlaylistModal);
    modal.setAttribute('data-stop', '');

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Create New Folder</h3>
        <input type="text" id="folder-name-input" class="playlist-modal-input" placeholder="Folder name">
        <div class="playlist-modal-buttons">
                <button data-action="closePlaylistModal" class="playlist-modal-cancel-btn">
                        Cancel
                </button>
                <button data-action="confirmCreateFolder" class="playlist-modal-create-btn">
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

    playlistModalCleanups.push(function () {
        if (overlay._cleanup) overlay._cleanup();
        document.removeEventListener('keydown', handleKeydown);
    });

    setTimeout(() => {
        const input = document.getElementById('folder-name-input');
        if (input) input.focus();
    }, 100);
}

export function confirmCreateFolder() {
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

export function showEditFolderDialog(folderId) {
    const folders = getFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closePlaylistModal);
    modal.setAttribute('data-stop', '');

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Rename Folder</h3>
        <input type="text" id="edit-folder-name-input" class="playlist-modal-input" value="${escapeHtml(
            folder.name
        )}" placeholder="Folder name">
        <div class="playlist-modal-buttons">
                <button data-action="closePlaylistModal" class="playlist-modal-cancel-btn">
                        Cancel
                </button>
                <button ${actionAttrs('confirmEditFolder', [String(folderId)])} class="playlist-modal-create-btn">
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

    playlistModalCleanups.push(function () {
        if (overlay._cleanup) overlay._cleanup();
    });

    setTimeout(() => {
        const input = document.getElementById('edit-folder-name-input');
        if (input) input.focus();
    }, 100);
}

export function confirmEditFolder(folderId) {
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

export function showCreateItemDialog() {
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closeCreateItemModal);
    modal.setAttribute('data-stop', '');

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Create New</h3>
        <div class="playlist-modal-buttons" style="flex-direction: column; gap: 8px;">
                <button data-action="createItemChoice" data-args="[&quot;playlist&quot;]" class="playlist-modal-create-btn" style="width: 100%;">
                        <i class="fas fa-music"></i> Playlist
                </button>
                <button data-action="createItemChoice" data-args="[&quot;folder&quot;]" class="playlist-modal-cancel-btn" style="width: 100%;">
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

export function showAddLinkDialog() {
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closeAddLinkModal);
    modal.setAttribute('data-stop', '');

    modal.innerHTML = linkDialogHtml(`
                <button data-action="closeAddLinkModal" class="playlist-modal-cancel-btn">
                        Cancel
                </button>
                <button data-action="playFromUrl" data-args="[false]" class="playlist-modal-cancel-btn">
                        Stream Only
                </button>
                <button data-action="playFromUrl" data-args="[true]" class="playlist-modal-create-btn">
                        Download & Stream
                </button>`);

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

    addLinkModalCleanups.push(function () {
        document.removeEventListener('keydown', handleKeydown);
    });

    function focusInput() {
        const input = document.getElementById('link-url-input');
        if (input) {
            input.focus();
            input.click();
        }
    }

    focusInput();
    setupLinkHelpers(modal);

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

// ----- Play from URL: a pasted link and what it would fetch -----
const LINK_PREVIEW_DELAY_MS = 500;

function setupLinkHelpers(modal) {
    const input = modal.querySelector('#link-url-input');
    const preview = modal.querySelector('#link-preview');
    if (!input || !preview) return;
    let sequence = 0;
    let timer = null;

    // A light HEAD request once the person stops typing, and only for a real http(s) link; an answer for an older value is dropped.
    function schedulePreview() {
        clearTimeout(timer);
        const mine = ++sequence;
        preview.textContent = '';
        const value = input.value.trim();
        if (!isHttpLink(value) || !desktopApi.supports('library.probeUrl')) return;
        timer = setTimeout(() => {
            desktopApi.library
                .probeUrl(value)
                .then((info) => {
                    if (mine === sequence) preview.textContent = linkPreviewText(info);
                })
                .catch(() => {});
        }, LINK_PREVIEW_DELAY_MS);
    }

    input.addEventListener('input', schedulePreview);
    addLinkModalCleanups.push(function () {
        clearTimeout(timer);
        sequence++;
    });

    // The clipboard is read once, when the dialog opens, and used only when it holds a link and the box is still empty.
    // Only in the desktop app: a browser would ask for permission here.
    if (desktopApi.available() && navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard
            .readText()
            .then((text) => {
                const link = typeof text === 'string' ? text.trim() : '';
                if (input.isConnected && !input.value && isHttpLink(link)) {
                    input.value = link;
                    input.select();
                    schedulePreview();
                }
            })
            .catch(() => {});
    }
}

export function playFromUrl(saveToFolder) {
    if (downloadProgressActive) return;

    const input = document.getElementById('link-url-input');
    const value = input ? input.value.trim() : '';

    if (!value) {
        showNotification('Please enter a URL', 'warning', 2000);
        return;
    }

    closeAddLinkModal();
    playLink(value, saveToFolder);
}

/** A link the Quick Player asked this app to play (the Quick follows this app): streamed the way "Stream Only" does it. */
export function playLinkFromLightWindow(link) {
    if (downloadProgressActive || !isHttpLink(link)) return;
    playLink(link, false);
}

function playLink(value, saveToFolder) {
    downloadProgressActive = true;
    showDownloadNotification(0, 'Connecting...');

    const isTemp = !saveToFolder;

    if (desktopApi.supports('library.downloadAndScan')) {
        desktopApi.library
            .downloadAndScan(value, isTemp)
            .then((result) => {
                if (result && result.cancelled) {
                    // Stopped by the person: the main process already deleted the half-written file.
                    removeDownloadNotification();
                    downloadProgressActive = false;
                    document.body.classList.remove('suppress-tooltips');
                    showNotification('Download cancelled', 'info', 2000);
                    return;
                }
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
                            2000,
                            // A saved file can be shown in the folder; a stream is a temporary file, so it gets no such button.
                            isTemp ? undefined : { file: result.filePath }
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

/** Stops the running download. The page hears about it when the download call answers with `cancelled`. */
export function cancelDownload() {
    if (!downloadProgressActive || !desktopApi.supports('library.cancelDownload')) return;
    updateDownloadNotification(downloadNotifyIndex === -1 ? 0 : notificationHistory[downloadNotifyIndex].percent || 0, 'Cancelling...');
    desktopApi.library.cancelDownload();
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
        setNotificationHistory(notificationHistory.slice(0, 50));
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

export function updateDownloadNotification(percent, status) {
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

export function showPlayedDataModal(songId) {
    const song = SONGS_DATA.find((s) => s.id === songId);
    if (!song) return;

    const history = getPlayHistory();
    const songPlays = history.filter((entry) => entry.id === songId);

    const totalPlays = songPlays.length;
    const totalDuration = songPlays.reduce((sum, entry) => sum + (entry.playDurationSeconds || 0), 0);
    const totalMins = Math.floor(totalDuration / 60);
    const totalSecs = totalDuration % 60;

    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closePlayedDataModal);
    modal.setAttribute('data-stop', '');

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
                <button data-action="closePlayedDataModal" class="playlist-modal-cancel-btn">
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

export function showWelcomeDialog() {
    if (SONGS_DATA.length > 0) return;
    // The new interface draws its own welcome screen (ui-next/shell/welcome.js) and cancels the event; this box is the fallback.
    if (!document.dispatchEvent(new CustomEvent('xplayer:welcome', { cancelable: true }))) return;
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', null);
    modal.setAttribute('data-stop', '');
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
        if (desktopApi.supports('library.welcomeSelectFolder')) {
            const result = await desktopApi.library.welcomeSelectFolder();
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
    setCurrentQueueIndex(currentQueueIndex + 1);

    playSongFromQueue(currentQueueIndex);
    updateQueueDisplay();
}

// Audio files opened from Windows ("Open with Xplayer", a double-click), and a song moved here from the Mini Player or the Quick Player. They are not
// added to the library: the main process scanned their tags (songs marked external, with ids that cannot clash with a library song)
// and they play from the queue. `payload` is a list of songs, or { songs, startIndex, startAt, paused } (a handoff).
// The first song (or the one at startIndex) plays now; the others are queued in order after it.
function playExternalSongs(payload) {
    const handed = Array.isArray(payload) ? { songs: payload } : payload || {};
    const list = Array.isArray(handed.songs) ? handed.songs.filter((song) => song && song.url) : [];
    if (list.length === 0) return;
    saveCurrentPlaybackState();

    const wrapExternal = (song) => ({ song: song, listId: VIEWS.ALL_SONGS, ghostSlot: null, source: 'external', addedManually: true });
    // A file from outside (Explorer, a drop, File > Open): a new queue. The file, and the rest of its folder once the main process has read it,
    // replace the queue that was there, like a double-click in a file manager does in any player.
    if (handed.newQueue === true) {
        const first = Number.isInteger(handed.startIndex) && handed.startIndex >= 0 && handed.startIndex < list.length ? handed.startIndex : 0;
        playbackQueue.splice(0, playbackQueue.length, ...list.map(wrapExternal));
        setCurrentQueueIndex(first);
        playSongFromQueue(currentQueueIndex);
        updateQueueDisplay();
        return;
    }

    // A song coming back from the Mini Player or the Quick Player that was showing this player's own queue (synced): the queue is still here,
    // so the player goes on from that song's place in it instead of adding the song again. If it is not in the queue, it is added like any other.
    let syncedSlot = -1; // the same song may be in the queue twice: the place nearest to where this player stopped
    if (handed.synced === true && list.length === 1) {
        playbackQueue.forEach((item, at) => {
            if ((item.song || item).url === list[0].url && (syncedSlot < 0 || Math.abs(at - currentQueueIndex) < Math.abs(syncedSlot - currentQueueIndex))) syncedSlot = at;
        });
    }
    if (syncedSlot >= 0) {
        setCurrentQueueIndex(syncedSlot);
        playSongFromQueue(currentQueueIndex);
        updateQueueDisplay();
    } else {
        const startIndex = Number.isInteger(handed.startIndex) && handed.startIndex >= 0 && handed.startIndex < list.length ? handed.startIndex : 0;
        const firstSlot = currentQueueIndex + 1;
        list.forEach((song, offset) => {
            playbackQueue.splice(firstSlot + offset, 0, wrapExternal(song));
        });
        setCurrentQueueIndex(firstSlot + startIndex);
        playSongFromQueue(currentQueueIndex);
        updateQueueDisplay();
    }

    // A song handed over from the Mini Player or the Quick Player carries its place and whether it was paused.
    if (handed.startAt > 0) audioElement.currentTime = handed.startAt;
    if (handed.paused === true) audioElement.addEventListener('playing', () => audioElement.pause(), { once: true });
}

// File > Open file / Open folder of the application menu: a chooser in the main process, and the result is a new queue, like a file from Windows.
// A closed chooser changes nothing: what plays goes on playing.
export async function chooseAndPlayFiles(kind) {
    if (typeof desktopApi === 'undefined' || !desktopApi.supports('files.chooseOpenExternal')) return;
    let result = null;
    try {
        result = await desktopApi.files.chooseOpenExternal(kind === 'folder' ? 'folder' : 'files');
    } catch (e) {
        return;
    }
    if (result && result.success && Array.isArray(result.songs)) playExternalSongs({ songs: result.songs, startIndex: Number.isInteger(result.startIndex) ? result.startIndex : 0, newQueue: true });
}

// The player bar's "Mini Player" and "Quick Player" buttons (ui-next/views/playback/light-player-buttons.js): the song that plays moves to the
// light window, in the view the button names ('mini' or 'quick'), from the same place, and this window pauses (two windows never play together).
// Answers { success, error? }; if the light window cannot take the song, it plays on here.
export async function showCurrentSongInLightPlayer(view) {
    const item = currentQueueIndex >= 0 ? playbackQueue[currentQueueIndex] : null;
    const song = item && (item.song || item);
    if (typeof desktopApi === 'undefined' || !desktopApi.supports('window.openLightPlayer')) return { success: false, error: 'The player window needs the desktop app' };
    // The light window follows this app live (src/js/ui/06b1-light-sync.js): this app keeps playing, nothing waits and nothing pauses.
    if (desktopApi.supports('window.onPlayerSyncWanted')) {
        try {
            const live = await desktopApi.window.openLightPlayer({ remote: true, view });
            if (live && live.success) return { success: true };
        } catch (e) {
            // Falls through to handing the song over.
        }
    }
    if (!song) return { success: false, error: 'Nothing is playing' }; // the old way (handing the song over) needs one
    const wasPlaying = !audioElement.paused && !audioElement.ended;
    const position = audioElement.currentTime || 0;
    if (wasPlaying) audioElement.pause();
    let result = null;
    try {
        result = await desktopApi.window.openLightPlayer({ ...queueForLightPlayer(), position, paused: !wasPlaying, view });
    } catch (e) {
        result = null;
    }
    if (!result || !result.success) {
        if (wasPlaying) audioElement.play().catch(() => {});
        return { success: false, error: (result && result.error) || 'Could not open the player window' };
    }
    return { success: true };
}

if (typeof desktopApi !== 'undefined' && desktopApi.supports('files.onOpenExternal')) {
    // Files that arrive while the app is running. The main process only sends them after the page has asked for the waiting ones (below).
    desktopApi.files.onOpenExternal((songs) => playExternalSongs(songs));
    // Files that were waiting since start-up (the app was started with a file).
    const takeWaitingFiles = () => {
        desktopApi.files
            .takePendingOpen()
            .then((result) => {
                if (result && result.success) playExternalSongs(result);
            })
            .catch((e) => console.error('[open files] could not read the waiting files:', e));
    };
    if (typeof whenAppReady === 'function') whenAppReady(takeWaitingFiles);
    else takeWaitingFiles();
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        showCurrentSongInLightPlayer,
        chooseAndPlayFiles,
        createModal,
        closePlaylistModal,
        closeAddLinkModal,
        closeCreateItemModal,
        closePlayedDataModal,
        showSongMetadataModal,
        showConfirmDialog,
        showCreatePlaylistDialog,
        confirmCreatePlaylist,
        showEditPlaylistDialog,
        confirmEditPlaylist,
        showCreateFolderDialog,
        confirmCreateFolder,
        showEditFolderDialog,
        confirmEditFolder,
        showCreateItemDialog,
        showAddLinkDialog,
        playFromUrl,
        playLinkFromLightWindow,
        updateDownloadNotification,
        cancelDownload,
        showPlayedDataModal,
        showWelcomeDialog
    });
}

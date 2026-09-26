// ==============================================================================
// LIBRARY LOCATIONS (MULTI-FOLDER SUPPORT) -- selection, add, path validation
// (split out of 03-storage.js, Phase 2 Checkpoint 5)
// ==============================================================================


// ==============================================================================
// LIBRARY LOCATIONS (MULTI-FOLDER SUPPORT)
// ==============================================================================

let libraryLocationsPanelOpen = false;

async function loadLibraryLocations() {
    const api = typeof window !== 'undefined' ? window.electronAPI : null;
    if (!api || !api.getMusicFolders) {
        return [];
    }
    try {
        const folders = await api.getMusicFolders();
        return folders;
    } catch (e) {
        return [];
    }
}


async function getFolderStats(folderPath) {
    const api = typeof window !== 'undefined' ? window.electronAPI : null;
    if (!api || !api.getFolderStats) {
        return {
            songCount: 0,
            addedTime: null
        };
    }
    try {
        return await api.getFolderStats(folderPath);
    } catch (e) {
        return {
            songCount: 0,
            addedTime: null
        };
    }
}


let selectedLibraryFolders = [];

function selectLibraryFolder(element, folderPath, event) {
    const list = document.getElementById('library-locations-list');
    if (list) list.focus();
    const items = Array.from(document.querySelectorAll('.library-location-item'));
    const itemIndex = items.indexOf(element);
    const lastIndex = selectedLibraryFolders.length
        ? items.findIndex((item) => item.dataset.folder === selectedLibraryFolders[selectedLibraryFolders.length - 1])
        : -1;

    const isSameSingleSelection = !event?.shiftKey && !event?.ctrlKey && !event?.metaKey && selectedLibraryFolders.length === 1 && selectedLibraryFolders[0] === folderPath;

    if (isSameSingleSelection) {
        selectedLibraryFolders = [];
    } else if (event && event.shiftKey && lastIndex >= 0) {
        const start = Math.min(lastIndex, itemIndex);
        const end = Math.max(lastIndex, itemIndex);
        selectedLibraryFolders = items.slice(start, end + 1).map((item) => item.dataset.folder);
    } else if (event && (event.ctrlKey || event.metaKey)) {
        if (selectedLibraryFolders.includes(folderPath)) {
            selectedLibraryFolders = selectedLibraryFolders.filter((folder) => folder !== folderPath);
        } else {
            selectedLibraryFolders = [...selectedLibraryFolders, folderPath];
        }
    } else {
        selectedLibraryFolders = [folderPath];
    }

    items.forEach((item) => item.classList.toggle('selected', selectedLibraryFolders.includes(item.dataset.folder)));
}


function clearLibraryFolderSelection() {
    selectedLibraryFolders = [];
    const items = document.querySelectorAll('.library-location-item');
    items.forEach((item) => item.classList.remove('selected'));
}


function normalizeDroppedFolderPath(rawValue) {
    if (!rawValue || typeof rawValue !== 'string') return null;

    let value = rawValue.trim();
    if (!value) return null;

    value = value.replace(/^['"]+|['"]+$/g, '');

    if (value.startsWith('file:///')) {
        value = decodeURIComponent(value.replace(/^file:\/\//i, ''));
    }

    if (value.startsWith('\\\\') || value.startsWith('\\')) {
        value = value.replace(/^\\\\?/, '').replace(/\\/g, '\\');
    } else if (value.startsWith('file://')) {
        value = decodeURIComponent(value.replace(/^file:\/\//i, ''));
    }

    return value || null;
}


function isFolderPathCandidate(rawValue) {
    const value = normalizeDroppedFolderPath(rawValue);
    if (!value) return false;

    const lower = value.toLowerCase();
    const ignoredExtensions = [
        '.mp3', '.flac', '.m4a', '.mp4', '.aac', '.ogg', '.opus', '.wma', '.wav',
        '.aiff', '.aif', '.ape', '.wv', '.m4b', '.mpc', '.alac', '.webm'
    ];

    if (ignoredExtensions.some((ext) => lower.endsWith(ext))) {
        return false;
    }

    return value.length > 1;
}


async function addFolderPathFromInput(rawValue, label = 'Folder') {
    if (!rawValue || !isFolderPathCandidate(rawValue)) {
        return false;
    }

    const folderPath = normalizeDroppedFolderPath(rawValue);
    if (!folderPath) {
        return false;
    }

    try {
        const result = await window.electronAPI.addMusicFolder(folderPath);
        if (result && result.success) {
            await renderLibraryLocations();
            showNotification(`${label} added`, 'success', 2500);
            return true;
        }
        if (result && result.reason === 'duplicate') {
            showNotification('Folder already in library', 'warning', 2000);
            return true;
        }
        showNotification(`Could not add ${label.toLowerCase()}`, 'error', 2000);
        return false;
    } catch (error) {
        showNotification(`Could not add ${label.toLowerCase()}`, 'error', 2000);
        return false;
    }
}


async function handleDroppedLibraryFolder(event) {
    if (!event || !event.dataTransfer) return;
    event.preventDefault();
    event.stopPropagation();

    const list = document.getElementById('library-locations-list');
    if (list) {
        list.classList.remove('drag-over-folder');
    }

    let folderPath = null;
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    const firstFilePath = droppedFiles.find((file) => file && file.path)?.path;
    if (firstFilePath) {
        folderPath = firstFilePath;
    }

    if (!folderPath) {
        const uriList = event.dataTransfer.getData('text/uri-list');
        if (uriList) {
            const firstUri = uriList.split(/\r?\n/).find((entry) => entry && entry.startsWith('file://'));
            if (firstUri) folderPath = firstUri;
        }
    }

    if (!folderPath) {
        const plainText = event.dataTransfer.getData('text/plain');
        if (plainText) folderPath = plainText;
    }

    if (!folderPath) return;

    await addFolderPathFromInput(folderPath, 'Folder from drag/drop');
}


async function handlePastedLibraryFolder(event) {
    if (!event || !event.clipboardData) return;
    const pastedText = event.clipboardData.getData('text');
    if (!pastedText || !pastedText.trim()) return;

    const importText = pastedText.trim();
    if (!isFolderPathCandidate(importText)) return;

    event.preventDefault();
    event.stopPropagation();
    await addFolderPathFromInput(importText, 'Pasted folder');
}

function changeMusicFolder() {
    if (!window.electronAPI || !window.electronAPI.changeMusicFolder) {
        showNotification('Not available in browser mode', 'warning', 2000);
        return;
    }

    showNotification('Selecting folder...', 'info', 5000);

    window.electronAPI
        .changeMusicFolder()
        .then((result) => {
            if (!result.success) {
                if (result.reason !== 'cancelled') {
                    showNotification('Failed to change folder', 'error', 3000);
                }
                return;
            }

            SONGS_DATA.length = 0;
            Array.prototype.push.apply(SONGS_DATA, result.songs);

            clearGhostList(VIEWS.ALL_SONGS);
            clearGhostList(VIEWS.FAVORITES);
            clearGhostList(VIEWS.HISTORY);

            for (const key in activeSlotHighlights) {
                activeSlotHighlights[key] = null;
            }

            currentQueueIndex = -1;
            playbackQueue = [];
            audioElement.pause();
            audioElement.src = '';
            playButton.innerHTML = '<i class="fas fa-play"></i>';
            playButton.setAttribute('title', 'Play');
            document.querySelector('.player-song-info').classList.remove('has-song');
            document.getElementById('player-title').textContent = 'No song selected';
            document.getElementById('player-artist').textContent = '—';
            document.getElementById('player-cover').src = PLACEHOLDER_IMAGE;

            updateQueueDisplay();
            updateAlbumArt();

            updateAllCounts();
            updateLeftPanelCounts();
            renderPlaylistsView();
            renderAlbumLeftPanelItems();
            renderArtistLeftPanelItems();
            renderLeftPanelMainList();

            updateAllCounts();
            if (currentView === VIEWS.ALL_SONGS) {
                const songs = getSongsForList(VIEWS.ALL_SONGS);
                renderSongsList(songs, VIEWS.ALL_SONGS);
                setupHeroSection(true, 'All Songs', songs.length, 'Playlist');
            }

            showNotification(`Loaded ${result.songs.length} songs from new folder`, 'success', 3000);
        })
        .catch((err) => {
            showNotification('Error changing folder', 'error', 3000);
        });
}

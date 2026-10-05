// ==============================================================================
// LIBRARY LOCATIONS (MULTI-FOLDER SUPPORT) -- selection, add, path validation
// (split out of 03-storage.js)
// ==============================================================================


// ==============================================================================
// LIBRARY LOCATIONS (MULTI-FOLDER SUPPORT)
// ==============================================================================

let libraryLocationsPanelOpen = false;

// Pulled out of rebuildLibraryFromFolders() in 03m-library-folder-render.js: that
// function is otherwise pure UI orchestration (see the comment at the top of that
// file), but this piece - replacing the in-memory song list and resetting playback/
// ghost-list state after a full library rebuild - is genuine core state, no DOM.
// Everything DOM-related that used to follow this block inline now lives in the
// 'library:rebuilt' subscriber in 04i-library-rebuild-events.js.
function resetLibraryAfterRebuild(songs) {
    SONGS_DATA.length = 0;
    Array.prototype.push.apply(SONGS_DATA, songs);

    clearGhostList(VIEWS.ALL_SONGS);
    clearGhostList(VIEWS.FAVORITES);
    clearGhostList(VIEWS.HISTORY);

    for (const key in activeSlotHighlights) {
        activeSlotHighlights[key] = null;
    }

    setCurrentQueueIndex(-1);
    setPlaybackQueue([]);

    emit('library:rebuilt', { songs });
}

async function loadLibraryLocations() {
    if (!desktopApi.supports('library.getMusicFolders')) {
        return [];
    }
    try {
        const folders = await desktopApi.library.getMusicFolders();
        return folders;
    } catch (e) {
        return [];
    }
}


async function getFolderStats(folderPath) {
    if (!desktopApi.supports('library.getFolderStats')) {
        return {
            songCount: 0,
            addedTime: null
        };
    }
    try {
        return await desktopApi.library.getFolderStats(folderPath);
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
        const result = await desktopApi.library.addMusicFolder(folderPath);
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
    if (!desktopApi.supports('library.changeMusicFolder')) {
        showNotification('Not available in browser mode', 'warning', 2000);
        return;
    }

    showNotification('Selecting folder...', 'info', 5000);

    desktopApi.library
        .changeMusicFolder()
        .then((result) => {
            if (!result.success) {
                if (result.reason !== 'cancelled') {
                    showNotification('Failed to change folder', 'error', 3000);
                }
                return;
            }

            // Same work as rebuildLibraryFromFolders() (03m): replace SONGS_DATA, reset the
            // ghost lists, highlights, queue and now-playing display, then redraw. This used to
            // be an inline copy of the 'library:rebuilt' subscriber's body (04i).
            resetLibraryAfterRebuild(result.songs);
            // The inline copy also reset the play button tooltip, which rebuildLibraryFromFolders()
            // never did. Kept here so this path behaves exactly as before.
            playButton.setAttribute('title', 'Play');

            showNotification(`Loaded ${result.songs.length} songs from new folder`, 'success', 3000);
        })
        .catch((err) => {
            showNotification('Error changing folder', 'error', 3000);
        });
}

// ==============================================================================
// LIBRARY LOCATIONS -- render + remove/add/rebuild
// (split out of 03-storage.js, Phase 2 Checkpoint 5; shares selectedLibraryFolders
// with 03j-library-locations.js, which must load first)
// ==============================================================================


async function renderLibraryLocations() {
    const container = document.getElementById('library-locations-list');
    if (!container) return;

    const folders = await loadLibraryLocations();

    if (!folders || folders.length === 0) {
        container.innerHTML = `
            <div class="empty-queue" style="padding: 40px 20px; text-align: center;">
                <i class="fas fa-folder-open" style="font-size: 32px; opacity: 0.5;"></i>
                <p style="margin-top: 12px;">No folders added</p>
                <small>Click "Add Folder" to include music locations</small>
            </div>
        `;
        selectedLibraryFolders = [];
        return;
    }

    const foldersWithStats = await Promise.all(folders.map(async (folder) => {
        const stats = await getFolderStats(folder);
        const folderName = folder.split('\\').pop() || folder;
        const escapedFolderForClick = folder.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return {
            folder,
            folderName,
            escapedFolderForClick,
            songCount: Number(stats.songCount) || 0
        };
    }));

    container.innerHTML = foldersWithStats
        .map(
            (item) => `
        <div class="library-location-item" data-folder="${escapeHtml(
            item.folder
        )}" onclick="selectLibraryFolder(this, '${item.escapedFolderForClick}', event)">
            <div class="library-location-name">
                <i class="fas fa-folder"></i>
                <span>${escapeHtml(item.folderName)}</span>
            </div>
            <div class="library-location-path" title="${escapeHtml(item.folder)}">${escapeHtml(item.folder)}</div>
            <div class="library-location-song-count">${item.songCount} song${item.songCount !== 1 ? 's' : ''}</div>
        </div>
    `
        )
        .join('');

    selectedLibraryFolders = selectedLibraryFolders.filter((folder) => folders.includes(folder));

    if (!document.body.dataset.librarySelectionOutsideHook) {
        document.addEventListener('pointerdown', (event) => {
            const list = document.getElementById('library-locations-list');
            const section = document.querySelector('.library-locations-section');
            if (!list || selectedLibraryFolders.length === 0) return;
            if (list.contains(event.target) || (section && section.contains(event.target))) return;
            clearLibraryFolderSelection();
        });
        document.body.dataset.librarySelectionOutsideHook = '1';
    }

    container.tabIndex = 0;
    container.onkeydown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            selectedLibraryFolders = folders.slice();
            container.querySelectorAll('.library-location-item').forEach((item) => item.classList.add('selected'));
        }
    };
    container.onpaste = handlePastedLibraryFolder;
    container.onpointerdown = (event) => {
        const target = event.target.closest('.library-location-item');
        if (!target && selectedLibraryFolders.length > 0) {
            clearLibraryFolderSelection();
        }
    };
    container.ondragenter = (event) => {
        const transfer = event.dataTransfer;
        if (!transfer || !Array.from(transfer.types || []).includes('Files')) {
            return;
        }
        const hasFolderCandidate = Array.from(transfer.files || []).some((file) => file && file.path) ||
            transfer.getData('text/uri-list') || transfer.getData('text/plain');
        if (!hasFolderCandidate) return;
        container.classList.add('drag-over-folder');
    };
    container.ondragleave = (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            container.classList.remove('drag-over-folder');
        }
    };
    container.ondragover = (event) => {
        const transfer = event.dataTransfer;
        if (!transfer) return;
        const hasFolderCandidate = Array.from(transfer.files || []).some((file) => file && file.path) ||
            transfer.getData('text/uri-list') || transfer.getData('text/plain');
        if (!hasFolderCandidate) {
            event.preventDefault();
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        container.classList.add('drag-over-folder');
    };
    container.ondrop = handleDroppedLibraryFolder;
    container.querySelectorAll('.library-location-item').forEach((item) => {
        item.classList.toggle('selected', selectedLibraryFolders.includes(item.dataset.folder));
    });
}


async function removeSelectedLibraryFolder() {
    if (selectedLibraryFolders.length === 0) {
        showNotification('No folder selected', 'warning', 2000);
        return;
    }

    const foldersToRemove = [...selectedLibraryFolders];
    const folderNames = foldersToRemove.map((folderPath) => folderPath.split('\\').pop() || folderPath);

    const confirmed = await showConfirmDialog({
        title: 'Remove Music Folder',
        message: `Remove ${foldersToRemove.length} selected folder${foldersToRemove.length !== 1 ? 's' : ''} from your music library?\n\nSongs from these folders will be removed from the player.`,
        okText: 'Remove',
        cancelText: 'Cancel'
    });

    if (!confirmed) return;

    if (!window.electronAPI || (!window.electronAPI.removeMusicFolders && !window.electronAPI.removeMusicFolder)) {
        showNotification('Not available', 'warning', 2000);
        return;
    }

    const result = window.electronAPI.removeMusicFolders
        ? await window.electronAPI.removeMusicFolders(foldersToRemove)
        : await Promise.all(foldersToRemove.map((folderPath) => window.electronAPI.removeMusicFolder(folderPath))).then(
              (results) => ({ success: results.every((item) => item && item.success) })
          );

    if (result && result.success) {
        selectedLibraryFolders = [];
        await renderLibraryLocations();
        showNotification(
            `Removed ${folderNames.length} folder${folderNames.length !== 1 ? 's' : ''}. Click "Save and Apply Changes" to update songs.`,
            'info',
            4000
        );
    } else {
        showNotification('Failed to remove folder', 'error', 2000);
    }
}


async function addLibraryLocation() {
    if (!window.electronAPI || !window.electronAPI.addMusicFolder) {
        showNotification('Not available', 'warning', 2000);
        return;
    }

    const result = await window.electronAPI.addMusicFolder();

    if (result && result.success) {
        await renderLibraryLocations();
        showNotification('Folder added. Click "Rebuild Library" to scan it.', 'success', 3000);
    } else if (result && result.reason === 'duplicate') {
        showNotification('Folder already in library', 'warning', 2000);
    } else {
        showNotification('Failed to add folder', 'error', 2000);
    }
}


async function rebuildLibraryFromFolders() {
    if (!window.electronAPI || !window.electronAPI.rebuildFromFolders) {
        showNotification('Not available', 'warning', 2000);
        return;
    }

    const folders = await loadLibraryLocations();

    const confirmed = await showConfirmDialog({
        title: 'Save and Apply Music Folders',
        message: folders.length
            ? `Scan ${folders.length} selected folder(s) and update your music library?`
            : 'Remove all music folders and clear the current library?',
        okText: 'Apply',
        cancelText: 'Cancel'
    });

    if (!confirmed) return;

    showNotification(
        folders.length ? `Scanning ${folders.length} folder(s)...` : 'Clearing the music library...',
        'info',
        3000
    );

    const result = await window.electronAPI.rebuildFromFolders();

    if (result && result.success && Array.isArray(result.songs)) {
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

        if (currentView === VIEWS.ALL_SONGS) {
            const songs = getSongsForList(VIEWS.ALL_SONGS);
            renderSongsList(songs, VIEWS.ALL_SONGS);
            setupHeroSection(true, 'All Songs', songs.length, 'Playlist');
        }

        await renderLibraryLocations();

        showNotification(
            folders.length
                ? `Loaded ${result.songs.length} songs from ${folders.length} folder(s)`
                : 'Music library cleared',
            'success',
            4000
        );
    } else {
        const errorMsg = result ? result.reason || result.error || 'Unknown error' : 'No response';
        showNotification(`Failed to rebuild library: ${errorMsg}`, 'error', 4000);
    }
}

// ==============================================================================
// IMPORT / EXPORT
// (split out of 03-storage.js, Phase 2 Checkpoint 5)
// ==============================================================================


// ==============================================================================
// IMPORT / EXPORT
// ==============================================================================
function exportAllData() {
    const data = {
        playlists: getPlaylists(),
        folders: getFolders(),
        favorites: getFavorites(),
        playHistory: getPlayHistory(),
        recentlyPlayed: getRecentlyPlayed(),
        searchHistory: getSearchHistory(),
        pinnedItems: getPinnedItems(),
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `music_player_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification('Data exported successfully', 'success', 2000);
}


function importAllData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                showImportChoiceModal(data, file.name);
            } catch (err) {
                showNotification('Invalid backup file', 'error', 2000);
            }
        };

        reader.readAsText(file);
    };

    input.click();
}


function showImportChoiceModal(data, filename) {
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closeImportChoiceModal);
    modal.onclick = (e) => e.stopPropagation();

    modal.innerHTML = `
                        <h3 class="playlist-modal-title">Import Data</h3>
                        <p style="color: var(--text-secondary); font-size: 13px; margin: 10px 0;">
                                File: ${escapeHtml(filename)}
                        </p>
                        <p style="color: var(--text-secondary); font-size: 13px; margin: 10px 0;">
                                How would you like to import?
                        </p>
                        <div class="playlist-modal-buttons" style="flex-direction: column; gap: 8px;">
                                <button onclick="doImportMerge(${JSON.stringify(data).replace(
                                    /"/g,
                                    '&quot;'
                                )}); closeImportChoiceModal();" class="playlist-modal-create-btn" style="width: 100%;">
                                        <i class="fas fa-plus"></i> Merge with existing data
                                </button>
                                <button onclick="doImportReplace(${JSON.stringify(data).replace(
                                    /"/g,
                                    '&quot;'
                                )}); closeImportChoiceModal();" class="playlist-modal-cancel-btn" style="width: 100%;">
                                        <i class="fas fa-sync-alt"></i> Replace all existing data
                                </button>
                        </div>
                `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}


function closeImportChoiceModal() {
    const modal = document.querySelector('.playlist-modal');
    const overlay = document.querySelector('.playlist-modal-overlay');
    if (modal) modal.remove();
    if (overlay) overlay.remove();
}


function doImportMerge(data) {
    if (data.playlists) {
        const existing = getPlaylists();
        const merged = [...existing];
        data.playlists.forEach((p) => {
            if (!merged.find((e) => e.id === p.id)) {
                merged.push(p);
            }
        });
        savePlaylists(merged);
    }
    if (data.favorites) {
        const existing = getFavorites();
        const merged = [...new Set([...existing, ...data.favorites])];
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(merged));
    }
    if (data.pinnedItems) {
        const existing = getPinnedItems();
        const merged = [...new Set([...existing, ...data.pinnedItems])];
        savePinnedItems(merged);
    }
    if (data.folders) {
        const existing = getFolders();
        const merged = [...existing];
        data.folders.forEach((f) => {
            if (!merged.find((e) => e.id === f.id)) {
                merged.push(f);
            }
        });
        saveFolders(merged);
    }
    finishImport();
}


function doImportReplace(data) {
    if (data.playlists) savePlaylists(data.playlists);
    if (data.favorites) localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(data.favorites));
    if (data.playHistory) localStorage.setItem(STORAGE_KEYS.PLAY_HISTORY, JSON.stringify(data.playHistory));
    if (data.recentlyPlayed) localStorage.setItem(STORAGE_KEYS.RECENTLY_PLAYED, JSON.stringify(data.recentlyPlayed));
    if (data.searchHistory) localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(data.searchHistory));
    if (data.pinnedItems) savePinnedItems(data.pinnedItems);
    if (data.folders) saveFolders(data.folders);
    finishImport();
}


function finishImport() {
    renderPlaylistsView();
    renderFoldersView();
    renderLeftPanelMainList();
    updateRecentCount();
    showNotification('Data imported successfully', 'success', 2000);
}

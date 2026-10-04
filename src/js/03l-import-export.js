// ==============================================================================
// IMPORT / EXPORT
// (split out of 03-storage.js)
// ==============================================================================


// ==============================================================================
// IMPORT / EXPORT
// ==============================================================================
// Event-bus conversion, partial on purpose. This file is mixed:
//   - showImportChoiceModal()/closeImportChoiceModal() and the file picker in
//     importAllData() are UI from top to bottom - left as they are.
//   - doImportMerge()/doImportReplace() are genuine core (merge/replace data in
//     storage). finishImport() was their shared pure-UI tail; it had no other callers, so it
//     was inlined into the 'data:imported' subscriber in 04n-import-export-events.js.
//     Both keep their names: they're called from inline onclick="..." strings in the
//     modal markup below.
//   - exportAllData() keeps its name (called from 08e-panel-settings.js) but the
//     data-gathering half is now buildExportData(), which is pure.

function buildExportData() {
    return {
        playlists: getPlaylists(),
        folders: getFolders(),
        favorites: getFavorites(),
        playHistory: getPlayHistory(),
        recentlyPlayed: getRecentlyPlayed(),
        searchHistory: getSearchHistory(),
        pinnedItems: getPinnedItems(),
        exportDate: new Date().toISOString()
    };
}


function exportAllData() {
    const data = buildExportData();

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
        storageWriteJson(STORAGE_KEYS.FAVORITES, merged);
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
    emit('data:imported');
}


function doImportReplace(data) {
    if (data.playlists) savePlaylists(data.playlists);
    if (data.favorites) storageWriteJson(STORAGE_KEYS.FAVORITES, data.favorites);
    if (data.playHistory) storageWriteJson(STORAGE_KEYS.PLAY_HISTORY, data.playHistory);
    if (data.recentlyPlayed) storageWriteJson(STORAGE_KEYS.RECENTLY_PLAYED, data.recentlyPlayed);
    if (data.searchHistory) storageWriteJson(STORAGE_KEYS.SEARCH_HISTORY, data.searchHistory);
    if (data.pinnedItems) savePinnedItems(data.pinnedItems);
    if (data.folders) saveFolders(data.folders);
    emit('data:imported');
}

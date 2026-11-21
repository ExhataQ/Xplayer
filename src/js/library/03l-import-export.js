// ==============================================================================
// IMPORT / EXPORT
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
//     Both keep their names: the modal's buttons reach them through data-action (confirmImportMerge,
//     confirmImportReplace below), because the page's Content-Security-Policy does not allow inline handlers.
//   - exportAllData() keeps its name (called from 08e-panel-settings.js) but the
//     data-gathering half is now buildExportData(), which is pure.
// What a backup file is, whether a file is one, and how its songs find their way back into a library with other ids is in
// backup-rules.js (pure, tested). A file carries a `songs` table (file address, title, artist, album, length for every song id it uses);
// an import looks each song up again, so a rebuilt library, a moved folder or another PC still gets the right songs.

export function buildExportData() {
    const data = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        playlists: getPlaylists(),
        folders: getFolders(),
        favorites: getFavorites(),
        playHistory: getPlayHistory(),
        recentlyPlayed: getRecentlyPlayed(),
        searchHistory: getSearchHistory(),
        pinnedItems: getPinnedItems(),
        ...(Object.keys(getRatings()).length ? { ratings: getRatings() } : {}), // only when there are ratings, so older backups keep their shape
        exportDate: new Date().toISOString()
    };
    data.songs = buildSongTable(data, getSongById); // which song each id is, for the import
    return data;
}

// Saves `data` as a .json file through the browser's download.
function downloadBackup(data, name) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a); // some browsers ignore a click on a link that is not in the page
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000); // not at once: a large file may still be starting to save
}


// Export and import show a progress row in the notifications (beginTaskProgress in 06j-notification-system.js: the notifications open, a bar
// and what is happening). The steps are short, so each waits a moment: otherwise the row would be up and gone before it can be read.
const pause = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

export async function exportAllData() {
    const task = beginTaskProgress('Exporting data');
    let data;
    try {
        task.update(15, 'Collecting your data');
        await pause();
        data = buildExportData(); // includes the songs table: which song each id is
        task.update(55, 'Describing songs');
        await pause();
        task.update(85, 'Saving the file');
        downloadBackup(data, `music_player_backup_${new Date().toISOString().slice(0, 10)}.json`);
        task.update(100, 'Done');
        await pause(300);
    } catch (err) {
        console.error('[backup] export failed', err);
        task.end();
        showNotification('Data export failed', 'error', 4000);
        return;
    }
    task.end();
    // Kept in the notification list (not just a popup): what was saved, so it can be checked later.
    const contents = backupContentsText(summarizeBackup(data));
    showNotification(contents ? `Data exported: ${contents}` : 'Data exported successfully', 'success', 3000);
}


const MAX_BACKUP_BYTES = 100 * 1024 * 1024; // a real backup is a few MB; a file far beyond that is not one

export function importAllData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return; // the dialog was closed without a choice
        if (file.size > MAX_BACKUP_BYTES) {
            showNotification('That file is too large to be a backup', 'error', 3000);
            return;
        }
        const task = beginTaskProgress('Reading backup');
        task.update(10, file.name);
        const reader = new FileReader();
        reader.onerror = () => {
            task.end();
            showNotification('The file could not be read', 'error', 3000);
        };
        reader.onload = async (event) => {
            let parsed;
            try {
                task.update(50, 'Checking the file');
                await pause();
                parsed = JSON.parse(event.target.result);
            } catch (err) {
                task.end();
                showNotification('Invalid backup file: it is not readable JSON', 'error', 3000);
                return;
            }
            const checked = validateBackup(parsed);
            task.update(100, 'Done');
            await pause(250);
            task.end();
            if (!checked.ok) {
                showNotification(checked.error, 'error', 4000);
                return;
            }
            showImportChoiceModal(checked.data, file.name, checked);
        };
        reader.readAsText(file);
    };

    input.click();
}


// The file the person picked, while the choice dialog is open (an attribute is no place for a whole library).
let pendingImport = null;

export function showImportChoiceModal(data, filename, checked = null) {
    pendingImport = data;
    const { modal, overlay } = createModal('playlist-modal', 'playlist-modal-overlay', closeImportChoiceModal);
    // A click inside the dialog stays inside it, except on a button: the buttons are data-action elements, which run when the click reaches the document.
    modal.onclick = (e) => {
        if (!e.target.closest('[data-action]')) e.stopPropagation();
    };

    modal.innerHTML = `
                        <h3 class="playlist-modal-title">Import Data</h3>
                        <p style="color: var(--text-secondary); font-size: 13px; margin: 10px 0;">
                                File: ${escapeHtml(filename)}
                        </p>
                        ${describeBackup(checked)}
                        <p style="color: var(--text-secondary); font-size: 13px; margin: 10px 0;">
                                How would you like to import?
                        </p>
                        <div class="playlist-modal-buttons" style="flex-direction: column; gap: 8px;">
                                <button data-action="confirmImportMerge" class="playlist-modal-create-btn" style="width: 100%;">
                                        <i class="fas fa-plus"></i> Merge with existing data
                                </button>
                                <button data-action="confirmImportReplace" class="playlist-modal-cancel-btn" style="width: 100%;">
                                        <i class="fas fa-sync-alt"></i> Replace all existing data
                                </button>
                        </div>
                `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}


// What the dialog says about the file: how much is in it, when it was made, and a warning for an old file whose songs cannot be checked.
function describeBackup(checked) {
    if (!checked || !checked.summary) return '';
    const s = checked.summary;
    const made = s.exportDate && !Number.isNaN(Date.parse(s.exportDate)) ? ` (made ${new Date(s.exportDate).toLocaleDateString()})` : '';
    const note = s.hasSongTable
        ? ''
        : '<p style="color: var(--text-secondary); font-size: 12px; margin: 10px 0;">This backup comes from an older version and does not say which songs it holds. Playlists and favorites are restored by number, so they only match if your library has not been rebuilt since.</p>';
    return `<p style="color: var(--text-secondary); font-size: 13px; margin: 10px 0;">Contains ${escapeHtml(backupContentsText(s) || 'no library data')}${escapeHtml(made)}.</p>${note}`;
}

// Gives the file's song ids the ids the same songs have in this library, and says what could not be found.
function prepareImport(data) {
    return remapBackup(data, typeof SONGS_DATA === 'undefined' ? [] : SONGS_DATA);
}

// Merge and Replace run the same steps with a progress row: save a copy (Replace only), find each song in this library, write.
async function runImport(data, replace) {
    const task = beginTaskProgress('Importing data');
    try {
        task.update(10, 'Preparing');
        await pause();
        if (replace) {
            // Replace cannot be undone, so what is here now is saved as a file first (a backup that can be imported again).
            task.update(25, 'Saving a copy of your current data');
            try {
                downloadBackup(buildExportData(), `music_player_before_import_${new Date().toISOString().slice(0, 10)}.json`);
            } catch (err) {
                console.warn('[backup] could not save the copy before replacing', err);
            }
            await pause();
        }
        task.update(55, 'Matching songs to your library');
        await pause();
        const { data: remapped, stats } = prepareImport(data);
        task.update(85, replace ? 'Replacing your data' : 'Merging into your data');
        await pause();
        task.update(100, 'Done');
        task.end();
        if (replace) doImportReplace(remapped, stats);
        else doImportMerge(remapped, stats);
    } catch (err) {
        console.error('[backup] import failed', err);
        task.end();
        showNotification('Data import failed', 'error', 5000);
    }
}

export function confirmImportMerge() {
    const data = pendingImport;
    closeImportChoiceModal();
    if (data) runImport(data, false);
}

export function confirmImportReplace() {
    const data = pendingImport;
    closeImportChoiceModal();
    if (data) runImport(data, true);
}

export function closeImportChoiceModal() {
    pendingImport = null;
    const modal = document.querySelector('.playlist-modal');
    const overlay = document.querySelector('.playlist-modal-overlay');
    if (modal) modal.remove();
    if (overlay) overlay.remove();
}


export function doImportMerge(data, stats = null) {
    if (data.playlists) {
        const existing = getPlaylists();
        const merged = [...existing];
        data.playlists.forEach((p) => {
            const same = merged.find((e) => e.id === p.id);
            if (!same) {
                merged.push(p);
            } else if (Array.isArray(p.songs)) {
                // the same playlist on both sides: the songs only the file has are added at the end, nothing here is removed
                const have = new Set(same.songs || []);
                same.songs = [...(same.songs || []), ...p.songs.filter((id) => !have.has(id))];
            }
        });
        savePlaylists(merged);
    }
    if (data.favorites) {
        const existing = getFavorites();
        const merged = [...new Set([...existing, ...data.favorites])];
        storageWriteJson(STORAGE_KEYS.FAVORITES, merged);
    }
    if (data.ratings) {
        storageWriteJson(STORAGE_KEYS.RATINGS, { ...parseRatings(data.ratings), ...getRatings() }); // what is rated here stays
        bumpRatingsVersion();
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
    emit('data:imported', { stats, summary: summarizeBackup(data) });
}


export function doImportReplace(data, stats = null) {
    if (data.playlists) savePlaylists(data.playlists);
    if (data.favorites) storageWriteJson(STORAGE_KEYS.FAVORITES, data.favorites);
    if (data.playHistory) storageWriteJson(STORAGE_KEYS.PLAY_HISTORY, data.playHistory);
    if (data.recentlyPlayed) storageWriteJson(STORAGE_KEYS.RECENTLY_PLAYED, data.recentlyPlayed);
    if (data.searchHistory) storageWriteJson(STORAGE_KEYS.SEARCH_HISTORY, data.searchHistory);
    if (data.pinnedItems) savePinnedItems(data.pinnedItems);
    if (data.ratings) {
        storageWriteJson(STORAGE_KEYS.RATINGS, parseRatings(data.ratings));
        bumpRatingsVersion();
    }
    if (data.folders) saveFolders(data.folders);
    emit('data:imported', { stats, summary: summarizeBackup(data) });
}

registerActions({ confirmImportMerge, confirmImportReplace });

// Other files call these by name, so they are registered on window.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        buildExportData,
        exportAllData,
        importAllData,
        doImportMerge,
        doImportReplace
    });
}

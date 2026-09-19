// ==============================================================================
// CUSTOM LYRICS STORAGE
// ==============================================================================
function getCustomLyricsStore() {
    try {
        const saved = localStorage.getItem('customLyrics');
        if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
}

function saveCustomLyricsStore(store) {
    localStorage.setItem('customLyrics', JSON.stringify(store));
}

function getLyricsForSong(song) {
    if (!song || song.id === undefined || song.id === null) return '';
    const store = getCustomLyricsStore();
    const key = song.url || String(song.id);
    if (store[key] !== undefined && String(store[key]).trim() !== '') {
        return store[key];
    }
    if (store[song.id] !== undefined && String(store[song.id]).trim() !== '') {
        return store[song.id];
    }
    return song.lyrics || '';
}

function setLyricsForSong(songId, lyricsText) {
    const store = getCustomLyricsStore();
    const song = SONGS_DATA.find((s) => s.id === songId);
    const key = song && song.url ? song.url : String(songId);
    if (!lyricsText || String(lyricsText).trim() === '') {
        delete store[key];
        delete store[songId];
    } else {
        store[key] = String(lyricsText);
    }
    saveCustomLyricsStore(store);

    if (typeof renderTrackLyricsBox === 'function') {
        const queueItem = currentQueueIndex >= 0 ? playbackQueue[currentQueueIndex] : null;
        const currentSong = queueItem ? queueItem.song || queueItem : null;
        if (currentSong && currentSong.id === songId) {
            renderTrackLyricsBox();
        }
    }
}

// ==============================================================================
// SYNCED LYRICS STORAGE (VARIANTS)
// ==============================================================================
let _syncedVariantIdCounter = 0;

function _nextVariantId() {
    _syncedVariantIdCounter++;
    return 'v' + Date.now().toString(36) + '_' + _syncedVariantIdCounter.toString(36);
}

function getSyncedLyricsStore() {
    try {
        const saved = localStorage.getItem('customSyncedLyrics');
        if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
}

function saveSyncedLyricsStore(store) {
    localStorage.setItem('customSyncedLyrics', JSON.stringify(store));
}

function _migrateEntry(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
        if (raw.trim() === '') return null;
        return {
            activeId: 'v_legacy_1',
            variants: [
                {
                    id: 'v_legacy_1',
                    name: 'Sample 1',
                    text: raw,
                    offset: 0,
                    createdAt: Date.now()
                }
            ]
        };
    }
    if (raw && Array.isArray(raw.variants)) {
        return raw;
    }
    return null;
}

function getSyncedLyricsVariantsForSong(song) {
    if (!song) return null;
    const store = getSyncedLyricsStore();
    const key = song.url || String(song.id);
    let raw = store[key];
    if (!raw && String(song.id) !== key) raw = store[song.id];
    const migrated = _migrateEntry(raw);
    if (migrated && typeof raw === 'string') {
        store[key] = migrated;
        if (store[song.id] !== undefined && String(song.id) !== key) delete store[song.id];
        saveSyncedLyricsStore(store);
    }
    return migrated;
}

function getActiveSyncedLyricsForSong(song) {
    const entry = getSyncedLyricsVariantsForSong(song);
    if (!entry || !entry.variants || entry.variants.length === 0) return null;
    const active = entry.variants.find((v) => v.id === entry.activeId) || entry.variants[0];
    return active || null;
}

function getSyncedLyricsForSong(song) {
    const active = getActiveSyncedLyricsForSong(song);
    return active ? active.text : null;
}

function _getOrCreateEntry(songId) {
    const store = getSyncedLyricsStore();
    const song = SONGS_DATA.find((s) => s.id === songId);
    const key = song && song.url ? song.url : String(songId);
    let raw = store[key];
    if (!raw && String(songId) !== key) raw = store[songId];
    let entry = _migrateEntry(raw);
    if (!entry) {
        entry = {
            activeId: null,
            variants: []
        };
    }
    return {
        store,
        key,
        song,
        entry
    };
}

function addSyncedLyricsVariant(songId, text, offset) {
    if (!text || String(text).trim() === '') return null;
    const { store, key, entry } = _getOrCreateEntry(songId);

    let n = entry.variants.length + 1;
    let name = 'Sample ' + n;
    while (entry.variants.some((v) => v.name === name)) {
        n++;
        name = 'Sample ' + n;
    }

    const variant = {
        id: _nextVariantId(),
        name: name,
        text: String(text),
        offset: typeof offset === 'number' ? offset : 0,
        createdAt: Date.now()
    };
    entry.variants.push(variant);
    if (!entry.activeId) entry.activeId = variant.id;
    store[key] = entry;
    saveSyncedLyricsStore(store);
    return variant;
}

function setSyncedLyricsForSong(songId, lrcText) {
    if (!lrcText || String(lrcText).trim() === '') {
        clearSyncedLyricsForSong(songId);
        return null;
    }
    const existing = (() => {
        const { entry } = _getOrCreateEntry(songId);
        return entry;
    })();
    const result =
        existing.variants.length === 0
            ? addSyncedLyricsVariant(songId, lrcText, 0)
            : (() => {
                  const { store, key, entry } = _getOrCreateEntry(songId);
                  const active = entry.variants.find((v) => v.id === entry.activeId) || entry.variants[0];
                  if (active) {
                      active.text = String(lrcText);
                      active.createdAt = Date.now();
                      store[key] = entry;
                      saveSyncedLyricsStore(store);
                      return active;
                  }
                  return addSyncedLyricsVariant(songId, lrcText, 0);
              })();

    if (typeof renderTrackLyricsBox === 'function') {
        const queueItem = currentQueueIndex >= 0 ? playbackQueue[currentQueueIndex] : null;
        const currentSong = queueItem ? queueItem.song || queueItem : null;
        if (currentSong && currentSong.id === songId) {
            renderTrackLyricsBox();
        }
    }

    return result;
}

function setActiveSyncedLyricsVariant(songId, variantId) {
    const { store, key, entry } = _getOrCreateEntry(songId);
    if (!entry.variants.some((v) => v.id === variantId)) return false;
    entry.activeId = variantId;
    store[key] = entry;
    saveSyncedLyricsStore(store);
    return true;
}

function renameSyncedLyricsVariant(songId, variantId, newName) {
    if (!newName || String(newName).trim() === '') return false;
    const { store, key, entry } = _getOrCreateEntry(songId);
    const variant = entry.variants.find((v) => v.id === variantId);
    if (!variant) return false;
    variant.name = String(newName).trim();
    store[key] = entry;
    saveSyncedLyricsStore(store);
    return true;
}

function deleteSyncedLyricsVariant(songId, variantId) {
    const { store, key, entry } = _getOrCreateEntry(songId);
    const idx = entry.variants.findIndex((v) => v.id === variantId);
    if (idx === -1) return false;
    entry.variants.splice(idx, 1);
    if (entry.variants.length === 0) {
        delete store[key];
        const song = SONGS_DATA.find((s) => s.id === songId);
        if (song && String(song.id) !== key) delete store[song.id];
        saveSyncedLyricsStore(store);
        return true;
    }
    if (entry.activeId === variantId) {
        entry.activeId = entry.variants[0].id;
    }
    store[key] = entry;
    saveSyncedLyricsStore(store);
    return true;
}

function clearSyncedLyricsForSong(songId) {
    const store = getSyncedLyricsStore();
    const song = SONGS_DATA.find((s) => s.id === songId);
    const key = song && song.url ? song.url : String(songId);
    delete store[key];
    if (String(songId) !== key) delete store[songId];
    saveSyncedLyricsStore(store);

    if (typeof renderTrackLyricsBox === 'function') {
        const queueItem = currentQueueIndex >= 0 ? playbackQueue[currentQueueIndex] : null;
        const currentSong = queueItem ? queueItem.song || queueItem : null;
        if (currentSong && currentSong.id === songId) {
            renderTrackLyricsBox();
        }
    }
}

// ==============================================================================
// LYRICS EDITOR (PLAIN TEXT)
// ==============================================================================
function openLyricsEditor() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) {
        showNotification('No song playing', 'warning', 2000);
        return;
    }

    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;
    const existing = getLyricsForSong(song);

    let overlay = document.getElementById('lyrics-editor-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'lyrics-editor-overlay';
        overlay.className = 'lyrics-editor-overlay';
        overlay.onclick = closeLyricsEditor;
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="lyrics-editor-modal" onclick="event.stopPropagation()">
            <div class="lyrics-editor-header">
                <div class="lyrics-editor-title">${existing ? 'Edit Lyrics' : 'Add Lyrics'}</div>
                <div class="lyrics-editor-song">${escapeHtml(song.title || 'Unknown')} — ${escapeHtml(
        song.artist || 'Unknown Artist'
    )}</div>
            </div>
            <textarea class="lyrics-editor-textarea" id="lyrics-editor-textarea" placeholder="Paste or type lyrics here. Line breaks are preserved.">${escapeHtml(
                existing
            )}</textarea>
            <div class="lyrics-editor-actions">
                <button class="lyrics-editor-btn lyrics-editor-btn-danger" onclick="clearLyricsForCurrentSong()">Clear</button>
                <div class="lyrics-editor-actions-right">
                    <button class="lyrics-editor-btn" onclick="closeLyricsEditor()">Cancel</button>
                    <button class="lyrics-editor-btn lyrics-editor-btn-primary" onclick="saveLyricsFromEditor()">Save</button>
                </div>
            </div>
        </div>
    `;

    requestAnimationFrame(() => {
        overlay.classList.add('active');
        const textarea = document.getElementById('lyrics-editor-textarea');
        if (textarea) textarea.focus();
    });

    document.addEventListener('keydown', lyricsEditorKeyHandler);
}

function openLyricsEditorForSong(songId) {
    const song = SONGS_DATA.find((s) => s.id === songId);
    if (!song) return;

    const existing = getLyricsForSong(song);

    let overlay = document.getElementById('lyrics-editor-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'lyrics-editor-overlay';
        overlay.className = 'lyrics-editor-overlay';
        overlay.onclick = closeLyricsEditor;
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="lyrics-editor-modal" onclick="event.stopPropagation()">
            <div class="lyrics-editor-header">
                <div class="lyrics-editor-title">${existing ? 'Edit Lyrics' : 'Add Lyrics'}</div>
                <div class="lyrics-editor-song">${escapeHtml(song.title || 'Unknown')} — ${escapeHtml(
        song.artist || 'Unknown Artist'
    )}</div>
            </div>
            <textarea class="lyrics-editor-textarea" id="lyrics-editor-textarea" placeholder="Paste or type lyrics here. Line breaks are preserved."></textarea>
            <div class="lyrics-editor-actions">
                <button class="lyrics-editor-btn lyrics-editor-btn-danger" onclick="clearLyricsForSong('${songId}')">Clear</button>
                <div class="lyrics-editor-actions-right">
                    <button class="lyrics-editor-btn" onclick="closeLyricsEditor()">Cancel</button>
                    <button class="lyrics-editor-btn lyrics-editor-btn-primary" onclick="saveLyricsForSong('${songId}')">Save</button>
                </div>
            </div>
        </div>
    `;

    const textarea = document.getElementById('lyrics-editor-textarea');
    if (textarea) textarea.value = existing;

    requestAnimationFrame(() => {
        overlay.classList.add('active');
        if (textarea) textarea.focus();
    });

    document.addEventListener('keydown', lyricsEditorKeyHandler);
}

function saveLyricsForSong(songId) {
    const textarea = document.getElementById('lyrics-editor-textarea');
    if (!textarea) return;
    const normalized = textarea.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    setLyricsForSong(songId, normalized);
    closeLyricsEditor();

    if (currentView === 'lyrics') {
        renderLyricsView();
    }

    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const queueItem = playbackQueue[currentQueueIndex];
        const song = queueItem.song || queueItem;
        if (song.id === songId) {
            const lyricsToggleBtnEl = document.getElementById('lyrics-toggle-btn');
            if (lyricsToggleBtnEl) {
                const hasLyrics = String(textarea.value || '').trim() !== '';
                lyricsToggleBtnEl.disabled = !hasLyrics;
            }
        }
    }

    showNotification('Lyrics saved', 'success', 2000);
}

function clearLyricsForSong(songId) {
    setLyricsForSong(songId, '');
    closeLyricsEditor();

    if (currentView === 'lyrics') {
        renderLyricsView();
    }

    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const queueItem = playbackQueue[currentQueueIndex];
        const song = queueItem.song || queueItem;
        if (song.id === songId) {
            const lyricsToggleBtnEl = document.getElementById('lyrics-toggle-btn');
            if (lyricsToggleBtnEl) {
                lyricsToggleBtnEl.disabled = true;
            }
        }
    }

    showNotification('Lyrics cleared', 'info', 2000);
}

function closeLyricsEditor() {
    const overlay = document.getElementById('lyrics-editor-overlay');
    if (overlay) overlay.classList.remove('active');
    document.removeEventListener('keydown', lyricsEditorKeyHandler);
}

function lyricsEditorKeyHandler(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        closeLyricsEditor();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveLyricsFromEditor();
    }
}

function saveLyricsFromEditor() {
    const textarea = document.getElementById('lyrics-editor-textarea');
    if (!textarea) return;
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return;
    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;
    const normalized = textarea.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    setLyricsForSong(song.id, normalized);
    closeLyricsEditor();
    renderLyricsView();
    showNotification('Lyrics saved', 'success', 2000);
}

function clearLyricsForCurrentSong() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return;
    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;
    setLyricsForSong(song.id, '');
    closeLyricsEditor();
    renderLyricsView();
    showNotification('Lyrics cleared', 'info', 2000);
}

// ==============================================================================
// SYNCED VARIANT SELECTION FROM LYRICS VIEW
// ==============================================================================
function selectSyncedVariant(variantId) {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return;
    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;
    if (setActiveSyncedLyricsVariant(song.id, variantId)) {
        if (currentView === 'lyrics') renderLyricsView();
    }
}

function renameSyncedVariant(variantId) {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return;
    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;
    const entry = getSyncedLyricsVariantsForSong(song);
    if (!entry) return;
    const variant = entry.variants.find((v) => v.id === variantId);
    if (!variant) return;
    const newName = prompt('Rename variant:', variant.name);
    if (!newName || newName.trim() === '') return;
    if (renameSyncedLyricsVariant(song.id, variantId, newName.trim())) {
        if (currentView === 'lyrics') renderLyricsView();
    }
}

function deleteSyncedVariant(variantId) {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return;
    const queueItem = playbackQueue[currentQueueIndex];
    const song = queueItem.song || queueItem;
    showConfirmDialog({
        title: 'Delete Variant',
        message: 'Delete this saved LRC variant?',
        okText: 'Delete',
        cancelText: 'Cancel'
    }).then((confirmed) => {
        if (!confirmed) return;
        if (deleteSyncedLyricsVariant(song.id, variantId)) {
            if (currentView === 'lyrics') renderLyricsView();
            showNotification('Variant deleted', 'info', 2000);
        }
    });
}

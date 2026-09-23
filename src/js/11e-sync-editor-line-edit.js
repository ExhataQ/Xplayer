// Sync editor: per-line editing (focus, stamp, clear, edit text, discard changes).

function focusSyncLine(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    syncEditorState.focusedIndex = index;
    renderSyncEditorLines();
    scrollSyncLineIntoView(index);
}

function scrollSyncLineIntoView(index) {
    const container = document.getElementById('sync-editor-lines');
    if (!container) return;
    const el = container.querySelector('.sync-editor-line[data-index="' + index + '"]');
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (elRect.top < containerRect.top || elRect.bottom > containerRect.bottom) {
        el.scrollIntoView({
            block: 'center',
            behavior: 'smooth'
        });
    }
}

function stampFocusedLine() {
    if (!syncEditorState.open) return;
    const idx = syncEditorState.focusedIndex;
    if (idx < 0 || idx >= syncEditorState.lines.length) return;
    const line = syncEditorState.lines[idx];
    if (!line) return;
    if (!line.instrumental && line.text.trim() === '') return;

    pushSyncHistory('Stamp');
    line.time = Math.max(0, audioElement.currentTime || 0);

    let next = -1;
    for (let i = idx + 1; i < syncEditorState.lines.length; i++) {
        const l = syncEditorState.lines[i];
        if (l.instrumental || l.text.trim() !== '') {
            next = i;
            break;
        }
    }
    if (next !== -1) syncEditorState.focusedIndex = next;

    renderSyncEditorLines();
    if (next !== -1) scrollSyncLineIntoView(next);
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function clearSyncLineTime(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    pushSyncHistory('Clear stamp');
    syncEditorState.lines[index].time = null;
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function editSyncLineTime(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    const container = document.getElementById('sync-editor-lines');
    if (!container) return;
    const row = container.querySelector('.sync-editor-line[data-index="' + index + '"]');
    if (!row) return;
    const timeCell = row.querySelector('.sync-editor-time');
    if (!timeCell) return;

    const current = syncEditorState.lines[index].time;
    const currentStr = typeof current === 'number' ? formatLrcTime(current) : '';

    timeCell.innerHTML = '<input type="text" class="sync-editor-time-input" value="' + currentStr + '" />';
    const input = timeCell.querySelector('input');
    if (!input) return;
    input.focus();
    input.select();

    let committed = false;
    const commit = () => {
        if (committed) return;
        committed = true;
        const parsed = parseManualTime(input.value);
        if (parsed === null) {
            renderSyncEditorLines();
            return;
        }
        syncEditorState.lines[index].time = parsed;
        renderSyncEditorLines();
        updateSyncEditorPreview();
        updateSyncEditorProgress();
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            committed = true;
            renderSyncEditorLines();
        }
    });
    input.addEventListener('blur', commit);
}

function editSyncLineText(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    const container = document.getElementById('sync-editor-lines');
    if (!container) return;
    const row = container.querySelector('.sync-editor-line[data-index="' + index + '"]');
    if (!row) return;
    const textCell = row.querySelector('.sync-editor-text');
    if (!textCell) return;

    const original = syncEditorState.lines[index].text;
    textCell.innerHTML = '<textarea class="sync-editor-text-input" rows="1">' + escapeHtml(original) + '</textarea>';
    const input = textCell.querySelector('textarea');
    if (!input) return;
    input.focus();
    input.select();

    let committed = false;

    const commit = (splitLine) => {
        if (committed) return;
        committed = true;

        if (splitLine) {
            const cursorPos = input.selectionStart;
            const before = input.value.substring(0, cursorPos);
            const after = input.value.substring(cursorPos);
            pushSyncHistory('Edit line text');
            syncEditorState.lines[index].text = before;
            syncEditorState.lines[index].instrumental = false;
            syncEditorState.lines.splice(index + 1, 0, {
                text: after,
                time: null
            });
            if (after.trim() === '') {
                for (let i = index + 2; i < syncEditorState.lines.length; i++) {
                    if (syncEditorState.lines[i].text.trim() !== '') {
                        syncEditorState.focusedIndex = i;
                        break;
                    }
                }
            } else {
                syncEditorState.focusedIndex = index + 1;
            }
        } else {
            pushSyncHistory('Edit line text');
            syncEditorState.lines[index].text = input.value;
            syncEditorState.lines[index].instrumental = false;
        }

        renderSyncEditorLines();
        updateSyncEditorPreview();
        updateSyncEditorProgress();
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit(true);
        } else if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = input.value.substring(0, start) + '\n' + input.value.substring(end);
            input.selectionStart = input.selectionEnd = start + 1;
        } else if (e.key === 'Escape') {
            e.preventDefault();
            committed = true;
            renderSyncEditorLines();
        }
    });
    input.addEventListener('blur', () => commit(false));
}

function clearAllSyncStamps() {
    if (syncEditorState.lines.length === 0) return;
    pushSyncHistory('Clear all stamps');
    syncEditorState.lines.forEach((l) => {
        l.time = null;
    });
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function discardSyncChanges() {
    if (!syncEditorState.open) return;
    const hasWork = syncEditorState.lines.length > 0 || (syncEditorState.history && syncEditorState.history.length > 0);
    if (!hasWork) return;

    showConfirmDialog({
        title: 'Discard Changes',
        message: 'Discard all changes and go back to the source picker?',
        okText: 'Discard',
        cancelText: 'Cancel'
    }).then((confirmed) => {
        if (!confirmed) return;
        syncEditorState.lines = [];
        syncEditorState.focusedIndex = -1;
        syncEditorState.sourceVariantId = null;
        syncEditorState.history = [];
        syncEditorState.redoStack = [];
        syncEditorState.pasteOpen = false;
        renderSyncEditorLines();
        updateSyncEditorPreview();
        updateSyncEditorProgress();
    });
}

function copySyncCurrentTime() {
    const t = formatSyncTimecode(audioElement.currentTime || 0);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
            .writeText(t)
            .then(() => {
                showNotification('Copied ' + t, 'success', 1500);
            })
            .catch(() => {
                showNotification('Copy failed', 'error', 1500);
            });
    } else {
        const ta = document.createElement('textarea');
        ta.value = t;
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            showNotification('Copied ' + t, 'success', 1500);
        } catch (e) {}
        ta.remove();
    }
}

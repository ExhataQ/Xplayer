// Sync editor: line insert/delete/shift and the per-line context menu.

function insertSyncLineAbove(index) {
    pushSyncHistory('Insert line above');
    syncEditorState.lines.splice(index, 0, {
        text: '',
        time: null
    });
    syncEditorState.focusedIndex = index;
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
    scrollSyncLineIntoView(index);
    setTimeout(() => editSyncLineText(index), 30);
}

function insertSyncLineBelow(index) {
    pushSyncHistory('Insert line below');
    syncEditorState.lines.splice(index + 1, 0, {
        text: '',
        time: null
    });
    syncEditorState.focusedIndex = index + 1;
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
    scrollSyncLineIntoView(index + 1);
    setTimeout(() => editSyncLineText(index + 1), 30);
}

function deleteSyncLine(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    pushSyncHistory('Delete line');
    syncEditorState.lines.splice(index, 1);
    if (syncEditorState.focusedIndex >= syncEditorState.lines.length) {
        syncEditorState.focusedIndex = syncEditorState.lines.length - 1;
    }
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function setSyncLineTimeToNow(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    pushSyncHistory('Set time');
    syncEditorState.lines[index].time = Math.max(0, audioElement.currentTime || 0);
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function toggleSyncLineInstrumental(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    pushSyncHistory('Toggle instrumental');
    const line = syncEditorState.lines[index];
    line.instrumental = !line.instrumental;
    if (line.instrumental) line.text = '';
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function shiftSyncLineTime(index, delta) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    const line = syncEditorState.lines[index];
    if (typeof line.time !== 'number') {
        showNotification('Line has no time to shift', 'warning', 1500);
        return;
    }
    pushSyncHistory('Shift time');
    let t = line.time + delta;
    if (t < 0) t = 0;
    line.time = t;
    renderSyncEditorLines();
    updateSyncEditorPreview();
}

let _syncLineContextMenu = null;
let _syncLineContextMenuOpenedAt = 0;
let _syncLineContextMenuDocHandler = null;

function showSyncLineContextMenu(event, index) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    closeSyncLineContextMenu();
    if (index < 0 || index >= syncEditorState.lines.length) return;

    const menu = document.createElement('div');
    menu.className = 'sync-line-context-menu';
    menu.style.position = 'fixed';
    menu.style.zIndex = '100050';
    menu.style.background = '#282828';
    menu.style.borderRadius = '4px';
    menu.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    menu.style.minWidth = '190px';
    menu.style.padding = '4px 0';
    menu.style.display = 'block';

    const line = syncEditorState.lines[index];
    const isInstrumental = line && line.instrumental === true;
    const items = [
        {
            icon: 'fa-crosshairs',
            label: 'Focus',
            handler: () => focusSyncLine(index)
        },
        {
            icon: 'fa-clock',
            label: 'Set the time',
            handler: () => setSyncLineTimeToNow(index)
        },
        {
            icon: 'fa-music',
            label: isInstrumental ? 'Mark as lyric' : 'Mark as instrumental',
            handler: () => toggleSyncLineInstrumental(index)
        },
        {
            icon: 'fa-plus',
            label: 'Add new line below',
            handler: () => insertSyncLineBelow(index)
        },
        {
            icon: 'fa-plus',
            label: 'Add new line above',
            handler: () => insertSyncLineAbove(index)
        },
        {
            icon: 'fa-trash-alt',
            label: 'Delete line',
            handler: () => deleteSyncLine(index)
        },
        {
            icon: 'fa-pen',
            label: 'Edit line',
            handler: () => editSyncLineText(index)
        }
    ];

    menu.innerHTML = items
        .map(
            (it) => `
        <div class="sync-line-context-item" style="display:flex;align-items:center;padding:10px 12px;cursor:pointer;font-size:13px;color:#fff;">
            <i class="fas ${it.icon}" style="width:20px;margin-right:12px;color:#b3b3b3;"></i>
            <span>${it.label}</span>
        </div>
    `
        )
        .join('');

    document.body.appendChild(menu);

    menu.querySelectorAll('.sync-line-context-item').forEach((el, i) => {
        el.addEventListener('mouseenter', () => (el.style.background = 'rgba(255,255,255,0.1)'));
        el.addEventListener('mouseleave', () => (el.style.background = 'transparent'));
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            closeSyncLineContextMenu();
            const item = items[i];
            if (item && typeof item.handler === 'function') {
                try {
                    item.handler();
                } catch (err) {
                    // Intentionally silent: a context-menu action failing shouldn't crash
                    // the menu itself; the menu still closes normally either way.
                }
            }
        });
    });

    const menuWidth = menu.offsetWidth || 190;
    const menuHeight = menu.offsetHeight || 220;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let posX = event.clientX;
    let posY = event.clientY + 5;

    if (windowWidth - event.clientX < menuWidth) posX = event.clientX - menuWidth - 7;
    if (posX < 7) posX = 7;

    if (windowHeight - event.clientY < menuHeight) posY = event.clientY - menuHeight - 7;
    if (posY < 7) posY = 7;

    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';

    _syncLineContextMenu = menu;
    _syncLineContextMenuOpenedAt = Date.now();

    _syncLineContextMenuDocHandler = (e) => {
        if (!_syncLineContextMenu) return;
        if (Date.now() - _syncLineContextMenuOpenedAt < 100) return;
        if (_syncLineContextMenu.contains(e.target)) return;
        closeSyncLineContextMenu();
    };

    setTimeout(() => {
        document.addEventListener('mousedown', _syncLineContextMenuDocHandler, true);
        document.addEventListener('contextmenu', _syncLineContextMenuDocHandler, true);
    }, 50);
}

function closeSyncLineContextMenu() {
    if (_syncLineContextMenu) {
        _syncLineContextMenu.remove();
        _syncLineContextMenu = null;
    }
    if (_syncLineContextMenuDocHandler) {
        document.removeEventListener('mousedown', _syncLineContextMenuDocHandler, true);
        document.removeEventListener('contextmenu', _syncLineContextMenuDocHandler, true);
        _syncLineContextMenuDocHandler = null;
    }
}

function selectSyncLine(index) {
    if (index < 0 || index >= syncEditorState.lines.length) return;
    if (index === syncEditorState.focusedIndex) return;
    syncEditorState.focusedIndex = index;
    renderSyncEditorLines();
}

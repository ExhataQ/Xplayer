// Sync editor: mini player controls plus rendering/loading the editable line list.

function formatSyncTimecode(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const cs = Math.floor((seconds - Math.floor(seconds)) * 100);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
}

function updateSyncMiniPlayer() {
    if (!syncEditorState.open) return;
    const cur = document.getElementById('sync-timecode-current');
    if (cur) cur.textContent = formatSyncTimecode(audioElement.currentTime || 0);

    const total = document.getElementById('sync-timecode-total');
    if (total && audioElement.duration && isFinite(audioElement.duration)) {
        total.textContent = formatSyncTimecode(audioElement.duration);
    }

    const pct = audioElement.duration ? (audioElement.currentTime / audioElement.duration) * 100 : 0;
    const fill = document.getElementById('sync-scrubber-fill');
    const knob = document.getElementById('sync-scrubber-knob');
    if (fill) fill.style.width = pct + '%';
    if (knob) knob.style.left = pct + '%';

    const icon = document.getElementById('sync-mini-play-icon');
    if (icon) icon.textContent = audioElement.paused ? 'play_arrow' : 'pause';

    updateSyncMiniVolume();
    if (syncEditorState.liveFollow && !audioElement.paused) {
        followPlayingLine();
    }
}

function syncMiniTogglePlay() {
    if (!audioElement.src) return;
    if (audioElement.paused) audioElement.play().catch(() => {});
    else audioElement.pause();
    updateSyncMiniPlayer();
}

function syncMiniSeekBy(delta) {
    if (!audioElement.src) return;
    const dur = audioElement.duration || 0;
    let t = (audioElement.currentTime || 0) + delta;
    if (t < 0) t = 0;
    if (dur > 0 && t > dur) t = dur;
    audioElement.currentTime = t;
    updateSyncMiniPlayer();
}

function startSyncScrub(event) {
    if (!audioElement.src) return;
    event.preventDefault();
    const scrubber = document.getElementById('sync-scrubber');
    if (!scrubber) return;
    const dur = audioElement.duration || 0;
    if (dur <= 0) return;

    const wasPlaying = !audioElement.paused;
    if (wasPlaying) audioElement.pause();

    function compute(clientX) {
        const rect = scrubber.getBoundingClientRect();
        let x = clientX - rect.left;
        if (x < 0) x = 0;
        if (x > rect.width) x = rect.width;
        return (x / rect.width) * dur;
    }

    function onMove(e) {
        audioElement.currentTime = compute(e.clientX);
        updateSyncMiniPlayer();
    }

    function onUp(e) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (wasPlaying) audioElement.play().catch(() => {});
    }

    audioElement.currentTime = compute(event.clientX);
    updateSyncMiniPlayer();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function renderSyncEditorLines() {
    const container = document.getElementById('sync-editor-lines');
    if (!container) return;

    if (syncEditorState.lines.length === 0) {
        const pasteOpen = syncEditorState.pasteOpen === true;
        container.innerHTML = `
            <div class="sync-editor-empty">
                <i class="fas fa-align-left"></i>
                <p>No lines loaded</p>
                <small>Choose a source above, or start from scratch.</small>
                <div class="sync-editor-empty-actions">
                    <button class="sync-editor-mini-btn" onclick="togglePasteArea()">Paste Lyrics</button>
                    <button class="sync-editor-mini-btn sync-editor-mini-btn-primary" onclick="startBlankSyncSession()">Start Blank</button>
                </div>
                ${
                    pasteOpen
                        ? `
                    <div class="sync-editor-paste-area">
                        <textarea class="sync-editor-paste" id="sync-editor-paste" placeholder="Paste lyrics here (one line per row)…"></textarea>
                        <button class="sync-editor-mini-btn sync-editor-mini-btn-primary" onclick="loadPastedIntoEditor()">Load Pasted Lyrics</button>
                    </div>
                `
                        : ''
                }
            </div>
        `;
        if (pasteOpen) {
            const ta = document.getElementById('sync-editor-paste');
            if (ta) ta.focus();
        }
        return;
    }

    const html = syncEditorState.lines
        .map((line, i) => {
            const isFocused = i === syncEditorState.focusedIndex;
            const isInstrumental = line.instrumental === true;
            const isBlank = !isInstrumental && line.text.trim() === '';
            const timeStr = typeof line.time === 'number' ? formatLrcTime(line.time) : '--:--.--';
            const focusedClass = isFocused ? ' sync-editor-line-focused' : '';
            const blankClass = isBlank ? ' sync-editor-line-blank' : '';
            const instrClass = isInstrumental ? ' sync-editor-line-instrumental' : '';
            const textContent = isInstrumental
                ? '<span class="sync-editor-instr-glyph"><span class="material-symbols-outlined">music_note</span></span>'
                : isBlank
                ? '&nbsp;'
                : escapeHtml(line.text);

            return `
                            <div class="sync-editor-line${focusedClass}${blankClass}${instrClass}" data-index="${i}" onclick="selectSyncLine(${i})">
                <div class="sync-editor-insert">
                    <button class="sync-editor-insert-btn" onclick="event.stopPropagation(); insertSyncLineAbove(${i})" title="Add line above">+</button>
                    <button class="sync-editor-insert-btn" onclick="event.stopPropagation(); insertSyncLineBelow(${i})" title="Add line below">+</button>
                </div>
                <div class="sync-editor-text" ondblclick="event.stopPropagation(); ${
                    isInstrumental ? '' : `editSyncLineText(${i})`
                }" title="${isInstrumental ? 'Instrumental marker' : 'Double-click to edit'}">${textContent}</div>
                <div class="sync-editor-time" onclick="event.stopPropagation(); editSyncLineTime(${i})" oncontextmenu="event.preventDefault(); event.stopPropagation(); clearSyncLineTime(${i});">
                    ${timeStr}
                </div>
                <div class="sync-editor-shift-group">
                    <button class="sync-editor-shift-btn" onclick="event.stopPropagation(); shiftSyncLineTime(${i}, -1)" title="−1s">−1</button>
                    <button class="sync-editor-shift-btn" onclick="event.stopPropagation(); shiftSyncLineTime(${i}, -0.5)" title="−0.5s">−.5</button>
                    <button class="sync-editor-shift-btn" onclick="event.stopPropagation(); shiftSyncLineTime(${i}, -0.1)" title="−0.1s">−.1</button>
                    <button class="sync-editor-shift-btn" onclick="event.stopPropagation(); shiftSyncLineTime(${i}, 0.1)" title="+0.1s">+.1</button>
                    <button class="sync-editor-shift-btn" onclick="event.stopPropagation(); shiftSyncLineTime(${i}, 0.5)" title="+0.5s">+.5</button>
                    <button class="sync-editor-shift-btn" onclick="event.stopPropagation(); shiftSyncLineTime(${i}, 1)" title="+1s">+1</button>
                </div>
                <div class="sync-editor-actions">
                    ${
                        isFocused && (isInstrumental || !isBlank)
                            ? '<button class="sync-editor-icon-btn sync-editor-icon-btn-primary" onclick="event.stopPropagation(); stampFocusedLine()" title="Stamp current time (F1)">+</button>'
                            : ''
                    }
                    ${
                        isFocused
                            ? `<button class="sync-editor-icon-btn ${
                                  isInstrumental ? 'sync-editor-icon-btn-active' : ''
                              }" onclick="event.stopPropagation(); toggleSyncLineInstrumental(${i})" title="${
                                  isInstrumental ? 'Mark as lyric' : 'Mark as instrumental'
                              }"><span class="material-symbols-outlined">music_note</span></button>`
                            : ''
                    }
                </div>
            </div>
        `;
        })
        .join('');

    container.innerHTML = html;

    container.querySelectorAll('.sync-editor-line').forEach((row) => {
        row.addEventListener('contextmenu', (e) => {
            const idx = parseInt(row.getAttribute('data-index'), 10);
            if (isNaN(idx)) return;
            e.preventDefault();
            e.stopPropagation();
            showSyncLineContextMenu(e, idx);
        });
    });
}

function loadPastedIntoEditor() {
    const textarea = document.getElementById('sync-editor-paste');
    if (!textarea) return;
    syncEditorState.pasteOpen = false;
    setSyncEditorLinesFromText(textarea.value);
}

function togglePasteArea() {
    syncEditorState.pasteOpen = !syncEditorState.pasteOpen;
    renderSyncEditorLines();
}

function startBlankSyncSession() {
    pushSyncHistory('Start blank');
    syncEditorState.lines = [
        {
            text: '',
            time: null
        }
    ];
    syncEditorState.focusedIndex = 0;
    syncEditorState.pasteOpen = false;
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
    setTimeout(() => editSyncLineText(0), 30);
}

function setSyncEditorLinesFromText(text) {
    pushSyncHistory('Load lyrics');
    const normalized = String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
    const lines = normalized
        .split('\n')
        .filter((t) => t.trim() !== '')
        .map((t) => ({
            text: t,
            time: null
        }));
    syncEditorState.lines = lines;
    syncEditorState.focusedIndex = 0;
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function loadPlainLyricsIntoEditor() {
    const song = getSongById(syncEditorState.songId);
    if (!song) return;
    const plain = getLyricsForSong(song);
    if (!plain || String(plain).trim() === '') {
        showNotification('No plain lyrics available', 'warning', 2000);
        return;
    }
    const stripped = String(plain).replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, '');
    setSyncEditorLinesFromText(stripped);
}

function loadVariantIntoEditor(variantId) {
    const song = getSongById(syncEditorState.songId);
    if (!song) return;
    const entry = getSyncedLyricsVariantsForSong(song);
    if (!entry) return;
    const variant = entry.variants.find((v) => v.id === variantId);
    if (!variant) return;

    const sourceLines = variant.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    const lines = [];
    for (const raw of sourceLines) {
        const parsed = parseLrcLine(raw);
        if (!parsed) continue;
        for (const t of parsed.times) {
            lines.push({
                text: parsed.text,
                time: t,
                instrumental: parsed.instrumental
            });
        }
    }

    lines.sort((a, b) => (a.time || 0) - (b.time || 0));

    syncEditorState.lines = lines;
    syncEditorState.focusedIndex = 0;
    syncEditorState.sourceVariantId = variantId;
    syncEditorState.offset = typeof variant.offset === 'number' ? variant.offset : 0;

    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
}

function importLrcIntoEditor() {
    if (window.electronAPI && window.electronAPI.readLyricsFile) {
        window.electronAPI.readLyricsFile().then((result) => {
            if (!result || !result.success) return;
            applyImportedLrcText(result.contents);
        });
    } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.lrc,text/plain';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => applyImportedLrcText(ev.target.result);
            reader.readAsText(file);
        };
        input.click();
    }
}

function applyImportedLrcText(text) {
    const normalized = String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
    const lines = [];

    for (const raw of normalized.split('\n')) {
        const parsed = parseLrcLine(raw);
        if (!parsed) continue;
        for (const t of parsed.times) {
            lines.push({
                text: parsed.text,
                time: t,
                instrumental: parsed.instrumental
            });
        }
    }

    if (lines.length === 0) {
        showNotification('No valid LRC timestamps found', 'error', 2500);
        return;
    }

    lines.sort((a, b) => (a.time || 0) - (b.time || 0));

    syncEditorState.lines = lines;
    syncEditorState.focusedIndex = 0;
    renderSyncEditorLines();
    updateSyncEditorPreview();
    updateSyncEditorProgress();
    showNotification('Imported ' + lines.length + ' lines', 'success', 2000);
}

registerActions({
    cancelMetadataEditor,
    chooseMetadataCover,
    closeMetadataEditor,
    exportMetadataJson,
    findOnlineMetadata,
    importMetadataJson,
    metadataMultiKeydown,
    removeMetadataValue,
    saveMetadataEditor,
    toggleMetadataMore,
    useOnlineMetadata
});

let metadataEditorSongUrl = null,
    metadataEditorDirty = false,
    metadataEditorCoverPath = '';
// Tags exactly as read from the FILE (not the scanner's shortened copy). Save sends only fields that differ from this.
let metadataEditorBaseline = null,
    metadataEditorLoaded = false;
const ME_MULTI = new Set(['artist', 'albumArtist', 'composer', 'genre', 'conductor', 'remixer', 'musicBrainzArtistId']);
const ME_SECTIONS = [
    [
        'Basic',
        ['title', 'Title'],
        ['artist', 'Artist'],
        ['album', 'Album'],
        ['albumArtist', 'Album Artist'],
        ['genre', 'Genre'],
        ['year', 'Year']
    ],
    [
        'Structure',
        ['track', 'Track Number'],
        ['trackTotal', 'Track Total'],
        ['discNumber', 'Disc Number'],
        ['discTotal', 'Disc Total']
    ],
    [
        'Credits',
        ['composer', 'Composer'],
        ['conductor', 'Conductor'],
        ['remixer', 'Remixer'],
        ['producer', 'Producer'],
        ['writer', 'Writer'],
        ['lyricist', 'Lyricist']
    ],
    [
        'Release',
        ['label', 'Label'],
        ['publisher', 'Publisher'],
        ['copyright', 'Copyright'],
        ['compilation', 'Compilation'],
        ['mediaKind', 'Media Kind']
    ],
    [
        'Additional',
        ['comment', 'Comment'],
        ['grouping', 'Grouping'],
        ['description', 'Description'],
        ['bpm', 'BPM'],
        ['mood', 'Mood'],
        ['language', 'Language']
    ],
    [
        'Sorting',
        ['sortTitle', 'Sort Title'],
        ['sortArtist', 'Sort Artist'],
        ['sortAlbum', 'Sort Album'],
        ['sortComposer', 'Sort Composer']
    ],
    [
        'Identifiers',
        ['isrc', 'ISRC'],
        ['musicBrainzTrackId', 'MusicBrainz Track ID'],
        ['musicBrainzAlbumId', 'MusicBrainz Release ID'],
        ['musicBrainzOriginalAlbumId', 'MusicBrainz Original Release ID'],
        ['musicBrainzReleaseGroupId', 'MusicBrainz Release Group ID'],
        ['musicBrainzArtistId', 'MusicBrainz Artist ID']
    ]
];
const ME_DEFAULT_ON = new Set([
    'title',
    'artist',
    'album',
    'albumArtist',
    'genre',
    'year',
    'track',
    'trackTotal',
    'discNumber',
    'discTotal',
    'composer',
    'conductor',
    'remixer',
    'label',
    'publisher',
    'producer',
    'comment',
    'bpm',
    'isrc',
    'musicBrainzTrackId',
    'musicBrainzAlbumId',
    'musicBrainzOriginalAlbumId'
]);
let metadataEditorMoreOpen = false;
export function metadataEditorSong() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return null;
    const q = playbackQueue[currentQueueIndex];
    return q.song || q;
}
export function metadataEditorTargetSong() {
    // the song being edited, found by URL: playback may have moved on to another track
    if (!metadataEditorSongUrl) return null;
    return (
        SONGS_DATA.find((s) => s.url === metadataEditorSongUrl) ||
        playbackQueue.map((q) => q && (q.song || q)).find((s) => s && s.url === metadataEditorSongUrl) ||
        null
    );
}
export function mdNorm(key, v) {
    // comparable form of a field value
    if (ME_MULTI.has(key)) {
        const a = Array.isArray(v) ? v : v ? [v] : [];
        return a.map((x) => String(x).trim()).filter(Boolean);
    }
    return (Array.isArray(v) ? v.join(', ') : String(v ?? '')).replace(/\r\n?/g, '\n').trim();
}
export function metadataEditorChanges() {
    // patch: only the fields the user actually changed (an empty value means "clear it")
    const cur = collectMetadataEditorValues(),
        out = {};
    for (const key of Object.keys(cur)) {
        if (JSON.stringify(mdNorm(key, cur[key])) !== JSON.stringify(mdNorm(key, (metadataEditorBaseline || {})[key])))
            out[key] = cur[key];
    }
    return out;
}
export function setMetadataEditorLoading(on) {
    // fields stay locked until the real tags have been read from the file
    metadataEditorLoaded = !on;
    const root = getCachedEl('metadata-editor-content');
    if (!root) return;
    root.classList.toggle('is-loading', on);
    root.querySelectorAll(
        '.metadata-editor-fields input,.metadata-editor-fields textarea,.metadata-editor-fields button,.metadata-editor-toolbar-actions button,.metadata-editor-toolbar-actions select,.metadata-cover-box,.metadata-cover-info button'
    ).forEach((x) => (x.disabled = on));
    const b = getCachedEl('metadata-editor-save');
    if (b) b.disabled = on || !metadataEditorDirty;
}
export function applyCoverFile(p, status) {
    const img = getCachedEl('metadata-cover-preview'),
        ph = getCachedEl('metadata-cover-placeholder');
    if (img) {
        img.src = `file://${p.replace(/\\/g, '/')}`;
        img.style.display = 'block';
    }
    if (ph) ph.style.display = 'none';
    if (status) updateCoverStatus(status);
}
export function mdDisplay(v) {
    return Array.isArray(v) ? v.join(', ') : String(v ?? '');
}
export function metadataCoverSource(cover) {
    if (!cover) return '';
    if (typeof cover === 'string') return cover;
    return cover.data ? `data:${cover.mime || 'image/jpeg'};base64,${cover.data}` : '';
}
export function metadataEditorInitialValues(song) {
    const r = {};
    for (const [, ...fields] of ME_SECTIONS)
        for (const [key] of fields) {
            let v = song[key] ?? '';
            r[key] = ME_MULTI.has(key) ? (Array.isArray(v) ? v : v ? [v] : []) : v;
        }
    return r;
}
export function metadataFieldIsVisible(key) {
    return metadataEditorMoreOpen || ME_DEFAULT_ON.has(key);
}
export function markMetadataDirty() {
    metadataEditorDirty = true;
    const b = getCachedEl('metadata-editor-save');
    if (b) b.disabled = !metadataEditorLoaded;
}
export function renderMultiField(key, label, value) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return `<div class="metadata-editor-field"><span>${label}</span><div class="metadata-multi" data-metadata-key="${key}"><div class="metadata-multi-values">${values
        .map(
            (v) =>
                `<span class="metadata-multi-chip">${escapeHtml(
                    String(v)
                )}<button type="button" data-action="removeMetadataValue" data-args='["$this"]'>×</button></span>`
        )
        .join('')}</div><input class="metadata-multi-input" type="text" placeholder="Add ${escapeHtml(
        label.toLowerCase()
    )}…" data-action-keydown="metadataMultiKeydown" data-args-keydown='["$event","$this"]'></div></div>`;
}
export function renderMetadataEditor(m) {
    const root = getCachedEl('metadata-editor-content');
    if (!root) return;
    let html = '';
    for (const [title, ...fields] of ME_SECTIONS) {
        const visible = fields.filter(([key]) => metadataFieldIsVisible(key));
        if (!visible.length) continue;
        html += `<div class="metadata-editor-section"><div class="metadata-editor-section-title">${title}</div>`;
        for (const [key, label] of visible) {
            const v = m[key] ?? '';
            if (ME_MULTI.has(key)) html += renderMultiField(key, label, v);
            else
                html += `<label class="metadata-editor-field"><span>${label}</span>${
                    key === 'comment' || key === 'description'
                        ? `<textarea data-metadata-key="${key}" rows="3">${escapeHtml(String(v))}</textarea>`
                        : `<input data-metadata-key="${key}" type="text" value="${escapeHtml(String(v))}">`
                }</label>`;
        }
        html += '</div>';
    }
    root.innerHTML = `<div class="metadata-editor-toolbar"><button class="metadata-editor-back" data-action="closeMetadataEditor" title="Back to Info"><span class="material-symbols-outlined">arrow_back</span></button><div class="metadata-editor-toolbar-title">Edit metadata</div><div class="metadata-editor-toolbar-actions"><select class="metadata-search-scope" id="metadata-search-scope" title="Online search area"><option value="recording">Song</option><option value="release">Release</option></select><button data-action="findOnlineMetadata" title="Search metadata online"><span class="material-symbols-outlined">search</span> Search</button><button data-action="importMetadataJson" title="Import metadata from JSON">Import</button><button data-action="exportMetadataJson" title="Export metadata to JSON">Export</button></div></div><div id="metadata-online-results" class="metadata-online-results"></div><div class="metadata-editor-top"><button class="metadata-cover-box" id="metadata-cover-box" data-action="chooseMetadataCover" title="Choose or change cover"><span id="metadata-cover-placeholder" class="material-symbols-outlined">album</span><img id="metadata-cover-preview" alt="Cover"></button><div class="metadata-cover-info"><span id="metadata-cover-status">No cover selected</span><button data-action="chooseMetadataCover">Change cover</button></div></div><div class="metadata-editor-fields"><div class="metadata-more-toggle-row"><button class="metadata-more-toggle" data-action="toggleMetadataMore"><span class="material-symbols-outlined">${
        metadataEditorMoreOpen ? 'expand_less' : 'expand_more'
    }</span>${metadataEditorMoreOpen ? 'Hide' : 'More'} metadata tags</button></div>${html}${
        metadataEditorMoreOpen
            ? '<div class="metadata-editor-section metadata-other-section"><div class="metadata-editor-section-title">Other Tags</div><div id="metadata-other-tags" class="metadata-other-tags"><div class="metadata-editor-state">No additional tags.</div></div></div>'
            : ''
    }</div><div class="metadata-editor-actions"><button class="metadata-editor-cancel" data-action="cancelMetadataEditor">Cancel</button><button class="metadata-editor-save" id="metadata-editor-save" data-action="saveMetadataEditor" disabled>Save changes</button></div>`;
    root.querySelectorAll('[data-metadata-key]:not(.metadata-multi)').forEach((x) =>
        x.addEventListener('input', markMetadataDirty)
    );
    applyCoverPreview(m.cover);
}
export async function openMetadataEditor() {
    const song = metadataEditorSong();
    if (!song || !song.url) return;

    metadataEditorSongUrl = song.url;
    metadataEditorDirty = false;
    metadataEditorBaseline = null;
    metadataEditorLoaded = false;
    metadataEditorCoverPath = '';

    switchRightPanelTab('metadata');
    if (!desktopApi.supports('metadata.getAudioMetadata')) {
        renderMetadataEditorError('Tag editing is not available in this environment.');
        return;
    }
    renderMetadataEditor(metadataEditorInitialValues(song));
    setMetadataEditorLoading(true);

    try {
        const result = await desktopApi.metadata.getAudioMetadata(metadataEditorSongUrl);
        if (metadataEditorSongUrl !== song.url) return;
        if (!result?.success) throw new Error(result?.error || 'Failed to read metadata');

        metadataEditorBaseline = result.metadata || {};
        renderMetadataEditor(metadataEditorBaseline);
        setOtherTags(metadataEditorBaseline.otherTags || []);
        setMetadataEditorLoading(false);
        // No embedded picture in the file (e.g. art comes from folder.jpg): keep showing the song's cover
        // instead of claiming there is none.
        const fallbackCover = song.cover || song.largeCover;
        if (!metadataEditorBaseline.cover && fallbackCover) {
            applyCoverPreview(fallbackCover);
            updateCoverStatus('Current cover');
        }
    } catch (error) {
        if (metadataEditorSongUrl !== song.url) return;
        metadataEditorBaseline = null;
        metadataEditorLoaded = false;
        renderMetadataEditorError(
            `Couldn't read the tags from this file, so editing is disabled to avoid overwriting them with incomplete data. (${
                error?.message || error
            })`
        );
        setMetadataEditorLoading(true);
    }
}
export function applyCoverPreview(cover) {
    const img = getCachedEl('metadata-cover-preview'),
        ph = getCachedEl('metadata-cover-placeholder');
    if (!img || !ph) return;
    const src = metadataCoverSource(cover);
    if (src) {
        img.src = src;
        img.style.display = 'block';
        ph.style.display = 'none';
    } else {
        img.removeAttribute('src');
        img.style.display = 'none';
        ph.style.display = 'inline-flex';
    }
}
export function setOtherTags(tags) {
    const box = document.getElementById('metadata-other-tags');
    if (!box) return;
    if (!Array.isArray(tags) || !tags.length) {
        box.innerHTML = '<div class="metadata-editor-state">No additional tags.</div>';
        return;
    }
    box.innerHTML = tags
        .map(
            (x) =>
                `<div class="metadata-other-tag"><code>${escapeHtml(x.key || '')}</code><span>${escapeHtml(
                    (x.values || []).join(' · ')
                )}</span></div>`
        )
        .join('');
}
export function metadataMultiKeydown(e, input) {
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const value = input.value.trim().replace(/,$/, '').trim();
    if (!value) return;
    addMetadataValue(input.parentElement, value);
    input.value = '';
    markMetadataDirty();
}
export function addMetadataValue(container, value) {
    const values = container.querySelector('.metadata-multi-values');
    if ([...values.querySelectorAll('.metadata-multi-chip')].some((x) => x.firstChild?.textContent === value)) return;
    values.insertAdjacentHTML(
        'beforeend',
        `<span class="metadata-multi-chip">${escapeHtml(
            value
        )}<button type="button" data-action="removeMetadataValue" data-args='["$this"]'>×</button></span>`
    );
}
export function removeMetadataValue(btn) {
    btn.parentElement.remove();
    markMetadataDirty();
}
export function getMultiValues(container) {
    return [...container.querySelectorAll('.metadata-multi-chip')]
        .map((x) => x.childNodes[0]?.textContent?.trim())
        .filter(Boolean);
}
export function collectMetadataEditorValues() {
    const r = {};
    document.querySelectorAll('#metadata-editor-content [data-metadata-key]').forEach((x) => {
        if (x.classList.contains('metadata-multi')) r[x.dataset.metadataKey] = getMultiValues(x);
        else r[x.dataset.metadataKey] = x.value;
    });
    return r;
}
export function toggleMetadataMore() {
    // re-render with more/fewer fields WITHOUT losing what the user typed
    const song = metadataEditorTargetSong();
    if (!song) return;
    const typed = metadataEditorLoaded ? collectMetadataEditorValues() : {};
    metadataEditorMoreOpen = !metadataEditorMoreOpen;
    const base = Object.assign(
        {},
        metadataEditorInitialValues(song),
        metadataEditorLoaded ? metadataEditorBaseline || {} : {},
        typed
    );
    renderMetadataEditor(base);
    setMetadataEditorLoading(!metadataEditorLoaded);
    if (metadataEditorLoaded) {
        setOtherTags(metadataEditorBaseline?.otherTags || []);
        if (metadataEditorCoverPath) applyCoverFile(metadataEditorCoverPath, 'Cover selected and ready to save.');
        const b = getCachedEl('metadata-editor-save');
        if (b) b.disabled = !metadataEditorDirty;
    }
}
export function applyMetadataValues(metadata) {
    Object.keys(metadata || {}).forEach((key) => {
        const el = document.querySelector(`#metadata-editor-content [data-metadata-key="${CSS.escape(key)}"]`);
        if (!el) return;
        if (el.classList.contains('metadata-multi')) {
            el.querySelector('.metadata-multi-values').innerHTML = '';
            const values = Array.isArray(metadata[key]) ? metadata[key] : metadata[key] ? [metadata[key]] : [];
            values.forEach((v) => addMetadataValue(el, String(v)));
        } else el.value = mdDisplay(metadata[key]);
    });
    if (metadata?.otherTags) setOtherTags(metadata.otherTags);
    if (metadata?.cover) applyCoverPreview(metadata.cover);
}
export function updateCoverStatus(text) {
    const s = document.getElementById('metadata-cover-status');
    if (s) s.textContent = text;
}

export function renderMetadataEditorError(msg) {
    const r = getCachedEl('metadata-editor-content');
    if (r) r.innerHTML = `<div class="metadata-editor-state">${escapeHtml(msg)}</div>`;
}
export async function saveMetadataEditor() {
    const url = metadataEditorSongUrl;
    if (!url || !metadataEditorLoaded) return;
    const b = getCachedEl('metadata-editor-save');
    const changes = metadataEditorChanges();
    if (!Object.keys(changes).length && !metadataEditorCoverPath) {
        showNotification('No changes to save', 'info', 2500);
        closeMetadataEditor();
        return;
    }
    if (b) {
        b.disabled = true;
        b.textContent = 'Saving…';
    }
    try {
        const r = await desktopApi.metadata.saveAudioMetadata({
            fileUrl: url,
            metadata: changes,
            coverPath: metadataEditorCoverPath
        });
        if (!r?.success) throw new Error(r?.error || 'Failed to save metadata');
        const meta = r.metadata || {};
        // update EVERY in-memory copy of the edited file (library + queue), not whichever song is playing now
        const targets = new Set([
            ...SONGS_DATA.filter((s) => s.url === url),
            ...playbackQueue.map((q) => q && (q.song || q)).filter((s) => s && s.url === url)
        ]);
        const cover = meta.cover?.data ? `data:${meta.cover.mime || 'image/jpeg'};base64,${meta.cover.data}` : null;
        targets.forEach((t) => {
            Object.keys(meta).forEach((k) => {
                if (['cover', 'otherTags'].includes(k)) return;
                t[k] = Array.isArray(meta[k]) ? meta[k].join(', ') : meta[k];
            });
            if (cover) {
                t.cover = cover;
                t.largeCover = cover;
            }
        });
        metadataEditorCoverPath = '';
        metadataEditorDirty = false;
        showNotification('Metadata saved', 'success', 2500);
        if (r.skipped?.length)
            showNotification(
                'Not supported for this file type, so not saved: ' + r.skipped.join(', '),
                'warning',
                5000
            );
        closeMetadataEditor();
        updateAlbumArt();
        // The in-memory song objects above are already updated, but the song list and the
        // left panel's Albums/Artists groups are rendered from a snapshot taken earlier, so
        // without this they kept showing the old title/artist/album/genre until the app was
        // restarted (or something else happened to trigger a re-render).
        onSongsChanged();
        refreshCurrentViewAfterMutation();
    } catch (e) {
        showNotification(e.message || 'Failed to save metadata', 'error', 4000);
        if (b) {
            b.disabled = false;
            b.textContent = 'Save changes';
        }
    }
}
export function cancelMetadataEditor() {
    if (metadataEditorDirty && !window.confirm('Discard unsaved metadata changes?')) return;
    closeMetadataEditor();
}
export function closeMetadataEditor() {
    metadataEditorSongUrl = null;
    metadataEditorDirty = false;
    metadataEditorBaseline = null;
    metadataEditorLoaded = false;
    switchRightPanelTab('tags');
}
export async function exportMetadataJson() {
    if (!metadataEditorSongUrl || !desktopApi.supports('metadata.exportAudioMetadataJson')) return;
    const metadata = collectMetadataEditorValues();
    const r = await desktopApi.metadata.exportAudioMetadataJson({ fileUrl: metadataEditorSongUrl, metadata });
    if (r?.success) showNotification('Metadata exported', 'success', 2500);
    else if (!r?.canceled) showNotification(r?.error || 'Failed to export metadata', 'error', 4000);
}
export async function importMetadataJson() {
    if (!metadataEditorSongUrl || !desktopApi.supports('metadata.importAudioMetadataJson')) return;
    const r = await desktopApi.metadata.importAudioMetadataJson();
    if (!r?.success) {
        if (!r?.canceled) showNotification(r?.error || 'Failed to import metadata', 'error', 4000);
        return;
    }
    applyMetadataValues(r.metadata || {});
    metadataEditorDirty = true;
    const b = getCachedEl('metadata-editor-save');
    if (b) {
        b.disabled = false;
        b.textContent = 'Save changes';
    }
    showNotification('Metadata imported — review and save', 'success', 3000);
}
export function setMetadataFields(metadata) {
    // online import: fill only what the source actually provided, never blank existing values
    const filled = {};
    Object.keys(metadata || {}).forEach((k) => {
        const v = metadata[k];
        const empty = Array.isArray(v) ? !v.length : !String(v ?? '').trim();
        if (!empty) filled[k] = v;
    });
    applyMetadataValues(filled);
    markMetadataDirty();
}
export async function findOnlineMetadata() {
    const song = metadataEditorTargetSong();
    if (!song || !desktopApi.supports('metadata.searchOnlineMetadata')) return;
    const box = getCachedEl('metadata-online-results');
    if (box) box.innerHTML = '<div class="metadata-online-state">Searching MusicBrainz…</div>';
    try {
        const scope = document.getElementById('metadata-search-scope')?.value || 'recording';
        const current = collectMetadataEditorValues();
        const r = await desktopApi.metadata.searchOnlineMetadata({
            fileUrl: metadataEditorSongUrl,
            title: current.title || song.title || '',
            artist: mdDisplay(current.artist) || song.artist || '',
            album: current.album || song.album || '',
            duration: song.duration || '',
            scope
        });
        if (!r?.success) throw new Error(r?.error || 'Online search failed');
        if (!r.results?.length) {
            box.innerHTML = '<div class="metadata-online-state">No MusicBrainz matches found.</div>';
            return;
        }
        box.innerHTML = r.results
            .map((x) => {
                const releases = (x.releases || [])
                    .slice()
                    .sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
                const original = releases[0];
                return `<div class="metadata-online-result-card"><button class="metadata-online-result" ${actionAttrs('useOnlineMetadata', [String(x.releaseGroupId ? '' : x.id), String(x.releaseGroupId ? x.id : original?.id || '')])}><span>${escapeHtml(
                    x.title || 'Untitled'
                )}</span><small>${escapeHtml(x.artist || 'Unknown Artist')}${
                    x.firstReleaseDate ? ' · ' + escapeHtml(x.firstReleaseDate) : ''
                }${original?.title ? ' · Original: ' + escapeHtml(original.title) : ''}</small></button>${
                    releases.length
                        ? `<div class="metadata-online-releases">${releases
                              .map(
                                  (rel) =>
                                      `<button ${actionAttrs('useOnlineMetadata', [String(x.releaseGroupId ? '' : x.id), String(x.releaseGroupId ? x.id : rel.id)])}>${escapeHtml(rel.title || 'Untitled')} · ${escapeHtml(
                                          rel.date || 'date unknown'
                                      )}${rel.country ? ' · ' + escapeHtml(rel.country) : ''}${
                                          original && rel.id === original.id ? ' · Original' : ''
                                      }</button>`
                              )
                              .join('')}</div>`
                        : ''
                }</div>`;
            })
            .join('');
    } catch (e) {
        if (box)
            box.innerHTML = `<div class="metadata-online-state">${escapeHtml(
                e.message || 'Online search failed'
            )}</div>`;
    }
}
export async function useOnlineMetadata(recordingId, releaseId = '') {
    if (!metadataEditorSongUrl || !desktopApi.supports('metadata.getOnlineMetadata')) return;
    const box = getCachedEl('metadata-online-results');
    if (box) box.innerHTML = '<div class="metadata-online-state">Downloading metadata…</div>';
    try {
        const r = await desktopApi.metadata.getOnlineMetadata({
            fileUrl: metadataEditorSongUrl,
            recordingId,
            releaseId,
            title: metadataEditorTargetSong()?.title || ''
        });
        if (!r?.success) throw new Error(r?.error || 'Could not load online metadata');
        setMetadataFields(r.metadata || {});
        if (r.coverPath) {
            metadataEditorCoverPath = r.coverPath;
            const img = getCachedEl('metadata-cover-preview'),
                ph = getCachedEl('metadata-cover-placeholder');
            if (img) {
                img.src = `file://${r.coverPath.replace(/\\/g, '/')}`;
                img.style.display = 'block';
            }
            if (ph) ph.style.display = 'none';
            updateCoverStatus('Online cover downloaded and ready to save.');
        }
        if (box) box.innerHTML = '';
        showNotification('MusicBrainz metadata loaded — review and save', 'success', 3000);
        // Say what happened with the cover instead of failing silently.
        if (!r.coverPath && r.coverStatus === 'none') {
            showNotification('MusicBrainz has no cover art for this release', 'info', 4000);
        } else if (!r.coverPath && r.coverStatus === 'failed') {
            showNotification(`Cover art could not be downloaded${r.coverError ? ` (${r.coverError})` : ''}`, 'warning', 5000);
        }
    } catch (e) {
        if (box)
            box.innerHTML = `<div class="metadata-online-state">${escapeHtml(
                e.message || 'Could not load online metadata'
            )}</div>`;
    }
}
export async function chooseMetadataCover() {
    if (!desktopApi.supports('metadata.chooseCoverImage')) return;
    const r = await desktopApi.metadata.chooseCoverImage();
    if (!r?.success) {
        if (!r?.canceled) showNotification(r?.error || 'Could not choose cover', 'error', 4000);
        return;
    }
    metadataEditorCoverPath = r.imagePath;
    const img = getCachedEl('metadata-cover-preview'),
        ph = getCachedEl('metadata-cover-placeholder');
    if (img) {
        img.src = `file://${r.imagePath.replace(/\\/g, '/')}`;
        img.style.display = 'block';
    }
    if (ph) ph.style.display = 'none';
    updateCoverStatus('Cover selected and ready to save.');
    markMetadataDirty();
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        metadataEditorSong,
        metadataEditorTargetSong,
        mdNorm,
        metadataEditorChanges,
        setMetadataEditorLoading,
        applyCoverFile,
        mdDisplay,
        metadataCoverSource,
        metadataEditorInitialValues,
        metadataFieldIsVisible,
        markMetadataDirty,
        renderMultiField,
        renderMetadataEditor,
        openMetadataEditor,
        applyCoverPreview,
        setOtherTags,
        metadataMultiKeydown,
        addMetadataValue,
        removeMetadataValue,
        getMultiValues,
        collectMetadataEditorValues,
        toggleMetadataMore,
        applyMetadataValues,
        updateCoverStatus,
        renderMetadataEditorError,
        saveMetadataEditor,
        cancelMetadataEditor,
        closeMetadataEditor,
        exportMetadataJson,
        importMetadataJson,
        setMetadataFields,
        findOnlineMetadata,
        useOnlineMetadata,
        chooseMetadataCover
    });
}

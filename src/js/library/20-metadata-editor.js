registerActions({
    cancelMetadataEditor,
    cancelOnlineMetadata,
    chooseMetadataCover,
    closeMetadataEditor,
    exportMetadataJson,
    findOnlineMetadata,
    importMetadataJson,
    metadataMultiKeydown,
    removeMetadataValue,
    saveMetadataEditor,
    setAllMetadataChanges,
    setMetadataSearchScope,
    showMoreOnlineResults,
    showOnlineResults,
    toggleMetadataChange,
    toggleMetadataMore,
    useOnlineMetadata
});

let metadataEditorSongUrl = null,
    metadataEditorDirty = false,
    metadataEditorCoverPath = '';
// Changes the user switched off with their check box ('cover' is the new picture): they stay on the screen but are not saved.
let metadataEditorSkipped = new Set();
// Where the new picture came from: 'online' ones are dropped when another online import brings none, ones the user chose stay.
let metadataEditorCoverFrom = '';
// Tags exactly as read from the FILE (not the scanner's shortened copy). Save sends only fields that differ from this.
let metadataEditorBaseline = null,
    metadataEditorLoaded = false;
const ME_MULTI = new Set(['artist', 'albumArtist', 'composer', 'genre', 'conductor', 'remixer', 'musicBrainzArtistId']);
// One value of a multi-value tag. The new interface (it sets data-ui="next" on <html>) shows all the values of a field inside one text
// box, each as a tag whose text can be edited in place, with the box that adds a new one at the end; the old interface keeps its chips
// exactly as they were.
const metadataValueBoxes = () => document.documentElement.dataset.ui === 'next';
function metadataChipHtml(value, label) {
    const text = escapeHtml(String(value));
    if (!metadataValueBoxes())
        return `<span class="metadata-multi-chip">${text}<button type="button" data-action="removeMetadataValue" data-args='["$this"]'>×</button></span>`;
    const name = escapeHtml(label || 'Value');
    return `<span class="metadata-multi-chip"><input class="metadata-multi-value" type="text" size="${metadataValueSize(value)}" value="${text}" aria-label="${name}"><button type="button" data-action="removeMetadataValue" data-args='["$this"]' aria-label="Remove ${name}">×</button></span>`;
}
const metadataValueSize = (value) => Math.max(1, String(value).length + 1); // the tag is as wide as its text, no script styling needed
const metadataChipValue = (chip) => {
    const box = chip.querySelector('.metadata-multi-value');
    return (box ? box.value : chip.childNodes[0]?.textContent || '').trim();
};
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
// Values for fields that are not on the screen (the "More metadata tags" are closed): an online import still fills them, they are kept here, sent with
// the save and drawn when that section is opened. Before this they were dropped without a word.
let metadataEditorHidden = {};
const ME_KNOWN_KEYS = new Set(ME_SECTIONS.flatMap(([, ...fields]) => fields.map(([key]) => key)));
// The online search: which area, which run is the current one (an older answer is ignored), the answer being shown and how much of it.
let metadataSearchScope = 'recording',
    metadataSearchRun = 0,
    metadataSearchTimer = null,
    metadataOnlineAnswer = null,
    metadataOnlineShown = 5;
const METADATA_ONLINE_PAGE = 5;
// Small cover pictures of the search answers, by release id (a data address; '' when the release has none), kept while the page is open.
const metadataPreviewCache = new Map();
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
export function metadataEditorChanges({ all = false } = {}) {
    // patch: only the fields the user actually changed and left checked (an empty value means "clear it"); all: the unchecked ones too
    const cur = collectMetadataEditorValues(),
        out = {};
    for (const key of Object.keys(cur)) {
        if (!all && metadataEditorSkipped.has(key)) continue;
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
    refreshChangeMarks();
}
// The new picture a save will write: none when it is switched off.
export function metadataEditorCoverUsed() {
    return metadataEditorCoverPath && !metadataEditorSkipped.has('cover') ? metadataEditorCoverPath : '';
}
// What the file shows now (its picture, or the song's cover when the art comes from a folder).
function metadataOriginalCover() {
    const song = metadataEditorTargetSong();
    return metadataEditorBaseline?.cover || song?.cover || song?.largeCover || '';
}
// A new picture from the user or the internet takes over (and is switched on); null drops one of the internet when there is no better.
function setNewCover(path, from) {
    metadataEditorCoverPath = path || '';
    metadataEditorCoverFrom = path ? from : '';
    metadataEditorSkipped.delete('cover');
    const box = document.getElementById('metadata-cover-box');
    if (box) delete box.dataset.shown;
    if (!path) {
        applyCoverPreview(metadataOriginalCover());
        updateCoverStatus('Current cover');
    }
}
// Every field that differs from what the file holds is boxed (with "was: …" and a check box that keeps it out of the save), and so is a new cover, so what a save will change is
// visible at a glance. `pulse`: a field whose value just changed (an online import) flashes once to catch the eye. Returns how many fields differ.
export function refreshChangeMarks({ pulse = false } = {}) {
    const root = document.getElementById('metadata-editor-content');
    if (!root || !metadataEditorBaseline) return { fields: 0, cover: false };
    const now = collectMetadataEditorValues();
    root.querySelectorAll('[data-metadata-key]').forEach((x) => {
        const key = x.dataset.metadataKey;
        const wrap = x.closest('.metadata-editor-field');
        if (!wrap) return;
        const was = mdNorm(key, metadataEditorBaseline[key]);
        const changed = JSON.stringify(mdNorm(key, now[key])) !== JSON.stringify(was);
        const signature = JSON.stringify(now[key]);
        const before = wrap.dataset.sig;
        wrap.dataset.sig = signature;
        if (!changed || (before !== undefined && before !== signature)) metadataEditorSkipped.delete(key); // a new edit or import is wanted
        const skipped = changed && metadataEditorSkipped.has(key);
        wrap.classList.toggle('is-changed', changed);
        wrap.classList.toggle('is-skipped', skipped);
        let check = wrap.querySelector(':scope > .metadata-apply-check');
        if (changed && !check) {
            check = document.createElement('input');
            check.type = 'checkbox';
            check.className = 'metadata-apply-check';
            check.dataset.actionChange = 'toggleMetadataChange';
            check.dataset.argsChange = JSON.stringify([key, '$checked']);
            wrap.append(check);
        } else if (!changed && check) check.remove();
        if (check) {
            check.checked = !skipped;
            const name = wrap.querySelector(':scope > span')?.firstChild?.textContent || key;
            check.title = check.checked ? 'This change will be saved. Uncheck to leave it out.' : 'Left out of the save. Check to save it.';
            check.setAttribute('aria-label', `Save the change to ${name}`);
        }
        const label = wrap.querySelector(':scope > span');
        let note = label && label.querySelector('.metadata-field-was');
        if (changed && label) {
            if (!note) {
                note = document.createElement('small');
                note.className = 'metadata-field-was';
                label.append(note);
            }
            const text = Array.isArray(was) ? was.join(', ') : was;
            note.textContent = text ? `was: ${text.replace(/\s+/g, ' ')}` : 'was empty';
        } else if (note) note.remove();
        if (changed && pulse && before !== signature) {
            wrap.classList.remove('is-fresh');
            void wrap.offsetWidth;
            wrap.classList.add('is-fresh');
            wrap.addEventListener('animationend', () => wrap.classList.remove('is-fresh'), { once: true });
        }
    });
    const hasCover = Boolean(metadataEditorCoverPath);
    const cover = Boolean(metadataEditorCoverUsed());
    const box = document.getElementById('metadata-cover-box');
    const coverCheck = document.getElementById('metadata-cover-apply');
    if (coverCheck) {
        coverCheck.hidden = !hasCover;
        const input = coverCheck.querySelector('input');
        if (input) input.checked = cover;
    }
    if (box) {
        const shown = hasCover && !cover ? 'old' : hasCover ? 'new' : box.dataset.shown;
        if (hasCover && shown !== box.dataset.shown) {
            // the picture follows the check box: the new one when it is on, what the file has now when it is off
            if (cover) applyCoverFile(metadataEditorCoverPath, metadataEditorCoverFrom === 'online' ? 'New cover from MusicBrainz — not saved yet.' : 'New cover — not saved yet.');
            else {
                applyCoverPreview(metadataOriginalCover());
                updateCoverStatus('New cover left out of the save');
            }
            box.dataset.shown = shown;
        }
        box.classList.toggle('is-changed', cover);
        if (cover && pulse) {
            box.classList.remove('is-fresh');
            void box.offsetWidth;
            box.classList.add('is-fresh');
            box.addEventListener('animationend', () => box.classList.remove('is-fresh'), { once: true });
        }
    }
    const fields = Object.keys(metadataEditorChanges()).length;
    const total = Object.keys(metadataEditorChanges({ all: true })).length + (hasCover ? 1 : 0);
    const used = fields + (cover ? 1 : 0);
    const summary = document.getElementById('metadata-editor-changes');
    if (summary) {
        const text = summary.querySelector('.metadata-changes-text');
        const toggle = summary.querySelector('.metadata-changes-toggle');
        if (text) text.textContent = total ? (used === total ? `${total} ${total === 1 ? 'change' : 'changes'} to save` : `${used} of ${total} changes to save`) : '';
        if (toggle) {
            toggle.hidden = total < 2;
            toggle.textContent = used ? 'Uncheck all' : 'Check all';
        }
        summary.hidden = !total;
    }
    return { fields, cover, total };
}
// The check box of one change: off keeps it on the screen but out of the save.
export function toggleMetadataChange(key, checked) {
    if (checked) metadataEditorSkipped.delete(key);
    else metadataEditorSkipped.add(key);
    refreshChangeMarks();
}
// Check or uncheck every change at once (the button in the bar at the bottom: unchecks them all, or checks them all when none is).
export function setAllMetadataChanges() {
    const keys = [...Object.keys(metadataEditorChanges({ all: true })), ...(metadataEditorCoverPath ? ['cover'] : [])];
    const anyOn = keys.some((key) => !metadataEditorSkipped.has(key));
    keys.forEach((key) => (anyOn ? metadataEditorSkipped.add(key) : metadataEditorSkipped.delete(key)));
    refreshChangeMarks();
}
export function renderMultiField(key, label, value) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return `<div class="metadata-editor-field"><span>${label}</span><div class="metadata-multi" data-metadata-key="${key}"><div class="metadata-multi-values">${values
        .map((v) => metadataChipHtml(v, label))
        .join('')}</div><input class="metadata-multi-input" type="text" placeholder="Add ${escapeHtml(
        label.toLowerCase()
    )}…" data-action-keydown="metadataMultiKeydown" data-args-keydown='["$event","$this"]'></div></div>`;
}
function metadataScopeButtons() {
    return [['recording', 'Song'], ['release', 'Release']]
        .map(([scope, text]) => `<button type="button" role="radio" class="metadata-scope-button" aria-checked="${scope === metadataSearchScope}" ${actionAttrs('setMetadataSearchScope', [scope])} title="${scope === 'recording' ? 'Look for this recording' : 'Look for the album it came from'}">${text}</button>`)
        .join('');
}
export function setMetadataSearchScope(scope) {
    metadataSearchScope = scope === 'release' ? 'release' : 'recording';
    document.querySelectorAll('#metadata-editor-content .metadata-scope-button').forEach((button) => {
        const on = JSON.parse(button.dataset.args || '[]')[0] === metadataSearchScope;
        button.setAttribute('aria-checked', String(on));
    });
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
    root.innerHTML = `<div class="metadata-editor-toolbar"><div class="metadata-editor-toolbar-title">Edit metadata</div><div class="metadata-editor-toolbar-actions"><div class="metadata-search-group" role="group" aria-label="Search online"><div class="metadata-search-scope" role="radiogroup" aria-label="Search area">${metadataScopeButtons()}</div><button class="metadata-search-button" id="metadata-search-button" data-action="findOnlineMetadata" title="Search metadata online">Search</button></div><button data-action="importMetadataJson" title="Import metadata from JSON">Import</button><button data-action="exportMetadataJson" title="Export metadata to JSON">Export</button></div></div><div id="metadata-online-results" class="metadata-online-results"></div><div class="metadata-editor-top"><button class="metadata-cover-box" id="metadata-cover-box" data-action="chooseMetadataCover" title="Choose or change cover"><span id="metadata-cover-placeholder" class="material-symbols-outlined">album</span><img id="metadata-cover-preview" alt="Cover"></button><div class="metadata-cover-info"><span id="metadata-cover-status">No cover selected</span><label class="metadata-cover-apply" id="metadata-cover-apply" hidden><input type="checkbox" checked data-action-change="toggleMetadataChange" data-args-change='["cover","$checked"]'><span>Save the new cover</span></label><button data-action="chooseMetadataCover">Change cover</button></div></div><div class="metadata-editor-fields"><div class="metadata-more-toggle-row"><button class="metadata-more-toggle" data-action="toggleMetadataMore"><span class="material-symbols-outlined">${
        metadataEditorMoreOpen ? 'expand_less' : 'expand_more'
    }</span>${metadataEditorMoreOpen ? 'Hide' : 'More'} metadata tags</button></div>${html}${
        metadataEditorMoreOpen
            ? '<div class="metadata-editor-section metadata-other-section"><div class="metadata-editor-section-title">Other Tags</div><div id="metadata-other-tags" class="metadata-other-tags"><div class="metadata-editor-state">No additional tags.</div></div></div>'
            : ''
    }</div><div class="metadata-editor-actions"><span class="metadata-editor-changes" id="metadata-editor-changes" aria-live="polite" hidden><span class="metadata-changes-text"></span><button type="button" class="metadata-changes-toggle" data-action="setAllMetadataChanges" hidden>Uncheck all</button></span><button class="metadata-editor-cancel" data-action="cancelMetadataEditor">Cancel</button><button class="metadata-editor-save" id="metadata-editor-save" data-action="saveMetadataEditor" disabled>Save changes</button></div>`;
    root.querySelectorAll('[data-metadata-key]:not(.metadata-multi)').forEach((x) =>
        x.addEventListener('input', markMetadataDirty)
    );
    // typing in a tag is an edit (and the tag grows or shrinks with its text); typing in the box that adds a value is not, until Enter adds it
    root.querySelectorAll('.metadata-multi').forEach((x) => {
        x.addEventListener('input', (e) => {
            if (!e.target.classList.contains('metadata-multi-value')) return;
            e.target.size = metadataValueSize(e.target.value);
            markMetadataDirty();
        });
        if (!metadataValueBoxes()) return;
        const adder = () => x.querySelector('.metadata-multi-input');
        x.addEventListener('click', (e) => {
            if (e.target === x) adder().focus(); // a press on the empty part of the box goes to the add spot
        });
        x.addEventListener('keydown', (e) => {
            if (!e.target.classList.contains('metadata-multi-value')) return;
            // Enter ends editing a tag; Backspace in an emptied tag removes it (it is removed as focus leaves, below)
            if (e.key === 'Enter' || (e.key === 'Backspace' && !e.target.value)) {
                e.preventDefault();
                adder().focus();
            }
        });
        x.addEventListener('focusout', (e) => {
            if (!e.target.classList.contains('metadata-multi-value') || e.target.value.trim()) return;
            e.target.parentElement?.remove();
            markMetadataDirty();
        });
    });
    metadataEditorClaimHidden(root);
    applyCoverPreview(m.cover);
    refreshChangeMarks();
}
export async function openMetadataEditor() {
    const song = metadataEditorSong();
    if (!song || !song.url) return;

    metadataEditorSongUrl = song.url;
    metadataEditorDirty = false;
    metadataEditorBaseline = null;
    metadataEditorLoaded = false;
    metadataEditorCoverPath = '';
    metadataEditorCoverFrom = '';
    metadataEditorSkipped = new Set();
    metadataEditorHidden = {};
    cancelOnlineMetadata();

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
    if ([...values.querySelectorAll('.metadata-multi-chip')].some((x) => metadataChipValue(x) === value)) return;
    const label = container.closest('.metadata-editor-field')?.querySelector(':scope > span')?.textContent;
    values.insertAdjacentHTML('beforeend', metadataChipHtml(value, label));
}
export function removeMetadataValue(btn) {
    btn.parentElement.remove();
    markMetadataDirty();
}
export function getMultiValues(container) {
    return [...container.querySelectorAll('.metadata-multi-chip')].map(metadataChipValue).filter(Boolean);
}
export function collectMetadataEditorValues() {
    const r = {};
    document.querySelectorAll('#metadata-editor-content [data-metadata-key]').forEach((x) => {
        if (x.classList.contains('metadata-multi')) r[x.dataset.metadataKey] = getMultiValues(x);
        else r[x.dataset.metadataKey] = x.value;
    });
    for (const key of Object.keys(metadataEditorHidden)) if (!(key in r)) r[key] = metadataEditorHidden[key];
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
        refreshChangeMarks(); // draws the new picture (or the old one, when it is switched off) again
        const b = getCachedEl('metadata-editor-save');
        if (b) b.disabled = !metadataEditorDirty;
    }
}
export function applyMetadataValues(metadata) {
    Object.keys(metadata || {}).forEach((key) => {
        const el = document.querySelector(`#metadata-editor-content [data-metadata-key="${CSS.escape(key)}"]`);
        if (!el) {
            if (ME_KNOWN_KEYS.has(key)) metadataEditorHidden[key] = metadata[key]; // a field of the closed "More" section
            return;
        }
        if (el.classList.contains('metadata-multi')) {
            el.querySelector('.metadata-multi-values').innerHTML = '';
            const values = Array.isArray(metadata[key]) ? metadata[key] : metadata[key] ? [metadata[key]] : [];
            values.forEach((v) => addMetadataValue(el, String(v)));
        } else el.value = mdDisplay(metadata[key]);
    });
    if (metadata?.otherTags) setOtherTags(metadata.otherTags);
    if (metadata?.cover) applyCoverPreview(metadata.cover);
}
// What is on screen now takes over the values that were waiting for their fields (a render with the "More" section open draws them).
function metadataEditorClaimHidden(root) {
    for (const key of Object.keys(metadataEditorHidden)) if (root.querySelector(`[data-metadata-key="${CSS.escape(key)}"]`)) delete metadataEditorHidden[key];
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
    const coverPath = metadataEditorCoverUsed();
    if (!Object.keys(changes).length && !coverPath) {
        showNotification('Nothing is checked to save', 'info', 2500);
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
            coverPath
        });
        if (!r?.success) throw new Error(r?.error || 'Failed to save metadata');
        const meta = r.metadata || {};
        // update EVERY in-memory copy of the edited file (library + queue), not whichever song is playing now
        const targets = new Set([
            ...SONGS_DATA.filter((s) => s.url === url),
            ...playbackQueue.map((q) => q && (q.song || q)).filter((s) => s && s.url === url)
        ]);
        // A new cover: the main process saved it into the library's covers folder and says where (r.library); that is what a restart will
        // show, so the page shows the same. The embedded picture as a data address is only the fallback when that could not be saved.
        const embedded = coverPath && meta.cover?.data ? `data:${meta.cover.mime || 'image/jpeg'};base64,${meta.cover.data}` : null;
        const saved = coverPath ? r.library : null;
        targets.forEach((t) => {
            Object.keys(meta).forEach((k) => {
                if (['cover', 'otherTags'].includes(k)) return;
                // Several artists or genres are ONE text split on ';' (the Artists/Albums groups split on it); a ', ' would make one artist of them.
                t[k] = Array.isArray(meta[k]) ? meta[k].join('; ') : meta[k];
            });
            if (saved?.largeCover) {
                t.cover = saved.cover || saved.largeCover;
                t.largeCover = saved.largeCover;
            } else if (embedded) {
                t.cover = embedded;
                t.largeCover = embedded;
            }
        });
        metadataEditorCoverPath = '';
        metadataEditorCoverFrom = '';
        metadataEditorSkipped = new Set();
        metadataEditorDirty = false;
        metadataEditorHidden = {};
        showNotification('Metadata saved', 'success', 2500);
        if (r.skipped?.length)
            showNotification(
                'Not supported for this file type, so not saved: ' + r.skipped.join(', '),
                'warning',
                5000
            );
        refreshPlayingSongView(); // the player bar and the track panel too, when this is the song that is playing
        // The in-memory song objects above are already updated, but the song list and the
        // left panel's Albums/Artists groups are rendered from a snapshot taken earlier, so
        // without this they kept showing the old title/artist/album/genre until the app was
        // restarted (or something else happened to trigger a re-render).
        onSongsChanged();
        refreshCurrentViewAfterMutation();
        // The person stays in the editor: it is read again from the file, so it shows what was written (a close would send them back to another page).
        if (metadataEditorSongUrl === url) await openMetadataEditor();
    } catch (e) {
        showNotification(e.message || 'Failed to save metadata', 'error', 4000);
        if (b) {
            b.disabled = false;
            b.textContent = 'Save changes';
        }
    }
}
// The app's own box (the one Sync uses for "Discard Sync?"), answering true to discard and false to keep editing.
export function askDiscardMetadata(message = 'Your changes to this song\'s tags and cover have not been saved.') {
    return showConfirmDialog({ title: 'Discard changes?', message, okText: 'Discard', cancelText: 'Keep editing' });
}
export async function cancelMetadataEditor() {
    if (metadataEditorDirty && !(await askDiscardMetadata())) return;
    closeMetadataEditor();
}
export function closeMetadataEditor() {
    cancelOnlineMetadata();
    metadataEditorHidden = {};
    metadataEditorSkipped = new Set();
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
const onlineBox = () => document.getElementById('metadata-online-results');
const onlineLength = (ms) => {
    const total = Math.round(Number(ms) / 1000);
    return total > 0 ? `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}` : '';
};
function setSearchBusy(on) {
    const button = document.getElementById('metadata-search-button');
    if (!button) return;
    button.disabled = on || !metadataEditorLoaded;
    button.classList.toggle('is-busy', on);
    button.textContent = on ? 'Searching…' : 'Search';
}
function clearSearchTimer() {
    clearTimeout(metadataSearchTimer);
    metadataSearchTimer = null;
}
// Something is going on: a spinner, a moving bar and the words for it (nothing is drawn where the answers will be until they are there).
function renderOnlineBusy(title) {
    const box = onlineBox();
    if (!box) return;
    box.innerHTML = `<div class="metadata-online-panel is-busy" role="status" aria-live="polite"><div class="metadata-online-head"><span class="metadata-online-spinner" aria-hidden="true"></span><strong>${escapeHtml(title)}</strong><button type="button" class="metadata-online-close" data-action="cancelOnlineMetadata">Cancel</button></div><div class="metadata-online-bar" role="progressbar" aria-label="${escapeHtml(title)}"><i></i></div><p class="metadata-online-hint" hidden>MusicBrainz allows about one request a second, so a search can take a few seconds.</p></div>`;
    clearSearchTimer();
    const run = metadataSearchRun;
    metadataSearchTimer = setTimeout(() => {
        const hint = run === metadataSearchRun ? box.querySelector('.metadata-online-hint') : null;
        if (hint) hint.hidden = false;
    }, 3500);
}
function renderOnlineMessage(text, { retry = false, tone = '' } = {}) {
    const box = onlineBox();
    if (!box) return;
    box.innerHTML = `<div class="metadata-online-panel ${tone ? 'is-' + tone : ''}" role="status"><div class="metadata-online-head"><strong>${escapeHtml(text)}</strong>${
        retry ? '<button type="button" class="metadata-online-retry" data-action="findOnlineMetadata">Try again</button>' : ''
    }<button type="button" class="metadata-online-close" data-action="cancelOnlineMetadata">Close</button></div></div>`;
}
// One answer of the search as a card: how well it fits, what it is, and the button that takes it (the ranked release; the others are under it).
function onlineResultCard(x, answer, position) {
    const isRelease = x.releaseGroupId !== undefined;
    const releases = (x.releases || []).slice().sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
    const original = releases.find((rel) => rel.id === x.recommendedReleaseId) || releases[0]; // the ranked pick (electron/release-rank.js); the earliest date when the search sent none
    const args = (releaseId) => [String(isRelease ? '' : x.id), String(isRelease ? x.id : releaseId || '')];
    const meta = [x.artist || 'Unknown artist', isRelease ? x.date || x.firstReleaseDate : x.firstReleaseDate, onlineLength(x.length), x.country, x.disambiguation].filter(Boolean).map(escapeHtml);
    const fit = typeof x.match === 'number' ? Math.round(x.match * 100) : null;
    const why = [...(x.matchReasons || [])];
    if (answer.recommended && answer.recommended.id === (isRelease ? x.id : original?.id)) why.push('likely original release');
    const score = fit === null ? '' : `<div class="metadata-online-score" data-fit="${fit >= 75 ? 'high' : fit >= 50 ? 'mid' : 'low'}" title="How well this fits your file: MusicBrainz's own score, the title, the artist and the length"><b>${fit}</b><small>%</small></div>`;
    const list = releases.length
        ? `<details class="metadata-online-more"><summary>${releases.length} ${releases.length === 1 ? 'release' : 'releases'}${original?.title ? ' · original: ' + escapeHtml(original.title) : ''}</summary><div class="metadata-online-releases">${releases
              .map((rel) => `<button type="button" ${actionAttrs('useOnlineMetadata', args(rel.id))}>${escapeHtml(rel.title || 'Untitled')} · ${escapeHtml(rel.date || 'date unknown')}${rel.country ? ' · ' + escapeHtml(rel.country) : ''}${original && rel.id === original.id ? ' · Original' : ''}</button>`)
              .join('')}</div></details>`
        : '';
    const best = x.isBest || (position === 0 && answer.results.length === 1) ? 'is-best' : '';
    const previewId = String(isRelease ? x.id : original?.id || '');
    const known = metadataPreviewCache.get(previewId);
    const art = known ? `<img class="metadata-online-art" src="${escapeHtml(known)}" alt="">` : '';
    const wants = previewId && known === undefined ? ` data-release="${escapeHtml(previewId)}" data-group="${escapeHtml(x.releaseGroupId || '')}"` : '';
    return `<div class="metadata-online-result-card ${best}"${wants}><div class="metadata-online-main">${art}${score}<div class="metadata-online-text"><span class="metadata-online-title">${escapeHtml(x.title || 'Untitled')}${
        x.isBest ? '<em class="metadata-online-best">Best match</em>' : ''
    }</span><small class="metadata-online-meta">${meta.join(' · ')}</small>${why.length ? `<small class="metadata-online-why">${escapeHtml(why.join(' · '))}</small>` : ''}</div><button type="button" class="metadata-online-use" ${actionAttrs('useOnlineMetadata', args(original?.id))}>Use this</button></div>${list}</div>`;
}
function renderOnlineResults(note = '') {
    const box = onlineBox();
    const answer = metadataOnlineAnswer;
    if (!box || !answer) return;
    const shown = answer.results.slice(0, metadataOnlineShown);
    const rest = answer.results.length - shown.length;
    box.innerHTML = `<div class="metadata-online-panel"><div class="metadata-online-head"><strong>${answer.results.length} ${answer.results.length === 1 ? 'match' : 'matches'}</strong><span class="metadata-online-sub">best first, by MusicBrainz's score and how well they fit this file</span><button type="button" class="metadata-online-close" data-action="cancelOnlineMetadata">Close</button></div>${
        note ? `<p class="metadata-online-error" role="alert">${escapeHtml(note)}</p>` : ''
    }<div class="metadata-online-list">${shown.map((x, i) => onlineResultCard(x, answer, i)).join('')}</div>${
        rest > 0 ? `<button type="button" class="metadata-online-showmore" data-action="showMoreOnlineResults">Show ${rest} more</button>` : ''
    }</div>`;
    loadOnlinePreviews();
}
// Fetch the small cover of each card that has none yet (two at a time, in the main process: the page may not load web pictures). A card with no
// cover found simply stays as it is, with nothing drawn for it.
async function loadOnlinePreviews() {
    if (!desktopApi.supports('metadata.getOnlineCoverPreview')) return;
    const run = metadataSearchRun;
    const cards = [...(onlineBox()?.querySelectorAll('.metadata-online-result-card[data-release]') || [])];
    let next = 0;
    const worker = async () => {
        while (next < cards.length && run === metadataSearchRun) {
            const card = cards[next++];
            const id = card.dataset.release;
            let dataUrl = '';
            try {
                const r = await desktopApi.metadata.getOnlineCoverPreview({ releaseId: id, releaseGroupId: card.dataset.group || '' });
                if (r?.success && typeof r.dataUrl === 'string' && r.dataUrl.startsWith('data:image/')) dataUrl = r.dataUrl;
            } catch (_) { /* no picture for this one */ }
            if (run !== metadataSearchRun) return;
            metadataPreviewCache.set(id, dataUrl);
            const main = card.isConnected && !card.querySelector('.metadata-online-art') ? card.querySelector('.metadata-online-main') : null;
            if (!dataUrl || !main) continue;
            const img = document.createElement('img');
            img.className = 'metadata-online-art';
            img.alt = '';
            img.src = dataUrl;
            main.prepend(img);
        }
    };
    await Promise.all([worker(), worker()]);
}
export function showMoreOnlineResults() {
    metadataOnlineShown += METADATA_ONLINE_PAGE;
    renderOnlineResults();
}
export function showOnlineResults() {
    if (metadataOnlineAnswer) renderOnlineResults();
}
export function cancelOnlineMetadata() {
    metadataSearchRun++; // an answer still on its way is ignored
    clearSearchTimer();
    metadataOnlineAnswer = null;
    metadataOnlineShown = METADATA_ONLINE_PAGE;
    setSearchBusy(false);
    const box = onlineBox();
    if (box) box.innerHTML = '';
}
export async function findOnlineMetadata() {
    const song = metadataEditorTargetSong();
    if (!song || !metadataEditorLoaded || !desktopApi.supports('metadata.searchOnlineMetadata')) return;
    const run = ++metadataSearchRun;
    metadataOnlineAnswer = null;
    metadataOnlineShown = METADATA_ONLINE_PAGE;
    setSearchBusy(true);
    renderOnlineBusy(metadataSearchScope === 'release' ? 'Looking for the album on MusicBrainz…' : 'Looking for the song on MusicBrainz…');
    try {
        const current = collectMetadataEditorValues();
        const r = await desktopApi.metadata.searchOnlineMetadata({
            fileUrl: metadataEditorSongUrl,
            title: current.title || song.title || '',
            artist: mdDisplay(current.artist) || song.artist || '',
            album: current.album || song.album || '',
            duration: song.duration || '',
            scope: metadataSearchScope
        });
        if (run !== metadataSearchRun || !metadataEditorSongUrl) return;
        if (!r?.success) throw new Error(r?.error || 'Online search failed');
        if (!r.results?.length) {
            renderOnlineMessage('No MusicBrainz match. Check the title and artist above, or try searching by Release.', { tone: 'empty' });
        } else {
            metadataOnlineAnswer = r;
            renderOnlineResults();
        }
    } catch (e) {
        if (run === metadataSearchRun) renderOnlineMessage(e.message || 'Online search failed', { retry: true, tone: 'error' });
    } finally {
        if (run === metadataSearchRun) {
            clearSearchTimer();
            setSearchBusy(false);
        }
    }
}
export async function useOnlineMetadata(recordingId, releaseId = '') {
    if (!metadataEditorSongUrl || !desktopApi.supports('metadata.getOnlineMetadata')) return;
    const run = ++metadataSearchRun;
    renderOnlineBusy('Getting the metadata and the cover…');
    try {
        const r = await desktopApi.metadata.getOnlineMetadata({
            fileUrl: metadataEditorSongUrl,
            recordingId,
            releaseId,
            title: metadataEditorTargetSong()?.title || ''
        });
        if (run !== metadataSearchRun || !metadataEditorSongUrl) return;
        if (!r?.success) throw new Error(r?.error || 'Could not load online metadata');
        setMetadataFields(r.metadata || {});
        if (r.coverPath) setNewCover(r.coverPath, 'online');
        else if (metadataEditorCoverFrom === 'online') setNewCover('', ''); // the cover of the release imported before does not belong to this one
        // Tags of the closed "More" section that the import filled: the section opens so each of them is on the screen with its own check box.
        if (!metadataEditorMoreOpen && Object.keys(metadataEditorHidden).some((key) => JSON.stringify(mdNorm(key, metadataEditorHidden[key])) !== JSON.stringify(mdNorm(key, (metadataEditorBaseline || {})[key])))) toggleMetadataMore();
        const marks = refreshChangeMarks({ pulse: true });
        const coverNote = r.coverPath ? 'new cover' : r.coverStatus === 'none' ? 'MusicBrainz has no cover for this release' : r.coverStatus === 'failed' ? `cover not downloaded${r.coverError ? ' (' + r.coverError + ')' : ''}` : '';
        const box = onlineBox();
        if (box)
            box.innerHTML = `<div class="metadata-online-panel is-done" role="status"><div class="metadata-online-head"><span class="metadata-online-tick" aria-hidden="true"></span><strong>Loaded${r.metadata?.title ? ' “' + escapeHtml(r.metadata.title) + '”' : ''}</strong>${
                metadataOnlineAnswer ? '<button type="button" class="metadata-online-retry" data-action="showOnlineResults">Other results</button>' : ''
            }<button type="button" class="metadata-online-close" data-action="cancelOnlineMetadata">Close</button></div><p class="metadata-online-sub">${marks.fields} ${marks.fields === 1 ? 'field' : 'fields'} changed${
                coverNote ? ' · ' + escapeHtml(coverNote) : ''
            }. They are boxed below: uncheck any you do not want. Nothing is saved until you press Save changes.</p></div>`;
        if (!r.coverPath && r.coverStatus === 'failed') showNotification(`Cover art could not be downloaded${r.coverError ? ` (${r.coverError})` : ''}`, 'warning', 5000);
    } catch (e) {
        if (run !== metadataSearchRun) return;
        if (metadataOnlineAnswer) renderOnlineResults(e.message || 'Could not load online metadata');
        else renderOnlineMessage(e.message || 'Could not load online metadata', { tone: 'error' });
    }
}
export async function chooseMetadataCover() {
    if (!desktopApi.supports('metadata.chooseCoverImage')) return;
    const r = await desktopApi.metadata.chooseCoverImage();
    if (!r?.success) {
        if (!r?.canceled) showNotification(r?.error || 'Could not choose cover', 'error', 4000);
        return;
    }
    setNewCover(r.imagePath, 'user');
    applyCoverFile(r.imagePath, 'New cover — not saved yet.');
    markMetadataDirty();
    refreshChangeMarks({ pulse: true });
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        metadataEditorChanges,
        openMetadataEditor,
        metadataMultiKeydown,
        removeMetadataValue,
        toggleMetadataMore,
        saveMetadataEditor,
        cancelMetadataEditor,
        cancelOnlineMetadata,
        setMetadataSearchScope,
        setAllMetadataChanges,
        askDiscardMetadata,
        toggleMetadataChange,
        showMoreOnlineResults,
        showOnlineResults,
        refreshChangeMarks,
        closeMetadataEditor,
        exportMetadataJson,
        importMetadataJson,
        setMetadataFields,
        findOnlineMetadata,
        useOnlineMetadata,
        chooseMetadataCover
    });
}

// The Batch page of the Lyrics tool (finds lyrics for many songs at once). The engine keeps the state and does the searching
// (js/lyrics/19-online-lyrics.js); this page draws it.
//
//   top      "Add songs from…" (a playlist, album, artist, the queue, the search results, the selected songs: the same sources as the tag
//            sheet) and a filter for the list
//   card     the list: every added song is in it, drawn virtually (only the rows in view exist), with select-all and remove above it
//   bottom   what to find (synced lyrics or plain), skip songs that have it, the progress, Stop and the one Find button
// Nothing is listed until songs are added: a whole library would be a long list that says nothing.

import { el, button, tabs, emptyState } from '../../components/index.js';
import { engineAction, engineCall, engineEvent } from '../../adapter/engine-api.js';
import { sources, loadSource } from '../../adapter/tag-sheet-bridge.js';
import { defaultCover } from '../../adapter/default-cover.js';
import { notify } from '../../shell/notify.js';

export const ROW_HEIGHT = 56;
const OVERSCAN = 6;
const STATUS = {
    lrc: 'Synced lyrics found',
    lyrics: 'Lyrics found',
    instrumental: 'Instrumental',
    missing: 'Not found',
    has: 'Already has lyrics'
};
const GROUPS = [['Now', 'now'], ['Library', 'library'], ['Playlists', 'playlist'], ['Albums', 'album'], ['Artists', 'artist']];

/** Which rows exist for a scroll position: a few above and below the ones in view. Pure, for the tests. */
export function visibleRange(scrollTop, height, total, rowHeight = ROW_HEIGHT, overscan = OVERSCAN) {
    const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const last = Math.min(total, Math.ceil((scrollTop + height) / rowHeight) + overscan);
    return { first, count: Math.max(0, last - first) };
}

function cover(src) {
    const fallback = defaultCover('song');
    const image = el('img', { src: src || fallback, alt: '', loading: 'lazy', draggable: 'false' });
    image.addEventListener('error', () => image.getAttribute('src') !== fallback && image.setAttribute('src', fallback));
    return el('span', { class: 'many-row__cover' }, image);
}

/** Draws the page into `host` (replacing what was there). Returns a function that stops it. */
export function mountManySongs(host) {
    engineAction('setSmartLyricsExternalView', true); // from now on the engine keeps the state only; it never draws this page itself
    host.replaceChildren();

    const info = () => engineCall('getSmartLyricsFinderInfo') || { mode: 'lrc', skipExisting: true, processing: false, status: '', query: '', selected: 0, selectedIds: [], listed: 0, shown: 0 };

    // ---- top
    const load = el('select', { class: 'many-source', 'aria-label': 'Add songs from', onchange: (event) => addFrom(event.target) });
    const search = el('input', { class: 'many-search', type: 'search', placeholder: 'Filter the list', 'aria-label': 'Filter the list', oninput: (event) => engineAction('handleSmartLyricsFinderSearch', event.target.value) });
    const count = el('span', { class: 'many-count' });
    const top = el('div', { class: 'many-top' }, load, search, count);

    // ---- the card: select all / remove above the list
    const all = el('input', { type: 'checkbox', class: 'many-all', 'aria-label': 'Select every song in the list', onchange: (event) => engineAction(event.target.checked ? 'selectAllSmartLyricsSongs' : 'clearSmartLyricsSelection') });
    const selectedText = el('span', { class: 'many-selected' });
    const removeSelected = button({ label: 'Remove selected', variant: 'ghost', size: 'sm', onClick: () => engineCall('removeSmartLyricsFinderSongs', info().selectedIds) });
    const clearList = button({ label: 'Clear list', variant: 'ghost', size: 'sm', onClick: () => engineAction('clearSmartLyricsFinderList') });
    const bar = el('div', { class: 'many-card__bar' }, el('label', { class: 'many-card__all' }, all, selectedText), el('span', { class: 'many-spacer' }), removeSelected, clearList);
    const spacer = el('div', { class: 'many-list__spacer' });
    const viewport = el('div', { class: 'many-list', tabindex: '0', role: 'list', 'aria-label': 'Songs to find lyrics for' }, spacer);
    const emptyBox = el('div', { class: 'many-empty' }, emptyState({ icon: 'list-music', title: 'No songs yet', text: 'Use "Add songs from…" to load a playlist, an album, an artist or the queue, then find their lyrics.' }));
    const card = el('div', { class: 'many-card' }, bar, el('div', { class: 'many-card__body' }, viewport, emptyBox));

    // ---- bottom
    const mode = tabs({ label: 'Find', value: 'lrc', items: [{ id: 'lrc', label: 'Synced lyrics' }, { id: 'lyrics', label: 'Plain lyrics' }], onChange: (value) => engineAction('setSmartLyricsMode', value) });
    const skip = el('input', { type: 'checkbox', checked: true, onchange: (event) => engineAction('toggleSmartLyricsSkipExisting', event.target.checked) });
    const status = el('span', { class: 'many-status', role: 'status' });
    const stop = button({ label: 'Stop', onClick: () => engineAction('stopSmartLyricsFinder') });
    stop.hidden = true;
    const run = button({ label: 'Find lyrics', variant: 'primary', onClick: () => engineAction('runSmartLyricsFinder') });
    const bottom = el('div', { class: 'many-bottom' }, mode.el, el('label', { class: 'many-skip' }, skip, 'Skip songs that already have it'), status, stop, run);

    host.append(el('div', { class: 'many' }, top, card, bottom));

    // ---- sources
    function fillSources() {
        const list = sources();
        load.replaceChildren(el('option', { value: '' }, '+  Add songs from\u2026'));
        for (const [label, id] of GROUPS) {
            const items = list.filter((s) => s.group === id);
            if (items.length) load.append(el('optgroup', { label }, items.map((s) => el('option', { value: s.id }, s.label))));
        }
    }

    function addFrom(select) {
        const id = select.value;
        select.value = '';
        if (!id) return;
        const added = engineCall('addSmartLyricsFinderSongs', loadSource(id).map((song) => song.id)) || 0;
        notify({ title: added ? `Added ${added} song${added === 1 ? '' : 's'}` : 'Those songs are already in the list', kind: added ? 'success' : 'info', where: 'toast' });
    }

    // ---- the list, drawn virtually: the spacer has the height of the whole list, only the rows in view exist
    let total = 0;
    let shape = '';
    const nodes = new Map(); // song id -> its row

    function build(row) {
        const check = el('input', { type: 'checkbox', class: 'many-row__check', tabindex: '-1', 'aria-hidden': 'true' });
        const node = el(
            'div',
            { class: 'many-row', role: 'listitem' },
            check,
            cover(row.cover),
            el('span', { class: 'many-row__text' }, el('span', { class: 'many-row__title', dir: 'auto' }, row.title || 'Unknown title'), el('span', { class: 'many-row__sub', dir: 'auto' }, [row.artist, row.album].filter(Boolean).join(' \u00B7 '))),
            el('span', { class: 'many-row__state' })
        );
        node.addEventListener('click', () => engineAction('toggleSmartLyricsSong', row.id));
        return node;
    }

    function place(node, row, index) {
        node.style.transform = `translateY(${index * ROW_HEIGHT}px)`;
        node.setAttribute('aria-selected', String(row.selected));
        node.dataset.status = row.status || 'none';
        node.querySelector('.many-row__check').checked = row.selected;
        const state = node.querySelector('.many-row__state');
        state.textContent = STATUS[row.status] || '';
        state.title = row.error || '';
    }

    function drawRows() {
        const { first, count: wanted } = visibleRange(viewport.scrollTop, viewport.clientHeight || 480, total);
        const rows = wanted ? engineCall('getSmartLyricsFinderRows', first, wanted) || [] : [];
        const keep = new Set();
        rows.forEach((row, i) => {
            const key = String(row.id);
            keep.add(key);
            let node = nodes.get(key);
            if (!node) {
                node = build(row);
                nodes.set(key, node);
                spacer.append(node);
            }
            place(node, row, first + i);
        });
        for (const [key, node] of nodes) {
            if (keep.has(key)) continue;
            node.remove();
            nodes.delete(key);
        }
    }

    let frame = 0;
    const schedule = () => {
        if (!frame) frame = requestAnimationFrame(() => ((frame = 0), drawRows()));
    };
    viewport.addEventListener('scroll', schedule, { passive: true });
    const resizer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    resizer?.observe(viewport);

    function paint() {
        const now = info();
        const busy = now.processing;
        total = now.shown;
        mode.setValue(now.mode);
        skip.checked = now.skipExisting;
        for (const node of [load, skip, all, removeSelected, clearList]) node.disabled = busy;
        for (const tab of mode.el.querySelectorAll('button')) tab.disabled = busy;
        all.checked = total > 0 && now.selected >= total;
        all.indeterminate = now.selected > 0 && now.selected < total;
        removeSelected.disabled = busy || now.selected === 0;
        clearList.disabled = busy || now.listed === 0;
        run.disabled = busy || now.selected === 0;
        run.textContent = now.selected ? `Find lyrics for ${now.selected} song${now.selected === 1 ? '' : 's'}` : 'Find lyrics';
        stop.hidden = !busy;
        count.textContent = now.listed ? `${now.listed} song${now.listed === 1 ? '' : 's'}${now.shown !== now.listed ? `, ${now.shown} shown` : ''}` : '';
        selectedText.textContent = now.selected ? `${now.selected} selected` : 'Select all';
        status.textContent = now.status;
        bar.hidden = now.listed === 0;
        emptyBox.hidden = now.listed !== 0;
        viewport.hidden = now.listed === 0;
        spacer.style.height = `${total * ROW_HEIGHT}px`;
        const next = `${now.listed}|${now.shown}|${now.query}|${now.mode}`;
        if (next !== shape) {
            shape = next;
            for (const node of nodes.values()) node.remove();
            nodes.clear();
            viewport.scrollTop = Math.min(viewport.scrollTop, Math.max(0, total * ROW_HEIGHT - viewport.clientHeight));
        }
        drawRows();
    }

    fillSources();
    paint();
    const offs = ['smartLyrics:changed', 'smartLyrics:progress'].map((name) => engineEvent(name, () => (host.isConnected ? paint() : stopAll())));
    function stopAll() {
        offs.forEach((off) => off());
        resizer?.disconnect();
        if (frame) cancelAnimationFrame(frame);
        nodes.clear();
    }
    return stopAll;
}

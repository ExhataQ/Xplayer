// The Batch page of the Lyrics tool (finds lyrics for many songs at once). The engine keeps the state and does the searching
// (js/lyrics/19-online-lyrics.js); this page draws it.
//
//   head     the page's title, the same header as Find
//   top      "Add songs from…" (a playlist, album, artist, the queue, the search results, the selected songs: the same sources as the tag
//            sheet) and a filter for the list
//   groups   the songs by the lyrics they have now: none, synced, plain, instrumental, with how many are in each; one picked shows only those
//            (so "No lyrics", then select all, is the way to find lyrics for just the songs that lack them)
//   card     the list: every added song is in it, drawn virtually (only the rows in view exist), with select-all and remove above it, and a column
//            header (Title, Album, Lyrics now, Result) that sticks to the top of the list; the two right columns are resized from it, like the song list's
//   bottom   what to find (synced lyrics or plain), skip songs that have it, the progress, Stop and the one Find button
// Nothing is listed until songs are added: a whole library would be a long list that says nothing.

import { el, button, tabs, emptyState, chipGroup } from '../../components/index.js';
import { engineAction, engineCall, engineEvent } from '../../adapter/engine-api.js';
import { sources, loadSource } from '../../adapter/tag-sheet-bridge.js';
import { defaultCover } from '../../adapter/default-cover.js';
import { notify } from '../../shell/notify.js';
import { sourceButton } from './source-picker.js';

export const ROW_HEIGHT = 56;
export const HEAD_HEIGHT = 36;
const OVERSCAN = 6;
const STORE_KEY = 'xplayer.ui-next.lyrics-many';
const KEY_STEP = 8;
/** The two columns the person can resize (px). The Title takes whatever is left. */
export const COLUMNS = { album: { min: 80, max: 360, fallback: 170 }, have: { min: 96, max: 320, fallback: 150 }, state: { min: 104, max: 300, fallback: 170 } };
// What a run found for a song (the row shows it after the badges of what the song has).
const STATUS = {
    lrc: 'Synced lyrics found',
    lyrics: 'Lyrics found',
    instrumental: 'Instrumental',
    missing: 'Not found'
};

/** The badges of what a song has: [{ key, label }]. An instrumental song is just that; no lyrics at all says so. Pure, for the tests. */
export function haveBadges(have) {
    if (!have) return [];
    if (have.instrumental) return [{ key: 'instrumental', label: 'Instrumental' }];
    const badges = [];
    if (have.synced) badges.push({ key: 'synced', label: 'Synced' });
    if (have.plain) badges.push({ key: 'plain', label: 'Plain' });
    return badges.length ? badges : [{ key: 'none', label: 'No lyrics' }];
}

/** The group chips: what each is called, in order, with its count. Pure, for the tests. */
export function groupItems(counts) {
    const c = counts || {};
    return [
        { value: 'none', label: 'No lyrics', count: c.none || 0 },
        { value: 'synced', label: 'Synced', count: c.synced || 0 },
        { value: 'plain', label: 'Plain', count: c.plain || 0 },
        { value: 'instrumental', label: 'Instrumental', count: c.instrumental || 0 }
    ];
}

/** Which rows exist for a scroll position: a few above and below the ones in view. Pure, for the tests. */
export function visibleRange(scrollTop, height, total, rowHeight = ROW_HEIGHT, overscan = OVERSCAN) {
    const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const last = Math.min(total, Math.ceil((scrollTop + height) / rowHeight) + overscan);
    return { first, count: Math.max(0, last - first) };
}

/** A column's width, kept between its limits (its default for a value that is not a number). Pure, for the tests. */
export function clampColumn(name, value) {
    const column = COLUMNS[name];
    if (!column) return 0;
    const px = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(px)) return column.fallback;
    return Math.round(Math.min(column.max, Math.max(column.min, px)));
}

/** Where a selected row sits in a run of selected rows next to each other: only the ends of a run are rounded, as in the song list. Pure, for the tests. */
export function selectionRun(selected, before, after) {
    if (!selected) return '';
    if (before) return after ? 'mid' : 'end';
    return after ? 'start' : 'single';
}

function readWidths() {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
    } catch {
        saved = {};
    }
    return { album: clampColumn('album', saved.album), have: clampColumn('have', saved.have), state: clampColumn('state', saved.state) };
}

function writeWidths(widths) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(widths));
    } catch {
        /* a full or blocked store only means the widths are not kept */
    }
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

    const info = () => engineCall('getSmartLyricsFinderInfo') || { mode: 'lrc', skipExisting: true, processing: false, status: '', query: '', have: 'all', counts: {}, selected: 0, selectedIds: [], listed: 0, shown: 0 };

    // ---- top
    const load = sourceButton({ list: () => sources(), className: 'btn btn--outline many-source', onPick: (id) => addFrom(id) });
    const search = el('input', { class: 'many-search', type: 'search', placeholder: 'Filter the list', 'aria-label': 'Filter the list', oninput: (event) => engineAction('handleSmartLyricsFinderSearch', event.target.value) });
    const count = el('span', { class: 'many-count' });
    const top = el('div', { class: 'many-top' }, load, search, count);

    // ---- the card: select all / remove above the list
    const all = el('input', { type: 'checkbox', class: 'many-all', 'aria-label': 'Select every song in the list', onchange: (event) => engineAction(event.target.checked ? 'selectAllSmartLyricsSongs' : 'clearSmartLyricsSelection') });
    const selectedText = el('span', { class: 'many-selected' });
    const removeSelected = button({ label: 'Remove selected', variant: 'ghost', size: 'sm', onClick: () => engineCall('removeSmartLyricsFinderSongs', info().selectedIds) });
    const clearList = button({ label: 'Clear list', variant: 'ghost', size: 'sm', onClick: () => engineAction('clearSmartLyricsFinderList') });
    const bar = el('div', { class: 'many-card__bar' }, el('label', { class: 'many-card__all' }, all, selectedText), el('span', { class: 'many-spacer' }), removeSelected, clearList);
    // The column header sits inside the scroller (sticky), so its width leaves out the scrollbar, exactly as the rows' does: the columns line up.
    const widths = readWidths();
    const albumHandle = resizeHandle('album', 'Resize the Album column');
    const haveHandle = resizeHandle('have', 'Resize the Lyrics now column');
    const stateHandle = resizeHandle('state', 'Resize the Result column');
    const columnHead = el(
        'div',
        { class: 'many-colhead', role: 'presentation' },
        el('span', { class: 'many-colhead__cell many-colhead__title' }, 'Title'),
        el('span', { class: 'many-colhead__cell many-colhead__album' }, albumHandle, 'Album'),
        el('span', { class: 'many-colhead__cell many-colhead__have' }, haveHandle, 'Lyrics now'),
        el('span', { class: 'many-colhead__cell many-colhead__state' }, stateHandle, 'Result')
    );
    const spacer = el('div', { class: 'many-list__spacer' });
    const viewport = el('div', { class: 'many-list', tabindex: '0', role: 'list', 'aria-label': 'Songs to find lyrics for' }, columnHead, spacer);
    const emptyBox = el('div', { class: 'many-empty' }, emptyState({ icon: 'list-music', title: 'No songs yet', text: 'Use "Add songs from…" to load a playlist, an album, an artist or the queue, then find their lyrics.' }));
    const noMatch = el('div', { class: 'many-empty many-empty--match' }, emptyState({ icon: 'list-music', title: 'No songs in this group', text: 'Pick another group, or clear the filter.' }));
    noMatch.hidden = true;
    const card = el('div', { class: 'many-card' }, bar, el('div', { class: 'many-card__body' }, viewport, emptyBox, noMatch));
    paintWidths();
    const groups = el('div', { class: 'many-groups' });
    groups.hidden = true;

    // ---- bottom
    const mode = tabs({ label: 'Find', value: 'lrc', items: [{ id: 'lrc', label: 'Synced lyrics' }, { id: 'lyrics', label: 'Plain lyrics' }], onChange: (value) => engineAction('setSmartLyricsMode', value) });
    const skip = el('input', { type: 'checkbox', checked: true, onchange: (event) => engineAction('toggleSmartLyricsSkipExisting', event.target.checked) });
    const status = el('span', { class: 'many-status', role: 'status' });
    const stop = button({ label: 'Stop', onClick: () => engineAction('stopSmartLyricsFinder') });
    stop.hidden = true;
    const run = button({ label: 'Find lyrics', variant: 'primary', onClick: () => engineAction('runSmartLyricsFinder') });
    const bottom = el('div', { class: 'many-bottom' }, el('div', { class: 'many-bottom__options' }, mode.el, el('label', { class: 'many-skip' }, skip, 'Skip songs that already have it')), el('div', { class: 'many-bottom__run' }, status, stop, run));

    const head = el('header', { class: 'many-head' }, el('span', { class: 'many-head__eyebrow' }, 'Batch'), el('h2', { class: 'many-head__title' }, 'Find lyrics for many songs'), el('p', { class: 'many-head__text' }, 'Add songs, choose synced or plain lyrics, then find them all at once.'));
    host.append(el('div', { class: 'many' }, head, top, groups, card, bottom));

    // ---- the two resizable columns: drag the line in the header (left makes the column wider and the Title narrower), arrows, Home, End; double click or Enter resets
    function resizeHandle(name, label) {
        const { min, max } = COLUMNS[name];
        return el('div', { class: 'many-resizer', role: 'separator', tabindex: '0', 'aria-orientation': 'vertical', 'aria-label': label, 'aria-valuemin': String(min), 'aria-valuemax': String(max), 'data-column': name });
    }
    function paintWidths() {
        card.style.setProperty('--many-album', `${widths.album}px`);
        card.style.setProperty('--many-have', `${widths.have}px`);
        card.style.setProperty('--many-state', `${widths.state}px`);
        albumHandle.setAttribute('aria-valuenow', String(widths.album));
        haveHandle.setAttribute('aria-valuenow', String(widths.have));
        stateHandle.setAttribute('aria-valuenow', String(widths.state));
    }
    function setWidth(name, value, keep) {
        widths[name] = clampColumn(name, value);
        paintWidths();
        if (keep) writeWidths(widths);
    }
    function wireResize(handle) {
        const name = handle.dataset.column;
        handle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            const startX = event.clientX;
            const start = widths[name];
            handle.setPointerCapture(event.pointerId);
            handle.dataset.dragging = '';
            document.body.classList.add('many-resizing');
            const move = (e) => setWidth(name, start - (e.clientX - startX), false);
            const end = () => {
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', end);
                handle.removeEventListener('pointercancel', end);
                delete handle.dataset.dragging;
                document.body.classList.remove('many-resizing');
                writeWidths(widths);
            };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', end);
            handle.addEventListener('pointercancel', end);
        });
        handle.addEventListener('dblclick', () => setWidth(name, COLUMNS[name].fallback, true));
        handle.addEventListener('keydown', (event) => {
            const big = event.shiftKey ? 4 : 1;
            let next = null;
            if (event.key === 'ArrowLeft') next = widths[name] + KEY_STEP * big;
            else if (event.key === 'ArrowRight') next = widths[name] - KEY_STEP * big;
            else if (event.key === 'Home') next = COLUMNS[name].min;
            else if (event.key === 'End') next = COLUMNS[name].max;
            else if (event.key === 'Enter') next = COLUMNS[name].fallback;
            if (next === null) return;
            event.preventDefault();
            setWidth(name, next, true);
        });
    }
    wireResize(albumHandle);
    wireResize(haveHandle);
    wireResize(stateHandle);

    // ---- sources
    function addFrom(id) {
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
            el('span', { class: 'many-row__text' }, el('span', { class: 'many-row__title', dir: 'auto' }, row.title || 'Unknown title'), el('span', { class: 'many-row__sub', dir: 'auto' }, row.artist || '')),
            el('span', { class: 'many-row__album', dir: 'auto', title: row.album || '' }, row.album || ''),
            el('span', { class: 'many-row__have' }),
            el('span', { class: 'many-row__state' })
        );
        node.addEventListener('click', () => engineAction('toggleSmartLyricsSong', row.id));
        return node;
    }

    function place(node, row, index, before, after) {
        node.style.transform = `translateY(${index * ROW_HEIGHT}px)`;
        node.setAttribute('aria-selected', String(row.selected));
        const run = selectionRun(row.selected, Boolean(before && before.selected), Boolean(after && after.selected));
        if (run) node.dataset.run = run;
        else delete node.dataset.run;
        node.dataset.status = row.status || 'none';
        node.querySelector('.many-row__check').checked = row.selected;
        const badges = haveBadges(row.lyrics);
        const have = node.querySelector('.many-row__have');
        const shown = badges.map((b) => b.key).join();
        if (have.dataset.shown !== shown) {
            have.dataset.shown = shown;
            have.replaceChildren(...badges.map((b) => el('span', { class: `many-badge many-badge--${b.key}` }, b.label)));
        }
        const state = node.querySelector('.many-row__state');
        state.textContent = STATUS[row.status] || '';
        state.title = row.error || '';
    }

    function drawRows() {
        const { first, count: wanted } = visibleRange(viewport.scrollTop, viewport.clientHeight || 480, total);
        // one row more on each side, so the rows at the edge know whether their neighbour is selected (the ends of a run are rounded, the rest not)
        const from = Math.max(0, first - 1);
        const upto = Math.min(total, first + wanted + 1);
        const rows = wanted ? engineCall('getSmartLyricsFinderRows', from, upto - from) || [] : [];
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
            place(node, row, from + i, rows[i - 1], rows[i + 1]);
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

    // The group chips are drawn again only when a number or the pick changed. Picked: only that chip stays, with its close button (chipGroup, clearable).
    let groupsShape = '';
    function paintGroups(now, busy) {
        groups.hidden = now.listed === 0;
        const counts = now.counts || {};
        const shape = `${now.have}|${counts.none}|${counts.synced}|${counts.plain}|${counts.instrumental}|${busy}`;
        if (shape === groupsShape) return;
        groupsShape = shape;
        const items = groupItems(counts).map((item) => ({ ...item, disabled: busy || (!item.count && now.have !== item.value) }));
        groups.replaceChildren(chipGroup({ items, value: now.have || 'all', label: 'Songs by the lyrics they have', clearable: true, clearValue: 'all', onChange: (value) => engineAction('setSmartLyricsHaveFilter', value) }).el);
    }

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
        paintGroups(now, busy);
        bar.hidden = now.listed === 0;
        emptyBox.hidden = now.listed !== 0;
        noMatch.hidden = !(now.listed !== 0 && now.shown === 0);
        viewport.hidden = now.listed === 0 || now.shown === 0;
        spacer.style.height = `${total * ROW_HEIGHT}px`;
        const next = `${now.listed}|${now.shown}|${now.query}|${now.mode}|${now.have}`;
        if (next !== shape) {
            shape = next;
            for (const node of nodes.values()) node.remove();
            nodes.clear();
            viewport.scrollTop = Math.min(viewport.scrollTop, Math.max(0, HEAD_HEIGHT + total * ROW_HEIGHT - viewport.clientHeight));
        }
        drawRows();
    }

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

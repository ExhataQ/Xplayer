// Song list (task B-03): the header row, show or hide columns, the Title and Album resize handle, and the density switch.
// The rows themselves are the engine's (strategy S3, decision D16); song-list.css lays them out on a grid whose columns are
// CSS variables on the view host. This file only sets those variables and data attributes, and keeps the header in step.

import { el, iconButton, openMenu } from '../../components/index.js';
import { createListToolbar } from './list-toolbar.js';
import { trackInputMode } from './input-mode.js';
import { trackSelectModifier } from './select-modifier.js';
import { nextSort } from './song-sort.js';
import { canSortList, listSort, changeListSort } from '../../adapter/songsort-bridge.js';
import { isSongView, currentSongView, onSongViewChange, setRowHeight, listElement, listTitle, onListTitleChange, listSongCount } from '../../adapter/songlist-bridge.js';
import { listKind, listCover, onListCoverChange } from '../../adapter/listbar-bridge.js';
import { defaultCover } from '../../adapter/default-cover.js';
import { getAppearance, setAppearance, watchAppearance } from '../../shell/appearance.js';

const KIND_LABELS = { album: 'Album', artist: 'Artist', playlist: 'Playlist', favorites: 'Playlist', 'all-songs': 'Playlist', history: 'Playlist', recent: 'Playlist', 'search-items': 'Search results' };

const STORE_KEY = 'xplayer.ui-next.songlist';

// Title and Album share the space that is left; the saved value is the Title's share of the pair, so the layout
// survives a window resize (the pair stays in proportion) instead of freezing pixel widths.
export const DEFAULT_SHARE = 5 / 9;
export const MIN_SHARE = 0.2;
export const MAX_SHARE = 0.8;
const MIN_TITLE_PX = 140;
const MIN_ALBUM_PX = 90;
const KEY_STEP = 0.02;

export const DEFAULTS = { cover: true, artist: true, album: true, time: true, density: 'comfortable', share: DEFAULT_SHARE };

function normalize(saved) {
    const s = saved && typeof saved === 'object' ? saved : {};
    const flag = (k) => (typeof s[k] === 'boolean' ? s[k] : DEFAULTS[k]);
    const share = Number(s.share);
    return {
        cover: flag('cover'),
        artist: flag('artist'),
        album: flag('album'),
        time: flag('time'),
        density: s.density === 'compact' ? 'compact' : 'comfortable',
        share: share >= MIN_SHARE && share <= MAX_SHARE ? share : DEFAULT_SHARE
    };
}

export function readSaved() {
    try {
        return normalize(JSON.parse(localStorage.getItem(STORE_KEY) || '{}'));
    } catch (_) {
        return normalize(null);
    }
}

function write(state) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (_) {
        /* the list just opens with the defaults next time */
    }
}

/** Title and Album as grid weights: the pair always adds up to 9fr, so 5 and 4 is the default. */
export function weights(share) {
    const title = Math.round(share * 9 * 1000) / 1000;
    return { title: `${title}fr`, album: `${Math.round((9 - title) * 1000) / 1000}fr` };
}

// Hues that look good as a header tint (copper, amber, rose, violet, blue, teal). Random hues came out muddy (greens and yellows).
const HERO_HUES = [18, 32, 340, 275, 210, 170];

/** One of HERO_HUES for a text, the same every time (a small string hash). */
export function hueOf(text) {
    let h = 0;
    for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return HERO_HUES[h % HERO_HUES.length];
}

export function clampShare(share, pairWidth) {
    let min = MIN_SHARE;
    let max = MAX_SHARE;
    // Pixel floors apply only when the pair is wide enough to honor both.
    if (pairWidth > MIN_TITLE_PX + MIN_ALBUM_PX) {
        min = Math.max(min, MIN_TITLE_PX / pairWidth);
        max = Math.min(max, 1 - MIN_ALBUM_PX / pairWidth);
    }
    return Math.min(max, Math.max(min, share));
}

/**
 * Adds the header and the column controls to `host` (the view host that holds the engine's main content).
 * Returns { state, apply(patch), header, detach() }. Call detach() before the host is used for something else.
 */
export function attachSongList(host, { toolbar = false } = {}) {
    const state = readSaved();
    state.density = getAppearance().density; // density is an appearance choice now (task A-10); the saved value here is only a fallback
    const content = () => host.querySelector('.content');
    const stopInputMode = trackInputMode(); // the selection ring shows for keyboard use only (task PB-12)
    const stopSelectModifier = trackSelectModifier(); // Shift or Ctrl on an artist or album name selects the row, it does not open the name

    // ----- title bar: the engine's name for the list, and how many songs it holds -----
    const barCover = el('div', { class: 'songlist-bar__cover', 'aria-hidden': 'true' });
    const barLabel = el('div', { class: 'songlist-bar__label' });
    const barTitle = el('h2', { class: 'songlist-bar__title', dir: 'auto' });
    const barCount = el('span', { class: 'songlist-bar__count' });
    const listTools = toolbar ? createListToolbar() : null;
    const bar = el('div', { class: 'songlist-bar' }, barCover, el('div', { class: 'songlist-bar__text' }, barLabel, el('div', { class: 'songlist-bar__line' }, barTitle, barCount)), listTools ? listTools.el : '');
    // The hero title stays on one line and gets smaller as its room shrinks, as the old screen did (adjustHeroTitleSize in js/core/01-sizes.js).
    // The largest size that fits is used, never below TITLE_MIN; at that size a longer name is cut with an ellipsis.
    const TITLE_MAX = 56;
    const TITLE_MIN = 24;
    let fittedFor = '';
    function fitTitle() {
        const room = barTitle.parentElement.clientWidth;
        const key = `${barTitle.textContent}|${room}|${bar.dataset.kind}`;
        if (key === fittedFor) return;
        fittedFor = key;
        if (!room || !bar.dataset.kind) return void barTitle.style.removeProperty('font-size');
        barTitle.style.fontSize = `${TITLE_MAX}px`;
        const natural = barTitle.scrollWidth; // the text's width at the largest size
        const size = natural <= room ? TITLE_MAX : Math.max(TITLE_MIN, Math.floor((TITLE_MAX * room) / natural));
        barTitle.style.fontSize = `${size}px`;
    }
    const titleObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(fitTitle) : null;
    if (titleObserver) titleObserver.observe(barTitle.parentElement);

    let lastView = '';
    function paintBar() {
        const view = currentSongView();
        const n = listSongCount(view);
        const kind = listKind(view);
        barLabel.textContent = KIND_LABELS[kind] || '';
        // A list with no art of its own shows its default cover (the same file the other lists use), not an empty space.
        const cover = listCover(host) || Object.assign(document.createElement('img'), { alt: '', src: defaultCover(kind) });
        barCover.dataset.kind = kind;
        bar.dataset.kind = kind; // the hero look (song-list.css) is for the lists that have a cover and a name
        bar.style.setProperty('--hero-hue', String(hueOf(`${kind}|${listTitle(host)}`))); // each list gets its own tint, the same list always the same one
        barCover.hidden = !cover;
        barCover.replaceChildren(...(cover ? [cover] : []));
        barTitle.textContent = listTitle(host);
        barCount.textContent = `${n} ${n === 1 ? 'song' : 'songs'}`;
        fitTitle();
        if (listTools) {
            if (view !== lastView) listTools.reset();
            else listTools.update();
        }
        lastView = view;
    }

    // ----- header -----
    // Title, Album and Time sort the list (task PB-08). The engine does the sorting; these buttons only ask for it and show the state.
    const sortButtons = {};
    const sortButton = (key, label) => {
        const button = el(
            'button',
            { type: 'button', class: 'songlist-head__sort', dataset: { sort: key, dir: 'none' }, onclick: () => cycleSort(key) },
            el('span', { class: 'songlist-head__sort-label' }, label),
            el('span', { class: 'songlist-head__sort-arrow', 'aria-hidden': 'true' })
        );
        sortButtons[key] = { button, label };
        return button;
    };
    const titleCell = el('div', { class: 'songlist-head__cell songlist-head__cell--title' }, sortButton('title', 'Title'));
    const albumCell = el('div', { class: 'songlist-head__cell songlist-head__cell--album' }, sortButton('album', 'Album'));
    const time = el('span', { class: 'songlist-head__time' }, sortButton('time', 'Time'));
    const columnsButton = iconButton({
        icon: 'columns-3',
        label: 'Columns and row height',
        size: 'sm',
        onClick: () => openColumnsMenu(columnsButton)
    });
    columnsButton.setAttribute('aria-haspopup', 'menu');
    const resizer = el('div', {
        class: 'songlist-resizer',
        role: 'separator',
        tabindex: '0',
        'aria-orientation': 'vertical',
        'aria-label': 'Resize the Title and Album columns',
        'aria-valuemin': String(Math.round(MIN_SHARE * 100)),
        'aria-valuemax': String(Math.round(MAX_SHARE * 100))
    });
    const header = el(
        'div',
        { class: 'songlist-head', role: 'presentation' },
        el('div', { class: 'songlist-head__cell songlist-head__cell--number', 'aria-hidden': 'true' }, '#'),
        titleCell,
        albumCell,
        el('div', { class: 'songlist-head__tail' }, time, columnsButton),
        resizer
    );

    function paintSort(view = currentSongView()) {
        const sortable = canSortList(view);
        const sort = sortable ? listSort(view) : null;
        for (const [key, { button, label }] of Object.entries(sortButtons)) {
            const dir = sort && sort.key === key ? sort.dir : 'none';
            button.dataset.dir = dir;
            button.disabled = !sortable;
            button.setAttribute(
                'aria-label',
                !sortable ? label : dir === 'none' ? `Sort by ${label}` : dir === 'asc' ? `${label}, sorted ascending. Activate to sort descending` : `${label}, sorted descending. Activate to clear the sort`
            );
        }
    }

    // A click on a column: ascending, then descending, then back to the list's own order.
    function cycleSort(key) {
        const view = currentSongView();
        if (!canSortList(view)) return;
        const next = nextSort(listSort(view), key);
        changeListSort(view, next ? next.key : null, next ? next.dir : 'asc');
        paintSort(view);
    }

    // ----- applying state -----
    const columnWidths = () => ({ title: titleCell.getBoundingClientRect().width, album: albumCell.getBoundingClientRect().width });

    function placeResizer() {
        resizer.style.left = `${titleCell.offsetLeft + titleCell.offsetWidth}px`;
        resizer.setAttribute('aria-valuenow', String(Math.round(state.share * 100)));
    }

    // The header's bottom line continues across the scrollbar's width, up to the panel's wall (a piece outside the scroller, see song-list.css).
    const edge = el('div', { class: 'songlist-head-edge', 'aria-hidden': 'true', hidden: '' });
    function placeEdge() {
        const node = content();
        const wrapper = node && node.parentElement;
        const bar = node ? node.offsetWidth - node.clientWidth : 0;
        edge.hidden = !wrapper || header.hidden || bar <= 0;
        if (edge.hidden) return;
        edge.style.width = `${bar}px`;
        edge.style.top = `${Math.round(header.getBoundingClientRect().bottom - wrapper.getBoundingClientRect().top) - 1}px`;
    }
    function measureScrollbar() {
        const node = content();
        if (!node) return;
        host.style.setProperty('--sl-scrollbar', `${Math.max(0, node.offsetWidth - node.clientWidth)}px`);
        placeResizer();
        placeEdge();
    }

    let lastHeight = 0;
    function paint() {
        host.dataset.songlist = '';
        host.dataset.cover = state.cover ? 'on' : 'off';
        host.dataset.artist = state.artist ? 'on' : 'off';
        host.dataset.album = state.album ? 'on' : 'off';
        host.dataset.time = state.time ? 'on' : 'off';
        host.dataset.density = state.density;
        const w = weights(state.share);
        host.style.setProperty('--sl-title-w', w.title);
        host.style.setProperty('--sl-album-w', w.album);
        // The engine reads the row height once at load; tell it when density changes it. The CSS variable is on the host.
        const height = parseFloat(getComputedStyle(host).getPropertyValue('--song-item-height'));
        if (height > 0 && height !== lastHeight) {
            lastHeight = height;
            setRowHeight(height);
        }
        placeResizer();
    }

    function apply(patch) {
        Object.assign(state, normalize({ ...state, ...patch }));
        write(state);
        paint();
    }

    function showForView(view) {
        header.hidden = !isSongView(view);
        bar.hidden = header.hidden;
        paintSort(view);
        paintBar();
        measureScrollbar();
    }

    // ----- column menu -----
    function openColumnsMenu(anchor) {
        const toggle = (key, label) => ({ label, checked: state[key], onSelect: () => apply({ [key]: !state[key] }) });
        openMenu({
            anchor,
            items: [
                { type: 'heading', label: 'Columns' },
                toggle('cover', 'Cover art'),
                toggle('artist', 'Artist name'),
                toggle('album', 'Album'),
                toggle('time', 'Time'),
                { type: 'separator' },
                { type: 'heading', label: 'Row height' },
                { label: 'Comfortable', radio: true, checked: state.density === 'comfortable', onSelect: () => setAppearance({ density: 'comfortable' }) },
                { label: 'Compact', radio: true, checked: state.density === 'compact', onSelect: () => setAppearance({ density: 'compact' }) },
                { type: 'separator' },
                { label: 'Reset column widths', disabled: state.share === DEFAULT_SHARE, onSelect: () => apply({ share: DEFAULT_SHARE }) }
            ]
        });
    }

    // ----- resizing -----
    function shareFromDrag(startShare, startWidths, dx) {
        const pair = startWidths.title + startWidths.album;
        if (pair <= 0) return startShare;
        return clampShare((startWidths.title + dx) / pair, pair);
    }

    resizer.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const startX = event.clientX;
        const startShare = state.share;
        const startWidths = columnWidths();
        resizer.setPointerCapture(event.pointerId);
        resizer.dataset.dragging = '';
        document.body.classList.add('songlist-resizing');
        let frame = 0;
        const move = (e) => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                state.share = shareFromDrag(startShare, startWidths, e.clientX - startX);
                paint();
            });
        };
        const end = () => {
            resizer.removeEventListener('pointermove', move);
            resizer.removeEventListener('pointerup', end);
            resizer.removeEventListener('pointercancel', end);
            if (frame) cancelAnimationFrame(frame);
            delete resizer.dataset.dragging;
            document.body.classList.remove('songlist-resizing');
            apply({ share: state.share });
        };
        resizer.addEventListener('pointermove', move);
        resizer.addEventListener('pointerup', end);
        resizer.addEventListener('pointercancel', end);
    });
    resizer.addEventListener('dblclick', () => apply({ share: DEFAULT_SHARE }));
    resizer.addEventListener('keydown', (event) => {
        const big = event.shiftKey ? 5 : 1;
        let next = null;
        if (event.key === 'ArrowLeft') next = state.share - KEY_STEP * big;
        else if (event.key === 'ArrowRight') next = state.share + KEY_STEP * big;
        else if (event.key === 'Home') next = MIN_SHARE;
        else if (event.key === 'End') next = MAX_SHARE;
        else if (event.key === 'Enter') next = DEFAULT_SHARE;
        if (next === null) return;
        event.preventDefault();
        const pair = columnWidths().title + columnWidths().album;
        apply({ share: clampShare(next, pair) });
    });

    // ----- mount -----
    const wrapper = host.querySelector('.content-wrapper');
    // The title bar and the column header sit at the top of the scrolling content: the bar scrolls away, and the header
    // sticks to the top once it reaches it (as in the old screen).
    const scroller = content();
    if (scroller) {
        scroller.prepend(bar);
        bar.after(header);
    } else {
        host.insertBefore(bar, wrapper || host.firstChild);
        host.insertBefore(header, wrapper || host.firstChild);
    }
    if (scroller && scroller.parentElement) scroller.parentElement.insertBefore(edge, scroller); // before the scroller: its scrollbar paints over the piece
    let edgeQueued = false;
    const onScroll = () => {
        if (edgeQueued) return;
        edgeQueued = true;
        requestAnimationFrame(() => {
            edgeQueued = false;
            placeEdge();
        });
    };
    if (scroller) scroller.addEventListener('scroll', onScroll, { passive: true });
    paint();
    showForView(currentSongView());
    const unsubscribeView = onSongViewChange(showForView);
    const unsubscribeTitle = onListTitleChange(host, paintBar);
    const unsubscribeCover = onListCoverChange(host, paintBar);

    // The scrollbar appears and disappears with the list's height, and the resize handle follows the column edge.
    const observer = new ResizeObserver(measureScrollbar);
    observer.observe(host);
    if (content()) observer.observe(content());
    const list = listElement(host);
    if (list) observer.observe(list);
    let countQueued = false;
    const countObserver = new MutationObserver(() => {
        if (countQueued) return;
        countQueued = true;
        requestAnimationFrame(() => {
            countQueued = false;
            paintBar();
        });
    });
    if (list) countObserver.observe(list, { childList: true });

    const unsubscribeAppearance = watchAppearance(({ density }) => density !== state.density && apply({ density }));

    return {
        state,
        header,
        apply,
        detach() {
            stopInputMode();
            stopSelectModifier();
            unsubscribeAppearance();
            unsubscribeView();
            unsubscribeTitle();
            unsubscribeCover();
            observer.disconnect();
            if (scroller) scroller.removeEventListener('scroll', onScroll);
            edge.remove();
            countObserver.disconnect();
            if (titleObserver) titleObserver.disconnect();
            if (listTools) listTools.destroy();
            bar.remove();
            header.remove();
            for (const key of ['songlist', 'cover', 'artist', 'album', 'time', 'density']) delete host.dataset[key];
            for (const name of ['--sl-title-w', '--sl-album-w', '--sl-scrollbar']) host.style.removeProperty(name);
        }
    };
}

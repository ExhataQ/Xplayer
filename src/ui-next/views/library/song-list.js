// Song list (task B-03): the header row, show or hide columns, the Title and Album resize handle, and the density switch.
// The rows themselves are the engine's (strategy S3, decision D16); song-list.css lays them out on a grid whose columns are
// CSS variables on the view host. This file only sets those variables and data attributes, and keeps the header in step.

import { el, iconButton, openMenu } from '../../components/index.js';
import { createListToolbar } from './list-toolbar.js';
import { trackInputMode } from './input-mode.js';
import { trackSelectModifier } from './select-modifier.js';
import { nextSort } from './song-sort.js';
import { MAIN_HUE, tagline, statLine } from './main-playlists.js';
import { knownTint, tintFor } from './cover-tint.js';
import { canSortList, listSort, changeListSort } from '../../adapter/songsort-bridge.js';
import { isSongView, currentSongView, onSongViewChange, setRowHeight, listElement, listTitle, onListTitleChange, listSongs } from '../../adapter/songlist-bridge.js';
import { listKind, listCover, onListCoverChange } from '../../adapter/listbar-bridge.js';
import { defaultCover } from '../../adapter/default-cover.js';
import { getAppearance, setAppearance, watchAppearance } from '../../shell/appearance.js';
import { createRatingColumn } from './song-rating-column.js';
import { ratingSystemOn } from '../../adapter/ratings-bridge.js';
import { engineEvent } from '../../adapter/engine-api.js';

const KIND_LABELS = { album: 'Album', artist: 'Artist', playlist: 'Playlist', favorites: 'Playlist', 'all-songs': 'Playlist', history: 'Playlist', recent: 'Playlist', 'search-items': 'Search results' };

const STORE_KEY = 'xplayer.ui-next.songlist';

// Title and Album share the space that is left; the saved value is the Title's share of the pair, so the layout
// survives a window resize (the pair stays in proportion) instead of freezing pixel widths.
export const DEFAULT_SHARE = 5 / 9;
export const MIN_SHARE = 0.2;
export const MAX_SHARE = 0.8;
// The Rating column's own width (px): at least the five stars, and the person may widen it by dragging its left edge (task B3).
export const RATING_MIN = 88;
export const RATING_MAX = 240;
export const RATING_DEFAULT = 88;
const RATING_KEY_STEP = 8;
const MIN_TITLE_PX = 140;
const MIN_ALBUM_PX = 90;
const KEY_STEP = 0.02;

export const DEFAULTS = { cover: true, artist: true, album: true, rating: true, ratingWidth: RATING_DEFAULT, time: true, density: 'comfortable', share: DEFAULT_SHARE };

function normalize(saved) {
    const s = saved && typeof saved === 'object' ? saved : {};
    const flag = (k) => (typeof s[k] === 'boolean' ? s[k] : DEFAULTS[k]);
    const share = Number(s.share);
    const ratingWidth = Number(s.ratingWidth);
    return {
        cover: flag('cover'),
        artist: flag('artist'),
        album: flag('album'),
        rating: flag('rating'),
        ratingWidth: ratingWidth >= RATING_MIN && ratingWidth <= RATING_MAX ? Math.round(ratingWidth) : RATING_DEFAULT,
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
    const barTagline = el('p', { class: 'songlist-bar__tagline', hidden: '' });
    const barCount = el('span', { class: 'songlist-bar__count' });
    const listTools = toolbar ? createListToolbar() : null;
    const bar = el('div', { class: 'songlist-bar' }, barCover, el('div', { class: 'songlist-bar__text' }, barLabel, el('div', { class: 'songlist-bar__line' }, barTitle, barTagline, barCount)), listTools ? listTools.el : '');
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

    // The artist count walks the whole library, and paintBar also runs while the list scrolls: count again only when the list changed.
    let artistsFor = '';
    let artistsCount = 0;
    function countArtists(view, songs) {
        const key = `${view}|${songs.length}|${songs[0]?.id}|${songs[songs.length - 1]?.id}`;
        if (key !== artistsFor) {
            artistsFor = key;
            artistsCount = new Set(songs.map((song) => String(song.artist || '').toLowerCase())).size;
        }
        return artistsCount;
    }

    // The header takes its colors from the cover (cover-palette.js): an album, artist or playlist with art of its own. Liked Songs and All Songs keep their
    // fixed look, and a list with no art, or art that cannot be read, keeps the tint song-list.css gives it from its name. A cover read for the first time shows
    // its colors a moment later (the header's gradient fades in, data-tint="pending"); one seen before shows them at once.
    let tintedUrl = '';
    function paintTint(kind, own) {
        const url = (kind === 'album' || kind === 'artist' || kind === 'playlist') && own && own.tagName === 'IMG' ? own.src : '';
        if (url === tintedUrl) return; // the same cover: nothing to do (paintBar also runs while the list scrolls)
        tintedUrl = url;
        const show = (colors) => {
            for (const [name, value] of [['--hero-tint', colors && colors.tint], ['--hero-tint-2', colors && colors.tint2]]) {
                if (value) bar.style.setProperty(name, value);
                else bar.style.removeProperty(name);
            }
            delete bar.dataset.tint;
        };
        const known = url ? knownTint(url) : null;
        if (known !== undefined) return show(known);
        bar.dataset.tint = 'pending';
        tintFor(url).then((colors) => tintedUrl === url && show(colors));
    }

    let lastView = '';
    function paintBar() {
        const view = currentSongView();
        const songs = listSongs(view);
        const kind = listKind(view);
        barLabel.textContent = KIND_LABELS[kind] || '';
        // A list with no art of its own shows its default cover (the same file the other lists use), not an empty space.
        const own = listCover(host);
        const cover = own || Object.assign(document.createElement('img'), { alt: '', src: defaultCover(kind) });
        barCover.dataset.kind = kind;
        bar.dataset.kind = kind; // the hero look (song-list.css) is for the lists that have a cover and a name
        bar.style.setProperty('--hero-hue', String(MAIN_HUE[kind] ?? hueOf(`${kind}|${listTitle(host)}`))); // each list gets its own tint, the same list always the same one
        paintTint(kind, own);
        barCover.hidden = !cover;
        barCover.replaceChildren(...(cover ? [cover] : []));
        barTitle.textContent = listTitle(host);
        barCount.textContent = statLine(kind, songs, kind === 'all-songs' ? countArtists(view, songs) : 0);
        barTagline.textContent = tagline(kind, songs.length);
        barTagline.hidden = !barTagline.textContent;
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
    const ratingCell = el('div', { class: 'songlist-head__cell songlist-head__cell--rating' }, sortButton('rating', 'Rating')); // only while the Rating system is on and the column is chosen (song-rating-column.js)
    const ratingResizer = el('div', {
        class: 'songlist-rating-resizer',
        role: 'separator',
        tabindex: '0',
        'aria-orientation': 'vertical',
        'aria-label': 'Resize the Rating column',
        'aria-valuemin': String(RATING_MIN),
        'aria-valuemax': String(RATING_MAX)
    });
    const header = el(
        'div',
        { class: 'songlist-head', role: 'presentation' },
        el('div', { class: 'songlist-head__cell songlist-head__cell--number', 'aria-hidden': 'true' }, '#'),
        titleCell,
        albumCell,
        ratingCell,
        el('div', { class: 'songlist-head__tail' }, time, columnsButton),
        resizer,
        ratingResizer
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

    // A click on a column: its first direction (the rating: best first), then the other way, then back to the list's own order.
    function cycleSort(key) {
        const view = currentSongView();
        if (!canSortList(view)) return;
        const next = nextSort(listSort(view), key);
        changeListSort(view, next ? next.key : null, next ? next.dir : 'asc');
        paintSort(view);
    }

    // A list sorted by rating follows the ratings: when one changes, the list is drawn again in the new order (the engine reads one order for the rows, the clicks
    // and the queue, so the rows on screen must be that order). Turning the rating system off ends a sort by rating.
    const sortedByRating = () => {
        const view = currentSongView();
        const sort = canSortList(view) ? listSort(view) : null;
        return sort && sort.key === 'rating' ? { view, sort } : null;
    };
    const stopRatingSort = [
        engineEvent('ratings:changed', () => {
            const now = sortedByRating();
            if (now) changeListSort(now.view, 'rating', now.sort.dir);
        }),
        engineEvent('ratingSettings:changed', () => {
            const now = sortedByRating();
            if (!now || ratingSystemOn()) return;
            changeListSort(now.view, null, 'asc');
            paintSort(now.view);
        })
    ];

    // ----- applying state -----
    const columnWidths = () => ({ title: titleCell.getBoundingClientRect().width, album: albumCell.getBoundingClientRect().width });

    // The Rating column's handle sits in the gap in front of its header cell; dragging it left makes the column wider (and the Title and Album narrower).
    function placeRatingResizer() {
        ratingResizer.style.left = `${ratingCell.offsetLeft - ratingResizer.offsetWidth}px`;
        ratingResizer.setAttribute('aria-valuenow', String(state.ratingWidth));
    }

    function placeResizer() {
        resizer.style.left = `${titleCell.offsetLeft + titleCell.offsetWidth}px`;
        resizer.setAttribute('aria-valuenow', String(Math.round(state.share * 100)));
        placeRatingResizer();
    }

    // The header's bottom line continues across the scrollbar's width, up to the panel's wall (a piece outside the scroller, see song-list.css).
    const edge = el('div', { class: 'songlist-head-edge', 'aria-hidden': 'true', hidden: '' });
    // The hero's colors continue across the scrollbar's width too. The hero sits inside the scroller, so its gradient stops where the scrollbar
    // starts and a plain strip showed at the panel's wall. A piece in the wrapper, behind the scroller (like the header's edge above), draws the
    // right-hand strip of the same gradient: as tall as the part of the hero that is on screen, and moving up with it as the list scrolls.
    const HERO_KINDS = new Set(['album', 'playlist', 'artist', 'favorites', 'all-songs']);
    const heroEdge = el('div', { class: 'songlist-hero-edge', 'aria-hidden': 'true', hidden: '' });
    function copyHeroColors() {
        const style = getComputedStyle(bar);
        for (const name of ['--hero-tint', '--hero-tint-2', '--hero-glow']) heroEdge.style.setProperty(name, style.getPropertyValue(name));
        heroEdge.dataset.tint = bar.dataset.tint || '';
        // The column header and its piece at the wall need the list's kind: with a hero they are see-through at rest and solid once stuck (data-stuck).
        for (const piece of [heroEdge, header, edge]) piece.dataset.kind = bar.dataset.kind || '';
    }
    // The hero's gradient goes on through the column header (song-list.css, --hero-extend = the header's height), so the header is part of the hero and the
    // gradient is not cut off between the two. Nothing goes further down: below the header the list is plain.
    let extended = -1;
    function extendHero() {
        const extend = HERO_KINDS.has(bar.dataset.kind) && !bar.hidden && !header.hidden ? header.offsetHeight : 0;
        if (extend !== extended) {
            extended = extend;
            host.style.setProperty('--hero-extend', `${extend}px`);
        }
        return extend;
    }
    function placeHeroEdge() {
        const node = content();
        const wrapper = node && node.parentElement;
        const scrollbar = node ? node.offsetWidth - node.clientWidth : 0;
        const box = bar.getBoundingClientRect();
        const extend = extendHero();
        const wrapperBox = wrapper ? wrapper.getBoundingClientRect() : null;
        const wrapperTop = wrapperBox ? wrapperBox.top : 0;
        const bottom = box.bottom + extend; // where the gradient ends, hero and extension together
        heroEdge.hidden = !wrapper || scrollbar <= 0 || bar.hidden || !HERO_KINDS.has(bar.dataset.kind) || bottom <= wrapperTop;
        if (heroEdge.hidden) return;
        const top = Math.max(0, box.top - wrapperTop);
        heroEdge.style.width = `${scrollbar}px`;
        heroEdge.style.top = `${top}px`;
        heroEdge.style.height = `${Math.min(bottom - Math.max(box.top, wrapperTop), wrapperBox.height - top)}px`;
        heroEdge.style.setProperty('--hero-w', `${node.offsetWidth}px`); // the gradient is drawn as wide as the hero plus the scrollbar, and this is its right-hand strip
        heroEdge.style.setProperty('--hero-h', `${box.height + extend}px`);
        heroEdge.style.setProperty('--hero-y', `${Math.min(0, box.top - wrapperTop)}px`);
        // The hero's corner lines (::after) are centered on its top right corner, which is where the scrollbar starts: the strip draws the other half of them.
        // These are that pattern's box (58% of the hero, at most 560px), the radius its fade reaches, and where its stripes are in their 12px rhythm.
        const patternWidth = Math.min(box.width * 0.58, 560);
        heroEdge.style.setProperty('--hero-pw', `${patternWidth}px`);
        heroEdge.style.setProperty('--hero-ring-r', `${0.72 * Math.hypot(patternWidth, box.height + extend)}px`);
        heroEdge.style.setProperty('--hero-phase', `${patternWidth % 12}px`);
    }
    function placeEdge() {
        placeHeroEdge();
        const node = content();
        const wrapper = node && node.parentElement;
        const bar = node ? node.offsetWidth - node.clientWidth : 0;
        // Stuck: the list is scrolled and the header has reached the top. A list with a hero then has the header solid, in the list's background color, instead of the hero's gradient showing through it.
        const headBox = header.getBoundingClientRect();
        const wrapperTop = wrapper ? wrapper.getBoundingClientRect().top : 0;
        const stuck = !header.hidden && HERO_KINDS.has(header.dataset.kind) && !!node && node.scrollTop > 0 && headBox.top <= wrapperTop + 1;
        header.dataset.stuck = String(stuck);
        edge.dataset.stuck = String(stuck);
        edge.hidden = !wrapper || header.hidden || bar <= 0;
        if (edge.hidden) return;
        edge.style.width = `${bar}px`;
        // At rest the piece is the header's 1px bottom line; stuck, it is the header's whole height, so the tint reaches the wall too.
        edge.style.top = `${Math.round(stuck ? headBox.top - wrapperTop : headBox.bottom - wrapperTop - 1)}px`;
        edge.style.height = stuck ? `${headBox.height}px` : '';
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
        host.style.setProperty('--sl-rating-w', `${state.ratingWidth}px`);
        ratingColumn.setOn(state.rating);
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

    const ratingColumn = createRatingColumn(host); // the stars column: cells in the engine's rows while the Rating system is on (B3)

    function apply(patch) {
        Object.assign(state, normalize({ ...state, ...patch }));
        write(state);
        paint();
    }

    function showForView(view) {
        header.hidden = !isSongView(view);
        bar.hidden = header.hidden;
        ratingColumn.setOn(state.rating); // the engine may have been late at the first paint: look again at each list
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
                ...(ratingSystemOn() ? [toggle('rating', 'Rating')] : []),
                toggle('time', 'Time'),
                { type: 'separator' },
                { type: 'heading', label: 'Row height' },
                { label: 'Comfortable', radio: true, checked: state.density === 'comfortable', onSelect: () => setAppearance({ density: 'comfortable' }) },
                { label: 'Compact', radio: true, checked: state.density === 'compact', onSelect: () => setAppearance({ density: 'compact' }) },
                { type: 'separator' },
                { label: 'Reset column widths', disabled: state.share === DEFAULT_SHARE && state.ratingWidth === RATING_DEFAULT, onSelect: () => apply({ share: DEFAULT_SHARE, ratingWidth: RATING_DEFAULT }) }
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

    // The Rating column's handle: the same ways as the Title and Album one (drag, double click or Enter to reset, arrows, Home and End).
    ratingResizer.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = state.ratingWidth;
        ratingResizer.setPointerCapture(event.pointerId);
        ratingResizer.dataset.dragging = '';
        document.body.classList.add('songlist-resizing');
        let frame = 0;
        const move = (e) => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                state.ratingWidth = Math.round(Math.min(RATING_MAX, Math.max(RATING_MIN, startWidth - (e.clientX - startX)))); // left makes it wider
                paint();
            });
        };
        const end = () => {
            ratingResizer.removeEventListener('pointermove', move);
            ratingResizer.removeEventListener('pointerup', end);
            ratingResizer.removeEventListener('pointercancel', end);
            if (frame) cancelAnimationFrame(frame);
            delete ratingResizer.dataset.dragging;
            document.body.classList.remove('songlist-resizing');
            apply({ ratingWidth: state.ratingWidth });
        };
        ratingResizer.addEventListener('pointermove', move);
        ratingResizer.addEventListener('pointerup', end);
        ratingResizer.addEventListener('pointercancel', end);
    });
    ratingResizer.addEventListener('dblclick', () => apply({ ratingWidth: RATING_DEFAULT }));
    ratingResizer.addEventListener('keydown', (event) => {
        const big = event.shiftKey ? 5 : 1;
        const next = { ArrowLeft: state.ratingWidth + RATING_KEY_STEP * big, ArrowRight: state.ratingWidth - RATING_KEY_STEP * big, Home: RATING_MIN, End: RATING_MAX, Enter: RATING_DEFAULT }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        apply({ ratingWidth: Math.min(RATING_MAX, Math.max(RATING_MIN, next)) });
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
    if (scroller && scroller.parentElement) scroller.parentElement.insertBefore(heroEdge, edge); // under the header's piece at the wall, which the strip now reaches
    const heroWatch = new MutationObserver(() => {
        copyHeroColors();
        placeHeroEdge();
    });
    heroWatch.observe(bar, { attributes: true, attributeFilter: ['style', 'data-kind', 'data-tint', 'hidden'] });
    copyHeroColors();
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
    observer.observe(bar); // a name that wraps or a tagline that appears changes the hero's height
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
            heroEdge.remove();
            heroWatch.disconnect();
            countObserver.disconnect();
            if (titleObserver) titleObserver.disconnect();
            if (listTools) listTools.destroy();
            stopRatingSort.forEach((stop) => stop());
            ratingColumn.destroy();
            bar.remove();
            header.remove();
            for (const key of ['songlist', 'cover', 'artist', 'album', 'time', 'density', 'ratingColumn']) delete host.dataset[key];
            for (const name of ['--sl-title-w', '--sl-album-w', '--sl-scrollbar', '--sl-rating-w']) host.style.removeProperty(name);
        }
    };
}

// Library panel (task B-02, decision D9): filter chips (one row that scrolls sideways), find and a sort button, and the engine's one list of everything you own.
// The rows are the engine's (strategy L1, decision D21); this file builds the controls and keeps them in step.

import { chipGroup, iconButton, openMenu, el } from '../../components/index.js';
import { chipStrip } from './chip-strip.js';
import { scrollShadow } from '../../components/scroll-shadow.js';
import { panelSearch } from './panel-search.js';
import { setPanelRowHeight } from '../../adapter/songlist-bridge.js';
import { getAppearance, watchAppearance } from '../../shell/appearance.js';
import { aiAvailable, askAi } from '../../shell/ai-slots.js';
import { showNewPlaylist, showNewFolder } from '../../adapter/menu-bridge.js';
import { mountLibraryList, setLibraryView, libraryItemCount, openLibraryFolder, closeLibraryFolder, onLibraryChange, whenLibraryReady } from '../../adapter/library-bridge.js';

// The chips choose item types. All Songs and Liked Songs are playlists as far as the person is concerned.
export const CHIPS = [
    { value: 'all', label: 'All', types: null },
    { value: 'playlists', label: 'Playlists', types: ['all-songs', 'favorites', 'playlist'] },
    { value: 'albums', label: 'Albums', types: ['album'] },
    { value: 'artists', label: 'Artists', types: ['artist'] }
];

// What the scan makes by itself: one album and one artist item for every album and artist name in the songs. "Hide generated" takes them
// out of All, and leaves the playlists and folders the person made (and All Songs and Liked Songs).
const NOT_GENERATED = ['all-songs', 'favorites', 'playlist', 'folder'];

const SORTS = [
    { value: 'recent', label: 'Recent' },
    { value: 'name', label: 'A to Z' }
];

// What the plus makes. Each choice opens the engine's naming dialog (a name has to be typed), so the choice itself is a floating menu,
// like the shuffle menu, and not another dialog.
const createItems = () => [
    { label: 'New playlist', icon: 'list-music', onSelect: showNewPlaylist },
    { label: 'New folder', icon: 'folder', onSelect: showNewFolder },
    // Only when AI is on (PE-11): the chat opens with the start of a request, to finish in the person's words. Nothing is sent yet.
    ...(aiAvailable() ? [{ type: 'separator' }, { label: 'Organize with AI…', icon: 'sparkles', onSelect: () => askAi('Organize my library into playlists and folders: ') }] : [])
];

// The plus in the panel header (PB-06): the shell puts it in the header, for the Library only. It opens the menu under itself.
export const LIBRARY_HEADER_ACTION = { icon: 'plus', label: 'New playlist or folder', onClick: (anchor) => openMenu({ anchor, items: createItems() }) };

const STORE_KEY = 'xplayer.ui-next.library';

function readSaved() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
        return {
            chip: CHIPS.some((c) => c.value === saved.chip) ? saved.chip : 'all',
            sort: SORTS.some((s) => s.value === saved.sort) ? saved.sort : 'recent',
            hideGenerated: saved.hideGenerated === true
        };
    } catch (_) {
        return { chip: 'all', sort: 'recent', hideGenerated: false };
    }
}

function save(state) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (_) {
        /* the panel just opens on All and Recent next time */
    }
}

/**
 * Builds the panel inside `body` (the panel host's body). Returns { root, show(), hide() }. The panel is hidden, not
 * removed, when another rail item is chosen: the engine looks its list up by id, so the list must stay in the page.
 */
export function mountLibraryPanel(body) {
    const saved = readSaved();
    const state = { chip: saved.chip, sort: saved.sort, hideGenerated: saved.hideGenerated, query: '' };

    let list = null; // the panel's list element, built below
    // A new order or a new filter fades the rows in (PB-10, brief 3.8). Typing in the find field does not: it would flicker on every key.
    const swapRows = () => {
        if (!list) return;
        list.removeAttribute('data-swap');
        void list.offsetWidth; // restarts the animation when it is chosen twice in a row
        list.setAttribute('data-swap', '');
    };
    const apply = (animate = false) => {
        // The Albums and Artists chips still show them: asking for one by name wins over hiding.
        const types = CHIPS.find((c) => c.value === state.chip).types || (state.hideGenerated ? NOT_GENERATED : null);
        setLibraryView({ types, query: state.query, sort: state.sort });
        save({ chip: state.chip, sort: state.sort, hideGenerated: state.hideGenerated });
        if (animate) swapRows();
    };

    const chips = chipGroup({
        label: 'Show',
        items: CHIPS.map(({ value, label }) => ({ value, label })),
        value: state.chip,
        onChange: (value) => {
            state.chip = value;
            apply(true);
        }
    });
    const strip = chipStrip(chips.el, { label: 'filters' });
    const find = panelSearch({
        label: 'Find in library',
        placeholder: 'Find in library',
        onInput: (text) => {
            state.query = text;
            apply();
        }
    });
    // The order is a button next to the find button; it opens a small menu with the two orders.
    const sortLabel = () => `Sort: ${SORTS.find((s) => s.value === state.sort).label}${state.hideGenerated ? ', generated albums and artists hidden' : ''}`;
    const sort = iconButton({
        icon: 'arrow-up-down',
        label: sortLabel(),
        size: 'sm',
        className: 'library-sort',
        tooltip: () => ({ name: sortLabel() }),
        onClick: () =>
            openMenu({
                anchor: sort,
                items: [
                    { type: 'heading', label: 'Sort by' },
                    ...SORTS.map(({ value, label }) => ({
                        label,
                        radio: true,
                        checked: state.sort === value,
                        onSelect: () => {
                            state.sort = value;
                            sort.setAttribute('aria-label', sortLabel());
                            sort.dataset.sort = value;
                            apply(true);
                        }
                    })),
                    { type: 'separator' },
                    {
                        label: 'Hide generated albums and artists',
                        checked: state.hideGenerated,
                        onSelect: () => {
                            state.hideGenerated = !state.hideGenerated;
                            showHideState();
                            apply(true);
                        }
                    }
                ]
            })
    });
    sort.setAttribute('aria-haspopup', 'menu');
    sort.dataset.sort = state.sort;
    // A dot on the button says the list is filtered, so an empty-looking library is not a surprise.
    function showHideState() {
        sort.dataset.filtered = String(state.hideGenerated);
        sort.setAttribute('aria-label', sortLabel());
    }
    showHideState();

    const back = iconButton({ icon: 'chevron-left', label: 'Back to library', size: 'sm', onClick: () => closeLibraryFolder() });
    const folderName = el('span', { class: 'library-panel__folder-name' });
    const folderBar = el('div', { class: 'library-panel__folder-bar' }, back, folderName);

    const controls = el('div', { class: 'library-panel__controls' }, strip.el, el('div', { class: 'library-panel__row' }, find.el, sort));
    const empty = el('div', { class: 'library-panel__empty', role: 'status', hidden: true });
    list = el('div', { class: 'library-panel__list scroll-shadow--overlay' });
    scrollShadow(list, '.left-panel-main-list-content'); // a shadow under the controls while the list is scrolled
    const root = el('div', { class: 'library-panel', 'data-folder': 'closed' }, controls, folderBar, empty, list);

    body.classList.add('panel-host__body--library');
    body.append(root);
    mountLibraryList(list);

    // Right click on empty space (not on a row: the engine has its own menu there) offers the two things the plus makes.
    root.addEventListener('contextmenu', (event) => {
        if (event.target.closest('.left-panel-main-item, input, button')) return;
        event.preventDefault();
        openMenu({ point: { x: event.clientX, y: event.clientY }, items: createItems() });
    });

    // Keeps the folder bar and the "nothing here" message in step with whatever the engine just drew.
    let ready = false;
    const refresh = () => {
        if (!ready) return;
        const folder = openLibraryFolder();
        root.dataset.folder = folder ? 'open' : 'closed';
        folderName.textContent = folder;
        const none = !folder && libraryItemCount() === 0;
        empty.hidden = !none;
        if (none) empty.textContent = state.query ? `Nothing matches "${state.query}".` : 'Nothing here yet.';
    };
    onLibraryChange(refresh);
    // Density changes the panel's row height too (D61). The CSS variable already follows data-density; the engine reads the new value.
    const syncRowHeight = () => {
        const height = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--left-item-height'));
        if (height > 0) setPanelRowHeight(height);
    };
    let rowDensity = getAppearance().density;
    watchAppearance(({ density }) => {
        // only the row height matters here: a color change must not make the browser measure the whole page again
        if (density === rowDensity) return;
        rowDensity = density;
        if (ready) syncRowHeight();
    });
    // The shell runs before the engine loads, so the saved chip and sort are applied once the engine is there.
    whenLibraryReady(() => {
        ready = true;
        apply();
        refresh();
    });

    return {
        root,
        show() {
            root.hidden = false;
            body.classList.add('panel-host__body--library');
            refresh();
        },
        hide() {
            root.hidden = true;
            body.classList.remove('panel-host__body--library');
        }
    };
}

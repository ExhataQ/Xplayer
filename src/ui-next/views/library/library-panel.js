// Library panel (task B-02, decision D9): filter chips, find, sort, and the engine's one list of everything you own.
// The rows are the engine's (strategy L1, decision D21); this file builds the controls and keeps them in step.

import { chipGroup, segmented, textField, iconButton, openMenu, el } from '../../components/index.js';
import { setPanelRowHeight } from '../../adapter/songlist-bridge.js';
import { watchAppearance } from '../../shell/appearance.js';
import { showCreateDialog } from '../../adapter/library-create.js';
import { showNewPlaylist, showNewFolder } from '../../adapter/menu-bridge.js';
import { mountLibraryList, setLibraryView, libraryItemCount, openLibraryFolder, closeLibraryFolder, onLibraryChange, whenLibraryReady } from '../../adapter/library-bridge.js';

// The chips choose item types. All Songs and Liked Songs are playlists as far as the person is concerned.
export const CHIPS = [
    { value: 'all', label: 'All', types: null },
    { value: 'playlists', label: 'Playlists', types: ['all-songs', 'favorites', 'playlist'] },
    { value: 'folders', label: 'Folders', types: ['folder'] },
    { value: 'albums', label: 'Albums', types: ['album'] },
    { value: 'artists', label: 'Artists', types: ['artist'] }
];

const SORTS = [
    { value: 'recent', label: 'Recent' },
    { value: 'name', label: 'A to Z' }
];

// The plus in the panel header (PB-06): the shell puts it before the collapse arrow, for the Library only.
export const LIBRARY_HEADER_ACTION = { icon: 'plus', label: 'New playlist or folder', onClick: showCreateDialog };

const STORE_KEY = 'xplayer.ui-next.library';

function readSaved() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
        return {
            chip: CHIPS.some((c) => c.value === saved.chip) ? saved.chip : 'all',
            sort: SORTS.some((s) => s.value === saved.sort) ? saved.sort : 'recent'
        };
    } catch (_) {
        return { chip: 'all', sort: 'recent' };
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
    const state = { chip: saved.chip, sort: saved.sort, query: '' };

    const apply = () => {
        const types = CHIPS.find((c) => c.value === state.chip).types;
        setLibraryView({ types, query: state.query, sort: state.sort });
        save({ chip: state.chip, sort: state.sort });
    };

    const chips = chipGroup({
        label: 'Show',
        items: CHIPS.map(({ value, label }) => ({ value, label })),
        value: state.chip,
        onChange: (value) => {
            state.chip = value;
            apply();
        }
    });
    const find = textField({
        label: 'Find in library',
        placeholder: 'Find',
        search: true,
        onInput: (text) => {
            state.query = text;
            apply();
        }
    });
    const sort = segmented({
        label: 'Sort',
        items: SORTS,
        value: state.sort,
        onChange: (value) => {
            state.sort = value;
            apply();
        }
    });

    const back = iconButton({ icon: 'chevron-left', label: 'Back to library', size: 'sm', onClick: () => closeLibraryFolder() });
    const folderName = el('span', { class: 'library-panel__folder-name' });
    const folderBar = el('div', { class: 'library-panel__folder-bar' }, back, folderName);

    const controls = el('div', { class: 'library-panel__controls' }, chips.el, el('div', { class: 'library-panel__row' }, find.el), sort.el);
    const empty = el('div', { class: 'library-panel__empty', role: 'status', hidden: true });
    const list = el('div', { class: 'library-panel__list' });
    const root = el('div', { class: 'library-panel', 'data-folder': 'closed' }, controls, folderBar, empty, list);

    body.classList.add('panel-host__body--library');
    body.append(root);
    mountLibraryList(list);

    // Right click on empty space (not on a row: the engine has its own menu there) offers the two things the plus makes.
    root.addEventListener('contextmenu', (event) => {
        if (event.target.closest('.left-panel-main-item, input, button')) return;
        event.preventDefault();
        openMenu({
            point: { x: event.clientX, y: event.clientY },
            items: [
                { label: 'New playlist', icon: 'list-music', onSelect: showNewPlaylist },
                { label: 'New folder', icon: 'folder', onSelect: showNewFolder }
            ]
        });
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
    watchAppearance(() => ready && syncRowHeight());
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

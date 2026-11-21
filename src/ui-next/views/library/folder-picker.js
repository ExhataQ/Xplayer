// "Move to folder" and "Add shortcut to..." (the same look as "Add to playlist", playlist-picker.js): the content of those submenus of a playlist's or
// folder's menu. A search field over the folders, and "New folder" on top. Choosing a folder files the item and closes the menu. "New folder" makes a
// folder (named what was typed in the search field, else "New folder"), files the item in it and closes the menu.
import { mountPicker } from '../../components/index.js';
import { foldersForItem, fileItem } from '../../adapter/folder-picker-bridge.js';
import { createFolderNamed } from '../../adapter/library-create.js';
import { filterPlaylists } from './playlist-picker-model.js'; // it only reads `name`, so it filters folders too

const NEW = '__new__';

/** The name "New folder" gives: what was typed, else "New folder", "New folder 2" ... */
export function newFolderName(folders, query) {
    const typed = String(query ?? '').trim();
    if (typed) return typed;
    const taken = new Set(folders.map((f) => String(f.name).trim().toLowerCase()));
    if (!taken.has('new folder')) return 'New folder';
    let n = 2;
    while (taken.has(`new folder ${n}`)) n += 1;
    return `New folder ${n}`;
}

/** mountFolderPicker(host, { mode, itemId, itemType }, onDone): fills `host` (the submenu); `onDone` closes the menu. */
export function mountFolderPicker(host, { mode, itemId, itemType } = {}, onDone) {
    if (!host || !itemId || !itemType) return null;
    const moving = mode === 'move';
    const folders = () => foldersForItem(itemId, itemType, mode);
    const picker = mountPicker(host, {
        label: moving ? 'Move to folder' : 'Add shortcut to a folder',
        placeholder: 'Find a folder',
        empty: (query) => (query.trim() ? 'No folder with that name' : 'No folders yet'),
        actions: () => [{ id: NEW, label: moving ? 'Move to new folder' : 'Add shortcut to new folder', icon: 'plus' }],
        items: (query) => filterPlaylists(folders(), query).map((f) => ({ id: f.id, label: f.name, mark: f.has })),
        onPick: (row, query) => {
            if (row.id !== NEW) return void fileItem(mode, row.id, itemId, itemType);
            fileItem(mode, createFolderNamed(newFolderName(folders(), query)).id, itemId, itemType);
        },
        onDone
    });
    if (host.parentElement) host.parentElement.addEventListener('pointerenter', () => requestAnimationFrame(() => picker.focus())); // after the hover style has shown the submenu
    return picker;
}

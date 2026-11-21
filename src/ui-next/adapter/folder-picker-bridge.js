// folder-picker-bridge: what the folder picker needs from the engine. The picker fills the "Move to folder" and "Add shortcut to..." submenus of a
// playlist's or folder's menu.
//
//   foldersForItem(itemId, itemType, mode) -> [{ id, name, has }]  the folders to list, in the engine's order. Left out: for a shortcut, the folder that
//                                              is open (it is already there); for a folder, itself. `has` is true when the item is already in it.
//   fileItem(mode, folderId, itemId, itemType)  adds the shortcut ('add') or moves the item ('move'), tells the person and lets the lists redraw
//   registerFolderPicker(mount)                 the engine's menus call `mount(host, request, onDone)` to fill those submenus
import { engineAction, engineCall } from './engine-api.js';

const engine = () => window;

export function foldersForItem(itemId, itemType, mode) {
    const e = engine();
    const open = e.currentOpenFolderId;
    return e
        .getFolders()
        .filter((f) => !(mode === 'add' && open === f.id) && !(itemType === 'folder' && f.id === itemId))
        .map((f) => ({ id: f.id, name: f.name, has: (f.children || []).some((c) => c.id === itemId && c.type === itemType) }));
}

export const fileItem = (mode, folderId, itemId, itemType) => engineCall(mode === 'add' ? 'addToFolderFromMenu' : 'moveToFolderFromMenu', folderId, itemId, itemType);
export const registerFolderPicker = (mount) => engineAction('registerFolderPicker', mount);

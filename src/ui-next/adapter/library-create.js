// library-create (task PB-06): making a playlist or a folder, as plain functions. The Library panel's plus button, the panel's
// empty-space menu and the AI organizer (PE-05, through ai-bridge.js) all call these, so there is one way to do it.
//
//   createPlaylistNamed(name) -> { id, created }   created is false when a playlist with that name (any case) already exists:
//                                                  that one is returned and nothing is made. The new playlist is never put into
//                                                  the folder that happens to be open; place it with the folder actions.
//   createFolderNamed(name)   -> { id, created }   same rule for folders
//   showCreateDialog()                             the engine's own "Create New" choice (Playlist or Folder); the panel's plus uses a menu instead
//
// The engine emits playlist:listChanged and folder:listChanged itself, so the lists redraw without anything here.

import { engineAction } from './engine-api.js';

const engine = () => window;
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function cleanName(name, what) {
    const text = String(name ?? '').trim();
    if (!text) throw new Error(`A ${what} needs a name`);
    return text;
}

export function createPlaylistNamed(name) {
    const text = cleanName(name, 'playlist');
    const existing = engine().getPlaylists().find((p) => same(p.name, text));
    if (existing) return { id: existing.id, created: false };
    const playlist = engine().createPlaylist(text);
    // The engine files a new playlist into whichever folder is open.
    if (engine().currentOpenFolderId) engine().removeItemFromFolder(engine().currentOpenFolderId, playlist.id, 'playlist');
    return { id: playlist.id, created: true };
}

export function createFolderNamed(name) {
    const text = cleanName(name, 'folder');
    const existing = engine().getFolders().find((f) => same(f.name, text));
    if (existing) return { id: existing.id, created: false };
    return { id: engine().createFolder(text).id, created: true };
}

export const showCreateDialog = () => engineAction('showCreateItemDialog');

// playlist-picker-bridge (task B2): what the "Add to playlist" picker needs from the engine.
//
//   playlistsInOrder()                 -> [{ id, name, songs }]  pinned first, then the most recently used (the order the left panel and the old submenu use); without
//                                         Top rated and Not rated, which follow the ratings and take no songs by hand
//   addSongsToPlaylist(ids, playlistId) -> { added, already, name }  adds, tells the person (the engine's notification) and lets the lists redraw
//   registerPlaylistPicker(mount)      the engine's song menu calls `mount(host, songIds, onDone)` to fill its "Add to playlist" submenu
import { engineAction, engineCall } from './engine-api.js';

const engine = () => window;

export function playlistsInOrder() {
    const e = engine();
    return e.sortByPinnedThenRecent(e.getPlaylists().filter((p) => !p.smart), (p) => `playlist-${p.id}`, e.getPinnedItems(), e.getPlayedItemOrder()).map((p) => ({ id: p.id, name: p.name, songs: p.songs || [] }));
}

export const addSongsToPlaylist = (ids, playlistId) => engineCall('addSongsToPlaylistFromMenu', ids, playlistId);
export const registerPlaylistPicker = (mount) => engineAction('registerPlaylistPicker', mount);

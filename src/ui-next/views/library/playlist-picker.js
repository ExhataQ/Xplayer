// "Add to playlist" (task B2): the content of the song menu's "Add to playlist" submenu. A search field over the playlists, and
// "Add to new playlist" on top. The submenu is the engine's own (it opens on hover and closes with the menu); this fills it.
// Choosing a playlist adds the songs and closes the menu. "Add to new playlist" makes a playlist (named what was typed in the
// search field, else "New playlist"), adds the songs, and keeps the submenu open so the playlists show again, the new one on top and marked.
import { mountPicker } from '../../components/index.js';
import { playlistsInOrder, addSongsToPlaylist } from '../../adapter/playlist-picker-bridge.js';
import { createPlaylistNamed } from '../../adapter/library-create.js';
import { filterPlaylists, membership, newPlaylistName } from './playlist-picker-model.js';

const NEW = '__new__';

/** mountPlaylistPicker(host, songIds, onDone): fills `host` (the submenu); `onDone` closes the menu. Typing starts when the pointer enters the menu item. */
export function mountPlaylistPicker(host, songIds, onDone) {
    if (!Array.isArray(songIds) || !songIds.length) return null;
    const picker = mountPicker(host, {
        label: 'Add to playlist',
        placeholder: 'Find a playlist',
        empty: (query) => (query.trim() ? 'No playlist with that name' : 'No playlists yet'),
        actions: () => [{ id: NEW, label: 'Add to new playlist', icon: 'plus' }],
        items: (query) => filterPlaylists(playlistsInOrder(), query).map((p) => ({ id: p.id, label: p.name, mark: membership(p, songIds) === 'all' })),
        onPick: (row, query) => {
            if (row.id !== NEW) return void addSongsToPlaylist(songIds, row.id);
            addSongsToPlaylist(songIds, createPlaylistNamed(newPlaylistName(playlistsInOrder(), query)).id);
            return 'keep';
        },
        onDone
    });
    if (host.parentElement) host.parentElement.addEventListener('pointerenter', () => requestAnimationFrame(() => picker.focus())); // after the hover style has shown the submenu
    return picker;
}

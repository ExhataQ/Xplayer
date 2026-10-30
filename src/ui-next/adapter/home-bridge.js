// home-bridge (task PB-15): what the Home view may read from the engine, and the two things a Home card can do.
// Read only. Every reader is an engine global that already exists and is already used by the library panel
// (ui/04a collectAllLeftPanelItems), so there is no engine change. Needs a line budget under DP9 before it is merged.
//
//   homeData()        -> { songs, playlists, albums, artists }, each a list of { kind, id, viewId, title, subtitle, cover, played }
//                        songs: the recently played list, newest first. The others: items the person played first (newest first), then the rest.
//   openHomeItem(item) -> plays a song (queue: the whole library), or opens a playlist, album or artist in the engine

import { playSongFromList } from './actions.js';
import { engineAction } from './engine-api.js';

const engine = () => window;
const read = (name, ...args) => (typeof engine()[name] === 'function' ? engine()[name](...args) || [] : []);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function byPlayedOrder(items, order) {
    const rank = (item) => order.indexOf(item.viewId);
    return items.map((item) => ({ ...item, played: rank(item) !== -1 })).sort((a, b) => (a.played ? rank(a) : Infinity) - (b.played ? rank(b) : Infinity) || 0);
}

export function homeData() {
    const order = read('getPlayedItemOrder');
    const group = (kind, list, viewId, count) =>
        byPlayedOrder(list.map((x) => ({ kind, id: x.id, viewId: viewId(x), title: String(x.name || ''), subtitle: count(x), cover: x.cover || '' })), order);
    return {
        songs: read('getRecentlyPlayedSongs').map((s) => ({ kind: 'song', id: s.id, viewId: '', title: String(s.title || ''), subtitle: String(s.artist || 'Unknown Artist'), cover: s.cover || '', played: true })),
        playlists: group('playlist', read('getPlaylists'), (p) => `playlist-${p.id}`, (p) => plural((p.songs || []).length, 'song')),
        albums: group('album', read('getAlbums'), (a) => a.id, (a) => plural(a.songCount || 0, 'song')),
        artists: group('artist', read('getArtists'), (a) => a.id, (a) => plural(a.songCount || 0, 'song'))
    };
}

// The engine's own openers draw the item's songs. switchView(viewId) does not: for an album or artist it marks the view as current
// and then skips drawing it, and a playlist has no view entry at all (found by agent A, reproduced). A song is played from the whole
// library ('all-songs'), because without a list the engine uses whatever view it showed last, which may not contain the song.
const OPENER = { playlist: 'openPlaylist', album: 'openAlbum', artist: 'openArtist' };

export function openHomeItem(item) {
    if (item.kind === 'song') playSongFromList(item.id, 'all-songs');
    else engineAction(OPENER[item.kind], item.id);
}

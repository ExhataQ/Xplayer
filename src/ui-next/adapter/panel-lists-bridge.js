// panel-lists-bridge (task PB-02): what the Search and Recents panels read from the engine. Read only; opening an item goes
// through home-bridge's openHomeItem. Nothing here draws into the engine's lists or touches its search state.
//
//   searchLibrary(query) -> { songs, artists, albums, playlists }   every match, as { kind, id, title, subtitle, cover } rows
//   recentPlaylists()   -> [{ id, viewId, title, cover, songCount, lastPlayed, plays: [{ kind, id, title, subtitle, cover, playedAt }] }]
//                          A playlist is "recent" when one of its songs is in the play history. The engine does not record which
//                          list a song was played from, so a song counts for every playlist that holds it. Newest first.
//   recentSongs(limit)  -> [{ kind, id, title, subtitle, cover, playedAt }], newest first, one row per song

const engine = () => window;
const read = (name, ...args) => (typeof engine()[name] === 'function' ? engine()[name](...args) || [] : []);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const song = (s) => ({ kind: 'song', id: s.id, title: String(s.title || ''), subtitle: String(s.artist || ''), cover: s.cover || '' });

/** Everything that matches `query`, by kind. Each list is complete; the panel pages through it (components/auto-load.js). */
export function searchLibrary(query) {
    const text = String(query || '').trim();
    const none = { songs: [], artists: [], albums: [], playlists: [] };
    if (!text) return none;
    const normalize = typeof engine().normalizeSearchText === 'function' ? engine().normalizeSearchText : (v) => String(v).toLowerCase();
    const tokens = normalize(text).split(' ').filter(Boolean);
    const named = (name) => {
        const value = normalize(name || '');
        return tokens.length > 0 && tokens.every((token) => value.includes(token));
    };
    const songs = typeof engine().searchSongs === 'function' ? engine().searchSongs(read('getActiveSongs'), text) : [];
    return {
        songs: songs.map(song),
        artists: read('getArtists').filter((a) => named(a.name)).map((a) => ({ kind: 'artist', id: a.id, title: String(a.name || ''), subtitle: plural(a.songCount || 0, 'song'), cover: a.cover || '' })),
        albums: read('getAlbums').filter((a) => named(a.name)).map((a) => ({ kind: 'album', id: a.id, title: String(a.name || ''), subtitle: plural(a.songCount || 0, 'song'), cover: a.cover || '' })),
        playlists: read('getPlaylists').filter((p) => named(p.name)).map((p) => ({ kind: 'playlist', id: p.id, viewId: `playlist-${p.id}`, title: String(p.name || ''), subtitle: plural((p.songs || []).length, 'song'), cover: p.cover || '' }))
    };
}

export function recentPlaylists() {
    const history = read('getPlayHistory'); // newest first
    if (!history.length) return [];
    const byId = new Map();
    for (const entry of history) {
        if (!byId.has(entry.id)) byId.set(entry.id, []);
        byId.get(entry.id).push(entry);
    }
    const out = [];
    for (const playlist of read('getPlaylists')) {
        const plays = [];
        for (const songId of new Set(playlist.songs || [])) {
            // one row per song: its latest play
            const latest = byId.get(songId)?.[0];
            if (latest) plays.push({ ...song({ ...latest, cover: engine().getSongById?.(songId)?.cover || latest.cover }), id: songId, artist: String(latest.artist || ''), playedAt: Number(latest.playedAt) || 0 });
        }
        if (!plays.length) continue;
        plays.sort((a, b) => b.playedAt - a.playedAt);
        out.push({ kind: 'playlist', id: playlist.id, viewId: `playlist-${playlist.id}`, title: String(playlist.name || ''), cover: playlist.cover || '', songCount: (playlist.songs || []).length, lastPlayed: plays[0].playedAt, plays });
    }
    return out.sort((a, b) => b.lastPlayed - a.lastPlayed);
}

export function recentSongs(limit = 20) {
    const seen = new Set();
    const out = [];
    for (const entry of read('getPlayHistory')) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        out.push({ ...song({ ...entry, cover: engine().getSongById?.(entry.id)?.cover || entry.cover }), playedAt: Number(entry.playedAt) || 0 });
        if (out.length >= limit) break;
    }
    return out;
}

/** "14:05" today, "Yesterday", or "Oct 21"; empty when the time is unknown. */
export function whenPlayed(timestamp, now = Date.now()) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date(now);
    const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const gap = Math.round((day(today) - day(date)) / 86400000);
    if (gap === 0) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (gap === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

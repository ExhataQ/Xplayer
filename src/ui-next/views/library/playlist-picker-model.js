// Playlist picker model (task B2): what the "Add to playlist" picker lists. Pure functions, no DOM.
//
//   filterPlaylists(playlists, query)       the playlists whose name has the query in it, names that start with it first; the given order otherwise
//   membership(playlist, songIds)           'all' | 'some' | 'none': how many of the songs the playlist already has
//   newPlaylistName(playlists, query)       the name "Add to new playlist" gives: what was typed in the search field, else "New playlist", "New playlist 2", ...

const clean = (text) => String(text ?? '').trim().toLowerCase();

export function filterPlaylists(playlists, query) {
    const q = clean(query);
    if (!q) return [...playlists];
    const starts = [];
    const inside = [];
    for (const playlist of playlists) {
        const name = clean(playlist.name);
        if (name.startsWith(q)) starts.push(playlist);
        else if (name.includes(q)) inside.push(playlist);
    }
    return [...starts, ...inside];
}

export function membership(playlist, songIds) {
    const has = new Set(playlist.songs || []);
    const count = songIds.filter((id) => has.has(id)).length;
    return count === 0 ? 'none' : count === songIds.length ? 'all' : 'some';
}

export function newPlaylistName(playlists, query) {
    const typed = String(query ?? '').trim();
    if (typed) return typed;
    const taken = new Set(playlists.map((p) => clean(p.name)));
    if (!taken.has('new playlist')) return 'New playlist';
    let n = 2;
    while (taken.has(`new playlist ${n}`)) n += 1;
    return `New playlist ${n}`;
}

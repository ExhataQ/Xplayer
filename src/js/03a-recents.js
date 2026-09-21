// ==============================================================================
// RECENTLY PLAYED - list logic
// Pure functions (no DOM, no localStorage) so they can be tested on their own.
// Persistence and the UI hooks stay in 03-storage.js (saveToRecentlyPlayed etc.).
//
// Stored shape per entry: { id, url, title, artist, album, duration, playedAt }.
// The stored copy is only a fallback: what the views show is resolved against the live
// library (resolveRecentSongs), so metadata edits and rescans are always reflected.
// ==============================================================================

// A song's identity: its id, or its file url if it has no id.
function recentKey(entry) {
    if (!entry) return '';
    if (entry.id !== undefined && entry.id !== null) return 'id:' + entry.id;
    return entry.url ? 'url:' + entry.url : '';
}

function recentEntryFromSong(song, playedAt) {
    const s = (song && song.song) || song || {};
    return {
        id: s.id,
        url: s.url,
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration,
        playedAt: playedAt
    };
}

// Cleans a stored list: drops junk, removes duplicates (the first = most recent occurrence wins),
// strips fields the entry no longer needs (older versions also stored the cover), caps the length.
function normalizeRecentList(list, max) {
    const seen = new Set();
    const out = [];
    for (const entry of Array.isArray(list) ? list : []) {
        const key = recentKey(entry);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(recentEntryFromSong(entry, entry.playedAt));
        if (out.length >= max) break;
    }
    return out;
}

// Playing a song moves it to the top instead of adding another copy: replaying one song
// 50 times used to push every other song out of the list.
function addToRecentList(list, song, now, max) {
    const entry = recentEntryFromSong(song, now);
    if (!recentKey(entry)) return normalizeRecentList(list, max);
    return normalizeRecentList([entry, ...(Array.isArray(list) ? list : [])], max);
}

// Turns stored entries into the songs currently in the library (same order): fresh title/artist/
// cover after a metadata edit, matched by id first and by url after a rescan changed the ids.
// Songs that no longer exist, or were deleted, are left out.
function resolveRecentSongs(list, library, isDeleted) {
    const byId = new Map();
    const byUrl = new Map();
    for (const s of library || []) {
        byId.set(s.id, s);
        if (s.url) byUrl.set(s.url, s);
    }
    const out = [];
    for (const entry of Array.isArray(list) ? list : []) {
        const live = byId.get(entry.id) || (entry.url && byUrl.get(entry.url));
        if (!live || (isDeleted && isDeleted(live.id))) continue;
        out.push(Object.assign({}, live, { playedAt: entry.playedAt }));
    }
    return out;
}

function getRecentlyPlayedSongs() {
    return resolveRecentSongs(getRecentlyPlayed(), SONGS_DATA, (id) => deletedSongIds.has(id));
}

function getRecentCount() {
    return getRecentlyPlayedSongs().length;
}

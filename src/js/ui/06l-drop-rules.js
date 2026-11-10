// ==============================================================================
// DRAG & DROP - WHAT CAN TAKE A DROP
// ==============================================================================
// One rule for every drag in the app (polish A5), so the dimming and the drop always agree:
//   'song'   a song row dragged inside the app (ui/06f)
//   'files'  audio files dragged in from Windows (ui/06m)
// A left-panel row names itself by its view (data-view) and its pin id (data-pin-id), for example 'favorites', 'playlist-3',
// 'folder-ab12' or 'all-songs'. dropTarget() says what the drop would do; acceptsDrop() is the yes or no.
//   Liked Songs and playlists take both kinds (not Top rated and Not rated, which follow the ratings). All songs takes files only (they are imported into the library, there is nothing
//   else to add them to). Folders, albums, artists and the recently played list take nothing.

const isRatingPlaylistSafe = (playlist) => typeof isRatingPlaylist === 'function' && isRatingPlaylist(playlist); // the rating rules are an engine global

export function dropTarget(kind, view, pinId) {
    for (const key of [view, pinId]) {
        if (typeof key !== 'string') continue;
        if (key === 'favorites') return { type: 'favorites' };
        if (key.startsWith('playlist-')) {
            const id = key.slice('playlist-'.length);
            if (typeof getPlaylists === 'function' && isRatingPlaylistSafe(getPlaylists().find((p) => p.id == id))) return null; // Top rated and Not rated take no drops
            return { type: 'playlist', id };
        }
        if (key === 'all-songs' && kind === 'files') return { type: 'library' };
    }
    return null;
}

export function acceptsDrop(kind, view, pinId) {
    return dropTarget(kind, view, pinId) !== null;
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        dropTarget,
        acceptsDrop
    });
}

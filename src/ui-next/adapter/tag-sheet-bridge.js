// tag-sheet-bridge (task PD-03, agent D): the one place the tag sheet touches the engine. It lists where songs can be loaded
// from, loads them, and reads one file's tags. Reading only: nothing here writes (writing comes with the review step, PD-04).
// Counts against the adapter budget (DP9) until the owner decides.
//
//   sources()        -> [{ id, label, group }]   group: 'now' | 'library' | 'playlist' | 'album' | 'artist'
//   loadSource(id)   -> [{ id, url, title, artist, album, genre, year, track }]  (only the tags the library already holds)
//   readTags(url)    -> Promise<{ success, metadata?, error? }>  the file's tags (electron/tag-service.js read)
//   writeTags(items) -> Promise<{ success, results?: [{ fileUrl, success, metadata?, previous?, skipped?, error? }], error? }>
//                       items: [{ fileUrl, metadata }] with only the tags to change
//   refreshSongs(results)   copies saved tags into the engine's in-memory songs (library and queue) and repaints its lists, like the single editor does
//   notify(message, type, ms)   the engine's notification
//   infoModel()      -> { song, fields, settings }  the playing song, the extended-info field list and which are switched on (song-info.js)
//   setInfoField(key, on)   switch one extended-info field on or off (the engine stores it)

const engine = () => window;
const call = (name, ...args) => (typeof engine()[name] === 'function' ? engine()[name](...args) : null);

export function sources() {
    const now = [
        { id: 'selection', label: 'Selected songs', group: 'now' },
        { id: 'queue', label: 'Queue', group: 'now' },
        { id: 'search', label: 'Search results', group: 'now' }
    ];
    const library = [
        { id: 'all-songs', label: 'All songs', group: 'library' },
        { id: 'favorites', label: 'Favorites', group: 'library' }
    ];
    const lists = (items, prefix, group) => (Array.isArray(items) ? items : []).map((item) => ({ id: `${prefix}${item.id}`, label: String(item.name || item.id), group }));
    return [...now, ...library, ...lists(call('getPlaylists'), 'playlist-', 'playlist'), ...lists(call('getAlbums'), '', 'album'), ...lists(call('getArtists'), '', 'artist')];
}

// The library keeps some tags only in the file; a key the song does not have is left out so the sheet knows to read the file.
function toRow(song) {
    if (!song || song.id === undefined) return null;
    const row = { id: song.id, url: song.url || song.path || '' };
    for (const [key, from] of [['title', 'title'], ['artist', 'artist'], ['album', 'album'], ['genre', 'genre'], ['year', 'year'], ['track', 'trackNumber']]) {
        if (song[from] !== undefined && song[from] !== null) row[key] = song[from];
    }
    return row;
}

export function loadSource(id) {
    let songs = [];
    if (id === 'selection') songs = [...(engine().selectedSongIds || [])].map((songId) => call('getSongById', songId));
    else if (id === 'queue') songs = (engine().playbackQueue || []).map((item) => item.song || item);
    else songs = call('getSongsForList', id) || [];
    return songs.map(toRow).filter(Boolean);
}

export const readTags = (url) => (typeof engine().electronAPI?.getAudioMetadata === 'function' ? engine().electronAPI.getAudioMetadata(url) : Promise.resolve({ success: false, error: 'Tag reading is not available' }));

export const writeTags = (items) => (typeof engine().electronAPI?.saveAudioMetadataMany === 'function' ? engine().electronAPI.saveAudioMetadataMany(items) : Promise.resolve({ success: false, error: 'Saving tags is not available' }));

export function refreshSongs(results) {
    const songs = Array.isArray(engine().SONGS_DATA) ? engine().SONGS_DATA : [];
    const queue = (engine().playbackQueue || []).map((item) => item && (item.song || item));
    for (const result of results || []) {
        if (!result?.success || !result.metadata) continue;
        for (const song of [...songs, ...queue]) {
            if (!song || song.url !== result.fileUrl) continue;
            for (const [key, value] of Object.entries(result.metadata)) {
                if (key === 'cover' || key === 'otherTags') continue;
                song[key] = Array.isArray(value) ? value.join(', ') : value;
            }
        }
    }
    // The engine's lists (songs, Albums and Artists groups) are drawn from a snapshot; the single editor asks for a repaint after a save, so do the same.
    try {
        call('refreshCurrentViewAfterMutation');
    } catch (error) {
        console.warn('[tag-sheet] could not refresh the lists', error);
    }
}

export const notify = (message, type = 'info', ms = 3000) => call('showNotification', message, type, ms);

export function infoModel() {
    return { song: call('getCurrentSongForInfo'), fields: Array.isArray(engine().EXTENDED_METADATA_FIELDS) ? engine().EXTENDED_METADATA_FIELDS : [], settings: call('getExtendedMetadataSettings') || {} };
}

export const setInfoField = (key, on) => call('toggleExtendedMetadataField', key, !!on);

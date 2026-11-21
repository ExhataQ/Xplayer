// ==============================================================================
// DUPLICATES: what the person decided (hide, not duplicates) and the hiding itself
// ==============================================================================
// Finding duplicates is the interface's job (ui-next/views/tools/duplicates-core.js); this file keeps what the person decided and makes it true in the
// engine. A hidden song is put in `deletedSongIds`, the set every list, the queue, shuffle, albums, artists and recents already leave out, so nothing
// else has to learn about hiding. The file stays where it is and nothing is removed from playlists, so showing the song again brings it back as it was.
//
// The decisions are saved by file address (url), not by song id: ids can change when the library is rebuilt, the address does not.
//   hidden          addresses of the songs the person hid
//   notDuplicates   signatures of the groups the person said are not duplicates (the sorted addresses of the group)

const ours = new Set(); // ids this file put in deletedSongIds, so showing a song never brings back one that was really deleted

function read() {
    const saved = storageReadJson(STORAGE_KEYS.DUPLICATE_DECISIONS, {});
    const list = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []);
    return { hidden: list(saved.hidden), notDuplicates: list(saved.notDuplicates) };
}

function write(decisions) {
    storageWriteJson(STORAGE_KEYS.DUPLICATE_DECISIONS, decisions);
}

export function getDuplicateDecisions() {
    return read();
}

function songsByUrl() {
    const map = new Map();
    if (typeof SONGS_DATA !== 'undefined') for (const song of SONGS_DATA) map.set(song.url, song);
    return map;
}

/** Puts the hidden songs of the saved decisions in the engine's hidden set (and takes back the ones that are no longer hidden). */
export function applyHiddenDuplicates() {
    const { hidden } = read();
    const wanted = new Set(hidden);
    const byUrl = songsByUrl();
    for (const id of [...ours]) {
        const song = [...byUrl.values()].find((s) => s.id === id);
        if (!song || !wanted.has(song.url)) {
            ours.delete(id);
            deletedSongIds.delete(id);
        }
    }
    for (const url of wanted) {
        const song = byUrl.get(url);
        if (song && !deletedSongIds.has(song.id)) {
            deletedSongIds.add(song.id);
            ours.add(song.id);
        }
    }
    return wanted.size;
}

function changed() {
    applyHiddenDuplicates();
    if (typeof onSongsChanged === 'function') onSongsChanged();
    if (typeof refreshCurrentViewAfterMutation === 'function') refreshCurrentViewAfterMutation();
    if (typeof emit === 'function') emit('duplicates:changed');
}

/** Hides the songs with these addresses. Answers how many are hidden now. */
export function hideDuplicateSongs(urls) {
    const decisions = read();
    decisions.hidden = [...new Set([...decisions.hidden, ...urls])];
    write(decisions);
    changed();
    return decisions.hidden.length;
}

/** Shows songs again: the ones with these addresses, or all of them with no argument. */
export function showHiddenDuplicates(urls) {
    const decisions = read();
    const drop = urls ? new Set(urls) : null;
    decisions.hidden = drop ? decisions.hidden.filter((url) => !drop.has(url)) : [];
    write(decisions);
    changed();
    return decisions.hidden.length;
}

/** "These are not duplicates": the group is not offered again until it changes. */
export function markNotDuplicates(signature) {
    const decisions = read();
    if (typeof signature === 'string' && signature && !decisions.notDuplicates.includes(signature)) decisions.notDuplicates.push(signature);
    write(decisions);
    if (typeof emit === 'function') emit('duplicates:changed');
}

export function forgetNotDuplicates() {
    const decisions = read();
    decisions.notDuplicates = [];
    write(decisions);
    if (typeof emit === 'function') emit('duplicates:changed');
}

/**
 * Playlists and favourites that hold a copy that is being hidden or removed get the song that is kept instead, so nothing the person made loses
 * the song. `moves` is [{ from: id, to: id }]. Answers how many playlists changed.
 */
export function moveToKeptSong(moves) {
    const map = new Map(moves.map((m) => [m.from, m.to]));
    let changedPlaylists = 0;
    const playlists = getPlaylists();
    for (const playlist of playlists) {
        if (!Array.isArray(playlist.songs) || !playlist.songs.some((id) => map.has(id))) continue;
        const seen = new Set();
        playlist.songs = playlist.songs.map((id) => (map.has(id) ? map.get(id) : id)).filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
        changedPlaylists++;
    }
    if (changedPlaylists) savePlaylists(playlists);
    for (const id of getFavorites()) {
        if (!map.has(id)) continue;
        saveFavorite(map.get(id));
        removeFavorite(id);
    }
    return changedPlaylists;
}

/** Moves the songs' files to the Recycle Bin (as Delete song does) and takes the songs out of the library. Answers how many were sent. */
export async function trashDuplicateSongs(ids) {
    if (typeof desktopApi === 'undefined' || !desktopApi.supports('files.deleteFile')) return 0;
    let sent = 0;
    const trashed = new Set();
    for (const id of ids) {
        const song = SONGS_DATA.find((s) => s.id === id);
        if (!song) continue;
        markSongAsDeleted(id);
        ours.delete(id); // removed for good now: showing hidden songs again must not bring it back
        removeFavorite(id);
        const windowsPath = song.url.replace('file:///', '').replace(/\//g, '\\');
        desktopApi.files.deleteFile(windowsPath); // the main process also removes the song from the saved library
        trashed.add(song.url);
        sent++;
    }
    const decisions = read();
    if (decisions.hidden.some((url) => trashed.has(url))) {
        decisions.hidden = decisions.hidden.filter((url) => !trashed.has(url));
        write(decisions);
    }
    if (typeof onSongsChanged === 'function') onSongsChanged();
    if (typeof refreshCurrentViewAfterMutation === 'function') refreshCurrentViewAfterMutation();
    if (typeof emit === 'function') emit('duplicates:changed');
    return sent;
}

if (typeof on === 'function' && typeof document !== 'undefined') {
    on('library:rebuilt', () => {
        applyHiddenDuplicates();
        if (typeof onSongsChanged === 'function') onSongsChanged();
    });
}
if (typeof SONGS_DATA !== 'undefined') applyHiddenDuplicates();

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ getDuplicateDecisions, applyHiddenDuplicates, hideDuplicateSongs, showHiddenDuplicates, markNotDuplicates, forgetNotDuplicates, moveToKeptSong, trashDuplicateSongs });
}

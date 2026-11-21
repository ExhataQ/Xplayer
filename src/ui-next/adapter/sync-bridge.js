// What the Sync editor (views/tools/sync-editor.js) needs from the engine and the desktop shell. The only file the editor reads them through.
//
//   playing()                -> the song in the player as a plain song { id, url, title, artist, album, cover, duration }, or null
//   librarySong(id)          -> a library song (same shape), or null
//   librarySongs(ids)        -> library songs for many ids in one pass over the library (never a find per row), in the order asked
//   libraryByUrl(url)        -> the library song that has this file, or null (a dropped file that is already in the library saves into it)
//   variants(id) / plainLyrics(id) -> the saved synced versions [{ id, name, text, offset, active }] and the plain lyrics of a library song
//   parse(text)              -> [{ time, text, instrumental? }] or null (the engine's LRC reader)
//   saveVariant(id, lrc, offset) -> the saved variant { id, name }, made the active one, or null
//   pickFiles() / scanFiles(files) -> Promise<{ songs, canceled?, error? }>  audio files chosen in a dialog or dropped (read for their tags)
//   readLrcFile() / saveFile(name, text) -> Promise<{ success, contents?, canceled? }> the lyrics file dialogs
//   pausePlayer() / onPlayerPlaying(callback) -> stop the main player; hear when it starts (the editor has its own audio)

import { engineEvent } from './engine-api.js';
import { isPlaying } from './store.js';

const library = () => window.SONGS_DATA || [];
const plain = (song) => (song ? { id: song.id, url: song.url || song.path || '', title: song.title, artist: song.artist, album: song.album, cover: song.cover, duration: song.duration } : null);

export function playing() {
    const { currentQueueIndex: at, playbackQueue: queue } = window;
    const item = at >= 0 && queue ? queue[at] : null;
    return plain(item && (item.song || item));
}

export const librarySong = (id) => plain(library().find((s) => String(s.id) === String(id)));
export function librarySongs(ids) {
    const found = new Map(ids.map((id) => [String(id), null]));
    for (const song of library()) if (found.has(String(song.id))) found.set(String(song.id), plain(song));
    return ids.map((id) => found.get(String(id)));
}
export const libraryByUrl = (url) => plain(library().find((s) => s.url && String(s.url).toLowerCase() === String(url).toLowerCase()));

export { syncedVersions as variants, plainLyrics, parseLrc as parse, saveSyncedVersion as saveVariant, pausePlayer } from './engine-api.js';
export { pickAudioFiles as pickFiles, scanAudioFiles as scanFiles, readLyricsFile as readLrcFile, saveLyricsFile as saveFile } from './engine-api.js';
export const onPlayerPlaying = (callback) => engineEvent('playback:stateChanged', () => isPlaying() && callback());

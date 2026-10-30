// song-open (task PB-17): one rule for "open this song", used by Home, Search, Recents and anything else that shows a song.
//
//   openSong(songId)   The song is in an album: the album opens in the main view, the song is scrolled to and starts playing (the
//                      queue is that album). It is in no album: the song's own page opens and the song starts playing.
//   registerSongOpeners({ library, page })   The shell says how to show the main view; this file does not know the shell.
//        library()       shows the Library main view and keeps the open panel
//        page(songId)    shows the song page and keeps the open panel
//
// The engine groups albums by album name only, so two artists with an album of the same name are one album here too.

import { playSongFromList, openArtist } from './actions.js';

let openers = null;

export function registerSongOpeners(next) {
    openers = next;
}

const engine = () => window;

/** The album that holds the song, or null. */
export function albumOfSong(songId) {
    const albums = typeof engine().getAlbums === 'function' ? engine().getAlbums() : [];
    return albums.find((album) => (album.songs || []).includes(songId)) || null;
}

// The shell's openers return the router's outcome: a string, or a Promise of one while the view on screen asks the person first (the Sync
// editor's "Discard Sync?"). The engine must not be driven before the Library is on screen, so the work waits for the answer, and is dropped
// when the person chose to stay.
function afterShown(outcome, work) {
    if (outcome && typeof outcome.then === 'function') return void outcome.then((result) => result === 'shown' && work());
    work();
}

export function openSong(songId) {
    if (!openers) throw new Error('openSong() was called before the shell registered its openers');
    const album = albumOfSong(songId);
    if (album && typeof engine().switchToViewAndScroll === 'function') {
        afterShown(openers.library(), () => {
            engine().switchToViewAndScroll(album.id, 0, songId, album.id); // opens the album and scrolls to the song
            playSongFromList(songId, album.id);
        });
        return { kind: 'album', albumId: album.id };
    }
    afterShown(openers.page(songId), () => playSongFromList(songId, 'all-songs'));
    return { kind: 'song-page' };
}

/** The artist's page from somewhere that hides the engine's pages (the song page): the Library first, then the artist. */
export function openArtistPage(artistId) {
    if (!openers) throw new Error('openArtistPage() was called before the shell registered its openers');
    afterShown(openers.library(), () => openArtist(artistId));
}

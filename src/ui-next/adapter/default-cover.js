// The default cover for an item with no art: src/assets/default-cover.svg for a song, default-cover-<kind>.svg for the other kinds.
// The Library panel's engine-drawn rows use the same files through adapter/default-covers.css.
//
// The URL is resolved from this module (like the stylesheet does for its url()), never from the page: index.html sets <base href="../">
// for the engine's cover paths, so a plain "../assets/..." in an <img> pointed one folder above the app and showed nothing in Search,
// Recents, Home and the song page.

const FILE = {
    song: 'song',
    'all-songs': 'all-songs',
    favorites: 'liked',
    liked: 'liked',
    playlist: 'playlist',
    folder: 'folder',
    album: 'album',
    artist: 'artist'
};

/** The default cover URL for `kind` (song, all-songs, favorites, playlist, folder, album or artist); anything else gets the song cover. */
export function defaultCover(kind) {
    const file = FILE[kind] && kind !== 'song' ? `default-cover-${FILE[kind]}.svg` : 'default-cover.svg';
    return new URL(`../../assets/${file}`, import.meta.url).href;
}

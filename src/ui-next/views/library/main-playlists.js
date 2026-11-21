// The main playlists (Liked Songs and All Songs): what their page header says besides the name. Pure functions, no DOM, so a unit
// test can import them. song-list.js draws the result; song-list.css ("the main playlists") gives the header its look.

// A fixed rose for Liked Songs (the heart's color). All Songs takes the theme's accent in the CSS, so it has no entry here.
export const MAIN_HUE = { favorites: 346 };

const TAGLINES = { favorites: 'Everything you have hearted.', 'all-songs': 'Your whole library, in one place.' };
const TAGLINES_EMPTY = { favorites: 'Heart a song and it lands here.' };

/** The line under the name of a main playlist ('' for any other list). An empty Liked Songs says how to fill it. */
export const tagline = (kind, songCount) => (!songCount && TAGLINES_EMPTY[kind]) || TAGLINES[kind] || '';

/** 4980 s -> "1 h 23 min"; 90000 s -> "1 d 1 h"; under a minute -> "< 1 min"; 0 -> "". */
export function formatTotal(seconds) {
    const min = Math.floor((Number(seconds) || 0) / 60);
    if (min <= 0) return Number(seconds) > 0 ? '< 1 min' : '';
    if (min < 60) return `${min} min`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return min % 60 ? `${hours} h ${min % 60} min` : `${hours} h`;
    return hours % 24 ? `${Math.floor(hours / 24)} d ${hours % 24} h` : `${Math.floor(hours / 24)} d`;
}

/** "1,284 songs · 3 d 4 h · 212 artists": the songs, then for a main playlist their total time, and for All Songs how many artists (`artists`, counted by the caller). */
export function statLine(kind, songs, artists = 0) {
    const count = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
    const parts = [count(songs.length, 'song')];
    if (kind !== 'favorites' && kind !== 'all-songs') return parts[0];
    const total = formatTotal(songs.reduce((sum, song) => sum + (Number(song.duration) || 0), 0));
    if (total) parts.push(total);
    if (kind === 'all-songs' && artists) parts.push(count(artists, 'artist'));
    return parts.join(' \u00b7 ');
}

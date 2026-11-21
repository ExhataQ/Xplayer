// Which song comes next in the light window's own queue (the files it was opened with). Plain functions with no page in them, so
// tools/tests/logic/light-queue.test.js can run them. Indexes count from 0; -1 means there is no such song.
//
//   shuffle  : songs come in a random order, each once, before any is repeated
//   repeat   : 'off' | 'all' | 'one'. 'one' repeats the song when it ends by itself; pressing Next still moves on.

export const REPEAT_MODES = ['off', 'all', 'one'];

/** The repeat mode after one more press of the button: off, all, one, off... */
export function nextRepeat(mode) {
    const at = Math.max(0, REPEAT_MODES.indexOf(mode)); // anything unknown counts as off
    return REPEAT_MODES[(at + 1) % REPEAT_MODES.length];
}

/**
 * The song to play after `index`. `played` is the set of indexes already played in the current shuffle round (the caller adds each song as
 * it starts and empties the set when a new round begins). `manual` is true when the person pressed Next, false when the song ended.
 */
export function nextIndex({ index, count, shuffle = false, repeat = 'off', played = new Set(), manual = false, random = Math.random }) {
    if (!(count > 0)) return -1;
    if (!manual && repeat === 'one' && index >= 0 && index < count) return index;
    if (shuffle && count > 1) {
        const others = [];
        const fresh = [];
        for (let i = 0; i < count; i++) {
            if (i === index) continue;
            others.push(i);
            if (!played.has(i)) fresh.push(i);
        }
        const pool = fresh.length > 0 ? fresh : repeat === 'all' ? others : [];
        return pool.length > 0 ? pool[Math.floor(random() * pool.length)] : -1;
    }
    if (index + 1 < count) return index + 1;
    return repeat === 'all' ? 0 : -1;
}

/**
 * The same positions after the list of songs changed (the rest of a folder was added behind the song that plays): `index`, the shuffle
 * round's `played` and the `history` are indexes, so each is looked up again by the song's address. A song that is no longer there is dropped.
 */
export function remapQueue({ songs, index, played = new Set(), history = [] }, nextSongs) {
    const place = new Map();
    nextSongs.forEach((song, at) => {
        if (!place.has(song.url)) place.set(song.url, at);
    });
    const map = (i) => (songs[i] && place.has(songs[i].url) ? place.get(songs[i].url) : -1);
    return { index: map(index), played: new Set([...played].map(map).filter((i) => i >= 0)), history: history.map(map).filter((i) => i >= 0) };
}

/**
 * The song to go back to: the one played before this (`history` is the indexes played so far, the last one first to come back),
 * or the one above it in the list. -1 means there is nowhere to go back to, and the caller starts this song again.
 */
export function previousIndex({ index, count, repeat = 'off', history = [] }) {
    if (!(count > 0)) return -1;
    if (history.length > 0) return history[history.length - 1];
    if (index > 0) return index - 1;
    return repeat === 'all' && count > 1 ? count - 1 : -1;
}

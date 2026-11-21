// What one window hands to another when a song moves between the full app and the light window (the Mini Player and the Quick Player).
// Both windows are Xplayer's own pages, but what crosses the process boundary is still checked here: only the fields
// the light window and the queue need, only local files, a limited number of songs, and numbers that are numbers.

const SONG_TEXT_FIELDS = ['title', 'artist', 'album', 'cover', 'largeCover', 'duration'];
const MAX_TEXT = 2000;
const MAX_SONGS = 300;
const VIEWS = ['mini', 'quick'];
const REPEATS = ['off', 'all', 'one'];

function clip(value) {
    return typeof value === 'string' ? value.slice(0, MAX_TEXT) : '';
}

// The part of a song that travels, or null when it is not a playable local file.
function pickSong(song) {
    if (!song || typeof song !== 'object') return null;
    if (typeof song.url !== 'string' || !/^file:\/\//i.test(song.url) || song.url.includes('\0')) return null;
    const picked = { url: song.url.slice(0, MAX_TEXT) };
    for (const field of SONG_TEXT_FIELDS) picked[field] = clip(song[field]);
    if (typeof song.id === 'number' && Number.isFinite(song.id)) picked.id = song.id;
    else if (typeof song.id === 'string') picked.id = song.id.slice(0, 100);
    if (song.external === true) picked.external = true;
    if (song.bare === true) picked.bare = true; // listed from a folder, tags not read yet (electron/open-router.js, bareEntry)
    return picked;
}

function seconds(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

// { songs, startIndex, startAt, paused, view? } for the receiving window, or null when no song in it can be played.
// `payload.songs` is a list; `payload.song` (one song) is accepted too, for the buttons in the full app's player bar.
// `view` ('mini' or 'quick') says which view of the light window should show it; it is left out when the payload has none.
// The index counts the songs that were kept: if the one it pointed at was dropped, it falls back to the first.
function sanitizeHandoff(payload, { maxSongs = MAX_SONGS } = {}) {
    if (!payload || typeof payload !== 'object') return null;
    const source = Array.isArray(payload.songs) ? payload.songs : payload.song ? [payload.song] : [];
    const wanted = Number.isInteger(payload.index) ? payload.index : Number.isInteger(payload.startIndex) ? payload.startIndex : 0;
    const songs = [];
    let startIndex = 0;
    let wantedKept = false;
    source.slice(0, maxSongs).forEach((song, position) => {
        const picked = pickSong(song);
        if (!picked) return;
        if (position === wanted) {
            startIndex = songs.length;
            wantedKept = true;
        }
        songs.push(picked);
    });
    if (songs.length === 0) return null;
    // A synced queue goes on from the song that plays. If that song cannot be shown (a stream, not a file), starting another one would be wrong.
    if (payload.synced === true && !wantedKept) return null;
    const handoff = { songs, startIndex, startAt: seconds(payload.position !== undefined ? payload.position : payload.startAt), paused: payload.paused === true };
    if (VIEWS.includes(payload.view)) handoff.view = payload.view;
    // The full player's own queue travels with its shuffle and repeat, so the light window goes on like the player did (synced: true).
    // Going back, the light window sends only the song that plays, and synced: true tells the full window to find it in its own queue.
    if (payload.synced === true) handoff.synced = true;
    if (REPEATS.includes(payload.repeat)) handoff.repeat = payload.repeat;
    if (typeof payload.shuffle === 'boolean') handoff.shuffle = payload.shuffle;
    return handoff;
}

// ---- Live sync: the full app shows its state to the light window and takes its commands (electron/player-sync.js) ----------------------
// The light window only shows these songs, it does not play them, so a song needs no local file here (a stream from a link shows too).

const COMMANDS = ['toggle', 'play', 'pause', 'next', 'previous', 'seek', 'volume', 'mute', 'shuffle', 'repeat', 'jump', 'play-url'];

function pickShown(song) {
    if (!song || typeof song !== 'object' || typeof song.url !== 'string') return null;
    const picked = { url: song.url.slice(0, MAX_TEXT) };
    for (const field of SONG_TEXT_FIELDS) picked[field] = clip(song[field]);
    if (typeof song.id === 'number' && Number.isFinite(song.id)) picked.id = song.id;
    else if (typeof song.id === 'string') picked.id = song.id.slice(0, 100);
    if (song.bare === true) picked.bare = true;
    return picked;
}

const int = (value, fallback) => (Number.isInteger(value) ? value : fallback);

/**
 * What the full app publishes: the song that plays, where it is, the modes, and (when it changed) the queue around the song.
 * { song, index, position, duration, playing, volume, repeat, shuffle, queue?: { songs, offset, total, rev } }, or null when it is not an object.
 * `index` is the place of the song inside `queue.songs`; `offset` is where that list starts in the player's whole queue.
 */
function sanitizeSnapshot(raw, { maxSongs = MAX_SONGS } = {}) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {
        song: pickShown(raw.song),
        index: int(raw.index, -1),
        position: seconds(raw.position),
        duration: seconds(raw.duration),
        playing: raw.playing === true,
        volume: Math.min(1, Math.max(0, Number.isFinite(Number(raw.volume)) ? Number(raw.volume) : 0)),
        repeat: REPEATS.includes(raw.repeat) ? raw.repeat : 'off',
        shuffle: raw.shuffle === true
    };
    if (raw.queue && typeof raw.queue === 'object' && Array.isArray(raw.queue.songs)) {
        const songs = raw.queue.songs.slice(0, maxSongs).map(pickShown).filter(Boolean);
        out.queue = { songs, offset: Math.max(0, int(raw.queue.offset, 0)), total: Math.max(songs.length, int(raw.queue.total, songs.length)), rev: int(raw.queue.rev, 0) };
    }
    return out;
}

/** What the light window asks the full app to do: { type, value?, index?, rev?, url? }, or null. */
function sanitizeCommand(raw) {
    if (!raw || typeof raw !== 'object' || !COMMANDS.includes(raw.type)) return null;
    const out = { type: raw.type };
    if (raw.type === 'seek' || raw.type === 'volume') {
        const value = Number(raw.value);
        if (!Number.isFinite(value)) return null;
        out.value = raw.type === 'volume' ? Math.min(1, Math.max(0, value)) : Math.max(0, value);
    }
    if (raw.type === 'play-url') {
        // A link to play: http(s), no spaces, of a sane length (the same rule as src/js/core/link-check.js, isHttpLink)
        const link = raw.url;
        if (typeof link !== 'string' || !link || link.length > 2048 || /\s/.test(link)) return null;
        try {
            const { protocol } = new URL(link);
            if (protocol !== 'http:' && protocol !== 'https:') return null;
        } catch (e) {
            return null;
        }
        out.url = link;
    }
    if (raw.type === 'jump') {
        if (!Number.isInteger(raw.index) || raw.index < 0) return null;
        out.index = raw.index;
        out.rev = int(raw.rev, 0);
    }
    return out;
}

module.exports = { pickSong, sanitizeHandoff, sanitizeSnapshot, sanitizeCommand, MAX_SONGS, VIEWS, REPEATS, COMMANDS };

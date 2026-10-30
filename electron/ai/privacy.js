// What may leave the device (decision DP6, recommended default): title, artist, album and
// duration of the songs the request is about. No file paths, no cover art, no lyrics unless a
// task needs them (translation), no folder names from the disk.
//
// Songs are sent with short numbers (1, 2, 3 ...). The model answers with those numbers and the app
// maps them back, so real ids never leave either and a made-up number is caught by validatePlan.

const MAX_SONGS = 1000;
// Above this many songs the table drops the optional tags (genre, year, ...) and keeps title, artist, album, length and the flags, so a
// big library still fits in one request.
const RICH_UP_TO = 400;
const MAX_FIELD = 120;

// Tag fields the model may see for organizing, shuffling and fixing tags (decision DP6, widened by the
// owner: "anything possible" for these jobs). Still never sent: file paths, urls, covers, lyrics, comments,
// copyright and the other free-text or machine fields.
const TEXT_FIELDS = ['title', 'artist', 'album', 'albumArtist', 'composer', 'genre', 'label', 'publisher', 'mood', 'language', 'conductor', 'remixer', 'grouping', 'isrc', 'producer', 'lyricist', 'writer'];
const NUMBER_FIELDS = ['year', 'track', 'trackTotal', 'discNumber', 'discTotal', 'bpm'];
// Read-only signals for shuffling and sorting (the AI cannot change them): rating, play count, and favorite (added by the page).
const SIGNAL_FIELDS = ['rating', 'playCount'];
// Flags the page adds so the assistant sees the whole situation at once: the song playing now, the selected songs and favorites.
const FLAG_FIELDS = ['favorite', 'playing', 'selected'];
const SONG_FIELDS = [...TEXT_FIELDS, ...NUMBER_FIELDS, ...SIGNAL_FIELDS, 'compilation', ...FLAG_FIELDS];
// Lyrics are sent only when a request switches them on ("AI may read lyrics"): a short excerpt of a few songs, never timestamps.
const LYRICS_CHARS = 700;
const LYRICS_MAX_SONGS = 40;

function clean(value) {
    return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, MAX_FIELD);
}

// songs: the app's song objects. detail 'basic' sends title, artist, album and seconds only; 'rich'
// (the default) adds every field in SONG_FIELDS that has a value. Rows carry short numbers (1, 2, 3 ...):
// the model answers with them and the app maps them back, so real ids never leave the device.
function buildSongTable(songs, { max = MAX_SONGS, detail = 'auto', includeLyrics = false } = {}) {
    const list = Array.isArray(songs) ? songs : [];
    const used = list.slice(0, max);
    const rich = detail === 'rich' || (detail === 'auto' && used.length <= RICH_UP_TO);
    const map = new Map();
    const rows = used.map((song, i) => {
        const n = i + 1;
        map.set(n, song.id);
        const row = {
            n,
            title: clean(song.title),
            artist: clean(song.artist),
            album: clean(song.album),
            seconds: Number.isFinite(Number(song.duration)) ? Math.round(Number(song.duration)) : 0
        };
        for (const field of SONG_FIELDS) {
            if (field in row) continue;
            const isFlag = field === 'compilation' || FLAG_FIELDS.includes(field);
            if (!rich && !FLAG_FIELDS.includes(field)) continue; // a big library: flags only
            const value = isFlag ? (song[field] === true || song[field] === 'true' || song[field] === 1 ? 'yes' : '') : clean(song[field]);
            if (value && value !== '0') row[field] = value;
        }
        // Lyrics go to the first LYRICS_MAX_SONGS rows only (the page sorts the playing song and the queue first); the other rows stay.
        if (includeLyrics && i < LYRICS_MAX_SONGS && song.lyrics) {
            const excerpt = String(song.lyrics).replace(/\[[0-9:.]+\]/g, '').replace(/\s*[\r\n]+\s*/g, ' / ').trim().slice(0, LYRICS_CHARS);
            if (excerpt) row.lyrics = excerpt;
        }
        return row;
    });
    return { rows, map, omitted: Math.max(0, list.length - used.length) };
}

// The rest of the picture, next to the song table: the queue in play order, every playlist with its songs and the folders that hold
// playlists. `context` comes from the page as real song ids and names; ids become the table's numbers here, and a song that is not in
// the table is dropped. Names are data, cleaned like the song fields. Returns the lines of text that are sent.
const MAX_QUEUE = 300;
const MAX_PLAYLISTS = 80;
const MAX_PLAYLIST_SONGS = 300;
const MAX_FOLDERS = 40;
function buildContext(context, numberOf) {
    const c = context && typeof context === 'object' ? context : {};
    const number = (id) => numberOf.get(id);
    const list = (ids, cap) => (Array.isArray(ids) ? ids : []).map(number).filter((n) => n !== undefined).slice(0, cap);
    const lines = [];
    const queue = list(c.queue, MAX_QUEUE);
    if (queue.length) lines.push(`Queue (play order, song numbers; the song playing now is at position ${Number.isInteger(c.queueIndex) && c.queueIndex >= 0 ? c.queueIndex + 1 : '?'}): ${queue.join(', ')}`);
    const playlists = (Array.isArray(c.playlists) ? c.playlists : []).slice(0, MAX_PLAYLISTS);
    for (const p of playlists) {
        const name = clean(p && p.name);
        if (!name) continue;
        const songs = list(p.songs, MAX_PLAYLIST_SONGS);
        lines.push(`Playlist "${name}" (${Array.isArray(p.songs) ? p.songs.length : 0} songs): ${songs.length ? songs.join(', ') : 'none of them in the list above'}`);
    }
    for (const f of (Array.isArray(c.folders) ? c.folders : []).slice(0, MAX_FOLDERS)) {
        const name = clean(f && f.name);
        if (!name) continue;
        const inside = (Array.isArray(f.playlists) ? f.playlists : []).map(clean).filter(Boolean);
        lines.push(`Folder "${name}": ${inside.length ? inside.map((n) => `"${n}"`).join(', ') : 'empty'}`);
    }
    return lines;
}

// One row as text: "3. Title | Artist | Album | 200s | genre=Pop | year=1999". The exact text sent,
// so the settings page can show it.
function describeRow(r) {
    const base = `${r.n}. ${r.title} | ${r.artist} | ${r.album} | ${r.seconds}s`;
    const extra = Object.keys(r).filter((k) => !['n', 'title', 'artist', 'album', 'seconds'].includes(k)).map((k) => `${k}=${r[k]}`);
    return extra.length ? `${base} | ${extra.join(' | ')}` : base;
}

const describeOutgoing = (rows) => rows.map(describeRow).join('\n');

// What the settings page and the first-use screen tell the person. Built here so the list can never drift from the code above.
function describePolicy() {
    const example = buildSongTable([{ id: 'example', title: 'Example song', artist: 'Example artist', album: 'Example album', duration: 215, genre: 'Pop', year: 1999, bpm: 120, favorite: true }]).rows;
    return {
        fields: SONG_FIELDS,
        tasks: [
            { task: 'Organizing, shuffling and fixing tags', sends: `Your library, up to ${MAX_SONGS} songs per request (the song playing, the queue and the playlist songs first), each as: title, artist, album, length, and any of these that have a value: ${SONG_FIELDS.join(', ')}. Above ${RICH_UP_TO} songs only the title, artist, album, length and the flags playing, selected and favorite are sent.` },
            { task: 'Knowing what is playing, queued and saved', sends: 'In the same request: the order of the queue and the position of the song playing, the name of each playlist with its songs, and the folders with the playlists inside. Songs are numbers, as above.' },
            { task: 'Translating lyrics', sends: 'The words of each lyrics line. Never the timestamps.' },
            { task: 'Reading lyrics (an optional switch in the chat, off by default)', sends: `Only when you switch it on for a request: the first ${LYRICS_CHARS} characters of the lyrics, without timestamps, of up to ${LYRICS_MAX_SONGS} songs.` },
            { task: 'Chatting', sends: 'Your last few messages and the assistant\'s replies, so it can follow the conversation.' },
            { task: 'Looking up tags online (an optional switch in the chat)', sends: 'Title, artist and album of the first 10 songs go to MusicBrainz, a free public database.' }
        ],
        neverSent: ['File names and folder paths', 'Cover art', 'Lyrics, except for a translation or when you switch on "AI may read lyrics" for a request', 'Comments, copyright and encoder fields', 'Your real song ids (the AI sees numbers 1, 2, 3 ...)'],
        notes: [
            'Requests go from this app to OpenRouter with your own key, and from there to the model you chose.',
            'Free models may keep or learn from what they receive. If a detail of your library is private, do not use AI on it.',
            'The AI can only ask for the actions in the preview. You approve every change, and every change can be undone.'
        ],
        example: describeOutgoing(example)
    };
}

module.exports = { describePolicy, LYRICS_CHARS, LYRICS_MAX_SONGS, MAX_SONGS, RICH_UP_TO, SONG_FIELDS, TEXT_FIELDS, NUMBER_FIELDS, FLAG_FIELDS, buildSongTable, buildContext, describeRow, describeOutgoing };

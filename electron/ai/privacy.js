// What may leave the device (decision DP6, recommended default): title, artist, album and
// duration of the songs the request is about. No file paths, no cover art, no lyrics unless a
// task needs them (translation), no folder names from the disk.
//
// Songs are sent with short numbers (1, 2, 3 ...). The model answers with those numbers and the app
// maps them back, so real ids never leave either and a made-up number is caught by validatePlan.

const MAX_SONGS = 400;
const MAX_FIELD = 120;

// Tag fields the model may see for organizing, shuffling and fixing tags (decision DP6, widened by the
// owner: "anything possible" for these jobs). Still never sent: file paths, urls, covers, lyrics, comments,
// copyright and the other free-text or machine fields.
const TEXT_FIELDS = ['title', 'artist', 'album', 'albumArtist', 'composer', 'genre', 'label', 'publisher', 'mood', 'language', 'conductor', 'remixer', 'grouping', 'isrc', 'producer', 'lyricist', 'writer'];
const NUMBER_FIELDS = ['year', 'track', 'trackTotal', 'discNumber', 'discTotal', 'bpm'];
// Read-only signals for shuffling and sorting (the AI cannot change them): rating, play count, and favorite (added by the page).
const SIGNAL_FIELDS = ['rating', 'playCount'];
const SONG_FIELDS = [...TEXT_FIELDS, ...NUMBER_FIELDS, ...SIGNAL_FIELDS, 'compilation', 'favorite', 'playing'];
// Lyrics are sent only when a request switches them on ("AI may read lyrics"): a short excerpt of a few songs, never timestamps.
const LYRICS_CHARS = 700;
const LYRICS_MAX_SONGS = 40;

function clean(value) {
    return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, MAX_FIELD);
}

// songs: the app's song objects. detail 'basic' sends title, artist, album and seconds only; 'rich'
// (the default) adds every field in SONG_FIELDS that has a value. Rows carry short numbers (1, 2, 3 ...):
// the model answers with them and the app maps them back, so real ids never leave the device.
function buildSongTable(songs, { max = MAX_SONGS, detail = 'rich', includeLyrics = false } = {}) {
    const list = Array.isArray(songs) ? songs : [];
    const used = list.slice(0, includeLyrics ? Math.min(max, LYRICS_MAX_SONGS) : max);
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
        if (detail === 'rich') {
            for (const field of SONG_FIELDS) {
                if (field in row) continue;
                const value = field === 'compilation' || field === 'favorite' || field === 'playing' ? (song[field] === true || song[field] === 'true' || song[field] === 1 ? 'yes' : '') : clean(song[field]);
                if (value && value !== '0') row[field] = value;
            }
        }
        if (includeLyrics && song.lyrics) {
            const excerpt = String(song.lyrics).replace(/\[[0-9:.]+\]/g, '').replace(/\s*[\r\n]+\s*/g, ' / ').trim().slice(0, LYRICS_CHARS);
            if (excerpt) row.lyrics = excerpt;
        }
        return row;
    });
    return { rows, map, omitted: Math.max(0, list.length - used.length) };
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
            { task: 'Organizing, shuffling and fixing tags', sends: `Up to ${MAX_SONGS} songs per request, each as: title, artist, album, length, and any of these that have a value: ${SONG_FIELDS.join(', ')}.` },
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

module.exports = { describePolicy, LYRICS_CHARS, LYRICS_MAX_SONGS, MAX_SONGS, SONG_FIELDS, TEXT_FIELDS, NUMBER_FIELDS, buildSongTable, describeRow, describeOutgoing };

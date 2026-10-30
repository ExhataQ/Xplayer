// Suggests a missing title, artist, album, year or track number WITHOUT the internet and without reading the audio again (task PM-02).
// Three local sources, best evidence first:
//   siblings  other songs of the same folder whose tags already agree (a folder of one album with one untagged file)
//   folders   Artist/Album/file layouts, relative to the music folders the person added
//   filename  "03 - Artist - Title", "Artist - Title", "Title [youtubeId]", site tags and "(Official Video)" removed
// These are SUGGESTIONS. The scan never saves them as the song's tags; the screens show them next to the empty field and the person accepts them
// (see MINI-PLAN-missing-tags.md). A suggestion says where it came from and how sure it is, so the screen can show "from the file name".
// Pure functions: no file access, no Electron. They take paths and already-read tags and return plain objects.

const GENERIC_FOLDERS = new Set([
    'music', 'my music', 'songs', 'song', 'downloads', 'download', 'new folder', 'desktop', 'documents', 'mp3', 'mp3s', 'audio', 'audios',
    'media', 'itunes', 'itunes media', 'unknown', 'unknown artist', 'unknown album', 'various', 'various artists', 'va', 'misc', 'other',
    'new music', 'playlist', 'playlists', 'tracks', 'temp', 'tmp', 'compilations', 'sort', 'unsorted', 'incoming', 'to sort'
]);

const norm = (s) =>
    String(s || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();

const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const segments = (p) => String(p || '').split(/[\\/]+/).filter(Boolean);
const baseOf = (filePath) => {
    const last = segments(filePath).pop() || '';
    const dot = last.lastIndexOf('.');
    return dot > 0 ? last.slice(0, dot) : last;
};

// "(Official Video)", "[HD]", "[www.site.com]", "Title [dQw4w9WgXcQ]" (an 11 character video id added by downloaders). Remixes, "feat." and
// "Live" are real parts of a title and are kept.
const NOISE_WORDS = '(?:official(?:\\s+(?:music|lyric|lyrics))?\\s*(?:video|audio|visuali[sz]er)?|lyrics?(?:\\s+video)?|audio|video|music\\s+video|full\\s+(?:song|video)|hd|hq|4k|free\\s+download|explicit)';
const NOISE_BRACKET = new RegExp(`\\s*[\\(\\[]\\s*${NOISE_WORDS}\\s*[\\)\\]]`, 'giu');
const SITE_TAG = /\s*[\(\[]?\s*(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|net|org|ru|info|biz|fm|cc|me)\b[^\s)\]]*\s*[\)\]]?/giu;
const VIDEO_ID = /\s*\[([A-Za-z0-9_-]{11})\]\s*$/u;

function cleanName(raw) {
    let s = String(raw || '');
    const id = VIDEO_ID.exec(s);
    if (id && /[0-9_-]|[a-z][A-Z]/.test(id[1])) s = s.replace(VIDEO_ID, ''); // "[Remastered]" and other words are not ids
    s = s.replace(NOISE_BRACKET, '');
    if (SITE_TAG.test(s)) s = s.replace(SITE_TAG, ' ');
    SITE_TAG.lastIndex = 0;
    if (!/\s/.test(s) && (s.match(/_/g) || []).length >= 2) s = s.replace(/_/g, ' '); // Artist_-_Title_(live)
    return squash(s).replace(/^[\s\-–—.]+|[\s\-–—.]+$/g, '');
}

// Leading track number: "01 - ", "1. ", "(01) ", "1-03 " (disc-track) and zero padded "01 ". A plain "99 Problems" keeps its number.
function stripTrackNumber(text) {
    let m = /^(\d{1,2})[-.](\d{2,3})\s*[-._)]*\s+(?=\S)/.exec(text);
    if (m) return { track: String(Number(m[2])), disc: String(Number(m[1])), rest: text.slice(m[0].length) };
    m = /^[([](\d{1,3})[)\]]\s*(?=\S)/.exec(text) || /^(\d{1,3})\s*[-.)_]+\s*(?=\S)/.exec(text) || /^(0\d{1,2})\s+(?=\S)/.exec(text);
    if (m) return { track: String(Number(m[1])), disc: '', rest: text.slice(m[0].length) };
    return { track: '', disc: '', rest: text };
}

// "D:\Music" roots the person added; returns the folder names between the root and the file, or null when the file is under none of them.
function foldersBelowRoot(filePath, roots) {
    const all = segments(filePath);
    const dirs = all.slice(0, -1);
    const lower = dirs.map((d) => d.toLowerCase());
    let best = null;
    for (const root of roots || []) {
        const r = segments(root).map((d) => d.toLowerCase());
        if (r.length === 0 || r.length > lower.length) continue;
        if (r.every((part, i) => part === lower[i]) && (!best || r.length > best.length)) best = r;
    }
    return best ? dirs.slice(best.length) : null;
}

function cleanAlbumFolder(name) {
    let album = squash(name);
    let year = '';
    let m = /^(\d{4})\s*[-–.]\s*(.+)$/.exec(album);
    if (m) {
        year = m[1];
        album = m[2];
    }
    m = /^(.+?)\s*[([](\d{4})[)\]]\s*$/.exec(album);
    if (m) {
        album = m[1];
        year = year || m[2];
    }
    album = album.replace(/\s*[([]\s*(?:flac|mp3|web|cd|vinyl|320\s*kbps|v0|lossless)\s*[)\]]/giu, '');
    return { album: squash(album), year };
}

const DISC_FOLDER = /^(?:cd|disc|disk)\s*\d+$/i;

function consensus(values) {
    const filled = values.map((v) => squash(v)).filter(Boolean);
    if (filled.length < 2) return '';
    const counts = new Map();
    for (const v of filled) counts.set(v, (counts.get(v) || 0) + 1);
    const [top, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return count >= 2 && count / filled.length >= 0.75 ? top : '';
}

const RANK = { high: 3, medium: 2, low: 1 };
const SOURCE_RANK = { siblings: 3, folders: 2, filename: 1 }; // breaks a tie in confidence

// filePath: where the song is. have: the tags it already has (only fields that are empty get a suggestion).
// roots: the music folders. siblings: [{ artist, album }] of the other songs saved in the same folder.
// Returns { title?, artist?, album?, year?, track? }, each { value, from, confidence } with from: 'siblings' | 'folders' | 'filename'.
function guessTags(filePath, { have = {}, roots = [], siblings = [] } = {}) {
    const found = {};
    const offer = (field, value, from, confidence) => {
        value = squash(value);
        if (!value || (have[field] && String(have[field]).trim())) return;
        const best = found[field];
        const better = best && (RANK[confidence] > RANK[best.confidence] || (RANK[confidence] === RANK[best.confidence] && SOURCE_RANK[from] > SOURCE_RANK[best.from]));
        if (!best || better) found[field] = { value, from, confidence };
    };

    const below = foldersBelowRoot(filePath, roots);
    const rawDirs = below || segments(filePath).slice(0, -1).slice(-3);
    const dirs = rawDirs.filter((d, i) => !(i === rawDirs.length - 1 && DISC_FOLDER.test(d)));
    const usable = (d) => d && !GENERIC_FOLDERS.has(norm(d)) && norm(d) !== '';
    const albumDir = dirs.length > 0 ? dirs[dirs.length - 1] : '';
    const artistDir = dirs.length > 1 ? dirs[dirs.length - 2] : '';

    // filename
    const cleaned = cleanName(baseOf(filePath));
    const { track, rest } = stripTrackNumber(cleaned);
    const parts = rest.split(/\s+[-–—]\s+/).map(squash).filter(Boolean);
    const knownDirs = [albumDir, artistDir].filter(usable).map(norm);
    if (track) offer('track', track, 'filename', 'medium');
    if (parts.length === 1) {
        offer('title', parts[0], 'filename', 'medium');
    } else if (parts.length === 2) {
        let [first, second] = parts;
        let confidence = 'medium';
        if (knownDirs.includes(norm(second)) && !knownDirs.includes(norm(first))) {
            [first, second] = [second, first]; // "Title - Artist" inside the artist's folder
            confidence = 'high';
        } else if (knownDirs.includes(norm(first))) {
            confidence = 'high';
        }
        offer('artist', first, 'filename', confidence);
        offer('title', second, 'filename', confidence);
    } else if (parts.length >= 3) {
        // "Artist - Album - Title" or "Artist - Title - Remix": not decidable from the name alone
        offer('artist', parts[0], 'filename', 'low');
        offer('title', parts.slice(1).join(' - '), 'filename', 'low');
    }

    // folders: Artist/Album/file. One folder alone is not enough to say whether it is an artist or an album, so it suggests nothing.
    if (usable(albumDir) && usable(artistDir)) {
        const { album, year } = cleanAlbumFolder(albumDir);
        let albumName = album;
        const sameArtist = /^(.+?)\s+[-–—]\s+(.+)$/.exec(album);
        if (sameArtist && norm(sameArtist[1]) === norm(artistDir)) albumName = sameArtist[2];
        const confidence = dirs.length === 2 && below ? 'high' : 'medium';
        offer('artist', artistDir, 'folders', confidence);
        offer('album', albumName, 'folders', confidence);
        if (year) offer('year', year, 'folders', 'medium');
    }

    // siblings
    const albumFromSiblings = consensus(siblings.map((s) => s && s.album));
    if (albumFromSiblings) offer('album', albumFromSiblings, 'siblings', 'high');
    const artistFromSiblings = consensus(siblings.map((s) => s && s.artist));
    if (artistFromSiblings) offer('artist', artistFromSiblings, 'siblings', 'high');

    return found;
}

module.exports = { guessTags, cleanName, stripTrackNumber, foldersBelowRoot, cleanAlbumFolder, consensus, GENERIC_FOLDERS };

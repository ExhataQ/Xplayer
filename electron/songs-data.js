// Reading and replacing the `const SONGS_DATA = [...]` array inside the generated player.js.
//
// The array is found by walking the JSON (skipping over strings), not by a lazy regex, so a
// title, comment or lyric that contains "];" cannot cut it short. Replacement uses slicing, not
// String.replace with a string, so "$$", "$&" and "$'" in song text are written as they are.

const PREFIX = 'const SONGS_DATA = ';

function findSongsArray(content) {
    const text = String(content || '');
    const at = text.indexOf(PREFIX);
    if (at < 0) return null;
    const start = at + PREFIX.length;
    if (text[start] !== '[') return null;

    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (ch === '\\') i++;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '[') depth++;
        else if (ch === ']') {
            depth--;
            if (depth === 0) return { start, end: i + 1 };
        }
    }
    return null;
}

// The songs as an array, or null when player.js has no readable song list.
function parseSongsData(content) {
    const range = findSongsArray(content);
    if (!range) return null;
    try {
        const songs = JSON.parse(String(content).slice(range.start, range.end));
        return Array.isArray(songs) ? songs : null;
    } catch (e) {
        return null;
    }
}

// `content` with the song array replaced by `songsJson` (already a JSON string), or null when
// there is no array to replace.
function replaceSongsData(content, songsJson) {
    const range = findSongsArray(content);
    if (!range) return null;
    const text = String(content);
    return text.slice(0, range.start) + songsJson + text.slice(range.end);
}

module.exports = { findSongsArray, parseSongsData, replaceSongsData };

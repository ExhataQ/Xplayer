// The Sync editor's logic, with no page in it (views/tools/sync-editor.js draws it, tools/tests/logic/ui-next-sync-model.test.js checks it).
//
// A session is one song's work: its lines, which line has the focus, an undo history, and whether it has changed since it was loaded or saved.
// A line is { text, time } (time in seconds, or null while it is not stamped) and may carry `instrumental: true` (a gap, written as ♪).
// Every function here changes the session it is given and returns what the page needs next; none of them reads the clock or the audio.

export const HISTORY_LIMIT = 100;

/** 83.456 -> "01:23.45" (what an .lrc tag holds). Anything that is not a time gives "--:--.--". */
export function formatTime(seconds) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '--:--.--';
    const whole = Math.floor(seconds);
    const hundredths = Math.floor((seconds - whole) * 100);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}.${pad(hundredths)}`;
}

/** "1:23.4", "01:23.45", "83.5" or "83" -> seconds, or null when it is not a time. */
export function parseTime(value) {
    const text = String(value ?? '').trim();
    const match = /^(?:(\d{1,3}):)?(\d{1,3})(?:[.,](\d{1,3}))?$/.exec(text);
    if (!match) return null;
    const minutes = match[1] ? Number(match[1]) : 0;
    const seconds = Number(match[2]);
    if (match[1] && seconds >= 60) return null;
    const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
    return minutes * 60 + seconds + fraction;
}

/** "mm:ss" or "h:mm:ss" (what the library stores for a duration) -> seconds, 0 when unknown. */
export function durationSeconds(text) {
    if (typeof text === 'number') return Number.isFinite(text) && text > 0 ? text : 0;
    const parts = String(text || '').split(':').map(Number);
    if (parts.length < 2 || parts.length > 3 || parts.some((n) => !Number.isFinite(n))) return 0;
    return parts.reduce((total, n) => total * 60 + n, 0);
}

// ---------------------------------------------------------------------------------------------------------------------------- lines

const NOTES = '\u266a\u266b\u266c\u{1F3B5}\u{1F3B6}';
const INSTRUMENTAL_TEXT = new RegExp(`^(?:\\s*[${NOTES}][${NOTES}\\s]*|[${NOTES}\\s]*[(\\[]instrumental[)\\]][${NOTES}\\s]*)$`, 'iu');

/** True for the text of an instrumental break: music notes alone (a lyric file's "sound logo"), "[Instrumental]" or "(Instrumental)", with or without notes. */
export function isInstrumentalText(text) {
    return INSTRUMENTAL_TEXT.test(String(text ?? ''));
}

/** Plain lyrics -> unstamped lines. Blank lines are kept as empty lines, so a verse break survives; trailing blanks are dropped. A line that is only a music note (or [Instrumental]) becomes an instrumental line. */
export function linesFromText(text) {
    const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((line) => (isInstrumentalText(line) ? { text: '', time: null, instrumental: true } : { text: line.trim(), time: null }));
    while (lines.length && !lines[lines.length - 1].text && !lines[lines.length - 1].instrumental) lines.pop();
    return lines;
}

/**
 * What the engine's LRC reader returns ([{ time, text, instrumental? }]) -> lines. A timed line with no words, or only a music note, is a break in
 * the song (LRC files mark intros, solos and sound logos this way), so it becomes an instrumental line instead of an "empty line".
 */
export function linesFromEntries(entries) {
    return (Array.isArray(entries) ? entries : []).map((entry) => {
        const time = Number.isFinite(entry.time) ? entry.time : null;
        const words = String(entry.text ?? '');
        if (entry.instrumental || isInstrumentalText(words) || (time !== null && !words.trim())) return { text: '', time, instrumental: true };
        return { text: words, time };
    });
}

/** Lines -> .lrc text. Unstamped lines are left out; the rest are written in time order. `offset` (seconds) moves every stamp. */
export function toLrc(lines, { title = '', artist = '', album = '', offset = 0 } = {}) {
    const out = [];
    if (title) out.push(`[ti:${title}]`);
    if (artist) out.push(`[ar:${artist}]`);
    if (album) out.push(`[al:${album}]`);
    const stamped = lines.filter((line) => Number.isFinite(line.time)).sort((a, b) => a.time - b.time);
    for (const line of stamped) {
        const shifted = Math.max(0, line.time + (Number(offset) || 0));
        out.push(`[${formatTime(shifted)}]${line.instrumental ? '♪' : line.text}`);
    }
    return out.join('\n');
}

/** Plain text of the lines, one per line (what "Save as .txt" writes). */
export function toPlainText(lines) {
    return lines.map((line) => (line.instrumental ? '♪' : line.text)).join('\n');
}

export function progress(lines) {
    const countable = lines.filter((line) => line.instrumental || line.text.trim());
    return { timed: countable.filter((line) => Number.isFinite(line.time)).length, total: countable.length };
}

/** The line being sung at `time`: the stamped line with the latest time that is not after it. -1 before the first one. */
export function activeLineAt(lines, time) {
    let best = -1;
    lines.forEach((line, index) => {
        if (Number.isFinite(line.time) && line.time <= time && (best === -1 || line.time >= lines[best].time)) best = index;
    });
    return best;
}

/** The first line after `from` that still needs a stamp (blank lines are skipped). -1 when none is left. */
export function nextToStamp(lines, from = -1) {
    for (let i = from + 1; i < lines.length; i++) {
        if (!Number.isFinite(lines[i].time) && (lines[i].text.trim() || lines[i].instrumental)) return i;
    }
    return -1;
}

// ---------------------------------------------------------------------------------------------------------------------------- session

export function createSession(track, lines = []) {
    return { track, lines, focus: -1, offset: 0, source: '', history: [], future: [], dirty: false, savedAt: 0 };
}

const copy = (lines) => lines.map((line) => ({ ...line }));

/** Call before a change: keeps what is there so Undo can bring it back. */
export function remember(session) {
    session.history.push({ lines: copy(session.lines), focus: session.focus });
    if (session.history.length > HISTORY_LIMIT) session.history.shift();
    session.future = [];
    session.dirty = true;
}

export function undo(session) {
    const before = session.history.pop();
    if (!before) return false;
    session.future.push({ lines: copy(session.lines), focus: session.focus });
    session.lines = before.lines;
    session.focus = Math.min(before.focus, session.lines.length - 1);
    session.dirty = true;
    return true;
}

export function redo(session) {
    const next = session.future.pop();
    if (!next) return false;
    session.history.push({ lines: copy(session.lines), focus: session.focus });
    session.lines = next.lines;
    session.focus = Math.min(next.focus, session.lines.length - 1);
    session.dirty = true;
    return true;
}

/** Replaces all lines (loading plain lyrics, a saved variant, a file). `source` names where they came from. */
export function load(session, lines, source = '', offset = 0) {
    remember(session);
    session.lines = lines;
    session.focus = lines.length ? 0 : -1;
    session.offset = offset;
    session.source = source;
}

export function setFocus(session, index) {
    session.focus = index >= 0 && index < session.lines.length ? index : -1;
    return session.focus;
}

/** Stamps the focused line at `time` and moves the focus to the next line that needs one. Returns the stamped index, or -1. */
export function stamp(session, time) {
    const index = session.focus;
    const line = session.lines[index];
    if (!line || !Number.isFinite(time)) return -1;
    remember(session);
    line.time = Math.max(0, Math.round(time * 100) / 100);
    const next = nextToStamp(session.lines, index);
    session.focus = next === -1 ? Math.min(index + 1, session.lines.length - 1) : next;
    return index;
}

export function setTime(session, index, time) {
    const line = session.lines[index];
    if (!line) return false;
    remember(session);
    line.time = time === null ? null : Math.max(0, Math.round(time * 100) / 100);
    return true;
}

/** Moves a line's stamp by `delta` seconds (never below 0). Does nothing for a line without a stamp. */
export function nudge(session, index, delta) {
    const line = session.lines[index];
    if (!line || !Number.isFinite(line.time)) return false;
    return setTime(session, index, Math.max(0, line.time + delta));
}

export function setText(session, index, text) {
    const line = session.lines[index];
    const clean = String(text).replace(/\s+/g, ' ').trim();
    if (!line || clean === line.text) return false;
    if (line.instrumental && !clean) return false; // an instrumental line has no words to clear
    remember(session);
    if (isInstrumentalText(clean)) {
        line.text = '';
        line.instrumental = true;
    } else {
        line.text = clean;
        delete line.instrumental; // typing words on a break makes it a sung line
    }
    return true;
}

/** Inserts an empty line after `index` (-1 puts it first) and focuses it. */
export function insertAfter(session, index) {
    remember(session);
    const at = Math.min(Math.max(index + 1, 0), session.lines.length);
    session.lines.splice(at, 0, { text: '', time: null });
    session.focus = at;
    return at;
}

export function removeLine(session, index) {
    if (!session.lines[index]) return false;
    remember(session);
    session.lines.splice(index, 1);
    session.focus = Math.min(session.focus, session.lines.length - 1);
    return true;
}

/** Splits a line at character `at`: the second half becomes a new unstamped line under it. */
export function splitLine(session, index, at) {
    const line = session.lines[index];
    if (!line || at <= 0 || at >= line.text.length) return false;
    remember(session);
    const rest = line.text.slice(at).trim();
    line.text = line.text.slice(0, at).trim();
    session.lines.splice(index + 1, 0, { text: rest, time: null });
    session.focus = index + 1;
    return true;
}

/** Joins a line with the one above it (the stamp of the upper line is kept). */
export function joinWithPrevious(session, index) {
    const line = session.lines[index];
    const above = session.lines[index - 1];
    if (!line || !above) return false;
    remember(session);
    above.text = `${above.text} ${line.text}`.trim();
    session.lines.splice(index, 1);
    session.focus = index - 1;
    return true;
}

export function toggleInstrumental(session, index) {
    const line = session.lines[index];
    if (!line) return false;
    remember(session);
    if (line.instrumental) delete line.instrumental;
    else line.instrumental = true;
    return true;
}

export function clearStamps(session) {
    if (!session.lines.some((line) => Number.isFinite(line.time))) return false;
    remember(session);
    for (const line of session.lines) line.time = null;
    session.focus = session.lines.length ? 0 : -1;
    return true;
}

export function markSaved(session, now = Date.now()) {
    session.dirty = false;
    session.savedAt = now;
}

// ---------------------------------------------------------------------------------------------------------------------------- tracks

/** A song from the library, the queue or the scanner -> the track the editor works on. */
export function trackFromSong(song, { library = false } = {}) {
    if (!song) return null;
    const url = String(song.url || song.path || '');
    if (!url) return null;
    return {
        key: url,
        id: song.id,
        url,
        title: String(song.title || fileBase(url) || 'Untitled'),
        artist: String(song.artist || ''),
        album: String(song.album || ''),
        cover: song.cover || song.coverUrl || '',
        duration: durationSeconds(song.duration),
        library: Boolean(library)
    };
}

/** "file:///C:/Music/My%20Song.mp3" or "C:\\Music\\My Song.mp3" -> "My Song" */
export function fileBase(url) {
    let name = String(url || '');
    try {
        name = decodeURIComponent(name);
    } catch (error) {
        // a name that is not valid percent-encoding is used as it is
    }
    name = name.split(/[\\/]/).pop() || '';
    return name.replace(/\.[^./\\]+$/, '');
}

const UNSAFE_NAME = /[<>:"/\\|?*\u0000-\u001f]/g;

/** The name a saved file gets: "Artist - Title.lrc" (the title alone when the artist is unknown). */
export function lyricsFileName(track, extension = 'lrc') {
    const base = [track.artist, track.title].filter(Boolean).join(' - ').replace(UNSAFE_NAME, '').trim() || 'lyrics';
    return `${base}.${extension}`;
}

/** Where a song that is not in the library keeps its .lrc by default: next to the audio file, with the same name. '' for a URL that is not a local file. */
export function lrcPathBesideAudio(url) {
    const match = /^file:\/\/\/?(.*)$/i.exec(String(url || ''));
    if (!match) return '';
    let path = match[1];
    try {
        path = decodeURIComponent(path);
    } catch (error) {
        return '';
    }
    if (/^[A-Za-z]:/.test(path) === false && !String(url).startsWith('file:///')) path = `//${path}`; // file://server/share
    else if (/^[A-Za-z]:/.test(path) === false) path = `/${path}`;
    return path.replace(/\.[^./\\]+$/, '') + '.lrc';
}

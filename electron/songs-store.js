// The library's song list, kept in its own file (songs.json) in the output folder next to player.js.
//
// Everything that reads or changes the list goes through here: the main process, the scan process
// and (once, to carry an old library over) the first start after the list moved out of player.js.
//
//   readSongs(dir)          the songs, as an array (never throws; [] when there are none)
//   writeSongs(dir, songs)  replace the list
//   updateSongs(dir, fn)    read, let fn(songs) return the new list (or nothing to leave it), write
//
// Writes go to a temporary file that is then renamed over songs.json, so a crash cannot leave half a
// file, and the previous version is kept as songs.json.bak. A lock file makes two writers (for example
// a tag save and a scan) take turns instead of overwriting each other.

const fs = require('fs');
const path = require('path');
const { parseSongsData } = require('./songs-data');

const FILE_NAME = 'songs.json';
const FORMAT_VERSION = 1;
const LOCK_WAIT_MS = 8000;
const LOCK_STALE_MS = 30000;
const LOCK_EPERM_RETRIES = 5;

function storePath(outputDir) {
    return path.join(outputDir, FILE_NAME);
}

function sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function songsFromParsed(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.songs)) return parsed.songs;
    return null;
}

function readFileSongs(file) {
    try {
        return songsFromParsed(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (e) {
        return null;
    }
}

// An older install kept the list inside player.js ("const SONGS_DATA = [...]").
function readLegacySongs(outputDir) {
    try {
        return parseSongsData(fs.readFileSync(path.join(outputDir, 'player.js'), 'utf8'));
    } catch (e) {
        return null;
    }
}

function readSongs(outputDir) {
    const file = storePath(outputDir);
    if (fs.existsSync(file)) {
        const songs = readFileSongs(file);
        if (songs) return songs;
        // Unreadable: keep the bad file for inspection and fall back to the last good copy.
        try {
            fs.renameSync(file, file + '.corrupt-' + Date.now());
        } catch (e) {
            // Intentionally silent: the fallback below still gives a usable list.
        }
        const backup = readFileSongs(file + '.bak');
        return backup || [];
    }
    const legacy = readLegacySongs(outputDir);
    if (legacy) {
        if (legacy.length > 0) {
            try {
                writeFileAtomic(file, legacy);
            } catch (e) {
                // Intentionally silent: the list is still returned; the move is retried next time.
            }
        }
        return legacy;
    }
    return [];
}

function serialize(songs) {
    return JSON.stringify({ version: FORMAT_VERSION, songs });
}

function writeFileAtomic(file, songs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, serialize(songs), 'utf8');
    try {
        if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
    } catch (e) {
        // Intentionally silent: no backup is better than no save.
    }
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            fs.renameSync(temp, file);
            return;
        } catch (e) {
            lastError = e;
            sleep(40 * (attempt + 1));
        }
    }
    try {
        fs.unlinkSync(temp);
    } catch (e) {
        // Intentionally silent: a leftover temp file is harmless.
    }
    throw lastError;
}

function withLock(outputDir, work) {
    const lock = storePath(outputDir) + '.lock';
    fs.mkdirSync(outputDir, { recursive: true });
    const started = Date.now();
    let fd = null;
    let permRetries = 0;
    while (fd === null) {
        try {
            fd = fs.openSync(lock, 'wx');
        } catch (e) {
            // Windows can report EPERM instead of EEXIST while another process holds or is deleting the lock.
            if (e.code !== 'EEXIST' && e.code !== 'EPERM') throw e;
            let age = 0;
            try {
                age = Date.now() - fs.statSync(lock).mtimeMs;
            } catch (statError) {
                // EPERM is contention only if the lock exists. If it vanished, retry a few times, then surface the error.
                if (e.code === 'EPERM' && (statError.code !== 'ENOENT' || ++permRetries > LOCK_EPERM_RETRIES)) throw e;
                continue; // the lock was just released: try again
            }
            if (age > LOCK_STALE_MS) {
                try {
                    fs.unlinkSync(lock);
                } catch (unlinkError) {
                    // Intentionally silent: someone else removed it first.
                }
                continue;
            }
            if (Date.now() - started > LOCK_WAIT_MS) throw new Error('The song list is busy (another save is running)');
            sleep(25);
        }
    }
    try {
        return work();
    } finally {
        try {
            fs.closeSync(fd);
        } catch (e) {
            // Intentionally silent: the file is removed next.
        }
        try {
            fs.unlinkSync(lock);
        } catch (e) {
            // Intentionally silent: a stale lock is cleared by the next writer.
        }
    }
}

function writeSongs(outputDir, songs) {
    if (!Array.isArray(songs)) throw new Error('writeSongs: expected an array of songs');
    withLock(outputDir, () => writeFileAtomic(storePath(outputDir), songs));
    return true;
}

// Reads the list, calls fn(songs). If fn returns an array that becomes the new list; any other return
// value leaves the file alone. Returns what fn returned.
function updateSongs(outputDir, fn) {
    return withLock(outputDir, () => {
        const result = fn(readSongs(outputDir));
        if (Array.isArray(result)) writeFileAtomic(storePath(outputDir), result);
        return result;
    });
}

module.exports = { FILE_NAME, storePath, readSongs, writeSongs, updateSongs };

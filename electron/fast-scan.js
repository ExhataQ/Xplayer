const fs = require('fs');
const path = require('path');
const { TAG_BUILD_PROFILES, buildSongFromTags, buildCoverFromMetadata, logCoverError, songUrlForPath, fileStamp } = require('./tag-builder');

// The cover phase can be stopped from the app (D41): scanner.js sends 'cancel-covers' over the fork channel. The workers finish the file
// they are on, send what they found, and the scan then ends the normal way, so the library and the covers found so far are saved.
let coversCancelled = false;
if (typeof process.on === 'function' && typeof process.send === 'function') {
    process.on('message', (message) => {
        if (message === 'cancel-covers') coversCancelled = true;
    });
    // A message listener keeps a forked process alive; the scan must still end by itself when its work is done.
    if (process.channel && typeof process.channel.unref === 'function') process.channel.unref();
}

// Scan cache (task PS-02). A saved song has the size and modified time its file had when it was scanned (fileStamp in tag-builder.js).
// A rescan that finds both unchanged reuses the saved song, with its cover, instead of parsing the file again. Songs saved before this
// existed have no stamp and are parsed once. A file that could not be parsed is saved without a stamp, so it is tried again.
function indexSavedSongs(saved) {
    const byUrl = new Map();
    for (const song of Array.isArray(saved) ? saved : []) {
        if (song && typeof song.url === 'string' && Number.isFinite(song.size) && Number.isFinite(song.mtimeMs)) byUrl.set(song.url, song);
    }
    return byUrl;
}

function sameFile(song, stat) {
    const stamp = fileStamp(stat);
    return song.size === stamp.size && song.mtimeMs === stamp.mtimeMs && song.scanFormat === stamp.scanFormat;
}

// Cover paths are saved relative to the output folder ("covers/<name>"); coversFolder is <output>/covers.
function coverFilesPresent(song, coversFolder) {
    const root = path.dirname(coversFolder);
    for (const rel of [song.cover, song.largeCover]) {
        if (typeof rel === 'string' && rel.startsWith('covers/') && !fs.existsSync(path.join(root, rel))) return false;
    }
    return true;
}

// A reused song only goes through the cover phase when it has no cover and was never checked for one, or its cover file is gone.
// coverChecked is set by the cover phase on songs whose file has no picture, so they are not parsed again on every scan.
function needsCoverPass(song, coversFolder) {
    if (song.cover || song.largeCover) return !coverFilesPresent(song, coversFolder);
    return song.coverChecked !== true;
}

function createFastScanner({ walkDir, loadMusicFolders, printProgress }) {
    async function scanCoversConcurrently(allFiles, coversFolder, mm, concurrency, songs, Jimp, onBatch, indexes) {
        const wanted = indexes || allFiles.map((_, i) => i);
        let cursor = 0;
        let completed = 0;
        let foundCount = 0;
        let pending = [];
        const total = wanted.length;

        async function worker() {
            while (cursor < wanted.length && !coversCancelled) {
                const i = wanted[cursor++];
                const filePath = allFiles[i];
                let update = null;
                let parsed = false;
                try {
                    const metadata = await mm.parseFile(filePath, { duration: false, skipCovers: false });
                    const covers = await buildCoverFromMetadata(metadata, coversFolder, Jimp, TAG_BUILD_PROFILES.FULL);
                    parsed = true;
                    if (covers.cover) update = { id: i, ...covers };
                } catch (e) {
                    logCoverError(coversFolder, `cover extraction failed for ${filePath}`, e);
                }
                completed++;
                if (update) {
                    foundCount++;
                    pending.push(update);
                    if (songs[update.id]) Object.assign(songs[update.id], { cover: update.cover, largeCover: update.largeCover });
                } else if (parsed && songs[i]) {
                    songs[i].coverChecked = true; // read fine, no picture: the next scan does not look again
                }
                printProgress(completed, total, 'Extracting covers');
                if (completed % 25 === 0 || completed === total) {
                    onBatch({ processed: completed, total, found: foundCount, updates: pending });
                    pending = [];
                }
            }
        }

        const workers = [];
        for (let w = 0; w < concurrency; w++) workers.push(worker());
        await Promise.all(workers);
        if (coversCancelled && (pending.length > 0 || completed < total)) onBatch({ processed: completed, total, found: foundCount, updates: pending, cancelled: true });
    }

    // savedSongs: the library as saved by the last scan (or null to read every file). Only files that changed, or are new, are parsed.
    async function scanFilesStreamed(allFiles, coversFolder, mm, Jimp, onFastPass, { savedSongs = null } = {}) {
        const total = allFiles.length;
        const songs = new Array(total);
        const saved = indexSavedSongs(savedSongs);
        const needCover = [];
        let index = 0;
        let processed = 0;

        async function worker() {
            while (index < allFiles.length) {
                const i = index++;
                const filePath = allFiles[i];
                let stat = null;
                try {
                    stat = await fs.promises.stat(filePath);
                } catch (e) {
                    // Intentionally silent: a file that cannot be read is parsed below, which falls back to its file name.
                }
                const savedSong = stat && saved.size > 0 ? saved.get(songUrlForPath(filePath)) : null;
                if (savedSong && sameFile(savedSong, stat)) {
                    songs[i] = { ...savedSong, id: i };
                    if (needsCoverPass(songs[i], coversFolder)) {
                        if (!coverFilesPresent(songs[i], coversFolder)) Object.assign(songs[i], { cover: '', largeCover: '' });
                        delete songs[i].coverChecked;
                        needCover.push(i);
                    }
                } else {
                    let metadata = null;
                    try {
                        metadata = await mm.parseFile(filePath, { duration: true, skipCovers: true });
                    } catch (e) {
                        // Intentionally silent: an unreadable/corrupted file shouldn't abort the
                        // scan; buildSongFromTags() below falls back to filename-derived metadata.
                    }
                    songs[i] = await buildSongFromTags({
                        filePath,
                        metadata,
                        coversFolder,
                        id: i,
                        profile: TAG_BUILD_PROFILES.FAST,
                        fileStat: metadata && stat ? stat : null
                    });
                    needCover.push(i);
                }
                processed++;
                printProgress(processed, total, 'Scanning songs');
            }
        }

        const workers = [];
        for (let w = 0; w < 6; w++) workers.push(worker());
        await Promise.all(workers);
        process.stderr.write('FASTRESULT:' + JSON.stringify(songs) + '\n');
        if (onFastPass) onFastPass(songs);
        needCover.sort((a, b) => a - b);
        if (needCover.length > 0) {
            await scanCoversConcurrently(allFiles, coversFolder, mm, 5, songs, Jimp, (batch) => {
                process.stderr.write('COVERBATCH:' + JSON.stringify(batch) + '\n');
            }, needCover);
        }
        return songs;
    }

    async function scanMusicFolderStreamed(folderPath, coversFolder, mm, Jimp, onFastPass, options) {
        const allFiles = [];
        walkDir(folderPath, allFiles);
        return scanFilesStreamed(allFiles, coversFolder, mm, Jimp, onFastPass, options);
    }

    async function scanAllFoldersStreamed(coversFolder, mm, Jimp, onFastPass, options) {
        const allFiles = [];
        for (const folder of loadMusicFolders()) walkDir(folder, allFiles);
        return scanFilesStreamed(allFiles, coversFolder, mm, Jimp, onFastPass, options);
    }

    return { scanMusicFolderStreamed, scanAllFoldersStreamed };
}

module.exports = { createFastScanner, indexSavedSongs, needsCoverPass };

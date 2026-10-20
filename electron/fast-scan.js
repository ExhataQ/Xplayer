const { TAG_BUILD_PROFILES, buildSongFromTags, buildCoverFromMetadata, logCoverError } = require('./tag-builder');

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

function createFastScanner({ walkDir, loadMusicFolders, printProgress }) {
    async function scanCoversConcurrently(allFiles, coversFolder, mm, concurrency, songs, Jimp, onBatch) {
        let index = 0;
        let completed = 0;
        let foundCount = 0;
        let pending = [];
        const total = allFiles.length;

        async function worker() {
            while (index < allFiles.length && !coversCancelled) {
                const i = index++;
                const filePath = allFiles[i];
                let update = null;
                try {
                    const metadata = await mm.parseFile(filePath, { duration: false, skipCovers: false });
                    const covers = await buildCoverFromMetadata(metadata, coversFolder, Jimp, TAG_BUILD_PROFILES.FULL);
                    if (covers.cover) update = { id: i, ...covers };
                } catch (e) {
                    logCoverError(coversFolder, `cover extraction failed for ${filePath}`, e);
                }
                completed++;
                if (update) {
                    foundCount++;
                    pending.push(update);
                    if (songs[update.id]) Object.assign(songs[update.id], { cover: update.cover, largeCover: update.largeCover });
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

    async function scanFilesStreamed(allFiles, coversFolder, mm, Jimp, onFastPass) {
        const total = allFiles.length;
        const songs = new Array(total);
        let index = 0;
        let processed = 0;

        async function worker() {
            while (index < allFiles.length) {
                const i = index++;
                const filePath = allFiles[i];
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
                    profile: TAG_BUILD_PROFILES.FAST
                });
                processed++;
                printProgress(processed, total, 'Scanning songs');
            }
        }

        const workers = [];
        for (let w = 0; w < 6; w++) workers.push(worker());
        await Promise.all(workers);
        process.stderr.write('FASTRESULT:' + JSON.stringify(songs) + '\n');
        if (onFastPass) onFastPass(songs);
        await scanCoversConcurrently(allFiles, coversFolder, mm, 5, songs, Jimp, (batch) => {
            process.stderr.write('COVERBATCH:' + JSON.stringify(batch) + '\n');
        });
        return songs;
    }

    async function scanMusicFolderStreamed(folderPath, coversFolder, mm, Jimp, onFastPass) {
        const allFiles = [];
        walkDir(folderPath, allFiles);
        return scanFilesStreamed(allFiles, coversFolder, mm, Jimp, onFastPass);
    }

    async function scanAllFoldersStreamed(coversFolder, mm, Jimp, onFastPass) {
        const allFiles = [];
        for (const folder of loadMusicFolders()) walkDir(folder, allFiles);
        return scanFilesStreamed(allFiles, coversFolder, mm, Jimp, onFastPass);
    }

    return { scanMusicFolderStreamed, scanAllFoldersStreamed };
}

module.exports = { createFastScanner };

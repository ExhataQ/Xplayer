const { TAG_BUILD_PROFILES, buildSongFromTags } = require('./tag-builder');

function createIncrementalScanner({ walkDir, loadMusicFolders, printProgress, isSilentMode }) {
    async function scanMusicFolderSync(folderPath, coversFolder, mm) {
        const songs = [];
        const allFiles = [];
        try {
            walkDir(folderPath, allFiles);
        } catch (err) {
            return [];
        }

        for (let fileIndex = 0; fileIndex < allFiles.length; fileIndex++) {
            const filePath = allFiles[fileIndex];
            let metadata = null;
            try {
                metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
            } catch (err) {}
            songs.push(await buildSongFromTags({
                filePath,
                metadata,
                coversFolder,
                id: 0,
                profile: TAG_BUILD_PROFILES.INCREMENTAL
            }));
            if (fileIndex % 10 === 0 && !isSilentMode()) {
                printProgress(fileIndex + 1, allFiles.length, 'Scanning songs');
            }
        }
        return songs;
    }

    async function scanAllFolders(coversFolder, mm) {
        const folders = loadMusicFolders();
        if (folders.length === 0) return [];
        const allSongs = [];
        for (let idx = 0; idx < folders.length; idx++) {
            if (!isSilentMode()) console.log(`\n  📁 Scanning folder ${idx + 1}/${folders.length}: ${folders[idx]}`);
            let songs;
            try {
                songs = await scanMusicFolderSync(folders[idx], coversFolder, mm);
            } catch (err) {
                songs = [];
            }
            for (const song of songs || []) {
                song.id = allSongs.length;
                allSongs.push(song);
            }
        }
        return allSongs;
    }

    return { scanAllFolders };
}

module.exports = { createIncrementalScanner };

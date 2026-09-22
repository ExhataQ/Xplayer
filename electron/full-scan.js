const { TAG_BUILD_PROFILES, buildSongFromTags } = require('./tag-builder');

function createFullScanner({ walkDir, printProgress }) {
    async function scanMusicFolder(folderPath, coversFolder, mm) {
        const songs = [];
        const allFiles = [];
        walkDir(folderPath, allFiles);
        const total = allFiles.length;
        let processed = 0;
        for (const filePath of allFiles) {
            let metadata = null;
            try {
                metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
            } catch (e) {}
            songs.push(await buildSongFromTags({
                filePath,
                metadata,
                coversFolder,
                id: songs.length,
                profile: TAG_BUILD_PROFILES.FULL
            }));
            processed++;
            printProgress(processed, total, 'Scanning songs');
        }
        return songs;
    }

    return { scanMusicFolder };
}

module.exports = { createFullScanner };

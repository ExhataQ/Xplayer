const fs = require('fs');
const path = require('path');
const { TAG_BUILD_PROFILES, buildSongFromTags } = require('./tag-builder');

async function scanSingleFile(filePath, coversFolder, mm) {
    let metadata = null;
    try {
        metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
    } catch (e) {}
    return buildSongFromTags({
        filePath,
        metadata,
        coversFolder,
        id: 0,
        profile: TAG_BUILD_PROFILES.SINGLE
    });
}

async function scanMultipleFiles(filePaths, outputDir, mm) {
    const coversFolder = path.join(outputDir, 'covers');
    if (!fs.existsSync(coversFolder)) fs.mkdirSync(coversFolder, { recursive: true });
    const songs = [];
    for (const filePath of filePaths) {
        if (!fs.existsSync(filePath)) continue;
        const song = await scanSingleFile(filePath, coversFolder, mm);
        if (song) {
            song.id = songs.length;
            songs.push(song);
        }
    }
    return songs;
}

module.exports = { scanSingleFile, scanMultipleFiles };

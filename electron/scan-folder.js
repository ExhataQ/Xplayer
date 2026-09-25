const fs = require('fs');
const path = require('path');
const { sanitizeString, sanitizeLyrics, extractAllNativeTags, extractExtendedMetadata } = require('./tag-builder');
const { createIncrementalScanner } = require('./incremental-scan');
const { createFullScanner } = require('./full-scan');
const { createFastScanner } = require('./fast-scan');
const { scanSingleFile, scanMultipleFiles } = require('./single-file-rescan');

const SUPPORTED_FORMATS = [
    '.mp3',
    '.flac',
    '.m4a',
    '.mp4',
    '.aac',
    '.ogg',
    '.opus',
    '.wma',
    '.wav',
    '.aiff',
    '.aif',
    '.ape',
    '.wv'
];

let silentMode = false;
let activeFolders = [];
let foldersConfigPath = null;

// Verbose scan banners/progress (output dir, source folders, counts, written paths) are
// dev-only leftovers from CLI use. They're harmless noise for a normal Electron-triggered
// scan, so they're gated behind DEBUG_SCAN instead of always logging. Set DEBUG_SCAN=1 in
// the environment to see them again when troubleshooting a scan.
const DEBUG_SCAN = process.env.DEBUG_SCAN === '1' || process.env.DEBUG_SCAN === 'true';
function debugLog(...args) {
    if (DEBUG_SCAN) console.log(...args);
}

function getFoldersConfigPath() {
    if (!foldersConfigPath) {
        foldersConfigPath = path.join(__dirname, 'music-folders-config.json');
    }
    return foldersConfigPath;
}

function loadMusicFolders() {
    const configPath = getFoldersConfigPath();
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(data);
            activeFolders = parsed.folders || [];
            return activeFolders;
        }
    } catch (e) {
        // Intentionally silent: missing/corrupt config just falls back to no folders below.
    }
    activeFolders = [];
    return activeFolders;
}

function saveMusicFolders(folders) {
    const configPath = getFoldersConfigPath();
    fs.writeFileSync(
        configPath,
        JSON.stringify(
            {
                folders: folders
            },
            null,
            2
        ),
        'utf-8'
    );
    activeFolders = folders;
}

function addMusicFolder(folderPath) {
    let folders = loadMusicFolders();
    if (!folders.includes(folderPath)) {
        folders.push(folderPath);
        saveMusicFolders(folders);
        return true;
    }
    return false;
}

function removeMusicFolder(folderPath) {
    let folders = loadMusicFolders();
    const index = folders.indexOf(folderPath);
    if (index !== -1) {
        folders.splice(index, 1);
        saveMusicFolders(folders);
        return true;
    }
    return false;
}

function printProgress(current, total, prefix) {
    if (silentMode) return;
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    process.stderr.write(`PROGRESS:${percent}:${prefix}\n`);
}

function walkDir(dir, fileList) {
    const entries = fs.readdirSync(dir, {
        withFileTypes: true
    });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkDir(fullPath, fileList);
        } else if (SUPPORTED_FORMATS.includes(path.extname(entry.name).toLowerCase())) {
            fileList.push(fullPath);
        }
    }
}

const sharedScannerDeps = {
    walkDir,
    loadMusicFolders,
    printProgress,
    isSilentMode: () => silentMode
};
const { scanAllFolders } = createIncrementalScanner(sharedScannerDeps);
const { scanMusicFolder } = createFullScanner(sharedScannerDeps);
const { scanMusicFolderStreamed, scanAllFoldersStreamed } = createFastScanner(sharedScannerDeps);

async function main(folderPath, outputDir, mode, specificFile) {
    const mm = await import('music-metadata');
    let Jimp = null;
    try {
        const jimpModule = await import('jimp');
        Jimp = jimpModule.Jimp || jimpModule.default || jimpModule;
    } catch (e) {
        Jimp = null;
        try {
            fs.appendFileSync(path.join(outputDir, 'jimp-debug.log'), `Jimp failed to load: ${e && e.stack ? e.stack : e}\n`);
        } catch (e2) {
            // Intentionally silent: this is the debug-log write itself failing (e.g. no
            // write permission to outputDir); nothing left to log the failure to.
        }
    }

    if (mode === 'rebuild-all') {
        silentMode = false;
        const coversFolder = path.join(outputDir, 'covers');

        if (!fs.existsSync(coversFolder)) {
            fs.mkdirSync(coversFolder, {
                recursive: true
            });
        }

        const folders = loadMusicFolders();

        if (folders.length === 0) {
            process.stdout.write(
                JSON.stringify({
                    success: true,
                    songs: []
                })
            );
            return;
        }

        debugLog(`\n📁 Output: ${outputDir}`);
        debugLog(`🎶 Sources: ${folders.length} folder(s)`);
        for (const f of folders) {
            debugLog(`     - ${f}`);
        }

        debugLog('\n' + '─'.repeat(60));
        debugLog('📀  SCANNING SONGS & COVERS');
        debugLog('─'.repeat(60));

        const allSongs = await scanAllFolders(coversFolder, mm);

        if (allSongs.length === 0) {
            debugLog('  ℹ️  No supported audio files found');
        }

        debugLog(`\n  ✅  Found ${allSongs.length} songs`);

        debugLog('\n' + '─'.repeat(60));
        debugLog('🎵  STEP 3: GENERATING MUSIC PLAYER');
        debugLog('─'.repeat(60));

        const jsPath = path.join(outputDir, 'player.js');
        const songsJson = JSON.stringify(allSongs);

        if (fs.existsSync(jsPath)) {
            let existingContent = fs.readFileSync(jsPath, 'utf-8');
            existingContent = existingContent.replace(
                /const SONGS_DATA = \[.*?\];/s,
                'const SONGS_DATA = ' + songsJson + ';'
            );
            fs.writeFileSync(jsPath, existingContent, 'utf-8');
        } else {
            fs.writeFileSync(jsPath, 'const SONGS_DATA = ' + songsJson + ';', 'utf-8');
        }

        debugLog(`  ✅  ${jsPath}`);
        debugLog(`  ✅  ${allSongs.length} songs written`);

        const resultJson = JSON.stringify({
            success: true,
            songs: allSongs
        });

        try {
            JSON.parse(resultJson);
        } catch (e) {
            let fixedJson = resultJson.replace(/[\x00-\x1F\x7F]/g, '');
            fixedJson = fixedJson.replace(/\\/g, '/');
            fixedJson = fixedJson.replace(/""/g, '"');
            try {
                JSON.parse(fixedJson);
                process.stdout.write(fixedJson);
                return;
            } catch (e2) {
                process.stdout.write(
                    JSON.stringify({
                        success: false,
                        error: 'Invalid character in song data'
                    })
                );
                return;
            }
        }
        process.stdout.write(resultJson);
        return;
    }

    if (mode === 'rebuild-all-streamed') {
        silentMode = false;
        const streamedCoversFolder = path.join(outputDir, 'covers');
        if (!fs.existsSync(streamedCoversFolder)) {
            fs.mkdirSync(streamedCoversFolder, { recursive: true });
        }

        const folders = loadMusicFolders();
        if (folders.length === 0) {
            process.stdout.write(JSON.stringify({ success: true, songs: [] }));
            return;
        }

        debugLog(`\n📁 Output: ${outputDir}`);
        debugLog(`🎶 Sources: ${folders.length} folder(s)`);
        debugLog('\n' + '─'.repeat(60));
        debugLog('📀  SCANNING SONGS (FAST PASS)');
        debugLog('─'.repeat(60));

        const jsPath = path.join(outputDir, 'player.js');
        function writePlayerJsRebuild(songsToWrite) {
            const songsJson = JSON.stringify(songsToWrite);
            if (fs.existsSync(jsPath)) {
                let existingContent = fs.readFileSync(jsPath, 'utf-8');
                existingContent = existingContent.replace(
                    /const SONGS_DATA = \[.*?\];/s,
                    'const SONGS_DATA = ' + songsJson + ';'
                );
                fs.writeFileSync(jsPath, existingContent, 'utf-8');
            } else {
                fs.writeFileSync(jsPath, `const SONGS_DATA = ${songsJson};`, 'utf-8');
            }
        }

        const allSongs = await scanAllFoldersStreamed(streamedCoversFolder, mm, Jimp, writePlayerJsRebuild);

        if (allSongs.length === 0) {
            debugLog('  ℹ️  No supported audio files found');
        }

        writePlayerJsRebuild(allSongs);

        process.stdout.write(
            JSON.stringify({
                success: true,
                songs: allSongs
            })
        );
        return;
    }

    if (!folderPath || !fs.existsSync(folderPath)) {
        process.stdout.write('ERROR: Folder does not exist\n');
        process.exit(1);
    }

    if (mode === 'metadata-only') {
        silentMode = true;
        if (specificFile && fs.existsSync(specificFile)) {
            const song = await scanSingleFile(specificFile, path.join(outputDir, 'covers'), mm, Jimp);
            process.stdout.write(JSON.stringify(song ? [song] : []));
        } else {
            const songs = await scanMusicFolder(folderPath, path.join(outputDir, 'covers'), mm, Jimp);
            process.stdout.write(JSON.stringify(songs));
        }
        return;
    }

    if (mode === 'full-streamed') {
        const streamedCoversFolder = path.join(outputDir, 'covers');
        if (!fs.existsSync(streamedCoversFolder)) {
            fs.mkdirSync(streamedCoversFolder, { recursive: true });
        }

        debugLog(`\n📁 Output: ${outputDir}`);
        debugLog(`🎶 Source: ${folderPath}`);
        debugLog('\n' + '─'.repeat(60));
        debugLog('📀  SCANNING SONGS (FAST PASS)');
        debugLog('─'.repeat(60));

        const jsPath = path.join(outputDir, 'player.js');
        function writePlayerJs(songsToWrite) {
            const songsJson = JSON.stringify(songsToWrite);
            if (fs.existsSync(jsPath)) {
                let existingContent = fs.readFileSync(jsPath, 'utf-8');
                existingContent = existingContent.replace(
                    /const SONGS_DATA = \[.*?\];/s,
                    'const SONGS_DATA = ' + songsJson + ';'
                );
                fs.writeFileSync(jsPath, existingContent, 'utf-8');
            } else {
                fs.writeFileSync(jsPath, `const SONGS_DATA = ${songsJson};`, 'utf-8');
            }
        }

        const allSongs = await scanMusicFolderStreamed(folderPath, streamedCoversFolder, mm, Jimp, writePlayerJs);

        if (allSongs.length === 0) {
            process.stdout.write('ERROR: No supported audio files found\n');
            process.exit(1);
        }

        writePlayerJs(allSongs);

        process.stdout.write(
            JSON.stringify({
                success: true,
                songs: allSongs
            })
        );
        return;
    }

    const coversFolder = path.join(outputDir, 'covers');
    if (!fs.existsSync(coversFolder))
        fs.mkdirSync(coversFolder, {
            recursive: true
        });

    debugLog(`\n📁 Output: ${outputDir}`);
    debugLog(`🎶 Source: ${folderPath}`);

    debugLog('\n' + '─'.repeat(60));
    debugLog('📀  SCANNING SONGS & COVERS');
    debugLog('─'.repeat(60));

    const allSongs = await scanMusicFolder(folderPath, coversFolder, mm);

    if (allSongs.length === 0) {
        process.stdout.write('ERROR: No supported audio files found\n');
        process.exit(1);
    }

    debugLog(`\n  ✅  Found ${allSongs.length} songs`);

    debugLog('\n' + '─'.repeat(60));
    debugLog('🎵  STEP 3: GENERATING MUSIC PLAYER');
    debugLog('─'.repeat(60));

    const jsPath = path.join(outputDir, 'player.js');

    if (fs.existsSync(jsPath)) {
        let existingContent = fs.readFileSync(jsPath, 'utf-8');
        const songsJson = JSON.stringify(allSongs);
        existingContent = existingContent.replace(
            /const SONGS_DATA = \[.*?\];/s,
            'const SONGS_DATA = ' + songsJson + ';'
        );
        fs.writeFileSync(jsPath, existingContent, 'utf-8');
    } else {
        const songsJson = JSON.stringify(allSongs);
        const jsContent = `const SONGS_DATA = ${songsJson};`;
        fs.writeFileSync(jsPath, jsContent, 'utf-8');
    }

    debugLog(`  ✅  ${jsPath}`);
    debugLog(`  ✅  ${allSongs.length} songs written`);

    process.stdout.write(
        JSON.stringify({
            success: true,
            songs: allSongs
        })
    );
}

// This file doubles as a CLI script (spawned by scanner.js) and, below, as a module that
// tests can require() for its pure helpers. Only run the CLI dispatch when invoked directly
// (`node scan-folder.js ...`), never when require()'d, so requiring it in a test doesn't
// read process.argv or call process.exit.
if (require.main === module) {
    const folderPath = process.argv[2];
    const outputDir = process.argv[3];
    const mode = process.argv[4] || 'full';
    const specificFile = process.argv[5] || null;

    if (!folderPath || !outputDir) {
        process.stdout.write('ERROR: Missing arguments\n');
        process.exit(1);
    }

    if (folderPath === '__files__') {
        import('music-metadata')
            .then((mm) => {
                return scanMultipleFiles(process.argv.slice(5), outputDir, mm);
            })
            .then((songs) => {
                process.stdout.write(JSON.stringify(songs));
            })
            .catch((err) => {
                process.stdout.write(JSON.stringify([]));
                process.exit(1);
            });
    } else if (folderPath === '__rebuild__') {
        import('music-metadata')
            .then((mm) => {
                return main(folderPath, outputDir, mode, specificFile);
            })
            .catch((err) => {
                process.stdout.write(
                    JSON.stringify({
                        success: false,
                        error: err.message
                    })
                );
                process.exit(1);
            });
    } else {
        main(folderPath, outputDir, mode, specificFile).catch((err) => {
            process.stdout.write(
                JSON.stringify({
                    success: false,
                    error: err.message
                })
            );
            process.exit(1);
        });
    }
}

module.exports = {
    sanitizeString,
    sanitizeLyrics,
    extractAllNativeTags,
    extractExtendedMetadata,
    scanSingleFile,
    scanMultipleFiles
};

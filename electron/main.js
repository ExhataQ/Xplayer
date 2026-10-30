const { app, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

let mainWindow = null;
let minimizeOnClose = false;

const { createWindow, saveWindowState, setMinimizeOnClose, switchUi } = require('./window-manager');
const { activeChoice } = require('./ui-entry');
const { showLoadingWindow, updateLoadingProgress, hideLoadingWindow } = require('./loading-window');
const {
    scanDroppedFiles,
    scanDownloadedFile,
    rebuildFromFolders,
    scanFolder,
    cancelCoverSearch
} = require('./scanner');
const {
    getMusicFolders,
    addMusicFolder,
    removeMusicFolder,
    removeMusicFolders,
    getFolderStats,
    updateFolderSongCounts
} = require('./music-folders');
const { getDownloadFolder, saveDownloadFolder, resetDownloadFolder, download, cancelDownload } = require('./downloads');
const { saveLyricsFile, readLyricsFile } = require('./file-operations');
const { searchLyrics, downloadLyricsFile } = require('./online-lyrics');
const { getAudioMetadata, saveAudioMetadata, saveAudioCover } = require('./metadata-editor');
const { createTagService } = require('./tag-service');
const { createTagFinder } = require('./tag-finder');
const { searchOnlineMetadata, getOnlineMetadata } = require('./online-metadata');
const { annotateSearch } = require('./release-rank');
const songsStore = require('./songs-store');
const { configPath: settingsFile, getOutputDir } = require('./storage-paths');
const checks = require('./ipc-checks');
const { readAudioBytes } = require('./audio-bytes');
const { readPeaks, writePeaks } = require('./waveform-peaks');
const { createAiService, registerAiIpc } = require('./ai/ipc');

const thumbarIconPath = path.join(getOutputDir(), 'icons');
const OUTPUT_DIR = getOutputDir();


function updateDeployedSongMetadata(fileUrl, metadata) {
    const fields = ['title','artist','album','albumArtist','composer','genre','year','track','trackTotal','discNumber','discTotal','label','publisher','copyright','comment','conductor','remixer','sortTitle','sortArtist','sortAlbum','sortComposer','grouping','description','bpm','compilation','mood','language','mediaKind','isrc','musicBrainzTrackId','musicBrainzAlbumId','musicBrainzOriginalAlbumId','musicBrainzReleaseGroupId','musicBrainzArtistId','encodedBy','producer','lyricist','writer'];
    const target = String(fileUrl || '').replace(/\\/g, '/');
    let found = false;
    try {
        songsStore.updateSongs(OUTPUT_DIR, (songs) => {
            const song = songs.find((x) => String(x.url || '').replace(/\\/g, '/') === target);
            if (!song) return undefined;
            fields.forEach((key) => { if (metadata[key] !== undefined) song[key] = metadata[key]; });
            found = true;
            return songs;
        });
    } catch (e) { return false; }
    return found;
}

// AI assistant: settings, key, planning and the undo journal (electron/ai/). Off until the person adds a key.
registerAiIpc(ipcMain, createAiService({
    configDir: require('./storage-paths').getConfigDir(),
    safeStorage: require('electron').safeStorage,
    // Free tag candidates from MusicBrainz (the same search the metadata editor uses; it spaces its own requests).
    lookupTags: async (song) => (await searchOnlineMetadata({ fileUrl: `ai:${song.id}`, title: song.title, artist: song.artist, album: song.album, duration: song.duration })).results
}));

// The page asks for the song list once, while it is being set up (see preload.js).
ipcMain.on('songs-store:load', (event) => {
    try { event.returnValue = songsStore.readSongs(OUTPUT_DIR); }
    catch (e) { event.returnValue = []; }
});

ipcMain.handle('search-online-metadata', async (event, params) => {
    try { return annotateSearch(await searchOnlineMetadata(params || {}), params || {}); }
    catch (error) { return { success: false, error: error.message || 'Failed to search MusicBrainz' }; }
});

ipcMain.handle('get-online-metadata', async (event, params) => {
    try { return await getOnlineMetadata(params || {}); }
    catch (error) { return { success: false, error: error.message || 'Failed to fetch MusicBrainz metadata' }; }
});

ipcMain.handle('save-audio-cover', async (event, params) => {
    try {
        if (!checks.isImagePath(params?.imagePath)) return { success: false, error: 'Choose a JPG, PNG, WebP or GIF image' };
        const result = await saveAudioCover(params?.fileUrl, params?.imagePath);
        return result;
    } catch (error) { return { success: false, error: error.message || 'Failed to save cover' }; }
});

ipcMain.handle('choose-cover-image', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Choose cover image', properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg','jpeg','png','webp','gif'] }]
    });
    if (result.canceled || !result.filePaths?.[0]) return { success: false, canceled: true };
    return { success: true, imagePath: result.filePaths[0] };
});

ipcMain.handle('get-audio-metadata', async (event, fileUrl) => {
    try { return await getAudioMetadata(fileUrl); }
    catch (error) { return { success: false, error: error.message || 'Failed to read metadata' }; }
});

// The waveform decodes audio in the page, which cannot read files itself (electron/audio-bytes.js).
ipcMain.handle('read-audio-bytes', async (event, fileUrl) => readAudioBytes(fileUrl));
// Saved peaks, so a track's waveform is not decoded again (electron/waveform-peaks.js). The key is hashed, never used as a path.
ipcMain.handle('waveform-peaks:get', async (event, key) => readPeaks(key));
ipcMain.handle('waveform-peaks:set', async (event, key, bytes) => writePeaks(key, bytes));

ipcMain.handle('save-audio-metadata', async (event, params) => {
    try {
        if (params?.coverPath && !checks.isImagePath(params.coverPath)) return { success: false, error: 'Choose a JPG, PNG, WebP or GIF image' };
        const result = await saveAudioMetadata(params?.fileUrl, params?.metadata || {}, params?.coverPath || '');
        if (result.success) updateDeployedSongMetadata(params?.fileUrl, result.metadata || {});
        return result;
    } catch (error) { return { success: false, error: error.message || 'Failed to save metadata' }; }
});

// Many files at once (the tag sheet): each item is { fileUrl, metadata } where metadata holds only the tags to change. A file that
// fails does not stop the others; every result says what was in the file before, so the caller can undo.
const MAX_SAVE_MANY = 5000;
ipcMain.handle('save-audio-metadata-many', async (event, items) => {
    try {
        if (!Array.isArray(items) || items.length > MAX_SAVE_MANY) return { success: false, error: 'Too many files, or the request is not a list' };
        const clean = items.filter((item) => item && typeof item.fileUrl === 'string' && item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata));
        if (clean.length !== items.length) return { success: false, error: 'Every item needs a fileUrl and a metadata object' };
        const results = await createTagService({ getAudioMetadata, saveAudioMetadata }).writeMany(clean.map(({ fileUrl, metadata }) => ({ fileUrl, metadata })));
        for (const result of results) if (result.success) updateDeployedSongMetadata(result.fileUrl, result.metadata || {});
        return { success: true, results };
    } catch (error) { return { success: false, error: error.message || 'Failed to save metadata' }; }
});

// The multi tag finder (task PD-05). Looks songs up on MusicBrainz, one at a time, and reports what it found per song. It writes nothing:
// the renderer stages the answers in the tag sheet and the person reviews them before anything reaches a file. One run at a time;
// progress goes out on 'find-tags-progress'; 'cancel-find-tags' stops it before the next song.
const MAX_FIND_MANY = 2000;
const FIND_FIELDS = new Set(['album', 'albumArtist', 'year', 'genre', 'label', 'musicBrainzTrackId', 'musicBrainzAlbumId', 'musicBrainzOriginalAlbumId']);
let findRun = null;
ipcMain.handle('find-tags-many', async (event, request) => {
    if (findRun) return { success: false, error: 'A tag search is already running.' };
    const songs = request && request.songs;
    const options = (request && request.options) || {};
    if (!Array.isArray(songs) || songs.length > MAX_FIND_MANY) return { success: false, error: `Send a list of at most ${MAX_FIND_MANY} songs` };
    const wellFormed = (song) => song && (typeof song.id === 'string' || typeof song.id === 'number') && typeof song.fileUrl === 'string' && song.tags && typeof song.tags === 'object' && !Array.isArray(song.tags);
    if (!songs.every(wellFormed)) return { success: false, error: 'Every song needs an id, a fileUrl and a tags object' };
    if (options.rule !== undefined && !['original', 'popular'].includes(options.rule)) return { success: false, error: 'The rule must be "original" or "popular"' };
    const threshold = options.autoThreshold === undefined ? undefined : Number(options.autoThreshold);
    if (threshold !== undefined && !(threshold >= 0 && threshold <= 1)) return { success: false, error: 'autoThreshold must be between 0 and 1' };
    if (options.fields !== undefined && !(Array.isArray(options.fields) && options.fields.every((field) => FIND_FIELDS.has(field)))) return { success: false, error: 'Unknown tag in fields' };
    const run = { cancelled: false };
    findRun = run;
    try {
        const outcome = await createTagFinder().findMany(songs, {
            rule: options.rule === 'popular' ? 'popular' : 'original',
            autoThreshold: threshold,
            fields: options.fields,
            shouldCancel: () => run.cancelled,
            onProgress: ({ done, total, result }) => {
                try { event.sender.send('find-tags-progress', { done, total, decision: result.decision }); } catch (error) { run.cancelled = true; /* the window is gone: nobody is waiting for the rest */ }
            }
        });
        return { success: true, ...outcome };
    } catch (error) { return { success: false, error: error.message || 'The tag search failed' }; } finally { findRun = null; }
});
ipcMain.handle('cancel-find-tags', async () => {
    if (findRun) findRun.cancelled = true;
    return { cancelled: Boolean(findRun) };
});

ipcMain.handle('export-audio-metadata-json', async (event, params) => {
    try {
        const fileUrl = params?.fileUrl;
        const metadata = params?.metadata || {};
        const fileName = path.basename(fileUrl ? decodeURIComponent(new URL(fileUrl).pathname) : 'metadata');
        const defaultName = `${path.parse(fileName).name || 'metadata'}.json`;
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Export metadata',
            defaultPath: defaultName,
            filters: [{ name: 'JSON files', extensions: ['json'] }]
        });
        if (result.canceled || !result.filePath) return { success: false, canceled: true };
        const payload = { schema: 'exhataq-metadata', version: 1, sourceFile: fileName, metadata };
        fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf-8');
        return { success: true, filePath: result.filePath };
    } catch (error) { return { success: false, error: error.message || 'Failed to export metadata' }; }
});

ipcMain.handle('import-audio-metadata-json', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Import metadata',
            properties: ['openFile'],
            filters: [{ name: 'JSON files', extensions: ['json'] }]
        });
        if (result.canceled || !result.filePaths?.[0]) return { success: false, canceled: true };
        const content = fs.readFileSync(result.filePaths[0], 'utf-8');
        const payload = JSON.parse(content);
        const metadata = payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : payload;
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Invalid metadata JSON file');
        return { success: true, metadata, filePath: result.filePaths[0] };
    } catch (error) { return { success: false, error: error.message || 'Failed to import metadata' }; }
});

ipcMain.handle('import-dropped-files', async (event, filePaths, targetView) => {
    const outputDir = getOutputDir();
    const audioPaths = checks.stringList(filePaths).filter(checks.isAudioPath);
    if (audioPaths.length === 0) return { success: false, error: 'No supported audio files' };
    return scanDroppedFiles(audioPaths, outputDir);
});
ipcMain.handle('download-and-scan', async (event, url, isTemp) => {
    if (!checks.isHttpUrl(url)) return { success: false, error: 'Only http and https links can be downloaded' };
    const downloadFolder = isTemp
        ? require('path').join(require('os').tmpdir(), 'music-player-temp')
        : getDownloadFolder();

    const result = await download(url, isTemp, (percent) => {
        if (mainWindow) {
            mainWindow.webContents.executeJavaScript(`
                if (typeof updateDownloadNotification === 'function') {
                    updateDownloadNotification(${percent}, 'Downloading...');
                }
            `);
        }
    });

    if (!result.success) return result;

    const outputDir = getOutputDir();
    const scanResult = await scanDownloadedFile(downloadFolder, outputDir, result.filePath, isTemp);
    return scanResult;
});

// Real cancel for running work (D41). Both answer whether something was running.
ipcMain.handle('cancel-download', async () => ({ cancelled: cancelDownload() }));
ipcMain.handle('cancel-cover-search', async () => ({ cancelled: cancelCoverSearch() }));

ipcMain.handle('search-online-lyrics', async (event, params) => {
    try {
        return await searchLyrics(params || {});
    } catch (error) {
        return { success: false, error: error.message || 'Failed to search LRCLIB' };
    }
});

ipcMain.handle('download-online-lyrics', async (event, params) => {
    try {
        return await downloadLyricsFile(params || {});
    } catch (error) {
        return { success: false, error: error.message || 'Failed to save lyrics' };
    }
});

ipcMain.handle('get-music-folders', async () => {
    const configPath = settingsFile('foldersConfig');
    return getMusicFolders(configPath);
});

ipcMain.handle('add-music-folder', async (event, folderPath) => {
    const configPath = settingsFile('foldersConfig');

    if (folderPath && typeof folderPath === 'string' && folderPath.trim()) {
        if (!checks.isDirectory(folderPath.trim())) return { success: false, reason: 'not-found' };
        return addMusicFolder(configPath, folderPath.trim());
    }

    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Add Music Folder',
        properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return {
            success: false,
            reason: 'cancelled'
        };
    }

    return addMusicFolder(configPath, result.filePaths[0]);
});

ipcMain.handle('remove-music-folder', async (event, folderPath) => {
    const configPath = settingsFile('foldersConfig');
    return removeMusicFolder(configPath, checks.stringList([folderPath])[0] || '');
});

ipcMain.handle('remove-music-folders', async (event, folderPaths) => {
    const configPath = settingsFile('foldersConfig');
    return removeMusicFolders(configPath, checks.stringList(folderPaths));
});

ipcMain.handle('get-folder-stats', async (event, folderPath) => {
    const configPath = settingsFile('foldersConfig');
    return getFolderStats(configPath, checks.isAbsolutePath(folderPath) ? folderPath : '');
});

ipcMain.handle('rebuild-from-folders', async () => {
    const configPath = settingsFile('foldersConfig');
    const folders = getMusicFolders(configPath);

    const outputDir = getOutputDir();
    showLoadingWindow(mainWindow);
    updateLoadingProgress(0, 'Starting scan...', '');

    let result;
    try {
        result = await rebuildFromFolders(outputDir, {
        onStdoutProgress: (percent, stepTitle) => updateLoadingProgress(percent, stepTitle, ''),
        onStderrProgress: (percent, stepTitle) => updateLoadingProgress(percent, stepTitle, ''),
        streamed: true,
        onCoverBatch: (updates) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-cover-batch', updates);
            }
        },
        onScanComplete: (code, info) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-covers-complete', { cancelled: Boolean(info && info.cancelled) });
            }
        }
        });
    } finally {
        hideLoadingWindow();
    }

    if (result.success) {
        updateFolderSongCounts(configPath, folders, result.songs);
    }

    return result;
});
ipcMain.handle('change-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select New Music Folder',
        properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return {
            success: false,
            reason: 'cancelled'
        };
    }

    const selectedFolder = result.filePaths[0];
    const outputDir = getOutputDir();

    showLoadingWindow(mainWindow);
    updateLoadingProgress(0, 'Starting scan...', '');

    let scanResult;
    try {
        scanResult = await scanFolder(selectedFolder, outputDir, {
        onStdoutProgress: (percent, stepTitle) => updateLoadingProgress(percent, stepTitle, ''),
        onStderrProgress: (percent, stepTitle) => updateLoadingProgress(percent, stepTitle, ''),
        trackStepChanges: true,
        streamed: true,
        onCoverBatch: (updates) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-cover-batch', updates);
            }
        },
        onScanComplete: (code, info) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-covers-complete', { cancelled: Boolean(info && info.cancelled) });
            }
        }
        });
    } finally {
        hideLoadingWindow();
    }

    if (scanResult.code === null) {
        return {
            success: false,
            reason: 'spawn-error',
            error: scanResult.parseError ? scanResult.parseError.message : undefined
        };
    }

    if (scanResult.code !== 0) {
        return {
            success: false,
            reason: 'scan-error'
        };
    }

    if (scanResult.parsed && scanResult.parsed.success) {
        if (scanResult.parsed.fastPass && Array.isArray(scanResult.parsed.songs)) {
            return {
                success: true,
                songs: scanResult.parsed.songs
            };
        }
        return {
            success: true,
            songs: songsStore.readSongs(outputDir)
        };
    }

    if (scanResult.parsed) {
        return {
            success: false,
            reason: 'scan-error',
            error: scanResult.parsed.error
        };
    }

    return {
        success: false,
        reason: 'parse-error'
    };

});

app.whenReady().then(async () => {
    ipcMain.handle('get-window-maximized', () => {
        return mainWindow ? mainWindow.isMaximized() : false;
    });

    ipcMain.handle('get-ui-choice', () => activeChoice());
    ipcMain.handle('set-ui-choice', (event, choice) => switchUi(choice));

    ipcMain.on('close-app', () => {
        saveWindowState(mainWindow);
        if (minimizeOnClose) {
            if (mainWindow) mainWindow.minimize();
            return;
        }
        if (mainWindow) {
            mainWindow.close();
        }
        app.quit();
    });

    ipcMain.on('set-minimize-on-close', (event, enabled) => {
        minimizeOnClose = Boolean(enabled);
        setMinimizeOnClose(minimizeOnClose);
    });

    ipcMain.on('minimize-app', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.on('maximize-app', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.on('show-file-in-explorer', (event, filePath) => {
        if (!checks.isAbsolutePath(filePath)) return;
        shell.showItemInFolder(filePath);
    });

    ipcMain.on('delete-file', async (event, filePath) => {
        // Only an absolute path to an existing audio file is moved to the recycle bin.
        try {
            if (!checks.isAudioPath(filePath)) return;
            if (!fs.statSync(filePath).isFile()) return;
            await shell.trashItem(filePath);
        } catch (e) {
            console.error('[delete-file] could not move the file to the recycle bin:', e && e.message);
        }
    });

    ipcMain.on('focus-window', () => {
        if (mainWindow) {
            mainWindow.focus();
            mainWindow.webContents.focus();
        }
    });

    ipcMain.on('update-thumbar-state', (event, isPlaying) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const playIcon = isPlaying
            ? path.join(thumbarIconPath, 'pause.png')
            : path.join(thumbarIconPath, 'play.png');
        mainWindow.setThumbarButtons([
            {
                tooltip: 'Previous',
                icon: path.join(thumbarIconPath, 'prev.png'),
                click: () => {
                    if (mainWindow) mainWindow.webContents.send('thumbar-prev');
                }
            },
            {
                tooltip: isPlaying ? 'Pause' : 'Play',
                icon: playIcon,
                click: () => {
                    if (mainWindow) mainWindow.webContents.send('thumbar-playpause');
                }
            },
            {
                tooltip: 'Next',
                icon: path.join(thumbarIconPath, 'next.png'),
                click: () => {
                    if (mainWindow) mainWindow.webContents.send('thumbar-next');
                }
            }
        ]);
    });

    ipcMain.handle('save-lyrics-file', async (event, defaultName, contents) => {
        return saveLyricsFile(defaultName, contents);
    });

    ipcMain.handle('pick-download-folder', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Download Folder',
            properties: ['openDirectory', 'createDirectory']
        });
        if (result.canceled || result.filePaths.length === 0) {
            return {
                success: false,
                reason: 'cancelled'
            };
        }
        return saveDownloadFolder(result.filePaths[0]);
    });

    ipcMain.handle('get-download-folder', async () => {
        return {
            folder: getDownloadFolder()
        };
    });

    ipcMain.handle('reset-download-folder', async () => {
        return resetDownloadFolder();
    });

    ipcMain.handle('read-lyrics-file', async () => {
        return readLyricsFile();
    });

    ipcMain.handle('welcome-select-folder', async () => {
        const configPath = settingsFile('setupFlag');
        const folderResult = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Music Folder',
            properties: ['openDirectory']
        });

        if (folderResult.canceled || folderResult.filePaths.length === 0) {
            return {
                selected: false
            };
        }

        const selectedFolder = folderResult.filePaths[0];
        fs.writeFileSync(
            configPath,
            JSON.stringify({
                musicFolder: selectedFolder
            }),
            'utf-8'
        );

        showLoadingWindow(mainWindow);
        updateLoadingProgress(0, 'Starting scan...', '');

        const outputDir = getOutputDir();
        try {
        await scanFolder(selectedFolder, outputDir, {
            onStdoutProgress: (percent) => updateLoadingProgress(percent, 'Scanning...', ''),
            stdoutProgressMode: 'simple',
            streamed: true,
            onCoverBatch: (updates) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('scan-cover-batch', updates);
                }
            },
            onScanComplete: (code, info) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('scan-covers-complete', { cancelled: Boolean(info && info.cancelled) });
                }
            }
        });
        } finally {
            hideLoadingWindow();
        }

        mainWindow.webContents.executeJavaScript(`
            location.reload();
        `);

        return {
            selected: true
        };
    });

    const configPath = settingsFile('setupFlag');
    let hasSongs = false;

    try {
        hasSongs = songsStore.readSongs(OUTPUT_DIR).length > 0;
    } catch (e) {
        // Intentionally silent: this is only a peek at the saved library to decide whether to
        // show the empty-library state; if it cannot be read, hasSongs stays false.
    }

    const needsSetup = !fs.existsSync(configPath) && !hasSongs;

    if (needsSetup) {
        mainWindow = createWindow();
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.executeJavaScript(`
                showWelcomeDialog();
            `);
        });

        return;
    }

    if (!needsSetup) {
        mainWindow = createWindow();
    }
});

app.on('window-all-closed', () => {
    app.quit();
});

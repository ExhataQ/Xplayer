const { app, ipcMain, shell, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

// First: point Electron's user-data folder at the data folder (before anything asks for it), see app-paths.js.
const appPaths = require('./app-paths');
appPaths.init(app);
// The same id as build.appId in package.json: Windows groups the taskbar button and keeps its pin and icon under it.
if (process.platform === 'win32' && typeof app.setAppUserModelId === 'function') app.setAppUserModelId('com.exhataq.xplayer');

// A log in the data folder, and one running copy per data folder (the second start only brings the first window forward).
const singleInstance = require('./single-instance');
const { createLogger, hookProcess } = require('./logger');
const appInfo = require('./app-info');
const memoryReport = require('./memory-report');
const { createRecorder } = require('./perf-recorder');
const logger = createLogger({ dir: path.join(appPaths.getDataDir(), 'logs') });
hookProcess(logger, { app });
logger.info(`start ${app.getVersion ? app.getVersion() : ''} mode=${appPaths.getMode()}`);
const gotInstanceLock = singleInstance.acquire(app, () => singleInstance.bringToFront(mainWindow));
if (!gotInstanceLock) {
    logger.info('another copy is already running on this data folder; quitting');
    app.quit();
}

// Hardware acceleration is off, as the app has always run. XPLAYER_GPU=on turns it on for one run: tools/dev/bench-gpu.js uses it to
// measure both ways (phase 6.5 of .agent/archive/dev-plan/DEV-PLAN.md). It is not a setting; the choice waits for those numbers.
const gpuOn = process.env.XPLAYER_GPU === 'on';
if (!gpuOn) app.disableHardwareAcceleration();
logger.info(`hardware acceleration ${gpuOn ? 'on (XPLAYER_GPU=on)' : 'off'}`);

let mainWindow = null;
let minimizeOnClose = false;

const { createWindow, saveWindowState, setMinimizeOnClose, switchUi, openToolWindow } = require('./window-manager');
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
const { getDownloadFolder, saveDownloadFolder, resetDownloadFolder, download, probeUrl, cancelDownload } = require('./downloads');
const { saveLyricsFile, readLyricsFile } = require('./file-operations');
const { searchLyrics, downloadLyricsFile } = require('./online-lyrics');
const { getAudioMetadata, saveAudioMetadata, saveAudioCover, warmUpTagBackend } = require('./metadata-editor');
const { createTagService } = require('./tag-service');
const { createTagFinder } = require('./tag-finder');
const { searchOnlineMetadata, getOnlineMetadata } = require('./online-metadata');
const { annotateSearch } = require('./release-rank');
const songsStore = require('./songs-store');
const { refreshMissingTags } = require('./tag-builder');
const { configPath: settingsFile, getLibraryDir } = require('./storage-paths');
const checks = require('./ipc-checks');
const { readAudioBytes } = require('./audio-bytes');
const mediaProtocol = require('./media-protocol');
// The equalizer needs the music served with a CORS header (electron/media-protocol.js). A scheme must be declared before the app is ready.
mediaProtocol.registerScheme(require('electron').protocol);
const { readCoverThumb } = require('./cover-thumb');
const { readPeaks, writePeaks } = require('./waveform-peaks');
const { createAiService, registerAiIpc } = require('./ai/ipc');
const { registerHostRelay } = require('./ai/host-relay');

const thumbarIconPath = appPaths.getIconsDir();
const LIBRARY_DIR = getLibraryDir();


function updateDeployedSongMetadata(fileUrl, metadata) {
    const fields = ['title','artist','album','albumArtist','composer','genre','year','track','trackTotal','discNumber','discTotal','label','publisher','copyright','comment','conductor','remixer','sortTitle','sortArtist','sortAlbum','sortComposer','grouping','description','bpm','compilation','mood','language','mediaKind','isrc','musicBrainzTrackId','musicBrainzAlbumId','musicBrainzOriginalAlbumId','musicBrainzReleaseGroupId','musicBrainzArtistId','encodedBy','producer','lyricist','writer'];
    const target = String(fileUrl || '').replace(/\\/g, '/');
    let found = false;
    try {
        songsStore.updateSongs(LIBRARY_DIR, (songs) => {
            const song = songs.find((x) => String(x.url || '').replace(/\\/g, '/') === target);
            if (!song) return undefined;
            fields.forEach((key) => { if (metadata[key] !== undefined) song[key] = metadata[key]; });
            refreshMissingTags(song, metadata);
            found = true;
            return songs;
        });
    } catch (e) { return false; }
    return found;
}

// The chat in a window of its own asks the main window for the library, queue and playlists through this relay.
registerHostRelay(ipcMain, { getMainWindow: () => mainWindow });

// AI assistant: settings, key, planning and the undo journal (electron/ai/). Off until the person adds a key.
registerAiIpc(ipcMain, createAiService({
    configDir: require('./storage-paths').getConfigDir(),
    safeStorage: require('electron').safeStorage,
    // Free tag candidates from MusicBrainz (the same search the metadata editor uses; it spaces its own requests).
    lookupTags: async (song) => (await searchOnlineMetadata({ fileUrl: `ai:${song.id}`, title: song.title, artist: song.artist, album: song.album, duration: song.duration })).results
}));

// The page asks for the song list once, while it is being set up (see preload.js).
ipcMain.on('songs-store:load', (event) => {
    try { event.returnValue = songsStore.readSongs(LIBRARY_DIR); }
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
    const started = Date.now();
    try { return await getAudioMetadata(fileUrl); }
    catch (error) { return { success: false, error: error.message || 'Failed to read metadata' }; }
    finally {
        // One file per call. A slow one is written to the log with its name, so a freeze that comes back can be told apart from a slow file.
        const took = Date.now() - started;
        if (took > 1000) console.warn(`[metadata] reading the tags of one file took ${took} ms: ${String(fileUrl).slice(-120)}`);
    }
});

// The waveform decodes audio in the page, which cannot read files itself (electron/audio-bytes.js).
ipcMain.handle('read-audio-bytes', async (event, fileUrl) => readAudioBytes(fileUrl));
// A list's header takes its colors from the cover; the page cannot read a file:// image's pixels, so it gets a small PNG (electron/cover-thumb.js).
ipcMain.handle('read-cover-thumb', async (event, fileUrl) => readCoverThumb(fileUrl, { layout: appPaths.getLayout() }));
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
    const outputDir = getLibraryDir();
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

    const outputDir = getLibraryDir();
    const scanResult = await scanDownloadedFile(downloadFolder, outputDir, result.filePath, isTemp);
    return scanResult;
});

// The name, size and type a link would give, asked with a HEAD request (C2). Never throws: no answer is { success: false }.
ipcMain.handle('probe-url', async (event, url) => {
    if (!checks.isHttpUrl(url)) return { success: false };
    return probeUrl(url);
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

    const outputDir = getLibraryDir();
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
    const outputDir = getLibraryDir();

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
    mediaProtocol.install(require('electron').protocol, require('electron').net);
    if (!gotInstanceLock) return;
    ipcMain.handle('app-info', () => appInfo.getInfo({ app, appPaths }));
    // The LRCLIB site in the normal browser (C6). The address is fixed here, so the page cannot ask for any other one.
    ipcMain.handle('open-lrclib-site', async () => {
        try {
            await shell.openExternal('https://lrclib.net');
            return { success: true };
        } catch (error) {
            return { success: false, error: (error && error.message) || 'Could not open the browser' };
        }
    });
    ipcMain.handle('open-data-folder', async () => {
        const error = await shell.openPath(appInfo.dataFolder(appPaths));
        return error ? { success: false, error } : { success: true };
    });
    // The numbers behind the memory read-out (X1) and the recording (X2). Read-only. A window is named by its file name only, never its title
    // (a title can hold a song name).
    const readMemoryData = () => {
        const { BrowserWindow } = require('electron');
        const pages = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).map((w) => ({
            pid: w.webContents.getOSProcessId(),
            file: path.basename((w.webContents.getURL() || '').split(/[?#]/)[0]),
            ask: (code) => w.webContents.executeJavaScript(code)
        }));
        return memoryReport.collect({ app, pages, dirs: { library: appPaths.getLibraryDir(), data: appPaths.getDataDir() }, startedAt: Date.now() - process.uptime() * 1000 });
    };
    const perfRecorder = createRecorder({ read: readMemoryData, dir: path.join(appPaths.getDataDir(), 'logs'), log: (m) => logger.info(m) });
    if (process.env.XPLAYER_PERF === '1') perfRecorder.start();
    // true starts the recording, false stops it, anything else only asks. It is off at every start unless XPLAYER_PERF=1.
    ipcMain.handle('perf-record', (event, enable) => {
        if (enable === true) perfRecorder.start();
        else if (enable === false) perfRecorder.stop();
        return { success: true, recording: perfRecorder.isRunning() };
    });
    ipcMain.handle('perf-summary', async () => {
        const text = await perfRecorder.summary();
        clipboard.writeText(text);
        return { success: true, recording: perfRecorder.isRunning() };
    });
    ipcMain.handle('copy-diagnostics', async () => {
        // Memory and disk numbers (X1). Read-only; a failure here must never stop the diagnostics text itself.
        let memory = '';
        try {
            memory = memoryReport.formatMemoryReport(await readMemoryData());
        } catch (error) {
            logger.info('diagnostics: the memory read-out failed: ' + ((error && error.message) || error));
        }
        clipboard.writeText(appInfo.buildDiagnostics({ info: appInfo.getInfo({ app, appPaths }), tail: logger.tail(50), memory }));
        return { success: true };
    });
    // Pages ask for covers/<file>; when the library is not the web root they are served from the library's covers folder.
    const { session } = require('electron');
    if (session && session.defaultSession) appPaths.installCoverRoute(session.defaultSession);

    // Running from Source: DevTools, reload on change and the sample seed, when asked for (electron/dev-tools.js). Nothing happens in a packaged build.
    require('./dev-tools').init({ app, BrowserWindow: require('electron').BrowserWindow, root: appPaths.SOURCE_ROOT, userDataDir: app.getPath('userData'), log: (m) => logger.info(m) });

    ipcMain.handle('get-window-maximized', () => {
        return mainWindow ? mainWindow.isMaximized() : false;
    });

    ipcMain.handle('get-ui-choice', () => activeChoice());
    ipcMain.handle('set-ui-choice', (event, choice) => switchUi(choice));
    ipcMain.handle('open-tool-window', (event, tool, songId) => openToolWindow(tool, songId));

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

        const outputDir = getLibraryDir();
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
        hasSongs = songsStore.readSongs(LIBRARY_DIR).length > 0;
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
        // Load the tag library in the background once the page is up, so the first Metadata editor does not wait for it.
        mainWindow.webContents.once('did-finish-load', () => setTimeout(warmUpTagBackend, 4000));
    }
});

app.on('window-all-closed', () => {
    app.quit();
});

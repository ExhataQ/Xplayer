const { app, ipcMain, shell, dialog, clipboard } = require('electron');
require('./ipc-guard').guardIpc(ipcMain, (message) => console.warn(message)); // every handler below answers only the app's own pages
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
const updateCheck = require('./update-check');
const memoryReport = require('./memory-report');
const { createRecorder } = require('./perf-recorder');
const logger = createLogger({ dir: path.join(appPaths.getDataDir(), 'logs') });
hookProcess(logger, { app });
logger.info(`start ${app.getVersion ? app.getVersion() : ''} mode=${appPaths.getMode()}`);
const gotInstanceLock = singleInstance.acquire(app, (argv, workingDirectory) => openRouter.handleSecondStart(argv, workingDirectory));
if (!gotInstanceLock) {
    logger.info('another copy is already running on this data folder; quitting');
    app.quit();
}

// Hardware acceleration is off, as the app has always run. XPLAYER_GPU=on turns it on for one run: tools/dev/bench-gpu.js uses it to
// measure both ways (the development plan, phase 6.5). It is not a setting; the choice waits for those numbers.
const gpuOn = process.env.XPLAYER_GPU === 'on';
if (!gpuOn) app.disableHardwareAcceleration();
logger.info(`hardware acceleration ${gpuOn ? 'on (XPLAYER_GPU=on)' : 'off'}`);

let mainWindow = null;
let minimizeOnClose = false;

const { createWindow, saveWindowState, setMinimizeOnClose, openToolWindow, openLightWindow, onLightClosed, dragLightWindow, getLightWindow, getLightView, setLightView, lightWindowAction, closeLightWindow, setLightPinned, isLightPinned } = require('./window-manager');
const { showLoadingWindow, updateLoadingProgress, hideLoadingWindow } = require('./loading-window');
const scanState = require('./scan-state');
const { findMissingSongs } = require('./missing-files');
// Tells the main window something (scan progress). The window may be gone or not made yet.
const sendToMain = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
};
const {
    scanDroppedFiles,
    scanExternalFiles,
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
const { searchOnlineMetadata, getOnlineMetadata, getCoverPreview } = require('./online-metadata');
const { annotateSearch } = require('./release-rank');
const songsStore = require('./songs-store');
const { refreshMissingTags, songUrlForPath, buildCoverFromMetadata, TAG_BUILD_PROFILES } = require('./tag-builder');
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


// Takes songs out of the saved library by url (slashes compared alike). The other songs keep their ids, so playlists, favourites and ratings stay right.
function removeSongsFromLibrary(urls) {
    const gone = new Set(urls.map((u) => String(u || '').replace(/\\/g, '/')));
    try {
        songsStore.updateSongs(LIBRARY_DIR, (songs) => {
            const kept = songs.filter((s) => !gone.has(String(s.url || '').replace(/\\/g, '/')));
            return kept.length === songs.length ? undefined : kept;
        });
    } catch (e) {
        console.error('[library] could not remove songs from the saved list:', e && e.message);
    }
}

// The saved library (songs.json) is what the app shows after a restart, so a tag save has to be written there in the SAME shape the scanner
// writes it: one text per field (never a list), the scanner's own names for the sort and encoder tags, and the cover as files in covers/.
// Before this, lists were saved as lists, the cover was never saved at all (the old one came back on restart) and a song whose url was
// spelt a little differently was silently skipped.
const SONG_FIELDS = ['title','artist','album','albumArtist','composer','genre','year','track','trackTotal','discNumber','discTotal','label','publisher','copyright','comment','conductor','remixer','sortTitle','sortArtist','sortAlbum','sortComposer','grouping','description','bpm','compilation','mood','language','mediaKind','isrc','musicBrainzTrackId','musicBrainzAlbumId','musicBrainzOriginalAlbumId','musicBrainzReleaseGroupId','musicBrainzArtistId','encodedBy','producer','lyricist','writer'];
// The editor's name -> the name the scanner saves the same tag under.
const SCANNER_NAME = { sortTitle: 'titleSort', sortArtist: 'artistSort', sortAlbum: 'albumSort', encodedBy: 'encoder' };
// Several artists or genres are one text in the library; ';' is what the artist and album groups split on.
const songText = (value) => (Array.isArray(value) ? value.map((x) => String(x).trim()).filter(Boolean).join('; ') : value == null ? '' : String(value));
const looseUrl = (u) => { let s = String(u || '').replace(/\\/g, '/'); try { s = decodeURI(s); } catch (e) { /* not encoded */ } return s.toLowerCase(); };

// The saved file's cover, as the scanner would have saved it (covers/cover_<hash>.<ext> and its small thumbnail). null: nothing to save, or it failed.
async function saveCoverForLibrary(cover) {
    if (!cover || !cover.data) return null;
    try {
        const picture = { data: Buffer.from(cover.data, 'base64'), format: cover.mime || 'image/jpeg', type: 'Cover (front)' };
        const built = await buildCoverFromMetadata({ common: { picture: [picture] } }, path.join(LIBRARY_DIR, 'covers'), null, TAG_BUILD_PROFILES.SINGLE);
        return built && built.largeCover ? built : null;
    } catch (e) {
        console.error('[library] could not save the new cover:', e && e.message);
        return null;
    }
}

// Finds a song by url the way the saved list always did (slashes compared alike, then a looser spelling), but from two
// indexes built once, so a batch of edits does not scan the library per song. The first song wins, as with find().
function makeSongFinder(songs) {
    const exact = new Map();
    const loose = new Map();
    for (const song of songs) {
        const e = String(song.url || '').replace(/\\/g, '/');
        if (!exact.has(e)) exact.set(e, song);
        const l = looseUrl(song.url);
        if (!loose.has(l)) loose.set(l, song);
    }
    return (fileUrl) => exact.get(String(fileUrl || '').replace(/\\/g, '/')) || loose.get(looseUrl(fileUrl));
}

// Writes the edited tags (and a new cover, when there is one) into one saved song. Returns nothing.
function applyMetadataToSong(song, metadata, cover) {
    SONG_FIELDS.forEach((key) => {
        if (metadata[key] === undefined) return;
        const text = songText(metadata[key]);
        song[key] = text;
        if (SCANNER_NAME[key]) song[SCANNER_NAME[key]] = text;
    });
    if (cover) { song.cover = cover.cover; song.largeCover = cover.largeCover; delete song.coverChecked; }
    refreshMissingTags(song, metadata);
}

// Returns { found, cover, largeCover } so the page can show exactly what was saved.
// coverChanged: the save wrote a new cover (only then is one saved to covers/; tag-only saves, many at a time, do not pay for it).
async function updateDeployedSongMetadata(fileUrl, metadata, { coverChanged = false } = {}) {
    metadata = metadata || {};
    const cover = coverChanged ? await saveCoverForLibrary(metadata.cover) : null;
    let found = false;
    try {
        songsStore.updateSongs(LIBRARY_DIR, (songs) => {
            const song = makeSongFinder(songs)(fileUrl);
            if (!song) return undefined;
            applyMetadataToSong(song, metadata, cover);
            found = true;
            return songs;
        });
    } catch (e) {
        console.error('[library] could not save the edited tags to the library:', e && e.message);
        return { found: false };
    }
    if (!found) console.warn('[library] saved the tags but did not find the song in the library: ' + String(fileUrl).slice(-120));
    return { found, ...(cover ? { cover: cover.cover, largeCover: cover.largeCover } : {}) };
}

// Many tag saves at once (the tag sheet): ONE read, ONE write of songs.json for the whole batch. The per-song version read, parsed,
// wrote and copied the whole library for every song, on the main process, so 500 songs froze the app for many seconds.
// entries: [{ fileUrl, metadata }] (tag-only: no cover). Returns how many songs were found and changed.
function updateDeployedSongMetadataMany(entries) {
    let changed = 0;
    if (!entries.length) return changed;
    try {
        songsStore.updateSongs(LIBRARY_DIR, (songs) => {
            const find = makeSongFinder(songs);
            const missing = [];
            for (const { fileUrl, metadata } of entries) {
                const song = find(fileUrl);
                if (!song) { missing.push(fileUrl); continue; }
                applyMetadataToSong(song, metadata || {}, null);
                changed++;
            }
            if (missing.length) console.warn(`[library] saved the tags but did not find ${missing.length} song(s) in the library, e.g. ` + String(missing[0]).slice(-120));
            return changed ? songs : undefined;
        });
    } catch (e) {
        console.error('[library] could not save the edited tags to the library:', e && e.message);
        return 0;
    }
    return changed;
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

// The list that openFullWindow read to decide whether this is a first start, kept for the page's own request just below: a start then reads and
// parses the saved library once instead of twice. It is handed over once, and only when songs.json is exactly as it was when it was read.
let startupLibrary = null;

// The page asks for the song list once, while it is being set up (see preload.js).
ipcMain.on('songs-store:load', (event) => {
    const peeked = startupLibrary;
    startupLibrary = null;
    try {
        if (peeked && peeked.stamp && peeked.stamp === songsStore.fileStamp(LIBRARY_DIR)) event.returnValue = peeked.songs;
        else event.returnValue = songsStore.readSongs(LIBRARY_DIR);
    }
    catch (e) { event.returnValue = []; }
});

ipcMain.handle('search-online-metadata', async (event, params) => {
    try { return annotateSearch(await searchOnlineMetadata(params || {}), params || {}); }
    catch (error) { return { success: false, error: error.message || 'Failed to search MusicBrainz' }; }
});

ipcMain.handle('get-online-cover-preview', async (event, params) => {
    try { return await getCoverPreview(params || {}); }
    catch (error) { return { success: false }; }
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
    if (scanState.isBusy()) return scanState.busyResult();
    try {
        if (params?.coverPath && !checks.isImagePath(params.coverPath)) return { success: false, error: 'Choose a JPG, PNG, WebP or GIF image' };
        const result = await saveAudioMetadata(params?.fileUrl, params?.metadata || {}, params?.coverPath || '');
        if (result.success) {
            // `library` tells the page what the saved library now holds (the cover files), so it shows the same thing a restart will.
            const library = await updateDeployedSongMetadata(params?.fileUrl, result.metadata || {}, { coverChanged: Boolean(params?.coverPath) });
            return { ...result, library };
        }
        return result;
    } catch (error) { return { success: false, error: error.message || 'Failed to save metadata' }; }
});

// Many files at once (the tag sheet): each item is { fileUrl, metadata } where metadata holds only the tags to change. A file that
// fails does not stop the others; every result says what was in the file before, so the caller can undo.
const MAX_SAVE_MANY = 5000;
ipcMain.handle('save-audio-metadata-many', async (event, items) => {
    if (scanState.isBusy()) return scanState.busyResult();
    try {
        if (!Array.isArray(items) || items.length > MAX_SAVE_MANY) return { success: false, error: 'Too many files, or the request is not a list' };
        const clean = items.filter((item) => item && typeof item.fileUrl === 'string' && item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata));
        if (clean.length !== items.length) return { success: false, error: 'Every item needs a fileUrl and a metadata object' };
        const results = await createTagService({ getAudioMetadata, saveAudioMetadata }).writeMany(clean.map(({ fileUrl, metadata }) => ({ fileUrl, metadata })));
        updateDeployedSongMetadataMany(results.filter((result) => result.success).map((result) => ({ fileUrl: result.fileUrl, metadata: result.metadata || {} })));
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

// ---- Audio files opened from Windows ("Open with", a double-click) --------------------------------------------------
// electron/open-router.js decides which window plays them: the full window, the light window (the Mini Player or the Quick Player),
// or a new one (by the saved open mode). The files are played without being added to the library. The files named on the command
// line of this start wait in the router until the first page asks for them.
const openFiles = require('./open-files');
const openMode = require('./open-mode');
const lightHandoff = require('./light-handoff');
const { createOpenRouter } = require('./open-router');
// The "Open files" dialog of the light window: music files only, starting in the Music folder.
async function chooseAudioFiles(parentWindow) {
    const parent = parentWindow || getLightWindow();
    const options = {
        title: 'Open music files',
        defaultPath: app.getPath('music'),
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Music', extensions: [...checks.AUDIO_EXTENSIONS].map((extension) => extension.slice(1)) },
            { name: 'All files', extensions: ['*'] }
        ]
    };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
}
// The "Open folder" dialog: one folder, whose music files become the queue.
async function chooseAudioFolder(parent) {
    const options = { title: 'Open a folder of music', defaultPath: app.getPath('music'), properties: ['openDirectory'] };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    return result.canceled || result.filePaths.length === 0 ? '' : result.filePaths[0];
}
let openFullWindow = null; // set when the app is ready: opening the full window needs the saved-library check below
const openRouter = createOpenRouter({
    ipcMain,
    scan: (paths) => scanExternalFiles(paths, getLibraryDir()),
    windows: {
        full: () => mainWindow,
        light: () => getLightWindow(),
        openFull: () => openFullWindow(),
        openLight: (view) => openLightWindow(view),
        closeLight: closeLightWindow,
        setLightView,
        lightWindowAction,
        chooseFiles: chooseAudioFiles,
        chooseFolder: chooseAudioFolder,
        lightView: getLightView,
        setLightPinned,
        isLightPinned
    },
    bringToFront: singleInstance.bringToFront,
    readMode: () => openMode.readOpenMode(),
    writeMode: (mode) => openMode.writeOpenMode(mode),
    lightViewOf: openMode.lightViewOf,
    openFiles,
    checks,
    handoff: lightHandoff,
    sync: { stopMusicWhenClosed: (flag, openedUrl) => playerSync.stopMusicWhenClosed(flag, openedUrl), fullReady: () => playerSync.fullReady() }, // (playerSync is made just below; this is only called later)
    // The audio files next to a file that was opened (the light window's folder queue)
    listFolder: async (dir) => (await fs.promises.readdir(dir, { withFileTypes: true })).filter((entry) => entry.isFile() && checks.isAudioPath(entry.name)).map((entry) => path.join(dir, entry.name)),
    log: (message) => logger.info(message)
});
openRouter.registerIpc();
const playerSync = require('./player-sync').createPlayerSync({ ipcMain, windows: { full: () => mainWindow, light: () => getLightWindow() }, handoff: lightHandoff, log: (message) => logger.info(message) });
playerSync.registerIpc();
onLightClosed(() => playerSync.closed());
ipcMain.on('light:drag', (event, request) => {
    const light = getLightWindow();
    if (!light || light.isDestroyed() || event.sender.id !== light.webContents.id || !request || !['start', 'move', 'end'].includes(request.phase)) return;
    dragLightWindow(request.phase, Number(request.dx), Number(request.dy));
});
openRouter.addPending(openFiles.audioPathsFromArgv(process.argv, process.cwd()));

ipcMain.handle('import-dropped-files', async (event, filePaths, targetView) => {
    if (scanState.isBusy()) return scanState.busyResult();
    const outputDir = getLibraryDir();
    const audioPaths = checks.stringList(filePaths).filter(checks.isAudioPath);
    if (audioPaths.length === 0) return { success: false, error: 'No supported audio files' };
    return scanDroppedFiles(audioPaths, outputDir);
});
ipcMain.handle('download-and-scan', async (event, url, isTemp) => {
    if (scanState.isBusy()) return scanState.busyResult();
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
        return { success: false, error: error.message || 'Failed to search LRCLIB', rateLimited: Boolean(error && error.rateLimited) };
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
    const scan = scanState.tryStart('rebuild', sendToMain);
    if (!scan) return scanState.busyResult();
    const configPath = settingsFile('foldersConfig');
    const folders = getMusicFolders(configPath);

    const outputDir = getLibraryDir();

    // The scan runs in the background: the page shows its progress in the notifications and the person can keep using the app. The gate is held
    // until the scan process ends (it keeps writing the library while it reads covers), or right away when the scan failed.
    let result;
    try {
        result = await rebuildFromFolders(outputDir, {
        onStdoutProgress: (percent, stepTitle) => scan.progress(percent, stepTitle),
        onStderrProgress: (percent, stepTitle) => scan.progress(percent, stepTitle),
        streamed: true,
        onCoverBatch: (updates) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-cover-batch', updates);
            }
        },
        onScanComplete: (code, info) => {
            scan.release();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-covers-complete', { cancelled: Boolean(info && info.cancelled) });
            }
        }
        });
    } finally {
        if (!result || !result.success) scan.release();
    }

    if (result.success) {
        updateFolderSongCounts(configPath, folders, result.songs);
    }

    return result;
});
ipcMain.handle('change-folder', async () => {
    if (scanState.isBusy()) return scanState.busyResult();
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

    const scan = scanState.tryStart('change-folder', sendToMain);
    if (!scan) return scanState.busyResult();

    let scanResult;
    try {
        scanResult = await scanFolder(selectedFolder, outputDir, {
        onStdoutProgress: (percent, stepTitle) => scan.progress(percent, stepTitle),
        onStderrProgress: (percent, stepTitle) => scan.progress(percent, stepTitle),
        trackStepChanges: true,
        streamed: true,
        onCoverBatch: (updates) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-cover-batch', updates);
            }
        },
        onScanComplete: (code, info) => {
            scan.release();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-covers-complete', { cancelled: Boolean(info && info.cancelled) });
            }
        }
        });
    } finally {
        if (!(scanResult && scanResult.code === 0 && scanResult.parsed && scanResult.parsed.success)) scan.release();
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
    // Tell Windows which icon audio files get, that Xplayer can open them, and give Xplayer a page in Settings > Default apps. Never throws and
    // never waits; see electron/file-types.js.
    require('./file-types').registerFileTypes({
        mode: appPaths.getMode(),
        exePath: process.execPath,
        iconPath: path.join(appPaths.SOURCE_ROOT, 'src', 'assets', 'app-icon', 'audio-file.ico'),
        dataDir: appPaths.getDataDir(),
        log: (m) => logger.info(m)
    });
    ipcMain.handle('app-info', () => appInfo.getInfo({ app, appPaths }));
    // Settings > Data > About > Check for updates: asks GitHub only when the button is pressed. The page it opens is fixed here.
    ipcMain.handle('check-for-updates', () => updateCheck.checkForUpdates({ current: app.getVersion() }));
    ipcMain.handle('open-releases-page', async () => {
        try {
            await shell.openExternal(updateCheck.RELEASES_PAGE);
            return { success: true };
        } catch (error) {
            return { success: false, error: (error && error.message) || 'Could not open the browser' };
        }
    });
    // The LRCLIB site in the normal browser (C6). The address is fixed here, so the page cannot ask for any other one.
    ipcMain.handle('open-lrclib-site', async () => {
        try {
            await shell.openExternal('https://lrclib.net');
            return { success: true };
        } catch (error) {
            return { success: false, error: (error && error.message) || 'Could not open the browser' };
        }
    });
    // Xplayer's own page in Windows' Default apps, where the person chooses it for music files (Windows 11 opens the page named by
    // registeredAppUser; an older Windows shows the general page). Windows does not let an app make itself the default, so this only opens the
    // page. The addresses are fixed here, so the page cannot ask for any other one.
    ipcMain.handle('open-default-apps', async () => {
        if (process.platform !== 'win32') return { success: false, error: 'Only on Windows' };
        try {
            await shell.openExternal('ms-settings:defaultapps?registeredAppUser=' + encodeURIComponent(require('./file-types').APP_NAME));
            return { success: true };
        } catch (error) {
            try {
                await shell.openExternal('ms-settings:defaultapps');
                return { success: true };
            } catch (second) {
                return { success: false, error: (second && second.message) || 'Could not open Windows settings' };
            }
        }
    });
    // How many music file types open with Xplayer now ({ total, ours }, or null away from Windows). Read-only.
    ipcMain.handle('default-app-status', () => require('./file-types').defaultStatus({ exePath: process.execPath }).catch(() => null));
    ipcMain.handle('open-data-folder', async () => {
        const error = await shell.openPath(appInfo.dataFolder(appPaths));
        return error ? { success: false, error } : { success: true };
    });
    // Help > Open logs and Settings > Diagnostics: the folder with main.log (and perf.csv). It is made first so a fresh start has something to open.
    // The path is fixed here, so the page cannot ask for any other one.
    ipcMain.handle('open-logs-folder', async () => {
        const dir = appInfo.logsFolder(appPaths);
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (_) {
            // openPath below reports the problem
        }
        const error = await shell.openPath(dir);
        return error ? { success: false, error } : { success: true };
    });
    // The log viewer (Help > Open logs): the last lines, already redacted here. Read-only, takes nothing from the page.
    ipcMain.handle('read-log', () => ({ lines: appInfo.readLog({ logger }) }));
    // The project page in the normal browser (Help > About). The address is fixed here, so the page cannot ask for any other one.
    ipcMain.handle('open-project-site', async () => {
        try {
            await shell.openExternal('https://github.com/ExhataQ/Xplayer');
            return { success: true };
        } catch (error) {
            return { success: false, error: (error && error.message) || 'Could not open the browser' };
        }
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
            removeSongsFromLibrary([songUrlForPath(filePath)]); // the saved library forgets it too, or it would come back at the next start
        } catch (e) {
            console.error('[delete-file] could not move the file to the recycle bin:', e && e.message);
        }
    });

    // Songs whose file is gone (deleted outside the app, or by an older version that never told the saved library): found and removed once the app is up.
    ipcMain.handle('prune-missing-songs', async () => {
        if (scanState.isBusy()) return { removed: [] };
        try {
            const missing = await findMissingSongs(songsStore.readSongs(LIBRARY_DIR));
            if (missing.length) removeSongsFromLibrary(missing);
            return { removed: missing };
        } catch (e) {
            console.error('[prune-missing-songs] failed:', e && e.message);
            return { removed: [] };
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

        if (scanState.isBusy()) return { selected: false };
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
        const scan = scanState.tryStart('welcome', sendToMain);
        let welcomeScan;
        try {
        welcomeScan = await scanFolder(selectedFolder, outputDir, {
            onStdoutProgress: (percent) => updateLoadingProgress(percent, 'Scanning...', ''),
            stdoutProgressMode: 'simple',
            streamed: true,
            onCoverBatch: (updates) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('scan-cover-batch', updates);
                }
            },
            onScanComplete: (code, info) => {
                if (scan) scan.release();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('scan-covers-complete', { cancelled: Boolean(info && info.cancelled) });
                }
            }
        });
        } finally {
            hideLoadingWindow();
            if (scan && !(welcomeScan && welcomeScan.code === 0 && welcomeScan.parsed && welcomeScan.parsed.success)) scan.release();
        }

        mainWindow.webContents.executeJavaScript(`
            location.reload();
        `);

        return {
            selected: true
        };
    });

    const configPath = settingsFile('setupFlag');

    // Opens the full window. Whether this is a first start (the welcome dialog) is checked when it is needed, not at start-up:
    // a start that only opens the Mini Player or the Quick Player never reads the song list.
    openFullWindow = () => {
        let hasSongs = false;
        try {
            const stamp = songsStore.fileStamp(LIBRARY_DIR); // taken before the read: a write in between makes the stamp stale, which only costs a second read
            const songs = songsStore.readSongs(LIBRARY_DIR);
            hasSongs = songs.length > 0;
            startupLibrary = { songs, stamp };
        } catch (e) {
            // Intentionally silent: this is only a peek at the saved library to decide whether to
            // show the empty-library state; if it cannot be read, hasSongs stays false.
        }
        const needsSetup = !fs.existsSync(configPath) && !hasSongs;
        mainWindow = createWindow();
        if (needsSetup) {
            // A first start that was opened with a music file plays it right away; the welcome dialog waits for the next start.
            if (openRouter.pendingCount() === 0) {
                mainWindow.webContents.on('did-finish-load', () => {
                    mainWindow.webContents.executeJavaScript(`
                        showWelcomeDialog();
                    `);
                });
            }
        } else {
            // Load the tag library in the background once the page is up, so the first Metadata editor does not wait for it.
            mainWindow.webContents.once('did-finish-load', () => setTimeout(warmUpTagBackend, 4000));
        }
        return mainWindow;
    };

    // The first window: the Mini Player or the Quick Player when Xplayer was opened with a music file and that is the saved choice, otherwise the full window.
    openRouter.start();
});

app.on('window-all-closed', () => {
    app.quit();
});

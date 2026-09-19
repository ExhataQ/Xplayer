const { app, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

let mainWindow = null;
let minimizeOnClose = false;

const { createWindow, saveWindowState, setMinimizeOnClose } = require('./window-manager');
const { showLoadingWindow, updateLoadingProgress, hideLoadingWindow } = require('./loading-window');
const {
    scanDroppedFiles,
    scanDownloadedFile,
    rebuildFromFolders,
    scanFolder
} = require('./scanner');
const {
    getMusicFolders,
    addMusicFolder,
    removeMusicFolder,
    removeMusicFolders,
    getFolderStats,
    updateFolderSongCounts
} = require('./music-folders');
const { getDownloadFolder, saveDownloadFolder, resetDownloadFolder, download } = require('./downloads');
const { saveLyricsFile, readLyricsFile } = require('./file-operations');
const { searchLyrics, downloadLyricsFile } = require('./online-lyrics');
const { getAudioMetadata, saveAudioMetadata, saveAudioCover } = require('./metadata-editor');
const { searchOnlineMetadata, getOnlineMetadata } = require('./online-metadata');


function updateDeployedSongMetadata(fileUrl, metadata) {
    const playerJsPath = path.join(__dirname, 'MusicPlayerOutput', 'player.js');
    try {
        if (!fs.existsSync(playerJsPath)) return false;
        const content = fs.readFileSync(playerJsPath, 'utf-8');
        const match = content.match(/const SONGS_DATA = (\[.*?\]);/s);
        if (!match) return false;
        const songs = JSON.parse(match[1]);
        const target = String(fileUrl || '').replace(/\\/g, '/');
        const song = songs.find((x) => String(x.url || '').replace(/\\/g, '/') === target);
        if (!song) return false;
        const fields = ['title','artist','album','albumArtist','composer','genre','year','track','trackTotal','discNumber','discTotal','label','publisher','copyright','comment','conductor','remixer','sortTitle','sortArtist','sortAlbum','sortComposer','grouping','description','bpm','compilation','mood','language','mediaKind','isrc','musicBrainzTrackId','musicBrainzAlbumId','musicBrainzOriginalAlbumId','musicBrainzReleaseGroupId','musicBrainzArtistId','encodedBy','producer','lyricist','writer'];
        fields.forEach((key) => { if (metadata[key] !== undefined) song[key] = metadata[key]; });
        fs.writeFileSync(playerJsPath, content.replace(match[1], JSON.stringify(songs)), 'utf-8');
        return true;
    } catch (e) { return false; }
}

ipcMain.handle('search-online-metadata', async (event, params) => {
    try { return await searchOnlineMetadata(params || {}); }
    catch (error) { return { success: false, error: error.message || 'Failed to search MusicBrainz' }; }
});

ipcMain.handle('get-online-metadata', async (event, params) => {
    try { return await getOnlineMetadata(params || {}); }
    catch (error) { return { success: false, error: error.message || 'Failed to fetch MusicBrainz metadata' }; }
});

ipcMain.handle('save-audio-cover', async (event, params) => {
    try {
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

ipcMain.handle('save-audio-metadata', async (event, params) => {
    try {
        const result = await saveAudioMetadata(params?.fileUrl, params?.metadata || {}, params?.coverPath || '');
        if (result.success) updateDeployedSongMetadata(params?.fileUrl, result.metadata || {});
        return result;
    } catch (error) { return { success: false, error: error.message || 'Failed to save metadata' }; }
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
    const outputDir = path.join(__dirname, 'MusicPlayerOutput');
    return scanDroppedFiles(filePaths, outputDir);
});
ipcMain.handle('download-and-scan', async (event, url, isTemp) => {
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

    const outputDir = path.join(__dirname, 'MusicPlayerOutput');
    const scanResult = await scanDownloadedFile(downloadFolder, outputDir, result.filePath, isTemp);
    return scanResult;
});

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
    const configPath = path.join(__dirname, 'music-folders-config.json');
    return getMusicFolders(configPath);
});

ipcMain.handle('add-music-folder', async (event, folderPath) => {
    const configPath = path.join(__dirname, 'music-folders-config.json');

    if (folderPath && typeof folderPath === 'string' && folderPath.trim()) {
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
    const configPath = path.join(__dirname, 'music-folders-config.json');
    return removeMusicFolder(configPath, folderPath);
});

ipcMain.handle('remove-music-folders', async (event, folderPaths) => {
    const configPath = path.join(__dirname, 'music-folders-config.json');
    return removeMusicFolders(configPath, folderPaths);
});

ipcMain.handle('get-folder-stats', async (event, folderPath) => {
    const configPath = path.join(__dirname, 'music-folders-config.json');
    return getFolderStats(configPath, folderPath);
});

ipcMain.handle('rebuild-from-folders', async () => {
    const configPath = path.join(__dirname, 'music-folders-config.json');
    const folders = getMusicFolders(configPath);

    const outputDir = path.join(__dirname, 'MusicPlayerOutput');
    showLoadingWindow(mainWindow);
    updateLoadingProgress(0, 'Starting scan...', '');

    const result = await rebuildFromFolders(outputDir, {
        onStdoutProgress: (percent, stepTitle) => updateLoadingProgress(percent, stepTitle, ''),
        onStderrProgress: (percent, stepTitle) => updateLoadingProgress(percent, stepTitle, ''),
        streamed: true,
        onCoverBatch: (updates) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-cover-batch', updates);
            }
        },
        onScanComplete: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-covers-complete');
            }
        }
    });

    hideLoadingWindow();

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
    const outputDir = path.join(__dirname, 'MusicPlayerOutput');

    showLoadingWindow(mainWindow);
    updateLoadingProgress(0, 'Starting scan...', '');

    const scanResult = await scanFolder(selectedFolder, outputDir, {
        onStdoutProgress: (percent, stepTitle) => updateLoadingProgress(percent, stepTitle, ''),
        onStderrProgress: (percent, stepTitle) => updateLoadingProgress(percent, stepTitle, ''),
        trackStepChanges: true,
        streamed: true,
        onCoverBatch: (updates) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-cover-batch', updates);
            }
        },
        onScanComplete: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scan-covers-complete');
            }
        }
    });

    hideLoadingWindow();

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
        const jsPath = path.join(outputDir, 'player.js');
        const jsContent = fs.readFileSync(jsPath, 'utf-8');
        const songsMatch = jsContent.match(/const SONGS_DATA = (\[.*?\]);/s);
        if (songsMatch) {
            const songsData = JSON.parse(songsMatch[1]);
            return {
                success: true,
                songs: songsData
            };
        }
        return {
            success: false,
            reason: 'parse-error'
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
        shell.showItemInFolder(filePath);
    });

    ipcMain.on('delete-file', (event, filePath) => {
        const { exec } = require('child_process');
        const psCommand = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${filePath.replace(
            /'/g,
            "''"
        )}', 'OnlyErrorDialogs', 'SendToRecycleBin')`;
        exec(`powershell -Command "& { ${psCommand} }"`);
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
            ? path.join(__dirname, 'icons', 'pause.png')
            : path.join(__dirname, 'icons', 'play.png');
        mainWindow.setThumbarButtons([
            {
                tooltip: 'Previous',
                icon: path.join(__dirname, 'icons', 'prev.png'),
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
                icon: path.join(__dirname, 'icons', 'next.png'),
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
        const configPath = path.join(__dirname, 'music-folder-config.json');
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

        const outputDir = path.join(__dirname, 'MusicPlayerOutput');
        await scanFolder(selectedFolder, outputDir, {
            onStdoutProgress: (percent) => updateLoadingProgress(percent, 'Scanning...', ''),
            stdoutProgressMode: 'simple',
            streamed: true,
            onCoverBatch: (updates) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('scan-cover-batch', updates);
                }
            },
            onScanComplete: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('scan-covers-complete');
                }
            }
        });

        hideLoadingWindow();

        mainWindow.webContents.executeJavaScript(`
            location.reload();
        `);

        return {
            selected: true
        };
    });

    const configPath = path.join(__dirname, 'music-folder-config.json');
    const playerJsPath = path.join(__dirname, 'MusicPlayerOutput', 'player.js');

    let hasSongs = false;

    if (fs.existsSync(playerJsPath)) {
        try {
            const content = fs.readFileSync(playerJsPath, 'utf-8');
            const match = content.match(/const SONGS_DATA = (\[.*?\]);/s);
            if (match) {
                const songs = JSON.parse(match[1]);
                hasSongs = songs.length > 0;
            }
        } catch (e) {}
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

const { contextBridge, ipcRenderer } = require('electron');

// What the renderer may call, in groups. src/js/api/desktop-api.js lists the same groups.
// The flat names (electronAPI.closeApp, ...) are kept as aliases of the grouped ones
// (electronAPI.window.closeApp, ...) until no renderer file uses them.
const groups = {
    window: {
        getWindowMaximized: () => ipcRenderer.invoke('get-window-maximized'),
        closeApp: () => ipcRenderer.send('close-app'),
        minimizeApp: () => ipcRenderer.send('minimize-app'),
        maximizeApp: () => ipcRenderer.send('maximize-app'),
        setMinimizeOnClose: (enabled) => ipcRenderer.send('set-minimize-on-close', enabled),
        focusWindow: () => ipcRenderer.send('focus-window'),
        updateThumbarPlayState: (isPlaying) => ipcRenderer.send('update-thumbar-state', isPlaying),
        onThumbarPrev: (cb) => ipcRenderer.on('thumbar-prev', () => cb()),
        onThumbarPlayPause: (cb) => ipcRenderer.on('thumbar-playpause', () => cb()),
        onThumbarNext: (cb) => ipcRenderer.on('thumbar-next', () => cb()),
        onWindowMaximize: (cb) => ipcRenderer.on('window-maximized', (event, isMax) => cb(isMax))
    },
    library: {
        changeMusicFolder: () => ipcRenderer.invoke('change-folder'),
        getMusicFolders: () => ipcRenderer.invoke('get-music-folders'),
        addMusicFolder: (folderPath) => ipcRenderer.invoke('add-music-folder', folderPath),
        removeMusicFolder: (folderPath) => ipcRenderer.invoke('remove-music-folder', folderPath),
        removeMusicFolders: (folderPaths) => ipcRenderer.invoke('remove-music-folders', folderPaths),
        rebuildFromFolders: () => ipcRenderer.invoke('rebuild-from-folders'),
        getFolderStats: (folderPath) => ipcRenderer.invoke('get-folder-stats', folderPath),
        importDroppedFiles: (filePaths, targetView) => ipcRenderer.invoke('import-dropped-files', filePaths, targetView),
        downloadAndScan: (url, isTemp) => ipcRenderer.invoke('download-and-scan', url, isTemp),
        welcomeSelectFolder: () => ipcRenderer.invoke('welcome-select-folder'),
        pickDownloadFolder: () => ipcRenderer.invoke('pick-download-folder'),
        resetDownloadFolder: () => ipcRenderer.invoke('reset-download-folder'),
        getDownloadFolder: () => ipcRenderer.invoke('get-download-folder'),
        onScanCoverBatch: (cb) => ipcRenderer.on('scan-cover-batch', (event, updates) => cb(updates)),
        onScanCoversComplete: (cb) => ipcRenderer.on('scan-covers-complete', () => cb())
    },
    metadata: {
        getAudioMetadata: (fileUrl) => ipcRenderer.invoke('get-audio-metadata', fileUrl),
        saveAudioMetadata: (params) => ipcRenderer.invoke('save-audio-metadata', params),
        exportAudioMetadataJson: (params) => ipcRenderer.invoke('export-audio-metadata-json', params),
        importAudioMetadataJson: () => ipcRenderer.invoke('import-audio-metadata-json'),
        searchOnlineMetadata: (params) => ipcRenderer.invoke('search-online-metadata', params),
        getOnlineMetadata: (params) => ipcRenderer.invoke('get-online-metadata', params),
        saveAudioCover: (params) => ipcRenderer.invoke('save-audio-cover', params),
        chooseCoverImage: () => ipcRenderer.invoke('choose-cover-image')
    },
    files: {
        showFileInExplorer: (filePath) => ipcRenderer.send('show-file-in-explorer', filePath),
        deleteFile: (filePath) => ipcRenderer.send('delete-file', filePath)
    },
    lyrics: {
        saveLyricsFile: (defaultName, contents) => ipcRenderer.invoke('save-lyrics-file', defaultName, contents),
        readLyricsFile: () => ipcRenderer.invoke('read-lyrics-file'),
        searchOnlineLyrics: (params) => ipcRenderer.invoke('search-online-lyrics', params),
        downloadOnlineLyrics: (params) => ipcRenderer.invoke('download-online-lyrics', params)
    }
};

contextBridge.exposeInMainWorld('electronAPI', {
    // flat aliases of every grouped call
    ...Object.assign({}, ...Object.values(groups)),
    // generic escape hatch; the renderer no longer uses it once welcomeSelectFolder is swapped in 06b
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    ...groups
});

const { contextBridge, ipcRenderer, webUtils } = require('electron');

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
        getUiChoice: () => ipcRenderer.invoke('get-ui-choice'),
        setUiChoice: (choice) => ipcRenderer.invoke('set-ui-choice', choice),
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
        cancelDownload: () => ipcRenderer.invoke('cancel-download'),
        cancelCoverSearch: () => ipcRenderer.invoke('cancel-cover-search'),
        welcomeSelectFolder: () => ipcRenderer.invoke('welcome-select-folder'),
        pickDownloadFolder: () => ipcRenderer.invoke('pick-download-folder'),
        resetDownloadFolder: () => ipcRenderer.invoke('reset-download-folder'),
        getDownloadFolder: () => ipcRenderer.invoke('get-download-folder'),
        // The saved song list, handed over right away (the page builds its library from it while loading).
        getStartupSongs: () => ipcRenderer.sendSync('songs-store:load'),
        onScanCoverBatch: (cb) => ipcRenderer.on('scan-cover-batch', (event, updates) => cb(updates)),
        onScanCoversComplete: (cb) => ipcRenderer.on('scan-covers-complete', (event, info) => cb(info))
    },
    metadata: {
        getAudioMetadata: (fileUrl) => ipcRenderer.invoke('get-audio-metadata', fileUrl),
        saveAudioMetadata: (params) => ipcRenderer.invoke('save-audio-metadata', params),
        saveAudioMetadataMany: (items) => ipcRenderer.invoke('save-audio-metadata-many', items),
        findTagsMany: (request) => ipcRenderer.invoke('find-tags-many', request),
        cancelFindTags: () => ipcRenderer.invoke('cancel-find-tags'),
        onFindTagsProgress: (cb) => ipcRenderer.on('find-tags-progress', (event, info) => cb(info)),
        exportAudioMetadataJson: (params) => ipcRenderer.invoke('export-audio-metadata-json', params),
        importAudioMetadataJson: () => ipcRenderer.invoke('import-audio-metadata-json'),
        searchOnlineMetadata: (params) => ipcRenderer.invoke('search-online-metadata', params),
        getOnlineMetadata: (params) => ipcRenderer.invoke('get-online-metadata', params),
        saveAudioCover: (params) => ipcRenderer.invoke('save-audio-cover', params),
        chooseCoverImage: () => ipcRenderer.invoke('choose-cover-image')
    },
    files: {
        showFileInExplorer: (filePath) => ipcRenderer.send('show-file-in-explorer', filePath),
        deleteFile: (filePath) => ipcRenderer.send('delete-file', filePath),
        readAudioBytes: (fileUrl) => ipcRenderer.invoke('read-audio-bytes', fileUrl),
        getWaveformPeaks: (key) => ipcRenderer.invoke('waveform-peaks:get', key),
        setWaveformPeaks: (key, bytes) => ipcRenderer.invoke('waveform-peaks:set', key, bytes),
        // A dropped File has no .path in newer Electron: this is how the page gets the real path of a file the person dropped.
        getPathForFile: (file) => {
            try {
                return webUtils.getPathForFile(file) || '';
            } catch (e) {
                return '';
            }
        }
    },
    lyrics: {
        saveLyricsFile: (defaultName, contents) => ipcRenderer.invoke('save-lyrics-file', defaultName, contents),
        readLyricsFile: () => ipcRenderer.invoke('read-lyrics-file'),
        searchOnlineLyrics: (params) => ipcRenderer.invoke('search-online-lyrics', params),
        downloadOnlineLyrics: (params) => ipcRenderer.invoke('download-online-lyrics', params)
    },
    ai: {
        aiGetStatus: () => ipcRenderer.invoke('ai:get-status'),
        aiSetSettings: (patch) => ipcRenderer.invoke('ai:set-settings', patch),
        aiSetKey: (key) => ipcRenderer.invoke('ai:set-key', key),
        aiClearKey: () => ipcRenderer.invoke('ai:clear-key'),
        aiListModels: (params) => ipcRenderer.invoke('ai:list-models', params),
        aiKeyInfo: () => ipcRenderer.invoke('ai:key-info'),
        aiDescribePrivacy: () => ipcRenderer.invoke('ai:describe-privacy'),
        aiPlan: (params) => ipcRenderer.invoke('ai:plan', params),
        aiTranslateLyrics: (params) => ipcRenderer.invoke('ai:translate-lyrics', params),
        aiCancel: () => ipcRenderer.invoke('ai:cancel'),
        aiJournalList: () => ipcRenderer.invoke('ai:journal-list'),
        aiJournalGet: (id) => ipcRenderer.invoke('ai:journal-get', id),
        aiJournalRecord: (entry) => ipcRenderer.invoke('ai:journal-record', entry),
        aiJournalMarkUndone: (id) => ipcRenderer.invoke('ai:journal-mark-undone', id)
    }
};

contextBridge.exposeInMainWorld('electronAPI', {
    // flat aliases of every grouped call
    ...Object.assign({}, ...Object.values(groups)),
    ...groups
});

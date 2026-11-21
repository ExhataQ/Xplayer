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
        // The Metadata editor or the Sync tool in a window of its own (electron/window-manager.js).
        openToolWindow: (tool, songId) => ipcRenderer.invoke('open-tool-window', tool, songId),
        onToolWindowSong: (cb) => ipcRenderer.on('tool-window:song', (event, songId) => cb(songId)),
        // The light window (electron/open-router.js): the Mini Player and the Quick Player, two views of one small window that plays
        // one song or a few files.
        lightTake: () => ipcRenderer.invoke('light:take'),
        onLightOpen: (cb) => ipcRenderer.on('light:open', (event, payload) => cb(payload)),
        lightRemoteStart: () => ipcRenderer.invoke('light:remote-start'),
        lightRemoteStop: () => ipcRenderer.send('light:remote-stop'),
        lightCommand: (command) => ipcRenderer.invoke('light:command', command),
        onLightRemote: (cb) => ipcRenderer.on('light:remote', (event, snapshot) => cb(snapshot)),
        onLightRemoteLost: (cb) => ipcRenderer.on('light:remote-lost', () => cb()),
        lightPublish: (snapshot) => ipcRenderer.send('player-sync:publish', snapshot),
        onPlayerSyncWanted: (cb) => ipcRenderer.on('player-sync:wanted', (event, wanted) => cb(wanted === true)),
        onPlayerSyncCommand: (cb) => ipcRenderer.on('player-sync:command', (event, command) => cb(command)),
        lightScan: (paths) => ipcRenderer.invoke('light:scan', paths),
        openLightPlayer: (request) => ipcRenderer.invoke('light:show', request),
        lightOpenInFull: (request) => ipcRenderer.invoke('light:open-in-full', request),
        lightSetView: (view) => ipcRenderer.invoke('light:set-view', view),
        lightSetPinned: (pinned) => ipcRenderer.invoke('light:set-pinned', pinned),
        lightClose: () => ipcRenderer.send('light:close'),
        lightWindowAction: (action) => ipcRenderer.invoke('light:window', action),
        lightOpenFiles: () => ipcRenderer.invoke('light:open-files'),
        onLightState: (cb) => ipcRenderer.on('light:state', (event, state) => cb(state)),
        onLightHover: (cb) => ipcRenderer.on('light:hover', (event, inside) => cb(inside)),
        lightOpenFolder: () => ipcRenderer.invoke('light:open-folder'),
        lightAppAction: (action) => ipcRenderer.invoke('light:app-action', action),
        onAppAction: (cb) => ipcRenderer.on('app:action', (event, action) => cb(action)),
        takeAppAction: () => ipcRenderer.invoke('app:take-action'),
        lightDrag: (phase, dx, dy) => ipcRenderer.send('light:drag', { phase, dx, dy }),
        onLightContextMenu: (cb) => ipcRenderer.on('light:context-menu', (event, point) => cb(point)),
        // What opening a music file with Xplayer does when no window is open: 'mini', 'quick' or 'full'.
        getOpenMode: () => ipcRenderer.invoke('open-mode:get'),
        setOpenMode: (mode) => ipcRenderer.invoke('open-mode:set', mode),
        updateThumbarPlayState: (isPlaying) => ipcRenderer.send('update-thumbar-state', isPlaying),
        onThumbarPrev: (cb) => ipcRenderer.on('thumbar-prev', () => cb()),
        onThumbarPlayPause: (cb) => ipcRenderer.on('thumbar-playpause', () => cb()),
        onThumbarNext: (cb) => ipcRenderer.on('thumbar-next', () => cb()),
        onWindowMaximize: (cb) => ipcRenderer.on('window-maximized', (event, isMax) => cb(isMax))
    },
    app: {
        getAppInfo: () => ipcRenderer.invoke('app-info'),
        openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
        openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),
        readLog: () => ipcRenderer.invoke('read-log'),
        openProjectSite: () => ipcRenderer.invoke('open-project-site'),
        openDefaultApps: () => ipcRenderer.invoke('open-default-apps'),
        getDefaultAppStatus: () => ipcRenderer.invoke('default-app-status'),
        copyDiagnostics: () => ipcRenderer.invoke('copy-diagnostics'),
        perfRecording: (enable) => ipcRenderer.invoke('perf-record', enable),
        copyPerfSummary: () => ipcRenderer.invoke('perf-summary'),
        checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
        openReleasesPage: () => ipcRenderer.invoke('open-releases-page')
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
        probeUrl: (url) => ipcRenderer.invoke('probe-url', url),
        cancelDownload: () => ipcRenderer.invoke('cancel-download'),
        cancelCoverSearch: () => ipcRenderer.invoke('cancel-cover-search'),
        welcomeSelectFolder: () => ipcRenderer.invoke('welcome-select-folder'),
        pickDownloadFolder: () => ipcRenderer.invoke('pick-download-folder'),
        resetDownloadFolder: () => ipcRenderer.invoke('reset-download-folder'),
        getDownloadFolder: () => ipcRenderer.invoke('get-download-folder'),
        // The saved song list, handed over right away (the page builds its library from it while loading).
        getStartupSongs: () => ipcRenderer.sendSync('songs-store:load'),
        onScanCoverBatch: (cb) => ipcRenderer.on('scan-cover-batch', (event, updates) => cb(updates)),
        // Progress of a library scan that runs in the background (electron/scan-state.js): { kind, percent, step }.
        onScanProgress: (cb) => ipcRenderer.on('scan-progress', (event, info) => cb(info)),
        onScanCoversComplete: (cb) => ipcRenderer.on('scan-covers-complete', (event, info) => cb(info)),
        // Songs whose file is gone are removed from the saved library; answers { removed: [url] }.
        pruneMissingSongs: () => ipcRenderer.invoke('prune-missing-songs')
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
        getOnlineCoverPreview: (params) => ipcRenderer.invoke('get-online-cover-preview', params),
        saveAudioCover: (params) => ipcRenderer.invoke('save-audio-cover', params),
        chooseCoverImage: () => ipcRenderer.invoke('choose-cover-image')
    },
    files: {
        // Audio files Windows opened with Xplayer: the ones waiting since start-up, then each new batch (songs that are not in the library).
        takePendingOpen: () => ipcRenderer.invoke('open-external:take'),
        onOpenExternal: (cb) => ipcRenderer.on('open-external-files', (event, songs) => cb(songs)),
        chooseOpenExternal: (kind) => ipcRenderer.invoke('open-external:choose', kind),
        // A folder's other files are only listed when a file is opened from outside; the one the player moves to is read through this (electron/open-router.js).
        resolveListedFile: (fileUrl) => ipcRenderer.invoke('files:resolve-listed', fileUrl),
        showFileInExplorer: (filePath) => ipcRenderer.send('show-file-in-explorer', filePath),
        deleteFile: (filePath) => ipcRenderer.send('delete-file', filePath),
        readAudioBytes: (fileUrl) => ipcRenderer.invoke('read-audio-bytes', fileUrl),
        // True: this build serves the music through the media protocol, which the equalizer needs (electron/media-protocol.js).
        mediaProtocolAvailable: () => true,
        readCoverThumb: (fileUrl) => ipcRenderer.invoke('read-cover-thumb', fileUrl),
        getWaveformPeaks: (key) => ipcRenderer.invoke('waveform-peaks:get', key),
        setWaveformPeaks: (key, bytes) => ipcRenderer.invoke('waveform-peaks:set', key, bytes),
        // The Sync editor: audio files chosen in a dialog, or by path (dropped), read for their tags. Nothing is added to the library.
        pickAudioFiles: () => ipcRenderer.invoke('files:pick-audio'),
        scanAudioFiles: (paths) => ipcRenderer.invoke('files:scan-audio', paths),
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
        downloadOnlineLyrics: (params) => ipcRenderer.invoke('download-online-lyrics', params),
        openLrclibSite: () => ipcRenderer.invoke('open-lrclib-site')
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
        aiJournalMarkUndone: (id) => ipcRenderer.invoke('ai:journal-mark-undone', id),
        // The chat window asks the main window for the library, queue and playlists (electron/ai/host-relay.js).
        aiHostCall: (name, args, focus) => ipcRenderer.invoke('ai:host-call', name, args, focus),
        onAiHostRequest: (cb) => ipcRenderer.on('ai:host-request', (event, message) => cb(message)),
        aiHostRespond: (message) => ipcRenderer.send('ai:host-response', message)
    }
};

contextBridge.exposeInMainWorld('electronAPI', {
    // flat aliases of every grouped call
    ...Object.assign({}, ...Object.values(groups)),
    ...groups
});

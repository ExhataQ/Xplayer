// ==============================================================================
// DESKTOP API
// ==============================================================================
// The renderer's one doorway to the Electron main process. Everything else calls
// desktopApi.<group>.<name>(...) instead of window.electronAPI.<name>(...), so the preload
// surface can change in one place and the browser/test case (no electronAPI) is handled once.
//
// A classic script loaded early (after core/storage.js): some files register listeners while
// they load (15e thumbnail buttons, 03k cover scan), so it must exist before them.
//
//   desktopApi.available()          true when window.electronAPI exists
//   desktopApi.supports('group.name')   true when that call exists (replaces the old
//                                   `window.electronAPI && window.electronAPI.name` checks)
//   desktopApi.<group>.<name>(...)  calls window.electronAPI.<name>(...) and returns its result.
//                                   If the call is missing: calls that return a promise reject
//                                   with an Error, the rest return undefined. Check supports()
//                                   first where the app has a fallback (browser mode).
//                                   Event subscriptions (the on... calls) have their callback held
//                                   until start-up has finished (whenAppReady in core/legacy.js).
//   desktopApi.names()              every 'group.name', for tests
//
// Groups: window, library, metadata, files, lyrics. They are the same groups the preload
// exposes (electron/preload.js). The calls go through the flat names, which the preload keeps
// as aliases, so this works with the test stub and with either preload shape.
// The generic electronAPI.invoke(channel, ...) is deliberately not wrapped: add a named call
// in the preload and in the table below instead.

const desktopApi = (function () {
    // 'invoke' = returns a promise, 'send' = fire and forget, 'on' = subscribes to an event.
    const TABLE = {
        window: {
            getWindowMaximized: 'invoke',
            closeApp: 'send',
            minimizeApp: 'send',
            maximizeApp: 'send',
            setMinimizeOnClose: 'send',
            focusWindow: 'send',
            updateThumbarPlayState: 'send',
            onThumbarPrev: 'on',
            onThumbarPlayPause: 'on',
            onThumbarNext: 'on',
            onWindowMaximize: 'on'
        },
        library: {
            changeMusicFolder: 'invoke',
            getMusicFolders: 'invoke',
            addMusicFolder: 'invoke',
            removeMusicFolder: 'invoke',
            removeMusicFolders: 'invoke',
            rebuildFromFolders: 'invoke',
            getFolderStats: 'invoke',
            importDroppedFiles: 'invoke',
            downloadAndScan: 'invoke',
            welcomeSelectFolder: 'invoke',
            pickDownloadFolder: 'invoke',
            resetDownloadFolder: 'invoke',
            getDownloadFolder: 'invoke',
            onScanCoverBatch: 'on',
            onScanCoversComplete: 'on'
        },
        metadata: {
            getAudioMetadata: 'invoke',
            saveAudioMetadata: 'invoke',
            exportAudioMetadataJson: 'invoke',
            importAudioMetadataJson: 'invoke',
            searchOnlineMetadata: 'invoke',
            getOnlineMetadata: 'invoke',
            saveAudioCover: 'invoke',
            chooseCoverImage: 'invoke'
        },
        files: {
            showFileInExplorer: 'send',
            deleteFile: 'send'
        },
        lyrics: {
            saveLyricsFile: 'invoke',
            readLyricsFile: 'invoke',
            searchOnlineLyrics: 'invoke',
            downloadOnlineLyrics: 'invoke'
        }
    };

    const raw = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);
    const kinds = {};
    const api = {
        available: () => Boolean(raw()),
        supports: (path) => {
            const kind = kinds[path];
            return Boolean(kind) && typeof (raw() || {})[path.split('.')[1]] === 'function';
        },
        names: () => Object.keys(kinds)
    };

    for (const [group, calls] of Object.entries(TABLE)) {
        api[group] = {};
        for (const [name, kind] of Object.entries(calls)) {
            kinds[group + '.' + name] = kind;
            api[group][name] = (...args) => {
                const bridge = raw();
                if (!bridge || typeof bridge[name] !== 'function') {
                    if (kind === 'invoke') return Promise.reject(new Error('Desktop API not available: ' + group + '.' + name));
                    return undefined;
                }
                if (kind === 'on' && typeof args[0] === 'function') {
                    // A message from the main process can arrive while the page is still starting up,
                    // before the module scripts have run. Hold it until start-up has finished.
                    const callback = args[0];
                    args = [(...eventArgs) => (typeof whenAppReady === 'function' ? whenAppReady(() => callback(...eventArgs)) : callback(...eventArgs)), ...args.slice(1)];
                }
                return bridge[name](...args);
            };
        }
    }
    return api;
})();

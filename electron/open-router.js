// Decides where an audio file that Windows opened goes: the full window, the light window, or a new window.
// The light window is one small window with two views: the Mini Player (compact) and the Quick Player (larger, simple).
// Plain Node: Electron's pieces come in through `deps`, so tools/tests/electron/open-router.test.js runs it with fakes.
//
// Rules:
//   - with no window yet (the first start), the saved open mode decides: 'mini', 'quick' or 'full';
//   - Xplayer started again with no file while only the light window is open opens the full window;
//   - a file from outside (Windows, a drop on the light window, Open files) always shows in the light window, the Quick Player when none is open:
//     with the full app running the full app plays it (one engine, the queue the player bar shows) and the light window follows it; without,
//     the light window plays it by itself;
//   - one audio file opened (from Windows, a drop, or the Open files button) plays alone: the rest of its folder is NOT added behind it (that was
//     tried, did not work well, and is left out for now). A folder the person chooses with Open folder is a queue: only its first file is read (tags,
//     cover), the other files are listed by name (bareEntry) and each is read only when the player moves to it (the `files:resolve-listed` channel);
// A file that arrives before its page can take it waits in a list; the page asks for it when it has started, and from
// then on files are pushed to it. Songs move between the windows through electron/light-handoff.js.

const SONGS_EVENT = { full: 'open-external-files', light: 'light:open' };
const FOLDER_LIMIT = 300; // the most songs a folder queue holds (the same number a handoff may carry)
const FIRST_TRIES = 5; // a folder whose first files cannot be read starts at the first one that can (at most this many are tried)
const BARE_ID_START = 1000000; // ids of listed-only songs are negative and start here: the scanner's own ids for songs from outside (-1, -2, ...) never get that far
const LISTED_LIMIT = 2000; // the listed files remembered at once (what files:resolve-listed may be asked for)
const APP_ACTIONS = ['play-url', 'home', 'library', 'search', 'recent', 'lyrics', 'metadata', 'settings', 'shortcuts']; // what the light window's menu may ask of the full app

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const baseName = (value) => String(value).split(/[\\/]/).pop();
const samePath = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** The audio files of a folder in the order the file manager lists them (names, numbers as numbers), at most `limit`, always holding `opened`. */
function folderOrder(paths, opened, limit = FOLDER_LIMIT) {
    const sorted = [...paths].sort((a, b) => nameCollator.compare(baseName(a), baseName(b)));
    if (!sorted.some((p) => samePath(p, opened))) sorted.push(opened);
    if (sorted.length <= limit) return sorted;
    const at = sorted.findIndex((p) => samePath(p, opened));
    const start = Math.min(Math.max(0, at - Math.floor(limit / 3)), sorted.length - limit);
    return sorted.slice(start, start + limit);
}

/** The address a song is saved under (electron/tag-builder.js, songUrlForPath): a listed file must get the same one the scan gives it. */
function songUrl(filePath) {
    const clean = [...String(filePath).replace(/\\/g, '/')].filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127).join('');
    return 'file:///' + clean;
}

const titleOf = (filePath) => baseName(filePath).replace(/\.[^.]*$/, '');

function createOpenRouter(deps) {
    const { ipcMain, scan, windows, bringToFront, readMode, writeMode, lightViewOf, openFiles, checks, handoff, listFolder = null, sync = null, log = () => {} } = deps;

    const pending = openFiles.createPendingList(); // paths waiting for a page
    const readyPages = { full: new Set(), light: new Set() }; // page ids that have asked for what was waiting
    const listed = new Map(); // file address -> path, for the files listed by bareEntry: the pages may ask to have exactly these read, nothing else
    let bareCounter = 0;
    const startPayload = { full: null, light: null }; // a song handed over before the receiving page was ready
    let started = false;

    const alive = (win) => (win && !(typeof win.isDestroyed === 'function' && win.isDestroyed()) ? win : null);
    const isReady = (kind, win) => readyPages[kind].has(win.webContents.id);
    const send = (win, kind, payload) => win.webContents.send(SONGS_EVENT[kind], payload);
    const savedView = () => lightViewOf(readMode()); // the view the saved mode opens, or null for the full app
    const asPayload = (songs) => ({ songs, startIndex: 0, startAt: 0, paused: false });

    async function scanPaths(paths) {
        const result = await scan(paths);
        if (!result.success) log(`open files: ${result.error}`);
        return result;
    }

    // A file of a folder that is only listed: a title from its name, nothing read yet. Its tags and cover are read when the player moves to it.
    function bareEntry(filePath) {
        const url = songUrl(filePath);
        listed.delete(url); // a file listed again is the newest, so the oldest are the ones forgotten
        if (listed.size >= LISTED_LIMIT) listed.delete(listed.keys().next().value);
        listed.set(url, filePath);
        return { id: -(BARE_ID_START + ++bareCounter), url, title: titleOf(filePath), artist: '', album: '', cover: '', largeCover: '', duration: '', external: true, bare: true };
    }

    // The folder as a queue: the song that was read keeps its place, every other file is listed only.
    const withBareRest = (order, readPath, readSong) => order.map((p) => (samePath(p, readPath) ? readSong : bareEntry(p)));

    // A folder the person chose (or its files in the file manager's order): the first file that can be read is read now, the rest are listed only.
    async function readFolderList(paths) {
        let result = { success: false, songs: [], error: 'No supported audio files' };
        for (let at = 0; at < Math.min(paths.length, FIRST_TRIES); at += 1) {
            result = await scanPaths([paths[at]]);
            if (result.success && result.songs.length > 0) return { success: true, songs: withBareRest(paths, paths[at], result.songs[0]), startIndex: at };
        }
        return result;
    }

    // The audio files directly in a folder the person chose, in the file manager's order (none if it cannot be read or the dialog was closed).
    async function audioOfFolder(dir) {
        if (!dir || typeof listFolder !== 'function') return [];
        try {
            const files = await listFolder(dir);
            return files.length ? folderOrder(files, files[0]) : [];
        } catch (e) {
            return [];
        }
    }

    let pendingAction = null; // an action asked of the full app before it was ready
    const fullIsReady = () => {
        const full = alive(windows.full());
        return Boolean(full) && isReady('full', full);
    };

    function openForMode() {
        const view = savedView();
        return view ? windows.openLight(view) : windows.openFull();
    }

    // `folder`: the paths are a folder's files (Open folder): the first is read now and the others are only listed.
    async function deliver(paths, { folder = false } = {}) {
        const full = alive(windows.full());
        const light = alive(windows.light());
        const target = full ? { kind: 'full', win: full } : light ? { kind: 'light', win: light } : null;
        if (!target) {
            pending.add(paths);
            if (started) openForMode(); // before start() the first window is not up yet: start() will use the list
            return;
        }
        if (!isReady(target.kind, target.win)) {
            pending.add(paths);
            // The full app has a window but is still loading: the file waits for it, and the Quick appears now. It follows the full app once that plays.
            if (target.kind === 'full') showFollowing({ stopMusicWhenClosed: true, openedUrl: songUrl(paths[0]) });
            return;
        }
        const result = folder ? await readFolderList(paths) : await scanPaths(paths);
        if (!result.success || !alive(target.win)) return;
        if (target.kind === 'full') {
            // The full app plays it, and is not brought forward: the person asked for the light player. That window follows the full app.
            send(target.win, 'full', { songs: result.songs, startIndex: result.startIndex || 0, newQueue: true }); // a new queue: the file replaces the one before
            showFollowing({ stopMusicWhenClosed: true, openedUrl: result.songs[result.startIndex || 0].url });
            return;
        }
        send(target.win, target.kind, { ...asPayload(result.songs), startIndex: result.startIndex || 0 });
        bringToFront(target.win);
    }

    // The light window, following the full app (it opens as the Quick Player when none is open; one that is open keeps its view).
    function showFollowing({ stopMusicWhenClosed = false, openedUrl = '' } = {}) {
        // A light window that was opened by a file from outside stops the music when it is closed (the full app plays it, but the person asked for a player),
        // as long as what plays is still that file's folder (`openedUrl`): music the person started since is left alone.
        if (sync) sync.stopMusicWhenClosed(stopMusicWhenClosed, openedUrl);
        giveTo('light', { success: true, remote: true, songs: [], startIndex: 0, startAt: 0, paused: true, view: alive(windows.light()) ? undefined : 'quick' });
    }

    const batcher = openFiles.createBatcher({ onBatch: (paths) => deliver(paths) });

    function handleSecondStart(argv, workingDirectory) {
        const paths = openFiles.audioPathsFromArgv(argv, workingDirectory);
        const full = alive(windows.full());
        const light = alive(windows.light());
        if (paths.length > 0) {
            if (!full) bringToFront(light); // with the full app running, the light window is the one that comes forward (deliver)
            batcher.add(paths);
        } else if (full) {
            bringToFront(full);
        } else if (light) {
            bringToFront(windows.openFull());
        }
    }

    // Called once, when the app is ready to show its first window.
    function start() {
        started = true;
        const view = pending.size() > 0 ? savedView() : null;
        return view ? windows.openLight(view) : windows.openFull();
    }

    async function take(kind, event) {
        readyPages[kind].add(event.sender.id);
        // The full page is up: a light window that asked to follow it while it was loading gets its state now (electron/player-sync.js).
        if (kind === 'full' && sync && typeof sync.fullReady === 'function') sync.fullReady();
        const handed = startPayload[kind];
        startPayload[kind] = null;
        // The light window also learns which view it shows and whether it is kept on top.
        const extra = kind === 'light' ? { view: windows.lightView(), pinned: windows.isLightPinned() } : {};
        if (handed) return { success: true, ...handed, ...extra };
        const paths = pending.take();
        if (paths.length === 0) return { success: true, songs: [], startIndex: 0, startAt: 0, paused: false, ...extra };
        const result = await scanPaths(paths);
        // A file that waited for the full page is a file from outside like any other: it is a new queue there.
        if (kind === 'full' && result.success) return { success: true, ...asPayload(result.songs), newQueue: true, ...extra };
        return result.success ? { success: true, ...asPayload(result.songs), ...extra } : { success: false, songs: [], error: result.error, ...extra };
    }

    // A song handed to a window: sent at once when its page is ready, otherwise kept for the page to take.
    // For the light window, `payload.view` is the view that should show it: the window switches to it first.
    function giveTo(kind, payload) {
        const win = alive(kind === 'full' ? windows.full() : windows.light());
        if (kind === 'light' && win && payload.view && payload.view !== windows.lightView()) windows.setLightView(payload.view);
        if (win && isReady(kind, win)) {
            send(win, kind, payload);
            bringToFront(win);
            return;
        }
        startPayload[kind] = payload;
        if (win) bringToFront(win);
        else if (kind === 'full') windows.openFull();
        else windows.openLight(payload.view || savedView() || 'quick');
    }

    function registerIpc() {
        ipcMain.handle('open-external:take', (event) => take('full', event));
        ipcMain.handle('light:take', (event) => take('light', event));

        ipcMain.handle('light:scan', async (event, paths) => {
            const audio = checks.stringList(paths).filter(checks.isAudioPath);
            if (audio.length === 0) return { success: false, songs: [], error: 'No supported audio files' };
            if (fullIsReady()) {
                deliver(audio); // the full app plays it; this window follows it
                return { success: true, routed: true, songs: [] };
            }
            const result = await scanPaths(audio);
            return result.success ? { success: true, ...asPayload(result.songs) } : { success: false, songs: [], error: result.error };
        });

        // The full window's "Mini Player" and "Quick Player" buttons: one song, where it was, and which view should show it.
        ipcMain.handle('light:show', (event, request) => {
            // Opened from the full app: the light window follows it live (electron/player-sync.js); nothing is handed over and nothing pauses.
            if (request && request.remote === true && windows.full()) {
                const view = lightViewOf(request.view) ? request.view : undefined;
                if (sync) sync.stopMusicWhenClosed(false); // opened from the app's buttons: closing it leaves the music playing
                giveTo('light', { success: true, remote: true, songs: [], startIndex: 0, startAt: 0, paused: true, view });
                return { success: true };
            }
            const payload = handoff.sanitizeHandoff(request);
            if (!payload) return { success: false, error: 'This song cannot be shown in the player window' };
            giveTo('light', payload);
            return { success: true };
        });

        // The light window's "Open in Xplayer" button. The full window is opened first, so closing the light window
        // is never the closing of the last window.
        ipcMain.handle('light:open-in-full', (event, request) => {
            if (request && request.remote === true) {
                // It followed the full app: the full app is still playing, so only bring it forward.
                if (sync) sync.stopMusicWhenClosed(false); // going to the full app: the music goes on there
                const full = alive(windows.full());
                if (full) bringToFront(full);
                else windows.openFull();
                windows.closeLight();
                return { success: true };
            }
            if (request && request.launch === true) {
                // The light window plays by itself: the full app only starts (or comes forward), nothing is handed over, and this window stays.
                // This window keeps playing and the full app is only started: if both then play there are two sounds (no rule for that, by choice).
                const full = alive(windows.full());
                if (full) bringToFront(full);
                else bringToFront(windows.openFull());
                return { success: true };
            }
            const payload = handoff.sanitizeHandoff(request);
            if (!payload) return { success: false, error: 'Nothing to open' };
            giveTo('full', payload);
            windows.closeLight();
            return { success: true };
        });

        // The light window's menu runs something of the full app's own application menu: the full app opens (or comes forward) and does it.
        ipcMain.handle('light:app-action', (event, action) => {
            if (!APP_ACTIONS.includes(action)) return { success: false, error: 'Unknown action' };
            const full = alive(windows.full());
            if (full && isReady('full', full)) {
                full.webContents.send('app:action', action);
                bringToFront(full);
            } else {
                pendingAction = action; // the full app asks for it when it has started (app:take-action)
                bringToFront(full || windows.openFull());
            }
            return { success: true };
        });
        ipcMain.handle('app:take-action', () => {
            const action = pendingAction;
            pendingAction = null;
            return { action };
        });

        // The full app's own File > Open file / Open folder: a chooser, then the same scan as a file from Windows. The full app plays the result itself.
        ipcMain.handle('open-external:choose', async (event, kind) => {
            const chosen = kind === 'folder' ? await audioOfFolder(await windows.chooseFolder(alive(windows.full()))) : checks.stringList(await windows.chooseFiles(alive(windows.full()))).filter(checks.isAudioPath);
            if (chosen.length === 0) return { success: false, canceled: true, songs: [] };
            // A folder: the first song is read now and the rest are listed by name. Files that were picked one by one are all read (the person chose them).
            const result = kind === 'folder' ? await readFolderList(chosen) : await scanPaths(chosen.slice(0, FOLDER_LIMIT));
            return result.success ? { success: true, songs: result.songs, startIndex: result.startIndex || 0 } : { success: false, songs: [], error: result.error };
        });

        // A song that was only listed (a folder's other files) is read now, because the player has moved to it. Only files that bareEntry listed.
        ipcMain.handle('files:resolve-listed', async (event, url) => {
            const filePath = typeof url === 'string' ? listed.get(url) : undefined;
            if (!filePath) return { success: false, error: 'This file was not listed' };
            const result = await scanPaths([filePath]);
            return result.success && result.songs.length > 0 ? { success: true, song: result.songs[0] } : { success: false, error: result.error || 'This file could not be read' };
        });

        // The light window's own switch between its two views: the window is resized, then the page changes its layout.
        ipcMain.handle('light:set-view', (event, view) => {
            if (!lightViewOf(view)) return { success: false, error: 'Unknown view' };
            windows.setLightView(view);
            return { success: true, view };
        });

        // The Quick Player's own minimize and maximize buttons (its window has no frame).
        ipcMain.handle('light:window', (event, action) => {
            if (action !== 'minimize' && action !== 'toggle-maximize') return { success: false, error: 'Unknown action' };
            return { success: true, ...windows.lightWindowAction(action) };
        });

        // The "Open files" button: a file dialog, then the same scan as a file dropped on the window. A cancelled dialog is not an error.
        ipcMain.handle('light:open-files', async (event) => {
            const chosen = checks.stringList(await windows.chooseFiles()).filter(checks.isAudioPath);
            if (chosen.length === 0) return { success: false, canceled: true, songs: [] };
            if (fullIsReady()) {
                deliver(chosen);
                return { success: true, routed: true, songs: [] };
            }
            const result = await scanPaths(chosen);
            return result.success ? { success: true, ...asPayload(result.songs) } : { success: false, songs: [], error: result.error };
        });

        // The Quick Player's "Open folder": a chooser, then its songs as the queue, the same way as a file from Windows.
        ipcMain.handle('light:open-folder', async (event) => {
            const chosen = await audioOfFolder(await windows.chooseFolder(alive(windows.light())));
            if (chosen.length === 0) return { success: false, canceled: true, songs: [] };
            if (fullIsReady()) {
                deliver(chosen, { folder: true });
                return { success: true, routed: true, songs: [] };
            }
            const result = await readFolderList(chosen);
            return result.success ? { success: true, ...asPayload(result.songs), startIndex: result.startIndex } : { success: false, songs: [], error: result.error };
        });

        // The Sync editor opens songs that are not in the library, by a file dialog or by files dropped on it. Unlike light:scan this does not
        // grow a folder queue: it only reads the files and answers.
        const readForEditor = async (paths) => {
            const audio = checks.stringList(paths).filter(checks.isAudioPath);
            if (audio.length === 0) return { success: false, songs: [], error: 'No supported audio files' };
            const result = await scanPaths(audio);
            return result.success ? { success: true, songs: result.songs } : { success: false, songs: [], error: result.error };
        };
        ipcMain.handle('files:scan-audio', (event, paths) => readForEditor(paths));
        ipcMain.handle('files:pick-audio', async () => {
            const chosen = checks.stringList(await windows.chooseFiles());
            return chosen.length === 0 ? { success: false, canceled: true, songs: [] } : readForEditor(chosen);
        });

        ipcMain.handle('light:set-pinned', (event, pinned) => {
            windows.setLightPinned(pinned === true);
            return { success: true, pinned: pinned === true };
        });
        ipcMain.on('light:close', () => windows.closeLight());

        ipcMain.handle('open-mode:get', () => ({ mode: readMode() }));
        ipcMain.handle('open-mode:set', (event, mode) => {
            const saved = writeMode(mode);
            return saved ? { success: true, mode: saved } : { success: false, error: 'Unknown choice', mode: readMode() };
        });
    }

    return { handleSecondStart, start, deliver, registerIpc, addPending: (paths) => pending.add(paths), pendingCount: () => pending.size() };
}

module.exports = { createOpenRouter, folderOrder, songUrl };

// Live sync between the full app and the light window (the Mini Player and the Quick Player) when the light window was opened from the full app.
// The full app keeps playing: it publishes what it plays (song, place, modes, queue) and the light window only shows it and sends commands back
// (play, next, seek...). Nothing is handed over, so there is no pause and no wait when the light window opens, and a change on either side shows on both.
// This file only relays and checks what crosses (electron/light-handoff.js); the full app's side is src/js/ui/06b1-light-sync.js, the light
// window's is src/ui-next/light/remote.js. If the full app goes away, the light window is told and goes on by itself with the last state.

const WAIT_FOR_FIRST_SNAPSHOT_MS = 600;

function createPlayerSync({ ipcMain, windows, handoff, log = () => {} }) {
    let latest = null; // the newest whole state (the queue kept from the last time it was sent)
    let remoteId = null; // the web contents id of the light page that is following the full app
    let waiter = null;
    let stopOnClose = false; // the light window was opened by a file from outside: closing it stops the music (the full app plays it)
    let stopFolder = ''; // ... but only while what plays is still in the folder of that file (the address up to its last slash, lower case); '' = whatever plays

    const alive = (win) => (win && !win.isDestroyed() ? win : null);
    const tellFull = (wanted) => {
        const full = alive(windows.full());
        if (full) full.webContents.send('player-sync:wanted', wanted);
    };
    const tellLight = (channel, payload) => {
        const light = alive(windows.light());
        if (light && remoteId !== null && light.webContents.id === remoteId) light.webContents.send(channel, payload);
    };

    const folderOf = (url) => (typeof url === 'string' && url.includes('/') ? url.slice(0, url.lastIndexOf('/') + 1).toLowerCase() : '');

    function stop() {
        stopOnClose = false; // the follow is over: closing the light window later has nothing to stop
        stopFolder = '';
        if (remoteId === null) return;
        remoteId = null;
        tellFull(false);
    }

    function registerIpc() {
        // The light page asks to follow the full app: the full app is asked to publish, and the page gets the first state with the answer.
        ipcMain.handle('light:remote-start', async (event) => {
            const full = alive(windows.full());
            if (!full) return { success: false, lost: true };
            remoteId = event.sender.id;
            full.once('closed', () => {
                tellLight('light:remote-lost', null);
                remoteId = null;
                stopOnClose = false; // a full app opened later is not this one
                stopFolder = '';
            });
            const first = new Promise((resolve) => {
                waiter = resolve;
                setTimeout(resolve, WAIT_FOR_FIRST_SNAPSHOT_MS);
            });
            tellFull(true);
            await first;
            waiter = null;
            return { success: true, snapshot: latest };
        });
        ipcMain.on('light:remote-stop', (event) => {
            if (remoteId === event.sender.id) stop();
        });

        ipcMain.on('player-sync:publish', (event, raw) => {
            const full = alive(windows.full());
            if (!full || event.sender.id !== full.webContents.id) return; // only the full window speaks for the player
            const clean = handoff.sanitizeSnapshot(raw);
            if (!clean) return;
            latest = { ...(latest || {}), ...clean, queue: clean.queue || (latest && latest.queue) };
            if (waiter) waiter();
            tellLight('light:remote', clean);
        });

        // A command from the light page, passed on to the full app when it comes from the page that follows it.
        ipcMain.handle('light:command', (event, raw) => {
            const command = handoff.sanitizeCommand(raw);
            if (!command || event.sender.id !== remoteId) return { success: false };
            const full = alive(windows.full());
            if (!full) {
                tellLight('light:remote-lost', null);
                return { success: false, lost: true };
            }
            full.webContents.send('player-sync:command', command);
            return { success: true };
        });
    }

    // The full page has started (it asks for the files that waited for it): a light window that began following while it was loading asked too early,
    // because the page was not listening yet, so it is asked again now.
    function fullReady() {
        if (remoteId !== null) tellFull(true);
    }

    // The light window was closed (not "Open in Xplayer"): if it showed a file from outside, the music stops with it, as long as what plays is still
    // that file's folder. Something the person started since (from the library, another folder) keeps playing.
    function closed() {
        const playing = latest && latest.song && latest.song.url;
        const stopMusic = stopOnClose && (!stopFolder || !playing || folderOf(playing) === stopFolder);
        stopOnClose = false;
        if (stopMusic) {
            const full = alive(windows.full());
            if (full) full.webContents.send('player-sync:command', { type: 'pause' });
        }
        stop();
    }

    return {
        registerIpc,
        stop,
        closed,
        fullReady,
        // `openedUrl`: the file that opened the light window; with it, closing stops the music only while what plays is in that file's folder.
        stopMusicWhenClosed: (flag, openedUrl = '') => {
            stopOnClose = flag === true;
            stopFolder = stopOnClose ? folderOf(openedUrl) : '';
        },
        latest: () => latest,
        isFollowing: () => remoteId !== null
    };
}

module.exports = { createPlayerSync, WAIT_FOR_FIRST_SNAPSHOT_MS };

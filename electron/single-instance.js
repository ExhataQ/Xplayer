// One running copy per data folder (the development plan, task 1.1).
//
// Two copies of the portable app on the same Xplayer-Data folder would both write songs.json and the settings. Electron's lock is
// per user-data folder, and electron/app-paths.js points that at the data folder, so a copy with another XPLAYER_DATA (development)
// is still allowed. The second start hands its command line (argv, working folder) to the first copy, which brings its window to the front
// and opens any audio files named on that command line (electron/open-files.js).

function acquire(app, onSecondStart) {
    if (!app || typeof app.requestSingleInstanceLock !== 'function') return true; // tests with a stand-in app
    if (!app.requestSingleInstanceLock()) return false;
    app.on('second-instance', (event, argv, workingDirectory) => onSecondStart(argv, workingDirectory));
    return true;
}

// Brings a window back: restored when minimized, shown when hidden, then focused.
function bringToFront(win) {
    if (!win || (typeof win.isDestroyed === 'function' && win.isDestroyed())) return false;
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
    return true;
}

module.exports = { acquire, bringToFront };

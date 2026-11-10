// One running copy per data folder (task 1.1 of .agent/archive/dev-plan/DEV-PLAN.md).
//
// Two copies of the portable app on the same Xplayer-Data folder would both write songs.json and the settings. Electron's lock is
// per user-data folder, and electron/app-paths.js points that at the data folder, so a copy with another XPLAYER_DATA (development)
// is still allowed. The second start does nothing but bring the first window to the front.

function acquire(app, onSecondStart) {
    if (!app || typeof app.requestSingleInstanceLock !== 'function') return true; // tests with a stand-in app
    if (!app.requestSingleInstanceLock()) return false;
    app.on('second-instance', () => onSecondStart());
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

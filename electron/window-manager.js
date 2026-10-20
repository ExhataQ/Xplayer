const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const { configPath: settingsFile, getOutputDir } = require('./storage-paths');
const { activeEntry, setActiveChoice, NEXT_ENTRY } = require('./ui-entry');
const thumbarIconPath = path.join(getOutputDir(), 'icons');

function loadWindowState() {
    try {
        if (fs.existsSync(settingsFile('windowState'))) {
            const data = fs.readFileSync(settingsFile('windowState'), 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        // Intentionally silent: missing/corrupt window-state.json just falls back to the defaults below.
    }
    return {
        width: 1200,
        height: 800,
        x: undefined,
        y: undefined,
        isMaximized: false
    };
}

function saveWindowState(mainWindow) {
    if (!mainWindow) return;
    // The restored size and position, so a maximized or minimized window does not store its
    // maximized size or the off-screen minimized position as the normal one.
    const bounds = mainWindow.getNormalBounds();
    const isMaximized = mainWindow.isMaximized();
    const state = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: isMaximized
    };
    try {
        fs.writeFileSync(settingsFile('windowState'), JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
        // Intentionally silent: failing to persist window position/size on close is
        // non-critical — the app just reopens with the defaults next launch.
    }
}

let mainWindow = null;
let minimizeOnClose = false;

function setMinimizeOnClose(enabled) {
    minimizeOnClose = Boolean(enabled);
}

function createWindow() {
    const windowState = loadWindowState();

    const uiEntry = activeEntry();
    // The new screen paints a dark graphite page: a black window behind it flashes between the two at startup.
    const windowBackground = uiEntry.includes('ui-next') ? '#0e1013' : '#000000';

    mainWindow = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: windowBackground,
        frame: false,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(getOutputDir(), ...uiEntry.split('/')));

    mainWindow.setThumbarButtons([
        {
            tooltip: 'Previous',
            icon: path.join(thumbarIconPath, 'prev.png'),
            click: () => {
                if (mainWindow) mainWindow.webContents.send('thumbar-prev');
            }
        },
        {
            tooltip: 'Play/Pause',
            icon: path.join(thumbarIconPath, 'play.png'),
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

    if (windowState.isMaximized) {
        mainWindow.maximize();
    } else if (windowState.x === undefined && windowState.y === undefined) {
        mainWindow.center();
    }

    // The window only ever shows the player page: block navigation away from it (for example a file
    // dropped outside the drop zone) and block new windows.
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (url !== mainWindow.webContents.getURL()) event.preventDefault();
    });

    mainWindow.setAlwaysOnTop(true);
    setTimeout(() => {
        mainWindow.setAlwaysOnTop(false);
    }, 1000);

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
            const headerR = document.querySelector('.headerR');
            if (headerR) {
                headerR.style.webkitAppRegion = 'drag';
                headerR.style.userSelect = 'none';
                const noDragElements = headerR.querySelectorAll('button, input, .search-box, .notification-panel-btn, .notification-panel');
                noDragElements.forEach(el => {
                    el.style.webkitAppRegion = 'no-drag';
                });
            }
        `);
    });

    // Moving and resizing fire many events; write the file once things settle. Closing saves at once.
    let saveTimeout = null;
    const saveSoon = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveTimeout = null;
            if (mainWindow && !mainWindow.isDestroyed()) saveWindowState(mainWindow);
        }, 400);
    };
    mainWindow.on('move', saveSoon);
    mainWindow.on('close', (event) => {
        saveWindowState(mainWindow);
        if (minimizeOnClose) {
            event.preventDefault();
            mainWindow.minimize();
        }
    });

    mainWindow.on('maximize', () => {
        if (mainWindow) mainWindow.webContents.send('window-maximized', true);
    });
    mainWindow.on('unmaximize', () => {
        if (mainWindow) mainWindow.webContents.send('window-maximized', false);
    });

    let resizeTimeout = null;
    mainWindow.on('resize', () => {
        saveSoon();
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (mainWindow) {
                mainWindow.webContents.executeJavaScript(`
                    if (typeof recalcLayoutWidths === 'function') {
                    }
                `);
            }
        }, 150);
    });

    return mainWindow;
}

function getMainWindow() {
    return mainWindow;
}

// Saves the choice and loads the other page into the same window (position, size and playback of the main process stay).
// The page that was showing is replaced, so what it had in memory (the queue, the playing track) starts again from what is saved.
function switchUi(choice) {
    const chosen = setActiveChoice(choice);
    if (!chosen) return { ok: false, error: 'Unknown interface' };
    if (mainWindow && !mainWindow.isDestroyed()) {
        const entry = activeEntry();
        mainWindow.setBackgroundColor(entry === NEXT_ENTRY ? '#0e1013' : '#000000');
        mainWindow.loadFile(path.join(getOutputDir(), ...entry.split('/')));
    }
    return { ok: true, ui: chosen };
}

module.exports = {
    createWindow,
    switchUi,
    getMainWindow,
    saveWindowState,
    setMinimizeOnClose
};

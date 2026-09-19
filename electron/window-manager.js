const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const storePath = path.join(__dirname, 'window-state.json');

function loadWindowState() {
    try {
        if (fs.existsSync(storePath)) {
            const data = fs.readFileSync(storePath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {}
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
    const bounds = mainWindow.getBounds();
    const isMaximized = mainWindow.isMaximized();
    const state = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: isMaximized
    };
    try {
        fs.writeFileSync(storePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {}
}

let mainWindow = null;
let minimizeOnClose = false;

function setMinimizeOnClose(enabled) {
    minimizeOnClose = Boolean(enabled);
}

function createWindow() {
    const windowState = loadWindowState();

    mainWindow = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#000000',
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

    mainWindow.loadFile(path.join(__dirname, 'MusicPlayerOutput', 'music_player.html'));

    mainWindow.setThumbarButtons([
        {
            tooltip: 'Previous',
            icon: path.join(__dirname, 'icons', 'prev.png'),
            click: () => {
                if (mainWindow) mainWindow.webContents.send('thumbar-prev');
            }
        },
        {
            tooltip: 'Play/Pause',
            icon: path.join(__dirname, 'icons', 'play.png'),
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

    if (windowState.isMaximized) {
        mainWindow.maximize();
    } else if (windowState.x === undefined && windowState.y === undefined) {
        mainWindow.center();
    }

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

    mainWindow.on('move', () => saveWindowState(mainWindow));
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
        saveWindowState(mainWindow);
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

module.exports = {
    createWindow,
    getMainWindow,
    saveWindowState,
    setMinimizeOnClose
};

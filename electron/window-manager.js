const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const { configPath: settingsFile } = require('./storage-paths');
const { activeEntry } = require('./ui-entry');
const appPaths = require('./app-paths');
const thumbarIconPath = appPaths.getIconsDir();

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
    // The page paints a dark graphite ground: a black window behind it would flash at startup.
    const windowBackground = '#0e1013';

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
        icon: appPaths.getAppIcon(),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true, // preload.js only needs contextBridge, ipcRenderer and webUtils, all available in a sandboxed preload
            backgroundThrottling: false, // a music player keeps its timers (the early start of the next track) while minimised
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(appPaths.entryPath(uiEntry));

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

    mainWindow.on('closed', closeToolWindows);
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

// A tool window (Metadata or Sync) is the same page started with ?tool=<name>&song=<id>: it shows only that tool, in its own big window,
// so the tool can sit next to the player. One window per tool: asking again brings the open one forward (and sends it the new song).
// ---- The light window: the Mini Player and the Quick Player ----------------------------------------------------------
// One window with its own light page (src/ui-next/light/): no library, no shell, no engine. It has two views of the same page:
// the Mini Player (a square window that shows the cover edge to edge) and the Quick Player (a larger window that works like an app: it
// resizes and maximizes). Switching view resizes this window, so the song keeps playing. One at a time. Sizes: electron/light-views.js.
const lightViews = require('./light-views');

const LIGHT_ENTRY = 'ui-next/light/light.html';
const POINTER_WATCH_MS = 100;
let lightWindow = null;
const lightClosedListeners = []; // called when the light window has closed (the live sync stops then)
function onLightClosed(listener) {
    lightClosedListeners.push(listener);
}

// The Mini Player is dragged by the page, not by a drag area: a drag area hides the pointer from the page, so a hover or a tooltip never ended
// when the pointer moved onto it, and a right-click there showed Windows' own menu. The page sends how far the pointer moved since the press.
let lightDragFrom = null;
function dragLightWindow(phase, dx, dy) {
    if (!lightWindow || lightWindow.isDestroyed()) return;
    if (phase === 'start') lightDragFrom = lightWindow.getBounds();
    else if (phase === 'end') lightDragFrom = null;
    else if (phase === 'move' && lightDragFrom && Number.isFinite(dx) && Number.isFinite(dy)) {
        lightWindow.setBounds({ x: Math.round(lightDragFrom.x + dx), y: Math.round(lightDragFrom.y + dy), width: lightDragFrom.width, height: lightDragFrom.height });
    }
}
let lightView = 'quick';
let lightState = lightViews.normalizeState({});
let lightSaveTimer = null;

function loadLightState() {
    try {
        return lightViews.normalizeState(JSON.parse(fs.readFileSync(settingsFile('lightWindow'), 'utf-8')));
    } catch (e) {
        return lightViews.normalizeState({});
    }
}

function saveLightState(win) {
    if (!win || win.isDestroyed()) return;
    // getNormalBounds is the window's size and place when it is not maximized (or minimized), so a maximized window does not save a screen-sized window.
    const bounds = win.getNormalBounds();
    lightState = { ...lightState, x: bounds.x, y: bounds.y, pinned: win.isAlwaysOnTop(), maximized: win.isMaximized() };
    if (lightView === 'quick') lightState = { ...lightState, quickWidth: bounds.width, quickHeight: bounds.height };
    else lightState = { ...lightState, miniSize: bounds.width };
    try {
        fs.writeFileSync(settingsFile('lightWindow'), JSON.stringify(lightState), 'utf-8');
    } catch (e) {
        // Intentionally silent: a position that could not be saved only means the next window opens at the default place.
    }
}

// A move or a resize writes the file once it has settled, not on every step.
function saveLightStateSoon(win) {
    clearTimeout(lightSaveTimer);
    lightSaveTimer = setTimeout(() => saveLightState(win), 300);
}

// Whether a saved position is still on a screen (a monitor can be unplugged between runs).
function onSomeScreen(x, y) {
    if (x === undefined || y === undefined) return false;
    const { screen } = require('electron');
    return screen.getAllDisplays().some((d) => x >= d.bounds.x - 40 && y >= d.bounds.y - 20 && x < d.bounds.x + d.bounds.width - 80 && y < d.bounds.y + d.bounds.height - 60);
}

// Tells the page whether the pointer is over the window. A frameless window's drag areas give the page no mouse events, so the controls
// that show on hover could never appear over them; the page uses this instead (and its own pointer events, which are faster).
function watchPointer(win) {
    const { screen } = require('electron');
    let inside = false;
    const timer = setInterval(() => {
        if (win.isDestroyed()) return clearInterval(timer);
        const now = win.isVisible() && !win.isMinimized() && lightViews.pointInside(screen.getCursorScreenPoint(), win.getBounds());
        if (now !== inside) {
            inside = now;
            win.webContents.send('light:hover', inside);
        }
    }, POINTER_WATCH_MS);
    win.on('closed', () => clearInterval(timer));
}

// Gives the window the rules of `view` (size limits, shape, whether it maximizes), keeps it on the screen it is on, and remembers the view.
function applyLightView(win, view) {
    const spec = lightViews.VIEWS[view];
    if (win.isMaximized()) win.unmaximize(); // the size of the view being entered is set below
    const size = lightViews.sizeFor(view, lightState);
    win.setResizable(true); // a window that cannot be resized may also refuse a new size
    win.setMinimumSize(spec.minWidth, spec.minHeight);
    win.setMaximumSize(spec.maxWidth || 0, spec.maxHeight || 0); // 0: no limit
    win.setAspectRatio(spec.aspectRatio || 0);
    win.setMaximizable(spec.maximizable);
    const bounds = win.getBounds();
    const { screen } = require('electron');
    win.setBounds(lightViews.fitInto({ x: bounds.x, y: bounds.y, ...size }, screen.getDisplayMatching(bounds).workArea));
    win.setResizable(spec.resizable);
    lightView = view;
    if (view === 'quick' && lightState.maximized) win.maximize();
}

function openLightWindow(view = 'quick') {
    const wanted = lightViews.VIEWS[view] ? view : 'quick';
    if (lightWindow && !lightWindow.isDestroyed()) {
        if (wanted !== lightView) setLightView(wanted);
        if (lightWindow.isMinimized()) lightWindow.restore();
        lightWindow.focus();
        return lightWindow;
    }
    lightState = loadLightState();
    lightView = wanted;
    const spec = lightViews.VIEWS[wanted];
    const size = lightViews.sizeFor(wanted, lightState);
    const place = onSomeScreen(lightState.x, lightState.y) ? { x: lightState.x, y: lightState.y } : {};
    const win = new BrowserWindow({
        ...size,
        ...place,
        minWidth: spec.minWidth,
        minHeight: spec.minHeight,
        maxWidth: spec.maxWidth,
        maxHeight: spec.maxHeight,
        resizable: spec.resizable,
        maximizable: spec.maximizable,
        fullscreenable: false,
        frame: false,
        title: 'Xplayer',
        backgroundColor: '#0e1013',
        autoHideMenuBar: true,
        alwaysOnTop: lightState.pinned,
        icon: appPaths.getAppIcon(),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            backgroundThrottling: false, // the song keeps playing, and the next one starts on time, while the window is minimised
            preload: path.join(__dirname, 'preload.js')
        }
    });
    win.setMenuBarVisibility(false);
    if (spec.aspectRatio) win.setAspectRatio(spec.aspectRatio);
    if (place.x === undefined) win.center();
    if (wanted === 'quick' && lightState.maximized) win.maximize();
    win.loadFile(appPaths.entryPath(LIGHT_ENTRY), { query: { view: wanted } }); // the page shows this view from its first paint (light-boot.js)
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => {
        if (url !== win.webContents.getURL()) event.preventDefault();
    });
    win.on('move', () => saveLightStateSoon(win));
    win.on('resize', () => saveLightStateSoon(win));
    const tellMaximized = () => {
        if (!win.isDestroyed()) win.webContents.send('light:state', { maximized: win.isMaximized() });
        saveLightStateSoon(win);
    };
    win.on('maximize', tellMaximized);
    win.on('unmaximize', tellMaximized);
    win.on('closed', () => {
        clearTimeout(lightSaveTimer);
        if (lightWindow === win) lightWindow = null;
        for (const listener of lightClosedListeners) listener();
    });
    // A right-click on a drag area (the cover, the bar) would show Windows' own window menu. The page gets the place instead and shows its own menu.
    win.on('system-context-menu', (event, point) => {
        event.preventDefault();
        const area = win.getContentBounds();
        win.webContents.send('light:context-menu', { x: Math.round(point.x - area.x), y: Math.round(point.y - area.y) });
    });
    watchPointer(win);
    lightWindow = win;
    return win;
}

function getLightWindow() {
    return lightWindow && !lightWindow.isDestroyed() ? lightWindow : null;
}

function getLightView() {
    return lightView;
}

// Switches the open light window to the other view. Answers whether it did.
function setLightView(view) {
    const win = getLightWindow();
    if (!win || !lightViews.VIEWS[view]) return false;
    if (view !== lightView) {
        saveLightState(win); // the size of the view being left
        applyLightView(win, view);
        saveLightState(win);
    }
    return true;
}

// The Quick Player's own minimize and maximize buttons. Answers { maximized }.
function lightWindowAction(action) {
    const win = getLightWindow();
    if (!win) return { maximized: false };
    if (action === 'minimize') win.minimize();
    else if (action === 'toggle-maximize' && lightViews.VIEWS[lightView].maximizable) {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
    }
    return { maximized: win.isMaximized() };
}

function closeLightWindow() {
    const win = getLightWindow();
    if (win) {
        clearTimeout(lightSaveTimer);
        saveLightState(win);
        win.close();
    }
}

function isLightPinned() {
    const win = getLightWindow();
    return win ? win.isAlwaysOnTop() : loadLightState().pinned;
}

function setLightPinned(pinned) {
    const win = getLightWindow();
    if (!win) return;
    win.setAlwaysOnTop(Boolean(pinned));
    saveLightState(win);
}

const TOOLS = { metadata: 'Metadata editor', sync: 'Sync lyrics', ai: 'AI assistant' };
// The AI chat is a narrow window, like a chat app; the editors are big.
const TOOL_SIZES = { ai: { width: 560, height: 820, minWidth: 380, minHeight: 480 } };
const toolWindows = new Map();

function openToolWindow(tool, songId) {
    if (!Object.prototype.hasOwnProperty.call(TOOLS, tool)) return { ok: false, error: 'Unknown tool' };
    const song = songId === undefined || songId === null ? '' : String(songId).slice(0, 200);
    const existing = toolWindows.get(tool);
    if (existing && !existing.isDestroyed()) {
        existing.webContents.send('tool-window:song', song);
        if (existing.isMinimized()) existing.restore();
        existing.focus();
        return { ok: true, reused: true };
    }
    const work = require('electron').screen.getPrimaryDisplay().workAreaSize;
    const win = new BrowserWindow({
        width: Math.min(TOOL_SIZES[tool] ? TOOL_SIZES[tool].width : 1400, Math.round(work.width * 0.85)),
        height: Math.min(TOOL_SIZES[tool] ? TOOL_SIZES[tool].height : 940, Math.round(work.height * 0.9)),
        minWidth: TOOL_SIZES[tool] ? TOOL_SIZES[tool].minWidth : 800,
        minHeight: TOOL_SIZES[tool] ? TOOL_SIZES[tool].minHeight : 600,
        title: TOOLS[tool],
        backgroundColor: '#0e1013',
        autoHideMenuBar: true,
        icon: appPaths.getAppIcon(),
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.js') }
    });
    win.setMenuBarVisibility(false);
    win.loadFile(appPaths.entryPath(activeEntry()), { query: { tool, song } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => {
        if (url !== win.webContents.getURL()) event.preventDefault();
    });
    win.on('closed', () => toolWindows.delete(tool));
    toolWindows.set(tool, win);
    return { ok: true, reused: false };
}

// The tool windows belong to the main window: they close with it.
function closeToolWindows() {
    for (const win of toolWindows.values()) if (!win.isDestroyed()) win.close();
    toolWindows.clear();
}

module.exports = {
    createWindow,
    openToolWindow,
    openLightWindow,
    onLightClosed,
    dragLightWindow,
    getLightWindow,
    getLightView,
    setLightView,
    lightWindowAction,
    closeLightWindow,
    setLightPinned,
    isLightPinned,
    closeToolWindows,
    getMainWindow,
    saveWindowState,
    setMinimizeOnClose
};

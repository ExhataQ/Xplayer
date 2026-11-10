// Where the app finds its pages (the code side) and where it keeps the library and the settings (the data side).
// One place decides, so the code can be read-only (inside the app archive, or a folder that is replaced on update) and the
// person's data survives an update.
//
//   mode       when                                      pages (webRoot)       library (songs.json, covers)   settings (userData)
//   dev        `npm start`: Electron run from Source     Source/src            <data>/library                <data>/settings
//   portable   a packaged build with portable.txt next   <app>/src             <data>/library                <data>/settings
//              to the exe (or Xplayer-Data beside it)
//   installed  a packaged build without that marker      <app>/src             <userData>/library            <userData>
//
// <data> is XPLAYER_DATA when set, else Source/.dev-data in dev, else the Xplayer-Data folder next to the exe in portable mode.
// The pages are in src/ in every mode. A test that needs a throwaway library sets XPLAYER_DATA.
//
// Pages ask for covers as covers/<file>, relative to the web root (index.html has <base href="../">). The library is not in the web
// root, so installCoverRoute() sends those requests to <library>/covers and nothing in the renderer has to know.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const PORTABLE_MARKER = 'portable.txt';
const PORTABLE_DATA_FOLDER = 'Xplayer-Data';

// The app icon: the X mark. Windows takes the .ico (it holds a drawing for each size, the small ones bolder), others the png.
function sourceIcon() {
    const dir = path.join(SOURCE_ROOT, 'src', 'assets', 'app-icon');
    return path.join(dir, process.platform === 'win32' ? 'xplayer.ico' : 'xplayer-512.png');
}

// The layout for the given facts. Pure apart from the file checks, so a test can pass its own `exists`.
function resolveLayout({ env = process.env, isPackaged = false, execPath = process.execPath, exists = fs.existsSync, userDataDir = null } = {}) {
    const webRoot = path.join(SOURCE_ROOT, 'src');
    const assets = path.join(webRoot, 'assets');
    const base = { webRoot, iconsDir: path.join(assets, 'icons'), appIcon: sourceIcon() };
    const withData = (mode, dataRoot) => ({ ...base, mode, libraryDir: path.join(dataRoot, 'library'), settingsDir: path.join(dataRoot, 'settings') });

    if (env.XPLAYER_DATA) return withData(isPackaged ? 'portable' : 'dev', path.resolve(env.XPLAYER_DATA));
    if (!isPackaged) return withData('dev', path.join(SOURCE_ROOT, '.dev-data'));

    const exeDir = env.PORTABLE_EXECUTABLE_DIR || path.dirname(execPath);
    if (env.PORTABLE_EXECUTABLE_DIR || exists(path.join(exeDir, PORTABLE_MARKER)) || exists(path.join(exeDir, PORTABLE_DATA_FOLDER))) {
        return withData('portable', path.join(exeDir, PORTABLE_DATA_FOLDER));
    }
    // Installed: the settings stay where Electron puts them, the library beside them.
    const user = userDataDir || path.join(process.env.APPDATA || exeDir, 'Xplayer');
    return { ...base, mode: 'installed', libraryDir: path.join(user, 'library'), settingsDir: null };
}

let layout = null;

function electronApp() {
    try {
        const { app } = require('electron');
        return app && typeof app.getPath === 'function' ? app : null;
    } catch (e) {
        return null;
    }
}

function getLayout() {
    if (!layout) {
        const app = electronApp();
        layout = resolveLayout({ isPackaged: Boolean(app && app.isPackaged), userDataDir: app ? app.getPath('userData') : null });
    }
    return layout;
}

// For tests: use this layout from now on (null works it out again).
function setLayout(next) {
    layout = next || null;
}

// Call once, first thing in the main process (before the app is ready): it points Electron's userData at the settings folder, so the
// page's own storage (theme, panel sizes) and the settings files live with the data, and makes the folders.
function init(app) {
    const current = getLayout();
    for (const dir of [current.libraryDir, current.settingsDir]) {
        if (dir) fs.mkdirSync(dir, { recursive: true });
    }
    if (current.settingsDir && app && typeof app.setPath === 'function') app.setPath('userData', current.settingsDir);
    return current;
}

// Sends covers/<file> requests made by a page to the library's covers folder.
function installCoverRoute(session) {
    const current = getLayout();
    if (!session || !session.webRequest) return false;
    const fold = process.platform === 'win32' ? (text) => text.toLowerCase() : (text) => text;
    const from = fold(pathToFileURL(path.join(current.webRoot, 'covers')).href + '/');
    const to = pathToFileURL(path.join(current.libraryDir, 'covers')).href + '/';
    session.webRequest.onBeforeRequest({ urls: ['file:///*/covers/*'] }, (details, callback) => {
        const url = details.url;
        // Only the pages' own covers folder: a music folder that happens to be called "covers" is left alone.
        if (fold(url).startsWith(from)) callback({ redirectURL: to + url.slice(from.length) });
        else callback({});
    });
    return true;
}

module.exports = {
    SOURCE_ROOT,
    PORTABLE_MARKER,
    PORTABLE_DATA_FOLDER,
    resolveLayout,
    getLayout,
    setLayout,
    init,
    installCoverRoute,
    getMode: () => getLayout().mode,
    getWebRoot: () => getLayout().webRoot,
    getLibraryDir: () => getLayout().libraryDir,
    getIconsDir: () => getLayout().iconsDir,
    getAppIcon: () => getLayout().appIcon,
    // The folder that holds the person's data: library/ and settings/ (and logs/).
    getDataDir: () => path.dirname(getLayout().libraryDir),
    entryPath: (entry) => path.join(getLayout().webRoot, ...String(entry).split('/'))
};

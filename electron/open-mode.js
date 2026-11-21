// What happens when Xplayer is started with an audio file and no window is open: show the Mini Player ('mini'), the Quick Player
// ('quick') or the full app ('full'). The Mini Player and the Quick Player are two views of one light window (electron/window-manager.js).
// The main process needs the answer before any window exists, so it lives in a small settings file (open-mode.json), the same way
// the window position does.

const fs = require('fs');

const OPEN_MODES = ['mini', 'quick', 'full'];
const LIGHT_VIEWS = ['mini', 'quick'];
const DEFAULT_OPEN_MODE = 'quick';

function normalizeOpenMode(value) {
    return OPEN_MODES.includes(value) ? value : null;
}

// The view of the light window that a mode opens, or null for the full app.
function lightViewOf(mode) {
    return LIGHT_VIEWS.includes(mode) ? mode : null;
}

function configFile() {
    return require('./storage-paths').configPath('openMode');
}

function readOpenMode(file = configFile) {
    try {
        const target = typeof file === 'function' ? file() : file;
        if (!fs.existsSync(target)) return DEFAULT_OPEN_MODE;
        return normalizeOpenMode(JSON.parse(fs.readFileSync(target, 'utf-8')).mode) || DEFAULT_OPEN_MODE;
    } catch (e) {
        return DEFAULT_OPEN_MODE;
    }
}

// Returns the saved mode, or null when the value is not one of the three.
function writeOpenMode(mode, file = configFile) {
    const normalized = normalizeOpenMode(mode);
    if (!normalized) return null;
    try {
        const target = typeof file === 'function' ? file() : file;
        fs.writeFileSync(target, JSON.stringify({ mode: normalized }), 'utf-8');
        return normalized;
    } catch (e) {
        return null;
    }
}

module.exports = { OPEN_MODES, LIGHT_VIEWS, DEFAULT_OPEN_MODE, normalizeOpenMode, lightViewOf, readOpenMode, writeOpenMode };

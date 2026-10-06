// Where the app keeps its small settings files (music folders, "setup done" flag, download folder,
// window position).
//
// They live in the user's data folder, not next to the code: the code folder can be read-only
// (installed under Program Files, or packed in an archive) and is replaced on every update.
// A file that exists only in the old place (next to the code) is copied over the first time it is
// asked for, and the old one is then removed so it cannot come back after a reset.
//
// The scan runs in a separate process that cannot ask Electron for the data folder, so the main
// process hands it the folder in MUSIC_PLAYER_CONFIG_DIR (see scanner.js). Run on its own, with
// nothing set, the folder is the code folder, as it always was.

const fs = require('fs');
const path = require('path');

const CONFIG_FILES = {
    foldersConfig: 'music-folders-config.json',
    setupFlag: 'music-folder-config.json',
    downloadFolder: 'download-folder-config.json',
    windowState: 'window-state.json'
};

let legacyDir = __dirname;
let configDir = null;

function resolveConfigDir() {
    if (process.env.MUSIC_PLAYER_CONFIG_DIR) return process.env.MUSIC_PLAYER_CONFIG_DIR;
    try {
        const { app } = require('electron');
        const dir = app && typeof app.getPath === 'function' ? app.getPath('userData') : '';
        if (dir) return dir;
    } catch (e) {
        // Not running inside Electron: use the code folder below.
    }
    return legacyDir;
}

function getConfigDir() {
    if (!configDir) configDir = resolveConfigDir();
    return configDir;
}

// For tests: use `dir` from now on (null goes back to working it out again), and look for old
// files in `oldDir` instead of next to the code.
function setConfigDir(dir, oldDir) {
    configDir = dir || null;
    legacyDir = oldDir || __dirname;
}

function configPath(key) {
    const name = CONFIG_FILES[key];
    if (!name) throw new Error('Unknown config file: ' + key);
    const dir = getConfigDir();
    const target = path.join(dir, name);
    if (dir === legacyDir) return target;
    try {
        fs.mkdirSync(dir, { recursive: true });
        const legacy = path.join(legacyDir, name);
        if (!fs.existsSync(target) && fs.existsSync(legacy)) {
            fs.copyFileSync(legacy, target);
            try {
                fs.unlinkSync(legacy);
            } catch (e) {
                // Intentionally silent: a copy that stays behind is only used if the new one is missing.
            }
        }
    } catch (e) {
        // Intentionally silent: if the copy fails the setting simply starts from its default.
    }
    return target;
}

module.exports = { CONFIG_FILES, getConfigDir, setConfigDir, configPath };

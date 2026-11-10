'use strict';

// Where the app keeps its library (songs.json, covers, icons): electron/storage-paths.js getLibraryDir(), which asks app-paths.js.
// main.js takes every library path from it, and the pages and icons come from src/ (the web root). XPLAYER_DATA points a run at a
// throwaway data folder, which is what lets a real-Electron test use its own library. No Electron is needed: main.js and
// window-manager.js run in a temporary copy of electron/ with a fake 'electron' module (the same approach as songs-store.test.js).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('node:module');

const ELECTRON_DIR = path.join(__dirname, '..', '..', 'electron');
const VAR = 'XPLAYER_DATA';

function withEnv(value, fn) {
    const saved = process.env[VAR];
    if (value === undefined) delete process.env[VAR];
    else process.env[VAR] = value;
    try {
        return fn();
    } finally {
        if (saved === undefined) delete process.env[VAR];
        else process.env[VAR] = saved;
    }
}

describe('getLibraryDir (electron/storage-paths.js)', () => {
    const appPaths = require('../../electron/app-paths');
    const { getLibraryDir } = require('../../electron/storage-paths');
    const ROOT = path.join(ELECTRON_DIR, '..');
    const none = () => false;
    const layoutFor = (env) => appPaths.setLayout(appPaths.resolveLayout({ env, isPackaged: false, exists: none }));
    after(() => appPaths.setLayout(null));

    test('without XPLAYER_DATA it is the dev data folder in Source', () => {
        layoutFor({});
        assert.equal(getLibraryDir(), path.join(ROOT, '.dev-data', 'library'));
    });

    test('with XPLAYER_DATA it is <that folder>/library', () => {
        const custom = path.join(os.tmpdir(), 'some-data');
        layoutFor({ XPLAYER_DATA: custom });
        assert.equal(getLibraryDir(), path.join(custom, 'library'));
    });

    test('the old variable does nothing any more', () => {
        layoutFor({ MUSIC_PLAYER_OUTPUT_DIR: path.join(os.tmpdir(), 'old') });
        assert.equal(getLibraryDir(), path.join(ROOT, '.dev-data', 'library'));
    });
});

describe('main.js and window-manager.js take their paths from storage-paths and app-paths', () => {
    test('nothing in electron/ or src/js knows the old output folder or its variable', () => {
        const offenders = [];
        const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) { if (entry.name !== '__pycache__' && entry.name !== 'node_modules') walk(full); } else if (/\.js$/.test(entry.name) && /MusicPlayerOutput|MUSIC_PLAYER_OUTPUT_DIR|getOutputDir/.test(fs.readFileSync(full, 'utf8'))) offenders.push(path.relative(ELECTRON_DIR, full));
            }
        };
        walk(ELECTRON_DIR);
        assert.deepEqual(offenders, []);
    });

    test('main.js imports getLibraryDir; window-manager.js uses app-paths', () => {
        const main = fs.readFileSync(path.join(ELECTRON_DIR, 'main.js'), 'utf8');
        assert.match(main, /\{[^}]*\bgetLibraryDir\b[^}]*\}\s*=\s*require\('\.\/storage-paths'\)/, 'main.js should import getLibraryDir');
        const windows = fs.readFileSync(path.join(ELECTRON_DIR, 'window-manager.js'), 'utf8');
        assert.match(windows, /require\('\.\/app-paths'\)/, 'window-manager.js should use app-paths');
    });
});

describe('the real files, run with a fake electron', () => {
    const SONGS = [{ id: 1, title: 'From the custom folder', artist: 'A', album: 'B', url: 'file:///x/1.mp3', duration: '0:03' }];
    let root, copyDir, realLoad, realSetTimeout, store;

    function tempDir() {
        return fs.mkdtempSync(path.join(os.tmpdir(), 'outdir-'));
    }

    // Load a fresh copy of main.js and window-manager.js (so module-level constants are worked out again with the
    // environment as it is right now). Returns what the fake electron recorded.
    function loadFresh() {
        for (const key of Object.keys(require.cache)) if (key.startsWith(copyDir)) delete require.cache[key];
        const rec = { listeners: {}, loaded: [], thumbar: [] };
        const sink = new Proxy(function () {}, { get: () => sink, apply: () => sink });
        function BrowserWindow() {
            return new Proxy(
                {},
                {
                    get(target, key) {
                        if (key === 'loadFile') return (file) => rec.loaded.push(file);
                        if (key === 'setThumbarButtons') return (buttons) => rec.thumbar.push(buttons);
                        if (key === 'isDestroyed') return () => false;
                        return sink;
                    }
                }
            );
        }
        const fake = {
            app: { disableHardwareAcceleration() {}, whenReady: () => new Promise(() => {}), on() {}, quit() {}, getPath: () => root },
            ipcMain: { handle() {}, on: (name, fn) => { rec.listeners[name] = fn; } },
            shell: {},
            dialog: {},
            BrowserWindow,
            screen: sink
        };
        Module._load = function (request, ...rest) {
            return request === 'electron' ? fake : realLoad.call(this, request, ...rest);
        };
        require(path.join(copyDir, 'main.js'));
        rec.windowManager = require(path.join(copyDir, 'window-manager.js'));
        return rec;
    }

    function openWindow(rec) {
        global.setTimeout = () => 0; // createWindow schedules a one second "always on top" reset
        try {
            rec.windowManager.createWindow();
        } finally {
            global.setTimeout = realSetTimeout;
        }
    }

    before(() => {
        root = tempDir();
        copyDir = path.join(root, 'electron');
        fs.mkdirSync(copyDir);
        for (const name of fs.readdirSync(ELECTRON_DIR)) {
            if (name.endsWith('.js')) fs.copyFileSync(path.join(ELECTRON_DIR, name), path.join(copyDir, name));
        }
        fs.cpSync(path.join(ELECTRON_DIR, 'ai'), path.join(copyDir, 'ai'), { recursive: true }); // main.js loads ./ai/ipc
        store = require('../../electron/songs-store');
        realLoad = Module._load;
        realSetTimeout = global.setTimeout;
        process.env.MUSIC_PLAYER_CONFIG_DIR = path.join(root, 'settings');
    });

    after(() => {
        Module._load = realLoad;
        global.setTimeout = realSetTimeout;
        delete process.env.MUSIC_PLAYER_CONFIG_DIR;
        for (const key of Object.keys(require.cache)) if (key.startsWith(copyDir)) delete require.cache[key];
        fs.rmSync(root, { recursive: true, force: true });
    });

    test('with XPLAYER_DATA set, songs.json comes from <data>/library, the page from src/, and the taskbar icons from src/assets/icons', () => {
        const custom = path.join(tempDir(), 'MyData');
        store.writeSongs(path.join(custom, 'library'), SONGS);
        try {
            const rec = withEnv(custom, loadFresh);
            const event = {};
            rec.listeners['songs-store:load'](event);
            assert.deepEqual(event.returnValue, SONGS);
            withEnv(custom, () => openWindow(rec));
            assert.deepEqual(rec.loaded, [path.join(root, 'src', 'ui-next', 'index.html')]);
            const icons = rec.thumbar[0].map((b) => b.icon);
            assert.deepEqual(icons, ['prev.png', 'play.png', 'next.png'].map((n) => path.join(root, 'src', 'assets', 'icons', n)));
        } finally {
            fs.rmSync(path.dirname(custom), { recursive: true, force: true });
        }
    });

    test('without it, the library is .dev-data/library next to the code', () => {
        const devLibrary = path.join(root, '.dev-data', 'library');
        store.writeSongs(devLibrary, SONGS);
        const rec = withEnv(undefined, loadFresh);
        const event = {};
        rec.listeners['songs-store:load'](event);
        assert.deepEqual(event.returnValue, SONGS);
    });

    test('with XPLAYER_DATA set, nothing is written under the default data folder', () => {
        fs.rmSync(path.join(root, '.dev-data'), { recursive: true, force: true });
        const custom = path.join(tempDir(), 'Other');
        try {
            const rec = withEnv(custom, loadFresh);
            const event = {};
            rec.listeners['songs-store:load'](event);
            assert.deepEqual(event.returnValue, []);
            assert.equal(fs.existsSync(path.join(root, '.dev-data')), false);
        } finally {
            fs.rmSync(path.dirname(custom), { recursive: true, force: true });
        }
    });
});

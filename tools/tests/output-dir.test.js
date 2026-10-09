'use strict';

// Where the app keeps its output folder (music_player.html, player.js, songs.json, covers, icons).
//
// electron/storage-paths.js getOutputDir(): MUSIC_PLAYER_OUTPUT_DIR when set, otherwise the old default
// (electron/MusicPlayerOutput). main.js and window-manager.js take every output path from it. This is what lets a
// real-Electron test run against a throwaway library. No Electron is needed: main.js and window-manager.js run
// in a temporary copy of electron/ with a fake 'electron' module (the same approach as songs-store.test.js).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('node:module');

const ELECTRON_DIR = path.join(__dirname, '..', '..', 'electron');
const VAR = 'MUSIC_PLAYER_OUTPUT_DIR';

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

describe('getOutputDir (electron/storage-paths.js)', () => {
    const { getOutputDir } = require('../../electron/storage-paths');
    const defaultDir = path.join(ELECTRON_DIR, 'MusicPlayerOutput');

    test('without the variable it is the folder next to the code, as before', () => {
        assert.equal(withEnv(undefined, getOutputDir), defaultDir);
    });

    test('an empty variable counts as not set', () => {
        assert.equal(withEnv('', getOutputDir), defaultDir);
    });

    test('with the variable set it returns that folder unchanged', () => {
        const custom = path.join(os.tmpdir(), 'some-output');
        assert.equal(withEnv(custom, getOutputDir), custom);
    });

    test('it is read on every call, not once at load', () => {
        const a = path.join(os.tmpdir(), 'out-a');
        const b = path.join(os.tmpdir(), 'out-b');
        assert.equal(withEnv(a, getOutputDir), a);
        assert.equal(withEnv(b, getOutputDir), b);
        assert.equal(withEnv(undefined, getOutputDir), defaultDir);
    });
});

describe('main.js and window-manager.js take their output paths from getOutputDir', () => {
    test('no file in electron/ except storage-paths.js builds the MusicPlayerOutput path itself', () => {
        const offenders = fs
            .readdirSync(ELECTRON_DIR)
            .filter((f) => f.endsWith('.js') && f !== 'storage-paths.js')
            .filter((f) => /['"]MusicPlayerOutput['"]/.test(fs.readFileSync(path.join(ELECTRON_DIR, f), 'utf8')));
        assert.deepEqual(offenders, []);
    });

    test('both files import getOutputDir from storage-paths', () => {
        for (const f of ['main.js', 'window-manager.js']) {
            const src = fs.readFileSync(path.join(ELECTRON_DIR, f), 'utf8');
            assert.match(src, /\{[^}]*\bgetOutputDir\b[^}]*\}\s*=\s*require\('\.\/storage-paths'\)/, `${f} should import getOutputDir`);
        }
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

    test('with the variable set, songs.json, the page and the taskbar icons come from that folder', () => {
        const custom = path.join(tempDir(), 'MyOutput');
        store.writeSongs(custom, SONGS);
        try {
            const rec = withEnv(custom, loadFresh);
            const event = {};
            rec.listeners['songs-store:load'](event);
            assert.deepEqual(event.returnValue, SONGS);
            withEnv(custom, () => openWindow(rec));
            assert.deepEqual(rec.loaded, [path.join(custom, 'music_player.html')]);
            const icons = rec.thumbar[0].map((b) => b.icon);
            assert.deepEqual(icons, ['prev.png', 'play.png', 'next.png'].map((n) => path.join(custom, 'icons', n)));
        } finally {
            fs.rmSync(path.dirname(custom), { recursive: true, force: true });
        }
    });

    test('without the variable, everything is under electron/MusicPlayerOutput next to the code, as before', () => {
        const defaultDir = path.join(copyDir, 'MusicPlayerOutput');
        store.writeSongs(defaultDir, SONGS);
        const rec = withEnv(undefined, loadFresh);
        const event = {};
        rec.listeners['songs-store:load'](event);
        assert.deepEqual(event.returnValue, SONGS);
        withEnv(undefined, () => openWindow(rec));
        assert.deepEqual(rec.loaded, [path.join(defaultDir, 'music_player.html')]);
        const icons = rec.thumbar[0].map((b) => b.icon);
        assert.deepEqual(icons, ['prev.png', 'play.png', 'next.png'].map((n) => path.join(defaultDir, 'icons', n)));
    });

    test('with the variable set, nothing is written under the default folder', () => {
        const defaultDir = path.join(copyDir, 'MusicPlayerOutput');
        fs.rmSync(defaultDir, { recursive: true, force: true });
        const custom = path.join(tempDir(), 'Other');
        try {
            const rec = withEnv(custom, loadFresh);
            const event = {};
            rec.listeners['songs-store:load'](event);
            assert.deepEqual(event.returnValue, []);
            assert.equal(fs.existsSync(defaultDir), false);
        } finally {
            fs.rmSync(path.dirname(custom), { recursive: true, force: true });
        }
    });
});

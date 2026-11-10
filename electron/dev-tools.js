'use strict';

// Help for working on the app, used only when Electron runs from Source (never in a packaged build). tools/dev/start.js passes the
// switches; they can also be given by hand:
//
//   --devtools or XPLAYER_DEVTOOLS=1   open DevTools, detached, with each page window
//   --watch    or XPLAYER_WATCH=1      reload the windows when a file in src/ changes; restart the app when a file in electron/ changes
//   XPLAYER_SEED=<file>                a JSON file {"localStorage": {key: text}} applied once to a new data folder (see below)
//
// The seed exists because the page keeps playlists and favorites in localStorage, which a script outside the app cannot fill in.
// make-sample-library.js writes one next to the sample library. Keys that already have a value are left alone, and a marker file
// in the settings folder makes it a one-time thing, so what you change in the app stays changed.

const fs = require('fs');
const path = require('path');

const RELOAD_DELAY_MS = 200;
// tools/dev/start.js starts Electron again when it exits with this code (so its own watchers keep running).
const RESTART_EXIT_CODE = 75;
const PAGE_WINDOW = /\/(ui-next\/index\.html|music_player\.html)$/;

function flag(name, argv, env, envName) {
    return argv.includes(`--${name}`) || env[envName] === '1';
}

function wantsDevtools({ argv = process.argv, env = process.env } = {}) {
    return flag('devtools', argv, env, 'XPLAYER_DEVTOOLS');
}

function wantsWatch({ argv = process.argv, env = process.env } = {}) {
    return flag('watch', argv, env, 'XPLAYER_WATCH');
}

// A function that runs `fn` once, `ms` after the last call.
function debounce(fn, ms, timers = { set: setTimeout, clear: clearTimeout }) {
    let handle = null;
    const wrapped = (...args) => {
        if (handle) timers.clear(handle);
        handle = timers.set(() => { handle = null; fn(...args); }, ms);
    };
    wrapped.cancel = () => { if (handle) timers.clear(handle); handle = null; };
    return wrapped;
}

// Files an editor writes on the side (swap files, temporary names) say nothing about the code.
function isNoise(name) {
    const base = path.basename(String(name || ''));
    return !base || /(~|\.tmp|\.swp|\.swx|\.bak)$/i.test(base) || base.startsWith('.#') || /^\d+$/.test(base) || base === '4913';
}

// Calls onChange(relativeName) for each change under `dir` (subfolders included). Returns a function that stops watching.
// `ignore(relativeName)` skips names. A folder that is missing is not an error: nothing is watched.
function watchTree(dir, onChange, { ignore = () => false, fsImpl = fs } = {}) {
    let watcher = null;
    try {
        watcher = fsImpl.watch(dir, { recursive: true, persistent: false }, (event, name) => {
            if (!name || isNoise(name) || ignore(String(name))) return;
            onChange(String(name).replace(/\\/g, '/'));
        });
        if (watcher && typeof watcher.on === 'function') watcher.on('error', () => {});
    } catch (e) {
        return () => {};
    }
    return () => { try { watcher.close(); } catch (e) { /* already closed */ } };
}

// Reload every page window when the pages change; restart the app when the main-process code changes.
function startWatching({ app, root, windows, log = () => {}, fsImpl = fs, delay = RELOAD_DELAY_MS, timers, env = process.env }) {
    const reload = debounce(() => {
        for (const win of windows()) {
            if (win && !win.isDestroyed()) win.webContents.reloadIgnoringCache();
        }
        log('dev: reloaded the windows');
    }, delay, timers);
    let restarting = false;
    const restart = debounce(() => {
        if (restarting) return;
        restarting = true;
        log('dev: the app code changed; restarting');
        if (env.XPLAYER_LAUNCHER === '1') {
            app.exit(RESTART_EXIT_CODE);
        } else {
            app.relaunch();
            app.exit(0);
        }
    }, delay, timers);

    const stops = [
        // src/ holds the pages. The files npm run dev writes there (player.js and the other generated ones) count too.
        watchTree(path.join(root, 'src'), (name) => { log(`dev: src/${name}`); reload(); }, { fsImpl }),
        watchTree(path.join(root, 'electron'), (name) => {
            if (!/\.(js|json|html)$/.test(name)) return;
            log(`dev: electron/${name}`);
            restart();
        }, { fsImpl })
    ];
    return () => { reload.cancel(); restart.cancel(); stops.forEach((stop) => stop()); };
}

function isPageWindow(win) {
    try {
        return PAGE_WINDOW.test(String(win.webContents.getURL()).split(/[?#]/)[0]);
    } catch (e) {
        return false;
    }
}

function readSeed(file, fsImpl = fs) {
    try {
        const parsed = JSON.parse(fsImpl.readFileSync(file, 'utf8'));
        const entries = parsed && parsed.localStorage && typeof parsed.localStorage === 'object' ? Object.entries(parsed.localStorage) : [];
        return entries.filter(([key, value]) => typeof key === 'string' && typeof value === 'string');
    } catch (e) {
        return [];
    }
}

// The script that runs in the page: sets the keys that have no value yet. Returns how many it set.
function seedScript(entries) {
    return `(() => { const entries = ${JSON.stringify(entries)}; let set = 0; for (const [key, value] of entries) { if (localStorage.getItem(key) === null) { localStorage.setItem(key, value); set++; } } return set; })()`;
}

// Applies the seed to a page window once. Resolves to the number of keys set (0 when there was nothing to do).
async function applySeed({ win, seedFile, markerFile, fsImpl = fs, log = () => {} }) {
    if (!seedFile || !fsImpl.existsSync(seedFile) || fsImpl.existsSync(markerFile)) return 0;
    const entries = readSeed(seedFile, fsImpl);
    // The marker goes first: a seed that fails halfway is not tried again on every start.
    try {
        fsImpl.mkdirSync(path.dirname(markerFile), { recursive: true });
        fsImpl.writeFileSync(markerFile, new Date().toISOString());
    } catch (e) { /* without a marker the seed runs again, which only fills keys that are still empty */ }
    if (!entries.length) return 0;
    const set = await win.webContents.executeJavaScript(seedScript(entries));
    log(`dev: seeded ${set} saved value(s) from ${path.basename(seedFile)}`);
    if (set > 0) win.webContents.reloadIgnoringCache();
    return set;
}

// Call once the app is ready. Does nothing in a packaged build.
function init({ app, BrowserWindow, root, userDataDir, argv = process.argv, env = process.env, log = () => {}, fsImpl = fs }) {
    if (app.isPackaged) return { devtools: false, watch: false };
    const devtools = wantsDevtools({ argv, env });
    const watch = wantsWatch({ argv, env });
    const seedFile = env.XPLAYER_SEED || '';

    if (devtools || seedFile) {
        const handled = new WeakSet();
        app.on('browser-window-created', (event, win) => {
            win.webContents.on('did-finish-load', () => {
                if (!isPageWindow(win)) return;
                if (devtools && !handled.has(win)) {
                    handled.add(win);
                    win.webContents.openDevTools({ mode: 'detach' });
                }
                if (seedFile) {
                    applySeed({ win, seedFile, markerFile: path.join(userDataDir, '.seeded'), fsImpl, log }).catch((e) => log(`dev: seed failed: ${e && e.message}`));
                }
            });
        });
    }
    if (watch) startWatching({ app, root, windows: () => BrowserWindow.getAllWindows(), log, fsImpl, env });
    return { devtools, watch };
}

module.exports = { RESTART_EXIT_CODE, wantsDevtools, wantsWatch, debounce, isNoise, watchTree, startWatching, isPageWindow, readSeed, seedScript, applySeed, init };

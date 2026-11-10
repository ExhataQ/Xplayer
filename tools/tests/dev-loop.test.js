'use strict';

// The development loop (phase 3 of .agent/archive/dev-plan/DEV-PLAN.md): the launcher and its profiles, the watchers, DevTools, the one-time seed and the
// sample library. No Electron and no browser: the app and the windows are small stand-ins.
//
// Run:   node --test tools/tests/dev-loop.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const devTools = require('../../electron/dev-tools');
const start = require('../dev/start');
const sample = require('../dev/make-sample-library');

const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `xplayer-${name}-`));

// A clock the test moves by hand.
function fakeTimers() {
    let now = 0;
    let next = 1;
    const pending = new Map();
    return {
        set: (fn, ms) => { const id = next++; pending.set(id, { fn, at: now + ms }); return id; },
        clear: (id) => pending.delete(id),
        advance(ms) {
            now += ms;
            for (const [id, t] of [...pending]) if (t.at <= now) { pending.delete(id); t.fn(); }
        },
        count: () => pending.size
    };
}

describe('the launcher (tools/dev/start.js)', () => {
    test('arguments: its own switches are taken out, everything else goes on to Electron', () => {
        const a = start.parseArgs(['--dev', '--profile=sample', '--ui=current', '--yes', '--inspect']);
        assert.equal(a.dev, true);
        assert.equal(a.profile, 'sample');
        assert.equal(a.yes, true);
        assert.deepEqual(a.rest, ['--ui=current', '--inspect']);
        assert.deepEqual(a.errors, []);
    });

    test('an unknown profile, or --data without the real profile, is an error and not a guess', () => {
        assert.match(start.parseArgs(['--profile=fake']).errors[0], /--profile must be one of/);
        assert.match(start.parseArgs(['--data=x']).errors[0], /goes with --profile=real/);
    });

    test('no profile: the data folder is XPLAYER_DATA when set, else the default (null)', () => {
        assert.equal(start.planProfile(start.parseArgs([]), { env: {} }).dataDir, null);
        assert.equal(start.planProfile(start.parseArgs([]), { env: { XPLAYER_DATA: '/x/data' } }).dataDir, path.resolve('/x/data'));
    });

    test('empty: a folder under the profiles, wiped each time; sample: made once, seeded; neither asks for a confirmation', () => {
        const env = { XPLAYER_DATA: '/should/be/ignored' };
        const empty = start.planProfile(start.parseArgs(['--profile=empty']), { env, profilesDir: '/p' });
        assert.deepEqual([empty.dataDir, empty.wipe, empty.confirm], [path.join('/p', 'empty'), true, false]);
        const sampled = start.planProfile(start.parseArgs(['--profile=sample']), { env, profilesDir: '/p' });
        assert.deepEqual([sampled.dataDir, sampled.makeSample, sampled.seed, sampled.wipe, sampled.confirm], [path.join('/p', 'sample'), true, true, false, false]);
    });

    test('real: needs a folder, never wipes, always asks', () => {
        assert.match(start.planProfile(start.parseArgs(['--profile=real']), { env: {} }).error, /needs the folder/);
        const plan = start.planProfile(start.parseArgs(['--profile=real', '--data=/my/Xplayer-Data']), { env: {} });
        assert.deepEqual([plan.dataDir, plan.wipe, plan.makeSample, plan.confirm], [path.resolve('/my/Xplayer-Data'), false, false, true]);
        const fromEnv = start.planProfile(start.parseArgs(['--profile=real']), { env: { XPLAYER_REAL_DATA: '/env/data' } });
        assert.equal(fromEnv.dataDir, path.resolve('/env/data'));
    });

    test('the confirmation: only the word "real" opens it; with no terminal it needs --yes', async () => {
        const quiet = () => {};
        assert.equal(await start.confirmReal('/d', { yes: false, isTTY: true, prompt: async () => 'real', log: quiet }), true);
        assert.equal(await start.confirmReal('/d', { yes: false, isTTY: true, prompt: async () => 'yes', log: quiet }), false);
        assert.equal(await start.confirmReal('/d', { yes: false, isTTY: true, prompt: async () => '', log: quiet }), false);
        assert.equal(await start.confirmReal('/d', { yes: false, isTTY: false, prompt: async () => 'real', log: quiet }), false);
        assert.equal(await start.confirmReal('/d', { yes: true, isTTY: false, prompt: async () => { throw new Error('asked'); }, log: quiet }), true);
    });

    test('a data folder is recognised by its library or its settings', () => {
        const dir = tmp('data');
        assert.equal(start.looksLikeDataFolder(dir), false);
        fs.mkdirSync(path.join(dir, 'settings'));
        assert.equal(start.looksLikeDataFolder(dir), true);
    });

    test('the profiles live under .dev-data, which git and the backup leave out', () => {
        assert.equal(start.PROFILES_DIR, path.join(ROOT, '.dev-data', 'profiles'));
        assert.match(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8'), /^\.dev-data\/$/m);
        assert.match(fs.readFileSync(path.join(ROOT, 'tools', 'backup_source.py'), 'utf8'), /SKIP_DIRS = \{[^}]*"\.dev-data"/);
    });

    test('npm start, dev and sample go to these scripts', () => {
        const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
        assert.equal(scripts.start, 'node tools/dev/start.js');
        assert.equal(scripts.dev, 'node tools/dev/start.js --dev');
        assert.equal(scripts.sample, 'node tools/dev/make-sample-library.js');
    });
});

describe('switches in the app (electron/dev-tools.js)', () => {
    test('DevTools and watching: by flag or by variable, off otherwise', () => {
        assert.equal(devTools.wantsDevtools({ argv: ['x', '--devtools'], env: {} }), true);
        assert.equal(devTools.wantsDevtools({ argv: [], env: { XPLAYER_DEVTOOLS: '1' } }), true);
        assert.equal(devTools.wantsDevtools({ argv: [], env: {} }), false);
        assert.equal(devTools.wantsWatch({ argv: ['--watch'], env: {} }), true);
        assert.equal(devTools.wantsWatch({ argv: [], env: { XPLAYER_WATCH: '0' } }), false);
    });

    test('a packaged build does none of it, whatever the switches say', () => {
        const events = [];
        const app = { isPackaged: true, on: (name) => events.push(name), relaunch() { events.push('relaunch'); }, exit() { events.push('exit'); } };
        const result = devTools.init({ app, BrowserWindow: { getAllWindows: () => [] }, root: tmp('root'), userDataDir: tmp('ud'), argv: ['--devtools', '--watch'], env: { XPLAYER_SEED: '/s.json' } });
        assert.deepEqual(result, { devtools: false, watch: false });
        assert.deepEqual(events, []);
    });

    test('debounce: a burst of calls runs once, after the quiet time', () => {
        const timers = fakeTimers();
        let runs = 0;
        const fn = devTools.debounce(() => { runs++; }, 200, timers);
        fn(); timers.advance(100); fn(); timers.advance(100); fn();
        assert.equal(runs, 0);
        timers.advance(199);
        assert.equal(runs, 0);
        timers.advance(1);
        assert.equal(runs, 1);
        fn.cancel();
        assert.equal(timers.count(), 0);
    });

    test('editor leftovers are not changes', () => {
        for (const name of ['js/app.js~', 'x/.#app.js', 'a.swp', 'file.tmp', '4913', 'css/main.css.bak', '']) assert.equal(devTools.isNoise(name), true, name);
        for (const name of ['js/app.js', 'ui-next/index.html', 'main.css']) assert.equal(devTools.isNoise(name), false, name);
    });

    // The watchers over a stand-in for fs.watch: the test calls the listener itself.
    function watchSetup({ launcher = false } = {}) {
        const listeners = {};
        const closed = [];
        const fsImpl = { watch: (dir, opts, fn) => { listeners[path.basename(dir)] = (name) => fn('change', name); return { on() {}, close: () => closed.push(path.basename(dir)) }; } };
        const reloads = [];
        const win = { isDestroyed: () => false, webContents: { reloadIgnoringCache: () => reloads.push('reload') } };
        const gone = { isDestroyed: () => true, webContents: { reloadIgnoringCache: () => reloads.push('destroyed window reloaded') } };
        const calls = [];
        const app = { relaunch: () => calls.push('relaunch'), exit: (code) => calls.push(`exit ${code}`) };
        const timers = fakeTimers();
        const stop = devTools.startWatching({ app, root: '/r', windows: () => [win, gone], fsImpl, timers, env: launcher ? { XPLAYER_LAUNCHER: '1' } : {}, log: () => {} });
        return { listeners, closed, reloads, calls, timers, stop };
    }

    test('a change in src/ reloads the windows once, however many files changed, and skips closed windows', () => {
        const w = watchSetup();
        w.listeners.src('js/a.js'); w.listeners.src('css/b.css'); w.listeners.src('player.js');
        w.timers.advance(200);
        assert.deepEqual(w.reloads, ['reload']);
        assert.deepEqual(w.calls, []);
    });

    test('a change in electron/ restarts the app (relaunch), and under the launcher exits with its restart code instead', () => {
        const plain = watchSetup();
        plain.listeners.electron('main.js'); plain.listeners.electron('app-paths.js');
        plain.timers.advance(200);
        assert.deepEqual(plain.calls, ['relaunch', 'exit 0']);
        assert.deepEqual(plain.reloads, []);
        const launched = watchSetup({ launcher: true });
        launched.listeners.electron('main.js');
        launched.timers.advance(200);
        assert.deepEqual(launched.calls, [`exit ${devTools.RESTART_EXIT_CODE}`]);
    });

    test('in electron/ only code and data files count (not a note or a log)', () => {
        const w = watchSetup();
        w.listeners.electron('readme.txt'); w.listeners.electron('notes.txt'); w.listeners.electron('__pycache__/x.pyc');
        w.timers.advance(500);
        assert.deepEqual(w.calls, []);
    });

    test('stopping closes both watchers and cancels what is waiting', () => {
        const w = watchSetup();
        w.listeners.src('a.js');
        w.stop();
        w.timers.advance(500);
        assert.deepEqual(w.reloads, []);
        assert.deepEqual(w.closed.sort(), ['electron', 'src']);
    });

    test('a watch that cannot start is not an error', () => {
        const stop = devTools.watchTree('/nowhere', () => {}, { fsImpl: { watch: () => { throw new Error('ENOENT'); } } });
        assert.equal(typeof stop, 'function');
        stop();
    });

    test('only the two interface pages count as page windows', () => {
        const at = (url) => ({ webContents: { getURL: () => url } });
        assert.equal(devTools.isPageWindow(at('file:///C:/x/src/ui-next/index.html')), true);
        assert.equal(devTools.isPageWindow(at('file:///C:/x/src/music_player.html?tool=lyrics')), true);
        assert.equal(devTools.isPageWindow(at('file:///C:/x/src/loading.html')), false);
        assert.equal(devTools.isPageWindow({ webContents: { getURL: () => { throw new Error('destroyed'); } } }), false);
    });
});

describe('the one-time seed', () => {
    function page() {
        const log = { ran: [], reloads: 0 };
        const store = {};
        const win = {
            webContents: {
                executeJavaScript: async (script) => {
                    log.ran.push(script);
                    // The page's side: run the script against a tiny localStorage.
                    const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
                    return new Function('localStorage', `return ${script}`)(localStorage);
                },
                reloadIgnoringCache: () => { log.reloads++; }
            }
        };
        return { win, log, store };
    }

    test('keys with no value are filled, the page reloads, and a marker stops a second run', async () => {
        const dir = tmp('seed');
        const seedFile = path.join(dir, 'seed.json');
        fs.writeFileSync(seedFile, JSON.stringify({ localStorage: { playlists: '[{"id":"p"}]', favorites: '[1,2]' } }));
        const markerFile = path.join(dir, 'settings', '.seeded');
        const p = page();
        assert.equal(await devTools.applySeed({ win: p.win, seedFile, markerFile }), 2);
        assert.deepEqual(p.store, { playlists: '[{"id":"p"}]', favorites: '[1,2]' });
        assert.equal(p.log.reloads, 1);
        assert.equal(fs.existsSync(markerFile), true);
        const again = page();
        assert.equal(await devTools.applySeed({ win: again.win, seedFile, markerFile }), 0);
        assert.equal(again.log.ran.length, 0);
    });

    test('a key the page already has is left alone', async () => {
        const dir = tmp('seed');
        const seedFile = path.join(dir, 'seed.json');
        fs.writeFileSync(seedFile, JSON.stringify({ localStorage: { playlists: '["seed"]', favorites: '["seed"]' } }));
        const p = page();
        p.store.favorites = '["mine"]';
        assert.equal(await devTools.applySeed({ win: p.win, seedFile, markerFile: path.join(dir, '.seeded') }), 1);
        assert.equal(p.store.favorites, '["mine"]');
        assert.equal(p.store.playlists, '["seed"]');
    });

    test('no file, a damaged file or the wrong shape does nothing and does not throw', async () => {
        const dir = tmp('seed');
        const p = page();
        assert.equal(await devTools.applySeed({ win: p.win, seedFile: path.join(dir, 'none.json'), markerFile: path.join(dir, '.m1') }), 0);
        fs.writeFileSync(path.join(dir, 'bad.json'), '{not json');
        assert.equal(await devTools.applySeed({ win: p.win, seedFile: path.join(dir, 'bad.json'), markerFile: path.join(dir, '.m2') }), 0);
        fs.writeFileSync(path.join(dir, 'odd.json'), JSON.stringify({ localStorage: { a: 5, b: null, c: 'ok' } }));
        assert.deepEqual(devTools.readSeed(path.join(dir, 'odd.json')), [['c', 'ok']]);
        assert.equal(p.log.ran.length, 0);
    });
});

describe('the sample library (tools/dev/make-sample-library.js)', () => {
    test('the plan is the same for the same seed, differs for another, and has the awkward cases', () => {
        const a = sample.planLibrary({ count: 300, seed: 1 });
        assert.deepEqual(sample.planLibrary({ count: 300, seed: 1 }), a);
        assert.notDeepEqual(sample.planLibrary({ count: 300, seed: 2 }).albums.map((x) => x.title), a.albums.map((x) => x.title));
        const songs = a.albums.reduce((n, album) => n + album.tracks.length, 0);
        assert.equal(songs, 300);
        assert.ok(a.albums.length >= 20 && a.artists.length >= 10, `${a.albums.length} albums, ${a.artists.length} artists`);
        assert.ok(a.edge.some((e) => /[\u0600-\u06FF]/.test(e.title)), 'a right-to-left title');
        assert.ok(a.edge.some((e) => !e.artist && !e.album), 'a song with no artist and no album');
        assert.ok(a.edge.some((e) => e.title.length > 60), 'a very long title');
        assert.ok(a.edge.some((e) => e.noCover), 'a song with no cover');
        for (const album of a.albums) assert.equal(new Set(album.tracks.map((t) => t.title)).size, album.tracks.length, `${album.title}: no repeated title`);
    });

    test('making it: songs, covers, silent files with tags, folders, favorites and playlists; the second run leaves it alone', async () => {
        const dir = tmp('sample');
        const result = await sample.makeSampleLibrary({ dataDir: dir, count: 24, seed: 3 });
        assert.equal(result.created, true);
        const { readSongs } = require('../../electron/songs-store');
        const songs = readSongs(path.join(dir, 'library'));
        assert.equal(songs.length, result.songs);
        assert.ok(songs.length >= 24);
        assert.deepEqual(songs.map((s) => s.id), songs.map((_, i) => i), 'ids are 0, 1, 2, ...');
        for (const s of songs) {
            const file = decodeURI(s.url.replace(/^file:\/\/\//, '')).replace(/^\/+/, '/');
            assert.ok(fs.existsSync(process.platform === 'win32' ? file.replace(/^\//, '') : file), `${s.title}: the audio file is there`);
            assert.match(s.duration, /^0:0[2-4]$/);
        }
        const withCover = songs.filter((s) => s.cover);
        assert.ok(withCover.length >= songs.length - 3, 'nearly every song has a cover');
        for (const s of withCover) {
            assert.ok(fs.existsSync(path.join(dir, 'library', s.cover)), s.cover);
            assert.ok(fs.existsSync(path.join(dir, 'library', s.largeCover)), s.largeCover);
        }
        assert.ok(songs.some((s) => s.missingTags && s.missingTags.includes('artist')), 'the untagged song is marked');
        // The music folder is registered, so a rescan reads these files rather than finding nothing.
        const folders = JSON.parse(fs.readFileSync(path.join(dir, 'settings', 'music-folders-config.json'), 'utf8'));
        assert.deepEqual(folders.folders, [path.join(dir, 'sample-music')]);
        assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'settings', 'music-folder-config.json'), 'utf8')).musicFolder, path.join(dir, 'sample-music'));
        // The seed holds what the page keeps in localStorage.
        const seed = JSON.parse(fs.readFileSync(path.join(dir, 'sample-seed.json'), 'utf8')).localStorage;
        const playlists = JSON.parse(seed.playlists);
        const ids = new Set(songs.map((s) => s.id));
        assert.ok(playlists.length >= 4);
        for (const p of playlists) {
            assert.equal(typeof p.id, 'string');
            assert.equal(typeof p.name, 'string');
            assert.ok(p.songs.every((id) => ids.has(id)), `${p.name}: only songs that exist`);
        }
        assert.ok(playlists.some((p) => p.songs.length === 0), 'an empty playlist');
        assert.ok(JSON.parse(seed.favorites).every((id) => ids.has(id)));
        // The page's own reader accepts the seeded text.
        const { normalizePlaylists, normalizeIdList } = require('../../src/js/core/storage-schema.js');
        assert.equal(normalizePlaylists(playlists).length, playlists.length);
        assert.equal(normalizeIdList(JSON.parse(seed.favorites)).length, JSON.parse(seed.favorites).length);

        const again = await sample.makeSampleLibrary({ dataDir: dir, count: 24, seed: 3 });
        assert.equal(again.created, false);
        assert.equal(readSongs(path.join(dir, 'library')).length, songs.length);
    });

    test('the tags are in the files, so a rescan gives back what the list shows', async () => {
        const dir = tmp('sample');
        await sample.makeSampleLibrary({ dataDir: dir, count: 12, seed: 5 });
        const { readSongs } = require('../../electron/songs-store');
        const song = readSongs(path.join(dir, 'library')).find((s) => s.artist && s.album && !/^[^\x00-\x7f]/.test(s.title));
        const file = decodeURI(song.url.replace(/^file:\/\/\//, '')).replace(/^\/+/, '/');
        const mm = await import('music-metadata');
        const parsed = await (mm.parseFile || mm.default.parseFile)(process.platform === 'win32' ? file.replace(/^\//, '') : file);
        assert.equal(parsed.common.title, song.title);
        assert.equal(parsed.common.artist, song.artist);
        assert.equal(parsed.common.album, song.album);
        assert.ok(parsed.format.duration > 1.5 && parsed.format.duration < 4.5, `duration ${parsed.format.duration}`);
    });

    test('--force makes it again; arguments are read as documented', async () => {
        assert.deepEqual(sample.parseArgs(['/d', '--count=50', '--seed=9', '--force']), { dataDir: path.resolve('/d'), count: 50, seed: 9, force: true });
        assert.equal(sample.parseArgs(['--count=2']).count, 10, 'a count under 10 is raised to 10');
        const dir = tmp('sample');
        await sample.makeSampleLibrary({ dataDir: dir, count: 12, seed: 1 });
        const marker = path.join(dir, 'library', 'covers', 'stale.txt');
        fs.writeFileSync(marker, 'x');
        const again = await sample.makeSampleLibrary({ dataDir: dir, count: 12, seed: 1, force: true });
        assert.equal(again.created, true);
        assert.equal(fs.existsSync(marker), false);
    });
});

describe('gen-web --watch', () => {
    test('it watches the sources of the generated files, and each of them exists', () => {
        const gen = require('../dev/gen-web');
        const sources = gen.sourcePaths();
        assert.ok(sources.length >= 5);
        for (const s of sources) assert.ok(fs.existsSync(s), `${path.relative(ROOT, s)} exists`);
        assert.equal(typeof gen.watch, 'function');
    });
});

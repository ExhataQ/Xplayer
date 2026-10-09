// electron/songs-store.js: the library kept in songs.json, and the page taking its list from it.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const store = require('../../electron/songs-store');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'songs-store-'));
}

const SONGS = [
    { id: 0, title: 'Money $$$', artist: 'a $& b', url: 'file:///C:/m/1.mp3', comment: 'x ]; y' },
    { id: 1, title: 'ب', artist: 'c', url: 'file:///C:/m/2.mp3' }
];

test('songs are written and read back exactly, with no temporary file left', () => {
    const dir = tempDir();
    assert.deepEqual(store.readSongs(dir), [], 'nothing saved yet');
    store.writeSongs(dir, SONGS);
    assert.deepEqual(store.readSongs(dir), SONGS);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['songs.json']);
    assert.throws(() => store.writeSongs(dir, 'not a list'));
});

test('each write keeps the previous list as songs.json.bak', () => {
    const dir = tempDir();
    store.writeSongs(dir, [SONGS[0]]);
    store.writeSongs(dir, SONGS);
    const backup = JSON.parse(fs.readFileSync(path.join(dir, 'songs.json.bak'), 'utf8'));
    assert.deepEqual(backup.songs, [SONGS[0]]);
});

test('a library still inside an older player.js is carried over to songs.json (old player.js is not touched)', () => {
    const dir = tempDir();
    const playerJs = 'const SONGS_DATA = ' + JSON.stringify(SONGS) + ';\nconst PLACEHOLDER_IMAGE = \'x\';\n';
    fs.writeFileSync(path.join(dir, 'player.js'), playerJs);
    assert.deepEqual(store.readSongs(dir), SONGS);
    assert.ok(fs.existsSync(path.join(dir, 'songs.json')), 'songs.json created');
    assert.equal(fs.readFileSync(path.join(dir, 'player.js'), 'utf8'), playerJs);
    // after the move, songs.json wins over whatever player.js still contains
    store.writeSongs(dir, [SONGS[1]]);
    assert.deepEqual(store.readSongs(dir), [SONGS[1]]);
});

test('an empty list inside player.js (a fresh build) does not create songs.json', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'player.js'), 'const SONGS_DATA = [];');
    assert.deepEqual(store.readSongs(dir), []);
    assert.equal(fs.existsSync(path.join(dir, 'songs.json')), false);
});

test('a damaged songs.json is set aside and the last good copy is used', () => {
    const dir = tempDir();
    store.writeSongs(dir, [SONGS[0]]);
    store.writeSongs(dir, SONGS);
    fs.writeFileSync(path.join(dir, 'songs.json'), '{"version":1,"songs":[{"id":0,');
    assert.deepEqual(store.readSongs(dir), [SONGS[0]]);
    const kept = fs.readdirSync(dir).filter((n) => n.startsWith('songs.json.corrupt-'));
    assert.equal(kept.length, 1, 'the damaged file is kept for inspection');
});

test('a bare array (hand-made file) is accepted too', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'songs.json'), JSON.stringify(SONGS));
    assert.deepEqual(store.readSongs(dir), SONGS);
});

test('updateSongs changes the list under one lock, and leaves the file alone when fn returns nothing', () => {
    const dir = tempDir();
    store.writeSongs(dir, SONGS);
    store.updateSongs(dir, (songs) => { songs[0].title = 'Edited'; return songs; });
    assert.equal(store.readSongs(dir)[0].title, 'Edited');
    const before = fs.readFileSync(path.join(dir, 'songs.json'), 'utf8');
    assert.equal(store.updateSongs(dir, () => undefined), undefined);
    assert.equal(fs.readFileSync(path.join(dir, 'songs.json'), 'utf8'), before);
    assert.equal(fs.existsSync(path.join(dir, 'songs.json.lock')), false, 'lock released');
    // the lock is released when fn throws
    assert.throws(() => store.updateSongs(dir, () => { throw new Error('boom'); }), /boom/);
    assert.equal(fs.existsSync(path.join(dir, 'songs.json.lock')), false);
});

test('a lock left behind by a crashed process is cleared after it goes stale', () => {
    const dir = tempDir();
    const lock = path.join(dir, 'songs.json.lock');
    fs.writeFileSync(lock, '');
    const old = new Date(Date.now() - 120000);
    fs.utimesSync(lock, old, old);
    store.writeSongs(dir, SONGS);
    assert.deepEqual(store.readSongs(dir), SONGS);
});

// Windows can answer an exclusive create with EPERM instead of EEXIST. The error is injected so this runs on any OS.
function withInjectedOpenError(code, onOpen, body) {
    const real = fs.openSync;
    let calls = 0;
    fs.openSync = function (file, flags, ...rest) {
        if (typeof file === 'string' && file.endsWith('songs.json.lock') && flags === 'wx') {
            calls++;
            if (onOpen(calls, file)) {
                const err = new Error(code + ': injected');
                err.code = code;
                throw err;
            }
        }
        return real.call(fs, file, flags, ...rest);
    };
    try {
        body();
    } finally {
        fs.openSync = real;
    }
    return calls;
}

test('EPERM while the lock file exists is treated as contention and retried', () => {
    const dir = tempDir();
    const lock = path.join(dir, 'songs.json.lock');
    fs.writeFileSync(lock, '');
    const calls = withInjectedOpenError('EPERM', (n, file) => {
        if (n === 2) fs.unlinkSync(file); // the holder releases; the next attempt can take the lock
        return n <= 2;
    }, () => store.writeSongs(dir, SONGS));
    assert.ok(calls >= 3, 'acquisition was retried');
    assert.deepEqual(store.readSongs(dir), SONGS);
    assert.equal(fs.existsSync(lock), false, 'lock released');
});

test('EPERM when the lock vanished before inspection is retried', () => {
    const dir = tempDir();
    const calls = withInjectedOpenError('EPERM', (n) => n === 1, () => store.writeSongs(dir, SONGS));
    assert.equal(calls, 2);
    assert.deepEqual(store.readSongs(dir), SONGS);
});

test('EPERM with no lock file present is not retried forever', () => {
    const dir = tempDir();
    let calls = 0;
    assert.throws(() => withInjectedOpenError('EPERM', () => { calls++; return true; }, () => store.writeSongs(dir, SONGS)), { code: 'EPERM' });
    assert.ok(calls >= 2 && calls <= 10, 'bounded retries, got ' + calls);
});

test('other open errors are not swallowed', () => {
    const dir = tempDir();
    assert.throws(() => withInjectedOpenError('EACCES', () => true, () => store.writeSongs(dir, SONGS)), { code: 'EACCES' });
});

test('several processes adding songs at the same time lose none', async () => {
    const dir = tempDir();
    store.writeSongs(dir, []);
    const script = `
        const store = require(${JSON.stringify(path.join(__dirname, '..', '..', 'electron', 'songs-store.js'))});
        const who = process.argv[1];
        for (let i = 0; i < 25; i++) store.updateSongs(${JSON.stringify(dir)}, (songs) => { songs.push({ id: who + '-' + i }); return songs; });`;
    const runs = ['a', 'b', 'c', 'd'].map((who) => new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['-e', script, who], { stdio: 'inherit' });
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('writer ' + who + ' exited ' + code))));
    }));
    await Promise.all(runs);
    const ids = store.readSongs(dir).map((s) => s.id);
    assert.equal(ids.length, 100);
    assert.equal(new Set(ids).size, 100);
});

test('main, scanner and scan-folder keep the library in songs.json and never rewrite player.js', () => {
    for (const file of ['main.js', 'scanner.js', 'scan-folder.js']) {
        const src = fs.readFileSync(path.join(__dirname, '..', '..', 'electron', file), 'utf8');
        assert.equal(/writeFileSync\([^)]*player\.js/.test(src), false, file + ' writes player.js');
        assert.equal(/SONGS_DATA/.test(src.replace(/\/\/.*$/gm, '')), false, file + ' still mentions SONGS_DATA outside comments');
    }
});

describe('the page takes its song list from the main process', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(10);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    async function open(startupSongs) {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript((songs) => {
            const fake = new Proxy({}, {
                get: (target, key) => {
                    if (key === 'then') return undefined;
                    if (key === 'getStartupSongs') return () => songs;
                    if (/^on[A-Z]/.test(String(key))) return () => {};
                    return () => Promise.resolve(null);
                }
            });
            // The fixture installs its own stub later; this getter keeps ours in place.
            Object.defineProperty(window, 'electronAPI', { get: () => fake, set: () => {}, configurable: true });
        }, startupSongs);
        await page.goto('file://' + path.join(dir, 'index.html').replace(/\\/g, '/'));
        await page.waitForTimeout(800);
        return { page, errors };
    }

    test('the list from getStartupSongs is the library (an empty one is an empty library)', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const mine = [
            { id: 0, title: 'From songs.json A', artist: 'X', album: 'Y', url: 'file:///C:/a.mp3', duration: 10 },
            { id: 1, title: 'From songs.json B', artist: 'X', album: 'Y', url: 'file:///C:/b.mp3', duration: 20 }
        ];
        const full = await open(mine);
        assert.deepEqual(await full.page.evaluate(() => SONGS_DATA.map((s) => s.title)), ['From songs.json A', 'From songs.json B']);
        assert.deepEqual(full.errors, []);
        await full.page.close();
        const empty = await open([]);
        assert.equal(await empty.page.evaluate(() => SONGS_DATA.length), 0);
        assert.deepEqual(empty.errors, []);
        await empty.page.close();
    });

    test('with no usable answer (plain browser, tests) the build placeholder list is used', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open(null);
        assert.equal(await page.evaluate(() => SONGS_DATA.length), 10);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

// ---- main.js wiring (run in a copy of electron/ with a fake 'electron', so nothing real is touched) ----

describe('main process hands out and updates the library through songs.json', () => {
    const Module = require('node:module');
    let root, handlers, listeners, realLoad;

    before(() => {
        root = tempDir();
        const copy = path.join(root, 'electron');
        fs.mkdirSync(copy);
        for (const name of fs.readdirSync(path.join(__dirname, '..', '..', 'electron'))) {
            if (name.endsWith('.js')) fs.copyFileSync(path.join(__dirname, '..', '..', 'electron', name), path.join(copy, name));
        }
        // The tag editor needs Python; stand in for it.
        fs.writeFileSync(path.join(copy, 'metadata-editor.js'),
            "module.exports = { getAudioMetadata: async () => ({}), saveAudioCover: async () => ({}), saveAudioMetadata: async () => ({ success: true, metadata: { title: 'Edited title' } }) };");
        handlers = {};
        listeners = {};
        const fake = {
            app: { disableHardwareAcceleration() {}, whenReady: () => new Promise(() => {}), on() {}, quit() {}, getPath: () => root },
            ipcMain: { handle: (name, fn) => { handlers[name] = fn; }, on: (name, fn) => { listeners[name] = fn; } },
            shell: {}, dialog: {}, BrowserWindow: function () {}
        };
        realLoad = Module._load;
        Module._load = function (request, ...rest) { return request === 'electron' ? fake : realLoad.call(this, request, ...rest); };
        process.env.MUSIC_PLAYER_CONFIG_DIR = path.join(root, 'settings');
        require(path.join(copy, 'main.js'));
    });
    after(() => {
        Module._load = realLoad;
        delete process.env.MUSIC_PLAYER_CONFIG_DIR;
        fs.rmSync(root, { recursive: true, force: true });
    });

    test('songs-store:load answers right away with the saved list (and an empty list when there is none)', () => {
        const dir = path.join(root, 'electron', 'MusicPlayerOutput');
        const ask = () => { const event = {}; listeners['songs-store:load'](event); return event.returnValue; };
        assert.deepEqual(ask(), []);
        store.writeSongs(dir, SONGS);
        assert.deepEqual(ask(), SONGS);
    });

    test('saving tags updates that song in songs.json and nothing else', async () => {
        const dir = path.join(root, 'electron', 'MusicPlayerOutput');
        store.writeSongs(dir, SONGS);
        const result = await handlers['save-audio-metadata']({}, { fileUrl: SONGS[1].url, metadata: { title: 'Edited title' } });
        assert.equal(result.success, true);
        const after = store.readSongs(dir);
        assert.equal(after[1].title, 'Edited title');
        assert.deepEqual(after[0], SONGS[0]);
        assert.equal(fs.existsSync(path.join(dir, 'player.js')), false, 'player.js is not created or touched');
    });
});

'use strict';

// electron/app-paths.js: where the pages, the library and the settings are, in each way the app can run.
// No Electron needed: resolveLayout() takes the facts (environment, packaged or not, which files exist) as arguments.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const appPaths = require(path.join(ROOT, 'electron', 'app-paths.js'));

const none = () => false;
const SRC = path.join(ROOT, 'src');

describe('resolveLayout', () => {
    test('npm start: pages from src, data in Source/.dev-data', () => {
        const l = appPaths.resolveLayout({ env: {}, isPackaged: false, exists: none });
        assert.equal(l.mode, 'dev');
        assert.equal(l.webRoot, SRC);
        assert.equal(l.libraryDir, path.join(ROOT, '.dev-data', 'library'));
        assert.equal(l.settingsDir, path.join(ROOT, '.dev-data', 'settings'));
    });

    test('XPLAYER_DATA moves the data folder', () => {
        const dir = path.resolve(os.tmpdir(), 'xp-data');
        const l = appPaths.resolveLayout({ env: { XPLAYER_DATA: dir }, isPackaged: false, exists: none });
        assert.equal(l.libraryDir, path.join(dir, 'library'));
        assert.equal(l.settingsDir, path.join(dir, 'settings'));
    });

    test('a packaged app with portable.txt keeps its data beside the exe', () => {
        const exe = path.join(os.tmpdir(), 'Xplayer', 'Xplayer.exe');
        const marker = path.join(path.dirname(exe), 'portable.txt');
        const l = appPaths.resolveLayout({ env: {}, isPackaged: true, execPath: exe, exists: (p) => p === marker });
        assert.equal(l.mode, 'portable');
        assert.equal(l.libraryDir, path.join(path.dirname(exe), 'Xplayer-Data', 'library'));
        assert.equal(l.settingsDir, path.join(path.dirname(exe), 'Xplayer-Data', 'settings'));
    });

    test('a packaged app without the marker is installed: Electron keeps the settings, the library goes beside them', () => {
        const user = path.join(os.tmpdir(), 'user-data');
        const l = appPaths.resolveLayout({ env: {}, isPackaged: true, execPath: path.join(os.tmpdir(), 'x', 'Xplayer.exe'), exists: none, userDataDir: user });
        assert.equal(l.mode, 'installed');
        assert.equal(l.libraryDir, path.join(user, 'library'));
        assert.equal(l.settingsDir, null);
    });

    test('the old App folder is gone: MUSIC_PLAYER_OUTPUT_DIR and a MusicPlayerOutput folder next to the code change nothing', () => {
        const main = path.join(os.tmpdir(), 'App');
        const l = appPaths.resolveLayout({ env: { MUSIC_PLAYER_OUTPUT_DIR: path.join(os.tmpdir(), 'old-out') }, isPackaged: false, mainDir: main, exists: (p) => p === path.join(main, 'MusicPlayerOutput') });
        assert.equal(l.mode, 'dev');
        assert.equal(l.webRoot, path.join(SRC));
        assert.equal(l.libraryDir, path.join(ROOT, '.dev-data', 'library'));
    });

    test('the modes are dev, portable and installed only', () => {
        const modes = new Set([
            appPaths.resolveLayout({ env: {}, isPackaged: false, exists: none }).mode,
            appPaths.resolveLayout({ env: { XPLAYER_DATA: os.tmpdir() }, isPackaged: true, exists: none }).mode,
            appPaths.resolveLayout({ env: {}, isPackaged: true, execPath: path.join(os.tmpdir(), 'Xplayer.exe'), exists: (p) => p.endsWith('portable.txt') }).mode,
            appPaths.resolveLayout({ env: {}, isPackaged: true, execPath: path.join(os.tmpdir(), 'Xplayer.exe'), exists: none, userDataDir: os.tmpdir() }).mode
        ]);
        assert.deepEqual([...modes].sort(), ['dev', 'installed', 'portable']);
    });
});

describe('app icon', () => {
    test('the windows get the X mark from src/assets/app-icon, and the file exists', () => {
        const l = appPaths.resolveLayout({ env: {}, isPackaged: false, exists: none });
        assert.equal(path.dirname(l.appIcon), path.join(SRC, 'assets', 'app-icon'));
        assert.match(path.basename(l.appIcon), /^xplayer(\.ico|-512\.png)$/);
        assert.ok(fs.existsSync(l.appIcon), l.appIcon);
    });

    test('package.json gives the exe the same icon file', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
        assert.equal(pkg.build.win.icon, 'src/assets/app-icon/xplayer.ico');
        assert.ok(fs.existsSync(path.join(ROOT, pkg.build.win.icon)));
    });
});

describe('installCoverRoute', () => {
    function fakeSession() {
        const rec = {};
        return { rec, webRequest: { onBeforeRequest: (filter, fn) => { rec.filter = filter; rec.fn = fn; } } };
    }
    function answer(session, url) {
        let out;
        session.rec.fn({ url }, (r) => { out = r; });
        return out;
    }

    test('covers asked for from the pages go to the library, anything else is left alone', () => {
        const dir = path.join(os.tmpdir(), 'cov-data');
        appPaths.setLayout(appPaths.resolveLayout({ env: { XPLAYER_DATA: dir }, isPackaged: false, exists: none }));
        try {
            const s = fakeSession();
            assert.equal(appPaths.installCoverRoute(s), true);
            const { pathToFileURL } = require('url');
            const asked = pathToFileURL(path.join(SRC, 'covers', 'a b.jpg')).href;
            const expected = pathToFileURL(path.join(dir, 'library', 'covers', 'a b.jpg')).href;
            assert.equal(answer(s, asked).redirectURL, expected);
            // The target is also a .../covers/ URL: it must not be redirected again.
            assert.deepEqual(answer(s, expected), {});
            // A folder of the person's music that happens to be called covers.
            assert.deepEqual(answer(s, pathToFileURL(path.join(os.tmpdir(), 'Music', 'covers', 'x.mp3')).href), {});
        } finally {
            appPaths.setLayout(null);
        }
    });

    test('nothing is installed without a session to install it on', () => {
        assert.equal(appPaths.installCoverRoute(null), false);
        assert.equal(appPaths.installCoverRoute({}), false);
    });
});

describe('tools/dev/gen-web.js', () => {
    const { generated } = require(path.join(ROOT, 'tools', 'dev', 'gen-web.js'));
    test('writes player.js and the old page with no placeholder left', () => {
        const files = Object.fromEntries(generated().map(([f, d]) => [path.relative(ROOT, f).replace(/\\/g, '/'), d]));
        assert.ok(files['src/player.js'] && files['src/music_player.html']);
        for (const name of ['src/player.js', 'src/music_player.html']) assert.doesNotMatch(String(files[name]), /\{\{[A-Z_]+\}\}/, name);
    });
});

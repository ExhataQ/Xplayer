// Tests for the Electron bridge: electron/preload.js (grouped calls plus the old flat names as
// aliases) and src/js/api/desktop-api.js (the renderer wrapper). Node for the unit tests; the last
// test runs the real page with a recording electronAPI (skips itself without playwright).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const ROOT = path.resolve(__dirname, '..', '..');
const JS = path.join(ROOT, 'src', 'js');

// Every name electronAPI had before the groups were added (electron/preload.js at that time).
const ORIGINAL_FLAT_NAMES = [
    'getWindowMaximized', 'closeApp', 'minimizeApp', 'setMinimizeOnClose', 'maximizeApp', 'showFileInExplorer',
    'deleteFile', 'changeMusicFolder', 'focusWindow', 'downloadAndScan', 'importDroppedFiles', 'getMusicFolders',
    'addMusicFolder', 'removeMusicFolder', 'removeMusicFolders', 'rebuildFromFolders', 'invoke', 'getFolderStats',
    'saveLyricsFile', 'readLyricsFile', 'pickDownloadFolder', 'resetDownloadFolder', 'getDownloadFolder',
    'searchOnlineLyrics', 'downloadOnlineLyrics', 'searchOnlineMetadata', 'getOnlineMetadata', 'saveAudioCover',
    'chooseCoverImage', 'getAudioMetadata', 'saveAudioMetadata', 'exportAudioMetadataJson', 'importAudioMetadataJson',
    'onThumbarPrev', 'onThumbarPlayPause', 'onThumbarNext', 'onWindowMaximize', 'onScanCoverBatch',
    'onScanCoversComplete', 'updateThumbarPlayState'
];
const GROUPS = ['window', 'library', 'metadata', 'files', 'lyrics'];

// Runs preload.js with a fake 'electron' and returns what it exposed, plus the ipc calls made.
function loadPreload() {
    const calls = [];
    const record = (kind) => (channel, ...args) => { calls.push({ kind, channel, args: args.map((a) => (typeof a === 'function' ? 'fn' : a)) }); return Promise.resolve('ok'); };
    let exposed;
    const fakeElectron = {
        contextBridge: { exposeInMainWorld: (name, api) => { exposed = { name, api }; } },
        ipcRenderer: { invoke: record('invoke'), send: record('send'), on: record('on') }
    };
    const realLoad = Module._load;
    Module._load = function (request, ...rest) { return request === 'electron' ? fakeElectron : realLoad.call(this, request, ...rest); };
    try {
        const file = path.join(ROOT, 'electron', 'preload.js');
        delete require.cache[require.resolve(file)];
        require(file);
    } finally {
        Module._load = realLoad;
    }
    return { exposed, calls };
}

function loadWrapper(electronAPI) {
    const context = { window: { electronAPI }, Promise, Error, Object, Boolean };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(JS, 'api', 'desktop-api.js'), 'utf8') + '\n;globalThis.__api = desktopApi;', context);
    return context.__api;
}

test('preload: exposes electronAPI with every old flat name still present', () => {
    const { exposed } = loadPreload();
    assert.equal(exposed.name, 'electronAPI');
    for (const name of ORIGINAL_FLAT_NAMES) assert.equal(typeof exposed.api[name], 'function', `electronAPI.${name}`);
});

test('preload: every flat name except invoke is in exactly one group, and the group call uses the same channel', () => {
    const { exposed, calls } = loadPreload();
    const api = exposed.api;
    for (const g of GROUPS) assert.equal(typeof api[g], 'object', `electronAPI.${g}`);
    const inGroups = GROUPS.flatMap((g) => Object.keys(api[g]).map((n) => [g, n]));
    const names = inGroups.map(([, n]) => n);
    assert.deepEqual([...names].sort(), ORIGINAL_FLAT_NAMES.filter((n) => n !== 'invoke').concat(['welcomeSelectFolder']).sort(), 'groups cover every old name, plus welcomeSelectFolder');
    assert.equal(new Set(names).size, names.length, 'no name in two groups');
    for (const [g, n] of inGroups) {
        calls.length = 0;
        api[n]('a', 'b');
        api[g][n]('a', 'b');
        assert.equal(calls.length, 2, `${g}.${n} should make one ipc call, like the flat name`);
        assert.deepEqual(calls[0], calls[1], `${g}.${n} differs from its flat alias`);
    }
});

// The ipc call each old flat name made before the groups were added (kind, channel).
const ORIGINAL_CHANNELS = {
    getWindowMaximized: ['invoke', 'get-window-maximized'], closeApp: ['send', 'close-app'], minimizeApp: ['send', 'minimize-app'],
    setMinimizeOnClose: ['send', 'set-minimize-on-close'], maximizeApp: ['send', 'maximize-app'],
    showFileInExplorer: ['send', 'show-file-in-explorer'], deleteFile: ['send', 'delete-file'],
    changeMusicFolder: ['invoke', 'change-folder'], focusWindow: ['send', 'focus-window'],
    downloadAndScan: ['invoke', 'download-and-scan'], importDroppedFiles: ['invoke', 'import-dropped-files'],
    getMusicFolders: ['invoke', 'get-music-folders'], addMusicFolder: ['invoke', 'add-music-folder'],
    removeMusicFolder: ['invoke', 'remove-music-folder'], removeMusicFolders: ['invoke', 'remove-music-folders'],
    rebuildFromFolders: ['invoke', 'rebuild-from-folders'], getFolderStats: ['invoke', 'get-folder-stats'],
    saveLyricsFile: ['invoke', 'save-lyrics-file'], readLyricsFile: ['invoke', 'read-lyrics-file'],
    pickDownloadFolder: ['invoke', 'pick-download-folder'], resetDownloadFolder: ['invoke', 'reset-download-folder'],
    getDownloadFolder: ['invoke', 'get-download-folder'], searchOnlineLyrics: ['invoke', 'search-online-lyrics'],
    downloadOnlineLyrics: ['invoke', 'download-online-lyrics'], searchOnlineMetadata: ['invoke', 'search-online-metadata'],
    getOnlineMetadata: ['invoke', 'get-online-metadata'], saveAudioCover: ['invoke', 'save-audio-cover'],
    chooseCoverImage: ['invoke', 'choose-cover-image'], getAudioMetadata: ['invoke', 'get-audio-metadata'],
    saveAudioMetadata: ['invoke', 'save-audio-metadata'], exportAudioMetadataJson: ['invoke', 'export-audio-metadata-json'],
    importAudioMetadataJson: ['invoke', 'import-audio-metadata-json'], onThumbarPrev: ['on', 'thumbar-prev'],
    onThumbarPlayPause: ['on', 'thumbar-playpause'], onThumbarNext: ['on', 'thumbar-next'],
    onWindowMaximize: ['on', 'window-maximized'], onScanCoverBatch: ['on', 'scan-cover-batch'],
    onScanCoversComplete: ['on', 'scan-covers-complete'], updateThumbarPlayState: ['send', 'update-thumbar-state']
};

test('preload: every old name still makes the same ipc call as before the groups', () => {
    const { exposed, calls } = loadPreload();
    for (const [name, [kind, channel]] of Object.entries(ORIGINAL_CHANNELS)) {
        calls.length = 0;
        exposed.api[name](() => {});
        assert.equal(calls.length, 1, name);
        assert.equal(calls[0].kind, kind, `${name}: kind`);
        assert.equal(calls[0].channel, channel, `${name}: channel`);
    }
    calls.length = 0;
    exposed.api.invoke('some-channel', 1);
    assert.deepEqual(calls[0], { kind: 'invoke', channel: 'some-channel', args: [1] });
});

test('preload: the new welcomeSelectFolder uses the channel 06b used through invoke()', () => {
    const { exposed, calls } = loadPreload();
    exposed.api.welcomeSelectFolder();
    assert.deepEqual(calls[0], { kind: 'invoke', channel: 'welcome-select-folder', args: [] });
});

test('desktopApi: lists exactly the calls the preload groups expose', () => {
    const { exposed } = loadPreload();
    const expected = GROUPS.flatMap((g) => Object.keys(exposed.api[g]).map((n) => `${g}.${n}`)).sort();
    assert.deepEqual(loadWrapper(undefined).names().sort(), expected);
});

test('desktopApi: calls through to electronAPI with the same arguments and result', async () => {
    const seen = [];
    const api = loadWrapper({ deleteFile: (p) => { seen.push(p); }, addMusicFolder: async (p) => ({ success: true, p }) });
    assert.equal(api.available(), true);
    assert.equal(api.supports('files.deleteFile'), true);
    assert.equal(api.supports('files.showFileInExplorer'), false, 'not on this electronAPI');
    assert.equal(api.supports('nope.deleteFile'), false, 'unknown group');
    api.files.deleteFile('x.mp3');
    assert.deepEqual(seen, ['x.mp3']);
    assert.deepEqual(await api.library.addMusicFolder('C:/m'), { success: true, p: 'C:/m' });
});

test('desktopApi: event callbacks go through whenAppReady when it exists', () => {
    const subscriptions = [];
    const held = [];
    const context = { window: { electronAPI: { onThumbarNext: (cb) => subscriptions.push(cb) } }, Promise, Error, Object, Boolean };
    context.whenAppReady = (fn) => held.push(fn);
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(JS, 'api', 'desktop-api.js'), 'utf8') + '\n;globalThis.__api = desktopApi;', context);
    const seen = [];
    context.__api.window.onThumbarNext((value) => seen.push(value));
    subscriptions[0]('early');
    assert.deepEqual(seen, [], 'held until start-up has finished');
    held.forEach((fn) => fn());
    assert.deepEqual(seen, ['early']);
});

test('desktopApi: with no electronAPI (browser mode) send calls do nothing and invoke calls reject', async () => {
    const api = loadWrapper(undefined);
    assert.equal(api.available(), false);
    assert.equal(api.supports('window.closeApp'), false);
    assert.equal(api.window.closeApp(), undefined);
    assert.equal(api.window.onThumbarPrev(() => {}), undefined);
    await assert.rejects(api.library.getMusicFolders(), /not available: library.getMusicFolders/);
});

test('files other than the other agents\' no longer call window.electronAPI directly', () => {
    // Owned by B, C or D; each swaps its own file in the step "Swap storage and API calls".
    const notYet = new Set([
        '16-context-menu-actions.js',
        '15e-controls-audio-events.js'
    ]);
    const files = [];
    (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name.endsWith('.js')) files.push(full);
        }
    })(JS);
    const offenders = files
        .map((f) => path.relative(JS, f).replace(/\\/g, '/'))
        .filter((rel) => rel !== 'api/desktop-api.js' && !notYet.has(rel))
        .filter((rel) => /\belectronAPI\b/.test(fs.readFileSync(path.join(JS, rel), 'utf8').split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')));
    assert.deepEqual(offenders, [], 'go through desktopApi (src/js/api/desktop-api.js)');
});

const pw = loadPlaywright();
test('page: the swapped A files reach the Electron calls through desktopApi', { timeout: 60000 }, async (t) => {
    if (!pw) return t.skip('playwright is not installed');
    const browser = await launch(pw);
    if (!browser) return t.skip('no browser found');
    const dir = buildApp(10);
    try {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto('file://' + path.join(dir, 'index.html').replace(/\\/g, '/'));
        await page.waitForTimeout(900);
        // The fixture page starts with a stub electronAPI; replace it with one that records calls.
        await page.evaluate(() => {
            window.__calls = [];
            const rec = (name, result) => (...args) => { window.__calls.push([name, ...args]); return result; };
            window.electronAPI = {
                setMinimizeOnClose: rec('setMinimizeOnClose'),
                closeApp: rec('closeApp'),
                maximizeApp: rec('maximizeApp'),
                deleteFile: rec('deleteFile'),
                getMusicFolders: rec('getMusicFolders', Promise.resolve(['C:/Music'])),
                getFolderStats: rec('getFolderStats', Promise.resolve({ songCount: 7, addedTime: null })),
                importDroppedFiles: rec('importDroppedFiles', Promise.resolve({ success: false }))
            };
        });
        const out = await page.evaluate(async () => {
            closeApp();
            maximizeApp();
            setMinimizeOnClose(true);
            importDroppedFiles(['a.mp3']);
            const folders = await loadLibraryLocations();
            const stats = await getFolderStats('C:/Music');
            await new Promise((r) => setTimeout(r, 50));
            return { folders, stats, calls: window.__calls.map((c) => c[0]) };
        });
        assert.deepEqual(out.folders, ['C:/Music']);
        assert.deepEqual(out.stats, { songCount: 7, addedTime: null });
        for (const name of ['setMinimizeOnClose', 'closeApp', 'maximizeApp', 'importDroppedFiles', 'getMusicFolders', 'getFolderStats']) {
            assert.ok(out.calls.includes(name), `${name} should have been called`);
        }
        assert.deepEqual(errors, []);
        await page.close();
    } finally {
        await browser.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

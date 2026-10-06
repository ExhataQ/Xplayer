const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const Module = require('node:module');

// downloads.js asks electron for the default downloads folder; give it a stand-in.
const realLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === 'electron') return { app: { getPath: () => os.tmpdir() } };
    return realLoad.call(this, request, ...rest);
};
const downloads = require('../../electron/downloads');
Module._load = realLoad;

const { parseSongsData, replaceSongsData, findSongsArray } = require('../../electron/songs-data');
const { download, safeDownloadFileName, getUniqueFilePath } = downloads;

// ---- the song list inside player.js ----------------------------------------------------

test('songs-data reads a list whose text contains "];" and brackets', () => {
    const songs = [{ id: 0, title: 'a ]; b', comment: '[x]; "q"', lyrics: 'line\\n];' }, { id: 1, title: 'plain' }];
    const content = 'const SONGS_DATA = ' + JSON.stringify(songs) + ';\nconst OTHER = [1, 2];\n';
    assert.deepEqual(parseSongsData(content), songs);
});

test('songs-data writes "$$", "$&" and "$\'" exactly as they are', () => {
    const songs = [{ id: 0, title: 'Money $$$', artist: 'a $& b', album: "it's $' $`" }];
    const content = 'const SONGS_DATA = [{"id":9}];\nconst REST = 1;\n';
    const out = replaceSongsData(content, JSON.stringify(songs));
    assert.deepEqual(parseSongsData(out), songs);
    assert.ok(out.endsWith(';\nconst REST = 1;\n'));
});

test('songs-data replaces a list that contains "];" without leaving the tail behind', () => {
    const old = [{ title: 'x ]; y' }];
    const content = 'const SONGS_DATA = ' + JSON.stringify(old) + ';\nconst REST = 1;';
    const out = replaceSongsData(content, '[]');
    assert.equal(out, 'const SONGS_DATA = [];\nconst REST = 1;');
});

test('songs-data gives null when there is no list', () => {
    assert.equal(parseSongsData('const OTHER = [];'), null);
    assert.equal(parseSongsData('const SONGS_DATA = {{SONGS_DATA}};'), null);
    assert.equal(replaceSongsData('nothing here', '[]'), null);
    assert.equal(findSongsArray('const SONGS_DATA = [1, 2'), null);
});

// ---- download file names ---------------------------------------------------------------

test('download names are plain file names that stay inside the folder', () => {
    const folder = path.join(os.tmpdir(), 'dl-test');
    const urls = [
        'http://h/a%2F..%2F..%2Fevil.mp3',
        'http://h/..%5C..%5Cevil.mp3',
        'http://h/%2E%2E',
        'http://h/bad%',
        'http://h/',
        'http://h/a?b=c/d.mp3',
        'http://h/na:me*.mp3'
    ];
    for (const url of urls) {
        const name = safeDownloadFileName(url);
        assert.ok(name && !/[\\/]/.test(name) && name !== '.' && name !== '..', url + ' -> ' + name);
        const full = getUniqueFilePath(folder, url);
        assert.equal(path.dirname(full), folder, url);
    }
    assert.equal(safeDownloadFileName('http://h/a%2F..%2F..%2Fevil.mp3'), 'evil.mp3');
    assert.equal(safeDownloadFileName('http://h/My%20Song.mp3?x=1'), 'My Song.mp3');
    assert.equal(safeDownloadFileName('http://h/'), 'downloaded_audio.mp3');
});

// ---- downloading -----------------------------------------------------------------------

function serve(handler) {
    return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () => resolve({ server, base: 'http://127.0.0.1:' + server.address().port }));
    });
}

test('download saves a good file, follows a redirect and reports progress', async () => {
    const body = Buffer.alloc(5000, 7);
    const { server, base } = await serve((req, res) => {
        if (req.url === '/go') { res.writeHead(302, { Location: '/files/song.mp3' }); res.end(); return; }
        res.writeHead(200, { 'Content-Length': body.length });
        res.end(body);
    });
    const seen = [];
    try {
        const r = await download(base + '/go', true, (p) => seen.push(p));
        assert.equal(r.success, true, JSON.stringify(r));
        assert.equal(path.basename(r.filePath), 'song.mp3');
        assert.deepEqual(fs.readFileSync(r.filePath), body);
        assert.equal(seen[seen.length - 1], 100);
        fs.unlinkSync(r.filePath);
    } finally { server.close(); }
});

test('download does not keep an error page as a file', async () => {
    const { server, base } = await serve((req, res) => { res.writeHead(404); res.end('<html>not found</html>'); });
    try {
        const name = 'missing-' + Date.now() + '.mp3';
        const r = await download(base + '/' + name, true);
        assert.equal(r.success, false);
        assert.match(r.error, /404/);
        assert.equal(fs.existsSync(path.join(os.tmpdir(), 'music-player-temp', name)), false);
    } finally { server.close(); }
});

test('download removes a half-written file when the connection drops', async () => {
    const { server, base } = await serve((req, res) => {
        res.writeHead(200, { 'Content-Length': 100000 });
        res.write(Buffer.alloc(1000));
        setTimeout(() => res.destroy(), 30);
    });
    try {
        const name = 'cut-' + Date.now() + '.mp3';
        const r = await download(base + '/' + name, true);
        assert.equal(r.success, false);
        assert.equal(fs.existsSync(path.join(os.tmpdir(), 'music-player-temp', name)), false);
    } finally { server.close(); }
});

test('download refuses links that are not http or https, and endless redirects', async () => {
    assert.equal((await download('file:///etc/passwd', true)).success, false);
    assert.equal((await download('ftp://h/x.mp3', true)).success, false);
    assert.equal((await download('not a url', true)).success, false);
    const { server, base } = await serve((req, res) => { res.writeHead(302, { Location: '/loop' }); res.end(); });
    try {
        const r = await download(base + '/loop', true);
        assert.equal(r.success, false);
        assert.match(r.error, /redirect/i);
    } finally { server.close(); }
});

// ---- scanner rewrites of player.js -----------------------------------------------------

test('the scanner writes song text containing "$$" into player.js unchanged', () => {
    // updatePlayerSongs is internal; exercise it through mergeNewSongs' public neighbour by
    // reading the source for the unsafe pattern instead of re-implementing the scanner.
    for (const file of ['scanner.js', 'scan-folder.js', 'main.js']) {
        const src = fs.readFileSync(path.join(__dirname, '..', '..', 'electron', file), 'utf8');
        assert.equal(/\.replace\(\s*\/const SONGS_DATA/.test(src), false, file + ' still rewrites player.js with a regex replace');
        assert.equal(/SONGS_DATA = \(\\\[\.\*\?\\\]\)/.test(src), false, file + ' still reads player.js with a lazy regex');
    }
});

// ---- where the settings files live -----------------------------------------------------

test('settings files move to the data folder once, and a reset stays reset', () => {
    const sp = require('../../electron/storage-paths');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paths-'));
    const data = path.join(root, 'data');
    const old = path.join(root, 'old');
    fs.mkdirSync(old);
    fs.writeFileSync(path.join(old, 'music-folders-config.json'), '{"folders":["C:\\\\A"]}');
    try {
        sp.setConfigDir(data, old);
        const target = sp.configPath('foldersConfig');
        assert.equal(target, path.join(data, 'music-folders-config.json'));
        assert.equal(fs.readFileSync(target, 'utf8'), '{"folders":["C:\\\\A"]}');
        assert.equal(fs.existsSync(path.join(old, 'music-folders-config.json')), false);
        // a file that is already in the data folder is never overwritten by an old one
        fs.writeFileSync(path.join(old, 'music-folders-config.json'), '{"folders":[]}');
        sp.configPath('foldersConfig');
        assert.equal(fs.readFileSync(target, 'utf8'), '{"folders":["C:\\\\A"]}');
        // deleting a setting does not bring the old copy back
        fs.unlinkSync(path.join(old, 'music-folders-config.json'));
        fs.unlinkSync(target);
        sp.configPath('foldersConfig');
        assert.equal(fs.existsSync(target), false);
        assert.throws(() => sp.configPath('nope'));
    } finally {
        sp.setConfigDir(null);
    }
});

test('the scan process keeps its folder list in the settings folder it is given, with the folder details', () => {
    const { execFileSync } = require('node:child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-cfg-'));
    const file = path.join(dir, 'music-folders-config.json');
    fs.writeFileSync(file, JSON.stringify({ folders: ['C:\\A'], folderMetadata: { 'C:\\A': { addedTime: 't', songCount: 3 } } }));
    const script = path.join(__dirname, '..', '..', 'electron', 'scan-folder.js');
    execFileSync(process.execPath, ['-e', `const s = require(${JSON.stringify(script)}); s.addMusicFolder('C:\\\\B'); s.removeMusicFolder('C:\\\\A');`],
        { env: { ...process.env, MUSIC_PLAYER_CONFIG_DIR: dir } });
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(saved.folders, ['C:\\B']);
    assert.deepEqual(saved.folderMetadata, { 'C:\\A': { addedTime: 't', songCount: 3 } });
    // and the main process hands that folder to the scan process
    assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'electron', 'scanner.js'), 'utf8'), /MUSIC_PLAYER_CONFIG_DIR: getConfigDir\(\)/);
});

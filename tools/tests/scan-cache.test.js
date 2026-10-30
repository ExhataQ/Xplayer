// Scan cache (task PS-02): a rescan parses only the files that are new or changed. Fake music-metadata, real temporary files,
// no browser and no Electron. The scan writes progress and results to stderr; the tests swallow it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFastScanner, indexSavedSongs, needsCoverPass } = require('../../electron/fast-scan');
const { scanSingleFile } = require('../../electron/single-file-rescan');
const { songUrlForPath, TAG_BUILD_PROFILES, buildSongFromTags, SCAN_FORMAT } = require('../../electron/tag-builder');

function walkDir(dir, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkDir(full, out);
        else if (entry.name.endsWith('.mp3')) out.push(full);
    }
}

function makeLibrary(names) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-cache-'));
    const music = path.join(root, 'music');
    const output = path.join(root, 'out');
    fs.mkdirSync(music);
    fs.mkdirSync(path.join(output, 'covers'), { recursive: true });
    for (const name of names) fs.writeFileSync(path.join(music, name), 'audio:' + name);
    return { root, music, output, covers: path.join(output, 'covers') };
}

// Counts parseFile calls. Files named pic-* have a picture, bad-* cannot be parsed, the rest have no picture.
function makeMm() {
    const calls = [];
    return {
        calls,
        parses: (skipCovers) => calls.filter((c) => c.skipCovers === skipCovers).map((c) => c.name).sort(),
        reset: () => (calls.length = 0),
        async parseFile(file, options) {
            const name = path.basename(file);
            calls.push({ name, skipCovers: options.skipCovers });
            if (name.startsWith('bad-')) throw new Error('unreadable');
            const picture = name.startsWith('pic-') ? [{ format: 'image/jpeg', data: Buffer.from('pretend-jpeg-' + name) }] : undefined;
            return { common: { title: 'Title ' + name, artist: 'Artist', album: 'Album', picture }, format: { duration: 100 }, native: null };
        }
    };
}

async function scan(lib, mm, savedSongs) {
    const scanner = createFastScanner({ walkDir, loadMusicFolders: () => [lib.music], printProgress: () => {} });
    const realWrite = process.stderr.write;
    process.stderr.write = () => true;
    try {
        return await scanner.scanAllFoldersStreamed(lib.covers, mm, null, () => {}, { savedSongs });
    } finally {
        process.stderr.write = realWrite;
    }
}

// What the app does between scans: the library is saved as JSON and read back.
const saveAndReload = (songs) => JSON.parse(JSON.stringify(songs));

test('first scan parses every file once for tags and once for covers, and stamps each parsed song', async () => {
    const lib = makeLibrary(['a.mp3', 'pic-b.mp3', 'c.mp3']);
    const mm = makeMm();
    const songs = await scan(lib, mm, null);
    assert.deepEqual(mm.parses(true), ['a.mp3', 'c.mp3', 'pic-b.mp3']);
    assert.deepEqual(mm.parses(false), ['a.mp3', 'c.mp3', 'pic-b.mp3']);
    for (const song of songs) {
        const stat = fs.statSync(path.join(lib.music, song.title.replace('Title ', '')));
        assert.equal(song.size, stat.size);
        assert.equal(song.mtimeMs, Math.floor(stat.mtimeMs));
    }
    assert.ok(songs.find((s) => s.title === 'Title pic-b.mp3').largeCover.startsWith('covers/'));
    assert.equal(songs.find((s) => s.title === 'Title a.mp3').coverChecked, true, 'a song without a picture is marked as checked');
});

test('a second scan of an unchanged library parses nothing and keeps titles and covers', async () => {
    const lib = makeLibrary(['a.mp3', 'pic-b.mp3', 'c.mp3']);
    const first = await scan(lib, makeMm(), null);
    const mm = makeMm();
    const second = await scan(lib, mm, saveAndReload(first));
    assert.deepEqual(mm.calls, []);
    assert.deepEqual(second.map((s) => s.title), first.map((s) => s.title));
    assert.equal(second.find((s) => s.title === 'Title pic-b.mp3').largeCover, first.find((s) => s.title === 'Title pic-b.mp3').largeCover);
    assert.deepEqual(second.map((s) => s.id), [0, 1, 2]);
});

test('a file that changed is parsed again, and only that one', async () => {
    const lib = makeLibrary(['a.mp3', 'pic-b.mp3', 'c.mp3']);
    const first = await scan(lib, makeMm(), null);
    fs.appendFileSync(path.join(lib.music, 'c.mp3'), 'more bytes'); // size changes
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(path.join(lib.music, 'a.mp3'), later, later); // modified time changes, size does not
    const mm = makeMm();
    const second = await scan(lib, mm, saveAndReload(first));
    assert.deepEqual(mm.parses(true), ['a.mp3', 'c.mp3']);
    assert.deepEqual(mm.parses(false), ['a.mp3', 'c.mp3']);
    assert.equal(second.length, 3);
});

test('a new file is parsed, a deleted file disappears, and ids stay 0 to n-1', async () => {
    const lib = makeLibrary(['a.mp3', 'b.mp3', 'c.mp3']);
    const first = await scan(lib, makeMm(), null);
    fs.unlinkSync(path.join(lib.music, 'b.mp3'));
    fs.writeFileSync(path.join(lib.music, 'd.mp3'), 'audio:d');
    const mm = makeMm();
    const second = await scan(lib, mm, saveAndReload(first));
    assert.deepEqual(mm.parses(true), ['d.mp3']);
    assert.deepEqual(second.map((s) => s.title).sort(), ['Title a.mp3', 'Title c.mp3', 'Title d.mp3']);
    assert.deepEqual(second.map((s) => s.id), [0, 1, 2]);
});

test('a reused song whose cover file was deleted gets its cover again', async () => {
    const lib = makeLibrary(['pic-a.mp3', 'c.mp3']);
    const first = await scan(lib, makeMm(), null);
    const cover = first.find((s) => s.title === 'Title pic-a.mp3');
    fs.unlinkSync(path.join(lib.output, cover.largeCover));
    const mm = makeMm();
    const second = await scan(lib, mm, saveAndReload(first));
    assert.deepEqual(mm.parses(true), [], 'tags are not read again');
    assert.deepEqual(mm.parses(false), ['pic-a.mp3'], 'only the cover is');
    assert.ok(fs.existsSync(path.join(lib.output, second.find((s) => s.title === 'Title pic-a.mp3').largeCover)));
});

test('songs saved before the cache existed (no size or modified time) are parsed once', async () => {
    const lib = makeLibrary(['a.mp3', 'b.mp3']);
    const first = saveAndReload(await scan(lib, makeMm(), null));
    for (const song of first) {
        delete song.size;
        delete song.mtimeMs;
    }
    const mm = makeMm();
    const second = await scan(lib, mm, first);
    assert.deepEqual(mm.parses(true), ['a.mp3', 'b.mp3']);
    const mm3 = makeMm();
    await scan(lib, mm3, saveAndReload(second));
    assert.deepEqual(mm3.calls, [], 'and the scan after that parses nothing');
});

test('songs saved by an older scan format are parsed again, once', async () => {
    const lib = makeLibrary(['a.mp3', 'b.mp3']);
    const first = saveAndReload(await scan(lib, makeMm(), null));
    assert.ok(first.every((s) => s.scanFormat === SCAN_FORMAT));
    first[0].scanFormat = SCAN_FORMAT - 1;
    const mm = makeMm();
    const second = await scan(lib, mm, first);
    assert.equal(mm.parses(true).length, 1, 'only the song with the old format');
    assert.ok(second.every((s) => s.scanFormat === SCAN_FORMAT));
});

test('a file that could not be parsed has no stamp, so the next scan tries it again', async () => {
    const lib = makeLibrary(['a.mp3', 'bad-b.mp3']);
    const first = await scan(lib, makeMm(), null);
    const bad = first.find((s) => s.title === 'bad-b');
    assert.ok(bad, 'it is still listed, by its file name');
    assert.equal(bad.size, undefined);
    const mm = makeMm();
    await scan(lib, mm, saveAndReload(first));
    assert.deepEqual(mm.parses(true), ['bad-b.mp3']);
});

test('no saved library (null) reads every file, as a forced rescan does', async () => {
    const lib = makeLibrary(['a.mp3', 'b.mp3']);
    await scan(lib, makeMm(), null);
    const mm = makeMm();
    await scan(lib, mm, null);
    assert.deepEqual(mm.parses(true), ['a.mp3', 'b.mp3']);
});

test('indexSavedSongs keeps only songs that have a url and a stamp', () => {
    const map = indexSavedSongs([{ url: 'file:///a', size: 1, mtimeMs: 2 }, { url: 'file:///b' }, { size: 1, mtimeMs: 2 }, null]);
    assert.deepEqual([...map.keys()], ['file:///a']);
    assert.equal(indexSavedSongs(null).size, 0);
});

test('needsCoverPass: no cover and never checked, or a cover file that is gone', () => {
    const covers = path.join(os.tmpdir(), 'no-such-output', 'covers');
    assert.equal(needsCoverPass({ cover: '', largeCover: '' }, covers), true);
    assert.equal(needsCoverPass({ cover: '', largeCover: '', coverChecked: true }, covers), false);
    assert.equal(needsCoverPass({ cover: 'covers/x.jpg', largeCover: 'covers/x.jpg' }, covers), true);
});

test('scanSingleFile (used after a tag edit) saves the new stamp; the old profiles do not add one', async () => {
    const lib = makeLibrary(['a.mp3']);
    const file = path.join(lib.music, 'a.mp3');
    const song = await scanSingleFile(file, lib.covers, makeMm());
    const stat = fs.statSync(file);
    assert.equal(song.size, stat.size);
    assert.equal(song.mtimeMs, Math.floor(stat.mtimeMs));
    const old = await buildSongFromTags({ filePath: file, metadata: null, coversFolder: lib.covers, profile: TAG_BUILD_PROFILES.INCREMENTAL });
    assert.equal('size' in old, false);
    assert.equal('mtimeMs' in old, false);
});

test('songUrlForPath matches the url buildSongFromTags saves', async () => {
    const file = path.join(os.tmpdir(), 'dir with space', "it's.mp3");
    const song = await buildSongFromTags({ filePath: file, metadata: null, coversFolder: os.tmpdir(), profile: TAG_BUILD_PROFILES.FAST, fileStat: null });
    assert.equal(song.url, songUrlForPath(file));
});

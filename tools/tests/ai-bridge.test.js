// Tests for src/ui-next/adapter/ai-bridge.js: carrying out an approved AI plan with the engine's
// playlist, folder, queue and tag functions, and undoing it from the journal. The engine is a small
// stand-in with the same function names and behavior (checked against src/js/playlists/*); the journal
// is the real one from electron/ai. Pure Node, no browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createJournal } = require('../../electron/ai/journal');

const BRIDGE = pathToFileURL(path.resolve(__dirname, '..', '..', 'src', 'ui-next', 'adapter', 'ai-bridge.js')).href;

function makeWorld({ failTagsFor = [] } = {}) {
    let seq = 0;
    const w = {
        SONGS_DATA: [
            { id: 1, title: 'One', artist: 'A', url: 'u1', genre: 'Rock', duration: 100 },
            { id: 2, title: 'Two', artist: 'B', url: 'u2', duration: 90 },
            { id: 3, title: 'Three', artist: 'C', url: 'u3', duration: 80 }
        ],
        selectedSongIds: new Set(),
        playlists: [],
        folders: [],
        playbackQueue: [],
        currentOpenFolderId: null,
        events: [],
        queueSet: null,
        played: null,
        saved: [],
        getFavorites: () => [2],
        getPlaylists: () => w.playlists,
        getFolders: () => w.folders,
        createPlaylist(name) {
            const p = { id: `p${++seq}`, name, songs: [] };
            w.playlists.unshift(p);
            if (w.currentOpenFolderId) w.addToFolder(w.currentOpenFolderId, p.id, 'playlist');
            return p;
        },
        deletePlaylist(id) { w.playlists = w.playlists.filter((p) => p.id !== id); w.removeItemFromAllFolders(id, 'playlist'); },
        addSongToPlaylist(songId, playlistId) {
            const p = w.playlists.find((x) => x.id === playlistId);
            if (!p || p.songs.includes(songId)) return false;
            p.songs.push(songId);
            return true;
        },
        removeSongFromPlaylist(songId, playlistId) { const p = w.playlists.find((x) => x.id === playlistId); if (p) p.songs = p.songs.filter((s) => s !== songId); },
        createFolder(name) { const f = { id: `f${++seq}`, name, children: [] }; w.folders.unshift(f); return f; },
        deleteFolder(id) { w.folders = w.folders.filter((f) => f.id !== id); },
        addToFolder(folderId, itemId, type) {
            const f = w.folders.find((x) => x.id === folderId);
            if (!f || f.children.some((c) => c.id === itemId)) return false;
            for (const other of w.folders) other.children = other.children.filter((c) => c.id !== itemId);
            f.children.push({ id: itemId, type, shortcut: false });
            return true;
        },
        removeItemFromFolder(folderId, itemId, type) {
            const f = w.folders.find((x) => x.id === folderId);
            if (!f) return false;
            const n = f.children.length;
            f.children = f.children.filter((c) => !(c.id === itemId && c.type === type));
            return f.children.length !== n;
        },
        removeItemFromAllFolders(itemId) { for (const f of w.folders) f.children = f.children.filter((c) => c.id !== itemId); },
        emit: (name) => w.events.push(name),
        setPlaybackQueue: (q) => { w.queueSet = q; w.playbackQueue = q; },
        setCurrentQueueIndex: () => {},
        updateQueueDisplay: () => {},
        playSongFromQueue: (i) => { w.played = i; }
    };
    const journal = createJournal({ file: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'xplayer-bridge-')), 'j.json') });
    w.desktopApi = {
        ai: {
            aiJournalRecord: async (e) => ({ ok: true, entry: journal.record(e) }),
            aiJournalGet: async (id) => journal.get(id),
            aiJournalMarkUndone: async (id) => ({ ok: journal.markUndone(id) })
        },
        metadata: {
            // The tag sheet's save (electron/tag-service.js writeMany): one result per file, with the tags the file held before.
            saveAudioMetadataMany: async (items) => {
                w.saved.push(...items);
                return {
                    success: true,
                    results: items.map(({ fileUrl, metadata }) => {
                        if (failTagsFor.includes(fileUrl)) return { fileUrl, success: false, error: 'Python is not installed' };
                        const song = w.SONGS_DATA.find((x) => x.url === fileUrl);
                        const previous = {};
                        for (const key of Object.keys(metadata)) if (song[key] !== undefined) previous[key] = song[key];
                        return { fileUrl, success: true, metadata, previous };
                    })
                };
            }
        }
    };
    return { w, journal };
}

async function load(world) {
    globalThis.window = world;
    return import(`${BRIDGE}?t=${Math.random()}`);
}

test('bridge: collectSongs sends only the allowed fields (never url or cover) and can use the selection', async () => {
    const { w } = makeWorld();
    w.SONGS_DATA[0].cover = 'data:image/png;base64,AAAA';
    const bridge = await load(w);
    const all = bridge.collectSongs(['title', 'genre']);
    assert.deepEqual(all[0], { id: 1, duration: 100, favorite: false, playing: false, title: 'One', genre: 'Rock' });
    assert.equal(all[1].favorite, true);
    assert.equal(all.length, 3);
    w.selectedSongIds = new Set([2]);
    assert.deepEqual(bridge.collectSongs(['title'], { scope: 'selected' }).map((s) => s.id), [2]);
    assert.equal(bridge.collectSongs(['title'], { scope: 'all' }).length, 3);
    assert.equal('lyrics' in bridge.collectSongs(['title'])[0], false, 'lyrics are read only when asked for');
    w.getLyricsForSong = (song) => `words of ${song.id}`;
    w.playbackQueue = [{ song: w.SONGS_DATA[2] }];
    w.currentQueueIndex = 0;
    const now = bridge.collectSongs(['title'], { scope: 'now', includeLyrics: true });
    assert.deepEqual(now.map((s) => [s.id, s.playing, s.lyrics]), [[3, true, 'words of 3']]);
});

test('bridge: a reorganize plan builds folders and playlists, and undo removes exactly what it made', async () => {
    const { w, journal } = makeWorld();
    const open = w.createFolder('Open');
    w.currentOpenFolderId = open.id;
    const bridge = await load(w);
    const plan = { summary: 'Sort', actions: [
        { type: 'create_folder', args: { name: 'Moods' } },
        { type: 'create_playlist', args: { name: 'Calm' } },
        { type: 'add_to_playlist', args: { playlist: 'calm', songs: [1, 2] } },
        { type: 'put_playlist_in_folder', args: { playlist: 'Calm', folder: 'Moods' } }
    ] };
    const r = await bridge.runPlan(plan);
    assert.deepEqual([r.ok, r.applied], [true, 4]);
    assert.deepEqual(w.playlists[0].songs, [1, 2]);
    assert.deepEqual(w.folders.find((f) => f.name === 'Moods').children.map((c) => c.id), [w.playlists[0].id]);
    assert.deepEqual(open.children, [], 'the open folder did not receive the new playlist');
    assert.deepEqual(w.events, ['folder:listChanged']);
    assert.equal(journal.get(r.entryId).changes.length, 4);

    const u = await bridge.undoEntry(r.entryId);
    assert.equal(u.ok, true);
    assert.deepEqual([w.playlists.length, w.folders.length], [0, 1], 'only the folder that was already there is left');
    assert.equal(journal.get(r.entryId).status, 'undone');
    assert.equal((await bridge.undoEntry(r.entryId)).ok, false);
});

test('bridge: reusing an existing playlist or folder is not undone as if it were new, and moving a playlist remembers where it was', async () => {
    const { w } = makeWorld();
    const bridge = await load(w);
    const old = w.createPlaylist('Mine');
    const a = w.createFolder('A');
    const b = w.createFolder('B');
    w.addToFolder(a.id, old.id, 'playlist');
    const r = await bridge.runPlan({ summary: 's', actions: [
        { type: 'create_playlist', args: { name: 'mine' } },
        { type: 'create_folder', args: { name: 'a' } },
        { type: 'put_playlist_in_folder', args: { playlist: 'Mine', folder: 'B' } }
    ] });
    assert.equal(r.ok, true);
    assert.deepEqual(b.children.map((c) => c.id), [old.id]);
    assert.deepEqual(a.children, []);
    await bridge.undoEntry(r.entryId);
    assert.equal(w.playlists.length, 1, 'the existing playlist is still there');
    assert.equal(w.folders.length, 2, 'the existing folder is still there');
    assert.deepEqual(a.children.map((c) => c.id), [old.id], 'back in its old folder');
    assert.deepEqual(b.children, []);
});

test('bridge: a failing step stops the plan, what ran is journaled, and unknown names are clear errors', async () => {
    const { w, journal } = makeWorld();
    const bridge = await load(w);
    const r = await bridge.runPlan({ summary: 's', actions: [
        { type: 'create_playlist', args: { name: 'X' } },
        { type: 'add_to_playlist', args: { playlist: 'Nope', songs: [1] } },
        { type: 'create_playlist', args: { name: 'Never' } }
    ] });
    assert.equal(r.ok, false);
    assert.equal(r.applied, 1);
    assert.match(r.failure.message, /Playlist "Nope" does not exist/);
    assert.equal(w.playlists.length, 1);
    assert.equal(journal.get(r.entryId).changes.length, 1);
    assert.equal((await bridge.runPlan({ summary: 's', actions: [{ type: 'delete_all', args: {} }] })).failure.message, 'Cannot carry out delete_all');
    assert.equal(bridge.canRun('set_tags'), true);
    assert.equal(bridge.canRun('delete_all'), false);
});

test('bridge: set_play_order replaces the queue with the chosen songs and starts the first; it adds nothing to the journal', async () => {
    const { w } = makeWorld();
    const bridge = await load(w);
    const r = await bridge.runPlan({ summary: 's', actions: [{ type: 'set_play_order', args: { songs: [3, 1, 99] } }] });
    assert.equal(r.ok, true);
    assert.equal(r.entryId, null);
    assert.deepEqual(w.queueSet.map((q) => q.song.id), [3, 1]);
    assert.equal(w.played, 0);
    assert.equal((await bridge.runPlan({ summary: 's', actions: [{ type: 'set_play_order', args: { songs: [99] } }] })).ok, false);
});

test('bridge: set_tags writes in one call, updates the library copy, and undo restores what the files held', async () => {
    const { w } = makeWorld();
    const bridge = await load(w);
    const r = await bridge.runPlan({ summary: 'tags', actions: [{ type: 'set_tags', args: { songs: [1, 2], tags: { genre: 'Pop', year: 1999 } } }] });
    assert.equal(r.ok, true);
    assert.deepEqual([w.SONGS_DATA[0].genre, w.SONGS_DATA[1].genre, w.SONGS_DATA[1].year], ['Pop', 'Pop', 1999]);
    assert.deepEqual(w.saved.map((s) => s.fileUrl), ['u1', 'u2']);
    w.saved.length = 0;
    const u = await bridge.undoEntry(r.entryId);
    assert.equal(u.ok, true);
    assert.deepEqual(w.saved.find((s) => s.fileUrl === 'u1').metadata, { genre: 'Rock', year: '' });
    assert.equal(w.SONGS_DATA[0].genre, 'Rock');
    assert.equal(w.SONGS_DATA[1].genre, '');
});

test('bridge: when one song cannot be written the others keep their undo data; when none can, the plan fails with the reason', async () => {
    const { w, journal } = makeWorld({ failTagsFor: ['u2'] });
    const bridge = await load(w);
    const r = await bridge.runPlan({ summary: 'tags', actions: [{ type: 'set_tags', args: { songs: [1, 2], tags: { genre: 'Pop' } } }] });
    assert.equal(r.ok, true);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /Two: Python is not installed/);
    assert.deepEqual(journal.get(r.entryId).changes[0].undo.changed.map((c) => c.fileUrl), ['u1']);
    assert.equal(w.SONGS_DATA[1].genre, undefined, 'the song that failed is unchanged in memory');
    const none = await bridge.runPlan({ summary: 'tags', actions: [{ type: 'set_tags', args: { songs: [2], tags: { genre: 'Pop' } } }] });
    assert.equal(none.ok, false);
    assert.match(none.failure.message, /Python is not installed/);
    assert.equal(none.entryId, null);
    const gone = await bridge.runPlan({ summary: 'tags', actions: [{ type: 'set_tags', args: { songs: [99], tags: { genre: 'Pop' } } }] });
    assert.match(gone.failure.message, /None of those songs/);
});

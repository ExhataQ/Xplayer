// Tests for src/ui-next/adapter/library-create.js (task PB-06): the plain functions the Library panel and the AI organizer share.
// The engine is a small stand-in with the same function names. Pure Node, no browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE = pathToFileURL(path.resolve(__dirname, '..', '..', 'src', 'ui-next', 'adapter', 'library-create.js')).href;

function makeWorld() {
    let seq = 0;
    const w = {
        playlists: [],
        folders: [],
        currentOpenFolderId: null,
        called: [],
        getPlaylists: () => w.playlists,
        getFolders: () => w.folders,
        createPlaylist(name) {
            const p = { id: `p${++seq}`, name, songs: [] };
            w.playlists.unshift(p);
            if (w.currentOpenFolderId) w.folders.find((f) => f.id === w.currentOpenFolderId).children.push({ id: p.id, type: 'playlist' });
            return p;
        },
        createFolder(name) {
            const f = { id: `f${++seq}`, name, children: [] };
            w.folders.unshift(f);
            return f;
        },
        removeItemFromFolder(folderId, itemId) {
            const f = w.folders.find((x) => x.id === folderId);
            f.children = f.children.filter((c) => c.id !== itemId);
        },
        showCreateItemDialog: () => w.called.push('showCreateItemDialog')
    };
    return w;
}
const load = (w) => {
    globalThis.window = w;
    return import(`${MODULE}?t=${Math.random()}`);
};

test('createPlaylistNamed trims the name, makes one playlist and reports it as created', async () => {
    const w = makeWorld();
    const { createPlaylistNamed } = await load(w);
    const made = createPlaylistNamed('  Calm  ');
    assert.deepEqual([made.created, w.playlists.length, w.playlists[0].name], [true, 1, 'Calm']);
    assert.equal(made.id, w.playlists[0].id);
});

test('a name that already exists (any case) is reused, not duplicated', async () => {
    const w = makeWorld();
    const { createPlaylistNamed, createFolderNamed } = await load(w);
    const first = createPlaylistNamed('Calm');
    const again = createPlaylistNamed('calm ');
    assert.deepEqual([again.created, again.id, w.playlists.length], [false, first.id, 1]);
    const folder = createFolderNamed('Moods');
    assert.deepEqual([createFolderNamed('MOODS').created, createFolderNamed('moods').id, w.folders.length], [false, folder.id, 1]);
});

test('a new playlist is never filed into the folder that happens to be open', async () => {
    const w = makeWorld();
    const { createPlaylistNamed, createFolderNamed } = await load(w);
    const folder = createFolderNamed('Open');
    w.currentOpenFolderId = folder.id;
    createPlaylistNamed('Calm');
    assert.deepEqual(w.folders[0].children, []);
});

test('an empty name is refused for both', async () => {
    const w = makeWorld();
    const { createPlaylistNamed, createFolderNamed } = await load(w);
    assert.throws(() => createPlaylistNamed('   '), /needs a name/);
    assert.throws(() => createFolderNamed(undefined), /needs a name/);
    assert.deepEqual([w.playlists.length, w.folders.length], [0, 0]);
});

test('showCreateDialog opens the engine dialog, and reports false when the engine is not ready', async () => {
    const w = makeWorld();
    const { showCreateDialog } = await load(w);
    assert.equal(showCreateDialog(), true);
    assert.deepEqual(w.called, ['showCreateItemDialog']);
    delete w.showCreateItemDialog;
    assert.equal(showCreateDialog(), false);
});

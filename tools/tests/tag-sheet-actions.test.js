'use strict';

// views/tools/tag-sheet-actions.js with a fake bridge: the AI's actions, no browser, no files.
// Run: node --test tools/tests/tag-sheet-actions.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'ui-next', 'views', 'tools', 'tag-sheet-actions.js')).href);

function fakeBridge() {
    const files = { 1: { genre: ['Rock'], composer: ['X'] }, 2: { genre: [], composer: [] }, 3: { genre: ['Pop'], composer: ['Y'] } };
    const bridge = {
        writes: [],
        notes: [],
        sources: () => [{ id: 'all-songs', label: 'All songs', group: 'library' }],
        loadSource: () => [1, 2, 3].map((id) => ({ id, url: `file:///${id}.mp3`, title: `Song ${id}`, genre: files[id].genre })),
        readTags: async (url) => ({ success: true, metadata: { ...files[Number(url.match(/(\d)\.mp3/)[1])] } }),
        writeTags: async (items) => {
            bridge.writes.push(items);
            return {
                success: true,
                results: items.map((item) => {
                    const id = Number(item.fileUrl.match(/(\d)\.mp3/)[1]);
                    if (id === 2 && bridge.failTwo) return { fileUrl: item.fileUrl, success: false, error: 'disk full' };
                    const previous = { ...files[id] };
                    files[id] = { ...files[id], ...item.metadata };
                    return { fileUrl: item.fileUrl, success: true, metadata: { ...files[id] }, previous };
                })
            };
        },
        refreshSongs: () => {},
        notify: (message) => bridge.notes.push(message)
    };
    return bridge;
}

async function setup() {
    const { createTagSheetActions } = await load();
    const bridge = fakeBridge();
    const { api, ui } = createTagSheetActions(bridge);
    return { api, ui, bridge };
}

test('load songs, choose columns, read tags the library does not hold', async () => {
    const { api } = await setup();
    assert.equal(api.loadSongs('nope').ok, false);
    assert.deepEqual(api.loadSongs('all-songs'), { ok: true, added: 3, total: 3 });
    assert.equal(api.setColumns(['title', 'composer', 'bogus']).ok, false);
    assert.deepEqual(api.setColumns(['title', 'composer']).columns, ['title', 'composer']);
    assert.equal(api.getSheet().rows[0].values.composer, null, 'not read yet');
    assert.deepEqual(await api.readTags(), { ok: true, unreadable: 0 });
    assert.deepEqual(api.getSheet().rows[0].values.composer, ['X']);
});

test('applyTag stages on the checked rows, add keeps old values, and preview shows it', async () => {
    const { api } = await setup();
    api.loadSongs('all-songs');
    assert.equal(api.applyTag({ column: 'genre', value: 'Pop' }).ok, false, 'no rows checked');
    api.checkRows(api.findRows({ column: 'title', text: 'song' }).ids);
    assert.equal(api.applyTag({ column: 'genre', value: '', mode: 'add' }).ok, false);
    assert.equal(api.applyTag({ column: 'genre', value: 'Pop', mode: 'sideways' }).ok, false);
    const staged = api.applyTag({ column: 'genre', value: 'Pop' });
    assert.equal(staged.ok, true);
    const preview = api.preview();
    assert.equal(preview.songs, 2, 'song 3 already had Pop');
    assert.deepEqual(preview.changes.map((c) => [c.title, c.before, c.after]), [['Song 1', ['Rock'], ['Rock', 'Pop']], ['Song 2', [], ['Pop']]]);
});

test('the AI never writes by itself: requestApply needs the person, and cancelling writes nothing', async () => {
    const { api, ui, bridge } = await setup();
    api.loadSongs('all-songs');
    api.checkAll();
    api.applyTag({ column: 'genre', value: 'Jazz' });
    assert.equal((await api.requestApply()).ok, false, 'no review screen is open');
    ui.setReviewer(async () => {}); // the person closes the review without pressing Apply
    const cancelled = await api.requestApply();
    assert.equal(cancelled.cancelled, true);
    assert.equal(bridge.writes.length, 0);
});

test('when the person presses Apply the files are written once, failures stay staged, and undo puts the old values back', async () => {
    const { api, ui, bridge } = await setup();
    bridge.failTwo = true;
    api.loadSongs('all-songs');
    api.checkAll();
    api.applyTag({ column: 'genre', value: 'Jazz' });
    ui.setReviewer(async () => { await ui.commit(); });
    const outcome = await api.requestApply();
    assert.equal(bridge.writes.length, 1);
    assert.equal(outcome.saved, 2);
    assert.match(outcome.failed[0], /disk full/);
    assert.equal(api.preview().songs, 1, 'only the failed song is still staged');
    assert.equal(ui.hasUndo(), true);
    assert.equal((await api.undoLast()).ok, true);
    assert.deepEqual(bridge.writes[1].map((w) => w.metadata.genre), [['Rock'], ['Pop']]);
    assert.equal(ui.hasUndo(), false);
    assert.equal((await api.undoLast()).ok, false);
});

test('setCell, removeRows and discardChanges', async () => {
    const { api } = await setup();
    api.loadSongs('all-songs');
    api.setColumns(['title', 'composer']);
    assert.equal(api.setCell({ id: 1, key: 'composer', value: 'Z' }).ok, false, 'tags not read yet');
    await api.readTags();
    assert.equal(api.setCell({ id: 1, key: 'composer', value: 'Z' }).ok, true);
    assert.equal(api.setCell({ id: 99, key: 'composer', value: 'Z' }).ok, false);
    assert.equal(api.preview().total, 1);
    api.removeRows([1]);
    assert.equal(api.preview().total, 0);
    assert.equal(api.getSheet().total, 2);
    api.setCell({ id: 2, key: 'composer', value: 'Q' });
    api.discardChanges();
    assert.equal(api.preview().total, 0);
});

'use strict';

// main.js 'find-tags-many' and 'cancel-find-tags' (task PD-05): request checks, one run at a time, progress events, cancel, and that
// the handler never writes a tag. main.js runs in a copy of electron/ with a fake 'electron' and with online-metadata.js replaced by
// fakes, so nothing real is touched and no request leaves the machine.
// Run: node --test tools/tests/find-tags-ipc.test.js

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('node:module');

const SRC = path.join(__dirname, '..', '..', 'electron');
let root, handlers, realLoad;
const hooks = { search: null, get: null, popularity: null, saves: 0 };
globalThis.__findHooks = hooks;

const rel = (id, title, date) => ({ id, title, date, releaseGroupId: `g-${id}`, status: 'Official', primaryType: 'Album', secondaryTypes: [], recordingScore: 100 });
const song = (id, tags = {}) => ({ id, fileUrl: `file:///music/${id}.mp3`, tags: { title: `Song ${id}`, artist: ['The Band'], ...tags } });
const online = { album: 'The Album', year: '1999', genre: ['Rock'] };
const happy = () => {
    hooks.search = async () => ({ success: true, results: [rel('a', 'The Album', '1999')] });
    hooks.get = async () => ({ success: true, metadata: online });
};
const sender = () => { const sent = []; return { sent, send: (channel, payload) => sent.push([channel, payload]) }; };
const gate = () => { let open; const promise = new Promise((resolve) => { open = resolve; }); return { promise, open }; };

before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'xplayer-findtags-'));
    const copy = path.join(root, 'electron');
    fs.mkdirSync(copy);
    // main.js also requires files in subfolders (./ai/...), so copy the whole folder; only source files are needed
    fs.cpSync(SRC, copy, { recursive: true, filter: (from) => !/node_modules|\.py$|\.json$/.test(from) });
    fs.writeFileSync(path.join(copy, 'metadata-editor.js'), "module.exports = { getAudioMetadata: async () => ({ success: true, metadata: {} }), saveAudioCover: async () => ({}), saveAudioMetadata: async () => { globalThis.__findHooks.saves += 1; return { success: true, metadata: {} }; } };");
    fs.writeFileSync(path.join(copy, 'popularity.js'), 'module.exports = { fetchPopularity: async (ids) => (globalThis.__findHooks.popularity ? globalThis.__findHooks.popularity(ids) : null) };');
    fs.writeFileSync(path.join(copy, 'online-metadata.js'), 'module.exports = { searchOnlineMetadata: (q) => globalThis.__findHooks.search(q), getOnlineMetadata: (q) => globalThis.__findHooks.get(q) };');
    handlers = {};
    const fake = {
        app: { disableHardwareAcceleration() {}, whenReady: () => new Promise(() => {}), on() {}, quit() {}, getPath: () => root },
        ipcMain: { handle: (name, fn) => { handlers[name] = fn; }, on() {} },
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
    delete globalThis.__findHooks;
    fs.rmSync(root, { recursive: true, force: true });
});

const find = (request, event = { sender: sender() }) => handlers['find-tags-many'](event, request);

test('both channels are registered', () => {
    assert.equal(typeof handlers['find-tags-many'], 'function');
    assert.equal(typeof handlers['cancel-find-tags'], 'function');
});

test('bad requests are refused before any lookup is made', async () => {
    hooks.search = async () => { throw new Error('must not be called'); };
    const bad = [
        undefined, null, {}, { songs: 'nope' },
        { songs: new Array(2001).fill(song(1)) },
        { songs: [{ id: 1, fileUrl: 5, tags: {} }] },
        { songs: [{ id: {}, fileUrl: 'f', tags: {} }] },
        { songs: [{ id: 1, fileUrl: 'f', tags: [] }] },
        { songs: [null] },
        { songs: [song(1)], options: { rule: 'cheapest' } },
        { songs: [song(1)], options: { autoThreshold: 2 } },
        { songs: [song(1)], options: { autoThreshold: 'high' } },
        { songs: [song(1)], options: { fields: ['title'] } },
        { songs: [song(1)], options: { fields: 'album' } }
    ];
    for (const request of bad) {
        const result = await find(request);
        assert.equal(result.success, false, JSON.stringify(request)?.slice(0, 80));
        assert.equal(typeof result.error, 'string');
    }
    // and the failed requests did not leave a run marked as running
    happy();
    assert.equal((await find({ songs: [song(1)] })).success, true);
});

test('the "popular" rule is accepted, asks for the popularity of the release groups, and picks the album more people listened to', async () => {
    happy();
    const asked = [];
    hooks.search = async () => ({ success: true, results: [rel('a', 'First Album', '1999'), rel('b', 'Big Album', '2003')] });
    hooks.get = async ({ releaseId }) => ({ success: true, metadata: { album: releaseId === 'b' ? 'Big Album' : 'First Album' } });
    hooks.popularity = async (ids) => { asked.push(ids); return { 'g-a': 0.1, 'g-b': 1 }; };
    const result = await find({ songs: [song(1)], options: { rule: 'popular', autoThreshold: 0.1 } });
    hooks.popularity = null;
    assert.equal(result.success, true);
    assert.deepEqual(asked, [['g-a', 'g-b']]);
    assert.equal(result.results[0].release.id, 'b');
    const original = await find({ songs: [song(1)], options: { rule: 'original', autoThreshold: 0.1 } });
    assert.equal(original.results[0].release.id, 'a');
});

test('a run returns every song\'s answer and sends one progress event per song', async () => {
    happy();
    hooks.search = async (q) => ({ success: true, results: q.title === 'Song 2' ? [] : [rel('a', 'The Album', '1999')] });
    const event = { sender: sender() };
    const out = await find({ songs: [song(1), song(2), song(3, { album: 'The Album', year: '1999', genre: ['Rock'] })] }, event);
    assert.equal(out.success, true);
    assert.deepEqual(out.results.map((r) => [r.id, r.decision]), [[1, 'auto'], [2, 'none'], [3, 'unchanged']]);
    assert.deepEqual(out.summary, { total: 3, processed: 3, auto: 1, review: 0, none: 1, unchanged: 1, error: 0 });
    assert.deepEqual(event.sender.sent, [['find-tags-progress', { done: 1, total: 3, decision: 'auto' }], ['find-tags-progress', { done: 2, total: 3, decision: 'none' }], ['find-tags-progress', { done: 3, total: 3, decision: 'unchanged' }]]);
});

test('the threshold and the field list reach the finder', async () => {
    happy();
    const strict = await find({ songs: [song(1)], options: { autoThreshold: 0.99 } });
    assert.equal(strict.results[0].decision, 'review');
    const narrow = await find({ songs: [song(1)], options: { fields: ['year'] } });
    assert.deepEqual(Object.keys(narrow.results[0].patch), ['year']);
});

test('only one run at a time; cancel stops after the song being worked on; the next run is accepted', async () => {
    happy();
    const first = gate();
    let started = 0;
    hooks.search = async () => { started += 1; await first.promise; return { success: true, results: [rel('a', 'The Album', '1999')] }; };
    const running = find({ songs: [song(1), song(2), song(3)] });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(started, 1);
    const second = await find({ songs: [song(9)] });
    assert.deepEqual([second.success, second.error], [false, 'A tag search is already running.']);
    assert.deepEqual(await handlers['cancel-find-tags'](), { cancelled: true });
    first.open();
    const out = await running;
    assert.equal(out.success, true);
    assert.equal(out.cancelled, true);
    assert.equal(out.results.length, 1, 'the song being worked on finished, the others were not started');
    assert.equal(started, 1);
    assert.deepEqual(await handlers['cancel-find-tags'](), { cancelled: false }, 'nothing is running now');
    happy();
    assert.equal((await find({ songs: [song(1)] })).success, true);
});

test('a fatal error ends the run with the reason, and the handler is free again', async () => {
    hooks.search = async () => { throw Object.assign(new Error('Refused to contact untrusted host x'), { fatal: true }); };
    const out = await find({ songs: [song(1), song(2)] });
    assert.equal(out.success, true);
    assert.equal(out.stopped, 'fatal');
    assert.match(out.message, /untrusted host/);
    happy();
    assert.equal((await find({ songs: [song(1)] })).success, true);
});

test('if the window is gone (sending throws) the run stops instead of working through the whole list', async () => {
    happy();
    let searched = 0;
    hooks.search = async () => { searched += 1; return { success: true, results: [rel('a', 'The Album', '1999')] }; };
    const dead = { sender: { send() { throw new Error('Object has been destroyed'); } } };
    const out = await find({ songs: [song(1), song(2), song(3), song(4)] }, dead);
    assert.equal(out.cancelled, true);
    assert.equal(searched, 1);
});

test('the finder never writes a tag', async () => {
    happy();
    hooks.saves = 0;
    await find({ songs: [song(1), song(2)] });
    assert.equal(hooks.saves, 0);
});

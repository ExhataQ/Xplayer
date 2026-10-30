'use strict';

// The multi tag finder inside the tag sheet (task PD-05, decision DP12 option A): what findTags stages, what waits in the review queue,
// what the notification says, and that nothing is ever written. Fake bridge, no browser, no files.
// Run: node --test tools/tests/tag-sheet-finder.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'ui-next', 'views', 'tools', 'tag-sheet-actions.js')).href);

const FILES = {
    1: { title: 'Song 1', artist: ['The Band'], album: '', albumArtist: [], year: '', genre: ['Rock'], label: '' },
    2: { title: 'Song 2', artist: ['The Band'], album: 'Old', albumArtist: [], year: '2010', genre: [], label: '' },
    3: { title: 'Song 3', artist: ['The Band'], album: '', albumArtist: [], year: '', genre: [], label: '' },
    4: { title: 'Song 4', artist: ['The Band'], album: '', albumArtist: [], year: '', genre: [], label: '' }
};
const idOf = (url) => Number(String(url).match(/(\d)\.mp3/)[1]);

function fakeBridge() {
    const bridge = {
        writes: [],
        reads: [],
        requests: [],
        cancels: 0,
        notices: [],
        reply: null, // what the main process answers with; set by each test
        hold: null, // a promise the search waits for, to look at the sheet while it runs
        unreadable: new Set(),
        sources: () => [{ id: 'all-songs', label: 'All songs', group: 'library' }],
        // the library holds only some tags, like the real one
        loadSource: () => [1, 2, 3, 4].map((id) => ({ id, url: `file:///${id}.mp3`, title: FILES[id].title, genre: FILES[id].genre })),
        readTags: async (url) => {
            bridge.reads.push(url);
            return bridge.unreadable.has(idOf(url)) ? { success: false, error: 'bad file' } : { success: true, metadata: { ...FILES[idOf(url)] } };
        },
        writeTags: async (items) => { bridge.writes.push(items); return { success: true, results: [] }; },
        refreshSongs: () => {},
        notify: () => {},
        findTags: async (request, onProgress) => {
            bridge.requests.push(request);
            if (bridge.hold) await bridge.hold;
            const reply = typeof bridge.reply === 'function' ? bridge.reply(request) : bridge.reply;
            request.songs.forEach((song, index) => onProgress && onProgress({ done: index + 1, total: request.songs.length, decision: 'x' }));
            return reply;
        },
        cancelFindTags: async () => { bridge.cancels += 1; return { cancelled: true }; },
        progressNotice: (options) => {
            const notice = { options, updates: [], done: null, fail: null };
            notice.update = (partial) => notice.updates.push(partial);
            notice.doneWith = null;
            notice.done = (opts) => { notice.doneWith = opts; };
            notice.fail = (opts) => { notice.failWith = opts; };
            bridge.notices.push(notice);
            return notice;
        }
    };
    return bridge;
}

const match = (id, decision, patch = {}, extra = {}) => ({ id, fileUrl: `file:///${id}.mp3`, decision, confidence: decision === 'auto' ? 0.9 : 0.68, reasons: ['earliest'], release: { id: 'r', title: 'The Album', date: '1999', releaseGroupId: 'g' }, patch, changes: Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, { from: FILES[id]?.[key] ?? '', to: value }])), ...extra });
const reply = (results, extra = {}) => ({ success: true, results, summary: {}, cancelled: false, stopped: null, message: '', ...extra });

async function setup() {
    const { createTagSheetActions } = await load();
    const bridge = fakeBridge();
    const { api, ui } = createTagSheetActions(bridge);
    api.loadSongs('all-songs');
    return { api, ui, bridge };
}

test('sure matches are staged, unsure ones wait in the queue, and nothing is written', async () => {
    const { api, bridge } = await setup();
    bridge.reply = reply([match(1, 'auto', { album: 'The Album', year: '1999', genre: ['Pop'] }), match(2, 'review', { album: 'New', year: '2011' }), match(3, 'none'), match(4, 'unchanged')]);
    api.checkAll();
    const out = await api.findTags();
    assert.deepEqual(out, { ok: true, staged: 1, review: 1, none: 1, unchanged: 1, failed: 0, skipped: 0, cancelled: false, stopped: null });
    assert.equal(bridge.writes.length, 0, 'no file is written by a search');

    const preview = api.preview();
    assert.equal(preview.songs, 1, 'only the sure match is staged');
    assert.deepEqual(preview.changes.map((c) => [c.title, c.key, c.after]).sort(), [['Song 1', 'album', 'The Album'], ['Song 1', 'genre', ['Rock', 'Pop']], ['Song 1', 'year', '1999']]);

    const found = api.getFindings();
    assert.deepEqual(found.items.map((i) => [i.id, i.title, i.release.title, i.confidence]), [[2, 'Song 2', 'The Album', 0.68]]);
    assert.deepEqual(found.items[0].changes, [{ key: 'album', before: 'Old', after: 'New' }, { key: 'year', before: '2010', after: '2011' }]);
    assert.equal(found.last.staged, 1);
    assert.equal(found.last.review, 1);
});

test('the request carries the file tags the sheet read, only the tags the sheet can stage, and the threshold', async () => {
    const { api, bridge } = await setup();
    api.checkRows([2]);
    bridge.reply = reply([match(2, 'none')]);
    await api.findTags({ threshold: 0.9 });
    const request = bridge.requests[0];
    assert.deepEqual(request.options, { rule: 'original', autoThreshold: 0.9, fields: ['album', 'albumArtist', 'year', 'genre', 'label'] });
    assert.deepEqual(request.songs, [{ id: 2, fileUrl: 'file:///2.mp3', tags: { title: 'Song 2', artist: ['The Band'], album: 'Old', albumArtist: [], year: '2010', genre: [], label: '' } }]);
    assert.ok(!request.options.fields.some((field) => /^musicBrainz/.test(field)), 'the id tags are not sheet columns');
});

test('the rule choice reaches the request; an unknown rule is refused before anything is sent', async () => {
    const { api, bridge } = await setup();
    api.checkRows([2]);
    bridge.reply = reply([match(2, 'none')]);
    await api.findTags({ rule: 'popular' });
    assert.equal(bridge.requests[0].options.rule, 'popular');
    const bad = await api.findTags({ rule: 'cheapest' });
    assert.equal(bad.ok, false);
    assert.equal(bridge.requests.length, 1);
});

test('tags are read once: a second search does not read the files again', async () => {
    const { api, bridge } = await setup();
    api.checkAll();
    bridge.reply = reply([]);
    await api.findTags();
    assert.equal(bridge.reads.length, 4);
    await api.findTags();
    assert.equal(bridge.reads.length, 4);
});

test('accepting a queued match stages it; skipping drops it; with no ids it means all of them', async () => {
    const { api, bridge } = await setup();
    bridge.reply = reply([match(1, 'review', { album: 'A' }), match(2, 'review', { album: 'B' }), match(3, 'review', { album: 'C' })]);
    api.checkAll();
    await api.findTags();
    assert.equal(api.preview().songs, 0, 'nothing staged yet');
    assert.deepEqual(api.acceptFindings([1]), { ok: true, accepted: 1 });
    assert.deepEqual(api.skipFindings([2]), { ok: true, skipped: 1 });
    assert.deepEqual(api.preview().changes.map((c) => [c.title, c.after]), [['Song 1', 'A']]);
    assert.deepEqual(api.getFindings().items.map((i) => i.id), [3]);
    assert.deepEqual(api.acceptFindings(), { ok: true, accepted: 1 });
    assert.equal(api.getFindings().items.length, 0);
    assert.deepEqual(api.acceptFindings([99]), { ok: true, accepted: 0 });
    assert.equal(bridge.writes.length, 0);
});

test('mode replace swaps multi-value tags, add keeps the old ones', async () => {
    const add = await setup();
    add.bridge.reply = reply([match(1, 'auto', { genre: ['Pop'] })]);
    add.api.checkRows([1]);
    await add.api.findTags();
    assert.deepEqual(add.api.preview().changes[0].after, ['Rock', 'Pop']);
    const replace = await setup();
    replace.bridge.reply = reply([match(1, 'auto', { genre: ['Pop'] })]);
    replace.api.checkRows([1]);
    await replace.api.findTags({ mode: 'replace' });
    assert.deepEqual(replace.api.preview().changes[0].after, ['Pop']);
});

test('a search on a new run replaces an older queue entry for the same song', async () => {
    const { api, bridge } = await setup();
    api.checkRows([2]);
    bridge.reply = reply([match(2, 'review', { album: 'First' })]);
    await api.findTags();
    bridge.reply = reply([match(2, 'review', { album: 'Second' })]);
    await api.findTags();
    const items = api.getFindings().items;
    assert.equal(items.length, 1);
    assert.equal(items[0].changes[0].after, 'Second');
    bridge.reply = reply([match(2, 'auto', { album: 'Third' })]);
    await api.findTags();
    assert.equal(api.getFindings().items.length, 0, 'a sure answer takes the song out of the queue');
});

test('the notification: a progress entry with Cancel and a link to Metadata, then one honest summary', async () => {
    const { api, bridge } = await setup();
    bridge.reply = reply([match(1, 'auto', { album: 'A' }), match(2, 'review', { album: 'B' }), match(3, 'none'), match(4, 'error', {}, { error: 'timeout' })]);
    api.checkAll();
    await api.findTags();
    const [notice] = bridge.notices;
    assert.equal(bridge.notices.length, 1);
    assert.equal(notice.options.title, 'Finding tags for 4 songs');
    assert.deepEqual(notice.options.target, { view: 'metadata' });
    assert.equal(typeof notice.options.onCancel, 'function');
    assert.deepEqual(notice.updates.map((u) => [u.percent, u.status]), [[25, '1 of 4'], [50, '2 of 4'], [75, '3 of 4'], [100, '4 of 4']]);
    assert.equal(notice.doneWith.title, 'Finished finding tags');
    assert.equal(notice.doneWith.detail, '1 staged, 1 to review, 1 nothing to change, 1 failed.');
    assert.equal(notice.doneWith.kind, 'warning', 'a failure is not reported as plain success');
    assert.equal(notice.doneWith.important, true, 'songs are waiting for the person');
    assert.deepEqual(notice.doneWith.target, { view: 'metadata', label: 'Open the tag sheet' });
    assert.match(api.getFindings().last.problems[0], /Song 4: timeout/);
});

test('a clean run is reported as success and does not claim anything waits', async () => {
    const { api, bridge } = await setup();
    bridge.reply = reply([match(1, 'auto', { album: 'A' })]);
    api.checkRows([1]);
    await api.findTags();
    const done = bridge.notices[0].doneWith;
    assert.equal(done.kind, 'success');
    assert.equal(done.important, false);
    assert.equal(done.detail, '1 staged, 0 to review, 0 nothing to change.');
});

test('cancel: the Cancel button of the notification reaches the main process; a stopped run says so', async () => {
    const { api, bridge } = await setup();
    let release;
    bridge.hold = new Promise((resolve) => { release = resolve; });
    bridge.reply = reply([match(1, 'auto', { album: 'A' })], { cancelled: true });
    api.checkAll();
    const running = api.findTags();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(api.getFindings().running, true);
    assert.deepEqual(await api.cancelFind(), { ok: true });
    await bridge.notices[0].options.onCancel();
    assert.equal(bridge.cancels, 2);
    release();
    const out = await running;
    assert.equal(out.cancelled, true);
    assert.equal(bridge.notices[0].doneWith.title, 'Tag search stopped');
    assert.equal(bridge.notices[0].doneWith.kind, 'warning');
    assert.equal(api.getFindings().running, false);
});

test('cancel with nothing running is an error, not a silent success', async () => {
    const { api } = await setup();
    const out = await api.cancelFind();
    assert.equal(out.ok, false);
    assert.match(out.error, /No search/);
});

test('one search at a time, and the sheet is free again afterwards', async () => {
    const { api, bridge } = await setup();
    let release;
    bridge.hold = new Promise((resolve) => { release = resolve; });
    bridge.reply = reply([]);
    api.checkAll();
    const first = api.findTags();
    await new Promise((resolve) => setImmediate(resolve));
    const second = await api.findTags();
    assert.deepEqual(second, { ok: false, error: 'A tag search is already running.' });
    release();
    assert.equal((await first).ok, true);
    bridge.hold = null;
    assert.equal((await api.findTags()).ok, true);
});

test('bad requests are refused with what to fix, before anything is asked', async () => {
    const { api, bridge } = await setup();
    assert.match((await api.findTags()).error, /Check some rows/);
    api.checkAll();
    assert.match((await api.findTags({ mode: 'sideways' })).error, /mode/);
    assert.match((await api.findTags({ threshold: 2 })).error, /threshold/);
    assert.match((await api.findTags({ threshold: -0.1 })).error, /threshold/);
    assert.equal(bridge.requests.length, 0);
    assert.equal(bridge.reads.length, 0);
});

test('more than 2000 songs at once is refused', async () => {
    const { createTagSheetActions } = await load();
    const bridge = fakeBridge();
    bridge.loadSource = () => Array.from({ length: 2001 }, (_, i) => ({ id: i + 1, url: `file:///${(i % 4) + 1}.mp3`, title: `S${i}` }));
    const { api } = createTagSheetActions(bridge);
    api.loadSongs('all-songs');
    api.checkAll();
    const out = await api.findTags();
    assert.equal(out.ok, false);
    assert.match(out.error, /at most 2000/);
    assert.equal(bridge.requests.length, 0);
});

test('unreadable files are left out and counted; if none can be read the search does not start', async () => {
    const { api, bridge } = await setup();
    bridge.unreadable.add(3);
    bridge.reply = reply([match(1, 'none')]);
    api.checkRows([1, 3]);
    const out = await api.findTags();
    assert.equal(out.ok, true);
    assert.equal(out.skipped, 1);
    assert.deepEqual(bridge.requests[0].songs.map((s) => s.id), [1]);

    const all = await setup();
    all.bridge.unreadable.add(3);
    all.api.checkRows([3]);
    const none = await all.api.findTags();
    assert.deepEqual([none.ok, none.error], [false, 'None of those songs could be read: bad file']);
    assert.equal(all.bridge.requests.length, 0);
    assert.equal(all.bridge.notices.length, 0, 'no notification for a search that never started');
});

test('a failed search is reported once, as an error, and leaves the sheet usable', async () => {
    const { api, bridge } = await setup();
    bridge.reply = { success: false, error: 'A tag search is already running.' };
    api.checkRows([1]);
    const out = await api.findTags();
    assert.deepEqual([out.ok, out.error], [false, 'A tag search is already running.']);
    assert.equal(bridge.notices[0].failWith.kind, 'error');
    assert.equal(api.getFindings().running, false);
    bridge.findTags = async () => { throw new Error('the bridge broke'); };
    const thrown = await api.findTags();
    assert.deepEqual([thrown.ok, thrown.error], [false, 'the bridge broke']);
    assert.equal(api.getFindings().running, false);
});

test('rows taken out while the search ran are ignored; removing a row or discarding drops its queue entry', async () => {
    const { api, bridge } = await setup();
    let release;
    bridge.hold = new Promise((resolve) => { release = resolve; });
    bridge.reply = reply([match(1, 'auto', { album: 'A' }), match(2, 'review', { album: 'B' }), match(3, 'review', { album: 'C' })]);
    api.checkRows([1, 2, 3]);
    const running = api.findTags();
    await new Promise((resolve) => setImmediate(resolve));
    api.removeRows([1]);
    release();
    const out = await running;
    assert.deepEqual([out.staged, out.review], [0, 2]);
    assert.equal(api.preview().songs, 0);
    api.removeRows([2]);
    assert.deepEqual(api.getFindings().items.map((i) => i.id), [3]);
    api.discardChanges();
    assert.equal(api.getFindings().items.length, 0);
});

test('a stopped run (offline) says why in the notification and keeps what it found', async () => {
    const { api, bridge } = await setup();
    bridge.reply = reply([match(1, 'auto', { album: 'A' })], { stopped: 'offline', message: '5 songs in a row failed: timeout' });
    api.checkAll();
    const out = await api.findTags();
    assert.equal(out.stopped, 'offline');
    assert.equal(out.staged, 1);
    const done = bridge.notices[0].doneWith;
    assert.equal(done.title, 'Tag search ended early');
    assert.match(done.detail, /5 songs in a row failed: timeout/);
    assert.equal(done.kind, 'warning');
});

test('what a search stages goes through the same review and Undo as every other edit, and only then reaches a file', async () => {
    const { api, ui, bridge } = await setup();
    bridge.reply = reply([match(1, 'auto', { album: 'A' })]);
    api.checkRows([1]);
    await api.findTags();
    assert.equal(bridge.writes.length, 0);
    bridge.writeTags = async (items) => { bridge.writes.push(items); return { success: true, results: items.map((item) => ({ fileUrl: item.fileUrl, success: true, metadata: { album: 'A' }, previous: { album: '' } })) }; };
    ui.setReviewer(async () => { await ui.commit(); });
    const outcome = await api.requestApply();
    assert.equal(outcome.saved, 1);
    assert.deepEqual(bridge.writes[0], [{ fileUrl: 'file:///1.mp3', metadata: { album: 'A' } }]);
    assert.equal(ui.hasUndo(), true);
});

test('when files cannot be read the reason is kept and reported, not just the word "unreadable"', async () => {
    const { createTagSheetActions } = await load();
    const bridge = fakeBridge();
    const message = 'Tags cannot be read or saved yet: the Python package "mutagen" is not installed. Install it with: python -m pip install mutagen';
    bridge.readTags = async () => ({ success: false, reason: 'no-mutagen', error: message });
    const { api } = createTagSheetActions(bridge);
    api.loadSongs('all-songs');
    api.setColumns(['title', 'composer']);
    assert.deepEqual(await api.readTags(), { ok: true, unreadable: 4, problem: message });
    api.checkAll();
    const out = await api.findTags();
    assert.deepEqual([out.ok, out.error], [false, `None of those songs could be read: ${message}`]);
    assert.equal(bridge.requests.length, 0);
});

test('a sheet whose files read fine reports no problem field', async () => {
    const { api } = await setup();
    api.setColumns(['title', 'genre', 'label']);
    assert.deepEqual(await api.readTags(), { ok: true, unreadable: 0 });
});

test('a reader that leaves out tags it has no value for does not make the sheet read the same files for ever', async () => {
    const { createTagSheetActions } = await load();
    const bridge = fakeBridge();
    // returns only what the file has: no composer key at all. A runaway loop shows up as this error, not as a hang.
    bridge.readTags = async (url) => {
        bridge.reads.push(url);
        if (bridge.reads.length > 20) throw new Error('read the same files over and over');
        return { success: true, metadata: { title: 'x' } };
    };
    const { api } = createTagSheetActions(bridge);
    api.loadSongs('all-songs');
    api.setColumns(['title', 'composer']);
    assert.deepEqual(await api.readTags(), { ok: true, unreadable: 0 });
    assert.equal(bridge.reads.length, 4, 'each file once');
    assert.deepEqual(api.getSheet().rows.map((row) => row.values.composer), [[], [], [], []], 'a tag the file does not have is empty, not "still loading"');
});

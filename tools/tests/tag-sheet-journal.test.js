'use strict';

// PD-06: every apply in the tag sheet is written to the durable undo journal (electron/ai/journal.js, E's), so Undo works from the
// notification, after a restart, and through the same code that undoes the AI's tag changes. An in-memory "disk" stands in for the
// files; the journal fake answers like E's IPC handlers. No browser, no real files.
// Run: node --test tools/tests/tag-sheet-journal.test.js

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const SRC = path.join(__dirname, '..', '..', 'src', 'ui-next');
const load = (...p) => import(pathToFileURL(path.join(SRC, ...p)).href);
const clone = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setImmediate(resolve));

const START = {
    1: { title: 'Song 1', artist: ['The Band'], album: 'Old 1', albumArtist: [], genre: ['Rock', 'Pop'], year: '2001', label: '' },
    2: { title: 'Song 2', artist: ['The Band'], album: 'Old 2', albumArtist: [], genre: [], year: '2002', label: '' },
    3: { title: 'Song 3', artist: ['The Band'], album: 'Old 3', albumArtist: [], genre: [], year: '2003', label: '' }
};
const url = (id) => `file:///${id}.mp3`;
const idOf = (fileUrl) => Number(String(fileUrl).match(/(\d)\.mp3/)[1]);

/** The journal as E's IPC handlers answer: record -> { ok, entry }, get -> entry | null, list -> newest first without the undo data. */
function fakeJournal() {
    const entries = [];
    return {
        entries,
        record: async (entry) => {
            const saved = { id: `e${entries.length + 1}`, at: 1000 + entries.length, kind: entry.kind, summary: entry.summary, status: 'done', changes: clone(entry.changes) };
            entries.push(saved);
            return { ok: true, entry: saved };
        },
        get: async (id) => clone(entries.find((e) => e.id === id) || null),
        list: async () => entries.slice().reverse().map(({ id, at, kind, summary, status, changes }) => ({ id, at, kind, summary, status, changeCount: changes.length })),
        markUndone: async (id) => { const e = entries.find((x) => x.id === id); if (e) e.status = 'undone'; return { ok: Boolean(e) }; }
    };
}

/** Files in memory, written the way the tag service answers: each result carries what the file held before. */
function fakeDisk() {
    const disk = Object.fromEntries(Object.entries(START).map(([id, tags]) => [url(id), clone(tags)]));
    const writes = [];
    return {
        disk,
        writes,
        read: async (fileUrl) => ({ success: true, metadata: clone(disk[fileUrl]) }),
        write: async (items, { failFor = [] } = {}) => {
            writes.push(clone(items));
            return {
                success: true,
                results: items.map((item) => {
                    if (failFor.includes(item.fileUrl)) return { fileUrl: item.fileUrl, success: false, error: 'file is locked' };
                    const previous = {};
                    for (const key of Object.keys(item.metadata)) previous[key] = clone(disk[item.fileUrl][key]);
                    Object.assign(disk[item.fileUrl], clone(item.metadata));
                    return { fileUrl: item.fileUrl, success: true, metadata: clone(item.metadata), previous };
                })
            };
        }
    };
}

function makeBridge({ journal, files, withNotice = true, withJournal = true } = {}) {
    const bridge = {
        notices: [],
        toasts: [],
        undone: [],
        sources: () => [{ id: 'all', label: 'All songs', group: 'library' }],
        loadSource: () => [1, 2, 3].map((id) => ({ id, url: url(id), title: START[id].title })),
        readTags: files.read,
        writeTags: (items) => files.write(items),
        refreshSongs: () => {},
        notify: (message, type) => bridge.toasts.push([message, type])
    };
    if (withNotice) {
        bridge.notice = (options) => {
            const note = { options: { ...options }, updates: [] };
            note.update = (partial) => { note.updates.push(partial); Object.assign(note.options, partial); };
            bridge.notices.push(note);
            return note;
        };
    }
    if (withJournal) {
        const answers = { aiJournalRecord: journal.record, aiJournalGet: journal.get, aiJournalList: journal.list, aiJournalMarkUndone: journal.markUndone };
        bridge.journal = (name, ...args) => answers[name](...args);
        // what adapter/ai-bridge.js undoEntry does for a set_tags change, against the same fake files
        bridge.undoJournalEntry = async (id) => {
            const entry = await journal.get(id);
            bridge.undone.push(id);
            const failures = [];
            for (let i = entry.changes.length - 1; i >= 0; i -= 1) {
                const { undo } = entry.changes[i];
                const response = await files.write(undo.changed.map(({ fileUrl, previous }) => ({ fileUrl, metadata: previous })));
                const bad = response.results.filter((r) => !r.success);
                if (bad.length) failures.push({ message: `${bad.length} song(s) could not be restored: ${bad[0].error}` });
            }
            if (!failures.length) await journal.markUndone(id);
            return { ok: failures.length === 0, failures };
        };
    }
    return bridge;
}

async function open(options = {}) {
    const { createTagSheetActions } = await load('views', 'tools', 'tag-sheet-actions.js');
    const journal = options.journal || fakeJournal();
    const files = options.files || fakeDisk();
    const bridge = makeBridge({ ...options, journal, files });
    const { api, ui } = createTagSheetActions(bridge);
    api.loadSongs('all');
    api.setColumns(['title', 'album', 'genre', 'year']);
    await api.readTags();
    await ui.restoreUndo(); // what mounting the sheet does
    return { api, ui, bridge, journal, files };
}

const apply = async ({ api, ui }) => {
    ui.setReviewer(async () => { await ui.commit(); });
    return api.requestApply();
};
const edit = (api, id, key, value) => assert.equal(api.setCell({ id, key, value }).ok, true);

test('every apply writes one journal entry, in the shape the AI\'s set_tags undo reads, with the old values exactly', async () => {
    const t = await open();
    edit(t.api, 1, 'album', 'New 1');
    edit(t.api, 1, 'genre', ['Jazz']);
    edit(t.api, 2, 'year', '1999');
    await apply(t);
    assert.equal(t.journal.entries.length, 1);
    const entry = t.journal.entries[0];
    assert.equal(entry.kind, 'tag-sheet');
    assert.equal(entry.summary, 'Tags of 2 songs: Album, Genre, Year');
    assert.equal(entry.changes.length, 1);
    assert.equal(entry.changes[0].type, 'set_tags');
    assert.deepEqual(entry.changes[0].undo, { changed: [
        { fileUrl: url(1), previous: { album: 'Old 1', genre: ['Rock', 'Pop'] } },
        { fileUrl: url(2), previous: { year: '2002' } }
    ] });
    assert.equal(t.api.getSheet().rows.length, 3);
    assert.equal(t.ui.hasUndo(), true);
});

test('an apply that saves nothing writes no journal entry', async () => {
    const t = await open();
    const outcome = await apply(t);
    assert.deepEqual([outcome.ok, outcome.error], [false, 'There is nothing to apply.']);
    assert.equal(t.files.writes.length, 0);
    assert.equal(t.journal.entries.length, 0);
    assert.equal(t.bridge.notices.length, 0);
    assert.equal(t.ui.hasUndo(), false);
});

test('the notification has an Undo button; pressing it puts the old tags back, marks the entry undone and clears the button', async () => {
    const t = await open();
    edit(t.api, 1, 'album', 'New 1');
    edit(t.api, 1, 'genre', ['Jazz']);
    await apply(t);
    const [note] = t.bridge.notices;
    assert.equal(note.options.title, 'Saved 1 song');
    assert.equal(note.options.kind, 'success');
    assert.equal(note.options.action.label, 'Undo');
    assert.equal(t.files.disk[url(1)].album, 'New 1');

    await note.options.action.onClick();
    assert.deepEqual([t.files.disk[url(1)].album, t.files.disk[url(1)].genre], ['Old 1', ['Rock', 'Pop']], 'multi-value tags come back as the same list, not one joined value');
    assert.equal(t.journal.entries[0].status, 'undone');
    assert.deepEqual(note.updates, [{ action: null }]);
    assert.deepEqual([t.bridge.notices[1].options.title, t.bridge.notices[1].options.kind], ['Undone', 'success']);
    assert.equal(t.ui.hasUndo(), false);
    assert.equal((await t.api.undoLast()).ok, false, 'a second Undo has nothing to do');
});

test('the sheet\'s own Undo does the same and shows the old values in the rows', async () => {
    const t = await open();
    edit(t.api, 2, 'album', 'New 2');
    await apply(t);
    assert.equal(t.api.getSheet().rows.find((r) => r.id === 2).values.album, 'New 2');
    assert.deepEqual(await t.api.undoLast(), { ok: true });
    assert.equal(t.api.getSheet().rows.find((r) => r.id === 2).values.album, 'Old 2');
    assert.equal(t.journal.entries[0].status, 'undone');
});

test('a journal that cannot be written never stops a save; Undo then works until the app closes, and the notification says so', async () => {
    for (const record of [async () => ({ ok: false, error: 'disk full' }), async () => { throw new Error('ipc gone'); }]) {
        const t = await open();
        const answer = t.bridge.journal;
        t.bridge.journal = (name, ...args) => (name === 'aiJournalRecord' ? record(...args) : answer(name, ...args));
        edit(t.api, 1, 'album', 'New 1');
        const outcome = await apply(t);
        assert.equal(outcome.saved, 1);
        assert.equal(t.files.disk[url(1)].album, 'New 1');
        assert.equal(t.journal.entries.length, 0);
        assert.equal(t.bridge.notices[0].options.detail, 'Undo works until the app is closed.');
        assert.equal(t.ui.hasUndo(), true);
        assert.deepEqual(await t.api.undoLast(), { ok: true });
        assert.equal(t.files.disk[url(1)].album, 'Old 1');
    }
});

test('without any journal at all the sheet behaves as before: in-memory Undo, and the engine toast when the shell has no notifications', async () => {
    const t = await open({ withJournal: false, withNotice: false });
    edit(t.api, 1, 'album', 'New 1');
    await apply(t);
    assert.deepEqual(t.bridge.toasts, [['Saved 1 song.', 'success']]);
    assert.equal(t.ui.hasUndo(), true);
    assert.deepEqual(await t.api.undoLast(), { ok: true });
    assert.equal(t.files.disk[url(1)].album, 'Old 1');
    assert.equal(t.ui.hasUndo(), false);
});

test('after a restart the newest tag-sheet change can still be undone, through the journal, and the rows show the files again', async () => {
    const journal = fakeJournal();
    const files = fakeDisk();
    const first = await open({ journal, files });
    edit(first.api, 1, 'album', 'New 1');
    edit(first.api, 1, 'genre', ['Jazz']);
    await apply(first);

    // a new session: nothing in memory, the same journal and files
    const second = await open({ journal, files });
    assert.equal(second.ui.hasUndo(), true, 'found in the journal');
    assert.equal(second.api.getSheet().rows.find((r) => r.id === 1).values.album, 'New 1');
    assert.deepEqual(await second.api.undoLast(), { ok: true });
    assert.deepEqual(second.bridge.undone, ['e1'], 'the journal\'s undo ran, not a copy of it');
    assert.deepEqual([files.disk[url(1)].album, files.disk[url(1)].genre], ['Old 1', ['Rock', 'Pop']]);
    assert.equal(second.api.getSheet().rows.find((r) => r.id === 1).values.album, 'Old 1', 'the row was read again');
    assert.equal(journal.entries[0].status, 'undone');
    assert.equal(second.ui.hasUndo(), false);
});

test('after a restart an entry that is already undone, or an AI entry, is not offered', async () => {
    const journal = fakeJournal();
    await journal.record({ kind: 'tag-sheet', summary: 'x', changes: [{ type: 'set_tags', undo: { changed: [] } }] });
    await journal.markUndone('e1');
    await journal.record({ kind: 'ai-plan', summary: 'AI', changes: [{ type: 'set_tags', undo: { changed: [] } }] });
    const t = await open({ journal });
    assert.equal(t.ui.hasUndo(), false);
});

test('if the change was undone somewhere else (Edit > Undo), the sheet refuses to write the old values again', async () => {
    const t = await open();
    edit(t.api, 1, 'album', 'New 1');
    await apply(t);
    await t.journal.markUndone('e1'); // the AI-side Undo reversed it
    edit(t.api, 1, 'label', 'typed afterwards'); // not applied; but the file may have changed too
    const before = t.files.writes.length;
    const out = await t.api.undoLast();
    assert.deepEqual([out.ok, out.error], [false, 'That change was already undone.']);
    assert.equal(t.files.writes.length, before, 'nothing was written');
    assert.equal(t.ui.hasUndo(), false);
});

test('an Undo that cannot restore every file reports it, keeps the entry as not undone, and can be tried again through the journal', async () => {
    const t = await open();
    edit(t.api, 1, 'album', 'New 1');
    edit(t.api, 2, 'album', 'New 2');
    await apply(t);
    t.bridge.writeTags = (items) => t.files.write(items, { failFor: [url(2)] });
    const out = await t.api.undoLast();
    assert.equal(out.ok, false);
    assert.match(out.error, /Undone, with problems: Song 2: file is locked/);
    assert.equal(t.files.disk[url(1)].album, 'Old 1');
    assert.equal(t.files.disk[url(2)].album, 'New 2');
    assert.equal(t.journal.entries[0].status, 'done', 'not marked undone while a file is still wrong');
    assert.equal(t.ui.hasUndo(), true);
    t.bridge.writeTags = (items) => t.files.write(items);
    assert.deepEqual(await t.api.undoLast(), { ok: true });
    assert.equal(t.files.disk[url(2)].album, 'Old 2');
    assert.equal(t.journal.entries[0].status, 'undone');
});

test('Undo on an older notification undoes that change, not the newest one', async () => {
    const t = await open();
    edit(t.api, 1, 'album', 'New 1');
    await apply(t);
    edit(t.api, 2, 'album', 'New 2');
    await apply(t);
    const [older, newer] = t.bridge.notices;
    await older.options.action.onClick();
    assert.deepEqual([t.files.disk[url(1)].album, t.files.disk[url(2)].album], ['Old 1', 'New 2']);
    assert.deepEqual(t.journal.entries.map((e) => e.status), ['undone', 'done']);
    assert.deepEqual(t.bridge.undone, ['e1'], 'through the journal, because the sheet held the newer batch');
    assert.equal(t.ui.hasUndo(), true, 'the newer change can still be undone');
    await newer.options.action.onClick();
    assert.deepEqual([t.files.disk[url(1)].album, t.files.disk[url(2)].album], ['Old 1', 'Old 2']);
    assert.equal(t.ui.hasUndo(), false);
});

test('without a journal, an old notification cannot undo a newer change by mistake', async () => {
    const t = await open({ withJournal: false });
    edit(t.api, 1, 'album', 'New 1');
    await apply(t);
    edit(t.api, 2, 'album', 'New 2');
    await apply(t);
    await t.bridge.notices[0].options.action.onClick();
    assert.equal(t.files.disk[url(2)].album, 'New 2', 'the newer change is untouched');
    assert.equal(t.bridge.notices.at(-1).options.title, 'Could not undo everything');
    assert.match(t.bridge.notices.at(-1).options.detail, /can no longer be undone from here/);
});

test('a save with a failed file says so in the notification and still offers Undo for the files that were written', async () => {
    const t = await open();
    t.bridge.writeTags = (items) => t.files.write(items, { failFor: [url(2)] });
    edit(t.api, 1, 'album', 'New 1');
    edit(t.api, 2, 'album', 'New 2');
    await apply(t);
    const note = t.bridge.notices[0].options;
    assert.deepEqual([note.title, note.kind, note.important], ['Saved 1 of 2 songs', 'warning', true]);
    assert.match(note.detail, /1 problem: Song 2: file is locked/);
    assert.equal(note.action.label, 'Undo');
    assert.deepEqual(t.journal.entries[0].changes[0].undo.changed.map((c) => c.fileUrl), [url(1)], 'only the written file is in the journal');
});

// The undo code the AI's own Undo button runs (adapter/ai-bridge.js) must reverse an entry the sheet recorded, exactly.
test('E\'s real undoEntry reverses a sheet entry exactly, multi-value tags included', async () => {
    const journal = fakeJournal();
    const files = fakeDisk();
    const t = await open({ journal, files });
    edit(t.api, 1, 'album', 'New 1');
    edit(t.api, 1, 'genre', ['Jazz']);
    edit(t.api, 3, 'year', '1990');
    await apply(t);
    assert.equal(files.disk[url(1)].album, 'New 1');

    globalThis.window = {
        SONGS_DATA: [],
        playbackQueue: [],
        desktopApi: {
            metadata: { saveAudioMetadataMany: (items) => files.write(items) },
            ai: { aiJournalGet: journal.get, aiJournalMarkUndone: journal.markUndone, aiJournalRecord: journal.record, aiJournalList: journal.list }
        }
    };
    const { undoEntry } = await load('adapter', 'ai-bridge.js');
    const result = await undoEntry('e1');
    assert.deepEqual(result, { ok: true, failures: [] });
    assert.deepEqual(files.disk[url(1)], START[1]);
    assert.deepEqual(files.disk[url(3)], START[3]);
    assert.equal(journal.entries[0].status, 'undone');
    assert.deepEqual((await undoEntry('e1')).failures, [{ message: 'Already undone' }]);
});

afterEach(() => { delete globalThis.window; });

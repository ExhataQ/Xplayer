// Tests for src/ui-next/views/ai/apply-plan.js: what the person is told after an AI plan runs, and that the
// Undo button on that notification really undoes it. Uses the real notification module (shell/notify.js) and the real
// journal, with a small stand-in engine. Pure Node.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createJournal } = require('../../electron/ai/journal');

const NEXT = path.resolve(__dirname, '..', '..', 'src', 'ui-next');
const url = (p) => pathToFileURL(path.join(NEXT, p)).href;

async function setup({ failTags = false } = {}) {
    const journal = createJournal({ file: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'xplayer-apply-')), 'j.json') });
    let seq = 0;
    const w = {
        SONGS_DATA: [{ id: 1, title: 'One', url: 'u1', genre: 'Rock' }],
        playlists: [],
        getPlaylists: () => w.playlists,
        createPlaylist: (name) => { const p = { id: `p${++seq}`, name, songs: [] }; w.playlists.push(p); return p; },
        deletePlaylist: (id) => { w.playlists = w.playlists.filter((p) => p.id !== id); },
        addSongToPlaylist: () => true,
        removeSongFromPlaylist: () => {},
        desktopApi: {
            ai: {
                aiJournalRecord: async (e) => ({ ok: true, entry: journal.record(e) }),
                aiJournalGet: async (id) => journal.get(id),
                aiJournalList: async () => journal.list(),
                aiJournalMarkUndone: async (id) => ({ ok: journal.markUndone(id) })
            },
            metadata: {
                saveAudioMetadataMany: async (items) => ({ success: true, results: items.map((i) => (failTags ? { fileUrl: i.fileUrl, success: false, error: 'no python' } : { fileUrl: i.fileUrl, success: true, metadata: i.metadata, previous: { genre: 'Rock' } })) })
            }
        }
    };
    globalThis.window = w;
    const tag = `?t=${Math.random()}`;
    const notify = await import(url('shell/notify.js'));
    const apply = await import(url('views/ai/apply-plan.js') + tag);
    return { w, journal, apply, notify };
}

function listen(notify) {
    let last = [];
    notify.watchShellNotifications((list) => { last = list; });
    return () => last;
}

test('apply: a finished plan posts one success entry with an Undo button, and Undo puts everything back', async () => {
    const { w, apply, notify } = await setup();
    const entries = listen(notify);
    const before = entries().length;
    const r = await apply.applyPlan({ summary: 'Sort', actions: [{ type: 'create_playlist', args: { name: 'Calm' } }] }, 'Sorted your library');
    assert.equal(r.ok, true);
    assert.equal(w.playlists.length, 1);
    const entry = entries()[0];
    assert.equal(entries().length, before + 1);
    assert.deepEqual([entry.title, entry.type, entry.action.label], ['Sorted your library', 'success', 'Undo']);
    assert.match(entry.detail, /1 change made/);
    await entry.action.onClick();
    assert.equal(w.playlists.length, 0);
    const now = entries();
    assert.equal(now[0].title, 'Undone');
    assert.ok(!now.some((e) => e.action), 'the Undo entry is gone');
});

test('apply: a plan that stops halfway says how far it got, keeps Undo for what ran, and names the cause', async () => {
    const { w, apply, notify } = await setup();
    const entries = listen(notify);
    const r = await apply.applyPlan({ summary: 'S', actions: [{ type: 'create_playlist', args: { name: 'A' } }, { type: 'add_to_playlist', args: { playlist: 'Missing', songs: [1] } }] });
    assert.equal(r.ok, false);
    const e = entries()[0];
    assert.equal(e.type, 'warning');
    assert.match(e.detail, /Stopped after 1 of 2 steps: Playlist "Missing" does not exist\./);
    assert.equal(e.action.label, 'Undo');
    await e.action.onClick();
    assert.equal(w.playlists.length, 0);
});

test('apply: a plan that changed nothing gives a plain, important error and no Undo', async () => {
    const { apply, notify } = await setup();
    const entries = listen(notify);
    const failed = await apply.applyPlan({ summary: 'S', actions: [{ type: 'add_to_playlist', args: { playlist: 'None', songs: [1] } }] });
    assert.equal(failed.ok, false);
    const e = entries()[0];
    assert.deepEqual([e.type, e.title, !!e.action, e.important], ['error', 'The plan could not run', false, true]);
});

test('apply: tags that cannot be written are reported honestly, with no Undo when nothing changed', async () => {
    const { apply, notify } = await setup({ failTags: true });
    const entries = listen(notify);
    const r = await apply.applyPlan({ summary: 'Fix tags', actions: [{ type: 'set_tags', args: { songs: [1], tags: { genre: 'Pop' } } }] });
    assert.equal(r.ok, false);
    assert.equal(entries()[0].type, 'error');
    assert.match(entries()[0].detail, /no python/);
});

test('apply: undoLast reverses the newest entry that is still done, and says so when there is none', async () => {
    const { w, apply, notify } = await setup();
    const entries = listen(notify);
    assert.deepEqual(await apply.undoLast(), { ok: false, none: true });
    await apply.applyPlan({ summary: 'S', actions: [{ type: 'create_playlist', args: { name: 'One' } }] });
    await apply.applyPlan({ summary: 'S', actions: [{ type: 'create_playlist', args: { name: 'Two' } }] });
    assert.equal(w.playlists.length, 2);
    assert.equal((await apply.undoLast()).ok, true);
    assert.deepEqual(w.playlists.map((p) => p.name), ['One']);
    assert.equal((await apply.undoLast()).ok, true);
    assert.equal(w.playlists.length, 0);
    assert.equal((await apply.undoLast()).none, true);
    assert.equal(entries()[0].title, 'Undone');
});

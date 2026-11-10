'use strict';

// The undo journal when the disk will not take it (task PD-06: "a journal write failure leaves Undo for the session only").
// The changes a plan makes happen BEFORE the entry is written, so a failed write must not hide them or lose the way back:
// the entry stays in memory, the caller is told it was not saved, and Undo works until the app closes.
// The journal's file is put inside a regular file, which no folder can be created in, whoever runs the test.
//
// Run:   node --test tools/tests/journal-write-failure.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createJournal, recordSafely, NOT_SAVED } = require('../../electron/ai/journal');
const { executePlan, undoEntry } = require('../../electron/ai/executor');

function unwritableFile() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-journal-'));
    const blocker = path.join(dir, 'not-a-folder');
    fs.writeFileSync(blocker, 'x');
    return path.join(blocker, 'ai-journal.json');
}

const CHANGE = { type: 'set_tags', undo: { 'file:///a.mp3': { genre: 'Rock' } } };

test('record: a failed write throws a recognisable error that carries the entry, and the entry is kept for this session', () => {
    const journal = createJournal({ file: unwritableFile() });
    let caught = null;
    try { journal.record({ kind: 'ai-plan', summary: 'Genres', changes: [CHANGE] }); } catch (error) { caught = error; }
    assert.ok(caught, 'the caller must be told');
    assert.equal(caught.code, NOT_SAVED);
    assert.deepEqual(caught.entry.changes, [CHANGE]);
    assert.equal(journal.latestUndoable().id, caught.entry.id, 'Undo can still find it');
    assert.equal(journal.list()[0].id, caught.entry.id, 'and the list shows it');
});

test('record: an entry that is refused (no changes) is still a plain error with no entry attached', () => {
    const journal = createJournal({ file: unwritableFile() });
    assert.throws(() => journal.record({ kind: 'ai-plan', changes: [] }), (error) => error.code !== NOT_SAVED && !error.entry);
});

test('markUndone: not being able to write it down does not turn a finished undo into an error', () => {
    const journal = createJournal({ file: unwritableFile() });
    let entry;
    try { journal.record({ kind: 'ai-plan', changes: [CHANGE] }); } catch (error) { entry = error.entry; }
    assert.equal(journal.markUndone(entry.id), true);
    assert.equal(journal.get(entry.id).status, 'undone');
    assert.equal(journal.latestUndoable(), null);
});

test('recordSafely: written, not saved (with the entry), and refused', () => {
    const good = createJournal({ file: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'xp-journal-')), 'j.json') });
    const written = recordSafely(good, { kind: 'ai-plan', summary: 's', changes: [CHANGE] });
    assert.equal(written.ok, true);
    assert.equal(good.list().length, 1);

    const bad = createJournal({ file: unwritableFile() });
    const notSaved = recordSafely(bad, { kind: 'ai-plan', summary: 's', changes: [CHANGE] });
    assert.deepEqual([notSaved.ok, notSaved.error], [false, 'not-saved']);
    assert.match(notSaved.message, /until the app is closed/);
    assert.equal(bad.get(notSaved.entry.id).status, 'done');

    const refused = recordSafely(good, { kind: '', changes: [] });
    assert.deepEqual([refused.ok, refused.error], [false, 'bad-entry']);
    assert.equal(refused.entry, undefined);
    assert.equal(recordSafely(good, null).error, 'bad-entry');
});

test('executePlan: the plan ran, the journal could not be written: the result says so and still gives the way back', async () => {
    const journal = createJournal({ file: unwritableFile() });
    const state = { genre: 'Pop' };
    const handlers = { set_tags: async () => { const old = state.genre; state.genre = 'Rock'; return { undo: { old } }; } };
    const undoHandlers = { set_tags: async ({ old }) => { state.genre = old; } };
    const plan = { summary: 'Genres', actions: [{ type: 'set_tags', args: {} }] };

    const result = await executePlan(plan, { handlers, journal });
    assert.equal(result.ok, true, 'the plan itself succeeded');
    assert.equal(result.applied, 1);
    assert.equal(state.genre, 'Rock');
    assert.equal(typeof result.entryId, 'string', 'not null: there is something to undo');
    assert.equal(result.journalSaved, false);
    assert.match(result.journalMessage, /undone until the app is closed/);

    const undone = await undoEntry(result.entryId, { undoHandlers, journal });
    assert.equal(undone.ok, true);
    assert.equal(state.genre, 'Pop');
    assert.equal(journal.get(result.entryId).status, 'undone');
});

test('executePlan: when the journal works, the result has no journalSaved field at all', async () => {
    const journal = createJournal({ file: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'xp-journal-')), 'j.json') });
    const result = await executePlan({ summary: 's', actions: [{ type: 'set_tags', args: {} }] }, { handlers: { set_tags: async () => ({ undo: {} }) }, journal });
    assert.equal(result.ok, true);
    assert.equal('journalSaved' in result, false);
});

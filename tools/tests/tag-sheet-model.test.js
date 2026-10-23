'use strict';

// views/tools/tag-sheet-model.js: columns, staged edits and add/replace/remove, no browser needed.
// Run: node --test tools/tests/tag-sheet-model.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'ui-next', 'views', 'tools', 'tag-sheet-model.js')).href);

async function sheetWith(songs) {
    const m = await load();
    const sheet = m.createSheet();
    m.addRows(sheet, songs);
    return { m, sheet };
}

test('rows and columns: adding twice keeps one row, removing a row never needs the file', async () => {
    const { m, sheet } = await sheetWith([{ id: 1, title: 'A' }, { id: 2, title: 'B' }]);
    assert.equal(m.addRows(sheet, [{ id: 2, title: 'B2' }, { id: 3, title: 'C' }]), 1);
    assert.deepEqual(sheet.order, [1, 2, 3]);
    m.addColumn(sheet, 'composer');
    m.addColumn(sheet, 'composer');
    m.addColumn(sheet, 'nonsense');
    assert.equal(sheet.columns.filter((k) => k === 'composer').length, 1);
    assert.ok(!sheet.columns.includes('nonsense'));
    m.removeRows(sheet, [1]);
    assert.deepEqual(sheet.order, [2, 3]);
    m.removeColumn(sheet, 'composer');
    assert.ok(!sheet.columns.includes('composer'));
});

test('multi-value tags split on semicolons only and never repeat a value', async () => {
    const m = await load();
    assert.deepEqual(m.normalize('genre', 'Pop; rock ;POP'), ['Pop', 'rock']);
    assert.deepEqual(m.normalize('artist', 'Simon, Garfunkel'), ['Simon, Garfunkel']);
    assert.equal(m.normalize('year', ' 2001 '), '2001');
});

test('add keeps the old values (the default mode)', async () => {
    const { m, sheet } = await sheetWith([{ id: 1, genre: ['Rock'] }, { id: 2, genre: ['Pop'] }, { id: 3, genre: [] }]);
    m.applyValue(sheet, [1, 2, 3], 'genre', 'Pop');
    assert.deepEqual(m.valueOf(sheet, 1, 'genre'), ['Rock', 'Pop']);
    assert.deepEqual(m.valueOf(sheet, 3, 'genre'), ['Pop']);
    assert.deepEqual(m.changes(sheet).map((c) => c.id), [1, 3]);
});

test('replace and remove', async () => {
    const { m, sheet } = await sheetWith([{ id: 1, genre: ['Rock', 'Pop'] }, { id: 2, genre: ['Jazz'] }]);
    m.applyValue(sheet, [1], 'genre', 'Pop', 'remove');
    m.applyValue(sheet, [2], 'genre', 'Blues', 'replace');
    assert.deepEqual(m.valueOf(sheet, 1, 'genre'), ['Rock']);
    assert.deepEqual(m.valueOf(sheet, 2, 'genre'), ['Blues']);
});

test('single-value tags: add and replace set the value, remove clears it', async () => {
    const { m, sheet } = await sheetWith([{ id: 1, album: 'Old' }]);
    m.applyValue(sheet, [1], 'album', 'New');
    assert.equal(m.valueOf(sheet, 1, 'album'), 'New');
    m.applyValue(sheet, [1], 'album', '', 'remove');
    assert.equal(m.valueOf(sheet, 1, 'album'), '');
});

test('editing a cell back to its loaded value is not a change; discard clears everything', async () => {
    const { m, sheet } = await sheetWith([{ id: 1, title: 'A' }]);
    m.stageCell(sheet, 1, 'title', 'B');
    assert.equal(m.changes(sheet).length, 1);
    m.stageCell(sheet, 1, 'title', 'A');
    assert.equal(m.changes(sheet).length, 0);
    m.stageCell(sheet, 1, 'title', 'C');
    m.discard(sheet);
    assert.equal(m.valueOf(sheet, 1, 'title'), 'A');
});

test('a column whose tags are not loaded yet is skipped, not guessed', async () => {
    const { m, sheet } = await sheetWith([{ id: 1, title: 'A' }, { id: 2, title: 'B', composer: ['X'] }]);
    const skipped = m.applyValue(sheet, [1, 2], 'composer', 'Y');
    assert.deepEqual(skipped, [1]);
    assert.deepEqual(m.valueOf(sheet, 2, 'composer'), ['X', 'Y']);
});

test('removing a row drops its staged edits', async () => {
    const { m, sheet } = await sheetWith([{ id: 1, title: 'A' }]);
    m.stageCell(sheet, 1, 'title', 'B');
    m.removeRows(sheet, [1]);
    assert.equal(m.changes(sheet).length, 0);
});

test('the sheet view reaches the engine only through the bridge, and the bridge writes only through the one batch call', () => {
    const fs = require('fs');
    const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'ui-next', ...parts), 'utf8');
    assert.doesNotMatch(read('views', 'tools', 'tag-sheet.js'), /\bwindow\b|getElementById|querySelector\(['"]#|electronAPI/);
    assert.doesNotMatch(read('views', 'tools', 'tag-sheet.js'), /adapter\//);
    assert.match(read('views', 'tools', 'tag-sheet-actions.js'), /from '..\/..\/adapter\/tag-sheet-bridge\.js'/);
    assert.doesNotMatch(read('adapter', 'tag-sheet-bridge.js'), /saveAudioMetadata\(|save-audio-metadata'|writeMany/);
    // the AI's api has no call that writes without the person: commit is on the UI object only
    assert.doesNotMatch(read('views', 'tools', 'tag-sheet-actions.js').split('const ui = {')[0].split('const api = {')[1], /commit\(|writeTags\(/);
});

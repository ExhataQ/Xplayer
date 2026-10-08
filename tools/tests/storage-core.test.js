// Tests for core/storage.js (the only file that touches localStorage) and
// core/storage-schema.js (read-time validators). Runs in Node, no browser needed.
//
// storage.js is a classic script (it has to load before 00-state.js), so it is run in a vm
// context whose localStorage is a small fake - the fake is the thing it wraps.
// storage-schema.js is an ES module and is imported directly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const JS = path.join(__dirname, '../../src/js');
const schemaModule = import(pathToFileURL(path.join(JS, 'core/storage-schema.js')).href);

function load({ stored = {}, failReads = false, failWrites = false, noStorage = false } = {}) {
    const warnings = [];
    const localStorage = {
        getItem: (k) => { if (failReads) throw new Error('SecurityError'); return Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null; },
        setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); stored[k] = String(v); },
        removeItem: (k) => { if (failWrites) throw new Error('denied'); delete stored[k]; }
    };
    const context = { console: { ...console, warn: (...a) => warnings.push(a.join(' ')) }, JSON, String };
    if (!noStorage) context.localStorage = localStorage;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(JS, 'core/storage.js'), 'utf8'), context);
    return { api: context, stored, warnings };
}

test('read returns the stored string, or the fallback when missing or unreadable', () => {
    const { api } = load({ stored: { a: 'x', empty: '' } });
    assert.equal(api.storageRead('a'), 'x');
    assert.equal(api.storageRead('empty'), '');
    assert.equal(api.storageRead('missing'), null);
    assert.equal(api.storageRead('missing', 'dflt'), 'dflt');
    assert.equal(load({ failReads: true }).api.storageRead('a', 'dflt'), 'dflt');
    assert.equal(load({ noStorage: true }).api.storageRead('a', 'dflt'), 'dflt');
});

test('write stores the string, never throws, and says whether it worked', () => {
    const ok = load();
    assert.equal(ok.api.storageWrite('k', 12), true);
    assert.equal(ok.stored.k, '12');
    const bad = load({ failWrites: true });
    assert.equal(bad.api.storageWrite('k', 'v'), false);
    assert.equal(bad.warnings.length, 1);
    assert.equal(load({ noStorage: true }).api.storageWrite('k', 'v'), false);
});

test('remove deletes the key and never throws', () => {
    const { api, stored } = load({ stored: { k: 'v' } });
    assert.equal(api.storageRemove('k'), true);
    assert.equal('k' in stored, false);
    assert.equal(load({ failWrites: true }).api.storageRemove('k'), false);
});

test('booleans are stored as the strings "true" and "false"', () => {
    const { api, stored } = load({ stored: { yes: 'true', no: 'false', odd: 'maybe' } });
    assert.equal(api.storageReadBool('yes'), true);
    assert.equal(api.storageReadBool('no', true), false);
    assert.equal(api.storageReadBool('odd'), false);
    assert.equal(api.storageReadBool('odd', true), true);
    assert.equal(api.storageReadBool('missing'), false);
    api.storageWriteBool('k', 1);
    assert.equal(stored.k, 'true');
    api.storageWriteBool('k', 0);
    assert.equal(stored.k, 'false');
});

test('JSON: parsed value, or the fallback when missing, empty, malformed or unreadable', () => {
    const { api } = load({ stored: { list: '[1,2]', bad: '{broken', empty: '' } });
    assert.deepStrictEqual(Array.from(api.storageReadJson('list', [])), [1, 2]);
    assert.deepStrictEqual(Array.from(api.storageReadJson('missing', ['x'])), ['x']);
    assert.deepStrictEqual(Array.from(api.storageReadJson('bad', ['x'])), ['x']);
    assert.deepStrictEqual(Array.from(api.storageReadJson('empty', ['x'])), ['x']);
    assert.deepStrictEqual(Array.from(load({ failReads: true }).api.storageReadJson('list', ['x'])), ['x']);
});

test('JSON: a normalize function repairs the value; if it throws or returns undefined the fallback is used', () => {
    const { api } = load({ stored: { list: '[1,"a",2]' } });
    assert.deepStrictEqual(Array.from(api.storageReadJson('list', [], (v) => v.filter((x) => typeof x === 'number'))), [1, 2]);
    assert.deepStrictEqual(Array.from(api.storageReadJson('list', ['f'], () => { throw new Error('boom'); })), ['f']);
    assert.deepStrictEqual(Array.from(api.storageReadJson('list', ['f'], () => undefined)), ['f']);
});

test('JSON write stores JSON text, and does not throw for values that cannot be serialised', () => {
    const { api, stored } = load();
    assert.equal(api.storageWriteJson('k', { a: [1] }), true);
    assert.equal(stored.k, '{"a":[1]}');
    const cycle = {}; cycle.self = cycle;
    assert.equal(api.storageWriteJson('k2', cycle), false);
    assert.equal('k2' in stored, false);
});

test('only core/storage.js touches localStorage in the files the storage step covers', () => {
    const files = [];
    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name.endsWith('.js')) files.push(full);
        }
    };
    walk(JS);
    const notYet = new Set();
    const offenders = files
        .map((f) => path.relative(JS, f).replace(/\\/g, '/'))
        .filter((rel) => rel !== 'core/storage.js' && !notYet.has(rel))
        .filter((rel) => {
            const code = fs.readFileSync(path.join(JS, rel), 'utf8').split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
            return /\blocalStorage\b/.test(code);
        });
    assert.deepEqual(offenders, [], 'these files use localStorage directly; go through storageRead/storageWrite*');
});

test('schema: id lists keep strings and numbers, and drop everything else', async () => {
    const { normalizeIdList, normalizeStringList, normalizeObjectList } = await schemaModule;
    assert.deepEqual(normalizeIdList([1, 'a', null, {}, NaN, 2, 'a']), [1, 'a', 2, 'a']);
    assert.deepEqual(normalizeIdList({ not: 'a list' }), []);
    assert.deepEqual(normalizeStringList(['playlist-1', 3, null]), ['playlist-1']);
    assert.deepEqual(normalizeObjectList([{ a: 1 }, null, 'x', [1], { b: 2 }]), [{ a: 1 }, { b: 2 }]);
});

test('schema: playlists need an id; name and songs get defaults; other fields stay', async () => {
    const { normalizePlaylists } = await schemaModule;
    const out = normalizePlaylists([
        { id: 'p1', name: 'Mix', songs: [1, 2], createdAt: 'today' },
        { id: 2, name: null, songs: 'oops' },
        { name: 'no id' },
        null
    ]);
    assert.deepEqual(out, [
        { id: 'p1', name: 'Mix', songs: [1, 2], createdAt: 'today' },
        { id: 2, name: 'Untitled playlist', songs: [] }
    ]);
    assert.deepEqual(normalizePlaylists('x'), []);
});

test('schema: folders need an id; children must have an id and a type', async () => {
    const { normalizeFolders } = await schemaModule;
    const out = normalizeFolders([
        { id: 'f1', name: 'Rock', children: [{ id: 'p1', type: 'playlist', shortcut: true }, { id: 'x' }, null] },
        { id: 'f2' },
        { children: [] }
    ]);
    assert.deepEqual(out, [
        { id: 'f1', name: 'Rock', children: [{ id: 'p1', type: 'playlist', shortcut: true }] },
        { id: 'f2', name: 'Untitled folder', children: [] }
    ]);
});

test('schema: settings keep a value only if it has the type of its default', async () => {
    const { normalizeSettings, normalizePinnedMap, normalizePanelWidths } = await schemaModule;
    const defaults = { journeySize: 50, enabled: true, mode: 'track' };
    assert.deepEqual(normalizeSettings({ journeySize: '9', enabled: false, mode: 3, extra: [1] }, defaults), { enabled: false, extra: [1] });
    assert.deepEqual(normalizeSettings([1], defaults), {});
    assert.deepEqual(normalizePinnedMap({ f1: [1, 'a', null], f2: 'x' }), { f1: [1, 'a'] });
    assert.equal(normalizePanelWidths({ left: 300, right: 0 }), null);
    assert.deepEqual(normalizePanelWidths({ left: 300, right: 400 }), { left: 300, right: 400 });
});

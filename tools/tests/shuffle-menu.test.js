// Tests for the engine-facing part of src/ui-next/adapter/shuffle-menu.js (task PB-07). The menu itself needs a DOM and is checked in the
// browser test. Pure Node, fake engine.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE = pathToFileURL(path.resolve(__dirname, '..', '..', 'src', 'ui-next', 'adapter', 'shuffle-menu.js')).href;
const load = (w) => {
    globalThis.window = w;
    return import(`${MODULE}?t=${Math.random()}`);
};
const songs = (n) => Array.from({ length: n }, (_, i) => ({ id: i }));

test('shuffleModeInfo: smart shuffle is available only above 50 songs; the mode and on state come from the engine', async () => {
    const w = { isShuffled: false, shuffleMode: 'normal', currentView: 'all-songs', getSongsForList: (view) => (view === 'all-songs' ? songs(51) : []) };
    const { shuffleModeInfo } = await load(w);
    assert.deepEqual(shuffleModeInfo(), { on: false, mode: 'normal', smartAvailable: true });
    w.getSongsForList = () => songs(50);
    w.isShuffled = true;
    w.shuffleMode = 'smart';
    assert.deepEqual(shuffleModeInfo(), { on: true, mode: 'smart', smartAvailable: false });
    w.shuffleMode = 'anything else';
    assert.equal(shuffleModeInfo().mode, 'normal');
});

test('chooseShuffleMode calls the engine choice, and says false when the engine does not have it', async () => {
    const calls = [];
    const w = { selectShuffleMode: (mode) => calls.push(mode) };
    const { chooseShuffleMode } = await load(w);
    assert.equal(chooseShuffleMode('smart'), true);
    assert.equal(chooseShuffleMode('off'), true);
    assert.deepEqual(calls, ['smart', 'off']);
    delete w.selectShuffleMode;
    assert.equal(chooseShuffleMode('normal'), false);
});

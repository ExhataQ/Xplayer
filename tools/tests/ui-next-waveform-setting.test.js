// The waveform on/off setting (task PC-03).
// Plain Node: the page's localStorage is a stand-in. Nothing here needs a browser.
// Run: node --test tools/tests/ui-next-waveform-setting.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const NEXT = path.join(__dirname, '..', '..', 'src', 'ui-next');
const url = (...p) => pathToFileURL(path.join(NEXT, ...p)).href;
const read = (...p) => fs.readFileSync(path.join(NEXT, ...p), 'utf8');

// A tiny localStorage, installed before the modules load (they read it when they start).
function installStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    globalThis.localStorage = { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => void data.set(k, String(v)), removeItem: (k) => void data.delete(k) };
    return data;
}

describe('waveform-setting.js', () => {
    const load = () => import(url('views', 'playback', 'waveform-setting.js') + '?t=' + Math.random());

    test('the waveform is off until it is turned on, and the choice is kept', async () => {
        const data = installStorage();
        const first = await load();
        assert.equal(first.isWaveformOn(), false);
        const seen = [];
        first.watchWaveform((on) => seen.push(on));
        first.setWaveformOn(true);
        first.setWaveformOn(true); // unchanged: no second announcement
        first.setWaveformOn(false);
        assert.deepEqual(seen, [true, false]);
        first.setWaveformOn(true);
        assert.equal(data.get('xplayer.ui-next.waveform'), 'on');
        assert.equal((await load()).isWaveformOn(), true, 'a new page starts with the saved choice');
        first.setWaveformOn(false);
        assert.equal((await load()).isWaveformOn(), false);
    });

    test('anything but "on" in storage means off, and a missing storage does not throw', async () => {
        installStorage({ 'xplayer.ui-next.waveform': 'yes' });
        assert.equal((await load()).isWaveformOn(), false);
        const saved = globalThis.localStorage;
        globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
        const blocked = await load();
        assert.equal(blocked.isWaveformOn(), false);
        blocked.setWaveformOn(true);
        assert.equal(blocked.isWaveformOn(), true, 'it still works for this window');
        globalThis.localStorage = saved;
    });

    test('the seek bar starts only when the setting is on, and stops at once when it is turned off', () => {
        const js = read('views', 'playback', 'seek-waveform.js');
        assert.match(js, /apply\(isWaveformOn\(\)\)/);
        assert.match(js, /watchWaveform\(apply\)/);
        assert.match(js, /const apply = \(on\) => \(on \? start\(\) : stop\(\)\)/);
    });

    test('Settings gets the section in the Playback group', () => {
        assert.match(read('shell', 'appearance-settings.js'), /buildWaveformSection\(\{ el, segmented \}\)/);
        assert.match(read('shell', 'settings-layout.js'), /titles: \['Playback', 'Player bar', 'Smart Shuffle'\]/);
    });
});

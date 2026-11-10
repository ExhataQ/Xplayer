'use strict';

// electron/single-instance.js: one running copy per data folder.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const { acquire, bringToFront } = require(path.join(ROOT, 'electron', 'single-instance.js'));
const appPaths = require(path.join(ROOT, 'electron', 'app-paths.js'));

describe('acquire', () => {
    test('the first copy gets the lock and hears about a second start', () => {
        const on = {};
        const app = { requestSingleInstanceLock: () => true, on: (name, fn) => { on[name] = fn; } };
        let heard = 0;
        assert.equal(acquire(app, () => heard++), true);
        on['second-instance']();
        assert.equal(heard, 1);
    });

    test('a second copy does not get it and registers nothing', () => {
        let registered = false;
        const app = { requestSingleInstanceLock: () => false, on: () => { registered = true; } };
        assert.equal(acquire(app, () => {}), false);
        assert.equal(registered, false);
    });

    test('an app without the call (a test stand-in) counts as the first copy', () => {
        assert.equal(acquire({}, () => {}), true);
    });
});

describe('bringToFront', () => {
    const win = (state) => {
        const calls = [];
        return Object.assign(state, {
            calls,
            isDestroyed: () => false,
            isMinimized: () => state.minimized,
            isVisible: () => state.visible,
            restore: () => calls.push('restore'),
            show: () => calls.push('show'),
            focus: () => calls.push('focus')
        });
    };

    test('restores a minimized window, shows a hidden one, then focuses', () => {
        const w = win({ minimized: true, visible: false });
        assert.equal(bringToFront(w), true);
        assert.deepEqual(w.calls, ['restore', 'show', 'focus']);
        const plain = win({ minimized: false, visible: true });
        bringToFront(plain);
        assert.deepEqual(plain.calls, ['focus']);
    });

    test('no window, or a destroyed one, is not an error', () => {
        assert.equal(bringToFront(null), false);
        assert.equal(bringToFront({ isDestroyed: () => true }), false);
    });
});

describe('the lock follows the data folder', () => {
    test('app-paths points userData at the settings folder inside the data folder, so another XPLAYER_DATA is another lock', () => {
        const a = appPaths.resolveLayout({ env: { XPLAYER_DATA: path.resolve('a-data') }, isPackaged: false, exists: () => false });
        const b = appPaths.resolveLayout({ env: { XPLAYER_DATA: path.resolve('b-data') }, isPackaged: false, exists: () => false });
        assert.notEqual(a.settingsDir, b.settingsDir);
        assert.equal(path.dirname(a.settingsDir), path.resolve('a-data'));
    });
});

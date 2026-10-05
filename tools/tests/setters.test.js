'use strict';

// Guards core/state-*.js: every setter must wrap a variable that is really declared with
// `let` somewhere in src/js (otherwise a rename would make the setter silently create a
// new global), and the setters that announce changes must emit the documented events.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '../../src/js');
const CORE_DIR = path.join(JS_DIR, 'core');

function coreSetters() {
    const found = [];
    for (const file of fs.readdirSync(CORE_DIR).filter((f) => f.startsWith('state-') && f.endsWith('.js'))) {
        const source = fs.readFileSync(path.join(CORE_DIR, file), 'utf8');
        const re = /function (set\w+)\(value\) \{\s*(\w+) = value;/g;
        let m;
        while ((m = re.exec(source))) found.push({ file, setter: m[1], variable: m[2] });
    }
    return found;
}

function topLevelLetNames() {
    const acorn = require('acorn');
    const names = new Map();
    // 99-player.js is the player.js template (it has {{placeholders}}), so it cannot be parsed as is.
    for (const file of fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.js') && f !== '99-player.js')) {
        const ast = acorn.parse(require('../lib/strip-exports').stripExports(fs.readFileSync(path.join(JS_DIR, file), 'utf8')), { ecmaVersion: 'latest', sourceType: 'script' });
        for (const node of ast.body) {
            if (node.type !== 'VariableDeclaration' || node.kind !== 'let') continue;
            for (const d of node.declarations) if (d.id.type === 'Identifier') names.set(d.id.name, file);
        }
    }
    return names;
}

describe('core/state-*.js setters', () => {
    const setters = coreSetters();

    test('there is one setter per wrapped variable, named set<Variable>', () => {
        assert.ok(setters.length >= 52, `expected at least 52 setters, found ${setters.length}`);
        const seen = new Set();
        for (const { setter, variable } of setters) {
            assert.equal(setter, 'set' + variable[0].toUpperCase() + variable.slice(1), `${setter} should wrap ${variable}`);
            assert.ok(!seen.has(variable), `${variable} has more than one setter`);
            seen.add(variable);
        }
    });

    test('every wrapped variable is declared with let in a non-core file', () => {
        const declared = topLevelLetNames();
        for (const { file, setter, variable } of setters) {
            assert.ok(declared.has(variable), `${file}: ${setter}() wraps "${variable}", which is not a top-level let in src/js`);
        }
    });

    test('setters assign the variable and the documented ones emit their event', () => {
        const context = { CustomEvent, EventTarget };
        vm.createContext(context);
        for (const file of ['00b-events.js', 'core/state-queue.js', 'core/state-navigation.js', 'core/state-ui.js']) {
            vm.runInContext(require('../lib/strip-exports').stripExports(fs.readFileSync(path.join(JS_DIR, file), 'utf8')), context);
        }
        const seen = [];
        vm.runInContext(`
            on('queue:changed', (e) => __seen.push(['queue:changed', e.detail]));
            on('queue:indexChanged', (e) => __seen.push(['queue:indexChanged', e.detail]));
            on('view:changed', (e) => __seen.push(['view:changed', e.detail]));
            on('anything', () => __seen.push(['unexpected']));
            let playbackQueue, currentQueueIndex, currentView, hoveredSongIndex;
            setPlaybackQueue([1, 2]); setCurrentQueueIndex(1); setCurrentView('albums'); setHoveredSongIndex(5);
            globalThis.__state = { playbackQueue, currentQueueIndex, currentView, hoveredSongIndex };
        `, Object.assign(context, { __seen: seen }));
        // Objects made inside the vm have a different Object prototype, so compare as plain JSON.
        assert.deepEqual(JSON.parse(JSON.stringify(context.__state)), { playbackQueue: [1, 2], currentQueueIndex: 1, currentView: 'albums', hoveredSongIndex: 5 });
        assert.deepEqual(JSON.parse(JSON.stringify(seen)), [
            ['queue:changed', { queue: [1, 2] }],
            ['queue:indexChanged', { index: 1 }],
            ['view:changed', { view: 'albums' }]
        ]);
    });
});

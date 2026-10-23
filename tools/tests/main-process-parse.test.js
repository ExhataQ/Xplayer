// The main-process files must parse, and no IPC channel may be registered twice (Electron throws on the second handle() and the app
// does not start). Added after a half-applied patch left a duplicated handler in electron/main.js that no other test noticed.
//
// Run:   node --test tools/tests/main-process-parse.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ELECTRON = path.join(__dirname, '..', '..', 'electron');
const files = fs.readdirSync(ELECTRON).filter((name) => name.endsWith('.js'));

test('every file in electron/ parses as a CommonJS module', () => {
    assert.ok(files.length > 0);
    for (const name of files) {
        const source = fs.readFileSync(path.join(ELECTRON, name), 'utf8').replace(/^#!.*/, '');
        assert.doesNotThrow(() => new vm.Script(`(function (exports, require, module, __filename, __dirname) {${source}\n})`, { filename: name }), `${name} has a syntax error`);
    }
});

test('electron/main.js registers each IPC channel once', () => {
    const source = fs.readFileSync(path.join(ELECTRON, 'main.js'), 'utf8');
    const seen = new Map();
    for (const [, kind, channel] of source.matchAll(/ipcMain\.(handle|on)\(\s*'([^']+)'/g)) seen.set(`${kind}:${channel}`, (seen.get(`${kind}:${channel}`) || 0) + 1);
    const twice = [...seen].filter(([, count]) => count > 1).map(([key]) => key);
    assert.deepEqual(twice, [], 'registered more than once: ' + twice.join(', '));
});

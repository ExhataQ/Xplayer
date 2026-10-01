'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadEventBus() {
    const source = fs.readFileSync(path.join(__dirname, '../../src/js/00b-events.js'), 'utf8');
    const context = { CustomEvent, EventTarget };
    vm.createContext(context);
    vm.runInContext(source, context);
    return context;
}

describe('app event bus (00b-events.js)', () => {
    test('on() receives what emit() sends as event.detail', () => {
        const ctx = loadEventBus();
        let received;
        ctx.on('song:changed', (e) => {
            received = e.detail;
        });
        ctx.emit('song:changed', { id: 42 });
        assert.deepEqual(received, { id: 42 });
    });

    test('multiple subscribers to the same event all run', () => {
        const ctx = loadEventBus();
        const calls = [];
        ctx.on('x', () => calls.push('a'));
        ctx.on('x', () => calls.push('b'));
        ctx.emit('x');
        assert.deepEqual(calls, ['a', 'b']);
    });

    test('a subscriber to a different event name is not called', () => {
        const ctx = loadEventBus();
        let called = false;
        ctx.on('other', () => {
            called = true;
        });
        ctx.emit('x');
        assert.equal(called, false);
    });

    test('on() returns an unsubscribe function that actually stops delivery', () => {
        const ctx = loadEventBus();
        let count = 0;
        const off = ctx.on('x', () => count++);
        ctx.emit('x');
        off();
        ctx.emit('x');
        assert.equal(count, 1);
    });

    test('emit() with no detail delivers null, does not throw', () => {
        const ctx = loadEventBus();
        let received = 'not-called';
        ctx.on('x', (e) => {
            received = e.detail;
        });
        assert.doesNotThrow(() => ctx.emit('x'));
        assert.equal(received, null);
    });

    test('emit() before anyone subscribed is a silent no-op, not an error', () => {
        const ctx = loadEventBus();
        assert.doesNotThrow(() => ctx.emit('nobody:listening', { a: 1 }));
    });
});

'use strict';

// electron/metadata-editor.js createPythonRunner: what a person is told when tags cannot be read or saved because Python or mutagen is
// missing (task PD-01). spawn is faked, so no Python is needed and nothing is started.
// Run: node --test tools/tests/python-runner.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { createPythonRunner } = require('../../electron/metadata-editor');

// behaviors: command -> { enoent: true } | { throws: true } | { code, out, err, both: true }
function fake(behaviors) {
    const calls = [];
    const spawn = (cmd, args) => {
        calls.push({ cmd, args });
        const how = typeof behaviors === 'function' ? behaviors(cmd, calls.length) : behaviors[cmd];
        if (how.throws) throw new Error('spawn threw');
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.stdin = Object.assign(new EventEmitter(), { end: (data) => { child.sent = data; } });
        setImmediate(() => {
            if (how.enoent) {
                child.emit('error', Object.assign(new Error(`spawn ${cmd} ENOENT`), { code: 'ENOENT' }));
                if (how.both) child.emit('close', -2);
                return;
            }
            if (how.out) child.stdout.emit('data', how.out);
            if (how.err) child.stderr.emit('data', how.err);
            child.emit('close', how.code ?? 0);
        });
        calls[calls.length - 1].child = child;
        return child;
    };
    return { spawn, calls };
}

const NO_MUTAGEN = { code: 1, err: 'Traceback (most recent call last):\n  File "metadata-editor.py", line 2, in <module>\n    from mutagen import File\nModuleNotFoundError: No module named \'mutagen\'\n' };
const WORKS = { code: 0, out: JSON.stringify({ success: true, metadata: { title: 'T' } }) };

test('no Python at all: says Python 3 is missing, what to install, and has tried every command once', async () => {
    const f = fake({ python3: { enoent: true, both: true }, python: { enoent: true, both: true } });
    const out = await createPythonRunner({ spawn: f.spawn, platform: 'linux' })({ action: 'read' });
    assert.equal(out.success, false);
    assert.equal(out.reason, 'no-python');
    assert.match(out.error, /Python 3 was not found/);
    assert.match(out.error, /pip install mutagen/);
    assert.deepEqual(f.calls.map((c) => c.cmd), ['python3', 'python'], 'a failed start that raises error and close must not run the next command twice');
});

test('Python without mutagen is not reported as "Python not found"', async () => {
    const f = fake({ python3: NO_MUTAGEN, python: NO_MUTAGEN });
    const out = await createPythonRunner({ spawn: f.spawn, platform: 'linux' })({ action: 'read' });
    assert.equal(out.reason, 'no-mutagen');
    assert.match(out.error, /"mutagen" is not installed/);
    assert.match(out.error, /python -m pip install mutagen/);
    assert.doesNotMatch(out.error, /not found/);
});

test('a second Python that does have mutagen is used, and that answer is passed through untouched', async () => {
    const f = fake({ python3: NO_MUTAGEN, python: WORKS });
    const out = await createPythonRunner({ spawn: f.spawn, platform: 'linux' })({ action: 'read', path: '/a.mp3' });
    assert.deepEqual(out, { success: true, metadata: { title: 'T' } });
    assert.equal(JSON.parse(f.calls[1].child.sent).path, '/a.mp3', 'the request goes to the script on stdin');
});

test('on Windows the commands are python then py -3', async () => {
    const f = fake({ python: { enoent: true }, py: WORKS });
    const out = await createPythonRunner({ spawn: f.spawn, platform: 'win32', script: 'S.py' })({});
    assert.equal(out.success, true);
    assert.deepEqual(f.calls.map((c) => [c.cmd, c.args]), [['python', ['S.py']], ['py', ['-3', 'S.py']]]);
});

test('the py launcher saying it found no Python is "no Python", not a crash', async () => {
    const f = fake({ python: { enoent: true }, py: { code: 103, err: 'No suitable Python runtime found\nPass --list (-0) to see all detected environments on your machine' } });
    const out = await createPythonRunner({ spawn: f.spawn, platform: 'win32' })({});
    assert.equal(out.reason, 'no-python');
});

test('the script crashing for another reason says what it said, last line, and is retried next time', async () => {
    let n = 0;
    const f = fake((cmd) => { n += 1; return { code: 1, err: 'Traceback (most recent call last):\n  File "x", line 9\nPermissionError: [Errno 13] Permission denied: \'/tmp/a.mp3\'\n' }; });
    const run = createPythonRunner({ spawn: f.spawn, platform: 'linux' });
    const out = await run({});
    assert.equal(out.reason, 'failed');
    assert.equal(out.error, "PermissionError: [Errno 13] Permission denied: '/tmp/a.mp3'");
    const before = f.calls.length;
    await run({});
    assert.ok(f.calls.length > before, 'a crash may be about one file, so it is not remembered');
});

test('once Python or mutagen is known to be missing, the next songs answer at once without starting anything', async () => {
    let clock = 1000;
    const f = fake({ python3: NO_MUTAGEN, python: NO_MUTAGEN });
    const run = createPythonRunner({ spawn: f.spawn, platform: 'linux', now: () => clock });
    const first = await run({});
    assert.equal(first.reason, 'no-mutagen');
    const started = f.calls.length;
    for (let i = 0; i < 50; i += 1) {
        clock += 100;
        const again = await run({});
        assert.equal(again.reason, 'no-mutagen');
        assert.equal(again.error, first.error);
    }
    assert.equal(f.calls.length, started, '50 more songs started no process');
});

test('after 30 seconds it looks again, so installing mutagen needs no restart', async () => {
    let clock = 0;
    let installed = false;
    const f = fake((cmd) => (installed ? WORKS : NO_MUTAGEN));
    const run = createPythonRunner({ spawn: f.spawn, platform: 'linux', now: () => clock });
    assert.equal((await run({})).reason, 'no-mutagen');
    installed = true;
    clock = 29999;
    assert.equal((await run({})).reason, 'no-mutagen', 'still inside the wait');
    clock = 30001;
    assert.equal((await run({})).success, true);
    const started = f.calls.length;
    assert.equal((await run({})).success, true);
    assert.ok(f.calls.length > started, 'working again means every call really runs');
});

test('the script answering with its own failure (one bad file) is passed through as it is, and the next song is still tried', async () => {
    const f = fake({ python3: { code: 1, out: JSON.stringify({ success: false, error: 'Unsupported file type' }) } });
    const run = createPythonRunner({ spawn: f.spawn, platform: 'linux' });
    assert.deepEqual(await run({}), { success: false, error: 'Unsupported file type' });
    assert.deepEqual(await run({}), { success: false, error: 'Unsupported file type' });
    assert.equal(f.calls.length, 2, 'one bad file is not a missing backend: both songs really ran');
});

test('output that is not JSON becomes a failure with the script\'s own words, or a plain default', async () => {
    const withErr = await createPythonRunner({ spawn: fake({ python3: { code: 0, out: 'garbage', err: ' something odd ' } }).spawn, platform: 'linux' })({});
    assert.deepEqual([withErr.success, withErr.reason, withErr.error], [false, 'failed', 'something odd']);
    const bare = await createPythonRunner({ spawn: fake({ python3: { code: 0, out: 'garbage' } }).spawn, platform: 'linux' })({});
    assert.equal(bare.error, 'Metadata operation failed');
});

test('a start that throws straight away is treated like a command that is not there', async () => {
    const f = fake({ python3: { throws: true }, python: WORKS });
    assert.equal((await createPythonRunner({ spawn: f.spawn, platform: 'linux' })({})).success, true);
    assert.deepEqual(f.calls.map((c) => c.cmd), ['python3', 'python']);
});

test('a first command that cannot start (error, then close) does not cut the second command short', async () => {
    const f = fake({ python3: { enoent: true, both: true }, python: WORKS });
    const out = await createPythonRunner({ spawn: f.spawn, platform: 'linux' })({});
    assert.deepEqual(out, { success: true, metadata: { title: 'T' } }, 'the working Python answered, not "no Python"');
    assert.deepEqual(f.calls.map((c) => c.cmd), ['python3', 'python']);
});

// Real child processes, not fakes: Node raises 'error' and then 'close' for a command that is not there, and the runner must not skip
// past the next command because of it. A temporary PATH holds only a working `python` (no `python3`). POSIX only.
test('real processes: with no python3 but a working python, the working one is used', { skip: process.platform === 'win32' && 'needs a POSIX shell' }, async () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xplayer-fakepy-'));
    fs.writeFileSync(path.join(dir, 'python'), '#!/bin/sh\ncat >/dev/null\necho \'{"success":true,"metadata":{"title":"from the working python"}}\'\n', { mode: 0o755 });
    const realPath = process.env.PATH;
    process.env.PATH = dir;
    try {
        const out = await createPythonRunner({ platform: 'linux' })({ action: 'read', path: '/x.mp3' });
        assert.deepEqual(out, { success: true, metadata: { title: 'from the working python' } });
        process.env.PATH = path.join(dir, 'nothing-here');
        const none = await createPythonRunner({ platform: 'linux' })({ action: 'read' });
        assert.equal(none.reason, 'no-python');
    } finally {
        process.env.PATH = realPath;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

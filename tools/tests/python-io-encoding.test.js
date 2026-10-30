'use strict';

// The Python tag backend talks to Node through pipes. On Windows Python uses the locale code page (cp1252) for them unless told
// otherwise, which (a) raised "'charmap' codec can't encode characters" for a title such as "✓" and (b) would read the UTF-8
// request that Node sends as cp1252, so an accented title was written wrong. These tests run the real script as __main__ over real
// pipes with PYTHONIOENCODING=cp1252, which gives the Windows behaviour on any computer.
// Run: node --test tools/tests/python-io-encoding.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createPythonRunner } = require('../../electron/metadata-editor');

const SCRIPT = path.join(__dirname, '..', '..', 'electron', 'metadata-editor.py');
const DRIVER = path.join(__dirname, 'helpers', 'run_script_with_fake.py');
const TITLES = ['Ünïcode Títle ✓', 'Sigur Rós — Hoppípolla', '東京 ブギウギ', 'Привет, мир', 'emoji 🎵 song', 'plain ascii'];

function findPython() {
    for (const cmd of ['python3', 'python', 'py']) {
        const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
        if (!r.error && r.status === 0) return cmd;
    }
    return null;
}
function runScript(python, request, env) {
    const file = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-io-'));
    const audio = path.join(file, 'a.mp3');
    fs.writeFileSync(audio, 'x');
    try {
        const r = spawnSync(python, [DRIVER, SCRIPT], { input: Buffer.from(JSON.stringify({ ...request, path: audio }), 'utf8'), env: { ...process.env, ...env } });
        return { status: r.status, stdout: Buffer.from(r.stdout || '').toString('utf8'), stderr: Buffer.from(r.stderr || '').toString('utf8') };
    } finally { fs.rmSync(file, { recursive: true, force: true }); }
}

for (const [label, env] of [['a Windows code page (cp1252)', { PYTHONIOENCODING: 'cp1252', PYTHONUTF8: '0' }], ['the default encoding', {}]]) {
    test(`the script returns every title unchanged on ${label}`, (t) => {
        const python = findPython();
        if (!python) return t.skip('python not found');
        for (const title of TITLES) {
            const r = runScript(python, { action: 'save', metadata: { title, comment: title } }, env);
            assert.equal(r.status, 0, `${title}: ${r.stdout}\n${r.stderr}`);
            const reply = JSON.parse(r.stdout);
            assert.equal(reply.success, true, `${title}: ${r.stdout}`);
            assert.equal(reply.metadata.title, title);
            assert.equal(reply.metadata.comment, title);
            // The reply can look right even when the text was read wrongly (cp1252 in and out cancel out), so also check the tag itself.
            const stored = /STORED:(.*)/.exec(r.stderr);
            assert.ok(stored, r.stderr);
            assert.equal(JSON.parse(stored[1]), title, 'the tag that would be written to the file');
        }
    });

    test(`an error message with non-ASCII text is still a JSON reply on ${label}`, (t) => {
        const python = findPython();
        if (!python) return t.skip('python not found');
        const missing = spawnSync(python, [DRIVER, SCRIPT], { input: Buffer.from(JSON.stringify({ action: 'read', path: path.join(os.tmpdir(), 'nöpe ✓', 'x.mp3') }), 'utf8'), env: { ...process.env, ...env } });
        assert.equal(missing.status, 1);
        const reply = JSON.parse(Buffer.from(missing.stdout).toString('utf8'));
        assert.equal(reply.success, false);
        assert.match(reply.error, /not found/i);
    });
}

// ---- the Node side of the pipe (createPythonRunner, with spawn faked) ----
const { EventEmitter } = require('events');

function fakeSpawn(emit) {
    const calls = [];
    const spawn = (cmd, args, options) => {
        const child = new EventEmitter();
        child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
        child.stdin = Object.assign(new EventEmitter(), { end: (data) => { child.sent = data; } });
        calls.push({ cmd, args, options, child });
        setImmediate(() => { emit(child); child.emit('close', 0); });
        return child;
    };
    return { spawn, calls };
}

test('Python is started in UTF-8 mode, whatever the computer\'s code page is', async () => {
    const f = fakeSpawn((child) => child.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, metadata: {} }))));
    await createPythonRunner({ spawn: f.spawn, platform: 'win32' })({ action: 'read', path: 'x' });
    assert.equal(f.calls[0].options.env.PYTHONUTF8, '1');
    assert.equal(f.calls[0].options.env.PYTHONIOENCODING, 'utf-8');
    assert.equal(f.calls[0].options.windowsHide, true);
    assert.ok(f.calls[0].options.env.PATH || f.calls[0].options.env.Path, 'the rest of the environment is passed on');
});

test('a character split between two output chunks is decoded whole', async () => {
    const reply = Buffer.from(JSON.stringify({ success: true, metadata: { title: 'Mötley Crüe ✓ 🎵' } }), 'utf8');
    for (let cut = 1; cut < reply.length; cut += 1) {
        const f = fakeSpawn((child) => { child.stdout.emit('data', reply.subarray(0, cut)); child.stdout.emit('data', reply.subarray(cut)); });
        const out = await createPythonRunner({ spawn: f.spawn, platform: 'linux' })({ action: 'read', path: 'x' });
        assert.equal(out.metadata.title, 'Mötley Crüe ✓ 🎵', `cut at byte ${cut}`);
    }
});

test('the request goes out as UTF-8 JSON', async () => {
    const f = fakeSpawn((child) => child.stdout.emit('data', Buffer.from('{"success":true}')));
    await createPythonRunner({ spawn: f.spawn, platform: 'linux' })({ action: 'save', metadata: { title: 'Ü ✓' } });
    assert.deepEqual(JSON.parse(f.calls[0].child.sent).metadata, { title: 'Ü ✓' });
});

test('an escaped (ASCII) reply from the script is read back as the original text', async () => {
    const f = fakeSpawn((child) => child.stdout.emit('data', Buffer.from('{"success": true, "metadata": {"title": "\\u00dcn\\u00efcode \\u2713 \\ud83c\\udfb5"}}\n')));
    const out = await createPythonRunner({ spawn: f.spawn, platform: 'linux' })({ action: 'read', path: 'x' });
    assert.equal(out.metadata.title, 'Ünïcode ✓ 🎵');
});

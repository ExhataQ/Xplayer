// Runs tools/tests/metadata_backend_logic.py (logic tests for electron/metadata-editor.py using a
// stand-in for mutagen). Needs only Python; skipped if Python is not found.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

function findPython() {
    for (const cmd of ['python', 'python3', 'py']) {
        const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
        if (!r.error && r.status === 0) return cmd;
    }
    return null;
}

test('metadata backend: patch-based save keeps untouched tags, never splits names, clears properly', (t) => {
    const python = findPython();
    if (!python) return t.skip('python not found');
    const script = path.join(__dirname, 'metadata_backend_logic.py');
    const r = spawnSync(python, [script], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});

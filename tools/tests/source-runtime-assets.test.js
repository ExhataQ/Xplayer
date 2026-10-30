// The source-backed test runtime links ui-next, js and assets into the output folder (Prepare-Source-Backed-Runtime.ps1).
// The new interface loads the default covers as ../assets/ from ui-next/, so without the assets link they do not show.
// Pure Node: reads the script and the sources.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

test('the runtime script links assets next to ui-next and js', () => {
    const script = fs.readFileSync(path.join(ROOT, 'Prepare-Source-Backed-Runtime.ps1'), 'utf8');
    for (const name of ['ui-next', 'js', 'assets']) assert.match(script, new RegExp(`Ensure-SourceJunction '${name}'`), name);
});

test('every ../assets/ path in ui-next points at a file in src/assets', () => {
    const missing = [];
    (function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(js|css|html)$/.test(entry.name)) {
                const text = fs.readFileSync(full, 'utf8');
                for (const m of text.matchAll(/\.\.\/(?:\.\.\/)?assets\/(default-cover[\w-]*\.svg)/g)) {
                    if (!fs.existsSync(path.join(ROOT, 'src', 'assets', m[1]))) missing.push(`${path.relative(ROOT, full)}: ${m[1]}`);
                }
            }
        }
    })(path.join(ROOT, 'src', 'ui-next'));
    assert.deepEqual(missing, []);
});

test('the launcher runs the prepare script from Source, not from a copy in the runtime folder that can go stale', () => {
    const bat = fs.readFileSync(path.join(ROOT, 'Launch-Xplayer-UI-Next.bat'), 'utf8');
    assert.match(bat, /-File "%SOURCE%\\Prepare-Source-Backed-Runtime\.ps1"/);
    assert.doesNotMatch(bat, /-File "%RUNTIME%/);
    assert.match(bat, /if not exist "%SOURCE%\\Prepare-Source-Backed-Runtime\.ps1"/);
});

// Guards for src/ui-next/adapter/context-menu-icons.css (task PB-07): every Font Awesome class the engine writes inside a menu has an
// icon drawn for it, and the file is what the generator writes. Pure Node.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const css = fs.readFileSync(path.join(ROOT, 'src', 'ui-next', 'adapter', 'context-menu-icons.css'), 'utf8').replace(/\r\n/g, '\n');

function menuClasses() {
    const found = new Set();
    const walk = (dir) => {
        for (const name of fs.readdirSync(dir)) {
            const full = path.join(dir, name);
            if (fs.statSync(full).isDirectory()) walk(full);
            else if (name.endsWith('.js')) {
                const lines = fs.readFileSync(full, 'utf8').split('\n');
                lines.forEach((line, i) => {
                    if (!line.includes('context-menu-item')) return;
                    // the icon sits on the item's own line or within the next three
                    for (const near of lines.slice(i, i + 4)) for (const m of near.matchAll(/fa[sbr] (fa-[a-z0-9-]+)/g)) found.add(m[1]);
                });
            }
        }
    };
    walk(path.join(ROOT, 'src', 'js'));
    return found;
}

test('every Font Awesome class the engine writes in a menu has an icon (the submenu arrow is drawn elsewhere)', () => {
    const skip = new Set(['fa-chevron-right']);
    const missing = [...menuClasses()].filter((c) => !skip.has(c) && !css.includes(`.${c} {`));
    assert.deepEqual(missing, [], `no icon drawn for: ${missing.join(', ')}`);
});

test('each icon rule has a real image, and the rules sit under .context-menu so other places are not touched', () => {
    const rules = [...css.matchAll(/\.context-menu \.context-menu-item \.(fa-[a-z0-9-]+) \{\n    --glyph: url\("data:image\/svg\+xml,([^"]+)"\);/g)];
    assert.ok(rules.length >= 18, `expected at least 18 icon rules, found ${rules.length}`);
    for (const [, name, data] of rules) assert.match(decodeURIComponent(data), /<svg[^>]*>.+<\/svg>/, name);
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /^\.fas|^\.far/m, 'no rule outside .context-menu');
});

test('the generator reproduces the checked-in file', async () => {
    const { execFileSync } = require('node:child_process');
    const before = css;
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-context-menu-icons.mjs')], { stdio: 'pipe' });
    const after = fs.readFileSync(path.join(ROOT, 'src', 'ui-next', 'adapter', 'context-menu-icons.css'), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(after, before);
});

#!/usr/bin/env node
'use strict';

// Works out which global names ESLint must treat as defined, from src/manifest.json. Nothing here is a hand-kept list.
//
//   - Classic scripts (manifest "js", plus 99-player.js) share one global scope, so every top-level declaration
//     in them is a global for all other files. The declarations come from tools/dep-map.js (its "decls").
//   - Any file (module or classic) can also add globals by calling registerLegacyGlobals({ name, ... }), so the keys
//     of those calls (found with acorn) are globals too. Any other module-level name is NOT a global: using it in
//     another file without an import is exactly the mistake the lint is there to catch.
//
// Used by eslint.config.js. Run it on its own to see the numbers:
//   node tools/lint-globals.js          counts
//   node tools/lint-globals.js --json   the full result
// Needs: acorn, acorn-walk (already devDependencies; dep-map.js needs them as well).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const acorn = require('acorn');
const walk = require('acorn-walk');

function buildLintGlobals(root = path.resolve(__dirname, '..')) {
    const jsDir = path.join(root, 'src', 'js');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', 'manifest.json'), 'utf8'));
    const classic = [...manifest.js, '99-player.js'];
    const modules = manifest.modules || [];

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xplayer-lint-'));
    let depMap;
    try {
        const out = path.join(tmp, 'dep-map.json');
        execFileSync(process.execPath, [path.join(root, 'tools', 'dep-map.js'), 'json', out], {
            env: { ...process.env, SOURCE_ROOT: root },
            stdio: ['ignore', 'ignore', 'pipe']
        });
        depMap = JSON.parse(fs.readFileSync(out, 'utf8'));
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }

    const names = new Map(); // name -> 'classic' | 'registered'
    for (const file of classic) for (const name of depMap.decls[file] || []) names.set(name, 'classic');

    // 99-player.js holds a {{SONGS_DATA}} build token acorn cannot parse; it registers nothing.
    const scanned = [...classic.filter((f) => f !== '99-player.js').map((f) => [f, 'script']), ...modules.map((f) => [f, 'module'])];
    for (const [file, sourceType] of scanned) {
        let ast;
        try {
            ast = acorn.parse(fs.readFileSync(path.join(jsDir, file), 'utf8'), { ecmaVersion: 'latest', sourceType });
        } catch (e) {
            throw new Error(`lint-globals: cannot parse ${file}: ${e.message}`);
        }
        walk.simple(ast, {
            CallExpression(node) {
                if (node.callee.type !== 'Identifier' || node.callee.name !== 'registerLegacyGlobals') return;
                const arg = node.arguments[0];
                if (!arg || arg.type !== 'ObjectExpression') return;
                for (const prop of arg.properties) {
                    if (prop.type !== 'Property') continue;
                    const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'Literal' ? String(prop.key.value) : null;
                    if (key && !names.has(key)) names.set(key, 'registered');
                }
            }
        });
    }

    const sorted = [...names.keys()].sort();
    return {
        classic,
        modules,
        globals: Object.fromEntries(sorted.map((n) => [n, 'readonly'])),
        counts: {
            classicFiles: classic.length,
            moduleFiles: modules.length,
            fromClassic: sorted.filter((n) => names.get(n) === 'classic').length,
            fromRegisterLegacyGlobals: sorted.filter((n) => names.get(n) === 'registered').length,
            total: sorted.length
        }
    };
}

module.exports = { buildLintGlobals };

if (require.main === module) {
    const result = buildLintGlobals();
    console.log(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : JSON.stringify(result.counts, null, 2));
}

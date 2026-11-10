'use strict';

// The shape of tools/ and docs/ (phase 2 of .agent/archive/dev-plan/DEV-PLAN.md): every script a command names exists, nothing lands loose in
// tools/, the font files match their lock file, and the guides only name files that exist.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

describe('commands point at files that exist', () => {
    test('every `node <file>` and `python <file>` in package.json scripts and the CI workflows', () => {
        const texts = [Object.values(JSON.parse(read('package.json')).scripts).join('\n')];
        const wf = path.join(ROOT, '.github', 'workflows');
        if (fs.existsSync(wf)) for (const f of fs.readdirSync(wf)) texts.push(fs.readFileSync(path.join(wf, f), 'utf8'));
        const missing = [];
        for (const m of texts.join('\n').matchAll(/\b(?:node|python3?)(?: --[\w-]+(?:=\S+)?)* ((?:tools|electron|src)\/[\w./-]+\.(?:js|mjs|py))/g)) {
            if (!fs.existsSync(path.join(ROOT, m[1]))) missing.push(m[1]);
        }
        assert.deepEqual(missing, []);
    });
});

describe('tools/ is in folders', () => {
    test('only the known files sit loose, everything else is in a folder', () => {
        const allowed = new Set(['backup_source.py', 'Apply-XplayerPatch.ps1', 'Apply-Patch.bat']);
        const loose = fs.readdirSync(path.join(ROOT, 'tools'), { withFileTypes: true }).filter((e) => e.isFile() && !allowed.has(e.name)).map((e) => e.name);
        assert.deepEqual(loose, []);
        const folders = fs.readdirSync(path.join(ROOT, 'tools'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
        assert.deepEqual(folders.filter((f) => !['checks', 'dev', 'fonts', 'icons', 'lib', 'tests', '__pycache__'].includes(f)), []);
    });

    test('each tool finds the project root from its folder (it starts, or prints its usage)', () => {
        for (const rel of ['checks/adapter-budget.js', 'dev/gen-web.js', 'fonts/fetch-fonts.js']) {
            const args = rel.endsWith('gen-web.js') ? ['--check'] : rel.endsWith('fetch-fonts.js') ? ['--check'] : [];
            const run = spawnSync(process.execPath, [path.join(ROOT, 'tools', rel), ...args], { encoding: 'utf8', cwd: ROOT });
            assert.ok(run.status === 0 || /Out of date/.test(run.stderr), `${rel}: ${run.stderr.slice(0, 200)}`);
        }
    });
});

describe('fonts', () => {
    test('the kept icon fonts match tools/fonts/fonts.lock.json (CRLF or LF)', () => {
        const run = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'fonts', 'fetch-fonts.js'), '--check'], { encoding: 'utf8' });
        assert.equal(run.status, 0, run.stderr);
    });
});

describe('the guides name files that exist', () => {
    const GUIDES = ['README.md', 'claude.md', 'docs/DEVELOPMENT.md', 'docs/ARCHITECTURE.md', 'docs/AGENT-PROMPT.txt', '.agent/AGENTS.md', '.agent/CONTEXT.md', '.agent/archive/dev-plan/DEV-PLAN.md', 'tools/tests/README.md'];
    // Named on purpose although they do not exist (yet, or any more): generated files, files a later phase makes, archives made by a script.
    const OK_MISSING = [/^(build\/|tools\/(rebuild\.bat|clean_for_share\.py)|electron\/package(-lock)?\.json|tools\/dev\/import-library|tools\/tests\/source-runtime-assets)/, /^tools\/(placeholder-test|CHANGELOG\.md|prompt\.txt|smoke-checklist\.md)/, /^dist\//, /^\.agent\/archive\/polish-1/, /^src\/(player\.js|music_player\.html|fonts|icons)/, /^src\/old-ui\//, /^electron\/(metadata-editor\.py)$/];
    test('every `path/like/this` in backticks that starts at a top folder exists', () => {
        const missing = [];
        for (const guide of GUIDES) {
            if (!fs.existsSync(path.join(ROOT, guide))) continue;
            for (const m of read(guide).matchAll(/`((?:tools|electron|src|build|docs|\.agent)\/[A-Za-z0-9_./-]+)`/g)) {
                const target = m[1].replace(/\/$/, '').replace(/\.$/, '');
                if (OK_MISSING.some((re) => re.test(target))) continue;
                if (!fs.existsSync(path.join(ROOT, target))) missing.push(`${guide}: ${target}`);
            }
        }
        assert.deepEqual(missing, []);
    });
});

describe('the Windows build job (phase 5)', () => {
    const workflow = read('.github', 'workflows', 'build.yml');

    test('it builds with npm run dist, looks inside with check-dist.js, and keeps the zip', () => {
        assert.match(workflow, /runs-on: windows-latest/);
        assert.match(workflow, /run: npm ci/);
        assert.match(workflow, /run: npm run dist/);
        assert.match(workflow, /run: node tools\/dev\/check-dist\.js/);
        assert.match(workflow, /path: dist\/Xplayer\.zip/);
        assert.ok(fs.existsSync(path.join(ROOT, 'tools', 'dev', 'check-dist.js')));
    });

    test('it runs when the app, the build files or the workflow itself change, and can be started by hand', () => {
        for (const p of ['electron/**', 'src/**', 'package.json', 'package-lock.json', 'tools/dev/make-portable.js', '.github/workflows/build.yml']) assert.ok(workflow.includes(`'${p}'`), p);
        assert.match(workflow, /workflow_dispatch:/);
    });

    test('it needs no secrets and does not look for a signing certificate', () => {
        assert.doesNotMatch(workflow, /secrets\./);
        assert.match(workflow, /CSC_IDENTITY_AUTO_DISCOVERY: 'false'/);
    });

    test('check-dist.js: a complete folder passes, a missing file or one that should not ship is named', () => {
        const { checkDist, MUST_EXIST, MUST_NOT_EXIST } = require('../dev/check-dist');
        const present = new Set(MUST_EXIST.map((rel) => path.join('/d', ...rel.split('/'))).concat('/d'));
        const exists = (p) => present.has(p);
        assert.deepEqual(checkDist('/d', exists), []);
        present.delete(path.join('/d', 'portable.txt'));
        present.add(path.join('/d', ...MUST_NOT_EXIST[1].split('/')));
        assert.deepEqual(checkDist('/d', exists), ['missing: portable.txt', `should not be there: ${MUST_NOT_EXIST[1]}`]);
        assert.match(checkDist('/nowhere', () => false)[0], /npm run dist/);
    });

    test('every file check-dist.js expects that lives in Source exists there (the build copies it from src/ or electron/)', () => {
        const { MUST_EXIST } = require('../dev/check-dist');
        const generated = new Set(['src/music_player.html', 'src/player.js']);
        for (const rel of MUST_EXIST) {
            const m = /^resources\/app\/((?:electron|src)\/.+)$/.exec(rel);
            if (m && !generated.has(m[1])) assert.ok(fs.existsSync(path.join(ROOT, ...m[1].split('/'))), m[1]);
        }
    });
});

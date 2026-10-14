// Lint tooling (no browser, no ESLint needed):
//   1. tools/lint.js exit codes: errors fail `npm run lint`, warnings fail only `--strict`, "cannot run" is 2.
//      The real script is copied next to a stand-in `eslint` module that returns canned results, so this checks
//      the script itself, not ESLint.
//   2. tools/lint.js with the real ESLint and eslint.config.js (skipped when eslint is not installed): an undefined
//      name fails with no-undef, a registered global and a browser built-in pass.
//   3. tools/lint-globals.js: the one name published as `window.<name> = ...` (updateExternalScrollbar) is a
//      global, it is validated against the file that publishes it, and no other window.* assignment becomes a global.
// Needs: acorn, acorn-walk (devDependencies; tools/dep-map.js needs them as well).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const acorn = require('acorn');

const ROOT = path.resolve(__dirname, '..', '..');
const { buildLintGlobals, findWindowAssignments, WINDOW_PUBLISHED_GLOBALS } = require('../lint-globals');

const msg = (severity, ruleId = 'no-undef') => ({ severity, ruleId, message: 'x' });
const file = (...messages) => ({ filePath: 'a.js', messages });

describe('tools/lint.js as a script (stand-in ESLint)', () => {
    function runLint(t, { results, eslintModule, args = [] }) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-script-'));
        t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
        fs.mkdirSync(path.join(dir, 'tools'));
        fs.mkdirSync(path.join(dir, 'node_modules', 'eslint'), { recursive: true });
        fs.copyFileSync(path.join(ROOT, 'tools', 'lint.js'), path.join(dir, 'tools', 'lint.js'));
        fs.writeFileSync(
            path.join(dir, 'node_modules', 'eslint', 'index.js'),
            eslintModule ||
                `class ESLint {
                    async lintFiles() { return JSON.parse(process.env.FAKE_ESLINT_RESULTS); }
                    async loadFormatter() { return { format: () => 'formatted problems' }; }
                }
                module.exports = { ESLint };`
        );
        const run = spawnSync(process.execPath, [path.join(dir, 'tools', 'lint.js'), ...args], {
            encoding: 'utf8',
            env: { ...process.env, FAKE_ESLINT_RESULTS: JSON.stringify(results || []) }
        });
        return { status: run.status, out: run.stdout, err: run.stderr };
    }

    const clean = [file()];
    const warningsOnly = [file(msg(1, 'no-unused-vars'), msg(1, 'no-unused-vars'))];
    const withError = [file(msg(2), msg(1, 'no-unused-vars'))];
    const parseError = [file({ severity: 2, ruleId: null, fatal: true, message: 'Parsing error' })];

    test('clean results: exit 0 in both modes', (t) => {
        assert.equal(runLint(t, { results: clean }).status, 0);
        assert.equal(runLint(t, { results: clean, args: ['--strict'] }).status, 0);
    });

    test('warnings only: exit 0 for `npm run lint`, exit 1 for --strict, and the count is printed', (t) => {
        const normal = runLint(t, { results: warningsOnly });
        assert.equal(normal.status, 0);
        assert.match(normal.out, /0 error\(s\), 2 warning\(s\)/);
        const strict = runLint(t, { results: warningsOnly, args: ['--strict'] });
        assert.equal(strict.status, 1);
        assert.match(strict.out, /Lint failed \(--strict\): 2 warning\(s\)/);
    });

    test('any error: exit 1 in both modes, even when --summary is used', (t) => {
        const normal = runLint(t, { results: withError });
        assert.equal(normal.status, 1);
        assert.match(normal.out, /1 error\(s\), 1 warning\(s\)/);
        assert.match(normal.out, /Lint failed: 1 error\(s\)/);
        assert.equal(runLint(t, { results: withError, args: ['--strict'] }).status, 1);
        assert.equal(runLint(t, { results: withError, args: ['--summary'] }).status, 1);
    });

    test('a parse error counts as an error', (t) => {
        assert.equal(runLint(t, { results: parseError }).status, 1);
    });

    test('ESLint missing or throwing: exit 2, never 0', (t) => {
        const missing = runLint(t, { eslintModule: "throw new Error('Cannot find module');" });
        assert.equal(missing.status, 2);
        assert.match(missing.err, /ESLint is not installed/);
        const broken = runLint(t, {
            eslintModule: 'class ESLint { async lintFiles() { throw new Error("config error"); } } module.exports = { ESLint };'
        });
        assert.equal(broken.status, 2);
    });
});

describe('tools/lint.js with the real ESLint and the real eslint.config.js', () => {
    let eslintInstalled = true;
    try {
        require.resolve('eslint', { paths: [ROOT] });
        require.resolve('globals', { paths: [ROOT] });
    } catch {
        eslintInstalled = false;
    }

    // A tiny tree: the lint tools and config copied from the repository, a module entry that imports the file
    // that publishes updateExternalScrollbar plus one test file, and an empty electron/ file.
    function lintTree(t, code) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-real-'));
        t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
        fs.mkdirSync(path.join(dir, 'src', 'js'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'electron'));
        fs.cpSync(path.join(ROOT, 'tools'), path.join(dir, 'tools'), { recursive: true, filter: (src) => !src.includes(`${path.sep}tests`) });
        fs.copyFileSync(path.join(ROOT, 'eslint.config.js'), path.join(dir, 'eslint.config.js'));
        fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
        fs.writeFileSync(path.join(dir, 'src', 'manifest.json'), JSON.stringify({ css: [], entry: 'main.js' }));
        fs.writeFileSync(path.join(dir, 'src', 'js', 'main.js'), "import './06c-scrollbar-widget.js';\nimport './probe.js';\n");
        fs.writeFileSync(path.join(dir, 'src', 'js', '99-player.js'), '');
        fs.writeFileSync(path.join(dir, 'src', 'js', '06c-scrollbar-widget.js'), 'export function init() { window.updateExternalScrollbar = () => {}; }\n');
        fs.writeFileSync(path.join(dir, 'src', 'js', 'probe.js'), code);
        fs.writeFileSync(path.join(dir, 'electron', 'ok.js'), "'use strict';\nmodule.exports = {};\n");
        const run = spawnSync(process.execPath, [path.join(dir, 'tools', 'lint.js')], { encoding: 'utf8', cwd: dir });
        return { status: run.status, out: run.stdout + run.stderr };
    }

    test('a name that is not defined anywhere fails the lint with no-undef', (t) => {
        if (!eslintInstalled) return void t.skip('eslint or globals is not installed (npm install)');
        const run = lintTree(t, 'export const x = notDefinedAnywhere;\n');
        assert.equal(run.status, 1, run.out);
        assert.match(run.out, /no-undef/);
        assert.match(run.out, /notDefinedAnywhere/);
    });

    test('a name another module registers as a global, and a browser built-in, pass', (t) => {
        if (!eslintInstalled) return void t.skip('eslint or globals is not installed (npm install)');
        const run = lintTree(t, 'export const x = [updateExternalScrollbar, document, window];\n');
        assert.equal(run.status, 0, run.out);
        assert.match(run.out, /0 error\(s\), 0 warning\(s\)/);
    });
});

describe('lint-globals: names published as window.<name> = ...', () => {
    const parse = (code) => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });

    test('findWindowAssignments only counts plain `window.name = value`', () => {
        const found = findWindowAssignments(
            parse(`
                window.plain = 1;
                window['computed'] = 2;
                window.orAssign ||= 3;
                window.plusAssign += 4;
                other.notWindow = 5;
                window.nested.deep = 6;
                const read = window.onlyRead;
                function f() { window.insideFunction = () => {}; }
            `)
        );
        assert.deepEqual([...found].sort(), ['insideFunction', 'plain']);
    });

    test('the real repository: updateExternalScrollbar is a global, and it is the only window-published one', () => {
        assert.deepEqual(WINDOW_PUBLISHED_GLOBALS, { updateExternalScrollbar: '06c-scrollbar-widget.js' });
        const result = buildLintGlobals(ROOT);
        assert.equal(result.globals.updateExternalScrollbar, 'readonly');
        assert.equal(result.counts.fromWindowPublication, 1);
    });

    // A tiny copy of the layout buildLintGlobals needs. node_modules is linked so tools/dep-map.js finds acorn.
    function fixture(t, { imports, files }) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-globals-'));
        t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
        fs.mkdirSync(path.join(dir, 'src', 'js'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'tools'));
        fs.copyFileSync(path.join(ROOT, 'tools', 'dep-map.js'), path.join(dir, 'tools', 'dep-map.js'));
        fs.cpSync(path.join(ROOT, 'tools', 'lib'), path.join(dir, 'tools', 'lib'), { recursive: true });
        fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
        fs.writeFileSync(path.join(dir, 'src', 'manifest.json'), JSON.stringify({ css: [], entry: 'main.js' }));
        fs.writeFileSync(path.join(dir, 'src', 'js', 'main.js'), imports.map((name) => `import './${name}';\n`).join(''));
        fs.writeFileSync(path.join(dir, 'src', 'js', '99-player.js'), '');
        for (const [name, code] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'src', 'js', name), code);
        return dir;
    }

    test('the publishing file is accepted, and window.* assignments elsewhere add no global', (t) => {
        const dir = fixture(t, {
            imports: ['06c-scrollbar-widget.js', 'b.js'],
            files: {
                '06c-scrollbar-widget.js': 'export function init() { window.updateExternalScrollbar = () => {}; window.alsoPublished = 1; }\n',
                'b.js': 'export const x = 1; window.sneaky = x; registerLegacyGlobals({ viaRegistration: x }); registerLegacyState({ viaState: [() => x] });\n'
            }
        });
        assert.deepEqual(Object.keys(buildLintGlobals(dir).globals).sort(), ['updateExternalScrollbar', 'viaRegistration', 'viaState']);
    });

    test('it fails loudly when the publishing file no longer assigns the name', (t) => {
        const dir = fixture(t, {
            imports: ['06c-scrollbar-widget.js'],
            files: { '06c-scrollbar-widget.js': "export function init() { window['updateExternalScrollbar'] = () => {}; }\n" }
        });
        assert.throws(() => buildLintGlobals(dir), /no longer contains/);
    });

    test('it fails loudly when the publishing file is not imported by the entry', (t) => {
        const dir = fixture(t, { imports: ['a.js'], files: { 'a.js': 'export const a = 1;\n' } });
        assert.throws(() => buildLintGlobals(dir), /not a scanned script/);
    });
});

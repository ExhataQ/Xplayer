// Lint tooling (no browser, no ESLint needed):
//   1. tools/lint.js exit codes: errors fail `npm run lint`, warnings fail only `--strict`, "cannot run" is 2.
//      The real script is copied next to a stand-in `eslint` module that returns canned results, so this checks
//      the script itself, not ESLint.
//   2. tools/lint-globals.js: the one name published as `window.<name> = ...` (updateExternalScrollbar) is a
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
const { tally, exitCodeFor } = require('../lint');
const { buildLintGlobals, findWindowAssignments, WINDOW_PUBLISHED_GLOBALS } = require('../lint-globals');

const msg = (severity, ruleId = 'no-undef') => ({ severity, ruleId, message: 'x' });
const file = (...messages) => ({ filePath: 'a.js', messages });

describe('lint.js tally and exit code', () => {
    test('tally counts errors, warnings and a parse error (no ruleId) as an error', () => {
        const t = tally([file(msg(2), msg(1, 'no-unused-vars')), file(msg(2, null), msg(1, 'no-unused-vars'))]);
        assert.equal(t.errors, 2);
        assert.equal(t.warnings, 2);
        assert.deepEqual(t.perRule.get('no-unused-vars'), { error: 0, warn: 2 });
        assert.deepEqual(t.perRule.get('(parse error)'), { error: 1, warn: 0 });
    });

    test('exitCodeFor: errors always fail, warnings fail only in strict mode', () => {
        assert.equal(exitCodeFor({ errors: 0, warnings: 0, strict: false }), 0);
        assert.equal(exitCodeFor({ errors: 0, warnings: 0, strict: true }), 0);
        assert.equal(exitCodeFor({ errors: 0, warnings: 5, strict: false }), 0);
        assert.equal(exitCodeFor({ errors: 0, warnings: 5, strict: true }), 1);
        assert.equal(exitCodeFor({ errors: 1, warnings: 0, strict: false }), 1);
        assert.equal(exitCodeFor({ errors: 1, warnings: 0, strict: true }), 1);
    });
});

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

    test('--summary leaves out the per-problem text', (t) => {
        assert.match(runLint(t, { results: warningsOnly }).out, /formatted problems/);
        assert.doesNotMatch(runLint(t, { results: warningsOnly, args: ['--summary'] }).out, /formatted problems/);
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
    function fixture(t, { manifest, files }) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-globals-'));
        t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
        fs.mkdirSync(path.join(dir, 'src', 'js'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'tools'));
        fs.copyFileSync(path.join(ROOT, 'tools', 'dep-map.js'), path.join(dir, 'tools', 'dep-map.js'));
        fs.cpSync(path.join(ROOT, 'tools', 'lib'), path.join(dir, 'tools', 'lib'), { recursive: true });
        fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
        fs.writeFileSync(path.join(dir, 'src', 'manifest.json'), JSON.stringify({ css: [], ...manifest }));
        fs.writeFileSync(path.join(dir, 'src', 'js', '99-player.js'), '');
        for (const [name, code] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'src', 'js', name), code);
        return dir;
    }

    test('the publishing file is accepted, and window.* assignments elsewhere add no global', (t) => {
        const dir = fixture(t, {
            manifest: { js: ['a.js'], modules: ['06c-scrollbar-widget.js', 'b.js'] },
            files: {
                'a.js': 'function declaredInClassic() {}\n',
                '06c-scrollbar-widget.js': 'export function init() { window.updateExternalScrollbar = () => {}; window.alsoPublished = 1; }\n',
                'b.js': 'export const x = 1; window.sneaky = x;\n'
            }
        });
        assert.deepEqual(Object.keys(buildLintGlobals(dir).globals).sort(), ['declaredInClassic', 'updateExternalScrollbar']);
    });

    test('it fails loudly when the publishing file no longer assigns the name', (t) => {
        const dir = fixture(t, {
            manifest: { js: [], modules: ['06c-scrollbar-widget.js'] },
            files: { '06c-scrollbar-widget.js': "export function init() { window['updateExternalScrollbar'] = () => {}; }\n" }
        });
        assert.throws(() => buildLintGlobals(dir), /no longer contains/);
    });

    test('it fails loudly when the publishing file is not in the manifest', (t) => {
        const dir = fixture(t, { manifest: { js: ['a.js'], modules: [] }, files: { 'a.js': 'window.updateExternalScrollbar = () => {};\n' } });
        assert.throws(() => buildLintGlobals(dir), /not a scanned script/);
    });
});

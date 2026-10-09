#!/usr/bin/env node
'use strict';

// Test runner: picks which tools/tests/*.test.js files to run. Not itself a test (no .test.js suffix).
//
//   node tools/tests/run.js                 every test file            (npm test)
//   node tools/tests/run.js unit            only files that need no browser   (npm run test:unit)
//   node tools/tests/run.js browser         only files that start a browser   (npm run test:browser)
//   node tools/tests/run.js shuffle scroll  files whose name contains one of the words
//   node tools/tests/run.js --list          show what would run, change nothing  (npm run test:list)
//   node tools/tests/run.js --timing        run files one by one and print seconds per file (npm run test:timing)
//   node tools/tests/run.js --concurrency=2 run that many files at once (default 1, same as before)
//   node tools/tests/run.js -- --test-name-pattern="lock"   everything after -- goes to `node --test`
//
// A file counts as a "browser" file if it uses helpers/app-fixture or helpers/sequence-suite or requires playwright.
// Files are passed to node explicitly, so no shell has to expand a * pattern (PowerShell and cmd do not).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const DIR = __dirname;
const ROOT = path.resolve(DIR, '..', '..');
const BROWSER_MARKER = /app-fixture|sequence-suite|require\(['"]playwright['"]\)/;
const TEST_TIMEOUT_MS = 120000;

function discover() {
    return fs
        .readdirSync(DIR)
        .filter((f) => f.endsWith('.test.js'))
        .sort()
        .map((file) => ({ file, full: path.join(DIR, file), kind: BROWSER_MARKER.test(fs.readFileSync(path.join(DIR, file), 'utf8')) ? 'browser' : 'unit' }));
}

function parseArgs(argv) {
    const cut = argv.indexOf('--');
    const own = cut >= 0 ? argv.slice(0, cut) : argv;
    const opts = { group: 'all', list: false, timing: false, concurrency: 1, words: [], passthrough: cut >= 0 ? argv.slice(cut + 1) : [] };
    for (const a of own) {
        if (a === '--list') opts.list = true;
        else if (a === '--timing') opts.timing = true;
        else if (a.startsWith('--concurrency=')) opts.concurrency = Math.max(1, Number(a.split('=')[1]) || 1);
        else if (['all', 'unit', 'browser'].includes(a)) opts.group = a;
        else if (a.startsWith('-')) throw new Error(`Unknown option ${a} (put options for node --test after --)`);
        else opts.words.push(a);
    }
    return opts;
}

function select(all, opts) {
    let files = all.filter((f) => opts.group === 'all' || f.kind === opts.group);
    if (opts.words.length) {
        files = files.filter((f) => opts.words.some((w) => f.file.includes(w.replace(/\.test\.js$/, ''))));
        if (!files.length) throw new Error(`No test file matches: ${opts.words.join(', ')}`);
    }
    return files;
}

function tapCounts(text) {
    const n = (name) => Number((text.match(new RegExp(`^# ${name} (\\d+)`, 'm')) || [])[1] || 0);
    return { tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped') };
}

function runTiming(files, extra) {
    const rows = [];
    for (const f of files) {
        const started = Date.now();
        const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-timeout=${TEST_TIMEOUT_MS}`, ...extra, f.full], { cwd: path.join(ROOT, 'electron'), encoding: 'utf8', maxBuffer: 1 << 28 });
        rows.push({ ...f, seconds: (Date.now() - started) / 1000, status: r.status, ...tapCounts(r.stdout || '') });
    }
    rows.sort((a, b) => b.seconds - a.seconds);
    console.log('seconds  kind     tests pass fail skip  file');
    for (const r of rows) console.log(`${r.seconds.toFixed(1).padStart(7)}  ${r.kind.padEnd(7)}  ${String(r.tests).padStart(5)} ${String(r.pass).padStart(4)} ${String(r.fail).padStart(4)} ${String(r.skipped).padStart(4)}  ${r.file}${r.status ? '   <-- exit ' + r.status : ''}`);
    const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
    console.log(`${sum('seconds').toFixed(1).padStart(7)}  total    ${String(sum('tests')).padStart(5)} ${String(sum('pass')).padStart(4)} ${String(sum('fail')).padStart(4)} ${String(sum('skipped')).padStart(4)}  ${rows.length} files`);
    return rows.some((r) => r.status !== 0) ? 1 : 0;
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    const files = select(discover(), opts);
    if (opts.list) {
        for (const f of files) console.log(`${f.kind.padEnd(8)}${f.file}`);
        console.log(`${files.length} file(s): ${files.filter((f) => f.kind === 'unit').length} unit, ${files.filter((f) => f.kind === 'browser').length} browser`);
        return;
    }
    if (opts.timing) return void process.exit(runTiming(files, opts.passthrough));

    // One id for the whole run: browser files share what the first one learned about which browser works.
    const runId = `${process.pid}-${Date.now()}`;
    const child = spawn(
        process.execPath,
        ['--test', `--test-concurrency=${opts.concurrency}`, `--test-timeout=${TEST_TIMEOUT_MS}`, ...opts.passthrough, ...files.map((f) => f.full)],
        { cwd: path.join(ROOT, 'electron'), stdio: 'inherit', env: { ...process.env, XPLAYER_TEST_RUN_ID: runId } }
    );
    child.on('exit', (code, signal) => {
        fs.rmSync(path.join(os.tmpdir(), `xplayer-browser-${runId}.json`), { force: true });
        process.exit(signal ? 1 : code);
    });
}

try {
    main();
} catch (e) {
    console.error(e.message);
    process.exit(2);
}

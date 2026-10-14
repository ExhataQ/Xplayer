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
//   node tools/tests/run.js browser --concurrency=4   what `npm run test:fast` runs
//   node tools/tests/run.js browser --shard=2/3       the second of three disjoint parts of the selection (CI uses this)
//   node tools/tests/run.js -- --test-name-pattern="lock"   everything after -- goes to `node --test`
//
// A file counts as a "browser" file if it uses helpers/app-fixture or helpers/sequence-suite or requires playwright.
// Files are passed to node explicitly, so no shell has to expand a * pattern (PowerShell and cmd do not).
//
// Shards: --shard=i/n keeps one of n parts of the selected files. Over i = 1..n every selected file is in exactly one
// part. The files are spread by an approximate run time (SHARD_SECONDS) so the parts take about equally long; a
// file missing from that table, or a wrong number in it, only makes the parts uneven, it never skips a file.
//
// Several files at once (--concurrency above 1): each sequence suite then uses one page unless SEQUENCE_PAGES is set,
// because the files already share the machine between them. The browser files are timing sensitive and need spare
// cores, so never more files run at once than the machine has cores (see effectiveConcurrency); the runner says
// so when it lowers the number.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const DIR = __dirname;
const ROOT = path.resolve(DIR, '..', '..');
const BROWSER_MARKER = /app-fixture|sequence-suite|require\(['"]playwright['"]\)/;
const TEST_TIMEOUT_MS = 120000;

// How many files may run at once: what was asked for, but not more than the machine has cores. On a machine with
// fewer cores than files, the files slow each other down so much that timing-sensitive tests fail (measured:
// four files on one core made events-b, events-c and scroll fail).
function effectiveConcurrency(requested, cores = os.cpus().length) {
    return Math.max(1, Math.min(requested, Math.max(1, cores)));
}

// Approximate seconds per file from `npm run test:timing`, used only to balance shards. Files not listed count as DEFAULT_SECONDS.
const DEFAULT_SECONDS = 3;
const SHARD_SECONDS = {
    'scroll.test.js': 56,
    'events-wiring.test.js': 39,
    'events-b.test.js': 38,
    'events-c.test.js': 33,
    'drag-drop.test.js': 19,
    'ui-handlers.test.js': 19,
    'legacy-bridge.test.js': 18,
    'lyrics-panel-handlers.test.js': 18,
    'ui-storage-api.test.js': 16,
    'metadata-editor.test.js': 15,
    'playback-handlers.test.js': 13,
    'view-switch-song-list-cleanup.test.js': 13,
    'keyboard-shortcuts.test.js': 9,
    'search-ui.test.js': 9,
    'context-menu.test.js': 8,
    'playback-modules.test.js': 8,
    'player-bar.test.js': 8,
    'events-a.test.js': 7,
    'startup-gate.test.js': 6,
    'ui-leaf-modules.test.js': 6,
    'songs-store.test.js': 5
};

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
    const opts = { group: 'all', list: false, timing: false, concurrency: 1, shard: null, words: [], passthrough: cut >= 0 ? argv.slice(cut + 1) : [] };
    for (const a of own) {
        if (a === '--list') opts.list = true;
        else if (a === '--timing') opts.timing = true;
        else if (a.startsWith('--concurrency=')) opts.concurrency = Math.max(1, Number(a.split('=')[1]) || 1);
        else if (a.startsWith('--shard=')) {
            const m = /^--shard=(\d+)\/(\d+)$/.exec(a);
            if (!m || Number(m[1]) < 1 || Number(m[2]) < 1 || Number(m[1]) > Number(m[2])) throw new Error(`Bad ${a}: use --shard=i/n with 1 <= i <= n, for example --shard=2/3`);
            opts.shard = { index: Number(m[1]), count: Number(m[2]) };
        }
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
    if (opts.shard) files = shardFiles(files, opts.shard.index, opts.shard.count);
    return files;
}

// Part `index` (1-based) of `count` of the files. Heaviest files first, each onto the part with the least work so far;
// ties go to the lower part and names are sorted, so the split is the same on every machine and every run.
function shardFiles(files, index, count, seconds = SHARD_SECONDS) {
    const weight = (f) => (f.file in seconds ? seconds[f.file] : DEFAULT_SECONDS);
    const order = files.slice().sort((a, b) => weight(b) - weight(a) || a.file.localeCompare(b.file));
    const load = new Array(count).fill(0);
    const mine = [];
    for (const f of order) {
        let part = 0;
        for (let i = 1; i < count; i++) if (load[i] < load[part]) part = i;
        load[part] += weight(f);
        if (part === index - 1) mine.push(f);
    }
    return mine.sort((a, b) => a.file.localeCompare(b.file));
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
    if (!files.length) throw new Error('No test files selected (an empty shard?).'); // node --test without files would run something else
    if (opts.timing) return void process.exit(runTiming(files, opts.passthrough));

    // One id for the whole run: browser files share what the first one learned about which browser works.
    const runId = `${process.pid}-${Date.now()}`;
    const env = { ...process.env, XPLAYER_TEST_RUN_ID: runId };
    const concurrency = effectiveConcurrency(opts.concurrency);
    if (concurrency < opts.concurrency) console.error(`Running ${concurrency} file(s) at once instead of ${opts.concurrency}: this machine has ${os.cpus().length} core(s) and the browser tests need spare cores.`);
    if (concurrency > 1 && !env.SEQUENCE_PAGES) env.SEQUENCE_PAGES = '1';
    const child = spawn(
        process.execPath,
        ['--test', `--test-concurrency=${concurrency}`, `--test-timeout=${TEST_TIMEOUT_MS}`, ...opts.passthrough, ...files.map((f) => f.full)],
        { cwd: path.join(ROOT, 'electron'), stdio: 'inherit', env }
    );
    child.on('exit', (code, signal) => {
        fs.rmSync(path.join(os.tmpdir(), `xplayer-browser-${runId}.json`), { force: true });
        process.exit(signal ? 1 : code);
    });
}

if (require.main === module) {
    try {
        main();
    } catch (e) {
        console.error(e.message);
        process.exit(2);
    }
}

module.exports = { discover, parseArgs, select, shardFiles, effectiveConcurrency, SHARD_SECONDS, DEFAULT_SECONDS };

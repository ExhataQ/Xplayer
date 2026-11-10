// Task X1: the memory and disk read-out that "Copy diagnostics" appends (electron/memory-report.js).
//
// Run:   node --test tools/tests/memory-report.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const { collect, formatMemoryReport } = require(path.join(ROOT, 'electron', 'memory-report.js'));
const { buildDiagnostics } = require(path.join(ROOT, 'electron', 'app-info.js'));

const METRICS = [
    { pid: 1, type: 'Browser', memory: { workingSetSize: 143360, privateBytes: 90112 }, cpu: { percentCPUUsage: 0.4 } },
    { pid: 2, type: 'Tab', memory: { workingSetSize: 307200, privateBytes: 250000 }, cpu: { percentCPUUsage: 1.25 } },
    { pid: 3, type: 'GPU', memory: { workingSetSize: 92160 }, cpu: { percentCPUUsage: 0 } },
    { pid: 4, type: 'Utility', name: 'Network Service', memory: { workingSetSize: 20480 } }
];
const PAGES = [{ pid: 2, file: 'index.html', heap: { used: 100663296, total: 146800640, nodes: 5230, images: 41 } }];

describe('formatMemoryReport', () => {
    const text = formatMemoryReport({ metrics: METRICS, pages: PAGES, mainMemory: { heapUsed: 31457280, external: 4194304, arrayBuffers: 2097152 }, songsFileBytes: 2516582, covers: { files: 1830, bytes: 325058560 }, uptimeSeconds: 11520 });

    test('lists each process in MB, the total, the page heap and the disk sizes', () => {
        assert.match(text, /Total: 550 MB in 4 processes/);
        assert.match(text, /Browser: 140 MB, private 88, CPU 0\.4%/);
        assert.match(text, /Page index\.html: 300 MB, private 244, CPU 1\.3%; JS heap 96 of 140, 5230 DOM nodes, 41 images/);
        assert.match(text, /GPU: 90 MB/);
        assert.match(text, /Utility \(Network Service\): 20 MB/);
        assert.match(text, /Main process JS: heap 30, external 4, buffers 2/);
        assert.match(text, /songs list file: 2\.4 MB/);
        assert.match(text, /covers: 1830 files, 310 MB/);
        assert.match(text, /Running for: 3 h 12 min/);
    });

    test('a page that did not answer still shows its memory, and missing numbers never print undefined or NaN', () => {
        const partial = formatMemoryReport({ metrics: [{ pid: 2, type: 'Tab', memory: { workingSetSize: 1024 } }], pages: [{ pid: 2, file: 'ai.html', heap: null }] });
        assert.match(partial, /Page ai\.html: 1 MB/);
        assert.doesNotMatch(partial, /undefined|NaN/);
        assert.doesNotMatch(formatMemoryReport({}), /undefined|NaN/);
    });
});

describe('collect', () => {
    function library() {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memrep-'));
        fs.mkdirSync(path.join(dir, 'covers'));
        fs.writeFileSync(path.join(dir, 'songs.json'), 'x'.repeat(2048));
        fs.writeFileSync(path.join(dir, 'covers', 'a.jpg'), 'x'.repeat(1000));
        fs.writeFileSync(path.join(dir, 'covers', 'b.jpg'), 'x'.repeat(500));
        return dir;
    }

    test('reads the metrics, the page answers, and the sizes of the songs file and covers folder', async () => {
        const dir = library();
        const data = await collect({
            app: { getAppMetrics: () => METRICS },
            pages: [{ pid: 2, file: 'index.html', ask: async () => PAGES[0].heap }],
            dirs: { library: dir },
            startedAt: 1000, now: 61000
        });
        assert.equal(data.metrics.length, 4);
        assert.equal(data.pages[0].heap.nodes, 5230);
        assert.equal(data.songsFileBytes, 2048);
        assert.deepEqual(data.covers, { bytes: 1500, files: 2 });
        assert.equal(data.uptimeSeconds, 60);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('a page that throws or never answers does not stop the report, and a missing folder is zero', async () => {
        const started = Date.now();
        const data = await collect({
            app: { getAppMetrics: () => METRICS },
            pages: [{ pid: 2, file: 'a.html', ask: () => Promise.reject(new Error('gone')) }, { pid: 9, file: 'b.html', ask: () => new Promise(() => {}) }],
            dirs: { library: path.join(os.tmpdir(), 'no-such-folder-xplayer') }
        });
        assert.equal(data.pages[0].heap, null);
        assert.equal(data.pages[1].heap, null);
        assert.deepEqual(data.covers, { bytes: 0, files: 0 });
        assert.equal(data.songsFileBytes, 0);
        assert.ok(Date.now() - started < 4000, 'the wait for a silent page is limited');
    });

    test('an app without getAppMetrics gives an empty list instead of an error', async () => {
        const data = await collect({ app: {}, pages: [], dirs: {} });
        assert.deepEqual(data.metrics, []);
    });
});

describe('where it goes', () => {
    test('buildDiagnostics puts the memory block before the log lines, and leaves it out when there is none', () => {
        const info = { version: '1', electron: '2', mode: 'dev', dataDir: '/d' };
        const withMemory = buildDiagnostics({ info, tail: ['a line'], memory: 'Memory (MB)\n  Total: 5 MB', chrome: '1', node: '2' });
        assert.ok(withMemory.indexOf('Memory (MB)') > withMemory.indexOf('Data folder') && withMemory.indexOf('Memory (MB)') < withMemory.indexOf('Last log lines:'));
        assert.doesNotMatch(buildDiagnostics({ info, tail: [], chrome: '1', node: '2' }), /Memory/);
    });

    test('the copy-diagnostics handler reads the numbers inside a try, so a failure cannot stop the copy', () => {
        const main = fs.readFileSync(path.join(ROOT, 'electron', 'main.js'), 'utf8').replace(/\r\n/g, '\n');
        const handler = main.slice(main.indexOf("ipcMain.handle('copy-diagnostics'"), main.indexOf('// Pages ask for covers/<file>'));
        assert.match(handler, /try \{[\s\S]*formatMemoryReport\(await readMemoryData\(\)\)[\s\S]*\} catch/);
        assert.match(handler, /clipboard\.writeText\(appInfo\.buildDiagnostics\(\{.*memory \}\)\)/);
        assert.doesNotMatch(main, /getTitle\(\)/); // window titles can hold a song name: a window is named by its file name only
        assert.match(main, /file: path\.basename\(/);
    });
});

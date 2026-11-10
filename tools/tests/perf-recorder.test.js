// Task X2: the memory recording (electron/perf-recorder.js) and its buttons in Settings > About.
//
// Run:   node --test tools/tests/perf-recorder.test.js
// Needs: playwright and a browser for the last part (it skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');
const { createRecorder, rowFromData, summarize, COLUMNS } = require(path.join(ROOT, 'electron', 'perf-recorder.js'));

const DATA = {
    metrics: [
        { pid: 1, type: 'Browser', memory: { workingSetSize: 143360 }, cpu: { percentCPUUsage: 0.5 } },
        { pid: 2, type: 'Tab', memory: { workingSetSize: 307200 }, cpu: { percentCPUUsage: 1.5 } },
        { pid: 3, type: 'GPU', memory: { workingSetSize: 92160 }, cpu: { percentCPUUsage: 0 } },
        { pid: 4, type: 'Utility', memory: { workingSetSize: 20480 } }
    ],
    pages: [{ pid: 2, file: 'index.html', heap: { used: 100663296, total: 146800640, nodes: 5230, images: 41, view: 'library', playing: 1 } }],
    uptimeSeconds: 90
};
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'perf-'));

describe('rowFromData', () => {
    test('one line with the columns in order: totals per kind of process, the heap, the view, playing', () => {
        const cells = rowFromData(DATA, new Date('2026-11-09T10:00:00Z')).split(',');
        assert.equal(cells.length, COLUMNS.length);
        const row = Object.fromEntries(COLUMNS.map((name, i) => [name, cells[i]]));
        assert.deepEqual(row, { time: '2026-11-09T10:00:00.000Z', uptime_s: '90', total_mb: '550', main_mb: '140', pages_mb: '300', gpu_mb: '90', other_mb: '20', cpu_pct: '2.0', heap_mb: '96', dom_nodes: '5230', images: '41', view: 'library', playing: '1', windows: '1' });
    });

    test('a view name is cut down to plain letters, so a page cannot put anything else in the file', () => {
        const data = { metrics: [], pages: [{ heap: { view: 'li,brary\n"x"<b>', used: 0, nodes: 0, images: 0 } }] };
        const cells = rowFromData(data).split(',');
        assert.equal(cells.length, COLUMNS.length);
        assert.equal(cells[COLUMNS.indexOf('view')], 'libraryxb');
    });

    test('empty data gives zeros, never undefined or NaN', () => {
        assert.doesNotMatch(rowFromData({}), /undefined|NaN/);
    });
});

describe('createRecorder', () => {
    function fakeTimers() {
        const t = { fn: null, set: (fn) => { t.fn = fn; return { unref() {} }; }, clear: () => { t.fn = null; } };
        return t;
    }

    test('start writes the header and a first line at once; each tick adds one line; stop ends it', async () => {
        const dir = temp();
        const timers = fakeTimers();
        const rec = createRecorder({ read: async () => DATA, dir, timers });
        assert.equal(rec.isRunning(), false);
        const first = rec.start();
        rec.start(); // a second start changes nothing
        assert.equal(rec.isRunning(), true);
        await first; // the first line
        await timers.fn();
        const lines = fs.readFileSync(rec.file, 'utf8').trim().split('\n');
        assert.equal(lines[0], COLUMNS.join(','));
        assert.ok(lines.length >= 3, `${lines.length} lines`);
        rec.stop();
        assert.equal(rec.isRunning(), false);
        assert.equal(timers.fn, null, 'the timer is cleared');
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('a read that throws is logged and the recording goes on; two samples never overlap', async () => {
        const dir = temp();
        const logs = [];
        let calls = 0;
        let release;
        const rec = createRecorder({ read: () => { calls++; if (calls === 1) throw new Error('window gone'); return new Promise((r) => { release = () => r(DATA); }); }, dir, timers: fakeTimers(), log: (m) => logs.push(m) });
        await rec.sample();
        assert.match(logs[0], /window gone/);
        const slow = rec.sample();
        await rec.sample(); // returns at once: one is already running
        assert.equal(calls, 2);
        release();
        await slow;
        assert.equal(fs.readFileSync(rec.file, 'utf8').trim().split('\n').length, 2); // header + one line
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('the file is rotated when it is over the limit, and the new one starts with the header', async () => {
        const dir = temp();
        const rec = createRecorder({ read: async () => DATA, dir, maxBytes: 300, timers: fakeTimers() });
        for (let i = 0; i < 6; i++) await rec.sample();
        assert.ok(fs.existsSync(path.join(dir, 'perf.1.csv')));
        assert.equal(fs.readFileSync(rec.file, 'utf8').split('\n')[0], COLUMNS.join(','));
        assert.ok(fs.statSync(rec.file).size < 1200);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('the timer does not keep the app alive (it is unref-ed)', () => {
        let unref = false;
        const rec = createRecorder({ read: async () => DATA, dir: temp(), timers: { set: () => ({ unref() { unref = true; } }), clear() {} } });
        rec.start();
        assert.equal(unref, true);
        rec.stop();
    });
});

describe('summarize', () => {
    const csv = [COLUMNS.join(','),
        '2026-11-09T10:00:00.000Z,10,500,140,260,80,20,2.0,90,5000,40,library,0,1',
        '2026-11-09T11:00:00.000Z,3610,560,141,300,85,34,4.0,100,5600,44,settings,1,1',
        '2026-11-09T12:00:00.000Z,7210,620,142,350,90,38,3.0,110,6000,50,library,1,1'].join('\n') + '\n';

    test('first, last and highest total, the change per hour, CPU, playing share and the views seen', () => {
        const text = summarize(csv);
        assert.match(text, /3 samples over 2 h 0 min/);
        assert.match(text, /Total memory: first 500 MB, last 620 MB, highest 620 MB/);
        assert.match(text, /Change: \+120 MB over the recording, about 60 MB per hour/);
        assert.match(text, /CPU: average 3\.0%, highest 4\.0%/);
        assert.match(text, /Playing in 67% of the samples/);
        assert.match(text, /library 2, settings 1/);
        assert.match(text, /DOM nodes: first 5000, last 6000/);
    });

    test('an empty or missing file says so; bad lines are skipped', () => {
        assert.match(summarize(''), /no samples yet/);
        assert.match(summarize(COLUMNS.join(',') + '\nnot,a,row\n'), /no samples yet/);
    });
});

describe('wiring', () => {
    const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n');

    test('main.js: off at start unless XPLAYER_PERF=1; the handlers answer a boolean only; logs folder; the summary goes to the clipboard', () => {
        const main = read('electron', 'main.js');
        assert.match(main, /if \(process\.env\.XPLAYER_PERF === '1'\) perfRecorder\.start\(\);/);
        assert.match(main, /ipcMain\.handle\('perf-record', \(event, enable\) => \{\s*if \(enable === true\) perfRecorder\.start\(\);\s*else if \(enable === false\) perfRecorder\.stop\(\);/);
        assert.match(main, /dir: path\.join\(appPaths\.getDataDir\(\), 'logs'\)/);
        assert.match(main, /clipboard\.writeText\(text\)/);
        assert.match(read('electron', 'preload.js'), /perfRecording: \(enable\) => ipcRenderer\.invoke\('perf-record', enable\)/);
    });
});

const pw = loadPlaywright();
describe('the buttons in Settings > About', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = buildApp(10);
        fs.cpSync(path.join(ROOT, 'src', 'ui-next'), path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = '<script>window.electronAPI = new Proxy({}, {get:(t,k)=>(k==="then"?undefined:(...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null))});</script>\n';
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('Start recording becomes Stop recording and back; Copy summary says Copied; without the desktop app both are disabled', { timeout: 40000 }, async (t) => {
        if (skip) return t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        const result = await page.evaluate(async () => {
            const { buildAboutSection } = await import(new URL('ui-next/shell/about-settings.js', document.baseURI).href);
            const q = (root, name) => root.querySelector(`[data-action-local="${name}"]`);
            // 1. no desktop app
            window.desktopApi = null;
            const bare = buildAboutSection();
            const disabled = [q(bare, 'perf-record').disabled, q(bare, 'perf-summary').disabled];
            // 2. a stand-in desktop app
            let recording = false;
            const calls = [];
            window.desktopApi = {
                supports: () => true,
                app: {
                    getAppInfo: async () => ({ version: '1', electron: '2', mode: 'dev', dataDir: '/d' }),
                    perfRecording: async (enable) => { calls.push(enable); if (typeof enable === 'boolean') recording = enable; return { success: true, recording }; },
                    copyPerfSummary: async () => ({ success: true }),
                    openDataFolder: async () => ({}), copyDiagnostics: async () => ({ success: true })
                }
            };
            const section = buildAboutSection();
            document.body.append(section);
            const toggle = q(section, 'perf-record');
            const summary = q(section, 'perf-summary');
            const wait = () => new Promise((r) => setTimeout(r, 30));
            await wait();
            const labels = [toggle.textContent];
            toggle.click(); await wait(); labels.push(toggle.textContent, toggle.getAttribute('aria-pressed'));
            toggle.click(); await wait(); labels.push(toggle.textContent, toggle.getAttribute('aria-pressed'));
            summary.click(); await wait(); labels.push(summary.textContent);
            section.remove();
            return { disabled, labels, calls };
        });
        assert.deepEqual(result.disabled, [true, true]);
        assert.deepEqual(result.labels, ['Start recording', 'Stop recording', 'true', 'Start recording', 'false', 'Copied']);
        assert.deepEqual(result.calls, [undefined, true, false]);
        await page.close();
    });
});

// A recording of memory use while the owner works with the app (task X2 of .agent/REAL-APP-CHECK-PLAN.md). Off until it is switched on in
// Settings > About (or XPLAYER_PERF=1 at start-up); it is off again every time the app starts otherwise. While on, one line is added every
// 30 seconds to <data folder>/logs/perf.csv: numbers only (memory per kind of process, the page's JS heap, DOM nodes, images, CPU, and the
// name of the open view). Nothing leaves the computer; the file is rotated at 2 MB.
//
//   createRecorder({ read, dir, intervalMs, maxBytes, log, timers, now })
//       read()  async, gives the data of memory-report.collect()
//       -> { start(), stop(), isRunning(), file, summary(), sample() }
//   rowFromData(data, now)  one CSV line from that data (pure)
//   summarize(csvText)      the text "Copy recording summary" puts on the clipboard (pure)

const fs = require('fs');
const path = require('path');

const FILE_NAME = 'perf.csv';
const COLUMNS = ['time', 'uptime_s', 'total_mb', 'main_mb', 'pages_mb', 'gpu_mb', 'other_mb', 'cpu_pct', 'heap_mb', 'dom_nodes', 'images', 'view', 'playing', 'windows'];
const INTERVAL_MS = 30000;
const MAX_BYTES = 2 * 1024 * 1024;

const mb = (kb) => Math.round((kb || 0) / 1024);

function rowFromData(data, now = new Date()) {
    const sum = { main: 0, pages: 0, gpu: 0, other: 0, cpu: 0 };
    for (const m of data.metrics || []) {
        const size = mb(m.memory && m.memory.workingSetSize);
        if (m.type === 'Browser') sum.main += size;
        else if (m.type === 'Tab') sum.pages += size;
        else if (m.type === 'GPU') sum.gpu += size;
        else sum.other += size;
        if (m.cpu && typeof m.cpu.percentCPUUsage === 'number') sum.cpu += m.cpu.percentCPUUsage;
    }
    const pages = (data.pages || []).map((p) => p.heap).filter(Boolean);
    const total = (n) => pages.reduce((s, h) => s + (Number(h[n]) || 0), 0);
    // The view is taken from the first window that answered with one (the main window).
    const view = String((pages.find((h) => h.view) || {}).view || '').replace(/[^\w-]/g, '').slice(0, 24);
    const values = [
        now.toISOString(), data.uptimeSeconds || 0, sum.main + sum.pages + sum.gpu + sum.other, sum.main, sum.pages, sum.gpu, sum.other,
        sum.cpu.toFixed(1), Math.round(total('used') / 1048576), total('nodes'), total('images'), view, pages.some((h) => h.playing) ? 1 : 0, (data.pages || []).length
    ];
    return values.join(',');
}

function createRecorder({ read, dir, intervalMs = INTERVAL_MS, maxBytes = MAX_BYTES, log = () => {}, timers = { set: setInterval, clear: clearInterval }, now = () => new Date() }) {
    const file = path.join(dir, FILE_NAME);
    let handle = null;
    let busy = false;

    async function append(line) {
        await fs.promises.mkdir(dir, { recursive: true });
        let size = 0;
        try { size = (await fs.promises.stat(file)).size; } catch { /* first line */ }
        if (size > maxBytes) {
            try { await fs.promises.rename(file, path.join(dir, 'perf.1.csv')); } catch { /* keep going */ }
            size = 0;
        }
        await fs.promises.appendFile(file, (size === 0 ? COLUMNS.join(',') + '\n' : '') + line + '\n');
    }

    // One sample. A slow or failing read never stops the recording and never runs twice at once.
    async function sample() {
        if (busy) return;
        busy = true;
        try {
            await append(rowFromData(await read(), now()));
        } catch (error) {
            log('perf recording: a sample failed: ' + ((error && error.message) || error));
        } finally {
            busy = false;
        }
    }

    return {
        file,
        isRunning: () => handle !== null,
        start() {
            if (handle !== null) return;
            handle = timers.set(sample, intervalMs);
            if (handle && typeof handle.unref === 'function') handle.unref(); // a recording alone never keeps the app alive
            return sample(); // the first line now; the caller does not have to wait for it
        },
        stop() {
            if (handle === null) return;
            timers.clear(handle);
            handle = null;
        },
        async summary() {
            let text = '';
            try { text = await fs.promises.readFile(file, 'utf8'); } catch { /* none yet */ }
            return summarize(text);
        },
        sample
    };
}

function summarize(csvText) {
    const lines = String(csvText || '').split(/\r?\n/).filter(Boolean);
    const rows = lines.slice(1).map((line) => {
        const cells = line.split(',');
        const row = {};
        COLUMNS.forEach((name, i) => { row[name] = cells[i]; });
        return row;
    }).filter((row) => Date.parse(row.time));
    if (!rows.length) return 'Memory recording: no samples yet.';
    const num = (row, name) => Number(row[name]) || 0;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const spanMin = Math.max(0, Math.round((Date.parse(last.time) - Date.parse(first.time)) / 60000));
    const hours = Math.max(spanMin / 60, 1 / 60);
    const peak = (name) => Math.max(...rows.map((r) => num(r, name)));
    const avg = (name) => rows.reduce((s, r) => s + num(r, name), 0) / rows.length;
    const playingShare = Math.round((100 * rows.filter((r) => r.playing === '1').length) / rows.length);
    const views = {};
    for (const row of rows) if (row.view) views[row.view] = (views[row.view] || 0) + 1;
    const grown = num(last, 'total_mb') - num(first, 'total_mb');
    return [
        'Memory recording',
        `  ${rows.length} samples over ${Math.floor(spanMin / 60)} h ${spanMin % 60} min (${first.time.slice(0, 16).replace('T', ' ')} UTC to ${last.time.slice(0, 16).replace('T', ' ')} UTC)`,
        `  Total memory: first ${num(first, 'total_mb')} MB, last ${num(last, 'total_mb')} MB, highest ${peak('total_mb')} MB`,
        `  Change: ${grown >= 0 ? '+' : ''}${grown} MB over the recording, about ${(grown / hours).toFixed(0)} MB per hour`,
        `  Pages: first ${num(first, 'pages_mb')} MB, last ${num(last, 'pages_mb')} MB; graphics: first ${num(first, 'gpu_mb')} MB, last ${num(last, 'gpu_mb')} MB`,
        `  Page JS heap: first ${num(first, 'heap_mb')} MB, last ${num(last, 'heap_mb')} MB; DOM nodes: first ${num(first, 'dom_nodes')}, last ${num(last, 'dom_nodes')}; images: first ${num(first, 'images')}, last ${num(last, 'images')}`,
        `  CPU: average ${avg('cpu_pct').toFixed(1)}%, highest ${peak('cpu_pct').toFixed(1)}%`,
        `  Playing in ${playingShare}% of the samples`,
        `  Views seen (samples): ${Object.keys(views).length ? Object.entries(views).map(([v, n]) => `${v} ${n}`).join(', ') : 'unknown'}`
    ].join('\n');
}

module.exports = { createRecorder, rowFromData, summarize, FILE_NAME, COLUMNS, INTERVAL_MS };

// A memory and disk read-out for "Copy diagnostics" (task X1 of .agent/REAL-APP-CHECK-PLAN.md). It only reads: nothing here changes the app.
// The text holds sizes and counts, never a song title, a path or a window title (a page is named by its file name only).
//
//   collect({ app, pages, dirs, startedAt })   gathers the numbers (async)
//   formatMemoryReport(data)                   turns them into the lines the diagnostics text appends
//
// `pages` is a list of { pid, file, ask(code) }: one per open window. `ask` runs a short read-only script in that page and answers with its
// result (it may reject or take long: it is given a time limit here). `dirs` is { library, data }.

const fs = require('fs');
const path = require('path');

const ASK_LIMIT_MS = 1500;
// view: the name of the open view (a fixed word such as library or settings, never a song). playing: 1 when any audio element plays.
const PAGE_SCRIPT = '({ used: performance.memory ? performance.memory.usedJSHeapSize : 0, total: performance.memory ? performance.memory.totalJSHeapSize : 0, nodes: document.getElementsByTagName("*").length, images: document.images.length, view: (document.querySelector(".view-host") || {dataset: {}}).dataset.view || "", playing: Array.from(document.querySelectorAll("audio")).some(function (a) { return !a.paused; }) ? 1 : 0 })';

const mb = (bytes) => Math.round((bytes || 0) / 1048576);
const kbToMb = (kb) => Math.round((kb || 0) / 1024);

function withLimit(promise, ms) {
    let timer;
    const limit = new Promise((resolve) => { timer = setTimeout(() => resolve(null), ms); });
    return Promise.race([Promise.resolve(promise).catch(() => null), limit]).finally(() => clearTimeout(timer));
}

// Size and count of the files directly in a folder (the covers folder is flat). A missing folder is 0.
async function folderSize(dir) {
    let bytes = 0;
    let files = 0;
    try {
        for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
            if (!entry.isFile()) continue;
            try { bytes += (await fs.promises.stat(path.join(dir, entry.name))).size; files++; } catch { /* gone meanwhile */ }
        }
    } catch { /* no such folder */ }
    return { bytes, files };
}

async function fileSize(file) {
    try { return (await fs.promises.stat(file)).size; } catch { return 0; }
}

async function collect({ app, pages = [], dirs = {}, startedAt = Date.now(), now = Date.now(), mainMemory = process.memoryUsage() }) {
    const metrics = typeof app.getAppMetrics === 'function' ? app.getAppMetrics() : [];
    const pageNumbers = await Promise.all(pages.map(async (page) => ({ pid: page.pid, file: page.file, heap: await withLimit(page.ask(PAGE_SCRIPT), ASK_LIMIT_MS) })));
    const covers = dirs.library ? await folderSize(path.join(dirs.library, 'covers')) : { bytes: 0, files: 0 };
    const songs = dirs.library ? await fileSize(path.join(dirs.library, 'songs.json')) : 0;
    return { metrics, pages: pageNumbers, covers, songsFileBytes: songs, mainMemory, uptimeSeconds: Math.max(0, Math.round((now - startedAt) / 1000)) };
}

function duration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h ? `${h} h ${m} min` : `${m} min ${seconds % 60} s`;
}

function formatMemoryReport(data) {
    const metrics = data.metrics || [];
    const byPid = new Map((data.pages || []).map((page) => [page.pid, page]));
    const rows = metrics.map((m) => {
        const page = byPid.get(m.pid);
        const label = m.type === 'Tab' && page ? `Page ${page.file || '?'}` : `${m.type}${m.name ? ' (' + m.name + ')' : ''}`;
        const set = kbToMb(m.memory && m.memory.workingSetSize);
        const priv = m.memory && m.memory.privateBytes ? `, private ${kbToMb(m.memory.privateBytes)}` : '';
        const cpu = m.cpu && typeof m.cpu.percentCPUUsage === 'number' ? `, CPU ${m.cpu.percentCPUUsage.toFixed(1)}%` : '';
        let extra = '';
        if (page && page.heap) extra = `; JS heap ${mb(page.heap.used)} of ${mb(page.heap.total)}, ${page.heap.nodes} DOM nodes, ${page.heap.images} images`;
        return { set, line: `  ${label}: ${set} MB${priv}${cpu}${extra}` };
    });
    const total = rows.reduce((sum, row) => sum + row.set, 0);
    const main = data.mainMemory || {};
    const lines = [
        'Memory (MB, working set per process)',
        `  Total: ${total} MB in ${rows.length} processes`,
        ...rows.map((row) => row.line),
        `  Main process JS: heap ${mb(main.heapUsed)}, external ${mb(main.external)}, buffers ${mb(main.arrayBuffers)}`,
        '',
        'Data on disk',
        `  songs list file: ${((data.songsFileBytes || 0) / 1048576).toFixed(1)} MB`,
        `  covers: ${data.covers ? data.covers.files : 0} files, ${mb(data.covers && data.covers.bytes)} MB`,
        '',
        `Running for: ${duration(data.uptimeSeconds || 0)}`
    ];
    return lines.join('\n');
}

module.exports = { collect, formatMemoryReport, folderSize };

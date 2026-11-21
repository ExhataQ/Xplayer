// Audio files that Windows hands to Xplayer ("Open with", a double-click, or a drop on the exe).
//
// Everything here is plain Node with no Electron, so tools/tests/electron/open-files.test.js can run it:
//   audioPathsFromArgv(argv, cwd)   the audio files named on a command line
//   createBatcher({ delayMs, onBatch })   collects bursts of paths into one list
//   createPendingList()             holds paths until the page can take them
//
// Why a batcher: selecting several files in Explorer and pressing Enter starts the exe once per file.
// The first copy gets one 'second-instance' event for each, a few milliseconds apart. They belong together
// as one queue, so the paths are collected for a short moment and delivered as one list.

const path = require('path');
const fs = require('fs');
const checks = require('./ipc-checks');

// A path can arrive wrapped in quotes when a shortcut passes it that way.
function unquote(value) {
    const text = String(value).trim();
    return text.length >= 2 && text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1) : text;
}

// The audio files named on a command line. The program path, switches such as --inspect, and anything that is not
// an existing audio file are skipped, so this is safe to call with the whole of process.argv. Relative paths are
// resolved against `cwd` (a second start reports the folder it was started from). Each file is listed once, in order.
function audioPathsFromArgv(argv, cwd, { exists = fs.existsSync } = {}) {
    const found = [];
    const seen = new Set();
    for (const raw of Array.isArray(argv) ? argv : []) {
        if (typeof raw !== 'string') continue;
        const text = unquote(raw);
        if (!text || text.startsWith('--')) continue;
        const absolute = path.isAbsolute(text) ? text : cwd ? path.resolve(cwd, text) : text;
        if (!checks.isAudioPath(absolute)) continue;
        const key = absolute.toLowerCase();
        if (seen.has(key)) continue;
        let present = false;
        try {
            present = exists(absolute);
        } catch (e) {
            present = false;
        }
        if (!present) continue;
        seen.add(key);
        found.push(absolute);
    }
    return found;
}

// Collects paths added within `delayMs` of each other and hands them over once, in the order they came, without repeats.
function createBatcher({ delayMs = 250, onBatch, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    let waiting = [];
    let timer = null;

    function flush() {
        timer = null;
        const batch = waiting;
        waiting = [];
        if (batch.length > 0 && typeof onBatch === 'function') onBatch(batch);
    }

    return {
        add(paths) {
            const list = Array.isArray(paths) ? paths : [];
            if (list.length === 0) return;
            for (const item of list) {
                if (!waiting.some((have) => have.toLowerCase() === item.toLowerCase())) waiting.push(item);
            }
            if (timer) clearTimer(timer);
            timer = setTimer(flush, delayMs);
        },
        // Delivers what is waiting now (used when the app is closing, and by tests).
        flush() {
            if (timer) clearTimer(timer);
            flush();
        },
        pending: () => waiting.slice()
    };
}

// Paths that came before the page was ready. take() empties the list.
function createPendingList() {
    let list = [];
    return {
        add(paths) {
            for (const item of Array.isArray(paths) ? paths : []) {
                if (!list.some((have) => have.toLowerCase() === item.toLowerCase())) list.push(item);
            }
        },
        take() {
            const out = list;
            list = [];
            return out;
        },
        size: () => list.length
    };
}

module.exports = { audioPathsFromArgv, createBatcher, createPendingList, unquote };

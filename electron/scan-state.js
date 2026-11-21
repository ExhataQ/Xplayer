'use strict';

// One library scan at a time, and a way for the rest of the main process to know about it.
//
// A scan (rebuild, change folder, first start) used to put a modal window over the app, which also kept the person from doing anything that could
// disturb it. The scan now runs in the background, so that protection has to be explicit. A scan child writes the whole song list when its fast pass
// ends and again while it reads covers, so anything that writes the library in between (a tag save, an import, a download, another scan) would be
// overwritten. Those handlers ask isBusy() and answer busyResult() instead.
//
// A scan holds the gate from its start until its child process has ended (not until the song list has been handed to the page), and gives it
// back with release(). A gate older than STALE_MS is treated as left over by a scan that never reported its end.

const STALE_MS = 2 * 60 * 60 * 1000;

let current = null;

function isBusy(now = Date.now()) {
    if (current && now - current.since > STALE_MS) current = null;
    return current !== null;
}

function kind() {
    return current ? current.kind : null;
}

/**
 * Takes the gate. Returns null when a scan is already running, otherwise { progress(percent, step), release() }.
 * `notify(channel, payload)` sends to the page; progress is sent only when the percent or the step changed.
 */
function tryStart(scanKind, notify = () => {}, now = Date.now()) {
    if (isBusy(now)) return null;
    const mine = { kind: scanKind, since: now };
    current = mine;
    let lastPercent = -1;
    let lastStep = '';
    return {
        progress(percent, step) {
            const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
            const s = typeof step === 'string' ? step : '';
            if (p === lastPercent && s === lastStep) return;
            lastPercent = p;
            lastStep = s;
            notify('scan-progress', { kind: scanKind, percent: p, step: s });
        },
        release() {
            if (current === mine) current = null;
        }
    };
}

function busyResult() {
    return {
        success: false,
        reason: 'scan-running',
        error: 'The library is still being scanned. Wait for it to finish (or stop the album art search in Notifications), then try again.'
    };
}

module.exports = { isBusy, kind, tryStart, busyResult, STALE_MS };

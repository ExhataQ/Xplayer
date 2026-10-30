'use strict';

// PC-09: the notification for the Many songs finder. The notice logic is a plain module, so it runs here without a browser, once with
// stand-ins and once with the shell's real notify.js. The engine and wiring checks read the source.
//
// Run: node --test tools/tests/ui-next-lyrics-finder-notice.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const NEXT = path.join(ROOT, 'src', 'ui-next');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const load = (...p) => import(pathToFileURL(path.join(NEXT, ...p)).href);

function fakeShell() {
    const log = [];
    const notifyProgress = (options) => {
        const job = { options, updates: [], finished: null, dismissed: false };
        log.push(job);
        return { update: (u) => job.updates.push(u), done: (o) => (job.finished = o), dismiss: () => (job.dismissed = true) };
    };
    return { log, notifyProgress };
}

describe('createFinderNotice', () => {
    test('start, progress and end make one progress entry that ends with the counts', async () => {
        const { createFinderNotice } = await load('views', 'tools', 'lyrics-finder-notice.js');
        const { log, notifyProgress } = fakeShell();
        let stops = 0;
        let opens = 0;
        const handle = createFinderNotice({ notifyProgress, stop: () => stops++, open: () => opens++ });

        handle({ phase: 'start', mode: 'lrc', total: 4, completed: 0, found: 0 });
        handle({ phase: 'progress', mode: 'lrc', total: 4, completed: 1, found: 1, title: 'A' });
        handle({ phase: 'progress', mode: 'lrc', total: 4, completed: 2, found: 1, title: 'B' });
        handle({ phase: 'end', mode: 'lrc', total: 4, completed: 4, found: 3, stopped: false });

        assert.equal(log.length, 1);
        const job = log[0];
        assert.equal(job.options.title, 'Finding LRC for 4 songs');
        assert.equal(job.options.kind, 'job');
        assert.deepEqual(job.updates.map((u) => u.percent), [0, 25, 50]);
        assert.equal(job.updates[2].status, '2 of 4 · 1 found');
        assert.equal(job.finished.detail, 'Found LRC for 3 of 4 songs');
        assert.equal(job.finished.kind, 'success');
        assert.equal(job.finished.title, 'Search finished');

        job.options.onCancel();
        assert.equal(stops, 1);
        assert.equal(job.options.target.label, 'Open results');
        job.options.target.go();
        job.finished.target.go();
        assert.equal(opens, 2);
    });

    test('a stopped run says how many were skipped; nothing found is info, not success', async () => {
        const { createFinderNotice } = await load('views', 'tools', 'lyrics-finder-notice.js');
        const { log, notifyProgress } = fakeShell();
        const handle = createFinderNotice({ notifyProgress, stop() {}, open() {} });
        handle({ phase: 'start', mode: 'plain', total: 10 });
        handle({ phase: 'end', mode: 'plain', total: 10, completed: 4, found: 0, stopped: true });
        assert.equal(log[0].options.title, 'Finding lyrics for 10 songs');
        assert.equal(log[0].finished.title, 'Search stopped');
        assert.equal(log[0].finished.detail, 'Stopped: found lyrics for 0 of 4 songs (6 skipped)');
        assert.equal(log[0].finished.kind, 'info');
    });

    test('one song reads "1 song"; events without a start, and junk, are ignored', async () => {
        const { createFinderNotice } = await load('views', 'tools', 'lyrics-finder-notice.js');
        const { log, notifyProgress } = fakeShell();
        const handle = createFinderNotice({ notifyProgress, stop() {}, open() {} });
        handle({ phase: 'progress', total: 3, completed: 1, found: 1 });
        handle({ phase: 'end', total: 3, completed: 3, found: 3 });
        handle(null);
        handle('x');
        assert.equal(log.length, 0);
        handle({ phase: 'start', mode: 'lrc', total: 1 });
        assert.equal(log[0].options.title, 'Finding LRC for 1 song');
    });

    test('a new start dismisses a run that never ended', async () => {
        const { createFinderNotice } = await load('views', 'tools', 'lyrics-finder-notice.js');
        const { log, notifyProgress } = fakeShell();
        const handle = createFinderNotice({ notifyProgress, stop() {}, open() {} });
        handle({ phase: 'start', mode: 'lrc', total: 2 });
        handle({ phase: 'start', mode: 'lrc', total: 5 });
        assert.equal(log.length, 2);
        assert.equal(log[0].dismissed, true);
        assert.equal(log[1].dismissed, false);
    });

    test('with the shell\'s real notify.js: In progress with a bar and Cancel, then a finished entry that opens the target', async () => {
        const { createFinderNotice } = await load('views', 'tools', 'lyrics-finder-notice.js');
        const notify = await load('shell', 'notify.js');
        let seen = [];
        const off = notify.watchShellNotifications((list) => (seen = list));
        let cancelled = 0;
        let opened = 0;
        const handle = createFinderNotice({ notifyProgress: notify.notifyProgress, stop: () => cancelled++, open: () => opened++ });

        handle({ phase: 'start', mode: 'lrc', total: 8 });
        handle({ phase: 'progress', mode: 'lrc', total: 8, completed: 2, found: 2, title: 'A' });
        assert.equal(seen[0].progress.percent, 25);
        assert.equal(seen[0].progress.status, '2 of 8 · 2 found');
        notify.cancelShellNotification(seen[0].id);
        assert.equal(cancelled, 1);

        handle({ phase: 'end', mode: 'lrc', total: 8, completed: 8, found: 7, stopped: false });
        assert.equal(seen[0].progress, null);
        assert.equal(seen[0].detail, 'Found LRC for 7 of 8 songs');
        assert.equal(notify.openNotificationTarget(seen[0].target), true);
        assert.equal(opened, 1);
        off();
        notify.clearShellNotifications();
    });
});

describe('wiring', () => {
    const engine = read(ROOT, 'src', 'js', 'lyrics', '19-online-lyrics.js');
    const view = read(NEXT, 'views', 'tools', 'lyrics.js');

    test('the engine emits start, progress and end from runSmartLyricsFinder and nowhere else', () => {
        const emits = [...engine.matchAll(/emit\('smartLyrics:progress', \{ phase: '(\w+)'/g)].map((m) => m[1]);
        assert.deepEqual(emits, ['start', 'progress', 'end']);
        const run = engine.slice(engine.indexOf('export async function runSmartLyricsFinder'), engine.indexOf('export function renderSmartLyricsFinder'));
        assert.equal((run.match(/smartLyrics:progress/g) || []).length, 3);
    });

    test('the event is on engine-api\'s allow-list and in EVENTS.md', () => {
        assert.match(read(NEXT, 'adapter', 'engine-api.js'), /const EVENTS = new Set\(\[[^\]]*'smartLyrics:progress'/);
        assert.match(read(ROOT, 'src', 'js', 'core', 'EVENTS.md'), /\| `smartLyrics:progress` \|/);
    });

    test('the view subscribes once and outside the mode bar\'s stop(), so the notice survives leaving Lyrics', () => {
        assert.match(view, /engineEvent\('smartLyrics:progress', createFinderNotice\(/);
        assert.match(view, /if \(finderWatch\) return;/);
        const mount = view.slice(view.indexOf('export function mountLyricsModes'));
        assert.match(mount, /watchFinder\(\);\s*stop\(\);/);
        assert.doesNotMatch(view.slice(view.lastIndexOf('stop = () => {'), view.indexOf('host.prepend(bar)')), /finderWatch/);
    });

    test('the click shows the finder page without starting a run (openSmartLyricsFinder clears the results)', () => {
        const watch = view.slice(view.indexOf('function watchFinder'), view.indexOf('// Closes whichever editor'));
        assert.match(watch, /engineAction\('switchView', 'smart-lyrics'\)/);
        assert.match(watch, /engineAction\('stopSmartLyricsFinder'\)/);
        assert.doesNotMatch(watch, /openSmartLyricsFinder/);
    });

    test('no new adapter file and the view still keeps away from engine globals (gate 13)', () => {
        assert.doesNotMatch(view, /\bwindow\b|document\.|getElementById|querySelector\(['"]#/);
        const code = read(NEXT, 'views', 'tools', 'lyrics-finder-notice.js').split(/\r?\n/).filter((line) => !/^\s*\/\//.test(line)).join('\n');
        assert.doesNotMatch(code, /\bimport\b|\bwindow\b|document\./);
    });
});

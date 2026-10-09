// Real-browser tests for the playback files that are ES modules (10a-10d, 13, 15a-15g, 16, 17):
// every name other files call is on window, the state the setters assign by bare name still
// lives in the classic files, the player buttons still drive playback, and the context-menu
// actions reach the Electron calls through desktopApi.
//
// Run:   node --test tools/tests/playback-modules.test.js
// Needs: npm i -D playwright   (see scroll.test.js for setup notes)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const JS = path.join(ROOT, 'src', 'js');
const pw = loadPlaywright();

const PLAYBACK_MODULES = [
    '10a-playback-shuffle.js', '10b-playback-smart-shuffle.js', '10c-playback-queue.js', '10d-playback-song.js',
    '13-song-highlight.js', '15a-controls-time-play.js', '15b-controls-shuffle-btn.js', '15c-controls-repeat-btn.js',
    '15d-controls-track-nav.js', '15e-controls-audio-events.js', '15f-controls-progress-seek.js',
    '15g-controls-volume-fade.js', '16-context-menu-actions.js', '17-song-selection.js'
];

describe('playback modules in the real page', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(60);
        // A recording stand-in for the preload: keeps every call and every subscribed callback.
        const file = path.join(dir, 'index.html');
        const html = fs.readFileSync(file, 'utf8');
        const stubStart = html.indexOf('<script>window.electronAPI = new Proxy');
        assert.ok(stubStart >= 0, 'the fixture stub is expected in the page');
        const stubEnd = html.indexOf('</script>', stubStart) + '</script>'.length;
        const recording = `<script>
window.__calls = [];
window.__subs = {};
window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'then') ? undefined : (...a) => {
    if (/^on[A-Z]/.test(String(k))) { window.__subs[k] = a[0]; return () => {}; }
    window.__calls.push([String(k), ...a]);
    return Promise.resolve(false);
} });
</script>`;
        fs.writeFileSync(file, html.slice(0, stubStart) + recording + html.slice(stubEnd));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function openApp() {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await gotoApp(page, dir);
        await page.evaluate(() => {
            audioElement.play = () => Promise.resolve();
            audioElement.pause = () => {};
        });
        return { page, errors };
    }

    test('every exported function of the playback modules is on window, with no page errors', { timeout: 30000 }, async (t) => {
        if (!guard(t)) return;
        const names = [];
        for (const file of PLAYBACK_MODULES) {
            for (const m of fs.readFileSync(path.join(JS, file), 'utf8').matchAll(/^export (?:async )?function (\w+)/gm)) names.push(m[1]);
        }
        assert.ok(names.length > 60, 'expected the playback modules to export more than 60 functions, found ' + names.length);
        const { page, errors } = await openApp();
        const missing = await page.evaluate((list) => list.filter((n) => typeof window[n] !== 'function'), names);
        assert.deepEqual(missing, []);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('state the setters assign by bare name is still a classic global', { timeout: 30000 }, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const out = await page.evaluate(() => {
            const before = { remaining: showRemainingTime, playing: wasPlaying, shuffleIndex };
            setShowRemainingTime(true);
            setWasPlaying(true);
            setShuffleIndex(3);
            setSmartShuffleJourney([1, 2, 3]);
            return {
                before,
                remaining: showRemainingTime,
                playing: wasPlaying,
                shuffleIndex,
                journey: smartShuffleJourney.slice(),
                onWindow: ['showRemainingTime', 'wasPlaying', 'shuffleOrder'].map((n) => n in window)
            };
        });
        assert.deepEqual(out.before, { remaining: false, playing: false, shuffleIndex: 0 });
        assert.equal(out.remaining, true);
        assert.equal(out.playing, true);
        assert.equal(out.shuffleIndex, 3);
        assert.deepEqual(out.journey, [1, 2, 3]);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('play, next, previous, shuffle and repeat work from the player buttons', { timeout: 30000 }, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const out = await page.evaluate(async () => {
            const log = {};
            currentView = VIEWS.ALL_SONGS;
            createQueueFromSongList(getSongsForList(VIEWS.ALL_SONGS), 5, VIEWS.ALL_SONGS);
            playSongFromQueue(5);
            log.started = currentQueueIndex;
            document.getElementById('next-btn').click();
            log.afterNext = currentQueueIndex;
            document.getElementById('next-btn').click();
            log.afterNext2 = currentQueueIndex;
            audioElement.currentTime = 0;
            document.getElementById('prev-btn').click();
            log.afterPrev = currentQueueIndex;
            log.queueLength = playbackQueue.length;
            toggleNormalShuffle();
            log.shuffled = isShuffled;
            repeatButton.click();
            log.repeatVisual = repeatVisualState;
            log.repeatOneLoop = audioElement.loop;
            repeatButton.click();
            log.repeatVisualAfter = repeatVisualState;
            return log;
        });
        assert.ok(out.queueLength > 5, 'the queue holds the list');
        assert.equal(out.started, 5);
        assert.equal(out.afterNext, 6);
        assert.equal(out.afterNext2, 7);
        assert.equal(out.afterPrev, 6);
        assert.equal(out.shuffled, true);
        assert.equal(out.repeatVisual, 1);
        assert.equal(out.repeatOneLoop, false);
        assert.equal(out.repeatVisualAfter, 2);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('time display, volume and mute work', { timeout: 30000 }, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const out = await page.evaluate(() => {
            const log = {};
            log.format = formatTime(125);
            updateVolume(0.4);
            log.volume = Math.round(audioElement.volume * 100);
            toggleMute();
            log.muted = audioElement.volume;
            toggleMute();
            log.unmuted = audioElement.volume > 0;
            Object.defineProperty(audioElement, 'duration', { value: 200, configurable: true });
            audioElement.currentTime = 20;
            updateTimeDisplay();
            log.elapsed = currentTimeDisplay.textContent;
            toggleTimeDisplay();
            log.remaining = currentTimeDisplay.textContent;
            log.flag = showRemainingTime;
            return log;
        });
        assert.equal(out.format, '2:05');
        assert.equal(out.volume, 40);
        assert.equal(out.muted, 0);
        assert.equal(out.unmuted, true);
        assert.equal(out.elapsed, '0:20');
        assert.equal(out.remaining, '-3:00');
        assert.equal(out.flag, true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the Electron calls of the playback files go through desktopApi', { timeout: 30000 }, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const out = await page.evaluate(async () => {
            const log = {};
            window.__calls.length = 0;
            syncPlayPauseButtons();
            log.thumbar = window.__calls.filter((c) => c[0] === 'updateThumbarPlayState');

            let clicks = 0;
            document.getElementById('next-btn').addEventListener('click', () => clicks++);
            await new Promise((r) => setTimeout(r, 50));
            window.__subs.onThumbarNext();
            log.subscribed = Object.keys(window.__subs).sort();
            log.thumbarNextClicks = clicks;

            currentContextSongId = 3;
            showFileLocation();
            log.showFile = window.__calls.filter((c) => c[0] === 'showFileInExplorer');

            window.showConfirmDialog = async () => true;
            await deleteSongFile();
            log.deleteFile = window.__calls.filter((c) => c[0] === 'deleteFile');
            log.markedDeleted = deletedSongIds.has(3);
            return log;
        });
        assert.deepEqual(out.thumbar, [['updateThumbarPlayState', false]]);
        for (const name of ['onThumbarNext', 'onThumbarPlayPause', 'onThumbarPrev', 'onWindowMaximize']) {
            assert.ok(out.subscribed.includes(name), name + ' is subscribed');
        }
        assert.equal(out.thumbarNextClicks, 1);
        assert.deepEqual(out.showFile, [['showFileInExplorer', 'music\\3.mp3']]);
        assert.deepEqual(out.deleteFile, [['deleteFile', 'music\\3.mp3']]);
        assert.equal(out.markedDeleted, true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('deleting a history entry updates the stored history', { timeout: 30000 }, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        const out = await page.evaluate(() => {
            saveToPlayHistory(SONGS_DATA[0], 60);
            saveToPlayHistory(SONGS_DATA[1], 60);
            const before = getPlayHistory().length;
            currentView = VIEWS.ALL_SONGS;
            currentContextSongId = SONGS_DATA[0].id;
            activeContextMenuSlot = 0;
            deleteHistoryEntry();
            return { before, after: getPlayHistory().length, stored: JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAY_HISTORY)).length };
        });
        assert.equal(out.before, 2);
        assert.equal(out.after, 1);
        assert.equal(out.stored, 1);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

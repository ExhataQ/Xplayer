// Real-browser regression test for the seek bar and the volume slider. Both are wired with
// data-action-mousedown in build/music_player.html, so the handlers run from the delegated listener on
// document, where e.currentTarget is document, not the bar (core/LEGACY.md, point 2). The handlers used
// to read e.currentTarget: a click on the seek bar threw, did not seek and left playback paused; a click
// on the volume slider threw after the direct listener had already set the volume.
//
// Uses real mouse clicks and a real (generated) WAV file, not synthetic events or a stubbed audio element.
//
// Run:   node --test tools/tests/seek-volume.test.js
// Needs: npm i -D playwright   (see scroll.test.js for setup notes)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 30000 };
const SECONDS = 6;

// A 6-second 8 kHz mono 16-bit sine wave: small, and long enough to seek inside.
function writeWav(file) {
    const rate = 8000;
    const n = rate * SECONDS;
    const b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0);
    b.writeUInt32LE(36 + n * 2, 4);
    b.write('WAVEfmt ', 8);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(rate, 24);
    b.writeUInt32LE(rate * 2, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34);
    b.write('data', 36);
    b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 3000), 44 + i * 2);
    fs.writeFileSync(file, b);
}

describe('seek bar and volume slider (data-action, real mouse)', { concurrency: false }, () => {
    let browser, dir, wav, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(10);
        wav = path.join(dir, 'tone.wav');
        writeWav(wav);
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    // Opens the app and starts the generated track. The first mouse click gives the page the user
    // activation that autoplay needs, so no browser flag is required.
    async function openPlaying({ fadeInSeconds } = {}) {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await gotoApp(page, dir);
        await page.mouse.click(5, 5);
        const url = 'file://' + wav.replace(/\\/g, '/');
        if (fadeInSeconds) await page.evaluate((seconds) => localStorage.setItem('audioPlaybackSettings', JSON.stringify({ fadeInEnabled: true, fadeInDuration: seconds })), fadeInSeconds);
        await page.evaluate((u) => {
            SONGS_DATA.forEach((s) => (s.url = u));
            createQueueFromSongList(SONGS_DATA.slice(0, 3), 0, VIEWS.ALL_SONGS);
        }, url);
        await page.waitForFunction(() => !audioElement.paused && audioElement.duration > 0 && audioElement.currentTime > 0.2, null, { timeout: 8000 });
        return { page, errors };
    }

    async function clickAt(page, selector, fraction) {
        const box = await page.locator(selector).boundingBox();
        await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.up();
    }

    test('clicking the seek bar seeks, keeps playing and throws nothing', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openPlaying();
        await clickAt(page, '.progress-container', 0.8);
        await page.waitForTimeout(250);
        const s = await page.evaluate(() => ({ t: audioElement.currentTime, d: audioElement.duration, paused: audioElement.paused, dragging: !!document.querySelector('.progress-container.dragging') }));
        assert.deepEqual(errors, [], 'no page error');
        assert.ok(Math.abs(s.t - s.d * 0.8) < 0.6, `currentTime ${s.t} should be near 80% of ${s.d}`);
        assert.equal(s.paused, false, 'playback resumes after the click');
        assert.equal(s.dragging, false, 'the dragging class is removed on mouseup');
        await page.close();
    });

    test('dragging on the seek bar follows the pointer', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openPlaying();
        const box = await page.locator('.progress-container').boundingBox();
        const y = box.y + box.height / 2;
        await page.mouse.move(box.x + box.width * 0.2, y);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.6, y, { steps: 6 });
        await page.waitForTimeout(100);
        await page.mouse.up();
        await page.waitForTimeout(150);
        const s = await page.evaluate(() => ({ t: audioElement.currentTime, d: audioElement.duration, paused: audioElement.paused }));
        assert.deepEqual(errors, []);
        assert.ok(Math.abs(s.t - s.d * 0.6) < 0.6, `currentTime ${s.t} should be near 60% of ${s.d}`);
        assert.equal(s.paused, false);
        await page.close();
    });

    test('clicking the volume slider sets the volume and throws nothing', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openPlaying();
        // This click comes after the fade-in; the next test clicks during it (D-3, fixed under D17).
        await page.waitForFunction(() => audioElement.currentTime > 1.5, null, { timeout: 8000 });
        await clickAt(page, '#volume-slider', 0.25);
        await page.waitForTimeout(150);
        const v = await page.evaluate(() => ({ vol: audioElement.volume, chosen: window.lastVolume, fill: parseFloat(document.getElementById('volume-fill').style.width) }));
        assert.deepEqual(errors, [], 'no page error');
        assert.ok(Math.abs(v.vol - 0.25) < 0.06, `audio volume ${v.vol} should be near 0.25`);
        assert.ok(Math.abs(v.chosen - 0.25) < 0.06, `chosen volume ${v.chosen} should be near 0.25`);
        assert.ok(Math.abs(v.fill - 25) < 6, `fill ${v.fill}% should be near 25%`);
        await page.close();
    });

    test('a volume change during a new track\'s fade-in is kept when the fade ends (D-3)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openPlaying({ fadeInSeconds: 2.5 });
        assert.ok(await page.evaluate(() => audioElement.currentTime < 1.5), 'the click is made inside the fade-in');
        await clickAt(page, '#volume-slider', 0.25);
        await page.waitForFunction(() => audioElement.currentTime > 3.2, null, { timeout: 8000 }); // the fade has ended
        const v = await page.evaluate(() => ({ vol: audioElement.volume, chosen: window.lastVolume, fill: parseFloat(document.getElementById('volume-fill').style.width) }));
        assert.deepEqual(errors, []);
        assert.ok(Math.abs(v.vol - 0.25) < 0.06, `audio volume ${v.vol} should stay near 0.25 (it was 0.5 before the fix)`);
        assert.ok(Math.abs(v.chosen - 0.25) < 0.06, `chosen volume ${v.chosen}`);
        assert.ok(Math.abs(v.fill - 25) < 6, `fill ${v.fill}%`);
        await page.close();
    });

    test('startSeek does not pause playback when the bar is missing', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openPlaying();
        const paused = await page.evaluate(() => {
            document.querySelector('.progress-container').remove();
            startSeek({ clientX: 0, target: document.body });
            return audioElement.paused;
        });
        assert.deepEqual(errors, []);
        assert.equal(paused, false, 'a missing bar returns before pausing');
        await page.close();
    });
});

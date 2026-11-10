// The volume control end to end in the real app: slider (click and drag), keyboard, mute and unmute, persistence, a track change and the
// smoothing of a change. The slider position and the audio gain (audioElement.volume) are both read, and the gain must always be what
// src/js/playback/volume-curve.js says for that position.
// Uses real mouse and keyboard input and a real (generated) WAV file.
//
// Run:   node --test tools/tests/volume-control.test.js
// Needs: npm i -D playwright   (see scroll.test.js for setup notes)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 30000 };
const loadCurve = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'js', 'playback', 'volume-curve.js')).href);

// A 6-second 8 kHz mono 16-bit sine wave: small, and long enough to play through a test.
function writeWav(file) {
    const rate = 8000;
    const n = rate * 6;
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

const STATE = () => ({ position: window.lastVolume, gain: audioElement.volume, muted: audioElement.muted, fill: parseFloat(document.getElementById('volume-fill').style.width), restore: window.lastMutedVolume });

describe('volume control (real page, real mouse and keyboard)', { concurrency: false }, () => {
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

    // One context per test, so what one test saves (localStorage) does not leak into the next; `context` is returned for restart tests.
    async function open({ play = true, storage = null } = {}) {
        const context = await browser.newContext({ viewport: { width: 1500, height: 900 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        if (storage) await page.addInitScript((entries) => { for (const [k, v] of Object.entries(entries)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, storage);
        await gotoApp(page, dir);
        if (play) await startPlaying(page);
        return { page, errors, context };
    }
    async function startPlaying(page) {
        await page.mouse.click(5, 5); // user activation for autoplay
        const url = 'file://' + wav.replace(/\\/g, '/');
        await page.evaluate((u) => {
            SONGS_DATA.forEach((s) => (s.url = u));
            createQueueFromSongList(SONGS_DATA.slice(0, 3), 0, VIEWS.ALL_SONGS);
        }, url);
        await page.waitForFunction(() => !audioElement.paused && audioElement.duration > 0 && audioElement.currentTime > 0.2, null, { timeout: 8000 });
        await page.waitForFunction(() => audioElement.currentTime > 1.6, null, { timeout: 8000 }); // past any fade-in
    }
    const settle = (page) => page.waitForTimeout(400); // the gain ramps for under 0.2 s

    test('a click on the slider sets the position, and the gain is the curve\'s gain for it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { positionToGain } = await loadCurve();
        const { page, errors, context } = await open();
        const box = await page.locator('#volume-slider').boundingBox();
        await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.up();
        await settle(page);
        const s = await page.evaluate(STATE);
        assert.ok(Math.abs(s.position - 0.25) < 0.06, `position ${s.position}`);
        assert.ok(Math.abs(s.fill - s.position * 100) < 1e-6, 'the slider shows the position');
        assert.ok(Math.abs(s.gain - positionToGain(s.position)) < 1e-4, `gain ${s.gain}`);
        assert.ok(s.gain < s.position / 5, 'the gain is far below the position now (it used to be equal)');
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('dragging the slider follows the pointer through the same curve, from the bottom to the top', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { positionToGain } = await loadCurve();
        const { page, errors, context } = await open();
        const box = await page.locator('#volume-slider').boundingBox();
        const y = box.y + box.height / 2;
        await page.mouse.move(box.x + box.width * 0.2, y);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.9, y, { steps: 10 });
        await page.mouse.up();
        await settle(page);
        let s = await page.evaluate(STATE);
        assert.ok(Math.abs(s.position - 0.9) < 0.05, `position ${s.position}`);
        assert.ok(Math.abs(s.gain - positionToGain(s.position)) < 1e-4);
        await page.mouse.move(box.x + box.width * 1.5, y); // past the right end: the top is unity, not above
        await page.mouse.down();
        await page.mouse.up();
        await settle(page);
        s = await page.evaluate(STATE);
        assert.equal(s.gain, 1);
        assert.equal(s.position, 1);
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('Ctrl+Up and Ctrl+Down move the slider by 5 % and the gain follows the curve', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { positionToGain } = await loadCurve();
        const { page, errors, context } = await open();
        await page.evaluate(() => updateVolume(0.5));
        await page.keyboard.press('Control+ArrowUp');
        await settle(page);
        let s = await page.evaluate(STATE);
        assert.ok(Math.abs(s.position - 0.55) < 1e-9);
        assert.ok(Math.abs(s.gain - positionToGain(0.55)) < 1e-4);
        await page.keyboard.press('Control+ArrowDown');
        await page.keyboard.press('Control+ArrowDown');
        await settle(page);
        s = await page.evaluate(STATE);
        assert.ok(Math.abs(s.position - 0.45) < 1e-9);
        assert.ok(Math.abs(s.gain - positionToGain(0.45)) < 1e-4);
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('mute is exact silence, unmute returns to the level before, and 0 % is the same mute', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { positionToGain } = await loadCurve();
        const { page, errors, context } = await open();
        await page.evaluate(() => updateVolume(0.62));
        await settle(page);
        await page.evaluate(() => toggleMute());
        await settle(page);
        let s = await page.evaluate(STATE);
        assert.deepEqual([s.gain, s.muted, s.position], [0, true, 0]);
        await page.evaluate(() => toggleMute());
        await settle(page);
        s = await page.evaluate(STATE);
        assert.ok(Math.abs(s.position - 0.62) < 1e-9 && s.muted === false);
        assert.ok(Math.abs(s.gain - positionToGain(0.62)) < 1e-4);
        await page.evaluate(() => updateVolume(0));
        await settle(page);
        s = await page.evaluate(STATE);
        assert.deepEqual([s.gain, s.muted], [0, true]);
        await page.keyboard.press('Control+ArrowUp'); // from silence the first press is the first step
        await settle(page);
        s = await page.evaluate(STATE);
        assert.ok(Math.abs(s.position - 0.05) < 1e-9 && s.muted === false && s.gain > 0);
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('a change of track keeps the volume', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { positionToGain } = await loadCurve();
        const { page, errors, context } = await open();
        await page.evaluate(() => updateVolume(0.35));
        await settle(page);
        await page.evaluate(() => createQueueFromSongList(SONGS_DATA.slice(3, 6), 0, VIEWS.ALL_SONGS));
        await page.waitForFunction(() => !audioElement.paused && audioElement.currentTime > 1.6, null, { timeout: 8000 });
        const s = await page.evaluate(STATE);
        assert.equal(s.position, 0.35);
        assert.ok(Math.abs(s.gain - positionToGain(0.35)) < 1e-4, `gain ${s.gain}`);
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('the volume is saved and comes back after a restart; a muted restart keeps the level unmute returns to', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors, context } = await open({ play: false });
        const first = await page.evaluate(STATE);
        assert.equal(first.position, 0.8, 'first run: the default');
        await page.evaluate(() => updateVolume(0.57));
        await page.waitForTimeout(500); // the save follows the last change by a quarter of a second
        assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('volume'))), { position: 0.57, restore: 0.57 });
        await page.reload();
        await page.waitForFunction(() => typeof updateVolume === 'function' && document.getElementById('volume-fill'));
        await page.waitForTimeout(1500);
        let s = await page.evaluate(STATE);
        assert.equal(s.position, 0.57);
        assert.equal(s.fill, 57);
        await page.evaluate(() => { updateVolume(0.4); toggleMute(); });
        await page.waitForTimeout(500);
        await page.reload();
        await page.waitForFunction(() => typeof updateVolume === 'function' && document.getElementById('volume-fill'));
        await page.waitForTimeout(1500);
        s = await page.evaluate(STATE);
        assert.deepEqual([s.position, s.muted], [0, true]);
        await page.evaluate(() => toggleMute());
        s = await page.evaluate(STATE);
        assert.equal(s.position, 0.4, 'unmute returns to the level from before the restart');
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('a saved volume that makes no sense is ignored: the default is used and nothing throws', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        for (const bad of ['{"position":"loud"}', '{"position":7}', 'not json', '5', 'null']) {
            const { page, errors, context } = await open({ play: false, storage: { volume: bad } });
            assert.equal((await page.evaluate(STATE)).position, 0.8, bad);
            assert.deepEqual(errors, [], bad);
            await context.close();
        }
    });

    test('the volume icon follows the level and never moves: every audible level has a curved bar, a new shape only fades in; a number follows the knob; the fill is brighter the louder it is', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors, context } = await open({ play: false });
        const ICON = () => {
            const i = document.querySelector('#volume-icon i');
            return { cls: i.className, level: document.getElementById('volume-icon').dataset.level, slider: document.getElementById('volume-slider').dataset.level, label: document.getElementById('volume-icon').getAttribute('aria-label') };
        };
        const BUBBLE = () => {
            const b = document.getElementById('volume-bubble');
            return b && { text: b.textContent, shown: b.classList.contains('show'), left: b.style.left };
        };
        let s = await page.evaluate(ICON);
        assert.deepEqual([s.cls, s.level, s.label], ['fas fa-fw fa-volume-up', 'high', 'Mute'], 'start-up: the default 80 %, with no fade');
        assert.equal(await page.evaluate(BUBBLE), null, 'and no bubble at start-up');
        // [position, glyph, level, does the shape change (so it fades in), label]
        const cases = [
            [0.3, 'fa-volume-down', 'low', true, 'Mute'],
            [0.1, 'fa-volume-down', 'whisper', false, 'Mute'], // whisper keeps the one-curved-bar icon: no speaker without a bar except at mute
            [0.01, 'fa-volume-down', 'whisper', false, 'Mute'],
            [0, 'fa-volume-mute', 'mute', true, 'Unmute'],
            [0.9, 'fa-volume-up', 'high', true, 'Mute']
        ];
        for (const [position, glyph, level, changes, label] of cases) {
            await page.evaluate(() => { document.querySelector('#volume-icon i').dataset.before = '1'; });
            await page.evaluate((p) => updateVolume(p), position);
            s = await page.evaluate(ICON);
            assert.ok(s.cls.includes(glyph), `${position}: ${s.cls}`);
            assert.equal(s.cls.includes('vol-fade'), changes, `${position}: ${s.cls}`);
            assert.equal(await page.evaluate(() => document.querySelector('#volume-icon i').dataset.before === '1'), !changes, `${position}: the icon is replaced only when its shape changes`);
            assert.deepEqual([s.level, s.slider, s.label], [level, level, label]);
            const b = await page.evaluate(BUBBLE);
            assert.deepEqual([b.text, b.shown, b.left], [position === 0 ? 'Muted' : Math.round(position * 100) + '%', true, position * 100 + '%']);
        }
        // the icon never moves: its animation is a fade, and it has no transform
        const motion = await page.evaluate(() => {
            const cs = getComputedStyle(document.querySelector('#volume-icon i'));
            return { name: cs.animationName, transform: cs.transform, translate: cs.translate, scale: cs.scale };
        });
        assert.equal(motion.name, 'volume-fade');
        assert.deepEqual([motion.transform, motion.translate, motion.scale], ['none', 'none', 'none']);
        // the number goes away a moment after the last change
        await page.waitForTimeout(1300);
        assert.equal((await page.evaluate(BUBBLE)).shown, false);
        // the fill is dimmer when it is quiet
        const fillOpacity = async (p) => {
            await page.evaluate((v) => updateVolume(v), p);
            await page.waitForTimeout(300);
            return page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('volume-fill')).opacity));
        };
        assert.deepEqual([await fillOpacity(0.1), await fillOpacity(0.3), await fillOpacity(0.8)], [0.55, 0.8, 1]);
        // the number stays while the mouse button is held, and the knob grows
        const box = await page.locator('#volume-slider').boundingBox();
        await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 6 });
        await page.waitForTimeout(1300);
        assert.equal(await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('volume-bubble')).opacity)), 1);
        assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('volume-knob')).scale), '1.3');
        await page.mouse.up();
        // the keyboard shows the number too
        await page.waitForTimeout(1300);
        await page.keyboard.press('Control+ArrowUp');
        assert.equal((await page.evaluate(BUBBLE)).shown, true);
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('with reduced motion the icon and the number still change, but nothing animates', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const context = await browser.newContext({ viewport: { width: 1500, height: 900 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await gotoApp(page, dir);
        await page.evaluate(() => { updateVolume(0.3); updateVolume(0.9); });
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#volume-icon i')).animationName), 'none');
        assert.equal(await page.evaluate(() => document.getElementById('volume-bubble').textContent), '90%');
        await context.close();
    });

    test('a change of volume is a short ramp, not a step: the gain rises smoothly and ends exactly on the target', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { positionToGain } = await loadCurve();
        const { page, errors, context } = await open();
        await page.evaluate(() => updateVolume(0.2));
        await settle(page);
        const samples = await page.evaluate(() => new Promise((resolve) => {
            const out = [];
            const t0 = performance.now();
            updateVolume(0.9);
            (function frame() {
                out.push(audioElement.volume);
                if (performance.now() - t0 < 500) requestAnimationFrame(frame);
                else resolve(out);
            })();
        }));
        const start = positionToGain(0.2);
        const target = positionToGain(0.9);
        assert.ok(samples.length > 10);
        for (let i = 1; i < samples.length; i++) assert.ok(samples[i] >= samples[i - 1] - 1e-12, 'never goes back');
        assert.ok(samples.slice(0, 3).every((v) => v < target), 'the first frames are not already at the target: it is a ramp');
        assert.ok(samples.filter((v) => v > start && v < target * 0.99).length >= 3, 'at least three frames on the way');
        assert.equal(samples[samples.length - 1], target, 'ends exactly on the target');
        // and a mute ramps down to exactly zero, then mutes
        await page.evaluate(() => toggleMute());
        await settle(page);
        const m = await page.evaluate(STATE);
        assert.deepEqual([m.gain, m.muted], [0, true]);
        assert.deepEqual(errors, []);
        await context.close();
    });
});

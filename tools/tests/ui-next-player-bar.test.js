// Player bar of the new shell (task C-01): views/playback/player-bar.css on top of shell.css, running the real engine.
// Real browser, real mouse, real (generated) WAV audio, like ui-next-shell.test.js.
//
// Run:   node --test tools/tests/ui-next-player-bar.test.js
// Needs: npm i -D playwright   (see scroll.test.js for setup notes)
//
// The stylesheet is linked into the fixture's copy of index.html here when index.html does not link it itself
// (Agent A's file, request R-C1), so this test works before and after that line is added.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const SECONDS = 6;
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const PLAYBACK_CSS = 'views/playback/player-bar.css';
const WITH_STYLESHEET = process.env.XPLAYER_TEST_WITHOUT_PLAYER_BAR_CSS !== '1'; // mutation check: see the C-01 report

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

function buildNextApp() {
    const dir = buildApp(30);
    fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
    const file = path.join(dir, 'ui-next', 'index.html');
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    let html = fs.readFileSync(file, 'utf8');
    assert.ok(html.includes('<script src="../player.js">'), 'index.html loads ../player.js');
    html = html.replace('<script src="../player.js">', () => stub + '<script src="../player.js">');
    const linkLine = /\n?[ \t]*<link rel="stylesheet" href="views\/playback\/player-bar\.css">/;
    if (WITH_STYLESHEET && !linkLine.test(html)) {
        assert.ok(html.includes('adapter/legacy-icons.css'), 'index.html links adapter/legacy-icons.css');
        html = html.replace(/(<link rel="stylesheet" href="adapter\/legacy-icons\.css">)/, `$1\n    <link rel="stylesheet" href="${PLAYBACK_CSS}">`);
    }
    if (!WITH_STYLESHEET) html = html.replace(linkLine, ''); // mutation check, also when index.html links it itself
    fs.writeFileSync(file, html);
    return dir;
}

describe('player bar stylesheet (static)', () => {
    const css = fs.readFileSync(path.join(NEXT_SRC, PLAYBACK_CSS), 'utf8');

    test('uses tokens only: no hex, rgb(), hsl() or named color values', () => {
        const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
        assert.deepEqual(code.match(/#[0-9a-fA-F]{3,8}\b(?=\s*[;,)])|\b(?:rgb|rgba|hsl|hsla)\(/g) || [], []);
    });

    test('shows the volume handle while the slider is being dragged, like the old stylesheet (PC-04)', () => {
        const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
        assert.match(code, /#volume-slider\.dragging #volume-knob[^{]*\{[^}]*opacity:\s*1/);
    });

    test('does not use !important or transform (the engine writes inline styles on these elements, L-05)', () => {
        const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
        assert.ok(!/!important/.test(code), 'no !important');
        assert.ok(!/(^|[\s{;])transform\s*:/.test(code), 'no transform');
    });
});

describe('player bar in the new shell with the real engine', { concurrency: false }, () => {
    let browser, dir, wav, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildNextApp();
        wav = path.join(dir, 'tone.wav');
        writeWav(wav);
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open({ play = false } = {}) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        const url = 'file://' + wav.replace(/\\/g, '/');
        await page.evaluate((u) => SONGS_DATA.forEach((s) => (s.url = u)), url);
        if (play) {
            await page.mouse.click(5, 5);
            await page.evaluate(() => createQueueFromSongList(SONGS_DATA.slice(0, 4), 0, VIEWS.ALL_SONGS));
            await page.waitForFunction(() => !audioElement.paused && audioElement.currentTime > 0.2, null, { timeout: 8000 });
        }
        return { page, errors };
    }

    const tooltipBox = (page) =>
        page.evaluate(() => {
            const node = document.querySelector('.progress-tooltip');
            if (!node) return null;
            const r = node.getBoundingClientRect();
            return { text: node.textContent, position: getComputedStyle(node).position, x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, vw: window.innerWidth, vh: window.innerHeight };
        });

    // PC-04: the volume handle is hidden at rest, and stays visible for the whole drag, also at zero and with the pointer
    // outside the slider. The handle fades (motion token), so read the opacity after the fade.
    const knobOpacity = async (page) => {
        await page.waitForTimeout(400);
        return page.evaluate(() => getComputedStyle(document.getElementById('volume-knob')).opacity);
    };

    test('the volume handle stays visible while dragging to zero with the pointer outside the bar, and hides again after release (PC-04)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const slider = await page.locator('#volume-slider').boundingBox();
        const y = slider.y + slider.height / 2;
        await page.mouse.move(5, 5);
        assert.equal(await knobOpacity(page), '0', 'hidden at rest, as today');
        await page.mouse.move(slider.x + slider.width * 0.5, y);
        assert.equal(await knobOpacity(page), '1', 'shown on hover');
        await page.mouse.down();
        await page.mouse.move(slider.x - 120, y + 90, { steps: 6 }); // past the left end and below the bar: hover is lost
        assert.equal(await page.evaluate(() => Math.round(audioElement.volume * 100)), 0, 'volume reached zero');
        assert.equal(await page.evaluate(() => document.getElementById('volume-slider').matches(':hover')), false, 'pointer is outside the slider');
        assert.equal(await knobOpacity(page), '1', 'handle still shown at zero during the drag');
        await page.mouse.up();
        await page.mouse.move(5, 5);
        assert.equal(await knobOpacity(page), '0', 'hidden again after release with the pointer away');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('hovering the seek bar shows the time tooltip on screen, above the bar and centered on the pointer', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ play: true });
        const bar = await page.locator('.progress-container').boundingBox();
        const pointerX = bar.x + bar.width * 0.5;
        await page.mouse.move(pointerX - 20, bar.y + bar.height / 2);
        await page.mouse.move(pointerX, bar.y + bar.height / 2);
        await page.waitForSelector('.progress-tooltip', { timeout: 3000 });
        const tip = await tooltipBox(page);
        assert.equal(tip.position, 'fixed');
        assert.match(tip.text, /^\d+:\d\d$/);
        assert.ok(tip.x >= 0 && tip.right <= tip.vw && tip.y >= 0 && tip.bottom <= tip.vh, `inside the window: ${JSON.stringify(tip)}`);
        assert.ok(tip.bottom <= bar.y + 4, `above the seek bar (tooltip bottom ${tip.bottom}, bar top ${bar.y})`);
        assert.ok(Math.abs(tip.x + tip.width / 2 - pointerX) <= 2, `centered on the pointer (${tip.x + tip.width / 2} vs ${pointerX})`);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('dragging the seek bar keeps the tooltip on screen and shows the time under the pointer', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ play: true });
        const bar = await page.locator('.progress-container').boundingBox();
        await page.mouse.move(bar.x + bar.width * 0.2, bar.y + bar.height / 2);
        await page.mouse.down();
        await page.mouse.move(bar.x + bar.width * 0.5, bar.y + bar.height / 2, { steps: 4 });
        await page.waitForTimeout(150);
        const tip = await tooltipBox(page);
        assert.ok(tip, 'the engine shows the tooltip while dragging');
        assert.ok(tip.x >= 0 && tip.right <= tip.vw && tip.bottom <= tip.vh && tip.y >= 0, `inside the window: ${JSON.stringify(tip)}`);
        assert.equal(tip.text, '0:03', 'half of a 6 second track');
        await page.mouse.up();
        await page.waitForFunction(() => !document.querySelector('.progress-tooltip'), null, { timeout: 2000 });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the tooltip stays inside the window at both ends of the bar', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        const bar = await page.locator('.progress-container').boundingBox();
        // The last pixel inside the bar on each side (the right edge itself is outside the element).
        for (const [label, x] of [['left end', bar.x + 1], ['right end', bar.x + bar.width - 1]]) {
            await page.mouse.move(x - 6, bar.y + bar.height / 2);
            await page.mouse.move(x, bar.y + bar.height / 2);
            await page.waitForSelector('.progress-tooltip', { timeout: 3000 });
            const tip = await tooltipBox(page);
            assert.ok(tip.x >= 0 && tip.right <= tip.vw, `${label}: ${JSON.stringify(tip)}`);
            await page.mouse.move(bar.x + bar.width / 2, bar.y - 120); // leave; the engine removes the tooltip
            await page.waitForFunction(() => !document.querySelector('.progress-tooltip'), null, { timeout: 2000 });
        }
        await page.close();
    });

    test('an active shuffle or repeat toggle shows a marker besides its color; an inactive one does not', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        const marker = () =>
            page.evaluate(() => {
                const button = document.getElementById('repeat-btn');
                const after = getComputedStyle(button, '::after');
                return { active: button.classList.contains('active'), content: after.content, size: after.width, background: after.backgroundColor, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() };
            });
        assert.equal((await marker()).content, 'none', 'repeat off: no marker');
        await page.click('#repeat-btn');
        let state = await marker();
        assert.equal(state.active, true);
        assert.notEqual(state.content, 'none', 'repeat all: marker');
        assert.equal(state.size, '4px');
        await page.click('#repeat-btn');
        state = await marker();
        assert.equal(state.active, true, 'repeat one is also active');
        assert.notEqual(state.content, 'none');
        await page.click('#repeat-btn');
        assert.equal((await marker()).content, 'none', 'back to off: no marker');
        const play = await page.evaluate(() => getComputedStyle(document.getElementById('play-btn'), '::after').content);
        assert.equal(play, 'none', 'the play button never gets a marker');
        await page.close();
    });

    test('with nothing loaded, previous, next and the seek bar look unavailable; they return when a song plays', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const opacity = (selector) => page.evaluate((s) => Number(getComputedStyle(document.querySelector(s)).opacity), selector);
        const dim = Number(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--control-disabled-opacity')));
        for (const selector of ['#prev-btn', '#next-btn', '.progress-section']) assert.equal(await opacity(selector), dim, `${selector} dimmed when empty`);
        for (const selector of ['#play-btn', '#shuffle-btn', '#repeat-btn']) assert.equal(await opacity(selector), 1, `${selector} stays normal`);
        await page.mouse.click(5, 5);
        await page.evaluate(() => createQueueFromSongList(SONGS_DATA.slice(0, 4), 0, VIEWS.ALL_SONGS));
        await page.waitForFunction(() => !audioElement.paused && audioElement.currentTime > 0.2, null, { timeout: 8000 });
        for (const selector of ['#prev-btn', '#next-btn', '.progress-section']) assert.equal(await opacity(selector), 1, `${selector} back to normal`);
        await page.close();
    });

    test('the stylesheet does not break seeking or volume (real mouse)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ play: true });
        const bar = await page.locator('.progress-container').boundingBox();
        await page.mouse.move(bar.x + bar.width * 0.8, bar.y + bar.height / 2);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(250);
        const seek = await page.evaluate(() => ({ time: audioElement.currentTime, duration: audioElement.duration, paused: audioElement.paused }));
        assert.ok(Math.abs(seek.time - seek.duration * 0.8) < 0.6, `seeked to 80%: ${JSON.stringify(seek)}`);
        assert.equal(seek.paused, false, 'playback state unchanged');
        assert.deepEqual(errors, []);
        await page.close();
    });
});

// Playback surfaces of the new shell (tasks C-01 to C-04): control tooltips and accessibility, the waveform seek bar,
// the queue drawer and the cover viewer. Real browser, real engine, real mouse and keyboard, generated WAV files.
// The main-process side of the waveform is the real electron/audio-bytes.js, reached through a stubbed bridge.
//
// Run:   node --test tools/tests/ui-next-playback.test.js
// Needs: npm i -D playwright   (see scroll.test.js for setup notes)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');
const { readAudioBytes } = require('../../electron/audio-bytes');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 60000 };
const SECONDS = 6;
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

// A: silent first half, loud second half. B: loud first half, silent second half. Peaks differ, so the picture does.
function writeWav(file, shape) {
    const rate = 8000, n = rate * SECONDS, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
    b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) {
        const firstHalf = i < n / 2;
        const loud = shape === 'A' ? !firstHalf : firstHalf;
        b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * (loud ? 28000 : 60)), 44 + i * 2);
    }
    fs.writeFileSync(file, b);
}

const STUB = `<script>
window.__ipcCalls = [];
window.electronAPI = new Proxy({}, { get: (t, k) => {
    if (k === 'then') return undefined;
    if (k === 'readAudioBytes') {
        if (window.__ipcMode === 'none') return undefined;
        if (window.__ipcMode === 'too-large') return async (url) => (window.__ipcCalls.push(url), { success: false, reason: 'too-large' });
        return async (url) => {
            window.__ipcCalls.push(url);
            const r = await window.__readBytes(url);
            if (!r.success) return r;
            const bin = atob(r.data), bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return { success: true, data: bytes.buffer };
        };
    }
    return (...a) => { if (/^on[A-Z]/.test(String(k))) return () => {}; return Promise.resolve(null); };
} });
</script>
`;

function buildNextApp() {
    const dir = buildApp(30);
    fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
    const file = path.join(dir, 'ui-next', 'index.html');
    let html = fs.readFileSync(file, 'utf8');
    assert.ok(html.includes('<script src="../player.js">'), 'index.html loads ../player.js');
    html = html.replace('<script src="../player.js">', () => STUB + '<script src="../player.js">');
    fs.writeFileSync(file, html);
    return dir;
}

describe('playback surfaces in the new shell with the real engine', { concurrency: false }, () => {
    let browser, dir, skip, urlA, urlB;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildNextApp();
        writeWav(path.join(dir, 'a.wav'), 'A');
        writeWav(path.join(dir, 'b.wav'), 'B');
        urlA = 'file://' + path.join(dir, 'a.wav').replace(/\\/g, '/');
        urlB = 'file://' + path.join(dir, 'b.wav').replace(/\\/g, '/');
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open({ play = false, ipc = 'real', songs = 4 } = {}) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.exposeFunction('__readBytes', async (url) => {
            const result = await readAudioBytes(url);
            return result.success ? { success: true, data: Buffer.from(result.data).toString('base64') } : result;
        });
        await page.addInitScript((mode) => (window.__ipcMode = mode), ipc);
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        await page.evaluate(([a, b]) => SONGS_DATA.forEach((s, i) => (s.url = i === 1 ? b : a)), [urlA, urlB]);
        if (play) await playQueue(page, songs);
        return { page, errors };
    }
    async function playQueue(page, songs = 4) {
        await page.mouse.click(5, 5);
        await page.evaluate((n) => createQueueFromSongList(SONGS_DATA.slice(0, n), 0, VIEWS.ALL_SONGS), songs);
        await page.waitForFunction(() => !audioElement.paused && audioElement.currentTime > 0.2, null, { timeout: 8000 });
    }
    const playerTitle = (page) => page.evaluate(() => document.getElementById('player-title').textContent.replace(/\s+/g, ' ').trim());
    const tip = async (page) => {
        await page.waitForSelector('#ui-tooltip:not([hidden])', { timeout: 3000 });
        return page.evaluate(() => {
            const q = (s) => document.querySelector(`#ui-tooltip ${s}`);
            return { name: q('.tooltip__name').textContent, state: q('.tooltip__state').hidden ? '' : q('.tooltip__state').textContent, shortcut: q('.tooltip__shortcut').hidden ? '' : q('.tooltip__shortcut').textContent };
        });
    };
    const hoverAway = (page) => page.mouse.move(700, 300);

    // ---------------------------------------------------------------- controls (C-01)

    test('transport tooltips show the name, the state and the engine\'s own shortcut; previous and next show no shortcut', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ play: true });
        const expected = [
            ['#play-btn', { name: 'Pause', state: '', shortcut: 'Space' }],
            ['#shuffle-btn', { name: 'Shuffle', state: 'Off', shortcut: 'S' }],
            ['#repeat-btn', { name: 'Repeat', state: 'Off', shortcut: 'R' }],
            ['#prev-btn', { name: 'Previous song', state: '', shortcut: '' }],
            ['#next-btn', { name: 'Next song', state: '', shortcut: '' }],
            ['#volume-icon', { name: 'Mute', state: '', shortcut: 'M' }]
        ];
        for (const [selector, want] of expected) {
            await hoverAway(page);
            await page.waitForFunction(() => document.querySelector('#ui-tooltip')?.hidden !== false, null, { timeout: 2000 });
            await page.hover(selector);
            assert.deepEqual(await tip(page), want, selector);
        }
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a toggle tooltip follows the state after a click: repeat goes Off, All songs, One song, Off', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        await page.hover('#repeat-btn');
        assert.equal((await tip(page)).state, 'Off');
        for (const want of ['All songs', 'One song', 'Off']) {
            await page.click('#repeat-btn');
            await page.waitForFunction((w) => document.querySelector('#ui-tooltip .tooltip__state').textContent === w || (w === 'Off' && document.querySelector('#ui-tooltip .tooltip__state').hidden), want, { timeout: 2000 });
        }
        assert.equal(await page.getAttribute('#repeat-btn', 'aria-label'), 'Repeat: off');
        await page.close();
    });

    test('the engine\'s old tooltip stays away from the player controls and the controls carry no title attribute', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        for (const selector of ['#play-btn', '#next-btn', '#volume-icon']) {
            await page.hover(selector);
            await page.waitForTimeout(700);
            const shown = await page.evaluate(() => [...document.querySelectorAll('.custom-tooltip')].filter((n) => !n.classList.contains('progress-tooltip') && getComputedStyle(n).opacity === '1').map((n) => n.textContent));
            assert.deepEqual(shown, [], `${selector}: no old tooltip`);
            await hoverAway(page);
        }
        await page.evaluate(() => audioElement.pause()); // the engine rewrites the play button's title on every state change
        await page.waitForTimeout(150);
        for (const selector of ['#play-btn', '#volume-icon', '#next-btn', '#repeat-btn', '#shuffle-btn']) {
            assert.equal(await page.getAttribute(selector, 'title'), null, selector);
            assert.equal(await page.getAttribute(selector, 'data-original-title'), null, selector);
        }
        await page.close();
    });

    test('names and values for assistive technology: play label, seek slider and volume slider follow the engine', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        assert.equal(await page.getAttribute('#play-btn', 'aria-label'), 'Pause');
        const seek = () => page.evaluate(() => { const n = document.querySelector('.progress-container'); return { role: n.getAttribute('role'), tab: n.tabIndex, label: n.getAttribute('aria-label'), now: Number(n.getAttribute('aria-valuenow')), max: Number(n.getAttribute('aria-valuemax')), text: n.getAttribute('aria-valuetext') }; });
        await page.waitForFunction(() => Number(document.querySelector('.progress-container').getAttribute('aria-valuenow')) >= 1, null, { timeout: 5000 });
        const s = await seek();
        assert.deepEqual([s.role, s.tab, s.label, s.max], ['slider', 0, 'Seek', 6]);
        assert.match(s.text, /^0:0\d of 0:06$/);
        await page.evaluate(() => audioElement.pause());
        await page.waitForFunction(() => document.getElementById('play-btn').getAttribute('aria-label') === 'Play');
        const box = await page.locator('#volume-slider').boundingBox();
        await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
        await page.waitForFunction(() => document.getElementById('volume-slider').getAttribute('aria-valuenow') === '25', null, { timeout: 2000 });
        const v = await page.evaluate(() => { const n = document.getElementById('volume-slider'); return { role: n.getAttribute('role'), label: n.getAttribute('aria-label'), text: n.getAttribute('aria-valuetext'), fill: document.getElementById('volume-fill').style.width }; });
        assert.deepEqual(v, { role: 'slider', label: 'Volume', text: '25%', fill: '25%' });
        await page.click('#volume-icon');
        await page.waitForFunction(() => document.getElementById('volume-slider').getAttribute('aria-valuetext') === 'Muted', null, { timeout: 2000 });
        assert.equal(await page.getAttribute('#volume-icon', 'aria-label'), 'Unmute');
        assert.equal(await page.getAttribute('#volume-icon', 'role'), 'button');
        await page.close();
    });

    test('Space on a focused button presses that button; on the seek bar it still plays or pauses (engine)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        assert.equal(await playerTitle(page), 'Song title number 1');
        await page.focus('#next-btn');
        await page.keyboard.press('Space');
        await page.waitForFunction(() => document.getElementById('player-title').textContent.includes('number 2'), null, { timeout: 4000 });
        assert.equal(await page.evaluate(() => audioElement.paused), false, 'Space on Next did not pause');
        await page.focus('#prev-btn');
        await page.keyboard.press('Space');
        await page.waitForFunction(() => document.getElementById('player-title').textContent.includes('number 1'), null, { timeout: 4000 });
        await page.focus('.progress-container');
        await page.keyboard.press('Space');
        await page.waitForFunction(() => audioElement.paused, null, { timeout: 2000 });
        await page.close();
    });

    // ---------------------------------------------------------------- waveform (C-02)

    const coverage = (page, [x0, x1], [y0, y1] = [0.1, 0.3]) =>
        page.evaluate(([xs, ys]) => {
            const c = document.querySelector('.waveform-canvas'), ctx = c.getContext('2d'), w = c.width, h = c.height;
            const d = ctx.getImageData(Math.floor(w * xs[0]), Math.floor(h * ys[0]), Math.max(1, Math.floor(w * (xs[1] - xs[0]))), Math.max(1, Math.floor(h * (ys[1] - ys[0])))).data;
            let n = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
            return n / (d.length / 4);
        }, [[x0, x1], [y0, y1]]);
    const waitWave = (page) => page.waitForFunction(() => document.querySelector('.progress-container').classList.contains('has-waveform'), null, { timeout: 9000 });

    test('the seek bar draws the waveform of the playing file, read through the main process module', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ play: true });
        await waitWave(page);
        assert.ok((await coverage(page, [0.0, 0.4])) < 0.02, 'silent first half is flat');
        assert.ok((await coverage(page, [0.6, 0.95])) > 0.3, 'loud second half is tall');
        assert.deepEqual(await page.evaluate(() => window.__ipcCalls.map((u) => u.split('/').pop())), ['a.wav'], 'one read, through the bridge');
        const bar = await page.evaluate(() => { const r = document.querySelector('.progress-container').getBoundingClientRect(); return { h: Math.round(r.height), canvasEvents: getComputedStyle(document.querySelector('.waveform-canvas')).pointerEvents }; });
        assert.deepEqual(bar, { h: 32, canvasEvents: 'none' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('played bars use the accent, the rest the quiet color, and the picture follows a seek', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        await waitWave(page);
        await page.evaluate(() => audioElement.pause());
        const colorAt = (fromFraction) =>
            page.evaluate((from) => {
                const c = document.querySelector('.waveform-canvas'), ctx = c.getContext('2d'), y = Math.floor(c.height * 0.15);
                for (let x = Math.floor(c.width * from); x < c.width; x++) {
                    const p = ctx.getImageData(x, y, 1, 1).data;
                    if (p[3] === 255) return `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
                }
                return null;
            }, fromFraction);
        const resolve = (token) => page.evaluate((tk) => { const i = document.createElement('i'); i.style.color = `var(${tk})`; document.body.append(i); const c = getComputedStyle(i).color; i.remove(); return c; }, token);
        const accent = await resolve('--accent');
        const quiet = await resolve('--border-strong');
        await page.evaluate(() => (audioElement.currentTime = 0.2));
        await page.waitForTimeout(250);
        assert.equal(await colorAt(0.6), quiet, 'before the playhead: quiet color');
        await page.evaluate(() => (audioElement.currentTime = 5.8));
        await page.waitForFunction(() => document.querySelector('.progress-container').getAttribute('aria-valuenow') === '5', null, { timeout: 3000 });
        await page.waitForTimeout(250);
        assert.equal(await colorAt(0.6), accent, 'after the playhead: accent');
        await page.close();
    });

    test('a press on the bar still seeks with the waveform shown, and the time tooltip still follows the pointer', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        await waitWave(page);
        const bar = await page.locator('.progress-container').boundingBox();
        await page.mouse.move(bar.x + bar.width * 0.7, bar.y + bar.height / 2);
        await page.mouse.move(bar.x + bar.width * 0.8, bar.y + bar.height / 2);
        await page.waitForSelector('.progress-tooltip', { timeout: 3000 });
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(300);
        const seek = await page.evaluate(() => ({ time: audioElement.currentTime, duration: audioElement.duration }));
        assert.ok(Math.abs(seek.time - seek.duration * 0.8) < 0.6, JSON.stringify(seek));
        await page.close();
    });

    test('changing song clears the old picture at once and shows the new one, also when skipping quickly', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ play: true });
        await waitWave(page);
        assert.ok((await coverage(page, [0.6, 0.95])) > 0.3, 'A: loud second half');
        await page.click('#next-btn'); // song 2 is B: loud first half
        await page.waitForFunction(() => !document.querySelector('.progress-container').classList.contains('has-waveform'), null, { timeout: 2000 });
        await waitWave(page);
        assert.ok((await coverage(page, [0.05, 0.4])) > 0.3, 'B: loud first half');
        assert.ok((await coverage(page, [0.6, 0.95])) < 0.02, 'B: silent second half, nothing left over from A');
        // quick skipping: back to A and on to B within a fraction of a second, ends on B
        await page.click('#prev-btn');
        await page.click('#next-btn');
        await waitWave(page);
        await page.waitForTimeout(400);
        assert.ok((await coverage(page, [0.05, 0.4])) > 0.3 && (await coverage(page, [0.6, 0.95])) < 0.02, 'ends on B');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('without the desktop bridge (plain browser) the page reads the file itself; a refused read leaves the plain bar', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const none = await open({ play: true, ipc: 'none' });
        await waitWave(none.page);
        assert.ok((await coverage(none.page, [0.6, 0.95])) > 0.3);
        assert.deepEqual(await none.page.evaluate(() => window.__ipcCalls), []);
        await none.page.close();

        const refused = await open({ play: true, ipc: 'too-large' });
        await refused.page.waitForFunction(() => window.__ipcCalls.length === 1, null, { timeout: 5000 });
        await refused.page.waitForTimeout(1200);
        const state = await refused.page.evaluate(() => ({ wave: document.querySelector('.progress-container').classList.contains('has-waveform'), calls: window.__ipcCalls.length, h: Math.round(document.querySelector('.progress-container').getBoundingClientRect().height), fillVisible: getComputedStyle(document.getElementById('progress-bar')).visibility }));
        assert.deepEqual(state, { wave: false, calls: 1, h: 16, fillVisible: 'visible' });
        assert.deepEqual(refused.errors, []);
        await refused.page.close();
    });

    // ---------------------------------------------------------------- queue (C-03)

    const openQueue = async (page) => {
        await page.click('.queue-btn');
        await page.waitForSelector('.queue-panel:not([hidden])');
    };

    test('the queue button opens a drawer with the engine\'s queue, styled; the three dots are drawn, not written', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ play: true });
        const button = () => page.evaluate(() => { const b = document.querySelector('.queue-btn'); return { expanded: b.getAttribute('aria-expanded'), pressed: b.getAttribute('aria-pressed'), name: b.getAttribute('aria-label') }; });
        assert.deepEqual(await button(), { expanded: 'false', pressed: 'false', name: 'Queue' });
        assert.equal(await page.isVisible('.queue-panel'), false);
        await openQueue(page);
        assert.deepEqual(await button(), { expanded: 'true', pressed: 'true', name: 'Queue' });
        const view = await page.evaluate(() => {
            const rows = [...document.querySelectorAll('.queue-panel .queue-item')];
            const dots = document.querySelector('.queue-panel .more-info > span');
            const panel = document.querySelector('.queue-panel').getBoundingClientRect();
            return {
                rows: rows.length,
                titles: rows.map((r) => r.querySelector('.queue-item-title').textContent.trim()),
                labels: [...document.querySelectorAll('.queue-panel .queue-lables')].map((n) => n.textContent.trim()),
                display: getComputedStyle(rows[0]).display,
                dotsFont: getComputedStyle(dots).fontSize,
                dotsMask: getComputedStyle(dots).maskImage || getComputedStyle(dots).webkitMaskImage,
                dotsBox: [Math.round(dots.getBoundingClientRect().width), Math.round(dots.getBoundingClientRect().height)],
                insideWindow: panel.left >= 0 && panel.right <= innerWidth && panel.top >= 36 && panel.bottom <= innerHeight - 88
            };
        });
        assert.equal(view.rows, 4);
        assert.deepEqual(view.titles, ['Song title number 1', 'Song title number 2', 'Song title number 3', 'Song title number 4']);
        assert.deepEqual(view.labels, ['Now Playing', 'Next Songs']);
        assert.equal(view.display, 'grid');
        assert.equal(view.dotsFont, '0px', 'the Material Symbols name ("more_horiz") is not shown as text');
        assert.match(view.dotsMask, /^url\(/);
        assert.deepEqual(view.dotsBox, [18, 18]);
        assert.equal(view.insideWindow, true, 'the drawer sits above the player, inside the window');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('clicking a row plays it and the drawer stays open and updates; the menu button opens the engine\'s row menu', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        await openQueue(page);
        await page.locator('.queue-panel .queue-item').nth(2).click();
        await page.waitForFunction(() => document.getElementById('player-title').textContent.includes('number 3'), null, { timeout: 4000 });
        assert.equal(await page.isVisible('.queue-panel'), true);
        const first = await page.evaluate(() => document.querySelector('.queue-panel .queue-item .queue-item-title').textContent.trim());
        assert.equal(first, 'Song title number 3', 'Now Playing is the new song');
        await page.locator('.queue-panel .queue-item .more-info').nth(1).click();
        await page.waitForTimeout(300);
        assert.equal(await page.isVisible('.queue-panel'), true, 'opening the row menu does not close the drawer');
        await page.close();
    });

    test('keyboard: rows can be focused and played with Enter or Space, arrows move between rows, Escape closes and returns focus', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        await page.focus('.queue-btn');
        await page.keyboard.press('Space');
        await page.waitForSelector('.queue-panel:not([hidden])');
        assert.equal(await page.evaluate(() => audioElement.paused), false, 'Space on the queue button opened it and did not pause');
        const rows = page.locator('.queue-panel .queue-item');
        assert.equal(await rows.nth(1).getAttribute('tabindex'), '0');
        assert.equal(await rows.nth(1).getAttribute('role'), 'button');
        assert.match(await rows.nth(1).getAttribute('aria-label'), /^Play Song title number 2, Artist 1$/);
        await rows.nth(1).focus();
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.evaluate(() => document.activeElement.querySelector('.queue-item-title')?.textContent.trim()), 'Song title number 3');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.getElementById('player-title').textContent.includes('number 3'), null, { timeout: 4000 });
        await page.keyboard.press('Escape');
        assert.equal(await page.isVisible('.queue-panel'), false);
        assert.equal(await page.evaluate(() => document.activeElement.classList.contains('queue-btn')), true, 'focus is back on the queue button');
        await page.close();
    });

    test('a press outside closes the drawer, a press inside does not; the button toggles', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        await openQueue(page);
        await page.click('.queue-panel__title');
        assert.equal(await page.isVisible('.queue-panel'), true);
        await page.mouse.click(700, 300);
        assert.equal(await page.isVisible('.queue-panel'), false);
        await openQueue(page);
        await page.click('.queue-btn');
        assert.equal(await page.isVisible('.queue-panel'), false);
        await page.close();
    });

    test('songs added by hand get their own section; the empty queue shows the engine\'s empty card without a broken icon', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const empty = await open();
        await openQueue(empty.page);
        const card = await empty.page.evaluate(() => { const c = document.querySelector('.queue-panel .empty-queue'); return c ? { text: c.textContent.replace(/\s+/g, ' ').trim(), height: Math.round(c.getBoundingClientRect().height), icons: [...c.querySelectorAll('i')].filter((i) => getComputedStyle(i).display !== 'none').length } : null; });
        assert.ok(card && /empty/i.test(card.text) && card.height > 40 && card.icons === 0, JSON.stringify(card));
        await empty.page.close();

        const { page } = await open({ play: true });
        await page.evaluate(() => addSongToQueueNext(SONGS_DATA[6].id));
        await openQueue(page);
        const labels = await page.evaluate(() => [...document.querySelectorAll('.queue-panel .queue-lables')].map((n) => n.textContent.trim()));
        assert.ok(labels.some((l) => /added to queue/i.test(l)) && labels.some((l) => /next songs/i.test(l)), labels.join(' | '));
        await page.close();
    });

    // ---------------------------------------------------------------- cover viewer (C-04)

    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGP8z8DAwMDAAAUAAh4BBSb7bDYAAAAASUVORK5CYII=';

    test('the cover button appears only for a real cover and opens a dialog with the picture, title and artist; Escape returns focus', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ play: true });
        assert.equal(await page.isVisible('.cover-expand'), false, 'the engine\'s placeholder is not a cover');
        await page.evaluate((src) => (document.getElementById('player-cover').src = src), PNG);
        await page.waitForFunction(() => !document.querySelector('.cover-expand').hidden, null, { timeout: 2000 });
        await page.hover('.player-song-info');
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.cover-expand')).opacity), '1');
        await page.focus('.cover-expand');
        await page.keyboard.press('Space');
        await page.waitForSelector('dialog.dialog--cover[open]');
        const view = await page.evaluate(() => { const d = document.querySelector('dialog.dialog--cover'); const img = d.querySelector('.cover-viewer__image'); return { title: d.querySelector('.dialog__title').textContent, src: img.src === document.getElementById('player-cover').src, alt: img.alt, caption: d.querySelector('.cover-viewer__caption').textContent, paused: audioElement.paused }; });
        assert.deepEqual(view, { title: 'Song title number 1', src: true, alt: 'Cover of Song title number 1', caption: 'Artist 0', paused: false });
        await page.keyboard.press('Escape');
        await page.waitForSelector('dialog.dialog--cover', { state: 'detached' });
        assert.equal(await page.evaluate(() => document.activeElement.classList.contains('cover-expand')), true, 'focus returns to the cover button');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('in the viewer the picture switches between fit and actual size, and the close button and backdrop close it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        await page.evaluate((src) => (document.getElementById('player-cover').src = src), PNG);
        await page.waitForFunction(() => !document.querySelector('.cover-expand').hidden);
        await page.hover('.player-song-info');
        await page.click('.cover-expand');
        await page.waitForSelector('dialog.dialog--cover[open]');
        const fit = await page.evaluate(() => document.querySelector('.cover-viewer__frame').classList.contains('cover-viewer__frame--actual'));
        await page.click('.cover-viewer__image');
        const actual = await page.evaluate(() => document.querySelector('.cover-viewer__frame').classList.contains('cover-viewer__frame--actual'));
        assert.deepEqual([fit, actual], [false, true]);
        await page.click('.dialog__header button[aria-label="Close"]');
        await page.waitForSelector('dialog.dialog--cover', { state: 'detached' });
        await page.hover('.player-song-info');
        await page.click('.cover-expand');
        await page.waitForSelector('dialog.dialog--cover[open]');
        await page.mouse.click(8, 400); // the backdrop
        await page.waitForSelector('dialog.dialog--cover', { state: 'detached' });
        await page.close();
    });
});

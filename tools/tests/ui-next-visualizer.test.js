// The audio visualizer in the new shell (visualizer plan V2 to V6), in a real browser. The engine's analyser is replaced by a stand-in that
// returns a steady spectrum (real audio is not available here); the wiring, the passive canvas, the resolution cap, the "draws only when seen"
// rule and the less-animation rule are real.
//
// Run:   node --test tools/tests/ui-next-visualizer.test.js
// Needs: playwright and a browser (skips itself if missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForStartupGone } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

function buildNextApp() {
    const dir = buildApp(30);
    fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
    fs.cpSync(path.join(path.dirname(NEXT_SRC), 'assets'), path.join(dir, 'assets'), { recursive: true });
    const file = path.join(dir, 'ui-next', 'index.html');
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    return dir;
}

describe('visualizer in the player section', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = buildNextApp();
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open({ scale = 1, width = 1300 } = {}) {
        const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: scale });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html'));
        await page.waitForSelector('.player-host .player-container');
        await waitForStartupGone(page);
        // stand-ins for the engine's analyser, and a playing song
        await page.evaluate(() => {
            window.__analyserOn = false;
            window.__frames = 0; // reads of the spectrum: one per drawn frame of the visualizer, nothing else counts
            window.setVisualizerActive = (on) => ((window.__analyserOn = on), true);
            window.getVisualizerAnalyser = () =>
                window.__analyserOn
                    ? {
                          frequencyBinCount: 1024,
                          context: { sampleRate: 48000 },
                          getByteFrequencyData(a) {
                              window.__frames++;
                              for (let i = 0; i < a.length; i++) a[i] = Math.max(0, 230 - i * 0.6);
                          }
                      }
                    : null;
            
        });
        return { page, context, errors };
    }
    const setting = (page, on) =>
        page.evaluate(async (value) => {
            const m = await import(new URL('views/playback/visualizer-setting.js', location.href).href);
            m.setVisualizerOn(value);
        }, on);
    const play = (page, playing) =>
        page.evaluate((value) => {
            const a = window.audioElement;
            Object.defineProperty(a, 'paused', { configurable: true, get: () => !value });
            a.dispatchEvent(new Event(value ? 'play' : 'pause'));
        }, playing);
    const framesOver = (page, ms) =>
        page.evaluate(async (wait) => {
            const before = window.__frames;
            await new Promise((r) => setTimeout(r, wait));
            return window.__frames - before;
        }, ms);
    const litRows = (page) =>
        page.evaluate(() => {
            const c = document.querySelector('.visualizer-canvas');
            const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let top = c.height;
            for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3] > 0) { top = Math.min(top, y); }
            return { lit: c.height - top, height: c.height };
        });

    test('off by default: no canvas, and the engine is not asked for an analyser', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context, errors } = await open();
        assert.equal(await page.$('.visualizer-canvas'), null);
        assert.equal(await page.evaluate(() => window.__analyserOn), false);
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('on: a canvas fills the player section behind the controls and never takes a click; off removes it and the analyser', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context, errors } = await open();
        await setting(page, true);
        await page.waitForSelector('.visualizer-canvas');
        const r = await page.evaluate(() => {
            const host = document.querySelector('.player-host');
            const c = document.querySelector('.visualizer-canvas');
            const play = document.querySelector('#play-btn').getBoundingClientRect();
            const top = document.elementFromPoint(play.x + play.width / 2, play.y + play.height / 2);
            const hostBox = host.getBoundingClientRect();
            const box = c.getBoundingClientRect();
            return { analyser: window.__analyserOn, pe: getComputedStyle(c).pointerEvents, topIsButton: top.closest('#play-btn') !== null, same: Math.abs(box.width - hostBox.width) < 2 && Math.abs(box.height - hostBox.height) < 2, first: host.firstElementChild === c };
        });
        assert.equal(r.analyser, true);
        assert.equal(r.pe, 'none');
        assert.equal(r.topIsButton, true, 'the play button is above the canvas');
        assert.equal(r.same, true, 'it covers the whole player section');
        await setting(page, false);
        assert.equal(await page.$('.visualizer-canvas'), null);
        assert.equal(await page.evaluate(() => window.__analyserOn), false);
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('the canvas draws at scale 1 even on a scale 2 screen', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context } = await open({ scale: 2 });
        await setting(page, true);
        await page.waitForSelector('.visualizer-canvas');
        const r = await page.evaluate(() => ({ w: document.querySelector('.visualizer-canvas').width, css: document.querySelector('.player-host').clientWidth }));
        assert.equal(r.w, r.css);
        await context.close();
    });

    test('playing: bars rise and frames run at about 30 a second; paused: the bars settle and no frame is scheduled', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context } = await open();
        await setting(page, true);
        await page.waitForSelector('.visualizer-canvas');
        await play(page, true);
        await page.waitForTimeout(400);
        const rising = await litRows(page);
        assert.ok(rising.lit > rising.height * 0.3, `bars are up: ${rising.lit} of ${rising.height}`);
        const running = await framesOver(page, 1000);
        assert.ok(running >= 20 && running <= 36, `frames while playing: ${running}`); // one spectrum read per drawn frame, thinned to 30 a second
        await play(page, false);
        await page.waitForTimeout(2500);
        const rest = await litRows(page);
        assert.equal(rest.lit, 0, 'paused and settled: no bars at all, not even a baseline');
        assert.equal(await framesOver(page, 600), 0, 'nothing is scheduled while paused and settled');
        await page.screenshot({ path: path.join(require('os').tmpdir(), 'viz-paused.png') });
        await context.close();
    });

    test('less animation on: no frames and nothing drawn', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context } = await open();
        await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduced'));
        await setting(page, true);
        await page.waitForSelector('.visualizer-canvas');
        await play(page, true);
        await page.waitForTimeout(300);
        assert.equal(await framesOver(page, 600), 0, 'reduced motion: nothing runs');
        const lit = await litRows(page);
        assert.equal(lit.lit, 0, 'nothing is drawn');
        await context.close();
    });

    test('nothing plays: no bars at the bottom, from the first moment', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context } = await open();
        await setting(page, true);
        await page.waitForSelector('.visualizer-canvas');
        await page.waitForTimeout(300);
        assert.equal((await litRows(page)).lit, 0);
        await context.close();
    });

    // A real AnalyserNode fed with a made-up song (a kick every half second, a bass line, chords and hi-hats), at a quiet and at a loud level,
    // through the real functions of visualizer-math.js: the bars must move with the music and must not sit at the top.
    test('with a real analyser the bars move with the music at any loudness, and do not sit on the ceiling', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context } = await open();
        await page.mouse.click(10, 10); // a click lets the page's audio start
        const run = (loudness) =>
            page.evaluate(async (level) => {
                const m = await import(new URL('views/playback/visualizer-math.js', location.href).href);
                const ac = new AudioContext({ sampleRate: 44100 });
                await ac.resume();
                const sr = ac.sampleRate;
                const len = sr * 4;
                const buf = ac.createBuffer(1, len, sr);
                const d = buf.getChannelData(0);
                const notes = [55, 65.4, 73.4, 49];
                for (let i = 0; i < len; i++) {
                    const time = i / sr;
                    const kt = time % 0.5;
                    let v = 0.9 * Math.sin(2 * Math.PI * (45 * kt + 45 * 0.06 * (1 - Math.exp(-kt / 0.06)))) * Math.exp(-kt / 0.12);
                    v += 0.3 * Math.sin(2 * Math.PI * notes[Math.floor(time) % 4] * time);
                    const ct = time % 2;
                    for (const fr of [220, 277, 330, 440, 660]) v += 0.08 * Math.min(1, ct * 8) * Math.exp(-ct / 1.2) * Math.sin(2 * Math.PI * fr * time);
                    v += 0.25 * (Math.random() * 2 - 1) * Math.exp(-(time % 0.25) / 0.03) * (Math.floor(time * 4) % 2 ? 1 : 0.5);
                    d[i] = v;
                }
                let peak = 0;
                for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
                for (let i = 0; i < len; i++) d[i] *= level / peak;
                const src = ac.createBufferSource();
                src.buffer = buf;
                src.loop = true;
                const an = ac.createAnalyser();
                an.fftSize = 2048;
                an.smoothingTimeConstant = 0;
                const mute = ac.createGain();
                mute.gain.value = 0;
                src.connect(an);
                an.connect(mute);
                mute.connect(ac.destination);
                src.start();
                const bars = 131;
                const ranges = m.binRanges(bars, an.frequencyBinCount, sr);
                const targets = new Float32Array(bars);
                const levels = new Float32Array(bars);
                const freq = new Uint8Array(an.frequencyBinCount);
                const gain = m.createAutoGain();
                const series = [];
                let pinned = 0;
                await new Promise((r) => setTimeout(r, 400));
                for (let f = 0; f < 150; f++) {
                    await new Promise((r) => setTimeout(r, 33));
                    an.getByteFrequencyData(freq);
                    m.barTargets(freq, ranges, targets);
                    for (let i = 0; i < bars; i++) targets[i] = m.aboveFloor(targets[i]);
                    gain.apply(targets);
                    m.smoothLevels(levels, targets);
                    const h = Array.from(levels, (v) => m.shapeLevel(v));
                    series.push([h[8], h[60], h[115]]);
                    pinned += h.filter((v) => v > 0.95).length / bars;
                }
                await ac.close();
                const sd = (a) => {
                    const mean = a.reduce((x, y) => x + y, 0) / a.length;
                    return { mean, sd: Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / a.length) };
                };
                return { low: sd(series.map((s) => s[0])), mid: sd(series.map((s) => s[1])), high: sd(series.map((s) => s[2])), pinned: pinned / series.length };
            }, loudness);
        const quiet = await run(0.15);
        const loud = await run(1);
        for (const [name, r] of [['quiet', quiet], ['loud', loud]]) {
            assert.ok(r.pinned < 0.25, `${name}: ${Math.round(r.pinned * 100)}% of the bars at the ceiling`);
            assert.ok(r.mid.sd > 0.04 && r.high.sd > 0.04, `${name}: the mid and high bars move (sd ${r.mid.sd.toFixed(2)}, ${r.high.sd.toFixed(2)})`);
            assert.ok(r.mid.mean < 0.8 && r.high.mean < 0.8, `${name}: the mid and high bars are not up on average`);
            assert.ok(r.low.mean > 0.3, `${name}: the bass bars are clearly up (${r.low.mean.toFixed(2)})`);
        }
        assert.ok(Math.abs(loud.mid.mean - quiet.mid.mean) < 0.3, 'a quiet and a loud song are drawn at similar heights');
        await context.close();
    });

    test('the song info slides away to the left while the bars play and the pointer is elsewhere, and returns on hover, on pause and with less animation', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context } = await open();
        await setting(page, true);
        await page.waitForSelector('.visualizer-canvas');
        const left = () => page.evaluate(() => {
            const e = document.querySelector('.player-host .player-left');
            const cs = getComputedStyle(e);
            return { opacity: Number(cs.opacity), x: new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform).m41 };
        });
        await page.mouse.move(5, 5);
        assert.equal((await left()).opacity, 1, 'nothing plays: the song info stays');
        await play(page, true);
        await page.waitForTimeout(1700); // the slide-out waits a moment (900 ms) and then takes 320 ms
        const away = await left();
        assert.equal(away.opacity, 0, 'faded out');
        assert.ok(away.x < -20, `slid towards the left edge (${away.x})`);
        const host = await page.locator('.player-host').boundingBox();
        await page.mouse.move(host.x + host.width / 2, host.y + host.height / 2);
        await page.waitForTimeout(400);
        assert.equal((await left()).opacity, 1, 'back on hover');
        await page.mouse.move(5, 5);
        await play(page, false);
        await page.waitForTimeout(1700);
        assert.equal((await left()).opacity, 1, 'paused: no bars, so the song info stays');
        await play(page, true);
        await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduced'));
        await page.waitForTimeout(1700);
        assert.equal((await left()).opacity, 1, 'less animation: it stays where it is');
        await context.close();
    });

    test('the song info comes back instantly on hover and leaves with an animation; a mouse click on a button does not keep it open', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context } = await open();
        await setting(page, true);
        await page.waitForSelector('.visualizer-canvas');
        const opacity = () => page.evaluate(() => Number(getComputedStyle(document.querySelector('.player-host .player-left')).opacity));
        await page.mouse.move(5, 5);
        await play(page, true);
        await page.waitForTimeout(1700);
        assert.equal(await opacity(), 0);
        const host = await page.locator('.player-host').boundingBox();
        await page.mouse.move(host.x + host.width / 2, host.y + host.height / 2);
        await page.waitForTimeout(60);
        assert.equal(await opacity(), 1, 'instant on hover');
        await page.mouse.move(5, 5);
        await page.waitForTimeout(400);
        assert.equal(await opacity(), 1, 'the leave waits a moment first');
        await page.waitForTimeout(1300);
        assert.equal(await opacity(), 0, 'and then it goes');
        // the reported bug: a mouse click leaves a button focused, and that must not hold the song info open
        await page.mouse.move(host.x + host.width / 2, host.y + host.height / 2);
        await page.click('#shuffle-btn', { force: true });
        await page.mouse.move(5, 5);
        await page.waitForTimeout(1700);
        assert.equal(await opacity(), 0, 'it hides although a button still has focus after the click');
        await context.close();
    });

    test('left side: the canvas is a strip from the left edge, 30 to 40 % of the section, ending before the centre column; full width again on switching back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        for (const width of [1300, 900]) {
            const { page, context, errors } = await open({ width });
            await setting(page, true);
            await page.waitForSelector('.visualizer-canvas');
            await page.evaluate(async () => {
                const m = await import(new URL('views/playback/visualizer-setting.js', location.href).href);
                m.setVisualizerWidth('left');
            });
            await page.waitForTimeout(150);
            const r = await page.evaluate(() => {
                const host = document.querySelector('.player-host').getBoundingClientRect();
                const c = document.querySelector('.visualizer-canvas').getBoundingClientRect();
                const centre = document.querySelector('.player-center').getBoundingClientRect();
                return { x: c.left - host.left, share: c.width / host.width, right: c.right, centreLeft: centre.left };
            });
            assert.ok(Math.abs(r.x) < 1, `starts at the left edge (${r.x})`);
            assert.ok(r.share >= 0.299 && r.share <= 0.401, `30 to 40 % of the section at ${width} (${r.share})`);
            assert.ok(r.right <= Math.max(r.centreLeft, 0.3 * (r.right / r.share)) + 1, `ends before the centre column, or at 30 % when the window is too narrow for that (${r.right} vs ${r.centreLeft})`);
            await page.evaluate(async () => {
                const m = await import(new URL('views/playback/visualizer-setting.js', location.href).href);
                m.setVisualizerWidth('full');
            });
            await page.waitForTimeout(150);
            const full = await page.evaluate(() => document.querySelector('.visualizer-canvas').getBoundingClientRect().width / document.querySelector('.player-host').getBoundingClientRect().width);
            assert.ok(full > 0.99, 'full width again');
            assert.deepEqual(errors, []);
            await context.close();
        }
    });

    test('"Keep" in the song info setting: the left part stays while the bars play, and "Hide" slides it away again', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context } = await open();
        await setting(page, true);
        await page.waitForSelector('.visualizer-canvas');
        const opacity = () => page.evaluate(() => Number(getComputedStyle(document.querySelector('.player-host .player-left')).opacity));
        const info = (value) =>
            page.evaluate(async (v) => {
                const m = await import(new URL('views/playback/visualizer-setting.js', location.href).href);
                m.setVisualizerSongInfo(v);
            }, value);
        await info('keep');
        await page.mouse.move(5, 5);
        await play(page, true);
        await page.waitForTimeout(1700);
        assert.equal(await opacity(), 1, 'kept');
        assert.equal(await page.evaluate(() => document.querySelector('.player-host').hasAttribute('data-viz-playing')), false);
        await info('hide');
        await page.waitForTimeout(1700);
        assert.equal(await opacity(), 0, 'hidden again');
        await context.close();
    });

    test('the quick toggle in the player bar: it follows the setting and changes it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context, errors } = await open();
        const button = page.locator('.player-right-controls .player-visualizer-toggle');
        assert.equal(await button.count(), 1);
        assert.equal(await button.getAttribute('aria-pressed'), 'false');
        assert.equal(await page.$('.visualizer-canvas'), null);
        await button.click();
        await page.waitForSelector('.visualizer-canvas');
        assert.equal(await button.getAttribute('aria-pressed'), 'true');
        await setting(page, false); // changed from somewhere else (Settings)
        assert.equal(await button.getAttribute('aria-pressed'), 'false');
        assert.equal(await page.$('.visualizer-canvas'), null);
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('the controls still work with it on: a click never lands on the canvas', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context, errors } = await open();
        await setting(page, true);
        await page.waitForSelector('.visualizer-canvas');
        const hit = await page.evaluate(() => {
            const ids = ['#play-btn', '#prev-btn', '#next-btn', '#shuffle-btn', '#repeat-btn', '.progress-container', '#volume-slider'];
            return ids.map((id) => {
                const e = document.querySelector(id);
                const r = e.getBoundingClientRect();
                const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                return [id, !!top && !top.classList.contains('visualizer-canvas'), top && (top.id || top.className)]; // with no queue some buttons are inert and let the click through to their row, but never to the canvas
            });
        });
        for (const [id, ok, got] of hit) assert.equal(ok, true, `${id} is hit through to the canvas (${got})`);
        assert.deepEqual(errors, []);
        await context.close();
    });
});

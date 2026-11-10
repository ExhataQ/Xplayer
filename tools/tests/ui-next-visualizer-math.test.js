// The visualizer's pure parts and its setting (visualizer plan V2, V5). Plain Node, no browser.
// Run: node --test tools/tests/ui-next-visualizer-math.test.js
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const NEXT = path.join(__dirname, '..', '..', 'src', 'ui-next');
const url = (...p) => pathToFileURL(path.join(NEXT, ...p)).href;
const read = (...p) => fs.readFileSync(path.join(NEXT, ...p), 'utf8');

describe('visualizer-math.js', () => {
    let m;
    before(async () => {
        m = await import(url('views', 'playback', 'visualizer-math.js'));
    });

    test('the bar count follows the width, about one per 11 px, kept inside the limits', () => {
        assert.equal(m.barCountFor(1440), 131);
        assert.equal(m.barCountFor(100), m.DESIGN.minBars);
        assert.equal(m.barCountFor(9999), m.DESIGN.maxBars);
        assert.equal(m.barCountFor(0), m.DESIGN.minBars);
        assert.equal(m.barCountFor('x'), m.DESIGN.minBars);
    });

    test('the canvas never draws above the cap, and bad scales fall back to 1', () => {
        assert.equal(m.canvasScale(2), 1);
        assert.equal(m.canvasScale(1.5), 1);
        assert.equal(m.canvasScale(1), 1);
        assert.equal(m.canvasScale(0.75), 0.75);
        assert.equal(m.canvasScale(NaN), 1);
        assert.equal(m.canvasScale(0), 1);
        assert.equal(m.canvasScale(3, 1.25), 1.25);
    });

    test('bin ranges: one per bar, in order, never empty, never past the last bin, low to high', () => {
        for (const bars of [24, 64, 131, 160]) {
            const ranges = m.binRanges(bars, 1024, 48000);
            assert.equal(ranges.length, bars);
            let prev = -1;
            for (const [s, e] of ranges) {
                assert.ok(s >= 0 && e >= s && e <= 1023, `${s}-${e}`);
                assert.ok(s >= prev, 'in order');
                prev = s;
            }
            assert.ok(ranges[0][0] < ranges[bars - 1][0]);
        }
        const tiny = m.binRanges(10, 8, 48000);
        assert.ok(tiny.every(([s, e]) => s <= 7 && e <= 7));
    });

    test('bar targets are the loudest bin in the range, 0 to 1', () => {
        const freq = Uint8Array.from([0, 255, 10, 0, 128]);
        const t = m.barTargets(freq, [[0, 1], [2, 3], [4, 4]]);
        assert.deepEqual([...t].map((n) => Math.round(n * 100) / 100), [1, 0.04, 0.5]);
    });

    test('bars rise fast and fall slowly, and report when everything has settled', () => {
        const levels = new Float32Array([0, 1]);
        m.smoothLevels(levels, new Float32Array([1, 0]));
        assert.ok(levels[0] > 0.5, 'rises fast');
        assert.ok(levels[1] > 0.7 && levels[1] < 1, 'falls over a few frames');
        let moving = true;
        for (let i = 0; i < 200 && moving; i++) moving = m.smoothLevels(levels, null);
        assert.equal(moving, false, 'settles with no target');
        assert.deepEqual([...levels], [0, 0]);
    });

    test('the quiet floor: nothing under it, then 0 to 1 above it', () => {
        assert.equal(m.aboveFloor(0), 0);
        assert.equal(m.aboveFloor(m.DESIGN.floor), 0);
        assert.equal(m.aboveFloor(1), 1);
        assert.equal(m.aboveFloor('x'), 0);
        assert.ok(Math.abs(m.aboveFloor(0.6) - 0.5) < 1e-9, 'halfway between the floor (0.2) and full is 0.6');
    });

    test('the auto level: a loud song and a quiet song both reach the top at their peaks; it never makes silence loud; it falls slowly', () => {
        const run = (scale) => {
            const g = m.createAutoGain();
            let top = 0;
            for (let f = 0; f < 60; f++) {
                const levels = Float32Array.from([0.2, 0.5, 1].map((v) => v * scale * (f % 10 < 2 ? 1 : 0.4)));
                g.apply(levels);
                top = Math.max(top, ...levels);
                assert.ok(Math.max(...levels) <= 1);
            }
            return top;
        };
        assert.ok(run(1) > 0.99);
        assert.ok(run(0.5) > 0.99, 'a song half as loud still reaches the top');
        const quiet = m.createAutoGain();
        const hiss = quiet.apply(Float32Array.from([0.01, 0.02]));
        assert.ok(hiss[1] < 0.1, 'near silence stays near silence');
        const g = m.createAutoGain();
        g.apply(Float32Array.from([1]));
        const after = g.apply(Float32Array.from([0.5]));
        assert.ok(after[0] > 0.45 && after[0] < 0.55, 'one frame after a loud peak the reference has barely moved');
        g.reset();
        assert.equal(g.peak, m.DESIGN.gainMin);
    });

    test('the log curve lifts small sounds: 0 and 1 stay put, it only rises, and it stays above a straight line', () => {
        assert.equal(m.shapeLevel(0), 0);
        assert.equal(m.shapeLevel(1), 1);
        assert.equal(m.shapeLevel('x'), 0);
        assert.equal(m.shapeLevel(5), 1);
        let prev = 0;
        for (let v = 0.02; v <= 1; v += 0.02) {
            const out = m.shapeLevel(v);
            assert.ok(out >= prev, `rises at ${v}`);
            assert.ok(out > v - 1e-9, `${v} is drawn higher than a straight line`);
            prev = out;
        }
        assert.ok(m.shapeLevel(0.1) > 0.18 && m.shapeLevel(0.1) < 0.3, 'a quiet 0.1 is drawn at about 0.2');
        assert.ok(m.shapeLevel(0.5) < 0.8, 'but the middle is not pushed to the top');
    });

    test('heights: a share of the strip, at least the baseline, clamped', () => {
        assert.equal(m.barHeight(1, 100), 78);
        assert.equal(m.barHeight(0, 100, { min: 2 }), 2);
        assert.equal(m.barHeight(5, 100), 78);
        assert.equal(m.barHeight(-1, 100), 0);
    });

    test('layout: whole pixels, inside the canvas, in order, no overlaps', () => {
        for (const [width, bars] of [[1440, 131], [1000, 91], [300, 27]]) {
            const l = m.barLayout(width, bars, 3);
            assert.equal(l.length, bars);
            let prevEnd = 0;
            for (const [x, w] of l) {
                assert.ok(Number.isInteger(x) && Number.isInteger(w) && w >= 1);
                assert.ok(x >= prevEnd && x + w <= width, `${x}+${w}`);
                prevEnd = x + w;
            }
        }
    });

    test('colours: hex, short hex and rgb() are read; anything else is null', () => {
        assert.deepEqual(m.parseColor('#eba43a'), [235, 164, 58]);
        assert.deepEqual(m.parseColor(' #fa0 '), [255, 170, 0]);
        assert.deepEqual(m.parseColor('rgb(1, 2, 3)'), [1, 2, 3]);
        assert.deepEqual(m.parseColor('rgb(1 2 3 / 0.5)'), [1, 2, 3]);
        assert.equal(m.parseColor('var(--x)'), null);
        assert.equal(m.parseColor(''), null);
    });
});

describe('visualizer-setting.js', () => {
    const load = () => import(url('views', 'playback', 'visualizer-setting.js') + '?t=' + Math.random());
    function installStorage(initial = {}) {
        const data = new Map(Object.entries(initial));
        globalThis.localStorage = { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => void data.set(k, String(v)) };
        return data;
    }

    test('off until turned on, the choice is kept, and watchers hear each change once', async () => {
        const data = installStorage();
        const s = await load();
        assert.equal(s.isVisualizerOn(), false);
        const seen = [];
        s.watchVisualizer((on) => seen.push(on));
        s.setVisualizerOn(true);
        s.setVisualizerOn(true);
        s.setVisualizerOn(false);
        assert.deepEqual(seen, [true, false]);
        s.setVisualizerOn(true);
        assert.equal(data.get('xplayer.ui-next.visualizer'), 'on');
        assert.equal((await load()).isVisualizerOn(), true);
    });

    test('anything but "on" is off, and blocked storage does not throw', async () => {
        installStorage({ 'xplayer.ui-next.visualizer': 'yes' });
        assert.equal((await load()).isVisualizerOn(), false);
        globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
        const s = await load();
        s.setVisualizerOn(true);
        assert.equal(s.isVisualizerOn(), true);
    });
});

describe('visualizer width (full / left side)', () => {
    let m;
    before(async () => {
        m = await import(url('views', 'playback', 'visualizer-math.js'));
    });

    test('the left strip ends just before the centre column, kept between 30 and 40 % of the section', () => {
        assert.equal(m.leftStripWidth(1300, 450), 438); // the centre starts at 450: 12 px short of it
        assert.equal(m.leftStripWidth(1300, 200), 390); // never under 30 %
        assert.equal(m.leftStripWidth(1300, 700), 520); // never over 40 %
        assert.equal(m.leftStripWidth(0, 0), 0);
    });

    test('the width setting: full by default, anything unknown (the old "compact" too) is full, the choice is kept and heard once', async () => {
        const data = new Map([['xplayer.ui-next.visualizer-width', 'compact']]);
        globalThis.localStorage = { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => void data.set(k, String(v)) };
        const s = await import(url('views', 'playback', 'visualizer-setting.js') + '?w=' + Math.random());
        assert.equal(s.getVisualizerWidth(), 'full');
        const seen = [];
        s.watchVisualizerWidth((v) => seen.push(v));
        s.setVisualizerWidth('left');
        s.setVisualizerWidth('left');
        s.setVisualizerWidth('nonsense');
        assert.deepEqual(seen, ['left', 'full']);
        s.setVisualizerWidth('left');
        assert.equal(data.get('xplayer.ui-next.visualizer-width'), 'left');
    });
});

describe('song info while the visualizer plays', () => {
    test('hide by default, "keep" is remembered, anything else is hide, watchers hear each change once', async () => {
        const data = new Map([['xplayer.ui-next.visualizer-song-info', 'nonsense']]);
        globalThis.localStorage = { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => void data.set(k, String(v)) };
        const s = await import(url('views', 'playback', 'visualizer-setting.js') + '?i=' + Math.random());
        assert.equal(s.getVisualizerSongInfo(), 'hide');
        const seen = [];
        s.watchVisualizerSongInfo((v) => seen.push(v));
        s.setVisualizerSongInfo('keep');
        s.setVisualizerSongInfo('keep');
        s.setVisualizerSongInfo('x');
        assert.deepEqual(seen, ['keep', 'hide']);
        s.setVisualizerSongInfo('keep');
        assert.equal(data.get('xplayer.ui-next.visualizer-song-info'), 'keep');
    });
});

describe('wiring', () => {
    test('the renderer is mounted with the other playback parts, and Settings has the row in the Player bar section', () => {
        assert.match(read('views', 'playback', 'playback.js'), /mountSmoothSeek, mountVisualizer, mountVisualizerToggle, mountQueuePanel/);
        assert.match(read('shell', 'appearance-settings.js'), /playerBar\.append\(buildVisualizerRow\(\{ el, segmented \}\), buildVisualizerWidthRow\(\{ el, segmented \}\), buildVisualizerSongInfoRow\(\{ el, segmented \}\)\)/);
    });

    test('the canvas is passive, behind the controls, and the colour is the accent token (no raw colour in the renderer or its styles)', () => {
        const css = read('views', 'playback', 'player-bar.css');
        const block = css.slice(css.indexOf('.visualizer-canvas {'));
        assert.match(block, /pointer-events: none/);
        assert.match(block, /z-index: 0/);
        assert.doesNotMatch(block.slice(0, block.indexOf('}') + 1), /#[0-9a-f]{3,6}|rgb\(/i);
        const js = read('views', 'playback', 'visualizer.js');
        assert.match(js, /getPropertyValue\('--accent'\)/);
    });

    test('start-up: when the engine\'s audio bus is not there yet at mount, the renderer tries again once the page has loaded (found by running the real app)', () => {
        const js = read('views', 'playback', 'visualizer.js');
        assert.match(js, /document\.readyState !== 'complete'/);
        assert.match(js, /window\.addEventListener\('load', retryOnLoad, \{ once: true \}\)/);
        assert.match(js, /window\.removeEventListener\('load', retryOnLoad\)/);
    });

    test('the renderer schedules no frame unless the setting is on, the window is visible and animation is not reduced', () => {
        const js = read('views', 'playback', 'visualizer.js');
        assert.match(js, /isVisualizerOn\(\) && canvas && !document\.hidden && !reducedMotion\(\)/);
    });
});

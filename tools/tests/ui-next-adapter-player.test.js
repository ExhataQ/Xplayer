// adapter/player-parts.js (proposal for R-C3 and R-C4): named access to the player's elements and one shared time reader.
// Real browser, real engine, generated WAV, like ui-next-shell.test.js.   Run: node --test tools/tests/ui-next-adapter-player.test.js
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

function writeWav(file, seconds = 6) {
    const rate = 8000, n = rate * seconds, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
    b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 3000), 44 + i * 2);
    fs.writeFileSync(file, b);
}

describe('adapter/player-parts.js', { concurrency: false }, () => {
    let browser, dir, wav, skip, moduleUrl;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
        wav = path.join(dir, 'tone.wav');
        writeWav(wav);
        fs.mkdirSync(path.join(dir, 'ui-next', 'dev'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'ui-next', 'dev', 'blank.html'), '<!doctype html><meta charset="utf-8"><body></body>');
        moduleUrl = 'file://' + path.join(dir, 'ui-next', 'adapter', 'player-parts.js').replace(/\\/g, '/');
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        await page.evaluate(([u, m]) => import(m).then((mod) => { window.P = mod; SONGS_DATA.forEach((s) => (s.url = u)); }), ['file://' + wav.replace(/\\/g, '/'), moduleUrl]);
        return { page, errors };
    }
    const play = async (page) => {
        await page.mouse.click(5, 5);
        await page.evaluate(() => createQueueFromSongList(SONGS_DATA.slice(0, 4), 0, VIEWS.ALL_SONGS));
        await page.waitForFunction(() => !audioElement.paused && audioElement.currentTime > 0.2, null, { timeout: 8000 });
    };

    test('every named part resolves to an element inside the visible player; unknown names give null', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const out = await page.evaluate(() => ({
            names: P.PLAYER_PART_NAMES.length,
            inside: P.PLAYER_PART_NAMES.filter((n) => !P.playerPart(n) || !P.playerPart(n).closest('.player-host')),
            play: P.playerPart('play').id, seek: P.playerPart('seek').className, volume: P.playerPart('volume').id,
            unknown: P.playerPart('nope'), frozen: Object.isFrozen(P.PLAYER_PART_NAMES)
        }));
        assert.equal(out.names, 18);
        assert.deepEqual(out.inside, []);
        assert.deepEqual([out.play, out.seek, out.volume, out.unknown, out.frozen], ['play-btn', 'progress-container', 'volume-slider', null, true]);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('onTime reports advancing time, duration and play state; unsubscribe stops it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate(() => { window.seen = []; window.off = P.onTime((s) => window.seen.push(s)); });
        await play(page);
        await page.waitForFunction(() => window.seen.some((s) => s.currentTime > 0.8), null, { timeout: 6000 });
        const run = await page.evaluate(() => { const last = window.seen[window.seen.length - 1]; return { duration: last.duration, playing: last.playing, times: window.seen.map((s) => s.currentTime) }; });
        assert.ok(Math.abs(run.duration - 6) < 0.2, `duration ${run.duration}`);
        assert.equal(run.playing, true);
        assert.ok(run.times.every((v, i, a) => i === 0 || v >= a[i - 1] - 0.001), 'time never goes backwards');
        await page.evaluate(() => audioElement.pause());
        await page.waitForFunction(() => window.seen[window.seen.length - 1].playing === false, null, { timeout: 3000 });
        const count = await page.evaluate(() => { window.off(); return window.seen.length; });
        await page.evaluate(() => audioElement.play());
        await page.waitForTimeout(700);
        assert.equal(await page.evaluate(() => window.seen.length), count, 'no calls after unsubscribe');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the time reader follows the engine when it swaps audio elements at a track change (gapless playback, on by default)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate(() => { window.seen = []; window.off = P.onTime((s) => window.seen.push(s)); });
        await play(page);
        const first = await page.evaluate(() => ({ same: audioElement === document.getElementById('audio'), src: audioElement.currentSrc }));
        assert.equal(first.same, true, 'the first track plays on the page\'s own element');
        await page.click('#next-btn');
        await page.waitForFunction(() => document.getElementById('player-title').textContent.includes('number 2'), null, { timeout: 4000 });
        await page.waitForFunction(() => audioElement !== document.getElementById('audio'), null, { timeout: 3000 });
        // after the swap the reader still reports the playing element: time moves, play state is right
        const before = await page.evaluate(() => window.seen.length);
        await page.waitForFunction((n) => window.seen.length > n + 2 && window.seen[window.seen.length - 1].currentTime > 0.3 && window.seen[window.seen.length - 1].playing, before, { timeout: 5000 });
        const now = await page.evaluate(() => ({ last: window.seen[window.seen.length - 1], active: audioElement.currentSrc }));
        assert.equal(now.last.src, now.active, 'the reported source is the active element\'s');
        assert.equal(now.last.playing, true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('subscribers share one set of listeners: the app already has some, three more add none (L-04)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const out = await page.evaluate(() => {
            const audio = document.getElementById('audio');
            const added = [], removed = [];
            const add = audio.addEventListener.bind(audio), remove = audio.removeEventListener.bind(audio);
            audio.addEventListener = (n, ...r) => (added.push(n), add(n, ...r));
            audio.removeEventListener = (n, ...r) => (removed.push(n), remove(n, ...r));
            const offs = [P.onTime(() => {}), P.onTime(() => {}), P.onTime(() => {})];
            offs.forEach((off) => off());
            return { added: added.length, removed: removed.length };
        });
        assert.deepEqual(out, { added: 0, removed: 0 }, 'the player views already subscribed, so the listeners exist and stay');
        await page.close();
    });

    test('on a page with no other subscriber the first one attaches the listeners and the last one removes them (L-04)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const page = await browser.newPage();
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/').replace('index.html', 'dev/blank.html'));
        const out = await page.evaluate(async (m) => {
            document.body.innerHTML = '<audio id="audio"></audio>';
            const mod = await import(m);
            const audio = document.getElementById('audio');
            const added = [], removed = [];
            const add = audio.addEventListener.bind(audio), remove = audio.removeEventListener.bind(audio);
            audio.addEventListener = (n, ...r) => (added.push(n), add(n, ...r));
            audio.removeEventListener = (n, ...r) => (removed.push(n), remove(n, ...r));
            const offs = [mod.onTime(() => {}), mod.onTime(() => {}), mod.onTime(() => {})];
            const afterAdd = added.filter((n) => n === 'timeupdate').length;
            offs[0](); offs[1]();
            const midRemoved = removed.length;
            offs[2]();
            return { afterAdd, midRemoved, removedTimeupdate: removed.filter((n) => n === 'timeupdate').length, balanced: added.length === removed.length };
        }, moduleUrl);
        assert.deepEqual(out, { afterAdd: 1, midRemoved: 0, removedTimeupdate: 1, balanced: true });
        await page.close();
    });
});

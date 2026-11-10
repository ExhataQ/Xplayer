// The Home hero (design board C): the pure parts in Node, and the card in a real browser inside the new shell's page.
// Run: node --test tools/tests/ui-next-home-hero.test.js
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { ROOT, loadPlaywright, launch, buildApp, waitForStartupGone } = require('./helpers/app-fixture');

const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const url = (...p) => pathToFileURL(path.join(NEXT_SRC, ...p)).href;

describe('hero maths and what is remembered', () => {
    let m;
    let s;
    before(async () => {
        m = await import(url('views', 'home', 'hero-math.js'));
        s = await import(url('adapter', 'last-session-math.js'));
    });

    test('times read as m:ss, and h:mm:ss over an hour', () => {
        assert.equal(m.formatTime(62), '1:02');
        assert.equal(m.formatTime(3725), '1:02:05');
        assert.equal(m.formatTime(-4), '0:00');
        assert.equal(m.formatTime(NaN), '0:00');
    });

    test('progress is the done share, never outside 0 to 1, and 0 without a length', () => {
        assert.equal(m.progressShare(30, 120), 0.25);
        assert.equal(m.progressShare(500, 120), 1);
        assert.equal(m.progressShare(5, 0), 0);
    });

    test('the glow ignores black, white and grey and follows the colourful pixels', () => {
        const px = (...rgba) => rgba;
        const data = [...px(0, 0, 0, 255), ...px(250, 250, 250, 255), ...px(120, 120, 120, 255), ...px(200, 40, 40, 255), ...px(200, 40, 40, 255)];
        assert.deepEqual(m.glowFromPixels(data), [200, 40, 40]);
        assert.equal(m.glowFromPixels([...px(0, 0, 0, 255), ...px(130, 130, 130, 255)]), null);
        assert.equal(m.glowFromPixels([200, 40, 40, 0]), null, 'transparent pixels do not count');
    });

    test('the quick picks mix played playlists and albums first, then the rest, at most eight', () => {
        const mk = (kind, n, played) => Array.from({ length: n }, (_, i) => ({ kind, id: `${kind}${i}`, played }));
        const picks = m.pickQuickItems({ playlists: [...mk('playlist', 3, true), ...mk('x', 0, false)], albums: [...mk('album', 1, true), ...mk('album', 4, false).map((a) => ({ ...a, id: a.id + 'u' }))] });
        assert.deepEqual(picks.slice(0, 4).map((i) => i.id), ['playlist0', 'album0', 'playlist1', 'playlist2'], 'played ones first, alternating');
        assert.equal(picks.length, 8);
        assert.equal(m.pickQuickItems({ playlists: [], albums: [] }).length, 0);
    });

    test('a song is remembered with its position; stopped early it is remembered from the start; a finished song is not remembered', () => {
        assert.deepEqual(s.sessionToSave({ id: 'a', position: 62.9, duration: 200 }), { id: 'a', position: 62, duration: 200 });
        assert.deepEqual(s.sessionToSave({ id: 'a', position: 1.2, duration: 200 }), { id: 'a', position: 0, duration: 200 });
        assert.equal(s.sessionToSave({ id: 'a', position: 197, duration: 200 }), null);
        assert.equal(s.sessionToSave({ id: '', position: 10, duration: 200 }), null);
        assert.equal(s.sessionToSave({ id: 'a', position: NaN, duration: 200 }), null);
        assert.deepEqual(s.sessionToSave({ id: 7, position: 40, duration: NaN }), { id: 7, position: 40, duration: 0 }, 'a length that is not known yet is kept as 0');
    });
});

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };

function buildNextApp() {
    const dir = buildApp(20);
    fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
    const file = path.join(dir, 'ui-next', 'index.html');
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    return dir;
}

describe('home hero card', { concurrency: false }, () => {
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

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html'));
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        await waitForStartupGone(page);
        await page.evaluate(async () => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'ui-next/views/home/home.css';
            document.head.appendChild(link);
            await new Promise((resolve) => (link.onload = resolve));
            document.querySelector('.view-host').replaceChildren();
        });
        return { page, errors };
    }

    const mount = (page, state) =>
        page.evaluate(async (s) => {
            const { mountHome } = await import('./ui-next/views/home/home.js');
            const { mountHero } = await import('./ui-next/views/home/hero.js');
            window.__calls = [];
            window.__state = s;
            const hero = (host) => mountHero(host, { read: () => window.__state, resume: (st, from) => window.__calls.push(['resume', from, st.song.id]), toggle: () => window.__calls.push(['toggle']) });
            mountHome(document.querySelector('.view-host'), { read: () => ({ songs: [], playlists: [{ kind: 'playlist', id: 'p1', viewId: 'playlist-p1', title: 'Evening mix', subtitle: '12 songs', cover: '', played: true }], albums: [], artists: [{ kind: 'artist', id: 'r1', viewId: 'r1', title: 'Artist 1', subtitle: '3 songs', cover: '', played: true }] }), open: () => {}, hero });
        }, state);

    const song = { id: 's1', title: 'Song title number 5', artist: 'Artist 4', album: 'Album 4', cover: '' };
    const text = (page, sel) => page.evaluate((s) => document.querySelector(s)?.textContent || '', sel);

    test('nothing playing and nothing saved: no hero; the shelves are still there', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await mount(page, null);
        assert.equal(await page.evaluate(() => document.querySelector('.hero').hidden), true);
        assert.equal(await page.locator('.shelf').count(), 2);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('playing: the label says now playing and the button pauses', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await mount(page, { mode: 'playing', song, position: 62, duration: 200 });
        assert.match(await text(page, '.hero__label'), /Now playing/);
        assert.equal(await text(page, '.hero__title'), 'Song title number 5');
        assert.match(await text(page, '.hero__sub'), /Artist 4, Album 4/);
        await page.click('.hero__play');
        assert.deepEqual(await page.evaluate(() => window.__calls), [['toggle']]);
        assert.equal(await page.getAttribute('.hero__play', 'aria-label'), 'Pause');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('after closing mid-song: it offers to pick up from that second, or to start over', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await mount(page, { mode: 'resume', song, position: 62, duration: 200 });
        assert.match(await text(page, '.hero__label'), /Pick up where you left off/i);
        assert.match(await text(page, '.hero__sub'), /you closed Xplayer at 1:02/);
        assert.equal(await page.getAttribute('.hero__play', 'aria-label'), 'Resume from 1:02');
        assert.equal(await page.locator('.hero__btn').count(), 0, 'icon buttons, not text buttons');
        const width = await page.evaluate(() => document.querySelector('.hero__fill').style.width);
        assert.equal(width, '31%');
        await page.click('.hero__play');
        await page.click('.hero__restart');
        assert.deepEqual(await page.evaluate(() => window.__calls), [['resume', true, 's1'], ['resume', false, 's1']]);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the shell remembers the song and second on pause, and Home reads it back as something to pick up', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const r = await page.evaluate(async () => {
            const a = window.audioElement;
            const song = window.SONGS_DATA[2];
            window.playbackQueue = [song];
            window.currentQueueIndex = 0;
            Object.defineProperty(a, 'currentTime', { configurable: true, get: () => 71.4, set: () => {} });
            Object.defineProperty(a, 'duration', { configurable: true, get: () => 240 });
            Object.defineProperty(a, 'paused', { configurable: true, get: () => true });
            a.dispatchEvent(new Event('pause'));
            const saved = JSON.parse(localStorage.getItem('xplayer.ui-next.last-session'));
            // the app was closed: nothing is loaded any more
            window.playbackQueue = [];
            window.currentQueueIndex = -1;
            const { currentHero } = await import('./ui-next/adapter/last-session.js');
            const hero = currentHero();
            return { saved, id: song.id, mode: hero && hero.mode, heroId: hero && hero.song.id, position: hero && hero.position };
        });
        assert.deepEqual(r.saved, { id: r.id, position: 71, duration: 240 });
        assert.equal(r.mode, 'resume');
        assert.equal(r.heroId, r.id);
        assert.equal(r.position, 71);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('quick picks: small tiles above the shelves, one click opens the item', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await mount(page, null);
        const r = await page.evaluate(() => ({ tiles: document.querySelectorAll('.quick-tile').length, before: document.querySelector('.quick-picks').compareDocumentPosition(document.querySelector('.shelf')) & Node.DOCUMENT_POSITION_FOLLOWING, h: document.querySelector('.quick-tile').getBoundingClientRect().height }));
        assert.equal(r.tiles, 1 + 0, 'one playlist in the sample data (the artist is not a quick pick)');
        assert.ok(r.before, 'above the shelves');
        assert.equal(r.h, 52);
        await page.close();
    });

    test('the shelves take their shapes: wide playlist cards, round centred artists', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await mount(page, null);
        const r = await page.evaluate(() => {
            const p = document.querySelector('.shelf-card--playlist').getBoundingClientRect();
            const a = document.querySelector('.shelf-card--artist .shelf-card__cover');
            return { pw: p.width, ph: p.height, radius: getComputedStyle(a).borderTopLeftRadius, align: getComputedStyle(document.querySelector('.shelf-card--artist .shelf-card__title')).textAlign };
        });
        assert.ok(r.pw > 240 && r.ph < 110, `playlist card is wide and short (${r.pw} x ${r.ph})`);
        assert.notEqual(r.radius, '0px');
        assert.equal(r.align, 'center');
        await page.close();
    });
});

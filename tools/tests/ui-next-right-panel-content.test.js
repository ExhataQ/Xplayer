// Task PC-13: the right panel content (views/playback/right-panel-content.js): nothing playing, plain lyrics, timed lyrics that
// follow the song and seek on click, no lyrics (cover and track info only, DP11a), and the cover opening the big picture.
//
// Run:   node --test tools/tests/ui-next-right-panel-content.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#c33"/></svg>');

describe('right panel content', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = '<script>window.electronAPI = new Proxy({}, {get:(t,k)=>(k==="then"?undefined:(...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null))});</script>\n';
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open(song) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        if (song) {
            await page.evaluate(
                ({ song, cover }) => {
                    const s = { id: 'x1', title: 'Test Song', artist: 'Test Artist', cover, largeCover: cover, ...song.fields };
                    window.playbackQueue = [s];
                    window.currentQueueIndex = 0;
                    window.getLyricsForSong = () => song.plain || '';
                    window.getSyncedLyricsForSong = () => song.lrc || null;
                    window.parseLRC = (text) => (text ? text.split('\n').map((l) => ({ time: Number(l.slice(0, l.indexOf('|'))), text: l.slice(l.indexOf('|') + 1) })) : null);
                },
                { song, cover: COVER }
            );
        }
        await page.locator('button[aria-label="Right panel"]').click();
        await page.waitForSelector('.right-host .rp-now');
        return { page, errors };
    }

    test('nothing playing: a note and no cover', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(null);
        assert.equal(await page.locator('.rp-now__note').textContent(), 'Nothing is playing');
        assert.equal(await page.locator('.rp-now__cover-frame').isHidden(), true);
        assert.equal(await page.locator('.rp-now__cover-empty').isVisible(), true, 'a blank cover stands in');
        assert.equal(await page.locator('.rp-skel').isVisible(), true, 'a lyrics preview stands in');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the lyrics header has its items centered between the cover and its line, and between the panel edge and its line without a cover', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ plain: 'one\ntwo', fields: {} });
        const measure = () =>
            page.evaluate(() => {
                const header = document.querySelector('.rp-now__header').getBoundingClientRect();
                const tools = document.querySelector('.rp-now__tools').getBoundingClientRect();
                const frame = document.querySelector('.rp-now__cover-frame');
                const above = frame && getComputedStyle(frame).display !== 'none' ? frame.getBoundingClientRect().bottom : document.querySelector('.rp-now').getBoundingClientRect().top;
                return { above: tools.top - above, below: header.bottom - 1 - tools.bottom }; // 1: the line under the header
            });
        const withCover = await measure();
        assert.ok(Math.abs(withCover.above - withCover.below) <= 2, `with a cover: ${JSON.stringify(withCover)}`);
        await page.evaluate(() => (document.querySelector('.right-host').dataset.mode = 'lyrics'));
        const without = await measure();
        assert.ok(Math.abs(without.above - without.below) <= 2, `without a cover: ${JSON.stringify(without)}`);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the lyrics get a shadow under the header only while they are scrolled', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ plain: Array.from({ length: 120 }, (_, i) => `line ${i}`).join('\n'), fields: {} });
        assert.equal(await page.getAttribute('.rp-now__lyrics', 'data-scrolled'), 'false');
        await page.evaluate(() => (document.querySelector('.rp-now__lyrics').scrollTop = 200));
        await page.waitForFunction(() => document.querySelector('.rp-now__lyrics').dataset.scrolled === 'true');
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.rp-now__header'), '::after').opacity === '1'); // the header draws it, under its line
        await page.evaluate(() => (document.querySelector('.rp-now__lyrics').scrollTop = 0));
        await page.waitForFunction(() => document.querySelector('.rp-now__lyrics').dataset.scrolled === 'false');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the cover has a pointing cursor, and a right click on it opens the playing song\'s menu', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ plain: 'one\ntwo', fields: {} });
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.rp-now__cover-button')).cursor), 'pointer');
        await page.click('.rp-now__cover-button', { button: 'right' });
        await page.waitForSelector('.context-menu .context-menu-item');
        const labels = await page.$$eval('.context-menu .context-menu-item', (items) => items.map((i) => i.textContent.replace(/\s+/g, ' ').trim()));
        assert.ok(labels.some((l) => /Show metadata/.test(l)), labels.join(' | '));
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the lyrics keep their place: the same room on both sides, with a scroll bar and without one', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const measure = async (plain) => {
            const { page, errors } = await open({ plain, fields: {} });
            const r = await page.evaluate(() => {
                const box = document.querySelector('.rp-now__lyrics');
                const first = box.querySelector('.rp-line').getBoundingClientRect();
                const edge = box.getBoundingClientRect();
                return { left: first.left - edge.left, right: edge.right - first.right, bar: box.offsetWidth - box.clientWidth, scrolls: box.scrollHeight > box.clientHeight, gutter: getComputedStyle(box).scrollbarGutter };
            });
            assert.deepEqual(errors, []);
            await page.close();
            return r;
        };
        const short = await measure('one\ntwo');
        const long = await measure(Array.from({ length: 120 }, (_, i) => `line ${i}`).join('\n'));
        assert.equal(short.scrolls, false);
        assert.equal(long.scrolls, true);
        assert.equal(short.gutter, 'stable both-edges');
        assert.ok(Math.abs(short.left - short.right) <= 1.5, `centered without a bar ${JSON.stringify(short)}`);
        assert.ok(Math.abs(long.left - long.right) <= 1.5, `centered with a bar ${JSON.stringify(long)}`);
        assert.ok(Math.abs(short.left - long.left) <= 1.5, `it does not move when the bar comes ${short.left} ${long.left}`);
    });

    test('an instrumental song shows a big note instead of the lyric bars', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ fields: { instrumental: true } });
        assert.equal(await page.locator('.rp-now__note').textContent(), 'Instrumental');
        assert.equal(await page.locator('.rp-instr').isVisible(), true);
        assert.equal(await page.locator('.rp-skel').count(), 0);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('plain lyrics: cover, title, artist and the text', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ fields: {}, plain: 'first line\nsecond line' });
        assert.equal(await page.locator('.rp-now__title').textContent(), 'Test Song');
        assert.equal(await page.locator('.rp-now__artist').textContent(), 'Test Artist');
        assert.equal(await page.locator('.rp-now__cover-frame').isVisible(), true);
        assert.match(await page.locator('.rp-line--plain').nth(1).textContent(), /second line/);
        assert.equal(await page.locator('.rp-line--plain').count(), 2, 'one line each, in the same style as synced lyrics');
        assert.equal(await page.locator('.rp-plain').count(), 0);
        assert.equal(await page.locator('.rp-now__note').isHidden(), true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('no lyrics: the cover and the track info stay, with a note (DP11a)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ fields: {} });
        assert.equal(await page.locator('.rp-now__note').textContent(), 'No lyrics for this song');
        assert.equal(await page.locator('.rp-now__cover-frame').isVisible(), true);
        assert.equal(await page.locator('.rp-line').count(), 0);
        assert.equal(await page.locator('.rp-skel').isVisible(), true, 'the lyrics preview shows');
        assert.equal(await page.locator('.rp-now__cover-empty').isHidden(), true, 'the real cover is on, not the blank one');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('timed lyrics: the active line follows the song and a click seeks', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ fields: {}, lrc: '0|one\n10|two\n20|three' });
        assert.equal(await page.locator('.rp-line').count(), 3);
        await page.evaluate(() => {
            const audio = window.audioElement || document.getElementById('audio');
            audio.currentTime = 12;
            audio.dispatchEvent(new Event('timeupdate'));
        });
        await page.waitForSelector('.rp-line--active:has-text("two")');
        assert.equal(await page.locator('.rp-line--past').count(), 1);
        assert.equal(await page.locator('.rp-line--active').getAttribute('aria-current'), 'true');
        await page.locator('.rp-line', { hasText: 'three' }).click();
        const time = await page.evaluate(() => (window.audioElement || document.getElementById('audio')).currentTime);
        assert.equal(Math.round(time), 20);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a click on the cover opens the big picture', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ fields: {}, plain: 'x' });
        await page.locator('.rp-now__cover-button').click();
        await page.waitForSelector('dialog.cover-overlay[open]');
        assert.equal(await page.locator('dialog.cover-overlay img').count(), 1);
        await page.keyboard.press('Escape');
        assert.deepEqual(errors, []);
        await page.close();
    });
    const LONG = Array.from({ length: 60 }, (_, i) => `${i * 5}|line ${i}`).join('\n');

    test('the cover is the full-size file (largeCover), not the small one', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const large = COVER.replace('c33', '33c');
        const { page, errors } = await open({ fields: { largeCover: large }, plain: 'x' });
        assert.equal(await page.locator('.rp-now__cover').getAttribute('src'), large);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the panel button is the last tool, next to the window buttons', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open(null);
        const next = await page.locator('button[aria-label="Right panel"]').evaluate((n) => n.nextElementSibling && n.nextElementSibling.className);
        assert.match(String(next), /titlebar__window/);
        await page.close();
    });

    test('the lyrics scrollbar sits at the right edge of the panel', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ fields: {}, lrc: LONG });
        const gap = await page.evaluate(() => document.querySelector('.right-host').getBoundingClientRect().right - document.querySelector('.rp-now__lyrics').getBoundingClientRect().right);
        assert.ok(gap <= 1, `gap ${gap}`);
        await page.close();
    });

    test('dragging the scrollbar (a scroll the panel did not make) shows "Follow lyrics"; the button brings the line back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ fields: {}, lrc: LONG });
        await page.evaluate(() => {
            const audio = window.audioElement || document.getElementById('audio');
            audio.currentTime = 100;
            audio.dispatchEvent(new Event('timeupdate'));
        });
        await page.waitForSelector('.rp-line--active:has-text("line 20")');
        await page.waitForTimeout(1200); // the panel's own smooth scroll ends
        assert.equal(await page.locator('.rp-now__follow').isHidden(), true);
        const lyricsHeight = () => page.evaluate(() => document.querySelector('.rp-now__lyrics').getBoundingClientRect().height);
        const before = await lyricsHeight();
        await page.evaluate(() => (document.querySelector('.rp-now__lyrics').scrollTop = 0)); // what a thumb drag does: scroll, no wheel
        await page.waitForSelector('.rp-now__follow:visible');
        assert.equal(await lyricsHeight(), before, 'the button floats: the lyrics keep their height');
        const place = await page.evaluate(() => {
            const button = document.querySelector('.rp-now__follow').getBoundingClientRect();
            const lyrics = document.querySelector('.rp-now__lyrics').getBoundingClientRect();
            return { over: button.top >= lyrics.top && button.bottom <= lyrics.bottom, off: Math.abs(button.left + button.width / 2 - (lyrics.left + lyrics.width / 2)) };
        });
        assert.equal(place.over, true, 'it sits over the lyrics');
        assert.ok(place.off <= 2, `centered (${place.off}px off)`);
        await page.locator('.rp-now__follow').click();
        await page.waitForSelector('.rp-now__follow', { state: 'hidden' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('lyrics only: the same width, no cover and no track info; the buttons live in the lyrics header', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ fields: {}, plain: 'x' });
        assert.equal(await page.locator('.rp-now__header .rp-now__tools').count(), 1);
        assert.equal(await page.locator('.rp-now__cover-frame .rp-now__tools').count(), 0);
        const width = () => page.locator('.right-host').evaluate((n) => Math.round(n.getBoundingClientRect().width));
        await page.locator('button[aria-label="Lyrics only"]').click();
        assert.equal(await page.locator('.rp-now__cover-frame').isHidden(), true);
        assert.equal(await page.locator('.rp-now__info').isHidden(), true);
        assert.equal(await width(), 320);
        assert.equal(await page.locator('.rp-line--plain').first().isVisible(), true);
        assert.equal(await page.evaluate(() => localStorage.getItem('xplayer.ui-next.right-lyrics-only')), 'true');
        await page.locator('button[aria-label="Show the cover"]').click();
        assert.equal(await page.locator('.rp-now__cover-frame').isVisible(), true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('fill the app: the panel covers the whole app between the title bar and the player, lyrics only; Escape goes back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ fields: {}, lrc: LONG });
        await page.locator('button[aria-label="Fill the app with the lyrics"]').click();
        const box = await page.locator('.right-host').evaluate((n) => { const r = n.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; });
        assert.deepEqual(box, [0, 1400]);
        assert.equal(await page.locator('.rp-now__cover-frame').isHidden(), true);
        assert.equal(await page.locator('button[aria-label="Back to the panel"]').isVisible(), true);
        assert.equal(await page.locator('button[aria-label="Lyrics only"]').isHidden(), true);
        await page.locator('.rp-now__lyrics').focus();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.right-host').evaluate((n) => Math.round(n.getBoundingClientRect().width)), 320);
        assert.equal(await page.locator('.rp-now__cover-frame').isVisible(), true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the cover is a square that fills the width', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ fields: {}, plain: 'x' });
        const [frame, w, h] = await page.evaluate(() => {
            const i = document.querySelector('.rp-now__cover').getBoundingClientRect();
            const f = document.querySelector('.rp-now__cover-frame').getBoundingClientRect();
            return [Math.round(f.width), Math.round(i.width), Math.round(i.height)];
        });
        assert.equal(w, frame);
        assert.ok(Math.abs(w - h) <= 1, `${w} x ${h}`);
        await page.close();
    });

    test('lyrics added while the song plays appear without reopening', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ fields: {} });
        assert.equal(await page.locator('.rp-now__note').textContent(), 'No lyrics for this song');
        await page.evaluate(() => {
            window.getSyncedLyricsForSong = () => '0|new one\n5|new two';
        });
        await page.waitForSelector('.rp-line:has-text("new two")', { timeout: 5000 });
        assert.equal(await page.locator('.rp-now__note').isHidden(), true);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

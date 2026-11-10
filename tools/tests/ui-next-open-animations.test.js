// The search boxes open by growing (the Library panel's find box and the list toolbar's find box) and the queue list has a scroll shadow.
// Real browser, real engine, new shell. The width of the box is read on every animation frame, so a jump from closed to open would show.
//
// Run:   node --test tools/tests/ui-next-open-animations.test.js
// Needs: playwright and a browser (skips itself if missing; see scroll.test.js).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

function buildNextApp(songs) {
    const dir = buildApp(songs);
    fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
    const file = path.join(dir, 'ui-next', 'index.html');
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    return dir;
}

// One entry per animation frame: [ms since the start, width, opacity, hidden].
const SAMPLE = ([selector, ms]) =>
    new Promise((resolve) => {
        const out = [];
        const t0 = performance.now();
        const node = document.querySelector(selector);
        (function frame() {
            out.push([performance.now() - t0, node.getBoundingClientRect().width, parseFloat(getComputedStyle(node).opacity), node.hidden]);
            if (performance.now() - t0 < ms) requestAnimationFrame(frame);
            else resolve(out);
        })();
    });

describe('opening animations and the queue shadow (new shell)', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildNextApp(60);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open(options = {}) {
        const context = await browser.newContext({ viewport: { width: 1300, height: 800 }, ...options });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html'));
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return { page, errors, context };
    }
    // Starts reading frames, then performs `act`, and returns what was read.
    async function sampleWhile(page, selector, ms, act) {
        const reading = page.evaluate(SAMPLE, [selector, ms]);
        await page.waitForTimeout(30);
        await act();
        return reading;
    }

    test('the Library panel find box grows from the button to the row, frame by frame, and back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors, context } = await open();
        const closed = await page.evaluate(() => document.querySelector('.library-panel .panel-search').getBoundingClientRect().width);
        const frames = await sampleWhile(page, '.library-panel .panel-search', 600, () => page.click('.library-panel .panel-search__button'));
        const widths = frames.map((f) => f[1]);
        const final = widths[widths.length - 1];
        assert.ok(final > closed + 100, `ends open: ${final} from ${closed}`);
        assert.ok(widths.filter((w) => w > closed + 10 && w < final - 10).length >= 2, `at least two frames on the way: ${widths.map(Math.round)}`);
        for (let i = 1; i < widths.length; i++) assert.ok(widths[i] >= widths[i - 1] - 0.5, 'never shrinks while opening');
        await page.keyboard.press('Escape');
        await page.waitForFunction((w) => Math.abs(document.querySelector('.library-panel .panel-search').getBoundingClientRect().width - w) < 1, closed);
        assert.equal(await page.getAttribute('.library-panel .panel-search', 'data-open'), 'false');
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('the list toolbar find box opens by growing out of the search button, takes the focus, and closes at once', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors, context } = await open();
        assert.equal(await page.evaluate(() => document.querySelector('.list-toolbar__find').hidden), true);
        const frames = await sampleWhile(page, '.list-toolbar__find', 500, () => page.click('.list-toolbar .icon-btn[aria-label="Find in this list"]'));
        const shown = frames.filter((f) => !f[3]);
        const widths = shown.map((f) => f[1]);
        assert.ok(shown.length >= 5, 'it is drawn for several frames while it opens');
        assert.ok(widths[0] < 60, `starts small: ${widths[0]}`);
        assert.equal(Math.round(widths[widths.length - 1]), 220);
        assert.ok(widths.filter((w) => w > 20 && w < 200).length >= 2, `frames on the way: ${widths.map(Math.round)}`);
        assert.ok(shown[0][2] < 0.5 && shown[shown.length - 1][2] === 1, 'it fades in');
        assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.list-toolbar__find .field__input')), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.querySelector('.list-toolbar__find').hidden), true, 'closing is instant');
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('with reduced motion both boxes open at once', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context } = await open({ reducedMotion: 'reduce' });
        const left = await sampleWhile(page, '.library-panel .panel-search', 350, () => page.click('.library-panel .panel-search__button'));
        assert.equal(new Set(left.map((f) => Math.round(f[1]))).size, 2, 'only the closed and the open width');
        await page.keyboard.press('Escape');
        const list = await sampleWhile(page, '.list-toolbar__find', 350, () => page.click('.list-toolbar .icon-btn[aria-label="Find in this list"]'));
        assert.deepEqual([...new Set(list.filter((f) => !f[3]).map((f) => Math.round(f[1])))], [220]);
        await context.close();
    });

    test('the queue list has a shadow under the header while it is scrolled and one over the bottom while more is below; a short queue has none', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors, context } = await open();
        await page.evaluate(() => {
            const base = SONGS_DATA[0];
            const list = Array.from({ length: 40 }, (_, i) => ({ ...base, id: 'q' + i, title: 'Queue song ' + (i + 1) }));
            SONGS_DATA.push(...list);
            createQueueFromSongList(list, 0, VIEWS.ALL_SONGS);
        });
        await page.click('.queue-btn');
        await page.waitForSelector('.queue-panel .queue-item');
        const state = () =>
            page.evaluate(() => {
                const wrap = document.querySelector('.queue-panel__scroll');
                return { scrolled: wrap.dataset.scrolled, more: wrap.dataset.more, top: parseFloat(getComputedStyle(wrap, '::before').opacity), bottom: parseFloat(getComputedStyle(wrap, '::after').opacity) };
            });
        const scrollTo = async (y) => {
            await page.evaluate((v) => (document.querySelector('.queue-panel__body').scrollTop = v), y);
            await page.waitForTimeout(350); // a frame for the data attribute, then the opacity transition
        };
        await scrollTo(0);
        assert.deepEqual(await state(), { scrolled: 'false', more: 'true', top: 0, bottom: 1 });
        await scrollTo(150);
        assert.deepEqual(await state(), { scrolled: 'true', more: 'true', top: 1, bottom: 1 });
        await scrollTo(99999);
        assert.deepEqual(await state(), { scrolled: 'true', more: 'false', top: 1, bottom: 0 });
        await page.evaluate(() => createQueueFromSongList([{ ...SONGS_DATA[0], id: 'only', title: 'Only one' }], 0, VIEWS.ALL_SONGS));
        await page.waitForTimeout(500);
        assert.deepEqual(await state(), { scrolled: 'false', more: 'false', top: 0, bottom: 0 });
        assert.deepEqual(errors, []);
        await context.close();
    });
});

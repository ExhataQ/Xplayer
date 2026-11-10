// The hero's gradient and the column header (song-list.js extendHero / placeEdge, song-list.css "the header's colors"): the gradient goes on through the
// column header instead of being cut off at the hero's bottom edge (and no further), the corner lines go on across the scrollbar's width, the header is
// solid in the list's background once it sticks to the top, and the list sits on the panels' color.
// Run:   node --test tools/tests/ui-next-header-tint.test.js
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, buildApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };

// These checks are about the scrollbar's column, and a headless browser hides scrollbars by default (--hide-scrollbars): no column, nothing to draw in it.
// So the browser is started without that switch (the shared launch() in app-fixture.js keeps it).
async function launchWithScrollbars(playwright) {
    for (const extra of [{}, { channel: 'msedge' }, { channel: 'chrome' }]) {
        try {
            return await playwright.chromium.launch({ args: ['--allow-file-access-from-files'], ignoreDefaultArgs: ['--hide-scrollbars'], timeout: 2500, ...extra });
        } catch (_) {
            /* next */
        }
    }
    return null;
}

function buildNextApp(songs) {
    const dir = buildApp(songs);
    fs.cpSync(path.join(ROOT, 'src', 'ui-next'), path.join(dir, 'ui-next'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'src', 'assets'), path.join(dir, 'assets'), { recursive: true });
    const file = path.join(dir, 'ui-next', 'index.html');
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    return dir;
}

describe('the hero colors below the hero', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launchWithScrollbars(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildNextApp(60);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1300, height: 640 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html'));
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        await page.waitForFunction(() => {
            const c = document.querySelector('.view-host .content');
            return c && c.scrollHeight > c.clientHeight + 200 && document.querySelector('.view-host').style.getPropertyValue('--hero-extend');
        });
        return { page, errors };
    }
    // placeEdge runs on the frame after the scroll event, so wait for the state the position should give, not for a fixed time.
    const scrollAndWait = async (page, top, condition, arg = null) => {
        await page.evaluate((t) => (document.querySelector('.view-host .content').scrollTop = t), top);
        await page.waitForFunction(condition, arg, { timeout: 5000 });
    };

    test('at rest the header is see-through (the gradient shows in it); stuck to the top it is solid in the panels\' color, and so is the piece at the wall', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const state = () =>
            page.evaluate(() => {
                const head = document.querySelector('.songlist-head');
                const edge = document.querySelector('.songlist-head-edge');
                const bar = document.querySelector('.songlist-bar');
                return {
                    stuck: head.dataset.stuck,
                    headBg: getComputedStyle(head).backgroundImage + '|' + getComputedStyle(head).backgroundColor,
                    edgeBg: getComputedStyle(edge).backgroundColor,
                    listBg: getComputedStyle(document.querySelector('.view-host')).backgroundColor,
                    panel: (() => {
                        const probe = document.createElement('div');
                        probe.style.background = 'var(--surface-panel)';
                        document.body.append(probe);
                        const color = getComputedStyle(probe).backgroundColor;
                        probe.remove();
                        return color;
                    })(),
                    heroEdgeFirst: !!(document.querySelector('.songlist-hero-edge').compareDocumentPosition(edge) & Node.DOCUMENT_POSITION_FOLLOWING),
                    edgeStuck: edge.dataset.stuck,
                    edgeH: Math.round(edge.getBoundingClientRect().height),
                    headH: Math.round(head.getBoundingClientRect().height),
                    edgeTop: Math.round(edge.getBoundingClientRect().top),
                    headTop: Math.round(head.getBoundingClientRect().top),
                    kind: head.dataset.kind
                };
            });
        let s = await state();
        assert.equal(s.stuck, 'false');
        assert.equal(s.edgeStuck, 'false');
        assert.equal(s.edgeH, 1, 'the piece at the wall is the header\'s 1px line');
        assert.equal(s.headBg.split('|')[1], 'rgba(0, 0, 0, 0)', 'no ground of its own: the hero gradient shows through');
        assert.equal(s.kind, 'all-songs', 'the header knows the list\'s kind');
        assert.equal(s.heroEdgeFirst, true, 'the strip at the scrollbar is under the header\'s piece at the wall (the later piece is drawn on top)');

        await scrollAndWait(page, 900, () => document.querySelector('.songlist-head').dataset.stuck === 'true');
        s = await state();
        assert.equal(s.edgeStuck, 'true');
        assert.equal(s.headBg, `none|${s.panel}`, 'solid, in the panels\' color: no tint, no gradient');
        assert.notEqual(s.panel, s.listBg, 'which is not the list\'s own color');
        assert.equal(s.edgeBg, s.panel, 'and so is the piece at the wall');
        assert.equal(s.edgeH, s.headH, 'the piece at the wall fills the header\'s height');
        assert.ok(Math.abs(s.edgeTop - s.headTop) <= 1, 'and sits level with it');

        await scrollAndWait(page, 0, () => document.querySelector('.songlist-head').dataset.stuck === 'false');
        s = await state();
        assert.equal(s.edgeH, 1);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the hero gradient goes on through the column header: both layers are taller than the hero by its height, and the strip at the scrollbar is as tall as they are', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const r = await page.evaluate(() => {
            const bar = document.querySelector('.songlist-bar');
            const barH = bar.getBoundingClientRect().height;
            const extend = parseFloat(document.querySelector('.view-host').style.getPropertyValue('--hero-extend'));
            const edge = document.querySelector('.songlist-hero-edge');
            const wrapper = edge.parentElement.getBoundingClientRect();
            return {
                headH: document.querySelector('.songlist-head').offsetHeight,
                extend,
                barH,
                before: parseFloat(getComputedStyle(bar, '::before').height),
                after: parseFloat(getComputedStyle(bar, '::after').height),
                edgeH: edge.getBoundingClientRect().height,
                edgeTop: edge.getBoundingClientRect().top - wrapper.top,
                wrapperH: wrapper.height
            };
        });
        assert.equal(r.extend, r.headH, 'exactly the column header\'s height, no further');
        assert.ok(Math.abs(r.before - (r.barH + r.extend)) <= 1, `the gradient layer is the hero plus the extension (${r.before} vs ${r.barH + r.extend})`);
        assert.ok(Math.abs(r.after - (r.barH + r.extend)) <= 1, 'and so is the layer with the lines');
        assert.ok(Math.abs(r.edgeH - Math.min(r.barH + r.extend, r.wrapperH - r.edgeTop)) <= 1, `the strip at the scrollbar is as tall (${r.edgeH})`);
        // The window is short, so the hero is the compact 148px one and the gradient (hero + header) is 184px tall. At 160 the hero has scrolled out but
        // the header's part of the gradient is still in view, so the strip is still there; once the whole 184px is above the view it is gone.
        await scrollAndWait(page, 160, () => !document.querySelector('.songlist-hero-edge').hidden);
        await scrollAndWait(page, 400, () => document.querySelector('.songlist-hero-edge').hidden);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('an empty list: the gradient reaches only the header, and makes no scroll range of its own', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate(() => window.switchView('favorites')); // no favorites in this library
        await page.waitForFunction(() => document.querySelector('.songlist-bar')?.dataset.kind === 'favorites');
        const r = await page.evaluate(() => {
            const c = document.querySelector('.view-host .content');
            return { extend: parseFloat(document.querySelector('.view-host').style.getPropertyValue('--hero-extend')), head: document.querySelector('.songlist-head').offsetHeight, over: c.scrollHeight - c.clientHeight };
        });
        assert.equal(r.extend, r.head);
        assert.ok(r.over <= 0, `no scroll range made by the gradient (${r.over})`);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the corner lines are drawn in the strip beside the scroll bar too', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const r = await page.evaluate(() => {
            const e = document.querySelector('.songlist-hero-edge');
            const after = getComputedStyle(e, '::after');
            return { hidden: e.hidden, image: after.backgroundImage, mask: after.maskImage || after.webkitMaskImage, radius: e.style.getPropertyValue('--hero-ring-r'), width: e.style.getPropertyValue('--hero-pw') };
        });
        assert.equal(r.hidden, false);
        assert.match(r.image, /repeating-radial-gradient/, 'All Songs: rings');
        assert.match(r.mask, /radial-gradient/);
        assert.match(r.radius, /^\d+(\.\d+)?px$/);
        assert.ok(parseFloat(r.width) <= 560, 'the pattern box is at most 560px wide');
        await page.evaluate(() => window.switchView('favorites'));
        await page.waitForFunction(() => document.querySelector('.songlist-hero-edge')?.dataset.kind === 'favorites');
        const liked = await page.evaluate(() => getComputedStyle(document.querySelector('.songlist-hero-edge'), '::after').backgroundImage);
        assert.match(liked, /repeating-linear-gradient/, 'Liked Songs: stripes');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the list keeps the main view\'s own color, not the panels\'', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const r = await page.evaluate(() => {
            const colorOf = (token) => {
                const probe = document.createElement('div');
                probe.style.background = `var(${token})`;
                document.body.append(probe);
                const color = getComputedStyle(probe).backgroundColor;
                probe.remove();
                return color;
            };
            return { ground: colorOf('--surface-ground'), panel: colorOf('--surface-panel'), host: getComputedStyle(document.querySelector('.view-host')).backgroundColor };
        });
        assert.equal(r.host, r.ground, 'the list is the main view\'s own color');
        assert.notEqual(r.host, r.panel, 'and not the panels\' color');
        assert.deepEqual(errors, []);
        await page.close();
    });
});

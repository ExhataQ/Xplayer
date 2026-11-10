// Task C8: the chosen motions: panels slide, the view shifts, the play button swaps its icon, a playlist pulses when a song is added, a drop
// settles, dialogs and menus rise. All of it moves only transform and opacity and goes through Reduce animations (C7).
//
// Run:   node --test tools/tests/ui-next-motion-chosen.test.js
// Needs: playwright and a browser for the second half (it skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const read = (...parts) => fs.readFileSync(path.join(NEXT_SRC, ...parts), 'utf8').replace(/\r\n/g, '\n');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const GATE = ":where(:root:not([data-motion='reduced']))";

describe('C8 static rules', () => {
    const css = strip(read('shell', 'motion.css'));

    test('every rule that moves something is under the Reduce animations gate; the rest are keyframes', () => {
        const rules = css.replace(/@keyframes [\w-]+ \{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').split('}').map((r) => r.trim()).filter(Boolean);
        assert.ok(rules.length >= 11, `${rules.length} rules were found`);
        for (const rule of rules) assert.ok(rule.startsWith(GATE), `not gated: ${rule.slice(0, 80)}`);
    });

    test('only transform and opacity change: in every keyframe, and in the one transition', () => {
        const frames = [...css.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)];
        assert.ok(frames.length >= 9, `${frames.length} keyframes`);
        for (const [, name, body] of frames) {
            const props = [...body.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]);
            for (const prop of props) assert.ok(['transform', 'opacity'].includes(prop), `${name} changes ${prop}`);
        }
        for (const [, value] of css.matchAll(/transition:\s*([^;]+);/g)) assert.match(value, /^opacity /, `transition ${value}`);
        assert.doesNotMatch(css, /infinite/);
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|--c-[a-z]/);
    });

    test('the page links it, and the scripts only start a motion through the gate helper', () => {
        assert.ok(read('index.html').includes('href="shell/motion.css"'));
        for (const file of [['shell', 'panel-motion.js'], ['shell', 'small-motions.js']]) {
            assert.match(read(...file), /import \{ reducedMotion \} from '\.\.\/components\/motion\.js'/, file.join('/'));
        }
        assert.match(read('views', 'playback', 'transport.js'), /if \(!button \|\| reducedMotion\(\)\) return;/);
        assert.match(read('views', 'playback', 'transport.js'), /if \(playingChanged\) \{\s*syncLabels\(\);\s*swapPlayIcon\(parts\.play\);/);
        assert.match(fs.readFileSync(path.join(ROOT, 'src', 'js', 'playlists', '03c-playlists.js'), 'utf8'), /count: playlists\[playlistIndex\]\.songs\.length, added: true/);
    });
});

describe('C8 motions in the real shell', { concurrency: false }, () => {
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

    async function open(reduced = false) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        if (reduced) await page.evaluate(() => (document.documentElement.dataset.motion = 'reduced'));
        return { page, errors };
    }
    const anim = (page, selector) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).animationName, selector);
    const attr = (page, selector, name) => page.evaluate(([s, n]) => document.querySelector(s)?.getAttribute(n), [selector, name]);

    test('nothing moves while the app opens', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        for (const selector of ['.panel-host', '.right-host', '.view-host']) assert.equal(await anim(page, selector), 'none', selector);
        assert.equal(await attr(page, '.panel-host', 'data-enter'), null);
        await page.close();
    });

    test('the left panel closes at once with nothing moving; opening slides it in and the view shifts', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const button = page.locator('.titlebar .left-panel-btn');
        await button.click();
        assert.equal(await page.evaluate(() => document.querySelector('.panel-host').hasAttribute('data-closed')), true, 'closed at once');
        assert.equal(await attr(page, '.panel-host', 'data-leaving'), null, 'no closing marker');
        assert.equal(await anim(page, '.panel-host'), 'none');
        assert.equal(await attr(page, '.view-host', 'data-shift'), null, 'the view does not move when a panel closes');
        assert.equal(await anim(page, '.view-host'), 'none');

        await button.click();
        assert.equal(await page.evaluate(() => document.querySelector('.panel-host').hasAttribute('data-closed')), false, 'opens at once');
        assert.equal(await attr(page, '.panel-host', 'data-enter'), 'left');
        assert.equal(await anim(page, '.panel-host'), 'panel-in-left');
        assert.equal(await attr(page, '.view-host', 'data-shift'), 'right');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the shift adds no sideways scroll');
        await page.waitForFunction(() => !document.querySelector('.panel-host').hasAttribute('data-enter') && !document.querySelector('.view-host').hasAttribute('data-shift'), null, { timeout: 1500 });
        assert.equal(await anim(page, '.panel-host'), 'none');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the right panel slides the same way from its own edge', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const button = page.locator('.titlebar .right-panel-btn');
        await button.click();
        await page.waitForFunction(() => !document.querySelector('.right-host').hidden && document.querySelector('.right-host').getAttribute('data-enter'), null, { timeout: 1500 });
        assert.equal(await anim(page, '.right-host'), 'panel-in-right');
        assert.equal(await attr(page, '.view-host', 'data-shift'), 'left');
        await page.waitForFunction(() => !document.querySelector('.right-host').hasAttribute('data-enter'), null, { timeout: 1500 });
        await button.click();
        assert.equal(await page.evaluate(() => document.querySelector('.right-host').hidden), true, 'closed at once');
        assert.equal(await attr(page, '.right-host', 'data-leaving'), null);
        assert.equal(await anim(page, '.right-host'), 'none');
        assert.equal(await attr(page, '.view-host', 'data-shift'), null);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the queue rises from the player and closes at once', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.locator('.queue-btn').click();
        assert.equal(await page.evaluate(() => document.querySelector('.queue-panel').hidden), false);
        assert.equal(await anim(page, '.queue-panel'), 'panel-in-up');
        await page.waitForFunction(() => !document.querySelector('.queue-panel').hasAttribute('data-enter'), null, { timeout: 1500 });
        await page.locator('.queue-btn').click();
        assert.equal(await page.evaluate(() => document.querySelector('.queue-panel').hidden), true, 'closed at once');
        assert.equal(await anim(page, '.queue-panel'), 'none');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('with Reduce animations on, panels open and close at once and nothing is animated', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open(true);
        await page.locator('.titlebar .left-panel-btn').click();
        assert.equal(await page.evaluate(() => document.querySelector('.panel-host').hasAttribute('data-closed')), true, 'closed at once');
        assert.equal(await attr(page, '.panel-host', 'data-leaving'), null);
        assert.equal(await attr(page, '.view-host', 'data-shift'), null);
        await page.locator('.titlebar .left-panel-btn').click();
        assert.equal(await attr(page, '.panel-host', 'data-enter'), null);
        await page.locator('.queue-btn').click();
        assert.equal(await page.evaluate(() => document.querySelector('.queue-panel').hidden), false);
        assert.equal(await attr(page, '.queue-panel', 'data-enter'), null);
        // The styles are gated too, so a stray marker would still not animate.
        await page.evaluate(() => document.querySelector('.panel-host').setAttribute('data-enter', 'left'));
        assert.equal(await anim(page, '.panel-host'), 'none');
        await page.close();
    });

    test('the play button swaps its icon: the marker starts the scale-and-fade', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => document.querySelector('#play-btn').setAttribute('data-swap', ''));
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#play-btn > *')).animationName), 'play-icon-swap');
        await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduced'));
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#play-btn > *')).animationName), 'none');
        await page.close();
    });

    test('a song added to a playlist gives that playlist one pulse; removing one does not; reduced motion shows none', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const id = await page.evaluate(() => {
            const made = createPlaylist('Pulse test');
            return typeof made === 'object' && made ? made.id : made;
        });
        const row = `.left-panel-main-item[data-view="playlist-${id}"]`;
        await page.waitForSelector(row, { timeout: 4000 });
        await page.evaluate((p) => addSongToPlaylist(SONGS_DATA[0].id, p), id);
        assert.equal(await attr(page, row, 'data-pulse'), '');
        assert.equal(await anim(page, row), 'playlist-pulse');
        await page.waitForFunction((r) => !document.querySelector(r).hasAttribute('data-pulse'), row, { timeout: 2000 });
        await page.evaluate((p) => removeSongFromPlaylist(SONGS_DATA[0].id, p), id);
        assert.equal(await attr(page, row, 'data-pulse'), null);
        await page.evaluate(() => (document.documentElement.dataset.motion = 'reduced'));
        await page.evaluate((p) => addSongToPlaylist(SONGS_DATA[1].id, p), id);
        assert.equal(await attr(page, row, 'data-pulse'), null);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a drop settles into the row that had the ring; a target that cannot take it eases to its dimmed look', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.waitForSelector('.left-panel-main-item');
        await page.evaluate(() => {
            const rows = document.querySelectorAll('.left-panel-main-item');
            rows[0].classList.add('drag-hover');
            rows[1].classList.add('drag-invalid');
            document.dispatchEvent(new Event('drop', { bubbles: true }));
        });
        const settled = '.left-panel-main-item.drag-hover';
        assert.equal(await attr(page, settled, 'data-settle'), '');
        assert.equal(await anim(page, settled), 'drop-settle');
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.left-panel-main-item.drag-invalid')).transitionProperty), 'opacity');
        await page.waitForFunction((s) => !document.querySelector(s).hasAttribute('data-settle'), settled, { timeout: 2000 });
        await page.close();
    });

    test('dialogs and menus rise while they fade in', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => window.showAddLinkDialog());
        await page.waitForSelector('.playlist-modal');
        assert.equal(await anim(page, '.playlist-modal'), 'rise-in');
        await page.evaluate(() => window.closeAddLinkModal());
        await page.locator('.song-item').first().click({ button: 'right' });
        const menu = page.locator('.context-menu, .menu').first();
        await menu.waitFor({ timeout: 3000 });
        assert.equal(await menu.evaluate((n) => getComputedStyle(n).animationName), 'rise-in');
        await page.close();
    });
});

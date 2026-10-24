// Task PA-03: the merged title bar and rail, the rule under Home, the active bar, the icon states and the hover and click animations
// (shell/rail.css, icons/custom-icons.js), in the real shell and engine.
//
// Run:   node --test tools/tests/ui-next-rail.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('rail.css and the custom icons (static)', () => {
    const tokens = fs.readFileSync(path.join(NEXT_SRC, 'tokens.css'), 'utf8');
    const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const css = strip(fs.readFileSync(path.join(NEXT_SRC, 'shell', 'rail.css'), 'utf8'));

    test('rail.css uses tokens only: every var() is a token or one the rail sets itself, no raw colors', () => {
        const own = new Set();
        const missing = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => !defined.has(n) && !own.has(n));
        assert.deepEqual([...new Set(missing)], []);
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
        assert.doesNotMatch(css, /\brgba?\(|\bhsla?\(/);
        assert.doesNotMatch(css, /--c-[a-z]/);
    });

    test('index.html links rail.css right after shell.css', () => {
        const html = fs.readFileSync(path.join(NEXT_SRC, 'index.html'), 'utf8');
        assert.ok(html.indexOf('href="shell/shell.css"') > 0);
        assert.ok(html.indexOf('href="shell/rail.css"') > html.indexOf('href="shell/shell.css"'));
    });

    test('every animation has its keyframes, none of them loops, and motion is switched off for reduced motion', () => {
        for (const name of ['rail-hop', 'rail-tilt', 'rail-nudge', 'rail-tick', 'rail-turn', 'rail-bounce', 'rail-swing']) {
            assert.match(css, new RegExp(`@keyframes ${name}\\b`), name);
        }
        assert.doesNotMatch(css, /infinite/, 'icons move when you hover or click, never on their own');
        assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
        assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    });

    test('the custom icons are read by icon(), the generator writes the same lookup, and Library is no longer a Lucide set of bars', async () => {
        const icons = fs.readFileSync(path.join(NEXT_SRC, 'icons', 'icons.js'), 'utf8');
        const generator = fs.readFileSync(path.join(ROOT, 'tools', 'build-ui-next-icons.js'), 'utf8');
        for (const src of [icons, generator]) {
            assert.match(src, /import \{ CUSTOM_ICONS \} from '\.\/custom-icons\.js'/);
            assert.match(src, /CUSTOM_ICONS\[name\] \?\? ICONS\[name\]/);
        }
        assert.doesNotMatch(icons, /^\s+"library":/m);
        assert.doesNotMatch(generator, /'library',/);
        const custom = await import('file://' + path.join(NEXT_SRC, 'icons', 'custom-icons.js').replace(/\\/g, '/'));
        assert.match(custom.CUSTOM_ICONS.library, /<rect/);
        assert.match(custom.CUSTOM_ICONS['rail-house'], /class="rail-fill"/);
        assert.match(custom.CUSTOM_ICONS['rail-house'], /class="rail-door"/);
        assert.match(custom.CUSTOM_ICONS.gear, /<circle/); // a gear with a hole, like the old interface's
        assert.equal((custom.CUSTOM_ICONS.waveform.match(/<path/g) || []).length, 5);
    });
});

describe('rail in the new shell', { concurrency: false }, () => {
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

    async function open(options = {}) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        if (options.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return { page, errors };
    }
    const go = async (page, view) => {
        await page.locator(`.rail-btn[data-view="${view}"]`).click();
        await page.mouse.move(900, 400); // off the rail, so a hover does not stand in for the active state
        await page.waitForTimeout(700); // the longest transition is 420 ms
    };
    const css = (page, selector, props, pseudo) =>
        page.evaluate(([s, p, ps]) => {
            const cs = getComputedStyle(document.querySelector(s), ps || null);
            return Object.fromEntries(p.map((k) => [k, cs.getPropertyValue(k)]));
        }, [selector, props, pseudo]);

    test('the lines are back (under the title bar, beside the rail) but nothing separates the logo from Home', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const bar = await css(page, '.titlebar', ['background-color', 'border-bottom-width']);
        const rail = await css(page, '.rail', ['background-color', 'border-right-width']);
        assert.equal(bar['background-color'], rail['background-color'], 'one color');
        assert.equal(rail['border-right-width'], '1px');
        assert.equal(bar['border-bottom-width'], '0px', 'the line is drawn by ::after, so it can start where the rail ends');
        const line = await css(page, '.titlebar', ['left', 'right', 'bottom', 'height', 'background-color'], '::after');
        assert.deepEqual([line.left, line.right, line.bottom, line.height], ['68px', '0px', '0px', '1px']);
        const geometry = await page.evaluate(() => {
            const r = (s) => document.querySelector(s).getBoundingClientRect();
            const bar = r('.titlebar');
            const probe = document.createElement('i');
            probe.style.color = 'var(--border-subtle)';
            document.body.append(probe);
            const subtle = getComputedStyle(probe).color;
            probe.remove();
            return { railEdge: r('.rail').right, barBottom: bar.bottom, railTop: r('.rail').top, subtle };
        });
        assert.equal(geometry.railTop, geometry.barBottom, 'the rail starts where the title bar ends: the seam between the logo and Home is open');
        assert.equal(line['background-color'], geometry.subtle);
        // the logo is at the far left of the window, level with the other title bar buttons
        const place = await page.evaluate(() => {
            const r = (s) => document.querySelector(s).getBoundingClientRect();
            const mid = (s) => r(s).top + r(s).height / 2;
            return { left: r('.logo-btn').left, logo: mid('.logo-btn'), nav: mid('.titlebar .nav-btn') };
        });
        assert.ok(place.left <= 16, `far left (${place.left})`);
        assert.ok(Math.abs(place.logo - place.nav) <= 1, JSON.stringify(place));
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Home is set apart by a rule: one hidden separator right after it, 32 px wide', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const info = await page.evaluate(() => {
            const rail = document.querySelector('.rail');
            const kids = [...rail.children];
            const home = kids.findIndex((n) => n.dataset.view === 'home');
            const sep = kids[home + 1];
            const r = sep.getBoundingClientRect();
            return { first: home, cls: sep.className, hidden: sep.getAttribute('aria-hidden'), w: r.width, h: r.height, count: rail.querySelectorAll('.rail-sep').length };
        });
        assert.deepEqual(info, { first: 0, cls: 'rail-sep', hidden: 'true', w: 32, h: 1, count: 1 });
        await page.close();
    });

    test('the active bar is 36 px tall (a little shorter than the 44 px hover area), grows in for the active page and is gone for the others', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await go(page, 'search');
        const active = await css(page, '.rail-btn[data-view="search"]', ['opacity', 'height', 'width', 'transform'], '::before');
        assert.equal(active.opacity, '1');
        assert.equal(active.height, '36px');
        assert.equal(active.width, '3px');
        assert.equal(active.transform, 'matrix(1, 0, 0, 1, 0, 0)');
        const idle = await css(page, '.rail-btn[data-view="library"]', ['opacity', 'transform'], '::before');
        assert.equal(idle.opacity, '0');
        assert.match(idle.transform, /^matrix\(1, 0, 0, 0, /, 'collapsed to nothing, ready to grow');
        assert.match((await css(page, '.rail-btn[data-view="search"]', ['transition-property'], '::before'))['transition-property'], /transform/);
        await page.close();
    });

    test('Home fills up when it is the page and loses the fill at once when you leave', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const clip = (p) => p.evaluate(() => getComputedStyle(document.querySelector('.rail-fill')).clipPath);
        assert.match(await clip(page), /inset\(100%/);
        await go(page, 'home');
        assert.match(await clip(page), /inset\(0(px)?( 0(px)?){0,3}\)/);
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.rail-fill')).transitionDuration), '0.42s');
        // leaving: the very next read already shows the fill gone, no transition runs
        const left = await page.evaluate(async () => {
            document.querySelector('.rail-btn[data-view="library"]').click();
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const cs = getComputedStyle(document.querySelector('.rail-fill'));
            return { clip: cs.clipPath, duration: cs.transitionDuration };
        });
        assert.match(left.clip, /inset\(100%/);
        assert.equal(left.duration, '0s');
        await page.close();
    });

    test('Home, Lyrics and Metadata take the accent color while they are the page; Library only grows a little', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const colors = async (view) => {
            await go(page, view);
            return page.evaluate((v) => {
                const b = document.querySelector(`.rail-btn[data-view="${v}"]`);
                const probe = document.createElement('i');
                probe.style.color = 'var(--accent)';
                document.body.append(probe);
                const accent = getComputedStyle(probe).color;
                probe.remove();
                return { isAccent: getComputedStyle(b).color === accent, scale: getComputedStyle(b.querySelector('svg')).scale, stroke: getComputedStyle(b.querySelector('svg')).strokeWidth };
            }, view);
        };
        for (const view of ['home', 'lyrics', 'metadata']) assert.equal((await colors(view)).isAccent, true, view);
        const library = await colors('library');
        assert.equal(library.isAccent, false);
        assert.equal(library.scale, '1.08');
        assert.equal(library.stroke, '2.1px');
        await page.close();
    });

    test('Metadata fills its tag while it is the page', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const fill = () => page.evaluate(() => getComputedStyle(document.querySelector('.rail-btn[data-view="metadata"] svg path')).fillOpacity);
        assert.equal(await fill(), '0');
        await go(page, 'metadata');
        assert.equal(await fill(), '1');
        await page.close();
    });

    // the animation name of the part of an icon that moves
    const moving = (page, view) =>
        page.evaluate((v) => {
            const b = document.querySelector(`.rail-btn[data-view="${v}"]`);
            const target = v === 'recent' ? b.querySelector('svg path:last-child') : b.querySelector('svg');
            return getComputedStyle(target).animationName;
        }, view);

    test('on hover Home, Library, Search and Recents wait a moment, move once, finish even if the pointer leaves, and come back; nothing moves on its own', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await go(page, 'settings'); // a page that is not one of the hover icons is open
        const expected = { home: 'rail-hop', library: 'rail-tilt', search: 'rail-nudge', recent: 'rail-tick' };
        for (const view of Object.keys(expected)) assert.equal(await moving(page, view), 'none', `${view} is still until hovered`);
        // passing over an icon quickly does nothing
        await page.locator('.rail-btn[data-view="library"]').hover();
        assert.equal(await moving(page, 'library'), 'none', 'not at the first instant');
        await page.mouse.move(900, 400);
        await page.waitForTimeout(400);
        assert.equal(await moving(page, 'library'), 'none', 'the pointer left before the pause was over');
        for (const [view, name] of Object.entries(expected)) {
            await page.locator(`.rail-btn[data-view="${view}"]`).hover();
            await page.waitForFunction((v) => document.querySelector(`.rail-btn[data-view="${v}"]`).hasAttribute('data-play'), view);
            assert.equal(await moving(page, view), name, view);
            const run = await page.evaluate((v) => {
                const b = document.querySelector(`.rail-btn[data-view="${v}"]`);
                const target = v === 'recent' ? b.querySelector('svg path:last-child') : b.querySelector('svg');
                const cs = getComputedStyle(target);
                return { count: cs.animationIterationCount, ms: parseFloat(cs.animationDuration) * 1000 };
            }, view);
            assert.equal(run.count, '1', `${view} runs once`);
            assert.ok(run.ms >= 400 && run.ms <= 900, `${view} takes ${run.ms} ms`);
            await page.mouse.move(900, 400); // the pointer leaves in the middle of the motion
            assert.equal(await moving(page, view), name, `${view} keeps going after the pointer left`);
            await page.waitForFunction((v) => !document.querySelector(`.rail-btn[data-view="${v}"]`).hasAttribute('data-play'), view, { timeout: 3000 });
            assert.equal(await moving(page, view), 'none', `${view} is back to still`);
        }
        await page.locator('.bell-btn').hover();
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.bell-btn svg')).animationName), 'bell-hover');
        await page.mouse.move(900, 400);
        // the click icons do nothing on hover
        for (const view of ['settings', 'lyrics', 'metadata']) {
            if (view === 'settings') await go(page, 'library');
            await page.locator(`.rail-btn[data-view="${view}"]`).hover();
            await page.waitForTimeout(350);
            assert.equal(await moving(page, view), 'none', `${view} does not react to hover`);
        }
        await page.close();
    });

    test('the rail is wider with bigger icons, one color with the title bar and the panel, and the main view is another', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const m = await page.evaluate(() => {
            const r = (s) => document.querySelector(s).getBoundingClientRect();
            const bg = (s) => getComputedStyle(document.querySelector(s)).backgroundColor;
            const sep = r('.rail-sep');
            return {
                rail: r('.rail').width, button: r('.rail-btn').width, icon: r('.rail-btn svg').width,
                gapToSep: sep.top - r('.rail-btn[data-view="home"]').bottom, gapAfterSep: r('.rail-btn[data-view="library"]').top - sep.bottom,
                bar: bg('.titlebar'), railBg: bg('.rail'), panel: bg('.panel-host'), view: bg('.view-host')
            };
        });
        assert.equal(m.rail, 68);
        assert.equal(m.button, 44);
        assert.equal(m.icon, 20);
        assert.ok(m.gapToSep < m.gapAfterSep, `the rule is closer to Home (${m.gapToSep}) than to Library (${m.gapAfterSep})`);
        assert.ok(m.gapToSep <= 4, String(m.gapToSep));
        assert.equal(m.bar, m.railBg);
        assert.equal(m.railBg, m.panel);
        assert.notEqual(m.view, m.panel, 'the main view is a different color');
        await page.close();
    });

    test('on click Settings turns its gear, Lyrics bounces its bars and Metadata swings its tag; the other pages do not animate', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.mouse.move(900, 400);
        assert.equal(await moving(page, 'settings'), 'rail-turn');
        await page.locator('.rail-btn[data-view="lyrics"]').click();
        await page.mouse.move(900, 400);
        const bars = await page.evaluate(() => [...document.querySelectorAll('.rail-btn[data-view="lyrics"] svg path')].map((p) => ({ name: getComputedStyle(p).animationName, delay: getComputedStyle(p).animationDelay })));
        assert.deepEqual(bars, [0, 0.06, 0.12, 0.18, 0.24].map((d) => ({ name: 'rail-bounce', delay: d ? `${d}s` : '0s' })));
        await page.locator('.rail-btn[data-view="metadata"]').click();
        await page.mouse.move(900, 400);
        assert.equal(await moving(page, 'metadata'), 'rail-swing');
        await page.locator('.rail-btn[data-view="search"]').click();
        await page.mouse.move(900, 400);
        assert.equal(await moving(page, 'search'), 'none', 'a hover icon does not animate on click');
        assert.equal(await moving(page, 'settings'), 'none', 'and the click animation ends with the page');
        await page.close();
    });

    test('with reduced motion nothing animates, hovered or clicked, but the active states still show', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ reducedMotion: true });
        for (const view of ['home', 'library', 'search', 'recent']) {
            await page.locator(`.rail-btn[data-view="${view}"]`).hover();
            assert.equal(await moving(page, view), 'none', view);
        }
        await page.locator('.bell-btn').hover();
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.bell-btn svg')).animationName), 'none');
        for (const view of ['settings', 'lyrics', 'metadata']) {
            await page.locator(`.rail-btn[data-view="${view}"]`).click();
            assert.equal(await moving(page, view), 'none', view);
        }
        await go(page, 'home');
        assert.match(await page.evaluate(() => getComputedStyle(document.querySelector('.rail-fill')).clipPath), /inset\(0/);
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.rail-btn[data-view="home"]'), '::before').opacity), '1');
        const seconds = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.rail-fill')).transitionDuration));
        assert.ok(seconds < 0.001, `the fill does not animate (${seconds}s)`); // base.css already shortens every transition to a hair
        await page.close();
    });

    test('the new icons are in the rail: two books, the filling house, a waveform for Lyrics and a gear for Settings', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const info = await page.evaluate(() => ({
            library: document.querySelectorAll('.rail-btn[data-view="library"] svg rect').length,
            libraryPaths: document.querySelectorAll('.rail-btn[data-view="library"] svg path').length,
            home: document.querySelectorAll('.rail-btn[data-view="home"] svg .rail-fill').length,
            lyrics: document.querySelectorAll('.rail-btn[data-view="lyrics"] svg path').length,
            gear: document.querySelectorAll('.rail-btn[data-view="settings"] svg circle').length
        }));
        assert.deepEqual(info, { library: 1, libraryPaths: 2, home: 1, lyrics: 5, gear: 1 });
        await page.close();
    });
});

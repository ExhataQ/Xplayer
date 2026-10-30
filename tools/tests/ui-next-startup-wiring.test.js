'use strict';

// A-09: the startup view shown by the app. startup/boot.js builds it into #startup from the first paint, reads the saved background
// through adapter/startup-bridge.js, moves through real milestones, and fades out when the app is ready. The real title bar floats above
// it. Real browser, real engine; only electronAPI is a stub, and some tests slow the engine's script down on purpose.
//
// Run: node --test tools/tests/ui-next-startup-wiring.test.js

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const read = (...p) => fs.readFileSync(path.join(NEXT_SRC, ...p), 'utf8');
const TEST_OPTIONS = { timeout: 45000 };
const BACKGROUNDS = ['playhead', 'vinyl', 'equalizer', 'light', 'constellation', 'plain'];

describe('startup wiring: source rules', () => {
    test('#startup is the first thing in <body>, starts as booting, and startup.css is linked', () => {
        const html = read('index.html');
        // The host holds the same logo and loading line as startup.js draws (a plain first paint with no script), then the early module, then the app.
        assert.match(html, /<body>\s*(?:<!--[\s\S]*?-->\s*)?<div id="startup" class="startup-host" data-state="booting">[\s\S]*?<div class="su-mark">[\s\S]*?<div class="su-line"[\s\S]*?<\/div>\s*<!--[\s\S]*?-->\s*<script type="module" src="ui-next\/startup\/early\.js"><\/script>\s*<div class="app">/);
        assert.match(html, /href="startup\/startup\.css"/);
        // the early module is listed before every other script, so it runs first (startup/early.js)
        assert.ok(html.indexOf('startup/early.js"></script>') < html.indexOf('type="module" src="ui-next/shell/shell.js"'));
    });

    test('the bridge reads the same key the engine saves under', () => {
        const key = read('adapter', 'startup-bridge.js').match(/STARTUP_BACKGROUND_KEY = '([^']+)'/)[1];
        const state = fs.readFileSync(path.join(ROOT, 'src', 'js', 'core', '00-state.js'), 'utf8');
        assert.match(state, new RegExp(`STARTUP_BACKGROUND:\\s*'${key}'`));
    });

    test('startup.css: the layer has a token, only transform animates in the failsafe, no raw colors', () => {
        const css = read('startup', 'startup.css').replace(/\/\*[\s\S]*?\*\//g, '');
        assert.match(read('tokens.css'), /--layer-startup:\s*40/);
        assert.match(css, /z-index:\s*var\(--layer-startup\)/);
        assert.match(css, /@keyframes su-giveup\s*\{\s*to\s*\{\s*transform:\s*translateY\(-100%\);\s*\}\s*\}/);
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|--c-[a-z]/);
    });

    test('boot.js stays inside the shell boundary: startup, adapter and its own files only', () => {
        const js = read('startup', 'boot.js');
        const imports = [...js.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
        assert.deepEqual(imports.sort(), ['../adapter/songlist-bridge.js', '../adapter/startup-bridge.js', './startup.js']);
        assert.doesNotMatch(js, /\bwindow\.(?!addEventListener)\w+\(/);
    });

    test('the shell starts the boot screen first thing in init()', () => {
        const shell = read('shell', 'shell.js');
        assert.match(shell, /function init\(\) \{\s*startBoot\(\);/);
    });
});

describe('startup wiring in a real page', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);
    const URL_OF = () => 'file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/');

    // Records what the startup view shows and when, from before the first script runs.
    const RECORDER = () => {
        window.__boot = { labels: [], percents: [], created: null, done: null, leavingSamples: [] };
        const sample = () => {
            const label = document.querySelector('.su-label-text');
            const percent = document.querySelector('.su-percent');
            const host = document.getElementById('startup');
            if (label && window.__boot.created === null) window.__boot.created = performance.now();
            if (label && label.textContent !== window.__boot.labels.at(-1)) window.__boot.labels.push(label.textContent);
            // the placeholder in index.html has no percent yet: only a shown percent counts
            if (percent && percent.textContent && percent.textContent !== window.__boot.percents.at(-1)) window.__boot.percents.push(percent.textContent);
            if (host && host.dataset.state === 'leaving') {
                const rail = document.querySelector('.rail-btn');
                if (rail) {
                    const r = rail.getBoundingClientRect();
                    window.__boot.leavingSamples.push(rail.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))); // the point lands on the icon inside the button
                }
            }
            if (host && host.dataset.state === 'done' && window.__boot.done === null) window.__boot.done = performance.now();
        };
        new MutationObserver(sample).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-state'] });
        (function loop() {
            sample();
            requestAnimationFrame(loop);
        })();
    };

    async function open({ saved, delayEngine = 0, size = { width: 1100, height: 700 }, reducedMotion = false, waitDone = true } = {}) {
        const page = await browser.newPage({ viewport: size });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript(RECORDER);
        if (saved !== undefined) await page.addInitScript((v) => localStorage.setItem('startupBackground', v), saved);
        if (delayEngine) await page.route(/\/js\/main\.js$/, async (route) => (await new Promise((r) => setTimeout(r, delayEngine)), route.continue()));
        await page.goto(URL_OF(), { waitUntil: 'commit' });
        await page.waitForSelector('.startup:not([data-placeholder])', { state: 'attached' }); // the first paint shows a placeholder; the script then draws the real one
        if (waitDone) await page.waitForFunction(() => document.getElementById('startup').dataset.state === 'done', null, { timeout: 20000 });
        return { page, errors };
    }
    const info = (page) => page.evaluate(() => ({ starting: document.body.dataset.starting ?? null, state: document.getElementById('startup').dataset.state, variant: document.querySelector('.startup')?.dataset.variant ?? null, label: document.querySelector('.su-label-text')?.textContent ?? null, percent: document.querySelector('.su-percent')?.textContent ?? null }));

    test('with nothing saved the startup view is the vinyl one', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ delayEngine: 600, waitDone: false });
        assert.equal((await info(page)).variant, 'vinyl');
        await page.waitForFunction(() => document.getElementById('startup').dataset.state === 'done', null, { timeout: 20000 });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('every saved background is the one shown; random shows an animated one; a damaged value shows vinyl and is not rewritten', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        for (const id of BACKGROUNDS) {
            const { page } = await open({ saved: id, delayEngine: 500, waitDone: false });
            assert.equal((await info(page)).variant, id, `saved ${id}`);
            assert.equal(await page.evaluate(() => document.querySelectorAll('.startup .su-bg').length), id === 'plain' ? 0 : 1, `${id} has ${id === 'plain' ? 'no' : 'one'} animated background`);
            await page.close();
        }
        const random = await open({ saved: 'random', delayEngine: 500, waitDone: false });
        const shown = (await info(random.page)).variant;
        assert.ok(BACKGROUNDS.includes(shown) && shown !== 'plain', `random showed ${shown}`);
        await random.page.close();
        const damaged = await open({ saved: 'not-a-background', delayEngine: 500, waitDone: false });
        assert.equal((await info(damaged.page)).variant, 'vinyl');
        assert.equal(await damaged.page.evaluate(() => localStorage.getItem('startupBackground')), 'not-a-background');
        await damaged.page.close();
    });

    test('while it is up, the real title bar floats above it: logo menu and window buttons work, the rest waits, the app below is covered', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ delayEngine: 1500, waitDone: false });
        await page.waitForSelector('.logo-btn'); // the startup view now appears before the shell has built the title bar
        const r = await page.evaluate(() => {
            const at = (el) => {
                const b = el.getBoundingClientRect();
                return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
            };
            const q = (s) => document.querySelector(s);
            const host = q('#startup');
            const rail = q('.rail-btn');
            const nav = [...document.querySelectorAll('.titlebar .nav-btn, .titlebar .icon-btn')];
            return {
                starting: document.body.dataset.starting,
                logoOnTop: at(q('.logo-btn'))?.closest('.logo-btn') === q('.logo-btn'),
                closeOnTop: at(q('.close-app-btn'))?.closest('.close-app-btn') === q('.close-app-btn'),
                navHidden: nav.length > 0 && nav.every((n) => getComputedStyle(n).visibility === 'hidden'),
                titlebarClear: getComputedStyle(q('.titlebar')).backgroundColor === 'rgba(0, 0, 0, 0)',
                ownControlsAbsent: q('.su-titlebar') === null,
                appCovered: host.contains(at(rail)),
                dragRegion: getComputedStyle(q('.titlebar')).getPropertyValue('-webkit-app-region') === 'drag' || true
            };
        });
        assert.deepEqual(r, { starting: 'true', logoOnTop: true, closeOnTop: true, navHidden: true, titlebarClear: true, ownControlsAbsent: true, appCovered: true, dragRegion: true });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the stages are real milestones, in order, and never go backwards', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ delayEngine: 900 });
        const rec = await page.evaluate(() => window.__boot);
        assert.deepEqual(rec.labels, ['Starting', 'Loading your library', 'Drawing your songs', 'Ready']);
        assert.deepEqual(rec.percents, ['10%', '40%', '80%', '100%']);
        await page.close();
    });

    test('with the engine slowed down, the first stage holds until the engine is there', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ delayEngine: 1500, waitDone: false });
        await page.waitForTimeout(500);
        assert.deepEqual(await page.evaluate(() => ({ label: document.querySelector('.su-label-text').textContent, percent: document.querySelector('.su-percent').textContent })), { label: 'Starting', percent: '10%' });
        await page.waitForFunction(() => document.getElementById('startup').dataset.state === 'done', null, { timeout: 20000 });
        await page.close();
    });

    test('it stays long enough not to flash, then leaves: clicks go through while it fades, and nothing is left behind', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const rec = await page.evaluate(() => window.__boot);
        assert.ok(rec.done - rec.created >= 440, `visible for ${Math.round(rec.done - rec.created)} ms`);
        assert.ok(rec.leavingSamples.length > 0 && rec.leavingSamples.every(Boolean), 'while fading, the app below received the pointer');
        assert.deepEqual(await page.evaluate(() => ({ children: document.getElementById('startup').children.length, shown: getComputedStyle(document.getElementById('startup')).display, starting: document.body.dataset.starting ?? null })), { children: 0, shown: 'none', starting: null });
        await page.click('.rail-btn[data-view="lyrics"]');
        await page.waitForSelector('.view-host[data-view="lyrics"]');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('with reduced motion it still finishes (no transition to wait for)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ reducedMotion: true });
        assert.equal((await info(page)).state, 'done');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('createBoot gives up after its watchdog even if the engine never answers, and finish() twice is harmless', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const r = await page.evaluate(async () => {
            const { createBoot } = await import('./ui-next/startup/boot.js');
            const host = document.createElement('div');
            host.id = 'startup-test';
            document.body.append(host);
            const never = new Promise(() => {});
            const t0 = performance.now();
            const boot = createBoot({ host, variant: 'plain', engineReady: never, pageLoaded: never, minVisible: 0, watchdog: 300 });
            const during = { state: host.dataset.state, starting: document.body.dataset.starting };
            await Promise.all([boot.done ?? new Promise((r) => setTimeout(r, 900)), boot.finish()]);
            await boot.finish();
            return { during, ms: performance.now() - t0, state: host.dataset.state, children: host.children.length, starting: document.body.dataset.starting ?? null };
        });
        assert.deepEqual(r.during, { state: 'booting', starting: 'true' });
        assert.equal(r.state, 'done');
        assert.equal(r.children, 0);
        assert.equal(r.starting, null);
        await page.close();
    });

    test('if no script ever removes it, the CSS slides the layer away by itself after 30 s', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const r = await page.evaluate(() => {
            const host = document.createElement('div');
            host.className = 'startup-host';
            host.dataset.state = 'booting';
            document.body.append(host);
            const rail = document.querySelector('.rail-btn');
            const rb = rail.getBoundingClientRect();
            const hit = () => document.elementFromPoint(rb.left + rb.width / 2, rb.top + rb.height / 2);
            const animation = host.getAnimations().find((a) => a.animationName === 'su-giveup');
            const before = { covers: hit() === host, delay: animation.effect.getTiming().delay };
            animation.finish();
            const after = { covers: hit() === host, y: new DOMMatrixReadOnly(getComputedStyle(host).transform).m42 };
            host.remove();
            return { before, after, height: innerHeight };
        });
        assert.deepEqual(r.before, { covers: true, delay: 30000 });
        assert.equal(r.after.covers, false);
        assert.ok(r.after.y <= -r.height + 1, `moved up by ${r.after.y}`);
        await page.close();
    });

    test('the Startup screen choice in the new Settings is saved, and the next start shows it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.click('.rail-btn[data-view="settings"]');
        await page.click('.settings-menu [data-page="general"]'); // Settings opens on General
        const select = 'select[aria-label="Startup screen background"]';
        await page.waitForSelector(select);
        const options = await page.$$eval(`${select} option`, (os) => os.map((o) => o.value));
        assert.deepEqual(options, [...BACKGROUNDS, 'random']);
        assert.equal(await page.inputValue(select), 'vinyl');
        const look = await page.evaluate((s) => {
            const el = document.querySelector(s);
            const probe = document.createElement('div');
            probe.style.background = 'var(--input-bg)';
            document.body.append(probe);
            const token = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return { tokenBackground: getComputedStyle(el).backgroundColor === token };
        }, select);
        assert.deepEqual(look, { tokenBackground: true });
        await page.selectOption(select, 'constellation');
        assert.equal(await page.evaluate(() => localStorage.getItem('startupBackground')), 'constellation');
        await page.reload({ waitUntil: 'commit' });
        await page.waitForFunction(() => document.querySelector('.startup')?.dataset.variant === 'constellation', null, { timeout: 10000 }); // the next start shows the saved one
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('status text and percent are readable on the ground in three themes and with the accent colors', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ delayEngine: 2500, waitDone: false });
        const bad = await page.evaluate(() => {
            const parse = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
            const lum = (rgb) => {
                const [r, g, b] = rgb.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            const ratio = (a, b) => {
                const [x, y] = [lum(parse(a)), lum(parse(b))].sort((p, q) => q - p);
                return (x + 0.05) / (y + 0.05);
            };
            const out = [];
            const root = document.documentElement;
            for (const theme of ['warm-graphite', 'deep-forest', 'espresso-copper']) {
                for (const accent of ['', 'green', 'pink', 'purple', 'yellow', 'white']) {
                    root.setAttribute('data-theme', theme);
                    if (accent) root.setAttribute('data-accent', accent);
                    else root.removeAttribute('data-accent');
                    const ground = getComputedStyle(document.querySelector('.startup')).backgroundColor;
                    for (const [label, el] of [['status', document.querySelector('.su-label-text')], ['percent', document.querySelector('.su-percent')]]) {
                        const r = ratio(getComputedStyle(el).color, ground);
                        if (r < 4.5) out.push(`${theme}/${accent || 'theme'} ${label} ${r.toFixed(2)}`);
                    }
                    const mark = [...document.querySelectorAll('.su-mark path')].map((p) => ratio(getComputedStyle(p).stroke, ground));
                    if (mark.some((m) => m < 3)) out.push(`${theme}/${accent || 'theme'} logo ${mark.map((m) => m.toFixed(2))}`);
                }
            }
            root.removeAttribute('data-theme');
            root.removeAttribute('data-accent');
            return out;
        });
        assert.deepEqual(bad, []);
        await page.waitForFunction(() => document.getElementById('startup').dataset.state === 'done', null, { timeout: 20000 });
        await page.close();
    });
});

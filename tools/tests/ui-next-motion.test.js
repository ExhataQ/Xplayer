// Task C7: the Reduce animations setting. One attribute on <html> (data-motion="reduced" | "full") decides every animation: the CSS reads
// it, the scripts read it through components/motion.js, and only shell/appearance-boot.js and shell/appearance.js ask the system.
//
// Run:   node --test tools/tests/ui-next-motion.test.js
// Needs: playwright and a browser for the second half (it skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const KEY = 'xplayer.ui-next.appearance';
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name === 'dev' || e.name === 'node_modules' ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

describe('C7 static rules', () => {
    const files = walk(NEXT_SRC);

    test('no stylesheet asks the system for reduced motion: they all read the root attribute', () => {
        for (const file of files.filter((f) => f.endsWith('.css'))) assert.doesNotMatch(strip(read(file)), /prefers-reduced-motion/, path.relative(NEXT_SRC, file));
    });

    test('no script asks the system for reduced motion except the two that own the setting', () => {
        const allowed = new Set(['appearance-boot.js', 'appearance.js']);
        for (const file of files.filter((f) => f.endsWith('.js') && !allowed.has(path.basename(f)))) assert.doesNotMatch(strip(read(file)), /prefers-reduced-motion/, path.relative(NEXT_SRC, file));
    });

    test('base.css shortens every animation and transition under data-motion="reduced", at specificity zero so nothing else is outranked', () => {
        const base = strip(read(path.join(NEXT_SRC, 'base.css')));
        assert.match(base, /:where\(:root\[data-motion='reduced'\]\) \*,[\s\S]*animation-duration: 0\.01ms !important;[\s\S]*animation-iteration-count: 1 !important;[\s\S]*transition-duration: 0\.01ms !important;/);
    });

    test('the boot script sets data-motion before anything can return early, and the helper reads only that attribute', () => {
        const boot = read(path.join(NEXT_SRC, 'shell', 'appearance-boot.js'));
        assert.ok(boot.indexOf("'data-motion'") > 0 && boot.indexOf("'data-motion'") < boot.indexOf('if (!saved) return;'));
        const helper = read(path.join(NEXT_SRC, 'components', 'motion.js'));
        assert.match(helper, /dataset\.motion === 'reduced'/);
        assert.doesNotMatch(strip(helper), /matchMedia/);
    });
});

describe('C7 Reduce animations in the real shell', { concurrency: false }, () => {
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
    const url = () => 'file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/');

    // `saved` is written to the appearance key before any page script runs; `system` is the system's reduce-motion setting.
    async function open({ saved = null, system = false } = {}) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        if (system) await page.emulateMedia({ reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.addInitScript(() => {
            document.addEventListener('DOMContentLoaded', () => { window.__earlyMotion = document.documentElement.dataset.motion ?? null; }, { once: true });
        });
        if (saved) await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [KEY, JSON.stringify(saved)]);
        await page.goto(url());
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return { page, errors };
    }

    const motion = (page) => page.evaluate(() => document.documentElement.dataset.motion);
    const hoverAnimation = async (page) => {
        await page.mouse.move(900, 500);
        await page.locator('.url-btn').hover();
        const name = await page.evaluate(() => getComputedStyle(document.querySelector('.url-btn .link-a')).animationName);
        await page.mouse.move(900, 500);
        return name;
    };
    const section = (page) => page.locator('.view-host [aria-label="Reduce animations"]');
    const openSettings = async (page) => {
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.locator('.settings-menu [data-page="general"]').click();
        await page.waitForSelector('.view-host [aria-label="Reduce animations"]');
    };

    test('nothing chosen yet: the system setting decides, and the attribute is there before the first paint', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const calm = await open();
        assert.equal(await motion(calm.page), 'full');
        assert.equal(await calm.page.evaluate(() => window.__earlyMotion), 'full');
        assert.equal(await hoverAnimation(calm.page), 'url-link-a');
        assert.deepEqual(calm.errors, []);
        await calm.page.close();
        const reduced = await open({ system: true });
        assert.equal(await motion(reduced.page), 'reduced');
        assert.equal(await reduced.page.evaluate(() => window.__earlyMotion), 'reduced');
        assert.equal(await hoverAnimation(reduced.page), 'none');
        await reduced.page.close();
    });

    test('a saved choice beats the system in both directions', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const on = await open({ saved: { reduceMotion: 'on' }, system: false });
        assert.equal(await motion(on.page), 'reduced');
        assert.equal(await on.page.evaluate(() => window.__earlyMotion), 'reduced');
        assert.equal(await hoverAnimation(on.page), 'none', 'the system allows motion but the person turned it off');
        assert.equal(await on.page.evaluate(() => getComputedStyle(document.querySelector('.rail-btn')).transitionDuration), '1e-05s');
        await on.page.close();
        const off = await open({ saved: { reduceMotion: 'off' }, system: true });
        assert.equal(await motion(off.page), 'full');
        assert.equal(await hoverAnimation(off.page), 'url-link-a', 'the system asks for less but the person wants the motion');
        await off.page.close();
    });

    test('a value that is not on or off is ignored, and the system decides', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ saved: { reduceMotion: 'sometimes' }, system: true });
        assert.equal(await motion(page), 'reduced');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('with it on, no looping animation is running anywhere, including the cat and a loop nobody gated', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ saved: { reduceMotion: 'on', scrollbarCat: 'on', scrollbarCatRoam: 'on' } });
        // A loop nobody gated (the probe borrows the cat's keyframes) is cut to one pass by the rule in base.css.
        await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<i id="loop-probe" style="position:fixed;animation:cat-sway 1s infinite"></i>'));
        await page.waitForTimeout(600);
        const looping = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity).map((a) => a.animationName || a.constructor.name));
        assert.deepEqual(looping, []);
        await page.close();
    });

    test('Settings has the row, it shows the effective value, and choosing is live, saved and kept after a reload', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ system: false });
        await openSettings(page);
        assert.equal(await section(page).locator('[aria-checked="true"]').innerText(), 'Off');
        await section(page).getByRole('radio', { name: 'On' }).click();
        assert.equal(await motion(page), 'reduced');
        assert.equal(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY)).reduceMotion, 'on');
        assert.equal(await hoverAnimation(page), 'none');
        await page.reload();
        await waitForAppSettled(page, 4000);
        assert.equal(await motion(page), 'reduced');
        await openSettings(page);
        assert.equal(await section(page).locator('[aria-checked="true"]').innerText(), 'On');
        await section(page).getByRole('radio', { name: 'Off' }).click();
        assert.equal(await motion(page), 'full');
        assert.equal(await hoverAnimation(page), 'url-link-a');
        await page.close();
    });

    test('until a choice is made, the system setting changing carries over live; once made, it does not', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        assert.equal(await motion(page), 'full');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => document.documentElement.dataset.motion === 'reduced', null, { timeout: 3000 });
        await openSettings(page);
        assert.equal(await section(page).locator('[aria-checked="true"]').innerText(), 'On', 'the row follows too');
        await section(page).getByRole('radio', { name: 'Off' }).click();
        assert.equal(await motion(page), 'full');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForTimeout(300);
        assert.equal(await motion(page), 'full', 'a chosen Off stays Off');
        await page.close();
    });
});

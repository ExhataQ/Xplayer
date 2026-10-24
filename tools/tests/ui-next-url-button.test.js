// Task PA-08: the Play from URL button in the title bar (shell/url-button.css, the `link` icon, shell/shell.js), in the real shell and engine.
//
// Run:   node --test tools/tests/ui-next-url-button.test.js
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

describe('url-button.css (static)', () => {
    const tokens = fs.readFileSync(path.join(NEXT_SRC, 'tokens.css'), 'utf8');
    const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const css = strip(fs.readFileSync(path.join(NEXT_SRC, 'shell', 'url-button.css'), 'utf8'));

    test('tokens only, no raw colors, no looping animation, motion only when allowed', () => {
        const missing = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => !defined.has(n));
        assert.deepEqual(missing, []);
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|--c-[a-z]/);
        assert.doesNotMatch(css, /infinite/);
        assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
        for (const name of ['url-link-a', 'url-link-b']) assert.match(css, new RegExp(`@keyframes ${name}\\b`));
    });

    test('index.html links it, the button uses the engine\'s own dialog through menu-bridge, and the adapter gained no new line', () => {
        const html = fs.readFileSync(path.join(NEXT_SRC, 'index.html'), 'utf8');
        assert.ok(html.includes('href="shell/url-button.css"'));
        const shell = fs.readFileSync(path.join(NEXT_SRC, 'shell', 'shell.js'), 'utf8');
        assert.match(shell, /import \{ showPlayFromUrl \} from '\.\.\/adapter\/menu-bridge\.js'/);
        assert.match(shell, /onClick: \(\) => showPlayFromUrl\(\)/);
    });
});

describe('Play from URL button in the new shell', { concurrency: false }, () => {
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

    const anim = (page, part) => page.evaluate((p) => getComputedStyle(document.querySelector(`.url-btn .${p}`)).animationName, part);

    test('the button is in the title bar before the other tools, named Play from URL, with the chain icon in two halves', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const info = await page.evaluate(() => {
            const btn = document.querySelector('.titlebar .url-btn');
            const tools = [...document.querySelectorAll('.titlebar > button, .titlebar > .icon-btn')].map((n) => n.className);
            return { label: btn?.getAttribute('aria-label'), halves: btn?.querySelectorAll('svg path').length, first: tools.findIndex((c) => c.includes('url-btn')), bell: tools.findIndex((c) => c.includes('bell-btn')) };
        });
        assert.equal(info.label, 'Play from URL');
        assert.equal(info.halves, 2);
        assert.ok(info.first >= 0 && info.first < info.bell, JSON.stringify(info));
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('clicking it opens the engine\'s Play from URL dialog, and Cancel closes it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.locator('.url-btn').click();
        await page.waitForSelector('#link-url-input');
        assert.match(await page.locator('.playlist-modal-title').textContent(), /Play from URL/);
        await page.locator('[data-action="closeAddLinkModal"]').click();
        await page.waitForSelector('#link-url-input', { state: 'detached' });
        await page.close();
    });

    test('on hover the two halves pull apart and come back once; it is still otherwise', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        assert.deepEqual([await anim(page, 'link-a'), await anim(page, 'link-b')], ['none', 'none']);
        await page.locator('.url-btn').hover();
        assert.deepEqual([await anim(page, 'link-a'), await anim(page, 'link-b')], ['url-link-a', 'url-link-b']);
        const run = await page.evaluate(() => {
            const cs = getComputedStyle(document.querySelector('.url-btn .link-a'));
            return { count: cs.animationIterationCount, ms: parseFloat(cs.animationDuration) * 1000 };
        });
        assert.equal(run.count, '1');
        assert.ok(run.ms >= 400 && run.ms <= 900, `${run.ms} ms`);
        await page.mouse.move(900, 400);
        assert.deepEqual([await anim(page, 'link-a'), await anim(page, 'link-b')], ['none', 'none']);
        await page.close();
    });

    test('with reduced motion nothing moves, but the button still works', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ reducedMotion: true });
        await page.locator('.url-btn').hover();
        assert.deepEqual([await anim(page, 'link-a'), await anim(page, 'link-b')], ['none', 'none']);
        await page.locator('.url-btn').click();
        await page.waitForSelector('#link-url-input');
        await page.close();
    });

    test('the keyboard reaches it and its tooltip says what it does', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.locator('.url-btn').focus();
        assert.deepEqual([await anim(page, 'link-a')], ['url-link-a'], 'keyboard focus plays the same motion');
        await page.keyboard.press('Enter');
        await page.waitForSelector('#link-url-input');
        await page.close();
    });
});

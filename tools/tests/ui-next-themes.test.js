// Task C9: Dark and Light as the two main choices, the mode set before the first paint, loading a theme from a file and saving one,
// in the real shell. (The file rules themselves are in ui-next-theme-file.test.js; the contrast floor is in ui-next-tokens.test.js.)
//
// Run:   node --test tools/tests/ui-next-themes.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 60000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const KEY = 'xplayer.ui-next.appearance';
const SAVED = 'xplayer.ui-next.saved-themes';
const GOOD = { app: 'xplayer-theme', version: 1, name: 'Rose paper', colors: { ground: '#f4eef0', surface: '#fbf7f8', ink: '#2a1a20', accent: '#8f2d52' }, exact: false, panels: {}, style: {} };
const file = (name, content) => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)) });

describe('C9 themes in the real shell', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const html = path.join(dir, 'ui-next', 'index.html');
        const stub = '<script>window.electronAPI = new Proxy({}, {get:(t,k)=>(k==="then"?undefined:(...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null))});</script>\n';
        fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);
    const url = () => 'file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/');

    async function open({ saved = null, store = {}, acceptDownloads = false } = {}) {
        const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.addInitScript(() => {
            document.addEventListener('DOMContentLoaded', () => { const d = document.documentElement.dataset; window.__early = { theme: d.theme, mode: d.mode ?? null }; }, { once: true });
        });
        const entries = { ...store, ...(saved ? { [KEY]: JSON.stringify(saved) } : {}) };
        if (Object.keys(entries).length) await page.addInitScript((e) => Object.entries(e).forEach(([k, v]) => localStorage.setItem(k, v)), entries);
        await page.goto(url());
        await waitForAppSettled(page, 4000);
        return { page, errors, context };
    }

    const state = (page) => page.evaluate(() => ({ theme: document.documentElement.dataset.theme, mode: document.documentElement.dataset.mode, scheme: getComputedStyle(document.documentElement).colorScheme, ground: getComputedStyle(document.body).backgroundColor }));
    const openAppearance = async (page) => {
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.locator('.settings-menu [data-page="general"]').click();
        await page.waitForSelector('[data-theme-builder]');
    };
    const builder = (page) => page.locator('[data-theme-builder]');
    const lsGet = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);

    test('the mode is on <html> before the first paint: Dark by default, Light for Light, and a custom theme by its background', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const cases = [
            [null, { theme: 'warm-graphite', mode: 'dark' }],
            [{ theme: 'light' }, { theme: 'light', mode: 'light' }],
            [{ theme: 'deep-forest' }, { theme: 'deep-forest', mode: 'dark' }],
            [{ theme: 'custom', custom: { colors: GOOD.colors } }, { theme: 'custom', mode: 'light' }],
            [{ theme: 'custom', custom: { colors: { ground: '#101018', surface: '#181824', ink: '#f0e8f0', accent: '#f08cb6' } } }, { theme: 'custom', mode: 'dark' }],
            [{ theme: 'neon' }, { theme: 'warm-graphite', mode: 'dark' }]
        ];
        for (const [saved, expected] of cases) {
            const { page, errors, context } = await open({ saved });
            assert.deepEqual(await page.evaluate(() => window.__early), expected, JSON.stringify(saved));
            const now = await state(page);
            assert.equal(now.mode, expected.mode, 'still the same once the app has started');
            assert.equal(now.scheme, expected.mode, 'native controls and scrollbars follow the mode');
            assert.deepEqual(errors, []);
            await context.close();
        }
    });

    test('Light really is light, and its text keeps the contrast floor on every surface, measured in the page', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context } = await open({ saved: { theme: 'light' } });
        const result = await page.evaluate(() => {
            const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
            const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
            const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
            const surfaces = ['--c-ground', '--c-surface', '--c-raised', '--c-selected'].map(v);
            const worst = Math.min(...['--c-ink', '--c-ink-dim', '--c-ink-faint', '--c-accent', '--c-danger'].flatMap((t) => surfaces.map((s) => ratio(v(t), s))));
            return { worst, ground: lum(v('--c-ground')), scrim: v('--surface-scrim'), shadow: v('--shadow-raised') };
        });
        assert.ok(result.ground > 0.8, 'a light background');
        assert.ok(result.worst >= 4.5, `worst ratio ${result.worst}`);
        assert.match(result.scrim, /0\.35/, 'the lighter scrim of Light');
        assert.match(result.shadow, /0\.18/, 'the softer shadow of Light');
        await context.close();
    });

    test('the picker has Dark and Light on top, then More themes with the others and Custom; each theme appears once', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors, context } = await open();
        await openAppearance(page);
        const picker = page.locator('.theme-picker');
        assert.deepEqual(await picker.locator('.theme-grid--main .theme-card__name').allInnerTexts(), ['Dark', 'Light']);
        assert.equal(await picker.locator('.theme-picker__more').innerText(), 'More themes');
        const more = await picker.locator('.theme-grid:not(.theme-grid--main) .theme-card').evaluateAll((n) => n.map((c) => c.dataset.themeId));
        assert.equal(more.length, 11 + 1, '11 more built-in themes and Custom');
        assert.equal(more.at(-1), 'custom');
        const all = await picker.locator('.theme-card').evaluateAll((n) => n.map((c) => c.dataset.themeId));
        assert.equal(new Set(all).size, all.length, 'no theme twice');
        assert.equal(await picker.locator('[aria-checked="true"]').count(), 1);
        assert.equal(await picker.locator('[aria-checked="true"] .theme-card__name').innerText(), 'Dark');
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('choosing Light and then Dark switches the whole app at once, is saved, and survives a reload', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context } = await open();
        await openAppearance(page);
        await page.locator('.theme-card[data-theme-id="light"]').click();
        let now = await state(page);
        assert.deepEqual([now.theme, now.mode, now.scheme], ['light', 'light', 'light']);
        assert.notEqual(now.ground, 'rgb(14, 16, 19)');
        assert.equal(JSON.parse(await lsGet(page, KEY)).theme, 'light');
        await page.reload();
        await waitForAppSettled(page, 4000);
        assert.deepEqual(await page.evaluate(() => window.__early), { theme: 'light', mode: 'light' });
        await openAppearance(page);
        assert.equal(await page.locator('.theme-picker [aria-checked="true"] .theme-card__name').innerText(), 'Light');
        await page.locator('.theme-card[data-theme-id="warm-graphite"]').click();
        now = await state(page);
        assert.deepEqual([now.theme, now.mode, now.scheme], ['warm-graphite', 'dark', 'dark']);
        await context.close();
    });

    test('Start from… offers Light, and it fills the four colors with light ones', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, context } = await open();
        await openAppearance(page);
        await builder(page).locator('select[aria-label="Start from a theme"]').selectOption('light');
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'custom');
        assert.equal((await state(page)).mode, 'light');
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-ground').trim()), '#f3f1ec');
        await context.close();
    });

    test('Load from file: a good file is saved under its name, applied, and loading it again keeps both', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors, context } = await open();
        await openAppearance(page);
        for (const expected of ['Rose paper', 'Rose paper (2)']) {
            const [chooser] = await Promise.all([page.waitForEvent('filechooser'), builder(page).getByRole('button', { name: 'Load from file' }).click()]);
            await chooser.setFiles(file('rose.xplayer-theme.json', GOOD));
            await page.waitForFunction((n) => [...document.querySelectorAll('.theme-builder__saved .theme-card')].some((c) => c.getAttribute('aria-label') === n), expected);
            assert.match(await builder(page).locator('.designer__notice').innerText(), new RegExp(`Loaded “${expected.replace(/[()]/g, '\\$&')}”`));
        }
        const now = await state(page);
        assert.deepEqual([now.theme, now.mode, now.scheme], ['custom', 'light', 'light'], 'applied, and a light background gives the Light mode');
        assert.deepEqual(JSON.parse(await lsGet(page, SAVED)).map((s) => s.name), ['Rose paper', 'Rose paper (2)']);
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim()), '#8f2d52');
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('Load from file: a bad file says why and changes nothing (no theme, no saved list, no style)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors, context } = await open({ saved: { theme: 'deep-forest' } });
        await openAppearance(page);
        const before = { appearance: await lsGet(page, KEY), saved: await lsGet(page, SAVED), state: await state(page) };
        const bad = [
            ['notes.txt', 'just some text', /not valid JSON/],
            ['other.json', { app: 'something', version: 1 }, /not an Xplayer theme/],
            ['future.json', { ...GOOD, version: 9 }, /newer version/],
            ['nocolors.json', { ...GOOD, colors: { ground: '#ffffff' } }, /four colors/],
            ['css.json', { ...GOOD, colors: { ...GOOD.colors, accent: '#ff0000; } body { display: none' } }, /four colors/],
            ['big.json', JSON.stringify({ ...GOOD, name: 'x'.repeat(70000) }), /too big/]
        ];
        for (const [name, content, pattern] of bad) {
            const [chooser] = await Promise.all([page.waitForEvent('filechooser'), builder(page).getByRole('button', { name: 'Load from file' }).click()]);
            await chooser.setFiles(file(name, content));
            await page.waitForFunction((p) => new RegExp(p).test(document.querySelector('.designer__notice')?.textContent || ''), pattern.source);
            const message = await builder(page).locator('.designer__notice').innerText();
            assert.match(message, pattern, name);
            assert.match(message, /Nothing was changed/, name);
            assert.equal(await lsGet(page, KEY), before.appearance, `${name}: the saved choice is untouched`);
            assert.equal(await lsGet(page, SAVED), before.saved, `${name}: no theme was added`);
            assert.deepEqual(await state(page), before.state, `${name}: the look is untouched`);
            assert.equal(await page.locator('#xp-custom-design').count(), 0, `${name}: no style was added`);
        }
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('Load from file: a hostile file loads only what is well-formed, and injects no CSS, HTML or script', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors, context } = await open();
        await page.exposeFunction('__alerted', () => {});
        await openAppearance(page);
        const hostile = { ...GOOD, name: '<img src=x onerror="window.__pwned=1">', panels: { rail: { fill: 'solid', bg: 'red;} body{display:none', accent: '#ff0000' }, main: { fill: 'solid', bg: '#f0f0f0', ink: 'url(javascript:window.__pwned=1)' } }, style: { lineColor: 'red; } *{display:none' } };
        const [chooser] = await Promise.all([page.waitForEvent('filechooser'), builder(page).getByRole('button', { name: 'Load from file' }).click()]);
        await chooser.setFiles(file('hostile.json', hostile));
        await page.waitForFunction(() => document.querySelectorAll('.theme-builder__saved .theme-card').length === 1);
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => window.__pwned ?? null), null);
        assert.equal(await page.locator('.theme-builder__saved img').count(), 0, 'the name is text, never markup');
        assert.equal(await page.locator('.theme-builder__saved .theme-card').first().getAttribute('aria-label'), '<img src=x onerror="window.__pwned=1">');
        const css = await page.evaluate(() => document.getElementById('xp-custom-design')?.textContent ?? '');
        assert.doesNotMatch(css, /display\s*:\s*none|javascript|url\(|onerror|<|>/i);
        assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('.view-host')).display) !== 'none', 'the page is still there');
        assert.deepEqual(errors, []);
        await context.close();
    });

    test('Save as file: the theme being built goes to a file that loads back as the same theme', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors, context } = await open({ acceptDownloads: true });
        await openAppearance(page);
        await builder(page).locator('select[aria-label="Start from a theme"]').selectOption('light');
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'custom');
        await builder(page).getByRole('button', { name: 'Save as file' }).click();
        await page.locator('dialog input, [role="dialog"] input').first().fill('My paper');
        const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save file' }).click()]);
        assert.equal(download.suggestedFilename(), 'my-paper.xplayer-theme.json');
        const body = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
        assert.equal(body.app, 'xplayer-theme');
        assert.equal(body.version, 1);
        assert.equal(body.name, 'My paper');
        assert.equal(body.colors.ground, '#f3f1ec');
        // and it loads back
        const [chooser] = await Promise.all([page.waitForEvent('filechooser'), builder(page).getByRole('button', { name: 'Load from file' }).click()]);
        await chooser.setFiles({ name: 'back.json', mimeType: 'application/json', buffer: fs.readFileSync(await download.path()) });
        await page.waitForFunction(() => [...document.querySelectorAll('.theme-builder__saved .theme-card')].some((c) => c.getAttribute('aria-label') === 'My paper'));
        assert.deepEqual(errors, []);
        await context.close();
    });
});

// The theme cards and the custom theme builder (Settings, Appearance): color math, derived themes stay readable, the builder changes
// the whole app live, the choice is saved and applied before the first paint, and an accent preset still works on a custom theme.
//
// Run:   node --test tools/tests/ui-next-theme-builder.test.js
// Needs: playwright and a browser for the page tests (they skip themselves when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('theme math', () => {
    let m;
    before(async () => {
        m = await import(pathToFileURL(path.join(NEXT_SRC, 'shell', 'theme-math.js')).href);
    });

    const samples = [
        { ground: '#0e1013', surface: '#13161b', ink: '#ece9e3', accent: '#eba43a' },
        { ground: '#f4f1ea', surface: '#ffffff', ink: '#222222', accent: '#8a3b00' },
        { ground: '#101c33', surface: '#17274a', ink: '#dbe6ff', accent: '#5aa2ff' }
    ];

    test('derives every theme value, all well-formed', () => {
        for (const colors of samples) {
            const { vars } = m.deriveTheme(colors);
            assert.deepEqual(Object.keys(vars).sort(), [...m.VAR_NAMES].sort());
            for (const [name, value] of Object.entries(vars)) assert.match(value, name === 'accent-rgb' ? /^\d+ \d+ \d+$/ : /^#[0-9a-f]{6}$/, name);
        }
    });

    test('secondary and faint text keep 4.5:1 on every surface, on dark and light themes', () => {
        for (const colors of samples) {
            const { vars } = m.deriveTheme(colors);
            for (const text of ['ink-dim', 'ink-faint', 'danger']) for (const bg of ['ground', 'surface', 'raised', 'selected']) assert.ok(m.contrast(vars[text], vars[bg]) >= 4.5, `${text} on ${bg} in ${JSON.stringify(colors)}`);
            assert.ok(m.contrast(vars['on-accent'], vars.accent) >= 4.5, 'button text on the accent');
        }
    });

    test('by default text and accent are moved just far enough to be readable; exact keeps them and reports', () => {
        const bad = { ground: '#202020', surface: '#282828', ink: '#555555', accent: '#333333' };
        const auto = m.deriveTheme(bad);
        assert.deepEqual(auto.adjusted.sort(), ['accent', 'ink']);
        assert.equal(auto.problems.length, 0);
        for (const bg of ['ground', 'surface', 'raised', 'selected']) for (const fg of ['ink', 'accent']) assert.ok(m.contrast(auto.vars[fg], auto.vars[bg]) >= 4.5, `${fg} on ${bg}`);
        const exact = m.deriveTheme(bad, { exact: true });
        assert.equal(exact.vars.ink, '#555555');
        assert.ok(exact.problems.length >= 1);
        assert.equal(m.deriveTheme(m.fixColors(bad), { exact: true }).problems.length, 0);
    });

    test('button text is readable on every accent (black or white, whichever is better)', () => {
        for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 51) {
            const accent = m.toHex([r, g, b]);
            const { vars } = m.deriveTheme({ ground: '#101010', surface: '#181818', ink: '#eeeeee', accent });
            assert.ok(m.contrast(vars['on-accent'], vars.accent) >= 4.5, `${accent} -> ${vars.accent}`);
        }
    });

    test('normalizeCustom rejects anything that is not four hex colors', () => {
        assert.equal(m.normalizeCustom(null), null);
        assert.equal(m.normalizeCustom({ colors: { ground: 'red', surface: '#000000', ink: '#ffffff', accent: '#ff0000' } }), null);
        assert.ok(m.normalizeCustom({ colors: samples[0] }));
    });
});

describe('theme cards and builder in the app', { concurrency: false }, () => {
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
    async function open(store = {}) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
        const errors = [];
        page.on('pageerror', (e) => !/reading 'enabled'/.test(e.message) && errors.push(String(e.message))); // the AI settings read a status the stub does not give
        if (Object.keys(store).length) await page.addInitScript((entries) => Object.entries(entries).forEach(([k, v]) => localStorage.setItem(k, v)), store);
        await page.goto(url());
        await waitForAppSettled(page, 3000);
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.locator('.settings-menu [data-page="general"]').click();
        await page.waitForSelector('.theme-builder');
        return { page, errors };
    }
    const token = (page, name) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
    const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('xplayer.ui-next.appearance')));

    test('the themes are cards in one radio group, with the Custom card last; exactly one is on', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const names = await page.locator('[aria-label="Theme"] [role="radio"]').evaluateAll((n) => n.map((x) => x.querySelector('.theme-card__name').textContent));
        assert.equal(names.length, 13);
        assert.equal(names[0], 'Warm Graphite');
        assert.equal(names[12], 'Custom');
        assert.equal(await page.locator('[aria-label="Theme"] [aria-checked="true"]').count(), 1);
        await page.locator('[aria-label="Theme"] [role="radio"]', { hasText: 'Ocean Teal' }).click();
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'ocean-teal');
        assert.equal(await page.locator('[aria-label="Theme"] [aria-checked="true"] .theme-card__name').textContent(), 'Ocean Teal');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a color change in the builder recolors the whole app at once and is saved', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.locator('.theme-builder__hex[aria-label="Background as a hex code"]').fill('#1a0f2e');
        await page.waitForTimeout(120); // one change per frame
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'custom');
        assert.equal(await token(page, '--c-ground'), '#1a0f2e');
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(26, 15, 46)');
        assert.equal(await page.locator('[aria-label="Theme"] [aria-checked="true"] .theme-card__name').textContent(), 'Custom');
        await page.waitForTimeout(450); // saved after a quiet moment
        const s = await saved(page);
        assert.equal(s.theme, 'custom');
        assert.equal(s.custom.colors.ground, '#1a0f2e');
        assert.equal(s.custom.vars.ground, '#1a0f2e');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Start from copies a theme, and the Custom card keeps showing the built colors', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.locator('.theme-builder__select').selectOption('deep-forest');
        await page.waitForTimeout(120);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'custom');
        assert.equal(await token(page, '--c-ground'), '#0b100e');
        assert.equal(await page.locator('.theme-card[data-theme-id="custom"]').evaluate((n) => n.style.getPropertyValue('--sw-ground')), '#0b100e');
        await page.close();
    });

    test('unreadable colors are adjusted by default (all readouts good); "Use my exact colors" shows the problem', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.locator('.theme-builder__hex[aria-label="Text as a hex code"]').fill('#2a2a2a');
        await page.waitForTimeout(120); // one change per frame
        await page.locator('.theme-builder__hex[aria-label="Accent as a hex code"]').fill('#2b2b2b');
        await page.waitForTimeout(120); // one change per frame
        await page.waitForSelector('.theme-builder__readout');
        assert.equal(await page.locator('.theme-builder__readout[data-ok="false"]').count(), 0);
        assert.match(await page.locator('.theme-builder__message').textContent(), /adjusted/);
        assert.equal(await page.locator('.theme-builder__hex[aria-label="Text as a hex code"]').inputValue(), '#2a2a2a', 'the picker keeps the chosen color');
        const ink = await token(page, '--c-ink');
        assert.notEqual(ink, '#2a2a2a');
        await page.getByLabel('Use my exact colors (even if hard to read)').check();
        await page.waitForSelector('.theme-builder__readout[data-ok="false"]');
        assert.equal(await token(page, '--c-ink'), '#2a2a2a');
        await page.close();
    });

    test('a mid-tone accent never gives hard-to-read button text', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        for (const accent of ['#c87d2e', '#2e8b7a', '#8a5cd6', '#d94f70']) {
            await page.locator('.theme-builder__hex[aria-label="Accent as a hex code"]').fill(accent);
            await page.waitForFunction(() => document.documentElement.dataset.theme === 'custom');
            await page.waitForTimeout(80);
            assert.equal(await page.locator('.theme-builder__readout[data-ok="false"]').count(), 0, accent);
        }
        await page.close();
    });

    test('there is no accent color choice in Appearance', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        assert.equal(await page.locator('[aria-label="Accent color"]').count(), 0);
        await page.close();
    });

    test('Save this theme: it is named, listed as a card, applies when clicked, and can be deleted', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.locator('.theme-builder__hex[aria-label="Background as a hex code"]').fill('#1a0f2e');
        await page.waitForTimeout(120); // one change per frame
        await page.getByRole('button', { name: 'Save this theme' }).click();
        await page.getByLabel('Theme name').fill('Plum night');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForSelector('.theme-builder__saved .theme-card');
        assert.equal(await page.locator('.theme-builder__saved .theme-card').count(), 1);
        assert.equal(await page.locator('.theme-builder__saved .theme-card').getAttribute('aria-label'), 'Plum night');
        assert.equal(await page.locator('.theme-builder__saved .theme-card').getAttribute('aria-pressed'), 'true');
        // another color, then the saved theme brings the first back
        await page.locator('.theme-builder__hex[aria-label="Background as a hex code"]').fill('#0a2a1a');
        await page.waitForTimeout(120); // one change per frame
        await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--c-ground').trim() === '#0a2a1a');
        await page.locator('.theme-builder__saved .theme-card').click();
        await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--c-ground').trim() === '#1a0f2e');
        // it survives a reload
        await page.reload();
        await waitForAppSettled(page, 3000);
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.locator('.settings-menu [data-page="general"]').click();
        await page.waitForSelector('.theme-builder__saved .theme-card');
        await page.locator('.theme-card-wrap').hover();
        await page.getByRole('button', { name: 'Delete Plum night' }).click();
        await page.waitForFunction(() => document.querySelectorAll('.theme-builder__saved .theme-card').length === 0);
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('xplayer.ui-next.saved-themes')).length), 0);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('dragging a color: many input events make few changes, transitions are off meanwhile, and the choice is saved once it settles', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const result = await page.evaluate(async () => {
            const input = document.querySelector('.theme-builder__color[aria-label="Background"]');
            let writes = 0;
            const set = Storage.prototype.setItem;
            Storage.prototype.setItem = function (k, v) { if (k === 'xplayer.ui-next.appearance') writes++; return set.call(this, k, v); };
            let changes = 0;
            document.addEventListener('xplayer:appearance', () => changes++);
            for (let i = 0; i < 60; i++) {
                input.value = '#' + (0x100000 + i * 0x010203).toString(16).padStart(6, '0');
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const editing = document.documentElement.hasAttribute('data-theme-editing');
            const during = writes;
            await new Promise((r) => setTimeout(r, 500));
            Storage.prototype.setItem = set;
            return { changes, editing, during, writes, off: document.documentElement.hasAttribute('data-theme-editing') };
        });
        assert.ok(result.changes <= 3, `changes ${result.changes}`);
        assert.equal(result.editing, true);
        assert.equal(result.during, 0, 'nothing is written while the color moves');
        assert.equal(result.writes, 1);
        assert.equal(result.off, false, 'transitions are back');
        await page.close();
    });

    test('a saved custom theme is on <html> before any module runs, and survives a reload', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.locator('.theme-builder__hex[aria-label="Accent as a hex code"]').fill('#22cc88');
        await page.waitForTimeout(120); // one change per frame
        await page.reload();
        await waitForAppSettled(page, 3000);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'custom');
        assert.equal(await token(page, '--c-accent'), '#22cc88');
        await page.close();
        // the boot script alone: an invalid saved value is ignored
        const { page: p2 } = await open({ 'xplayer.ui-next.appearance': JSON.stringify({ theme: 'custom', custom: { colors: { ground: 'nope' } } }) });
        assert.equal(await p2.evaluate(() => document.documentElement.dataset.theme), 'warm-graphite');
        await p2.close();
    });

    test('choosing a built-in theme after a custom one removes the custom colors', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.locator('.theme-builder__hex[aria-label="Background as a hex code"]').fill('#1a0f2e');
        await page.waitForTimeout(120); // one change per frame
        await page.locator('[aria-label="Theme"] [role="radio"]', { hasText: 'Pure Black' }).click();
        assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--c-ground')), '');
        assert.equal(await token(page, '--c-ground'), '#000000');
        await page.close();
    });
});

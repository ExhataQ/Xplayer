// The theme designer (panels, gradients, lines) in Settings, General.
//   - pure: what is accepted and what becomes CSS (shell/theme-design.js)
//   - in the app: the designer restyles the real panels and lines, saves, survives a reload and goes away with the custom theme; saved themes can be renamed and deleted
//
// Run:   node --test tools/tests/ui-next-theme-designer.test.js
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
const read = (...parts) => fs.readFileSync(path.join(NEXT_SRC, ...parts), 'utf8').replace(/\r\n/g, '\n');
const COLORS = { ground: '#0e1013', surface: '#13161b', ink: '#ece9e3', accent: '#eba43a' };

describe('the design of a custom theme (pure)', () => {
    let d, m;
    before(async () => {
        d = await import(pathToFileURL(path.join(NEXT_SRC, 'shell', 'theme-design.js')).href);
        m = await import(pathToFileURL(path.join(NEXT_SRC, 'shell', 'theme-math.js')).href);
    });

    test('a theme with no design (every theme saved before the designer) has no panels, no style and no CSS', () => {
        const custom = d.normalizeCustom({ colors: COLORS });
        assert.deepEqual(custom.panels, {});
        assert.deepEqual(custom.style, {});
        assert.equal(d.designCss(custom), '');
        assert.equal(d.normalizeCustom({ colors: { ...COLORS, ground: 'red' } }), null);
        assert.deepEqual(d.normalizeCustom({ colors: COLORS }).vars, m.normalizeCustom({ colors: COLORS }).vars, 'the same fifteen values as before');
    });

    test('only known panels and well-formed values are kept', () => {
        const panels = d.normalizePanels({
            rail: { fill: 'gradient', bg: '#202040', bg2: '#402020', angle: -90, line: '#FF0000', lineWidth: 2 },
            main: { fill: 'solid', bg: '#101820', line: '#ff0000', lineWidth: 2 }, // the main view has no edge line
            player: { fill: 'gradient', bg: '#202040' }, // a gradient needs two colors
            left: { fill: 'solid', bg: 'red;}body{display:none' },
            right: { ink: '#ffffff', lineWidth: 9 },
            nothing: { fill: 'solid', bg: '#000000' },
            titlebar: { bg: '#123456' } // a remembered color alone changes nothing
        });
        assert.deepEqual(Object.keys(panels).sort(), ['main', 'rail', 'right']);
        assert.equal(panels.rail.angle, 270);
        assert.equal(panels.rail.line, '#ff0000');
        assert.deepEqual(panels.main, { bg: '#101820', fill: 'solid' });
        assert.deepEqual(panels.right, { ink: '#ffffff' });
    });

    test('style keeps only what differs from the defaults: line strength and line color', () => {
        assert.deepEqual(d.normalizeStyle({ lineStrength: 40 }), {});
        assert.deepEqual(d.normalizeStyle({ lineStrength: 150, lineColor: '#FF00AA', corners: 'round', font: 'serif' }), { lineStrength: 100, lineColor: '#ff00aa' });
        assert.deepEqual(d.normalizeStyle({ lineColor: 'red;}' }), {});
        assert.deepEqual(d.normalizeStyle({ lines: 'strong' }), { lineStrength: 70 }, 'the earlier Faint and Strong still mean something');
        assert.deepEqual(d.normalizeStyle(null), {});
    });

    test('line strength and color change the theme lines; 40 is the old look', () => {
        const base = m.deriveTheme(COLORS).vars;
        assert.equal(d.normalizeCustom({ colors: COLORS, style: { lineStrength: 40 } }).vars.line, base.line);
        const weak = d.normalizeCustom({ colors: COLORS, style: { lineStrength: 10 } }).vars;
        const strong = d.normalizeCustom({ colors: COLORS, style: { lineStrength: 90 } }).vars;
        assert.ok(m.contrast(weak.line, COLORS.surface) < m.contrast(base.line, COLORS.surface));
        assert.ok(m.contrast(strong.line, COLORS.surface) > m.contrast(base.line, COLORS.surface));
        assert.equal(d.normalizeCustom({ colors: COLORS, style: { lineStrength: 100, lineColor: '#ff00aa' } }).vars.line, '#ff00aa');
        assert.equal(d.normalizeCustom({ colors: COLORS, style: { lineStrength: 0, lineColor: '#ff00aa' } }).vars.line, COLORS.surface);
    });

    test('the CSS is built only from validated values, one rule per changed panel', () => {
        const custom = d.normalizeCustom({
            colors: COLORS,
            panels: { rail: { fill: 'gradient', bg: '#202040', bg2: '#402020', angle: 200, lineWidth: 2, line: '#ff0000' }, titlebar: { fill: 'solid', bg: '#241238', lineWidth: 0 }, evil: { fill: 'solid', bg: 'x' } },
            style: { lineStrength: 80 }
        });
        const css = d.designCss(custom);
        assert.match(css, /:root\[data-theme='custom'\] \.rail \{[^}]*background: linear-gradient\(200deg, #202040, #402020\);[^}]*border-right-width: 2px;[^}]*border-right-color: #ff0000;/);
        assert.match(css, /\.titlebar::after \{ height: 0px; background: #[0-9a-f]{6}; \}/);
        assert.ok(!/evil|\.view-host|\.panel-host|\.right-host|\.player-host/.test(css), 'unchanged panels get no rule');
        // nothing but the rules above: braces balance and no stray text
        assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
        assert.doesNotMatch(css, /<|>|url\(|@import|expression/i);
    });

    test('text and accent stay readable on any background, a gradient included, unless "exact" is on', () => {
        const mids = ['#000000', '#ffffff', '#777777', '#3b1d6e', '#f5c518'];
        for (const a of mids) for (const b of mids) {
            // when not even white or black reads well on both ends (black to white, black to mid grey) nothing can; the readout says so
            const best = Math.max(Math.min(m.contrast('#ffffff', a), m.contrast('#ffffff', b)), Math.min(m.contrast('#000000', a), m.contrast('#000000', b)));
            if (best < 5.5) continue;
            const custom = d.normalizeCustom({ colors: COLORS, panels: { right: { fill: 'gradient', bg: a, bg2: b, ink: '#808080', accent: '#818181' } } });
            const s = d.panelScope(custom, 'right');
            assert.ok(s.ratios.ink >= 4.5, `text on ${a} to ${b}: ${s.ratios.ink}`);
            assert.ok(s.ratios.accent >= 4.5, `accent on ${a} to ${b}: ${s.ratios.accent}`);
        }
        const exact = d.normalizeCustom({ colors: COLORS, exact: true, panels: { right: { fill: 'solid', bg: '#808080', ink: '#858585' } } });
        assert.equal(d.panelScope(exact, 'right').ink, '#858585');
        assert.ok(d.panelScope(exact, 'right').ratios.ink < 4.5);
    });

    test('a panel with colors of its own writes the component tokens again, so its buttons and inputs follow it', () => {
        const tokens = read('tokens.css').replace(/\r\n/g, '\n');
        const component = tokens.slice(tokens.indexOf('/* ---------- 3. component layer'));
        const derived = [...component.matchAll(/^\s+(--[a-z-]+):\s*(var\(--(?:surface|text|border|accent)[a-z-]*\));/gm)].map((x) => [x[1], x[2]]);
        assert.ok(derived.length >= 15, `found ${derived.length}`);
        for (const [name, value] of derived) assert.equal(d.COMPONENT_TOKENS[name], value, `${name} is rewritten with ${value}`);
        assert.equal(d.COMPONENT_TOKENS['--focus-ring'], 'var(--accent)');
    });

    test('the panels name real elements of the shell', () => {
        const html = read('index.html');
        for (const p of d.PANELS) {
            const cls = p.selector.slice(1);
            assert.match(html, new RegExp(`class="[^"]*\\b${cls}\\b`), `${p.id}: ${p.selector}`);
        }
    });

    test('two equal designs compare equal, and saved themes keep the design', async () => {
        const a = d.normalizeCustom({ colors: COLORS, panels: { rail: { fill: 'solid', bg: '#202040' } }, style: { lineStrength: 70 } });
        const b = d.normalizeCustom({ colors: COLORS, panels: { rail: { bg: '#202040', fill: 'solid' } }, style: { lineStrength: 70 } });
        assert.ok(d.sameDesign(a, b));
        assert.ok(!d.sameDesign(a, d.normalizeCustom({ colors: COLORS })));
        assert.ok(d.isPlainDesign({}) && !d.isPlainDesign(a));
    });
});

describe('the designer in the app', { concurrency: false }, () => {
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
        page.on('pageerror', (e) => !/reading 'enabled'/.test(e.message) && errors.push(String(e.message)));
        if (Object.keys(store).length) await page.addInitScript((entries) => Object.entries(entries).forEach(([k, v]) => localStorage.setItem(k, v)), store);
        await page.goto(url());
        await waitForAppSettled(page, 3000);
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.locator('.settings-menu [data-page="general"]').click();
        await page.waitForSelector('.theme-builder');
        return { page, errors };
    }
    const css = (page, selector, prop) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [selector, prop]);
    const designStyle = (page) => page.evaluate(() => (document.getElementById('xp-custom-design') || {}).textContent || '');
    const settle = (page) => page.waitForTimeout(450); // one change per frame, saved after a quiet moment

    test('the designer has Colors, Panels and Style; the window picture picks the panel to edit', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        assert.deepEqual(await page.locator('.theme-builder [role="tab"]').allTextContents(), ['Colors', 'Panels']);
        assert.equal(await page.locator('.designer__region').count(), 6);
        assert.equal(await page.locator('#designer-page-panels').isHidden(), true);
        await page.locator('.designer__region--player').click();
        assert.equal(await page.locator('#designer-page-panels').isVisible(), true);
        assert.equal(await page.locator('.designer__panel-name').textContent(), 'Player bar');
        assert.equal(await page.locator('.designer__region--player').getAttribute('aria-pressed'), 'true');
        assert.equal(await page.evaluate(() => document.getElementById('xp-custom-design')), null, 'looking changes nothing');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a gradient on the side rail and a thick line on the player restyle the real panels and are saved', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.locator('.designer__region--rail').click();
        await page.getByRole('radio', { name: 'Gradient' }).click();
        await page.locator('.theme-builder__hex[aria-label="Gradient start as a hex code"]').fill('#3b1d6e');
        await page.locator('.theme-builder__hex[aria-label="Gradient end as a hex code"]').fill('#0e3b4a');
        await page.locator('.designer__chips .chip', { hasText: 'Player bar' }).click();
        await page.getByRole('radio', { name: 'Thick' }).click();
        await settle(page);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'custom');
        assert.match(await css(page, '.rail', 'backgroundImage'), /linear-gradient\(.*rgb\(59, 29, 110\).*rgb\(14, 59, 74\)/);
        assert.equal(await css(page, '.player-host', 'borderTopWidth'), '3px');
        assert.notEqual(await css(page, '.panel-host', 'backgroundImage'), await css(page, '.rail', 'backgroundImage'), 'other panels are untouched');
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('xplayer.ui-next.appearance')).custom);
        assert.equal(saved.panels.rail.fill, 'gradient');
        assert.equal(saved.panels.player.lineWidth, 3);
        // it survives a reload, and a built-in theme takes it away again
        await page.reload();
        await waitForAppSettled(page, 3000);
        assert.match(await css(page, '.rail', 'backgroundImage'), /linear-gradient/);
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.locator('.settings-menu [data-page="general"]').click();
        await page.locator('[aria-label="Theme"] [role="radio"]', { hasText: 'Pure Black' }).click();
        assert.equal(await page.evaluate(() => document.getElementById('xp-custom-design')), null);
        assert.equal(await css(page, '.rail', 'backgroundImage'), 'none');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a solid panel keeps its own buttons, text and inputs readable; Reset this panel gives it back to the theme', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.locator('.designer__region--left').click();
        await page.getByRole('radio', { name: 'Solid' }).click();
        await page.locator('.theme-builder__hex[aria-label="Panel background as a hex code"]').fill('#f2ead3');
        await settle(page);
        // a light panel on a dark theme: its text turns dark, and tokens inside it are its own
        const tokens = await page.evaluate(() => {
            const cs = getComputedStyle(document.querySelector('.panel-host'));
            return { bg: cs.backgroundColor, ink: cs.getPropertyValue('--text-primary').trim(), input: cs.getPropertyValue('--input-bg').trim(), surface: cs.getPropertyValue('--surface-panel').trim() };
        });
        assert.equal(tokens.bg, 'rgb(242, 234, 211)');
        assert.equal(tokens.surface, '#f2ead3');
        assert.notEqual(tokens.ink, '#ece9e3');
        assert.match(await page.locator('.designer__ratios').textContent(), /good/);
        await page.getByRole('button', { name: 'Reset this panel' }).click();
        await settle(page);
        assert.equal(await page.evaluate(() => document.getElementById('xp-custom-design')), null);
        assert.equal(await css(page, '.panel-host', 'backgroundColor'), 'rgb(19, 22, 27)');
        await page.close();
    });

    test('the lines of the whole app: strength and color are in Colors, and apply at once', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        assert.equal(await page.getByRole('tab', { name: 'Style' }).count(), 0);
        assert.equal(await page.locator('.designer__sample').count(), 0);
        const line = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-line').trim());
        const before = await line();
        await page.locator('.designer__range[aria-label="Line strength"]').fill('90');
        await settle(page);
        assert.notEqual(await line(), before);
        assert.equal(await page.locator('.designer__range-value').first().textContent(), '90%');
        await page.locator('#designer-page-colors').getByRole('radio', { name: 'Custom' }).click();
        await page.locator('.theme-builder__hex[aria-label="Line color as a hex code"]').waitFor({ state: 'visible' });
        await page.locator('.theme-builder__hex[aria-label="Line color as a hex code"]').fill('#ff00aa');
        await page.locator('.designer__range[aria-label="Line strength"]').fill('100');
        await settle(page);
        assert.equal(await line(), '#ff00aa');
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('xplayer.ui-next.appearance')).custom.style);
        assert.deepEqual(saved, { lineStrength: 100, lineColor: '#ff00aa' });
        await page.getByRole('button', { name: 'Reset lines' }).click();
        await settle(page);
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('xplayer.ui-next.appearance')).custom.style), {});
        assert.equal(await page.locator('.designer__range-value').first().textContent(), '40%');
        await page.close();
    });

    test('a saved theme keeps its panels and style, and brings them back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.locator('.designer__region--titlebar').click();
        await page.getByRole('radio', { name: 'Solid' }).click();
        await page.locator('.theme-builder__hex[aria-label="Panel background as a hex code"]').fill('#241238');
        await settle(page);
        await page.getByRole('button', { name: 'Save this theme' }).click();
        await page.getByLabel('Theme name').fill('Plum bar');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForSelector('.theme-builder__saved .theme-card');
        assert.equal(await page.locator('.theme-builder__saved .theme-card').getAttribute('aria-pressed'), 'true');
        const entry = await page.evaluate(() => JSON.parse(localStorage.getItem('xplayer.ui-next.saved-themes'))[0]);
        assert.equal(entry.panels.titlebar.bg, '#241238');
        // below the card: a pencil and a bin, always there (no hover needed)
        await page.getByRole('button', { name: 'Rename Plum bar' }).click();
        await page.getByLabel('Theme name').fill('Plum bar 2');
        await page.getByRole('button', { name: 'Rename', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.theme-builder__saved .theme-card').getAttribute('aria-label') === 'Plum bar 2');
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('xplayer.ui-next.saved-themes'))[0].panels.titlebar.bg), '#241238', 'only the name changed');
        assert.equal(await page.getByRole('button', { name: 'Delete Plum bar 2' }).isVisible(), true);
        await page.getByRole('button', { name: 'Reset all panels' }).click();
        await settle(page);
        assert.equal(await page.locator('.theme-builder__saved .theme-card').getAttribute('aria-pressed'), 'false', 'a different look is not the saved one');
        await page.locator('.theme-builder__saved .theme-card').click();
        await settle(page);
        assert.equal(await css(page, '.titlebar', 'backgroundColor'), 'rgb(36, 18, 56)');
        // a theme saved before the designer existed still applies, with no design
        await page.evaluate(() => localStorage.setItem('xplayer.ui-next.saved-themes', JSON.stringify([{ id: 'old', name: 'Old one', colors: { ground: '#101010', surface: '#181818', ink: '#eeeeee', accent: '#22cc88' }, exact: false }])));
        await page.reload();
        await waitForAppSettled(page, 3000);
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.locator('.settings-menu [data-page="general"]').click();
        await page.locator('.theme-builder__saved .theme-card').click();
        await settle(page);
        assert.equal(await page.evaluate(() => document.getElementById('xp-custom-design')), null);
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-ground').trim()), '#101010');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the right panel header wears four corners (fill the app) and two vertical arrows (lyrics only), and there is no Right Panel section or lyrics switch', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        assert.equal(await page.locator('.settings-section-title', { hasText: 'Right Panel' }).count(), 0);
        assert.equal(await page.locator('#settings-hide-right-panel-lyrics').count(), 0);
        await page.locator('.right-panel-btn').click();
        await page.waitForSelector('.rp-now__tools .icon-btn');
        const { ICONS } = await import(pathToFileURL(path.join(NEXT_SRC, 'icons', 'icons.js')).href);
        const tools = () => page.evaluate(() => [...document.querySelectorAll('.rp-now__tools .icon-btn')].map((b) => b.querySelector('svg').innerHTML.replace(/><\/[a-z]+>/g, '/>')));
        assert.deepEqual(await tools(), [ICONS.maximize, ICONS['unfold-vertical']]);
        await page.locator('.rp-now__tools .icon-btn').nth(1).click();
        assert.equal((await tools())[1], ICONS['fold-vertical']);
        await page.locator('.rp-now__tools .icon-btn').nth(1).click();
        await page.locator('.rp-now__tools .icon-btn').nth(0).click();
        assert.equal((await tools())[0], ICONS.minimize);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

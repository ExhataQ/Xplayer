// Task A-10: themes, accent colors, density and resizing, with the real, unchanged engine.
//
// Run:   node --test tools/tests/ui-next-appearance.test.js
// Needs: npm i -D playwright

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const read = (...parts) => fs.readFileSync(path.join(NEXT_SRC, ...parts), 'utf8');

describe('A-10 static rules', () => {
    const tokens = read('tokens.css').replace(/\r\n/g, '\n');
    const block = (selector) => {
        const start = tokens.indexOf(selector + ' {');
        assert.ok(start >= 0, `block ${selector}`);
        return Object.fromEntries([...tokens.slice(start, tokens.indexOf('}', start)).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
    };

    test('the boot script and appearance.js list the same values', () => {
        const boot = read('shell', 'appearance-boot.js');
        const source = read('shell', 'appearance.js');
        const ids = (name) => [...source.slice(source.indexOf(`export const ${name}`)).split('];')[0].matchAll(/id: '([a-z-]+)'/g)].map((m) => m[1]);
        const quoted = (text) => [...text.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
        assert.deepEqual(quoted(boot.match(/\[('warm-graphite'[^\]]+)\]/)[1]), ids('THEMES'));
        assert.deepEqual(quoted(boot.match(/\[('green'[^\]]+)\]/)[1]), ids('ACCENTS').filter((a) => a !== 'theme'));
    });

    test('preview tokens equal the real theme and accent values', () => {
        const preview = block(':root');
        for (const theme of ['warm-graphite', 'deep-forest', 'espresso-copper']) {
            const t = theme === 'warm-graphite' ? block(":root,\n:root[data-theme='warm-graphite']") : block(`:root[data-theme='${theme}']`);
            assert.equal(t['--c-accent-own'], t['--c-accent'], `${theme}: own accent`);
            assert.equal(preview[`--preview-${theme}-ground`], t['--c-ground'], `${theme} ground`);
            assert.equal(preview[`--preview-${theme}-surface`], t['--c-surface'], `${theme} surface`);
            assert.equal(preview[`--preview-${theme}-accent`], t['--c-accent'], `${theme} accent`);
        }
        for (const accent of ['green', 'pink', 'purple', 'yellow', 'white']) {
            assert.equal(preview[`--preview-accent-${accent}`], block(`:root[data-accent='${accent}']`)['--c-accent'], accent);
        }
    });

    test('the appearance styles use tokens only', () => {
        const css = read('shell', 'appearance.css');
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, 'no raw color');
        assert.doesNotMatch(css, /--c-[a-z]/, 'no primitive color names');
        for (const name of new Set(css.match(/var\(--[a-z0-9-]+/g) || [])) assert.ok(tokens.includes(`${name.slice(4)}:`) || css.includes(`${name.slice(4)}:`), `${name.slice(4)} is defined`);
    });
});

describe('A-10 appearance and resizing with the real engine', { concurrency: false }, () => {
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

    // `store` is written before any page script runs, like a choice saved in an earlier session.
    async function open({ viewport = { width: 1400, height: 860 }, store = {} } = {}) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        if (Object.keys(store).length) await page.addInitScript((entries) => Object.entries(entries).forEach(([k, v]) => localStorage.setItem(k, v)), store);
        await page.goto(url());
        await waitForAppSettled(page, 3000);
        return { page, errors };
    }

    const attrs = (page) => page.evaluate(() => ({ theme: document.documentElement.dataset.theme, accent: document.documentElement.dataset.accent ?? null, density: document.documentElement.dataset.density }));
    const token = (page, name) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
    const goto = async (page, view) => {
        await page.locator(`.rail-btn[data-view="${view}"]`).click();
        await page.waitForTimeout(150);
    };
    const section = (page) => page.locator('.view-host .appearance');

    test('the default look is Warm Graphite, the theme accent, comfortable rows', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        assert.deepEqual(await attrs(page), { theme: 'warm-graphite', accent: null, density: 'comfortable' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a saved choice is on <html> before any module runs (no flash of the default look)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const page = await browser.newPage();
        await page.addInitScript(() => localStorage.setItem('xplayer.ui-next.appearance', JSON.stringify({ theme: 'deep-forest', accent: 'pink', density: 'compact' })));
        await page.addInitScript(() => {
            document.addEventListener('DOMContentLoaded', () => (window.__early = { ...document.documentElement.dataset }), { once: true });
        });
        await page.goto(url());
        await waitForAppSettled(page, 3000);
        assert.deepEqual(await page.evaluate(() => window.__early), { theme: 'deep-forest', accent: 'pink', density: 'compact' });
        await page.close();
    });

    test('bad saved values fall back to the defaults', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ store: { 'xplayer.ui-next.appearance': JSON.stringify({ theme: 'neon', accent: 'x', density: 7 }) } });
        assert.deepEqual(await attrs(page), { theme: 'warm-graphite', accent: null, density: 'comfortable' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Settings has an Appearance section and the engine\'s unsaved Theme Color block is hidden', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await goto(page, 'settings');
        assert.equal(await section(page).count(), 1);
        assert.equal(await section(page).isVisible(), true);
        assert.equal(await page.locator('.view-host #settings-theme-selector').isVisible(), false);
        assert.deepEqual(await section(page).locator('[role="radiogroup"]').evaluateAll((n) => n.map((g) => g.getAttribute('aria-label'))), ['Theme', 'Accent color', 'Density']);
        // each choice is one radio, exactly one on
        for (const label of ['Theme', 'Accent color', 'Density']) assert.equal(await section(page).locator(`[aria-label="${label}"] [aria-checked="true"]`).count(), 1);
        await page.close();
    });

    test('choosing a theme changes the colors, is saved, and survives a reload', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await goto(page, 'settings');
        await section(page).getByRole('radio', { name: /Deep Forest/ }).click();
        assert.equal((await attrs(page)).theme, 'deep-forest');
        assert.equal(await token(page, '--c-ground'), '#0b100e');
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(11, 16, 14)');
        assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('xplayer.ui-next.appearance'))).theme, 'deep-forest');
        await page.reload();
        await waitForAppSettled(page, 3000);
        assert.equal((await attrs(page)).theme, 'deep-forest');
        await goto(page, 'settings');
        assert.equal(await section(page).locator('[aria-label="Theme"] [aria-checked="true"]').innerText(), 'Deep Forest');
        await page.close();
    });

    test('accent colors recolor the accent and "Theme color" returns to the theme\'s own', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ store: { 'xplayer.ui-next.appearance': JSON.stringify({ theme: 'espresso-copper' }) } });
        await goto(page, 'settings');
        const accent = (name) => section(page).locator(`[aria-label="Accent color"] [aria-label="${name}"]`);
        await accent('Pink').click();
        assert.equal((await attrs(page)).accent, 'pink');
        assert.equal(await token(page, '--c-accent'), '#ff6b9d');
        assert.equal(await token(page, '--accent-own'), '#cf8352', 'the theme swatch still shows the theme accent');
        await accent('Theme color').click();
        assert.equal((await attrs(page)).accent, null);
        assert.equal(await token(page, '--c-accent'), '#cf8352');
        for (const name of ['Green', 'Pink', 'Purple', 'Yellow', 'White', 'Theme color']) assert.equal(await accent(name).count(), 1, name);
        await page.close();
    });

    test('switching away from Settings and back puts the section back once', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        for (let i = 0; i < 3; i++) {
            await goto(page, 'settings');
            assert.equal(await section(page).count(), 1, `visit ${i + 1}`);
            await goto(page, 'library');
        }
        await page.close();
    });

    // The library panel's rows (D61): the engine's virtual scroll must use the same height as the rows it draws.
    const panelRows = (page) =>
        page.evaluate(() => {
            const rows = [...document.querySelectorAll('.library-panel .left-panel-main-item')];
            const tops = rows.map((row) => Math.round(row.getBoundingClientRect().top));
            return { engine: LEFT_ITEM_HEIGHT, rows: rows.length, height: Math.round(rows[0].getBoundingClientRect().height), pitch: tops.length > 1 ? tops[1] - tops[0] : 0, cover: Math.round(document.querySelector('.library-panel .main-item-cover-wrapper').getBoundingClientRect().height) };
        });

    test('density D61: library panel rows are 61 px comfortable and 44 px compact, live, and the engine uses the same height', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        assert.deepEqual(await panelRows(page), { ...(await panelRows(page)), engine: 61, height: 61, pitch: 61, cover: 44 });
        await goto(page, 'settings');
        await section(page).getByRole('radio', { name: 'Compact' }).click();
        await page.waitForFunction(() => LEFT_ITEM_HEIGHT === 44, null, { timeout: 3000 });
        await goto(page, 'library');
        const compact = await panelRows(page);
        assert.deepEqual([compact.engine, compact.height, compact.pitch, compact.cover], [44, 44, 44, 32]);
        assert.ok(compact.rows >= 2, 'the panel still lists its items');
        await goto(page, 'settings');
        await section(page).getByRole('radio', { name: 'Comfortable' }).click();
        await page.waitForFunction(() => LEFT_ITEM_HEIGHT === 61, null, { timeout: 3000 });
        await goto(page, 'library');
        const back = await panelRows(page);
        assert.deepEqual([back.engine, back.height, back.pitch, back.cover], [61, 61, 61, 44]);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('density D61: a saved compact density gives compact panel rows from the first read', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ store: { 'xplayer.ui-next.appearance': JSON.stringify({ theme: 'warm-graphite', accent: 'theme', density: 'compact' }) } });
        const rows = await panelRows(page);
        assert.deepEqual([rows.engine, rows.height, rows.pitch], [44, 44, 44]);
        await page.close();
    });

    test('density: one choice drives the Appearance control, the song list and its column menu', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        assert.equal(await page.locator('.view-host').getAttribute('data-density'), 'comfortable');
        assert.equal(await token(page, '--row-height'), '56px');
        await goto(page, 'settings');
        await section(page).getByRole('radio', { name: 'Compact' }).click();
        assert.equal((await attrs(page)).density, 'compact');
        await goto(page, 'library');
        assert.equal(await page.locator('.view-host').getAttribute('data-density'), 'compact');
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.view-host')).getPropertyValue('--song-item-height').trim()), '36px');
        // the song list's own "Row height" menu writes the same choice, and Settings follows
        await page.getByRole('button', { name: /columns/i }).first().click();
        await page.getByRole('menuitemradio', { name: 'Comfortable' }).click();
        assert.equal((await attrs(page)).density, 'comfortable');
        assert.equal(await page.locator('.view-host').getAttribute('data-density'), 'comfortable');
        await goto(page, 'settings');
        assert.equal(await section(page).locator('[aria-label="Density"] [aria-checked="true"]').innerText(), 'Comfortable');
        await page.close();
    });

    test('density saved by the song list before A-10 is adopted once', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ store: { 'xplayer.ui-next.songlist': JSON.stringify({ density: 'compact' }) } });
        assert.equal((await attrs(page)).density, 'compact');
        await page.close();
    });

    test('panel resize: drag, keyboard, double click, limits, saved across a reload', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const handle = page.locator('.panel-resizer');
        const width = () => page.locator('.panel-host').evaluate((n) => Math.round(n.getBoundingClientRect().width));
        assert.equal(await width(), 300);
        assert.equal(await handle.getAttribute('role'), 'separator');
        const box = await handle.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + 200);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 60, box.y + 200, { steps: 4 });
        await page.mouse.up();
        assert.equal(await width(), 360);
        assert.equal(await handle.getAttribute('aria-valuenow'), '360');
        await handle.focus();
        await page.keyboard.press('ArrowLeft');
        assert.equal(await width(), 344);
        await page.keyboard.press('Home');
        assert.equal(await width(), 240);
        await page.keyboard.press('End');
        assert.equal(await width(), 480);
        await page.keyboard.press('Enter');
        assert.equal(await width(), 300);
        await handle.dblclick();
        assert.equal(await width(), 300);
        await page.keyboard.press('End');
        await page.reload();
        await waitForAppSettled(page, 3000);
        assert.equal(await width(), 480, 'the width is saved');
        await page.close();
    });

    test('panel resize: a small window limits the width and the view keeps its room; widening brings the choice back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ store: { 'xplayer.ui-next.panel-width': '480' } });
        const sizes = () => page.evaluate(() => ({ panel: Math.round(document.querySelector('.panel-host').getBoundingClientRect().width), view: Math.round(document.querySelector('.view-host').getBoundingClientRect().width) }));
        assert.equal((await sizes()).panel, 480);
        await page.setViewportSize({ width: 800, height: 600 });
        await page.waitForFunction((n) => Math.round(document.querySelector('.panel-host').getBoundingClientRect().width) === n, 72, { timeout: 3000 });
        assert.equal((await sizes()).panel, 72, 'a narrow window collapses the panel by itself');
        await page.getByRole('button', { name: 'Collapse panel' }).click(); // opens it again for this window size
        const small = await sizes();
        assert.ok(small.view >= 420, `view keeps room: ${JSON.stringify(small)}`);
        assert.ok(small.panel >= 240 && small.panel <= 324);
        await page.setViewportSize({ width: 1400, height: 860 });
        await page.waitForFunction((n) => Math.round(document.querySelector('.panel-host').getBoundingClientRect().width) === n, 480, { timeout: 3000 });
        assert.equal((await sizes()).panel, 480);
        await page.close();
    });

    test('Settings can switch back to the previous interface (saved by the app, not the page)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate(() => {
            window.__ui = [];
            window.electronAPI = { setUiChoice: (choice) => (window.__ui.push(choice), Promise.resolve({ ok: true, ui: choice })) };
        });
        await goto(page, 'settings');
        const button = page.locator('.view-host .appearance__switch');
        assert.equal(await button.isEnabled(), true);
        await button.click();
        assert.deepEqual(await page.evaluate(() => window.__ui), ['current']);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the switch is disabled when the app is not there to do it (a plain browser)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => { window.electronAPI = {}; });
        await goto(page, 'settings');
        assert.equal(await page.locator('.view-host .appearance__switch').isDisabled(), true);
        await page.close();
    });

    test('the handle is hidden while the panel is collapsed', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        assert.equal(await page.locator('.panel-resizer').isVisible(), true);
        await page.getByRole('button', { name: 'Collapse panel' }).click();
        assert.equal(await page.locator('.panel-resizer').isVisible(), false);
        assert.equal(await page.locator('.panel-host').evaluate((n) => Math.round(n.getBoundingClientRect().width)), 72);
        await page.close();
    });

    for (const [width, height] of [[800, 600], [1000, 700], [1400, 860]]) {
        test(`every view fits a ${width} x ${height} window: nothing sideways, title bar and player inside`, TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page } = await open({ viewport: { width, height }, store: { 'xplayer.ui-next.panel-width': '480' } });
            for (const view of ['library', 'search', 'recent', 'lyrics', 'metadata', 'settings']) {
                await goto(page, view);
                const m = await page.evaluate(() => {
                    const box = (s) => {
                        const r = document.querySelector(s).getBoundingClientRect();
                        return { left: r.left, right: r.right, bottom: r.bottom };
                    };
                    const view = document.querySelector('.view-host');
                    return { scrollX: document.documentElement.scrollWidth - innerWidth, titlebar: box('.titlebar'), player: box('.player-host'), view: box('.view-host'), viewOverflow: view.scrollWidth - view.clientWidth, w: innerWidth, h: innerHeight };
                });
                assert.ok(m.scrollX <= 0, `${view}: page scrolls sideways by ${m.scrollX}`);
                assert.ok(m.titlebar.right <= m.w + 0.5 && m.player.right <= m.w + 0.5 && m.player.bottom <= m.h + 0.5, `${view}: title bar or player outside the window`);
                assert.ok(m.view.right <= m.w + 0.5, `${view}: view outside the window`);
                assert.ok(m.viewOverflow <= 1, `${view}: view content overflows by ${m.viewOverflow}`);
            }
            await page.close();
        });
    }
});

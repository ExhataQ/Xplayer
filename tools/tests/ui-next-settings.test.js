'use strict';

// D-05: the engine's Settings page shown in the new shell (adapter/engine-view.js) and skinned by
// src/ui-next/views/tools/settings.css. Real browser, real engine, nothing stubbed except electronAPI.
//
// Run: node --test tools/tests/ui-next-settings.test.js

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = fs.readFileSync(path.join(NEXT_SRC, 'tokens.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(NEXT_SRC, 'index.html'), 'utf8');
const TEST_OPTIONS = { timeout: 40000 };

describe('settings.css and engine-view.css use tokens only', () => {
    const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    for (const file of [path.join('views', 'tools', 'settings.css'), path.join('adapter', 'engine-view.css')]) {
        const css = strip(fs.readFileSync(path.join(NEXT_SRC, file), 'utf8'));
        test(`${file}: every var() is a token, no raw colors, no --c-*`, () => {
            const missing = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => !defined.has(n));
            assert.deepEqual([...new Set(missing)], []);
            assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b(?!['"\]])/);
            assert.doesNotMatch(css.replace(/\[style\*='[^']*'\]/g, ''), /#[0-9a-fA-F]{3,8}\b/);
            assert.doesNotMatch(css, /\brgba?\(|\bhsla?\(/);
            assert.doesNotMatch(css, /--c-[a-z]/);
        });
    }

    test('index.html links the three stylesheets after the shell', () => {
        const order = ['shell/shell.css', 'adapter/engine-view.css', 'views/tools/dialogs.css', 'views/tools/settings.css'].map((f) => indexHtml.indexOf(`href="${f}"`));
        assert.ok(order.every((i) => i > 0), 'all linked');
        assert.deepEqual(order, [...order].sort((a, b) => a - b));
    });

    test('the bridge never clones or rebuilds the engine content (it moves the node)', () => {
        const js = fs.readFileSync(path.join(NEXT_SRC, 'adapter', 'engine-view.js'), 'utf8');
        assert.doesNotMatch(js, /cloneNode|innerHTML|outerHTML/);
    });

    test('every settings class the engine writes has a rule or is a known layout-only class', () => {
        const engine = fs.readFileSync(path.join(ROOT, 'src', 'js', 'ui', '08e-panel-settings.js'), 'utf8');
        const css = fs.readFileSync(path.join(NEXT_SRC, 'views', 'tools', 'settings.css'), 'utf8');
        const used = new Set([...engine.matchAll(/class=\\?"((?:settings|library-location)[a-z-]*(?: [a-z-]+)*)\\?"/g)].flatMap((m) => m[1].split(' ')).filter((c) => /^(settings|library-location)/.test(c)));
        const layoutOnly = new Set(['settings-panel-actions']);
        const css2 = css; // also the extended-field classes of the Advanced page
        for (const c of ['extended-fields-list', 'extended-fields-group-label', 'extended-field-checkbox-row']) assert.ok(css2.includes('.' + c), c);
        const missing = [...used].filter((c) => !css.includes('.' + c) && !layoutOnly.has(c));
        assert.deepEqual(missing, []);
    });
});

describe('Settings in the new shell', { concurrency: false }, () => {
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

    async function open(size = { width: 1100, height: 800 }) {
        const page = await browser.newPage({ viewport: size });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        await page.evaluate(() => (window.__songList = document.getElementById('song-list')));
        return { page, errors };
    }
    // Settings opens on the General tab of a menu bar (shell/settings-layout.js); `group` opens that tab.
    const toSettings = async (page, group) => {
        await page.click('.rail-btn[data-view="settings"]');
        await page.waitForSelector('.view-host .settings-panel-content');
        if (group) await page.click(`.settings-menu [data-page="${group}"]`);
    };

    test('opens from the rail inside the view host, with the engine node identity intact and no page error', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toSettings(page);
        const r = await page.evaluate(() => {
            const host = document.querySelector('.view-host');
            const content = document.querySelector('.settings-panel-content').getBoundingClientRect();
            const h = host.getBoundingClientRect();
            return {
                inHost: host.contains(document.getElementById('song-list')),
                sameNode: document.getElementById('song-list') === window.__songList,
                engineView: host.dataset.engine,
                currentView: window.currentView,
                insideHost: content.left >= h.left && content.right <= h.right,
                title: document.querySelector('.settings-panel-title').textContent
            };
        });
        assert.deepEqual(r, { inHost: true, sameNode: true, engineView: 'settings', currentView: 'settings', insideHost: true, title: 'Settings' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the page scrolls inside the host (constrained height), the window itself does not', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toSettings(page, 'playback');
        const r = await page.evaluate(() => {
            const c = document.querySelector('.view-host .content');
            c.scrollTop = 500;
            return { scrolls: c.scrollHeight > c.clientHeight + 200, moved: c.scrollTop > 0, bodyScrolls: document.documentElement.scrollHeight > innerHeight + 1 };
        });
        assert.deepEqual(r, { scrolls: true, moved: true, bodyScrolls: false });
        await page.close();
    });

    test('leaving Settings puts the engine content back; coming back works; the engine still finds its elements', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toSettings(page);
        await page.click('.rail-btn[data-view="home"]');
        const left = await page.evaluate(() => ({
            backInHiddenHost: !!document.querySelector('#legacy-host .content-wrapper #song-list'),
            hostEngine: document.querySelector('.view-host').dataset.engine || null,
            sameNode: document.getElementById('song-list') === window.__songList
        }));
        assert.deepEqual(left, { backInHiddenHost: true, hostEngine: null, sameNode: true });
        await toSettings(page);
        assert.equal(await page.locator('.settings-panel-content').count(), 1);
        assert.equal(await page.evaluate(() => document.getElementById('song-list') === window.__songList), true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a checkbox is a real control: clicking Minimize to taskbar changes the engine setting', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toSettings(page, 'general');
        const read = () => page.evaluate(() => getWindowSettings().minimizeOnClose);
        const before = await read();
        await page.locator('.settings-toggle-row', { hasText: 'Minimize to taskbar' }).click();
        assert.equal(await read(), !before);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a select changes the engine setting (Smart Shuffle: genre flow)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toSettings(page, 'playback');
        const row = page.locator('.settings-threshold-row', { hasText: 'Genre flow' }).locator('select');
        await row.selectOption('strong');
        assert.equal(await page.evaluate(() => getSmartShuffleSettings().genreFlow), 'strong');
        await page.close();
    });

    test('The old engine swatch (hidden since A-10, which has its own Appearance section) still changes the accent through the body-class bridge', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toSettings(page);
        const accent = () => page.evaluate(() => ({ attr: document.documentElement.dataset.accent || null, color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }));
        const start = await accent();
        assert.equal(start.attr, null, 'a fresh page keeps the amber default');
        await page.locator('.settings-theme-btn[data-theme="pink"]').dispatchEvent('click'); // hidden by A-10: the bridge is exercised directly
        await page.waitForFunction(() => document.documentElement.dataset.accent === 'pink');
        const pink = await accent();
        assert.notEqual(pink.color, start.color);
        await page.locator('.settings-theme-btn[data-theme="green"]').dispatchEvent('click');
        await page.waitForFunction(() => document.documentElement.dataset.accent === 'green');
        assert.notEqual((await accent()).color, pink.color);
        await page.close();
    });

    test('an unrelated body class change does not touch the accent (in-lyrics-view toggles all the time)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => document.body.classList.toggle('in-lyrics-view'));
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.accent || null), null);
        await page.close();
    });

    test('Add Folder, Remove Folder, Save, Export Data and Advanced Settings are on screen and styled as buttons; the legacy folder button is not', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const styled = (labels) =>
            page.evaluate((list) => {
                const b = (text) => [...document.querySelectorAll('.view-host button')].find((x) => x.textContent.includes(text));
                const out = {};
                for (const text of list) {
                    const el = b(text);
                    const cs = el && getComputedStyle(el);
                    out[text] = !!el && el.getClientRects().length > 0 && cs.borderTopWidth === '1px' && el.getBoundingClientRect().height >= 28;
                }
                return out;
            }, labels);
        await toSettings(page, 'library');
        const lib = await styled(['Add Folder', 'Remove Folder', 'Save and Apply Changes']);
        assert.deepEqual(Object.values(lib), [true, true, true], JSON.stringify(lib));
        assert.equal(await page.locator('.view-host button', { hasText: 'Change Music Folder' }).isVisible(), false);
        await page.click('.settings-menu [data-page="data"]');
        const data = await styled(['Export Data', 'Advanced Settings']);
        assert.deepEqual(Object.values(data), [true, true], JSON.stringify(data));
        await page.close();
    });

    test('Advanced Settings: opens, the back arrow is drawn (no leftover icon text), the slider moves the engine threshold, back returns', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toSettings(page, 'data');
        await page.locator('.settings-action-btn', { hasText: 'Advanced Settings' }).click();
        await page.waitForSelector('.settings-advanced-header');
        const back = await page.evaluate(() => {
            const glyph = document.querySelector('.settings-advanced-back-btn .material-symbols-outlined');
            const r = glyph.getBoundingClientRect();
            return { w: Math.round(r.width), h: Math.round(r.height), fontSize: getComputedStyle(glyph).fontSize, masked: getComputedStyle(glyph).maskImage !== 'none' || getComputedStyle(glyph).webkitMaskImage !== 'none' };
        });
        assert.deepEqual(back, { w: 18, h: 18, fontSize: '0px', masked: true });
        await page.locator('.settings-threshold-slider').evaluate((el) => {
            el.value = '300';
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        assert.equal(await page.locator('#threshold-value-display').innerText(), '300');
        assert.equal(await page.evaluate(() => VIRTUAL_SCROLL_THRESHOLD), 300);
        const box = await page.locator('.extended-field-checkbox-row').first();
        assert.ok(await box.isVisible());
        await page.click('.settings-advanced-back-btn');
        await page.waitForSelector('.settings-panel-title:not([style])');
        await page.waitForSelector('.settings-panel-content[data-settings-page="data"]'); // back from Advanced returns to the page it was opened from
        assert.equal(await page.locator('.settings-menu .tab[aria-selected="true"]').innerText(), 'Data'); // the menu bar shows the tab it returned to
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('800 x 600: on every tab, menu bar included, nothing is wider than the host and there is no horizontal scroll', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ width: 800, height: 600 });
        await toSettings(page);
        const measure = () =>
            page.evaluate(() => {
                const c = document.querySelector('.view-host .content');
                const w = c.clientWidth;
                const wide = [...document.querySelectorAll('.settings-panel-content *')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().right > c.getBoundingClientRect().left + w + 1).length;
                return { hScroll: c.scrollWidth > c.clientWidth + 1, wide };
            });
        for (const id of ['general', 'playback', 'library', 'data']) {
            await page.click(`.settings-menu [data-page="${id}"]`);
            assert.deepEqual(await measure(), { hScroll: false, wide: 0 }, id);
        }
        await page.close();
    });

    test('text contrast 4.5:1 on the page and card surfaces: title, menu tabs, section titles, labels, hints, inputs; three themes on every tab', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toSettings(page);
        const pages = ['general', 'playback', 'library', 'data'];
        for (const theme of ['warm-graphite', 'deep-forest', 'espresso-copper']) {
            const bad = [];
            for (const id of pages) {
                await page.click(`.settings-menu [data-page="${id}"]`);
                bad.push(...(await page.evaluate(([name, where]) => {
                document.documentElement.setAttribute('data-theme', name);
                const parse = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
                const lum = (rgb) => {
                    const [r, g, b] = rgb.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
                    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
                };
                const ratio = (a, b) => {
                    const [x, y] = [lum(parse(a)), lum(parse(b))].sort((p, q) => q - p);
                    return (x + 0.05) / (y + 0.05);
                };
                const bg = (el) => {
                    for (let n = el; n; n = n.parentElement) {
                        const c = getComputedStyle(n).backgroundColor;
                        if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
                    }
                    return 'rgb(0, 0, 0)';
                };
                const out = [];
                const sels = ['.settings-menu .tab[aria-selected="true"]', '.settings-menu .tab[aria-selected="false"]', '.settings-panel-sub', '.settings-panel-title', '.settings-section-title', '.settings-toggle-row span', '.settings-threshold-row > span', '.settings-threshold-hint', '.settings-threshold-row select', '.settings-action-btn', '.library-locations-rebuild-btn'];
                for (const sel of sels) {
                    const el = document.querySelector(sel);
                    if (!el) continue;
                    const r = ratio(getComputedStyle(el).color, bg(el));
                    if (r < 4.5) out.push(`${name} ${where} ${sel} ${r.toFixed(2)}`);
                }
                return out;
            }, [theme, id])));
            }
            assert.deepEqual(bad, []);
        }
        await page.close();
    });
});

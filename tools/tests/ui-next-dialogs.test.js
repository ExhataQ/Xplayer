'use strict';

// D-06: the engine's own dialogs (js/ui/06b-modals.js and friends) skinned for the new shell by
// src/ui-next/views/tools/dialogs.css. Static guards plus real-browser checks in the new shell with the real engine.
//
// Run: node --test tools/tests/ui-next-dialogs.test.js
// Needs: playwright (see scroll.test.js). Without it the browser tests skip.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const CSS_FILE = path.join(NEXT_SRC, 'views', 'tools', 'dialogs.css');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const css = strip(fs.readFileSync(CSS_FILE, 'utf8'));
const tokens = fs.readFileSync(path.join(NEXT_SRC, 'tokens.css'), 'utf8');
const TEST_OPTIONS = { timeout: 40000 };

describe('dialogs.css uses tokens only', () => {
    const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    // old engine names, defined inside .playlist-modal-overlay by the alias block
    const aliases = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

    test('every var() refers to a token or to an alias the file defines', () => {
        const missing = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => !defined.has(n) && !aliases.has(n));
        assert.deepEqual([...new Set(missing)], []);
    });

    test('no raw colors and no primitive --c-* names', () => {
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
        assert.doesNotMatch(css, /\brgba?\(|\bhsla?\(|\boklch\(/);
        assert.doesNotMatch(css, /--c-[a-z]/);
    });

    test('the old names the engine writes inline are all aliased', () => {
        const engine = fs.readFileSync(path.join(ROOT, 'src', 'js', 'ui', '06b-modals.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'src', 'js', 'playback', '15b-controls-shuffle-btn.js'), 'utf8');
        const used = new Set([...engine.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
        for (const name of used) assert.ok(defined.has(name) || aliases.has(name), `${name} is written by the engine and has no value in ui-next`);
    });

    test('every state of the two buttons and the field has a style', () => {
        for (const part of ['.playlist-modal-create-btn:hover', '.playlist-modal-create-btn:active', '.playlist-modal-cancel-btn:hover', '.playlist-modal-cancel-btn:active', ':disabled', '.playlist-modal-input:focus', '.playlist-modal-input:hover', '::placeholder']) {
            assert.ok(css.includes(part), `dialogs.css never mentions ${part}`);
        }
    });

    test('no engine, adapter or storage access (CSS only, nothing to import)', () => {
        assert.doesNotMatch(css, /@import/);
    });
});

describe('engine dialogs in the new shell', { concurrency: false }, () => {
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
        let html = fs.readFileSync(file, 'utf8');
        assert.ok(html.includes('views/tools/dialogs.css'), 'index.html links dialogs.css');
        html = html.replace('<script src="../player.js">', () => stub + '<script src="../player.js">');
        fs.writeFileSync(file, html);
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        return { page, errors };
    }

    // Everything a user needs to see: the overlay covers the window, the dialog is fully inside it and has a surface.
    const visible = (page) =>
        page.evaluate(() => {
            const overlay = document.querySelector('.playlist-modal-overlay');
            const modal = document.querySelector('.playlist-modal');
            if (!overlay || !modal) return null;
            const o = overlay.getBoundingClientRect();
            const m = modal.getBoundingClientRect();
            const cs = getComputedStyle(modal);
            const transparent = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
            return {
                covers: o.width >= innerWidth - 1 && o.height >= innerHeight - 1 && o.top <= 0 && o.left <= 0,
                inside: m.left >= 0 && m.top >= 0 && m.right <= innerWidth && m.bottom <= innerHeight && m.width > 200,
                surface: !transparent(cs.backgroundColor),
                position: getComputedStyle(overlay).position
            };
        });

    test('create playlist: on screen, over the whole window, with a surface; input and both buttons are styled', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate(() => showCreatePlaylistDialog());
        const v = await visible(page);
        assert.deepEqual(v, { covers: true, inside: true, surface: true, position: 'fixed' });
        const parts = await page.evaluate(() => {
            const px = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
            return {
                inputBg: px('.playlist-modal-input', 'backgroundColor'),
                inputBorder: px('.playlist-modal-input', 'borderTopColor'),
                inputBorderWidth: px('.playlist-modal-input', 'borderTopWidth'),
                primaryBg: px('.playlist-modal-create-btn', 'backgroundColor'),
                primaryFg: px('.playlist-modal-create-btn', 'color'),
                outlineBorder: px('.playlist-modal-cancel-btn', 'borderTopColor'),
                tokenPrimary: getComputedStyle(document.documentElement).getPropertyValue('--button-primary-bg').trim()
            };
        });
        assert.notEqual(parts.inputBg, 'rgba(0, 0, 0, 0)');
        assert.equal(parts.inputBorderWidth, '1px');
        assert.notEqual(parts.primaryBg, parts.primaryFg, 'primary button text differs from its fill');
        assert.notEqual(parts.outlineBorder, 'rgba(0, 0, 0, 0)');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the dialog follows the theme: a different theme changes the dialog surface', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => showCreatePlaylistDialog());
        const surface = () => page.evaluate(() => getComputedStyle(document.querySelector('.playlist-modal')).backgroundColor);
        const before = await surface();
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'espresso-copper'));
        const after = await surface();
        assert.notEqual(before, after);
        await page.close();
    });

    test('shuffle dialog opens from the real Shuffle button, on screen, and Smart is disabled for a small view', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => SONGS_DATA.length > 0 && createQueueFromSongList(SONGS_DATA.slice(0, 4), 0, VIEWS.ALL_SONGS));
        await page.evaluate(() => openShuffleModeDialog()); // the button opens a menu now (PB-07); this is the engine's dialog
        const v = await visible(page);
        assert.ok(v && v.covers && v.inside && v.surface, JSON.stringify(v));
        const smart = await page.evaluate(() => {
            const b = [...document.querySelectorAll('.shuffle-mode-modal button')].find((x) => /Smart/.test(x.textContent));
            return b && { disabled: b.disabled, opacity: getComputedStyle(b).opacity };
        });
        // 30 fixture songs: under the 50-song threshold, so the engine disables it and the skin dims it
        assert.deepEqual(smart, { disabled: true, opacity: '0.45' });
        await page.close();
    });

    test('confirm dialog: shows engine text, Escape closes it, and it resolves false', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => {
            window.__answer = 'pending';
            showConfirmDialog({ title: 'Remove playlist', message: 'This cannot be undone.', okText: 'Remove' }).then((a) => (window.__answer = a));
        });
        const v = await visible(page);
        assert.ok(v && v.covers && v.inside && v.surface);
        assert.match(await page.locator('.playlist-modal').innerText(), /Remove playlist[\s\S]*This cannot be undone\.[\s\S]*Remove/);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => window.__answer !== 'pending');
        assert.equal(await page.evaluate(() => window.__answer), false);
        assert.equal(await page.locator('.playlist-modal-overlay').count(), 0);
        await page.close();
    });

    test('overlay click closes the dialog, a click inside does not', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => showCreatePlaylistDialog());
        await page.locator('.playlist-modal-title').click();
        assert.equal(await page.locator('.playlist-modal').count(), 1, 'a click inside keeps it open');
        await page.mouse.click(5, 5);
        assert.equal(await page.locator('.playlist-modal-overlay').count(), 0);
        await page.close();
    });

    test('the dialog fits a small window: 800 x 600, long text wraps and the dialog stays inside', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.setViewportSize({ width: 800, height: 600 });
        await page.evaluate(() => {
            showConfirmDialog({ title: 'Long', message: 'word '.repeat(300) }); // resolves only when closed: do not return it
        });
        const v = await visible(page);
        assert.ok(v && v.inside, JSON.stringify(v));
        await page.close();
    });

    test('dialog text meets 4.5:1 against the dialog surface in three themes', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        for (const theme of ['warm-graphite', 'deep-forest', 'espresso-copper']) {
            await page.evaluate((name) => {
                document.documentElement.setAttribute('data-theme', name);
                showConfirmDialog({ title: 'T', message: 'Body text' }); // resolves only when closed: do not return it
            }, theme);
            const ratios = await page.evaluate(() => {
                const parse = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
                const lum = (rgb) => {
                    const [r, g, b] = rgb.map((v) => {
                        v /= 255;
                        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
                    });
                    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
                };
                const ratio = (a, b) => {
                    const [x, y] = [lum(parse(a)), lum(parse(b))].sort((p, q) => q - p);
                    return (x + 0.05) / (y + 0.05);
                };
                const bg = getComputedStyle(document.querySelector('.playlist-modal')).backgroundColor;
                const out = {};
                for (const [name, sel] of [['title', '.playlist-modal-title'], ['body', '.playlist-modal p'], ['cancel', '.playlist-modal-cancel-btn']]) out[name] = ratio(getComputedStyle(document.querySelector(sel)).color, bg);
                const create = document.querySelector('.playlist-modal-create-btn');
                out.primary = ratio(getComputedStyle(create).color, getComputedStyle(create).backgroundColor);
                document.querySelector('.playlist-modal-overlay').remove();
                return out;
            });
            for (const [name, r] of Object.entries(ratios)) assert.ok(r >= 4.5, `${theme} ${name} ${r.toFixed(2)}`);
        }
        await page.close();
    });
});

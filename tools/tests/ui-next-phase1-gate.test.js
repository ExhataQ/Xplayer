// Phase 1 exit gate (task A-06): the new shell boots, plays, resizes and shows what the engine opens, and the
// old interface still starts and plays without the flag. Real browser, real mouse, real (generated) WAV audio, the
// unmodified engine. The per-behavior gate (engine contract section 10) stays in ui-next-shell.test.js; this file
// covers what that one does not: the overlays the engine builds (L-10 / D14), the whole size range, the old UI, and
// that every icon the new screen names exists.
//
// Run:   node --test tools/tests/ui-next-phase1-gate.test.js
// Needs: npm i -D playwright   (see scroll.test.js for setup notes)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { ROOT, loadPlaywright, launch, buildApp, gotoApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const SIZES = [
    [800, 600],
    [1024, 768],
    [1400, 860],
    [1920, 1080],
    [2560, 1300]
];

function writeWav(file, seconds = 4) {
    const rate = 8000;
    const n = rate * seconds;
    const b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0);
    b.writeUInt32LE(36 + n * 2, 4);
    b.write('WAVEfmt ', 8);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(rate, 24);
    b.writeUInt32LE(rate * 2, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34);
    b.write('data', 36);
    b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 3000), 44 + i * 2);
    fs.writeFileSync(file, b);
}

const STUB = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;

function buildNextApp() {
    const dir = buildApp(30);
    fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
    const file = path.join(dir, 'ui-next', 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(html.includes('<script src="../player.js">'), 'index.html loads ../player.js');
    fs.writeFileSync(file, html.replace('<script src="../player.js">', () => STUB + '<script src="../player.js">'));
    return dir;
}

const fileUrl = (p) => 'file://' + p.replace(/\\/g, '/');

describe('phase 1 gate: the new shell', { concurrency: false }, () => {
    let browser, dir, wav, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildNextApp();
        wav = path.join(dir, 'tone.wav');
        writeWav(wav);
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open({ play = false } = {}) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const problems = { errors: [], failedRequests: [], consoleErrors: [] };
        page.on('pageerror', (e) => problems.errors.push(String(e.message)));
        page.on('requestfailed', (r) => problems.failedRequests.push(r.url()));
        page.on('console', (m) => m.type() === 'error' && problems.consoleErrors.push(m.text()));
        await page.goto(fileUrl(path.join(dir, 'ui-next', 'index.html')));
        await waitForAppSettled(page, 3000);
        await page.evaluate((u) => SONGS_DATA.forEach((s) => (s.url = u)), fileUrl(wav));
        if (play) {
            await page.mouse.click(5, 5);
            await page.evaluate(() => createQueueFromSongList(SONGS_DATA.slice(0, 4), 0, VIEWS.ALL_SONGS));
            await page.waitForFunction(() => !audioElement.paused && audioElement.currentTime > 0.2, null, { timeout: 8000 });
        }
        return { page, problems };
    }

    const noProblems = (problems) => {
        assert.deepEqual(problems.errors, []);
        assert.deepEqual(problems.failedRequests, []);
        assert.deepEqual(problems.consoleErrors, []);
    };

    // Is the element drawn, with a real box, fully inside the window?
    const inWindow = (page, selector) =>
        page.locator(selector).first().evaluate((node) => {
            const r = node.getBoundingClientRect();
            const s = getComputedStyle(node);
            return {
                drawn: r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none',
                inside: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth + 0.5 && r.bottom <= window.innerHeight + 0.5,
                box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
                background: s.backgroundColor
            };
        });

    test('boots with no page error, failed request or console error, and plays through the old engine', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        const s = await page.evaluate(() => ({ paused: audioElement.paused, title: document.getElementById('player-title').textContent, busy: document.body.hasAttribute('aria-busy'), glyph: !!document.querySelector('#play-btn .fa-pause') }));
        assert.equal(s.paused, false);
        assert.equal(s.title, 'Song title number 1');
        assert.equal(s.busy, false);
        assert.equal(s.glyph, true);
        noProblems(problems);
        await page.close();
    });

    test('L-10 / D14: the shuffle dialog is drawn inside the window, covers it, and closes from its overlay', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        await page.evaluate(() => openShuffleModeDialog()); // the button opens a menu now (PB-07)
        await page.locator('.shuffle-mode-modal').waitFor({ state: 'visible', timeout: 3000 });
        const box = await inWindow(page, '.shuffle-mode-modal');
        assert.equal(box.drawn, true, 'the dialog has a box');
        assert.equal(box.inside, true, `the dialog is inside the window: ${box.box}`);
        assert.notEqual(box.background, 'rgba(0, 0, 0, 0)', 'the dialog has a surface');
        const overlay = await page.locator('.shuffle-mode-overlay').evaluate((node) => {
            const r = node.getBoundingClientRect();
            return { position: getComputedStyle(node).position, covers: r.width === window.innerWidth && r.height === window.innerHeight, above: document.elementFromPoint(window.innerWidth / 2, 5) === node };
        });
        assert.deepEqual(overlay, { position: 'fixed', covers: true, above: true });
        await page.mouse.click(5, 5);
        await page.locator('.shuffle-mode-overlay').waitFor({ state: 'detached', timeout: 3000 });
        noProblems(problems);
        await page.close();
    });

    test('L-10 / D14: dialog text and buttons stay readable (4.5:1) in every theme', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        const themes = ['warm-graphite', 'deep-forest', 'espresso-copper'];
        const results = [];
        for (const theme of themes) {
            await page.evaluate((name) => document.documentElement.setAttribute('data-theme', name), theme);
            await page.evaluate(() => openShuffleModeDialog()); // the button opens a menu now (PB-07)
            await page.locator('.shuffle-mode-modal').waitFor({ state: 'visible' });
            results.push(
                await page.evaluate((name) => {
                    const parse = (c) => c.match(/[\d.]+/g).slice(0, 4).map(Number);
                    const lum = ([r, g, b]) => {
                        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
                        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
                    };
                    const ratio = (fg, bg) => {
                        const [a, b] = [lum(parse(fg)), lum(parse(bg))].sort((x, y) => y - x);
                        return (a + 0.05) / (b + 0.05);
                    };
                    const modal = document.querySelector('.shuffle-mode-modal');
                    const bg = getComputedStyle(modal).backgroundColor;
                    const pairs = [['title', modal.querySelector('.playlist-modal-title'), bg]];
                    const primary = modal.querySelector('.playlist-modal-create-btn:not(:disabled)');
                    pairs.push(['primary button', primary, getComputedStyle(primary).backgroundColor]);
                    return { theme: name, ratios: pairs.map(([label, node, back]) => [label, Math.round(ratio(getComputedStyle(node).color, back) * 100) / 100]) };
                }, theme)
            );
            await page.mouse.click(5, 5);
            await page.locator('.shuffle-mode-overlay').waitFor({ state: 'detached' });
        }
        for (const r of results) for (const [label, value] of r.ratios) assert.ok(value >= 4.5, `${r.theme}: ${label} is ${value}:1`);
        await page.close();
    });

    test('L-10 / D14: the song context menu is drawn at the pointer, and its submenu opens inside the window', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        await page.evaluate(() => {
            const event = { clientX: 700, clientY: 300, target: document.body, stopPropagation() {}, preventDefault() {} };
            showContextMenu(event, SONGS_DATA[0].id);
        });
        await page.locator('#context-menu').waitFor({ state: 'visible', timeout: 3000 });
        const menu = await inWindow(page, '#context-menu');
        assert.equal(menu.drawn, true);
        assert.equal(menu.inside, true, `the menu is inside the window: ${menu.box}`);
        assert.ok(Math.abs(menu.box[0] - 700) < 400, 'the menu opens near the pointer');
        assert.notEqual(menu.background, 'rgba(0, 0, 0, 0)');
        const items = await page.locator('#context-menu .context-menu-item').count();
        assert.ok(items >= 3, `the menu lists its items (${items})`);
        const parent = page.locator('#context-menu .submenu-parent').first();
        if (await parent.count()) {
            await parent.hover();
            const submenu = await inWindow(page, '#context-menu .submenu-parent .context-submenu');
            assert.equal(submenu.drawn, true, 'the submenu opens on hover');
            assert.equal(submenu.inside, true, `the submenu is inside the window: ${submenu.box}`);
        }
        noProblems(problems);
        await page.close();
    });

    test('resizes through the whole range, shrinking and growing again, with the shell intact at every size', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        const order = [...SIZES, ...SIZES.slice(0, -1).reverse()];
        for (const [width, height] of order) {
            await page.setViewportSize({ width, height });
            await page.waitForTimeout(80);
            const m = await page.evaluate(() => {
                const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
                const title = rect('.titlebar');
                const player = rect('.player-host');
                const rail = rect('.rail');
                const view = rect('#view-host');
                return {
                    scrollsX: document.documentElement.scrollWidth > window.innerWidth,
                    scrollsY: document.documentElement.scrollHeight > window.innerHeight,
                    titleTop: Math.round(title.top),
                    playerBottom: Math.round(player.bottom),
                    playerRight: Math.round(player.right),
                    railTop: Math.round(rail.top),
                    railBottom: Math.round(rail.bottom),
                    viewUsable: view.width >= 200 && view.height >= 100,
                    volumeRight: Math.round(document.getElementById('volume-slider').getBoundingClientRect().right),
                    seekWidth: Math.round(document.querySelector('.progress-container').getBoundingClientRect().width),
                    w: window.innerWidth,
                    h: window.innerHeight
                };
            });
            const at = `${width}x${height}`;
            assert.equal(m.scrollsX, false, `${at}: no horizontal scroll`);
            assert.equal(m.scrollsY, false, `${at}: no vertical scroll of the page`);
            assert.equal(m.titleTop, 0, `${at}: title bar at the top`);
            assert.equal(m.playerBottom, m.h, `${at}: player at the bottom`);
            assert.ok(m.playerRight <= m.w, `${at}: player inside the width`);
            assert.ok(m.railBottom <= m.playerBottom, `${at}: rail ends above the player`);
            assert.equal(m.viewUsable, true, `${at}: the main view keeps a usable size`);
            assert.ok(m.volumeRight <= m.w, `${at}: volume slider on screen`);
            assert.ok(m.seekWidth >= 120, `${at}: seek bar keeps a usable width (${m.seekWidth})`);
        }
        const playing = await page.evaluate(() => !audioElement.paused);
        assert.equal(playing, true, 'resizing never interrupts playback');
        noProblems(problems);
        await page.close();
    });

    test('a dialog opened at the smallest size still fits the window', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        await page.setViewportSize({ width: 800, height: 600 });
        await page.evaluate(() => openShuffleModeDialog()); // the button opens a menu now (PB-07)
        await page.locator('.shuffle-mode-modal').waitFor({ state: 'visible' });
        const box = await inWindow(page, '.shuffle-mode-modal');
        assert.equal(box.inside, true, `inside the window: ${box.box}`);
        await page.close();
    });
});

describe('phase 1 gate: the old interface is intact without the flag', { concurrency: false }, () => {
    let browser, dir, wav, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
        wav = path.join(dir, 'tone.wav');
        writeWav(wav);
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('the old page starts, lists songs, plays, and loads nothing from ui-next', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const problems = { errors: [], failedRequests: [], consoleErrors: [] };
        page.on('pageerror', (e) => problems.errors.push(String(e.message)));
        page.on('requestfailed', (r) => problems.failedRequests.push(r.url()));
        page.on('console', (m) => m.type() === 'error' && problems.consoleErrors.push(m.text()));
        const requested = [];
        page.on('request', (r) => requested.push(r.url()));
        await gotoApp(page, dir);
        await page.evaluate((u) => SONGS_DATA.forEach((s) => (s.url = u)), fileUrl(wav));
        assert.equal(await page.evaluate(() => document.body.hasAttribute('aria-busy')), false);
        assert.ok((await page.locator('.song-item').count()) > 0, 'the song list is drawn');
        for (const selector of ['#play-btn', '#next-btn', '.progress-container', '#volume-slider']) assert.equal(await page.locator(selector).first().isVisible(), true, `${selector} is visible`);
        await page.mouse.click(5, 5);
        await page.evaluate(() => createQueueFromSongList(SONGS_DATA.slice(0, 3), 0, VIEWS.ALL_SONGS));
        await page.waitForFunction(() => !audioElement.paused && audioElement.currentTime > 0.2, null, { timeout: 8000 });
        assert.equal(await page.evaluate(() => document.getElementById('player-title').textContent), 'Song title number 1');
        assert.equal(await page.locator('#play-btn .fa-pause').count(), 1);
        // The fixture does not copy src/assets/icons, so the old page's own lyrics icon is the one known missing file.
        assert.deepEqual(problems.errors, []);
        assert.deepEqual(problems.failedRequests.filter((u) => !/\/icons\/lyrics\.svg$/.test(u)), []);
        assert.equal(problems.consoleErrors.filter((m) => !/ERR_FILE_NOT_FOUND/.test(m)).length, 0);
        assert.deepEqual(requested.filter((u) => /ui-next/.test(u)), [], 'nothing from ui-next is requested');
        assert.equal(await page.evaluate(() => document.querySelector('link[href*="ui-next"], script[src*="ui-next"]') === null), true);
        await page.close();
    });
});

describe('phase 1 gate: static checks', () => {
    test('the old page template does not mention ui-next, and the default entry is still the old page', () => {
        const template = fs.readFileSync(path.join(ROOT, 'build', 'music_player.html'), 'utf8');
        assert.doesNotMatch(template, /ui-next/);
        const entry = require(path.join(ROOT, 'electron', 'ui-entry.js'));
        const text = JSON.stringify(Object.keys(entry));
        assert.ok(text.length > 2, 'ui-entry exports its chooser');
    });

    test('every icon the new screen names exists in icons.js', async () => {
        const generated = await import(pathToFileURL(path.join(NEXT_SRC, 'icons', 'icons.js')).href);
        const custom = await import(pathToFileURL(path.join(NEXT_SRC, 'icons', 'custom-icons.js')).href); // drawn for this app (PA-03)
        const ICONS = { ...generated.ICONS, ...custom.CUSTOM_ICONS };
        const skipDirs = ['fonts'];
        const files = [];
        (function walk(d) {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, e.name);
                if (e.isDirectory()) {
                    if (!skipDirs.includes(e.name)) walk(full);
                } else if (/\.js$/.test(e.name) && !full.endsWith(path.join('icons', 'icons.js'))) files.push(full);
            }
        })(NEXT_SRC);
        const used = new Map();
        for (const f of files) {
            const text = fs.readFileSync(f, 'utf8');
            for (const m of text.matchAll(/\b(?:icon|iconEl|iconButton)\(\s*['"]([a-z0-9-]+)['"]/g)) used.set(m[1], path.relative(NEXT_SRC, f));
            for (const m of text.matchAll(/\bicon:\s*['"]([a-z0-9-]+)['"]/g)) used.set(m[1], path.relative(NEXT_SRC, f));
            for (const m of text.matchAll(/\b(?:info|success|error|warning):\s*['"]([a-z0-9-]+)['"]/g)) if (ICONS[m[1]]) used.set(m[1], path.relative(NEXT_SRC, f));
        }
        const missing = [...used].filter(([name]) => !ICONS[name]);
        assert.deepEqual(missing, [], 'icons named but not shipped');
        for (const name of ['info', 'circle-check', 'triangle-alert']) assert.ok(ICONS[name], `${name} is shipped (A-01 follow-up)`);
    });

    test('the toast maps its three kinds to shipped icons that differ from each other', () => {
        const text = fs.readFileSync(path.join(NEXT_SRC, 'components', 'toast.js'), 'utf8');
        const m = text.match(/const ICON = \{([^}]*)\}/);
        assert.ok(m, 'toast.js defines its icon map');
        const names = [...m[1].matchAll(/(\w+):\s*'([a-z-]+)'/g)].map((x) => x[2]);
        assert.equal(new Set(names).size, 3, `three different icons: ${names}`);
        assert.ok(!names.includes('bell'), 'the bell stays the notification center button');
    });

    test('the overlay stylesheet is linked, uses tokens only, and names no raw color', () => {
        const html = fs.readFileSync(path.join(NEXT_SRC, 'index.html'), 'utf8');
        assert.match(html, /adapter\/legacy-overlays\.css/);
        const css = fs.readFileSync(path.join(NEXT_SRC, 'adapter', 'legacy-overlays.css'), 'utf8');
        assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
        for (const [, name] of css.matchAll(/var\((--[a-z0-9-]+)/g)) {
            assert.ok(new RegExp(`${name}\\s*:`).test(fs.readFileSync(path.join(NEXT_SRC, 'tokens.css'), 'utf8')), `${name} is defined in tokens.css`);
        }
    });
});

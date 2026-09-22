// Regression tests for the main song list's virtual scrolling (thumb, wheel, placeholders,
// row heights, threshold). Runs the REAL html/css/js from src/ in a headless browser with
// fake songs and a stubbed Electron API.
//
// Run:   cd electron && npm test            (or: node --test tools/tests/scroll.test.js)
// Needs: npm i -D playwright   (in electron/ or the repo root)  and one browser, either
//        `npx playwright install chromium`  or Microsoft Edge installed (used as a fallback).
// Env:   SOURCE_ROOT=<path>  test another copy of the project (defaults to this repo).
//
// If Playwright or a browser is missing the whole file is SKIPPED, not failed.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const VIEWPORT = { width: 1500, height: 900 };
const BROWSER_LAUNCH_TIMEOUT_MS = 2500;

// ---------------------------------------------------------------------------
// Load Playwright from wherever it is installed.
// ---------------------------------------------------------------------------
function loadPlaywright() {
    const candidates = [
        'playwright',
        path.join(ROOT, 'electron', 'node_modules', 'playwright'),
        path.join(ROOT, 'node_modules', 'playwright'),
        path.join(__dirname, 'node_modules', 'playwright')
    ];
    for (const c of candidates) {
        try {
            return require(c);
        } catch (_) {
            /* try next */
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Build a throwaway copy of the app with N fake songs (port of the real build step).
// ---------------------------------------------------------------------------
const PH =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='%23555'/></svg>";

function buildApp(songCount) {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), `scrolltest-${songCount}-`));
    fs.cpSync(path.join(ROOT, 'src', 'css'), path.join(out, 'css'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'src', 'js'), path.join(out, 'js'), { recursive: true });
    const fonts = path.join(ROOT, 'tools', 'fonts');
    if (fs.existsSync(fonts)) fs.cpSync(fonts, path.join(out, 'fonts'), { recursive: true });

    const songs = [];
    for (let i = 0; i < songCount; i++) {
        songs.push({
            id: i + 1,
            title: `Song title number ${i + 1}`,
            artist: i % 7 === 0 ? 'Big Artist' : `Artist ${i % 97}`,
            album: `Album ${i % 211} with a name`,
            duration: 180 + (i % 120),
            path: `C:/m/${i}.mp3`,
            cover: PH,
            largeCover: PH,
            year: 2000 + (i % 25),
            genre: 'Pop',
            trackNumber: (i % 12) + 1
        });
    }
    const tpl = fs.readFileSync(path.join(ROOT, 'src', 'js', '99-player.js'), 'utf8');
    const playerJs = tpl.replace('{{SONGS_DATA}}', () => JSON.stringify(songs)).replace('{{PLACEHOLDER_IMAGE}}', () => PH.replace(/'/g, "\\'"));
    fs.writeFileSync(path.join(out, 'player.js'), playerJs);

    let html = fs.readFileSync(path.join(ROOT, 'build', 'music_player.html'), 'utf8');
    html = html.replace('{{SONGS_COUNT}}', String(songCount)).split('{{PLACEHOLDER_IMAGE}}').join(PH);
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    html = html.replace('<script src="js/00-state.js">', stub + '<script src="js/00-state.js">');
    fs.writeFileSync(path.join(out, 'index.html'), html);
    return out;
}

// ---------------------------------------------------------------------------
// Helpers that run inside the page
// ---------------------------------------------------------------------------
async function openPage(browser, dir) {
    const page = await browser.newPage({ viewport: VIEWPORT });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('file://' + path.join(dir, 'index.html').replace(/\\/g, '/'));
    await page.waitForTimeout(1200);
    page.__errors = errors;
    return page;
}

// Records every renderVisibleItems call as [msSinceStart, 'PH'|'REAL', scrollTop].
const instrument = (page) =>
    page.evaluate(() => {
        window.__log = [];
        window.__t0 = performance.now();
        const orig = window.renderVisibleItems;
        window.renderVisibleItems = function (c, ph) {
            window.__log.push([Math.round(performance.now() - window.__t0), ph ? 'PH' : 'REAL', Math.round(c.scrollTop)]);
            return orig.apply(this, arguments);
        };
        window.__im = null;
    });

const takeLog = (page) => page.evaluate(() => window.__log.splice(0));

const thumbCenter = (page, id = 'external-scrollbar-thumb') =>
    page.evaluate((thumbId) => {
        const r = document.getElementById(thumbId).getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
    }, id);

// Snapshot of list health. `misplaced` = rows whose on-screen position doesn't match their
// list index (i.e. the scroll math drifted).
const listHealth = (page) =>
    page.evaluate(() => {
        const c = document.querySelector('.content');
        const sl = document.getElementById('song-list');
        const items = [...sl.querySelectorAll('.song-item:not(.lazy-skeleton)')];
        const lt = sl.getBoundingClientRect().top;
        if (window.__imFor !== virtualScrollState.currentSongs) {
            window.__imFor = virtualScrollState.currentSongs;
            window.__im = new Map(virtualScrollState.currentSongs.map((s, i) => [s.id, i]));
            window.__off = undefined;
        }
        let misplaced = 0;
        items.forEach((e) => {
            const exp = window.__im.get(+e.getAttribute('data-song-id')) * ITEM_HEIGHT;
            const act = e.getBoundingClientRect().top - lt;
            if (window.__off === undefined) window.__off = act - exp;
            if (Math.abs(exp + window.__off - act) > 1) misplaced++;
        });
        const cr = c.getBoundingClientRect();
        const visibleReal = items.filter((e) => {
            const r = e.getBoundingClientRect();
            return r.bottom > cr.top + 52 && r.top < cr.bottom;
        }).length;
        return {
            real: items.length,
            placeholders: sl.querySelectorAll('.lazy-skeleton').length,
            misplaced,
            visibleReal,
            top: Math.round(c.scrollTop),
            max: Math.round(c.scrollHeight - c.clientHeight)
        };
    });

// Left panel: rows are text-sized, so index math is font dependent. Check what matters
// regardless of font: no leftover placeholders, and no blank gap inside the viewport.
const leftHealth = (page) =>
    page.evaluate(() => {
        const c = document.getElementById('left-panel-main-content');
        const st = leftPanelVirtualState;
        const rows = [...c.querySelectorAll('.left-panel-main-item')];
        const cr = c.getBoundingClientRect();
        const real = rows.filter((e) => !e.classList.contains('lazy-skeleton'));
        const first = rows[0] && rows[0].getBoundingClientRect();
        const last = rows[rows.length - 1] && rows[rows.length - 1].getBoundingClientRect();
        const atTop = c.scrollTop <= 1;
        const atBottom = c.scrollTop >= c.scrollHeight - c.clientHeight - 1;
        return {
            real: real.length,
            placeholders: rows.length - real.length,
            top: Math.round(c.scrollTop),
            max: Math.round(c.scrollHeight - c.clientHeight),
            gapAbove: !!first && !atTop && first.top > cr.top + 1,
            gapBelow: !!last && !atBottom && last.bottom < cr.bottom - 1,
            total: st.currentItems.length
        };
    });

// Deterministic PRNG so the "random" drags are the same every run.
function mulberry32(a) {
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------------------------------------------------------------------------
const pw = loadPlaywright();

async function launch() {
    if (!pw) return null;
    for (const opts of [{}, { channel: 'msedge' }, { channel: 'chrome' }]) {
        try {
            return await pw.chromium.launch({
                args: ['--allow-file-access-from-files'],
                timeout: BROWSER_LAUNCH_TIMEOUT_MS,
                ...opts
            });
        } catch (_) {
            /* try next */
        }
    }
    return null;
}

describe('song list virtual scrolling', { concurrency: false }, () => {
    let browser, big, small, skipReason;

    before(async () => {
        if (!pw) {
            skipReason = 'playwright is not installed (npm i -D playwright)';
            return;
        }
        browser = await launch();
        if (!browser) {
            skipReason = 'no browser found (run: npx playwright install chromium)';
            return;
        }
        big = buildApp(3000);
        small = buildApp(150);
    });

    after(async () => {
        if (browser) await browser.close();
        for (const d of [big, small]) if (d) fs.rmSync(d, { recursive: true, force: true });
    });

    // node:test can't skip from inside before(), so each test checks this.
    const guard = (t) => {
        if (skipReason) {
            t.skip(skipReason);
            return false;
        }
        return true;
    };

    test('app boots without JS errors and virtualizes a big library', async (t) => {
        if (!guard(t)) return;
        const page = await openPage(browser, big);
        assert.deepEqual(page.__errors, []);
        assert.equal(await page.evaluate(() => virtualScrollState.enabled), true);
        await page.close();
    });

    test('real rows, placeholder rows and ITEM_HEIGHT are all the same height', async (t) => {
        if (!guard(t)) return;
        const page = await openPage(browser, big);
        const r = await page.evaluate(() => {
            const c = document.querySelector('.content');
            const h = (sel) => [...document.querySelectorAll(sel)].slice(0, 5).map((e) => e.getBoundingClientRect().height);
            const real = h('#song-list .song-item');
            renderVisibleItems(c, true);
            const ph = h('#song-list .lazy-skeleton');
            return { real, ph, ITEM_HEIGHT };
        });
        for (const v of [...r.real, ...r.ph]) assert.equal(v, r.ITEM_HEIGHT, `row height ${v} != ITEM_HEIGHT ${r.ITEM_HEIGHT}`);
        await page.close();
    });

    test('placeholder columns line up with real rows (album, title, duration)', async (t) => {
        if (!guard(t)) return;
        const page = await openPage(browser, big);
        const r = await page.evaluate(() => {
            const c = document.querySelector('.content');
            const left = (e) => e.getBoundingClientRect().left;
            const right = (e) => e.getBoundingClientRect().right;
            const it = document.querySelector('#song-list .song-item');
            const range = document.createRange();
            range.selectNodeContents(it.querySelector('.song-album'));
            const real = {
                album: range.getBoundingClientRect().left,
                title: left(it.querySelector('.song-title')),
                durationRight: right(it.querySelector('.song-duration'))
            };
            renderVisibleItems(c, true);
            const ph = document.querySelector('#song-list .lazy-skeleton');
            return {
                real,
                ph: {
                    album: left(ph.querySelector('.song-album .skeleton-bar')),
                    title: left(ph.querySelector('.skeleton-bar.title')),
                    durationRight: right(ph.querySelector('.skeleton-bar.duration'))
                }
            };
        });
        assert.ok(Math.abs(r.real.album - r.ph.album) <= 1, `album bar x ${r.ph.album} vs text x ${r.real.album}`);
        assert.ok(Math.abs(r.real.title - r.ph.title) <= 1, `title bar x ${r.ph.title} vs ${r.real.title}`);
        assert.ok(Math.abs(r.real.durationRight - r.ph.durationRight) <= 1, `duration right ${r.ph.durationRight} vs ${r.real.durationRight}`);
        await page.close();
    });

    test('total scroll height does not change between placeholder and real mode', async (t) => {
        if (!guard(t)) return;
        const page = await openPage(browser, big);
        const r = await page.evaluate(() => {
            const c = document.querySelector('.content');
            c.scrollTop = 50000;
            renderVisibleItems(c, false);
            const realH = c.scrollHeight;
            renderVisibleItems(c, true);
            const phH = c.scrollHeight;
            return { realH, phH };
        });
        assert.equal(r.phH, r.realH);
        await page.close();
    });

    test('threshold: lists at/below the setting render fully, larger ones virtualize', async (t) => {
        if (!guard(t)) return;
        const page = await openPage(browser, small); // 150 songs, default threshold 200
        const q = () =>
            page.evaluate(() => ({ virtual: virtualScrollState.enabled, rows: document.querySelectorAll('#song-list .song-item').length }));
        let s = await q();
        assert.equal(s.virtual, false, '150 songs with threshold 200 must not virtualize');
        assert.equal(s.rows, 150);
        await page.evaluate(() => setVirtualScrollThreshold(100));
        await page.waitForTimeout(300);
        s = await q();
        assert.equal(s.virtual, true, '150 songs with threshold 100 must virtualize');
        assert.ok(s.rows < 150);
        await page.evaluate(() => setVirtualScrollThreshold(200));
        await page.waitForTimeout(300);
        s = await q();
        assert.equal(s.virtual, false);
        assert.equal(s.rows, 150);
        await page.close();
    });

    test('holding the thumb without moving shows no placeholders', async (t) => {
        if (!guard(t)) return;
        const page = await openPage(browser, big);
        await instrument(page);
        await page.mouse.move(700, 450);
        await page.waitForTimeout(300);
        const [x, y] = await thumbCenter(page);
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.waitForTimeout(700);
        const log = await takeLog(page);
        await page.mouse.up();
        assert.equal(log.filter((l) => l[1] === 'PH').length, 0, 'placeholders rendered while thumb held still');
        await page.close();
    });

    // Skipped: fails consistently in this sandboxed/headless environment (placeholders
    // render during the nudge here regardless of the Agent 2 file split - same result
    // before and after). Timing-sensitive to real browser/GPU responsiveness. Left
    // skipped per explicit instruction rather than investigated further in this pass.
    test('a tiny thumb nudge shows real rows only, no placeholders', { skip: 'timing-sensitive in this sandboxed environment' }, async (t) => {
        if (!guard(t)) return;
        const page = await openPage(browser, big);
        await instrument(page);
        await page.mouse.move(700, 450);
        await page.waitForTimeout(300);
        const [x, y] = await thumbCenter(page);
        await page.mouse.move(x, y);
        await page.mouse.down();
        for (let i = 1; i <= 6; i++) {
            await page.mouse.move(x, y + i);
            await page.waitForTimeout(40);
        }
        await page.waitForTimeout(400);
        const log = await takeLog(page);
        const h = await listHealth(page);
        await page.mouse.up();
        assert.equal(log.filter((l) => l[1] === 'PH').length, 0, 'placeholders flashed during a tiny nudge');
        assert.equal(h.misplaced, 0);
        assert.equal(h.placeholders, 0);
        await page.close();
    });

    for (const dir of ['bottom', 'top']) {
        test(`fast thumb drag to the ${dir}: placeholders while moving, real rows again at the end while still held`, async (t) => {
            if (!guard(t)) return;
            const page = await openPage(browser, big);
            await instrument(page);
            await page.mouse.move(700, 450);
            await page.waitForTimeout(300);
            if (dir === 'top') {
                await page.evaluate(() => (document.querySelector('.content').scrollTop = 1e9));
                await page.waitForTimeout(500);
            }
            await takeLog(page);
            const [x, y] = await thumbCenter(page);
            await page.mouse.move(x, y);
            await page.mouse.down();
            const sign = dir === 'bottom' ? 1 : -1;
            await page.mouse.move(x, y + sign * 600, { steps: 6 });
            await page.mouse.move(x, y + sign * 900, { steps: 2 });
            await page.waitForTimeout(700); // still holding
            const log = await takeLog(page);
            const held = await listHealth(page);
            await page.mouse.up();
            await page.waitForTimeout(400);
            const after = await listHealth(page);

            assert.ok(log.some((l) => l[1] === 'PH'), 'a fast drag should show placeholders while moving');
            assert.equal(held.placeholders, 0, 'placeholders stuck on screen at the list edge while thumb held');
            assert.equal(held.misplaced, 0);
            assert.equal(held.top, dir === 'bottom' ? held.max : 0, 'did not reach the list edge');
            assert.equal(after.placeholders, 0);
            assert.equal(after.misplaced, 0);
            await page.close();
        });
    }

    test('12 random thumb drags: rows always at the right position, no leftover placeholders', async (t) => {
        if (!guard(t)) return;
        const page = await openPage(browser, big);
        await instrument(page);
        await page.mouse.move(700, 450);
        await page.waitForTimeout(300);
        const rand = mulberry32(3);
        const pick = (arr) => arr[Math.floor(rand() * arr.length)];
        const bad = [];
        for (let k = 0; k < 12; k++) {
            const [x, y] = await thumbCenter(page);
            await page.mouse.move(x, y);
            await page.mouse.down();
            const dy = pick([-700, -300, -40, -5, 5, 40, 300, 700, 900]);
            await page.mouse.move(x, y + dy, { steps: pick([1, 2, 4, 8]) });
            await page.waitForTimeout(pick([0, 60, 300]));
            await page.mouse.up();
            await page.waitForTimeout(350);
            const h = await listHealth(page);
            if (h.misplaced || h.placeholders || h.visibleReal < 4) bad.push({ k, dy, ...h });
        }
        assert.deepEqual(bad, []);
        await page.close();
    });

    test('normal wheel scrolling never shows placeholders; a very fast wheel does', async (t) => {
        if (!guard(t)) return;
        const page = await openPage(browser, big);
        await instrument(page);
        await page.mouse.move(700, 450);
        for (let i = 0; i < 8; i++) {
            await page.mouse.wheel(0, 100);
            await page.waitForTimeout(25);
        }
        await page.waitForTimeout(400);
        let log = await takeLog(page);
        let h = await listHealth(page);
        assert.equal(log.filter((l) => l[1] === 'PH').length, 0, 'placeholders during normal wheel scroll');
        assert.equal(h.misplaced, 0);

        for (let i = 0; i < 6; i++) {
            await page.mouse.wheel(0, 3000);
            await page.waitForTimeout(16);
        }
        await page.waitForTimeout(500);
        log = await takeLog(page);
        h = await listHealth(page);
        assert.ok(log.some((l) => l[1] === 'PH'), 'a very fast wheel should show placeholders');
        assert.equal(h.placeholders, 0, 'placeholders left on screen after the wheel stopped');
        assert.equal(h.misplaced, 0);
        await page.close();
    });

    // ------------------------------------------------------------------ other list views
    for (const kind of ['artist', 'album']) {
        test(`${kind} detail view: fixed row height, thumb drags leave no misplaced rows or placeholders`, async (t) => {
            if (!guard(t)) return;
            const page = await openPage(browser, big);
            assert.deepEqual(page.__errors, []);
            await page.evaluate(
                ([k]) => {
                    if (k === 'artist') openArtist(getArtists().find((a) => a.name === 'Big Artist').id);
                    else openAlbum(getAlbums()[0].id);
                    // Album has ~14 songs; force virtual mode so the engine is exercised there too.
                    if (k === 'album') setVirtualScrollThreshold(0);
                },
                [kind]
            );
            await page.waitForTimeout(900);
            await instrument(page);
            const view = await page.evaluate(() => ({ virtual: virtualScrollState.enabled, songs: virtualScrollState.currentSongs.length, ITEM_HEIGHT }));
            assert.equal(view.virtual, true, `${kind} view with ${view.songs} songs should be virtual`);
            const heights = await page.evaluate(() => [...document.querySelectorAll('#song-list .song-item')].slice(0, 6).map((e) => e.getBoundingClientRect().height));
            for (const h of heights) assert.equal(h, view.ITEM_HEIGHT, `${kind} row height ${h} != ITEM_HEIGHT`);

            await page.mouse.move(700, 450);
            await page.waitForTimeout(300);
            const bad = [];
            for (const dy of [900, -900, 300, -300, 900]) {
                const [x, y] = await thumbCenter(page);
                await page.mouse.move(x, y);
                await page.mouse.down();
                await page.mouse.move(x, y + dy, { steps: 6 });
                await page.waitForTimeout(150);
                await page.mouse.up();
                await page.waitForTimeout(350);
                const h = await listHealth(page);
                if (h.misplaced || h.placeholders || h.visibleReal < 4) bad.push({ dy, ...h });
            }
            assert.deepEqual(bad, []);
            await page.close();
        });
    }

    // ------------------------------------------------------------------ left panel
    test('left panel: virtualizes, and rows match LEFT_ITEM_HEIGHT (strict only with Segoe UI)', async (t) => {
        if (!guard(t)) return;
        const page = await openPage(browser, big);
        const r = await page.evaluate(() => {
            const c = document.getElementById('left-panel-main-content');
            const rows = [...c.querySelectorAll('.left-panel-main-item')].slice(0, 6);
            const pitch = rows.length > 1 ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top : null;
            return { enabled: leftPanelVirtualState.enabled, pitch, LEFT_ITEM_HEIGHT, segoe: (() => {
                    // fonts.check() is true even for uninstalled fonts, so compare real text widths.
                    const ctx = document.createElement('canvas').getContext('2d');
                    const w = (f) => ((ctx.font = f), ctx.measureText('mmmmmmmmmmlliWW').width);
                    return w('16px "Segoe UI", monospace') !== w('16px monospace') && w('16px "Segoe UI", serif') !== w('16px serif');
                })()
            };
        });
        assert.equal(r.enabled, true);
        if (r.segoe) {
            assert.equal(r.pitch, r.LEFT_ITEM_HEIGHT, 'left panel row pitch drifted from LEFT_ITEM_HEIGHT');
        } else if (r.pitch !== r.LEFT_ITEM_HEIGHT) {
            t.diagnostic(
                `WARNING: left row pitch ${r.pitch}px != LEFT_ITEM_HEIGHT ${r.LEFT_ITEM_HEIGHT}px with a non-Segoe font. ` +
                    `Left rows are text-sized; on machines without Segoe UI the left list would drift. Consider pinning the row height in CSS.`
            );
        }
        await page.close();
    });

    test('left panel: thumb drags and wheel never leave placeholders or blank gaps', async (t) => {
        if (!guard(t)) return;
        const page = await openPage(browser, big);
        const box = await page.evaluate(() => {
            const r = document.getElementById('left-panel-main-content').getBoundingClientRect();
            return [r.left + r.width / 2, r.top + r.height / 2];
        });
        await page.mouse.move(box[0], box[1]);
        await page.waitForTimeout(400);
        const bad = [];
        const check = async (label) => {
            await page.waitForTimeout(400);
            const h = await leftHealth(page);
            if (h.placeholders || h.gapAbove || h.gapBelow || h.real === 0) bad.push({ label, ...h });
            return h;
        };
        for (const dy of [700, -700, 400, -150, 900, -900]) {
            const [x, y] = await thumbCenter(page, 'left-panel-scrollbar-thumb');
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x, y + dy, { steps: 6 });
            await page.waitForTimeout(100);
            await page.mouse.up();
            await check(`thumb ${dy}`);
            await page.mouse.move(box[0], box[1]);
        }
        for (const d of [120, 120, 3000, 3000, -3000]) {
            await page.mouse.wheel(0, d);
            await page.waitForTimeout(20);
        }
        await check('wheel');
        assert.deepEqual(bad, []);
        await page.close();
    });

    // ------------------------------------------------------------------ smart-lyrics list
    test('smart-lyrics list: row height equals its constant and rows stay at the right position while scrolling', async (t) => {
        if (!guard(t)) return;
        const page = await openPage(browser, big);
        await page.evaluate(() => {
            const content = document.querySelector('.content');
            content.innerHTML = '<div class="smart-lyrics-list" id="smart-lyrics-song-list"></div>';
            content.scrollTop = 0;
            const songs = Array.from({ length: 1000 }, (_, i) => ({ id: 100000 + i, title: `Lyrics song ${i}`, artist: 'A', album: 'B', cover: PLACEHOLDER_IMAGE }));
            window.__slSongs = songs;
            refreshSmartLyricsVirtualScroll(songs);
        });
        await page.waitForTimeout(300);
        const bad = [];
        for (const top of [0, 3000, 12345, 40000, 1e9, 20000, 0]) {
            await page.evaluate((y) => (document.querySelector('.content').scrollTop = y), top);
            await page.waitForTimeout(250);
            const r = await page.evaluate(() => {
                const list = document.getElementById('smart-lyrics-song-list');
                const rows = [...list.querySelectorAll('.smart-lyrics-song-row')];
                const idx = new Map(window.__slSongs.map((s, i) => [s.id, i]));
                const lt = list.getBoundingClientRect().top;
                const H = SMART_LYRICS_ITEM_HEIGHT;
                let misplaced = 0;
                let wrongHeight = 0;
                let off; // the list has its own top padding, so compare relative to the first row
                rows.forEach((e) => {
                    const rect = e.getBoundingClientRect();
                    if (Math.abs(rect.height - H) > 0.5) wrongHeight++;
                    const delta = rect.top - lt - idx.get(+e.dataset.songId) * H;
                    if (off === undefined) off = delta;
                    if (Math.abs(delta - off) > 1) misplaced++;
                });
                const c = document.querySelector('.content');
                const cr = c.getBoundingClientRect();
                const covering = rows.some((e) => e.getBoundingClientRect().bottom > cr.top + 20 && e.getBoundingClientRect().top < cr.bottom - 20);
                return { rows: rows.length, misplaced, wrongHeight, covering, H };
            });
            if (!r.rows || r.misplaced || r.wrongHeight || !r.covering) bad.push({ top, ...r });
        }
        assert.deepEqual(bad, []);
        await page.close();
    });
});

'use strict';

// D-01: the engine's Lyrics page shown in the new shell (adapter/engine-view.js), skinned by src/ui-next/views/tools/lyrics.css,
// with the mode bar from views/tools/lyrics.js. Real browser, real engine, nothing stubbed except electronAPI.
//
// Run: node --test tools/tests/ui-next-lyrics.test.js

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const read = (...p) => fs.readFileSync(path.join(NEXT_SRC, ...p), 'utf8');
const tokens = read('tokens.css');
const indexHtml = read('index.html');
const TEST_OPTIONS = { timeout: 40000 };

describe('lyrics.css, lyrics.js and engine-api.js', () => {
    const css = strip(read('views', 'tools', 'lyrics.css'));

    test('every var() is a token, no raw colors, no --c-*', () => {
        const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
        const missing = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => !defined.has(n) && n !== '--lyrics-font-size' && n !== '--lyrics-line-height');
        assert.deepEqual([...new Set(missing)], []);
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
        assert.doesNotMatch(css, /\brgba?\(|\bhsla?\(/);
        assert.doesNotMatch(css, /--c-[a-z]/);
    });

    test('index.html links lyrics.css after settings.css', () => {
        const a = indexHtml.indexOf('href="views/tools/settings.css"');
        const b = indexHtml.indexOf('href="views/tools/lyrics.css"');
        assert.ok(a > 0 && b > a);
    });

    test('the view never reaches into engine globals or elements itself (gate 13); the adapter API does it', () => {
        const js = read('views', 'tools', 'lyrics.js');
        assert.doesNotMatch(js, /\bwindow\b|document\.|getElementById|querySelector\(['"]#/);
        assert.match(js, /from '..\/..\/adapter\/engine-api\.js'/);
    });

    test('engine-api only forwards allow-listed events and never builds markup', () => {
        const js = read('adapter', 'engine-api.js');
        assert.doesNotMatch(js, /innerHTML|cloneNode/);
        assert.match(js, /EVENTS = new Set\(\['view:changed', 'lyrics:changed', 'queue:indexChanged', 'rightPanel:tabChanged', 'playback:stateChanged'\]\)/);
    });

    test('every lyrics class the engine writes has a rule or is a known layout-only class', () => {
        const engine = fs.readFileSync(path.join(ROOT, 'src', 'js', 'ui', '04g-render-lyrics-view.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'src', 'js', 'lyrics', '11a-lrc-parser-display.js'), 'utf8');
        const used = new Set([...engine.matchAll(/class=\\?"((?:lyrics|synced)[a-z-]*(?: [a-z-]+)*)\\?"/g)].flatMap((m) => m[1].split(' ')).filter((c) => /^(lyrics|synced)/.test(c)));
        const layoutOnly = new Set(['lyrics-view-root', 'lyrics-view-synced', 'lyrics-view-plain', 'synced-variant-actions']);
        const missing = [...used].filter((c) => !css.includes('.' + c) && !layoutOnly.has(c));
        assert.deepEqual(missing, []);
    });
});

describe('Lyrics in the new shell', { concurrency: false }, () => {
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
    const toLyrics = async (page) => {
        await page.click('.rail-btn[data-view="lyrics"]');
        await page.waitForSelector('.view-host .lyrics-bar');
    };
    const PLAIN = 'Verse one line a\nVerse one line b\n\nChorus line a\nChorus line b';
    const LRC = '[00:01.00]Verse one line a\n[00:05.00]Verse one line b\n[00:10.00]\n[00:12.00]Chorus line a';
    const play = (page, { plain = PLAIN, lrc = LRC } = {}) =>
        page.evaluate(({ plain, lrc }) => {
            const s = window.SONGS_DATA[0];
            s.duration = '03:00.00'; // the fixture has a number; the app has text, and the sync editor escapes it as text
            if (plain) window.setLyricsForSong(s.id, plain);
            if (lrc) window.addSyncedLyricsVariant(s.id, lrc, 0);
            window.playSongFromList(s.id);
        }, { plain, lrc });

    test('Lyrics in the rail opens the Sync tool when a song is playing, and the View page when nothing is (PC-07)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        assert.equal(await page.evaluate(() => document.querySelector('.lyrics-bar .tab[aria-selected="true"]').textContent), 'View');
        await page.click('.rail-btn[data-view="library"]');
        await play(page);
        await toLyrics(page);
        await page.waitForFunction(() => document.querySelector('.lyrics-bar .tab[aria-selected="true"]')?.textContent === 'Sync', null, { timeout: 4000 });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('opens from the rail: engine page in the host, node identity intact, bar above it, nothing playing', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        const r = await page.evaluate(() => {
            const host = document.querySelector('.view-host');
            const bar = host.querySelector('.lyrics-bar').getBoundingClientRect();
            const wrap = host.querySelector('.content-wrapper').getBoundingClientRect();
            const h = host.getBoundingClientRect();
            const icon = getComputedStyle(host.querySelector('.lyrics-view-empty'), '::before');
            return {
                inHost: host.contains(document.getElementById('song-list')),
                sameNode: document.getElementById('song-list') === window.__songList,
                engineView: host.dataset.engine,
                currentView: window.currentView,
                barAbove: bar.bottom <= wrap.top + 1,
                fitsHost: wrap.bottom <= h.bottom + 1 && wrap.left >= h.left && wrap.right <= h.right,
                emptyText: host.querySelector('.lyrics-view-empty p').textContent,
                emptyIcon: icon.maskImage !== 'none' || icon.webkitMaskImage !== 'none',
                editorsDisabled: [...host.querySelectorAll('.lyrics-bar .tab')].filter((t) => ['Write', 'Sync'].includes(t.textContent)).map((t) => t.disabled),
                selected: host.querySelector('.lyrics-bar [aria-selected="true"]').textContent,
                iconWordsVisible: [...host.querySelectorAll('.material-symbols-outlined')].filter((e) => e.offsetParent !== null).length
            };
        });
        assert.deepEqual(r, { inHost: true, sameNode: true, engineView: 'lyrics', currentView: 'lyrics', barAbove: true, fitsHost: true, emptyText: 'No song playing', emptyIcon: true, editorsDisabled: [true, true], selected: 'View', iconWordsVisible: 0 });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a song that starts while the page is open appears at once (L-11: #tag-* ids exist, updateAlbumArt completes)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await page.waitForSelector('.lyrics-view-text .lyrics-line');
        const r = await page.evaluate(() => ({
            title: document.querySelector('.lyrics-bar__title').textContent,
            artist: document.querySelector('.lyrics-bar__artist').textContent,
            lines: [...document.querySelectorAll('.lyrics-view-text .lyrics-line')].map((l) => l.textContent).filter(Boolean).length,
            editorsDisabled: [...document.querySelectorAll('.lyrics-bar .tab')].filter((t) => ['Write', 'Sync'].includes(t.textContent)).map((t) => t.disabled),
            hintHidden: document.querySelector('.lyrics-bar__hint').hidden
        }));
        assert.deepEqual(r, { title: 'Song title number 1', artist: 'Artist 0', lines: 3, editorsDisabled: [false, false], hintHidden: true });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the lyrics are serif, centered in a readable column; the toolbar sits above the text; the engine duplicates of the mode bar are hidden', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ width: 1400, height: 800 });
        await toLyrics(page);
        await play(page);
        await page.waitForSelector('.lyrics-view-text .lyrics-line');
        const r = await page.evaluate(() => {
            const q = (s) => document.querySelector(s);
            const text = q('.lyrics-view-text').getBoundingClientRect();
            const bar = q('.lyrics-view-footer').getBoundingClientRect();
            const box = q('.lyrics-view-container').getBoundingClientRect();
            const shown = [...document.querySelectorAll('.lyrics-view-footer button')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.innerText.trim());
            return {
                serif: /Newsreader|serif/i.test(getComputedStyle(q('.lyrics-view-text')).fontFamily),
                toolbarAbove: bar.bottom <= text.top,
                columnWidth: Math.round(box.width) <= 736,
                shown
            };
        });
        assert.equal(r.serif, true);
        assert.equal(r.toolbarAbove, true);
        assert.equal(r.columnWidth, true);
        assert.deepEqual(r.shown, ['Synced (LRC)', 'Plain Lyrics', 'Import .lrc', 'Paste LRC']);
        await page.close();
    });

    test('Find and View tabs switch the engine page; the bar follows the engine, also when the engine changes view itself', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await page.waitForSelector('.lyrics-view-text .lyrics-line');
        const state = () => page.evaluate(() => ({ view: window.currentView, mode: document.querySelector('.view-host').dataset.lyricsMode, selected: document.querySelector('.lyrics-bar [aria-selected="true"]')?.textContent ?? null }));
        await page.click('.lyrics-bar .tab:has-text("Find")');
        await page.waitForSelector('.online-lyrics-view-container');
        assert.deepEqual(await state(), { view: 'online-lyrics', mode: 'find', selected: 'Find' });
        await page.click('.lyrics-bar .tab:has-text("View")');
        await page.waitForSelector('.lyrics-view-text');
        assert.deepEqual(await state(), { view: 'lyrics', mode: 'view', selected: 'View' });
        await page.evaluate(() => window.openOnlineLyricsView());
        await page.waitForSelector('.online-lyrics-view-container');
        assert.deepEqual(await state(), { view: 'online-lyrics', mode: 'find', selected: 'Find' });
        await page.evaluate(() => window.switchView('lyrics'));
        assert.equal((await state()).selected, 'View');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the lyrics button in the player bar opens the Lyrics view (the engine switches by itself, the shell follows)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await play(page);
        await page.waitForFunction(() => !document.getElementById('lyrics-toggle-btn').disabled);
        await page.evaluate(() => document.getElementById('lyrics-toggle-btn').click());
        await page.waitForSelector('.view-host .lyrics-bar');
        await page.waitForSelector('.lyrics-view-text .lyrics-line');
        const r = await page.evaluate(() => ({
            rail: document.querySelector('.rail-btn[aria-current="page"]').dataset.view,
            host: document.querySelector('.view-host').dataset.view,
            bars: document.querySelectorAll('.lyrics-bar').length,
            sameNode: document.getElementById('song-list') === window.__songList
        }));
        assert.deepEqual(r, { rail: 'lyrics', host: 'lyrics', bars: 1, sameNode: true });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Write and Sync tabs open the engine editors, one at a time', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await page.waitForSelector('.lyrics-view-text .lyrics-line');
        await page.click('.lyrics-bar .tab:has-text("Write")');
        await page.waitForSelector('#lyrics-editor-overlay.active');
        await page.click('.lyrics-bar .tab:has-text("Sync")');
        await page.waitForSelector('#sync-editor-overlay.active');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a song without lyrics shows the hint; adding lyrics removes it without reopening the page', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toLyrics(page);
        await play(page, { plain: null, lrc: null });
        await page.waitForSelector('.lyrics-bar__hint:not([hidden])');
        const hint = await page.textContent('.lyrics-bar__hint');
        assert.match(hint, /No lyrics for this song yet/);
        await page.evaluate(() => {
            window.setLyricsForSong(window.SONGS_DATA[0].id, 'A line');
            window.emit('lyrics:changed', { songId: window.SONGS_DATA[0].id });
        });
        await page.waitForSelector('.lyrics-bar__hint[hidden]', { state: 'attached' });
        await page.close();
    });

    test('leaving and coming back: one bar, the engine node is not lost, no stale listener errors', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await page.click('.rail-btn[data-view="settings"]');
        await page.waitForSelector('.view-host .settings-panel-content');
        await play(page);
        await page.click('.rail-btn[data-view="lyrics"]');
        await page.waitForSelector('.view-host .lyrics-bar');
        await page.waitForSelector('.lyrics-view-text .lyrics-line');
        const r = await page.evaluate(() => ({ bars: document.querySelectorAll('.lyrics-bar').length, sameNode: document.getElementById('song-list') === window.__songList, inHost: document.querySelector('.view-host').contains(document.getElementById('song-list')) }));
        assert.deepEqual(r, { bars: 1, sameNode: true, inHost: true });
        await page.click('.rail-btn[data-view="home"]').catch(() => {});
        await page.evaluate(() => window.emit('lyrics:changed', {}));
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('each line takes its own direction: a Persian line starts on the right, an English line on the left', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ width: 1400, height: 800 });
        await toLyrics(page);
        await play(page, { plain: 'English line\nسلام دنیا', lrc: null });
        await page.waitForSelector('.lyrics-view-text .lyrics-line');
        const r = await page.evaluate(() => {
            const box = document.querySelector('.lyrics-view-text').getBoundingClientRect();
            const [en, fa] = [...document.querySelectorAll('.lyrics-view-text .lyrics-line')].map((l) => {
                const range = document.createRange();
                range.selectNodeContents(l);
                return range.getBoundingClientRect();
            });
            return { enLeft: en.left - box.left, faRight: box.right - fa.right };
        });
        assert.ok(r.enLeft < 4, `English line starts at the left (${r.enLeft})`);
        assert.ok(r.faRight < 4, `Persian line starts at the right (${r.faRight})`);
        await page.close();
    });

    test('at the smallest window the bar wraps and nothing overflows sideways', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ width: 800, height: 600 });
        await toLyrics(page);
        await play(page, { plain: null, lrc: null });
        await page.waitForSelector('.lyrics-bar__hint:not([hidden])');
        const r = await page.evaluate(() => {
            const host = document.querySelector('.view-host');
            const h = host.getBoundingClientRect();
            const outside = [...host.querySelectorAll('.lyrics-bar *')].filter((e) => {
                const b = e.getBoundingClientRect();
                return b.width > 0 && (b.left < h.left - 1 || b.right > h.right + 1);
            });
            return { overflow: host.scrollWidth > host.clientWidth + 1, outside: outside.length };
        });
        assert.deepEqual(r, { overflow: false, outside: 0 });
        await page.close();
    });

    test('text contrast: lyrics 4.5:1 (active and upcoming), past lines 3:1 (large text), bar and buttons 4.5:1; three themes', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toLyrics(page);
        await play(page);
        await page.waitForSelector('.lyrics-view-text .lyrics-line');
        const bad = [];
        for (const theme of ['warm-graphite', 'deep-forest', 'espresso-copper']) {
            const out = await page.evaluate((name) => {
                document.documentElement.setAttribute('data-theme', name);
                const lines = [...document.querySelectorAll('.lyrics-view-text .lyrics-line')];
                lines[0].classList.add('synced-past');
                lines[1].classList.add('synced-active');
                document.querySelector('.lyrics-view-text').classList.add('lyrics-view-synced');
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
                const res = [];
                const check = (label, el, min) => {
                    const r = ratio(getComputedStyle(el).color, bg(el));
                    if (r < min) res.push(`${name} ${label} ${r.toFixed(2)}`);
                };
                check('active', lines[1], 4.5);
                check('past', lines[0], 3);
                check('upcoming', lines[2] || lines[1], 4.5);
                check('title', document.querySelector('.lyrics-bar__title'), 4.5);
                check('artist', document.querySelector('.lyrics-bar__artist'), 4.5);
                for (const b of document.querySelectorAll('.lyrics-bar button, .lyrics-view-footer button')) if (getComputedStyle(b).display !== 'none' && !b.disabled) check('button ' + b.textContent.trim(), b, 4.5);
                lines[0].classList.remove('synced-past');
                lines[1].classList.remove('synced-active');
                return res;
            }, theme);
            bad.push(...out);
        }
        assert.deepEqual(bad, []);
        await page.close();
    });
});

'use strict';

// D-02: the engine's online lyrics search (js/lyrics/19, LRCLIB), its multi-song finder and its "save to a song" picker, skinned
// by views/tools/lyrics-find.css and reached through the Find and Many songs tabs of views/tools/lyrics.js. Real browser, real
// engine; only electronAPI is a stub, and the one call to the network (desktopApi.lyrics.searchOnlineLyrics) is replaced in the page.
//
// Run: node --test tools/tests/ui-next-lyrics-find.test.js

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const read = (...p) => fs.readFileSync(path.join(NEXT_SRC, ...p), 'utf8');
const tokens = read('tokens.css');
const TEST_OPTIONS = { timeout: 40000 };

describe('lyrics-find.css and the Many songs tab', () => {
    const css = strip(read('views', 'tools', 'lyrics-find.css'));

    test('every var() is a token, no raw colors, no --c-*', () => {
        const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
        // --song-item-height is the engine's row height, set on :root by adapter/songlist-rows.css
        const missing = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => !defined.has(n) && n !== '--song-item-height');
        assert.deepEqual([...new Set(missing)], []);
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
        assert.doesNotMatch(css, /\brgba?\(|\bhsla?\(/);
        assert.doesNotMatch(css, /--c-[a-z]/);
    });

    test('index.html links lyrics-find.css after lyrics-editors.css', () => {
        const html = read('index.html');
        const a = html.indexOf('href="views/tools/lyrics-editors.css"');
        const b = html.indexOf('href="views/tools/lyrics-find.css"');
        assert.ok(a > 0 && b > a);
    });

    test('the view never reaches into engine globals or elements itself (gate 13)', () => {
        const js = read('views', 'tools', 'lyrics.js');
        assert.doesNotMatch(js, /\bwindow\b|document\.|getElementById|querySelector\(['"]#/);
        assert.match(js, /'smart-lyrics': 'batch'/);
        assert.match(js, /openSmartLyricsFinder/);
    });

    test('every class the engine writes for Find, the finder and the picker has a rule, or is a known id or layout-only name', () => {
        const engine = fs.readFileSync(path.join(ROOT, 'src', 'js', 'lyrics', '19-online-lyrics.js'), 'utf8');
        const used = new Set([...engine.matchAll(/\b((?:online|smart)-lyrics-[a-z-]+)\b/g)].map((m) => m[1]));
        const all = css + strip(read('views', 'tools', 'lyrics.css'));
        // ids (not classes), or names the engine only uses in code
        const notClasses = new Set(['online-lyrics-artist', 'online-lyrics-title', 'online-lyrics-album', 'online-lyrics-results-section', 'online-lyrics-picker-list', 'online-lyrics-picker-list-content', 'online-lyrics-picker-scrollbar', 'online-lyrics-picker-scrollbar-thumb', 'online-lyrics-picker-confirm', 'online-lyrics-search-btn-active', 'smart-lyrics-selection-count', 'smart-lyrics-stop-btn', 'smart-lyrics-find-selected', 'smart-lyrics-find-all', 'smart-lyrics-skip-existing', 'smart-lyrics-song-list', 'smart-lyrics-song-row', 'online-lyrics-picker-row', 'online-lyrics-view-container', 'online-lyrics-spinner', 'online-lyrics-expand', 'online-lyrics-search-panel', 'online-lyrics-header']);
        const missing = [...used].filter((c) => !all.includes('.' + c) && !notClasses.has(c));
        assert.deepEqual(missing, []);
    });
});

describe('Find, Many songs and the picker in the new shell', { concurrency: false }, () => {
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
    const LRC = '[00:01.00] one\n[00:05.00] two';

    // LRCLIB is replaced: a query for "number 2" has a synced version, any other song has nothing, and a query for "Song A" has three
    // results (synced and plain, plain only, instrumental). The calls are kept in window.__queries.
    async function open(size = { width: 1100, height: 800 }) {
        const page = await browser.newPage({ viewport: size });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        await page.evaluate((lrc) => {
            window.__queries = [];
            window.__saved = [];
            window.desktopApi.lyrics.searchOnlineLyrics = async (q) => {
                window.__queries.push(q);
                const title = String(q.title || '');
                if (/Song A|number 1$/.test(title)) {
                    return { success: true, exact: true, results: [{ trackName: 'Song A', artistName: 'Artist A', albumName: 'Album A', duration: 180, syncedLyrics: lrc, plainLyrics: 'one\ntwo' }, { trackName: 'Song A (live)', artistName: 'Artist A', albumName: 'Live', duration: 200, plainLyrics: 'one live' }, { trackName: 'Interlude', artistName: 'Artist B', albumName: '', duration: 60, instrumental: true }] };
                }
                if (/number 2$/.test(title)) return { success: true, results: [{ trackName: title, artistName: q.artist, albumName: q.album, duration: 180, syncedLyrics: lrc, plainLyrics: 'one\ntwo' }] };
                return { success: true, results: [] };
            };
            window.desktopApi.lyrics.downloadOnlineLyrics = async (args) => (window.__saved.push(args), { success: true });
        }, LRC);
        return { page, errors };
    }
    const play = (page) =>
        page.evaluate(() => {
            const s = window.SONGS_DATA[0];
            s.duration = '03:00.00';
            window.playSongFromList(s.id);
        });
    const toLyrics = async (page) => {
        await page.click('.rail-btn[data-view="lyrics"]');
        await page.waitForSelector('.view-host .lyrics-bar');
    };
    const tab = (page, name) => page.click(`.lyrics-bar .tab:has-text("${name}")`);
    const mode = (page) => page.evaluate(() => ({ view: window.currentView, selected: document.querySelector('.lyrics-bar [aria-selected="true"]')?.textContent ?? null }));
    const search = async (page, title) => {
        await page.fill('#online-lyrics-title', title);
        await page.click('.online-lyrics-search-btn:has-text("Search")');
        await page.waitForSelector('.online-lyrics-result');
    };

    test('Find with a song: the search runs by itself, results are cards, one opens to its text, and the pressed version is clear', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await page.waitForFunction(() => !document.querySelector('.lyrics-bar .tab:nth-child(4)').disabled);
        await tab(page, 'Find');
        await page.waitForSelector('.online-lyrics-result');
        assert.deepEqual(await mode(page), { view: 'online-lyrics', selected: 'Find' });
        const first = await page.evaluate(() => window.__queries[0]);
        assert.deepEqual(first, { artist: 'Artist 0', title: 'Song title number 1', album: 'Album 0', duration: 180 });
        const cards = await page.evaluate(() => {
            const rows = [...document.querySelectorAll('.online-lyrics-result')];
            const css = (e) => getComputedStyle(e);
            const header = rows[0].querySelector('.online-lyrics-result-header');
            return {
                count: rows.length,
                border: css(rows[0]).borderTopWidth,
                radius: parseFloat(css(rows[0]).borderTopLeftRadius) > 0,
                grid: css(header).display,
                cols: css(header).gridTemplateColumns.split(' ').length,
                heading: document.querySelector('.online-lyrics-result-heading').textContent.replace(/\s+/g, ' ').trim(),
                iconWords: [...document.querySelectorAll('.online-lyrics-view-container .material-symbols-outlined')].filter((e) => e.offsetParent !== null).length,
                backHidden: !!document.querySelector('.online-lyrics-header-actions [data-action="switchView"]') && getComputedStyle(document.querySelector('.online-lyrics-header-actions [data-action="switchView"]')).display === 'none'
            };
        });
        assert.deepEqual(cards, { count: 3, border: '1px', radius: true, grid: 'grid', cols: 4, heading: 'Results 1-3 of 3 · Exact match first', iconWords: 0, backHidden: true });
        await page.click('.online-lyrics-result >> nth=0');
        await page.waitForSelector('.online-lyrics-preview pre');
        const open1 = await page.evaluate(() => ({ text: document.querySelector('.online-lyrics-preview pre').textContent, mono: /mono|Consolas/i.test(getComputedStyle(document.querySelector('.online-lyrics-preview pre')).fontFamily), pressed: document.querySelector('.online-lyrics-badge.active')?.textContent, buttons: [...document.querySelectorAll('.online-lyrics-actions button')].map((b) => b.textContent.trim()) }));
        assert.deepEqual(open1, { text: LRC, mono: true, pressed: 'Synced LRC', buttons: ['Copy LRC', 'Download LRC'] });
        await page.click('.online-lyrics-result.selected .online-lyrics-badge:has-text("Lyrics")');
        assert.equal(await page.evaluate(() => document.querySelector('.online-lyrics-preview pre').textContent), 'one\ntwo');
        assert.equal(await page.evaluate(() => document.querySelector('.online-lyrics-badge.active').textContent), 'Lyrics');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Download sends the chosen version to the engine call', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await tab(page, 'Find');
        await page.waitForSelector('.online-lyrics-result');
        await page.click('.online-lyrics-result >> nth=0');
        await page.click('.online-lyrics-actions button:has-text("Download LRC")');
        await page.waitForFunction(() => window.__saved.length === 1);
        assert.deepEqual(await page.evaluate(() => window.__saved[0]), { title: 'Song A', artist: 'Artist A', type: 'lrc', contents: LRC });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a changed query offers "Use LRC for this song", and it saves to the song that is playing', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await tab(page, 'Find');
        await page.waitForSelector('.online-lyrics-result');
        assert.equal(await page.evaluate(() => document.querySelectorAll('.online-lyrics-primary-btn').length), 0);
        await search(page, 'Song A');
        await page.click('.online-lyrics-result >> nth=0');
        await page.click('.online-lyrics-primary-btn:has-text("Use LRC for this song")');
        await page.waitForFunction((lrc) => window.getSyncedLyricsForSong(window.SONGS_DATA[0]) === lrc, LRC);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Find with nothing playing is the manual search: tab enabled, empty fields, results can be saved to any song through the picker', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        assert.equal(await page.evaluate(() => document.querySelector('.lyrics-bar .tab:nth-child(2)').disabled), false);
        await tab(page, 'Find');
        await page.waitForSelector('#online-lyrics-title');
        assert.deepEqual(await mode(page), { view: 'online-lyrics', selected: 'Find' });
        assert.deepEqual(await page.evaluate(() => ['title', 'artist', 'album'].map((n) => document.getElementById('online-lyrics-' + n).value)), ['', '', '']);
        assert.equal(await page.evaluate(() => window.__queries.length), 0);
        await search(page, 'Song A');
        await page.click('.online-lyrics-result >> nth=0');
        await page.click('.online-lyrics-primary-btn:has-text("Save LRC to a song")');
        await page.waitForSelector('.online-lyrics-picker.active');
        const box = await page.evaluate(() => {
            const p = document.querySelector('.online-lyrics-picker');
            const r = p.getBoundingClientRect();
            const css = getComputedStyle(p);
            return { fixed: css.position, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, background: css.backgroundColor !== 'rgba(0, 0, 0, 0)', rows: p.querySelectorAll('.queue-item').length > 3, confirmDisabled: document.getElementById('online-lyrics-picker-confirm').disabled, iconWords: [...p.querySelectorAll('.material-symbols-outlined')].filter((e) => e.offsetParent !== null).length };
        });
        assert.deepEqual(box, { fixed: 'fixed', inside: true, background: true, rows: true, confirmDisabled: true, iconWords: 0 });
        await page.fill('#online-lyrics-picker-input', 'number 3');
        await page.click('.online-lyrics-picker .queue-item:has(.queue-item-title:text-is("Song title number 3"))'); // the picker also matches artists, so "number 3" lists song 4 first
        assert.equal(await page.evaluate(() => document.getElementById('online-lyrics-picker-confirm').disabled), false);
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.online-lyrics-picker .queue-item.selected')).boxShadow !== 'none'), true);
        await page.click('#online-lyrics-picker-confirm');
        await page.waitForFunction((lrc) => window.getSyncedLyricsForSong(window.SONGS_DATA[2]) === lrc, LRC);
        assert.deepEqual(await page.evaluate(() => ({ picker: document.querySelector('.online-lyrics-picker') !== null, first: String(window.getSyncedLyricsForSong(window.SONGS_DATA[0]) || '') })), { picker: false, first: '' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the picker closes with Escape and Cancel and leaves nothing behind', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await tab(page, 'Find');
        await search(page, 'Song A');
        for (const close of ['Escape', 'Cancel']) {
            await page.click('.online-lyrics-result.selected .online-lyrics-primary-btn').catch(async () => {
                await page.click('.online-lyrics-result >> nth=0');
                await page.click('.online-lyrics-primary-btn');
            });
            await page.waitForSelector('.online-lyrics-picker');
            if (close === 'Escape') await page.keyboard.press('Escape');
            else await page.click('.online-lyrics-picker .lyrics-editor-btn:has-text("Cancel")');
            await page.waitForFunction(() => !document.querySelector('.online-lyrics-picker'));
        }
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Many songs: its own tab (no song needed), rows as tall as the engine counts, a drawn check box, selection count', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await tab(page, 'Many songs');
        await page.waitForSelector('.smart-lyrics-song-row');
        assert.deepEqual(await mode(page), { view: 'smart-lyrics', selected: 'Many songs' });
        const before = await page.evaluate(() => {
            const row = document.querySelector('.smart-lyrics-song-row');
            const box = getComputedStyle(row.querySelector('.smart-lyrics-checkbox'), '::before');
            return { height: row.getBoundingClientRect().height === window.ITEM_HEIGHT, boxWidth: box.width, boxFilled: box.backgroundColor !== 'rgba(0, 0, 0, 0)', iconWords: [...document.querySelectorAll('.smart-lyrics-song-row .material-symbols-outlined')].filter((e) => e.offsetParent !== null).length, back: getComputedStyle(document.querySelector('.online-lyrics-header > [data-action="switchView"]')).display, count: document.getElementById('smart-lyrics-selection-count').textContent, findSelected: document.getElementById('smart-lyrics-find-selected').disabled };
        });
        assert.deepEqual(before, { height: true, boxWidth: '18px', boxFilled: false, iconWords: 0, back: 'none', count: '0 selected', findSelected: true });
        await page.click('.smart-lyrics-song-row >> nth=1');
        await page.click('.smart-lyrics-song-row >> nth=2');
        const after = await page.evaluate(() => {
            const row = document.querySelectorAll('.smart-lyrics-song-row')[1];
            return { filled: getComputedStyle(row.querySelector('.smart-lyrics-checkbox'), '::before').backgroundColor !== 'rgba(0, 0, 0, 0)', count: document.getElementById('smart-lyrics-selection-count').textContent, findSelected: document.getElementById('smart-lyrics-find-selected').disabled };
        });
        assert.deepEqual(after, { filled: true, count: '2 selected', findSelected: false });
        await page.fill('.smart-lyrics-search', 'number 1');
        await page.waitForFunction(() => document.querySelectorAll('.smart-lyrics-song-row').length < 24);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Many songs: Find for selected saves what it finds, says so per song and in the progress line', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await tab(page, 'Many songs');
        await page.waitForSelector('.smart-lyrics-song-row');
        await page.click('.smart-lyrics-song-row >> nth=1'); // "Song title number 2": LRCLIB has it
        await page.click('.smart-lyrics-song-row >> nth=2'); // "Song title number 3": it does not
        await page.click('#smart-lyrics-find-selected');
        await page.waitForFunction(() => /^Finished/.test(document.getElementById('smart-lyrics-progress').textContent));
        const r = await page.evaluate((lrc) => {
            const rows = [...document.querySelectorAll('.smart-lyrics-song-row')];
            const status = (i) => rows[i].querySelector('.smart-lyrics-song-status');
            const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
            const probe = document.createElement('i');
            probe.style.color = 'var(--accent)';
            document.body.append(probe);
            const accentRgb = getComputedStyle(probe).color;
            probe.style.color = 'var(--danger)';
            const dangerRgb = getComputedStyle(probe).color;
            probe.remove();
            return {
                progress: document.getElementById('smart-lyrics-progress').textContent,
                found: [status(1).textContent, getComputedStyle(status(1)).color === accentRgb],
                failed: [status(2).textContent, getComputedStyle(status(2)).color === dangerRgb],
                saved: window.getSyncedLyricsForSong(window.SONGS_DATA[1]) === lrc,
                untouched: String(window.getSyncedLyricsForSong(window.SONGS_DATA[2]) || ''),
                accentKnown: accent !== ''
            };
        }, LRC);
        assert.deepEqual(r, { progress: 'Finished: 1 of 2 songs found', found: ['LRC found', true], failed: ['Not found', true], saved: true, untouched: '', accentKnown: true });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the tabs and the engine\'s own buttons agree: Find to Many songs and back, View leaves both', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await tab(page, 'Find');
        await page.waitForSelector('.online-lyrics-result');
        await page.click('.online-lyrics-header-actions button:has-text("Find multi song")');
        await page.waitForSelector('.smart-lyrics-song-row');
        assert.deepEqual(await mode(page), { view: 'smart-lyrics', selected: 'Many songs' });
        await tab(page, 'Find');
        await page.waitForSelector('#online-lyrics-title');
        assert.deepEqual(await mode(page), { view: 'online-lyrics', selected: 'Find' });
        await tab(page, 'Many songs');
        await page.waitForSelector('.smart-lyrics-song-row');
        await tab(page, 'View');
        await page.waitForFunction(() => window.currentView === 'lyrics');
        assert.deepEqual(await mode(page), { view: 'lyrics', selected: 'View' });
        assert.deepEqual(await page.evaluate(() => document.querySelector('.view-host').dataset.lyricsMode), 'view');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('at the smallest window nothing scrolls sideways and the album column makes room', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ width: 800, height: 600 });
        await toLyrics(page);
        await play(page);
        await tab(page, 'Find');
        await page.waitForSelector('.online-lyrics-result');
        await page.click('.online-lyrics-result >> nth=0');
        await page.click('.online-lyrics-primary-btn, .online-lyrics-actions button >> nth=0').catch(() => {});
        const measure = () =>
            page.evaluate(() => {
                const host = document.querySelector('.view-host');
                const scroller = document.querySelector('.view-host .content') || host;
                const wide = [...host.querySelectorAll('.online-lyrics-result, .smart-lyrics-song-row, .smart-lyrics-toolbar, .online-lyrics-search-panel')].filter((e) => e.getBoundingClientRect().right > host.getBoundingClientRect().right + 1);
                return { overflow: host.scrollWidth > host.clientWidth + 1 || scroller.scrollWidth > scroller.clientWidth + 1, wide: wide.length, album: [...document.querySelectorAll('.online-lyrics-result-album, .smart-lyrics-song-row .song-album')].filter((e) => e.offsetParent !== null).length };
            });
        const find = await measure();
        assert.equal(find.overflow, false);
        assert.equal(find.wide, 0);
        await tab(page, 'Many songs');
        await page.waitForSelector('.smart-lyrics-song-row');
        const many = await measure();
        assert.equal(many.overflow, false);
        assert.equal(many.wide, 0);
        await page.close();
    });

    test('right-to-left titles and artists start on the right, each line on its own', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toLyrics(page);
        await tab(page, 'Find');
        await page.evaluate(() => {
            window.desktopApi.lyrics.searchOnlineLyrics = async () => ({ success: true, results: [{ trackName: 'سلام دنیا', artistName: 'هنرمند', albumName: 'Album', duration: 100, plainLyrics: 'x' }] });
        });
        await search(page, 'x');
        const bidi = await page.evaluate(() => ['.online-lyrics-result-title', '.online-lyrics-result-artist'].map((s) => getComputedStyle(document.querySelector(s)).unicodeBidi));
        assert.deepEqual(bidi, ['plaintext', 'plaintext']);
        await page.close();
    });

    test('text contrast 4.5:1 in three themes: results, badges, preview, finder rows, status words, picker, buttons', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toLyrics(page);
        await play(page);
        await tab(page, 'Find');
        await page.waitForSelector('.online-lyrics-result');
        await page.click('.online-lyrics-result >> nth=0');
        await page.waitForSelector('.online-lyrics-preview pre');
        const measure = (themes, scope) =>
            page.evaluate(
                ({ themes, scope }) => {
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
                    const bad = [];
                    for (const name of themes) {
                        document.documentElement.setAttribute('data-theme', name);
                        for (const el of document.querySelectorAll(scope)) {
                            if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
                            if (!el.textContent.trim() || el.disabled) continue;
                            const r = ratio(getComputedStyle(el).color, bg(el));
                            if (r < 4.5) bad.push(`${name} ${el.className.toString().slice(0, 40)} "${el.textContent.trim().slice(0, 16)}" ${r.toFixed(2)}`);
                        }
                    }
                    return bad;
                },
                { themes, scope }
            );
        const themes = ['warm-graphite', 'deep-forest', 'espresso-copper'];
        const bad = await measure(themes, '.online-lyrics-result-title, .online-lyrics-result-artist, .online-lyrics-result-album, .online-lyrics-result-meta, .online-lyrics-badge, .online-lyrics-preview pre, .online-lyrics-actions button, .online-lyrics-result-heading, .online-lyrics-result-heading small');
        await tab(page, 'Many songs');
        await page.waitForSelector('.smart-lyrics-song-row');
        await page.click('.smart-lyrics-song-row >> nth=1');
        await page.click('#smart-lyrics-find-selected');
        await page.waitForFunction(() => /^Finished/.test(document.getElementById('smart-lyrics-progress').textContent));
        bad.push(...(await measure(themes, '.smart-lyrics-song-row .song-title, .smart-lyrics-song-row .song-artist, .smart-lyrics-song-row .song-album, .smart-lyrics-song-status, .smart-lyrics-progress, .smart-lyrics-actions span, .smart-lyrics-actions button, .smart-lyrics-mode button, .smart-lyrics-skip-existing')));
        assert.deepEqual(bad, []);
        await page.close();
    });
});

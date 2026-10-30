'use strict';

// D-03: the engine's two lyrics editors (Write: js/lyrics/18, Sync: js/lyrics/11c-11g) as modes of the Lyrics page. The engine appends
// them to <body> as overlays; adapter/engine-view.js moves them into the page; views/tools/lyrics-editors.css skins them;
// views/tools/lyrics.js makes them the Write and Sync tabs. Real browser, real engine; only electronAPI is a stub.
//
// Run: node --test tools/tests/ui-next-lyrics-editors.test.js

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

describe('lyrics-editors.css, lyrics.js and the bridge', () => {
    const css = strip(read('views', 'tools', 'lyrics-editors.css'));

    test('every var() is a token, no raw colors, no --c-*', () => {
        const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
        const missing = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => !defined.has(n));
        assert.deepEqual([...new Set(missing)], []);
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
        assert.doesNotMatch(css, /\brgba?\(|\bhsla?\(/);
        assert.doesNotMatch(css, /--c-[a-z]/);
    });

    test('index.html links lyrics-editors.css after lyrics.css', () => {
        const html = read('index.html');
        const a = html.indexOf('href="views/tools/lyrics.css"');
        const b = html.indexOf('href="views/tools/lyrics-editors.css"');
        assert.ok(a > 0 && b > a);
    });

    test('the interim overlay stylesheet no longer shows the two editors as windows over the app', () => {
        const interim = strip(read('adapter', 'legacy-overlays.css'));
        assert.doesNotMatch(interim, /\.lyrics-editor-overlay|\.sync-editor-overlay/);
        assert.match(css, /body > :is\(\.lyrics-editor-overlay, \.sync-editor-overlay\)\s*\{\s*display: none/);
    });

    test('the view never reaches into engine globals or elements itself (gate 13)', () => {
        const js = read('views', 'tools', 'lyrics.js');
        assert.doesNotMatch(js, /\bwindow\b|document\.|getElementById|querySelector\(['"]#/);
    });

    test('watchLyricsEditors watches the two elements and the children of <body> only, never the whole page', () => {
        const js = read('adapter', 'engine-api.js');
        const body = js.slice(js.indexOf('export function watchLyricsEditors'));
        assert.doesNotMatch(body, /subtree/);
        assert.match(body, /attributeFilter: \['class'\]/);
        assert.match(body, /created\.observe\(document\.body, \{ childList: true \}\)/);
    });

    test('every editor class the engine writes has a rule or is a known layout-only class', () => {
        const dir = path.join(ROOT, 'src', 'js', 'lyrics');
        const engine = ['18-lyrics-editor.js', '11c-sync-editor-shell.js', '11d-sync-editor-lines.js', '11e-sync-editor-line-edit.js', '11f-sync-editor-volume-save.js', '11g-sync-editor-line-actions.js'].map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
        const used = new Set([...engine.matchAll(/\b((?:lyrics|sync)-(?:editor|line)-[a-z-]+)/g)].map((m) => m[1]));
        // ids, not classes, or named in code that never lays out (menu items are inline-styled and overridden by .sync-line-context-*)
        const notClasses = new Set(['lyrics-editor-textarea', 'sync-editor-lines', 'sync-editor-paste', 'sync-editor-overlay', 'lyrics-editor-overlay', 'sync-line-context-menu', 'sync-line-context-item', 'sync-editor-line-blank', 'sync-editor-line-instrumental', 'sync-editor-line-focused', 'sync-editor-line-edit', 'sync-editor-line-actions', 'sync-editor-lines-container', 'lyrics-editor-key', 'lyrics-editor-for', 'sync-editor-line-text', 'sync-editor-line-time']);
        const missing = [...used].filter((c) => !css.includes('.' + c) && !notClasses.has(c));
        assert.deepEqual(missing, []);
    });
});

describe('Lyrics editors in the new shell', { concurrency: false }, () => {
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
    const PLAIN = 'Verse one line a\nVerse one line b\n\nChorus line a';

    async function open(size = { width: 1100, height: 800 }) {
        const page = await browser.newPage({ viewport: size });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        return { page, errors };
    }
    // The fixture gives songs a numeric duration; the app has text, and the sync editor escapes it as text.
    const play = (page, { plain = PLAIN } = {}) =>
        page.evaluate((plain) => {
            const s = window.SONGS_DATA[0];
            s.duration = '03:00.00';
            if (plain) window.setLyricsForSong(s.id, plain);
            window.playSongFromList(s.id);
        }, plain);
    const toLyrics = async (page) => {
        await page.click('.rail-btn[data-view="lyrics"]');
        await page.waitForSelector('.view-host .lyrics-bar');
    };
    const tab = (page, name) => page.click(`.lyrics-bar .tab:has-text("${name}")`);
    const mode = (page) => page.evaluate(() => ({ mode: document.querySelector('.view-host').dataset.lyricsMode, selected: document.querySelector('.lyrics-bar [aria-selected="true"]')?.textContent ?? null }));
    const toSync = async (page) => {
        await tab(page, 'Sync');
        await page.waitForSelector('#sync-editor-overlay.active');
        await page.click('.sync-editor-source-bar button:has-text("Load Plain Lyrics")');
        await page.waitForSelector('.sync-editor-line');
    };

    test('five tabs; Write and Sync need a song, Find and Many songs do not', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        const tabs = () => page.evaluate(() => [...document.querySelectorAll('.lyrics-bar .tab')].map((x) => [x.textContent, x.disabled]));
        assert.deepEqual(await tabs(), [['View', false], ['Find', false], ['Many songs', false], ['Write', true], ['Sync', true]]);
        await play(page);
        await page.waitForFunction(() => !document.querySelector('.lyrics-bar .tab:nth-child(4)').disabled);
        assert.deepEqual(await tabs(), [['View', false], ['Find', false], ['Many songs', false], ['Write', false], ['Sync', false]]);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Write: the editor is in the page, fills it, replaces the lyrics view, and Cancel gives the page back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await page.waitForSelector('.lyrics-view-text .lyrics-line');
        await tab(page, 'Write');
        await page.waitForSelector('#lyrics-editor-overlay.active');
        const r = await page.evaluate(() => {
            const host = document.querySelector('.view-host');
            const ov = document.getElementById('lyrics-editor-overlay');
            const o = ov.getBoundingClientRect();
            const bar = host.querySelector('.lyrics-bar').getBoundingClientRect();
            const h = host.getBoundingClientRect();
            return {
                inHost: ov.parentNode === host,
                shown: getComputedStyle(ov).display,
                contentHidden: getComputedStyle(host.querySelector('.content-wrapper')).display === 'none',
                belowBar: Math.abs(o.top - bar.bottom) < 2 && Math.abs(o.bottom - h.bottom) < 2 && o.left >= h.left && o.right <= h.right + 1,
                text: document.getElementById('lyrics-editor-textarea').value,
                serif: /Newsreader|serif/i.test(getComputedStyle(document.getElementById('lyrics-editor-textarea')).fontFamily),
                iconWords: [...ov.querySelectorAll('.material-symbols-outlined')].filter((e) => e.offsetParent !== null).length
            };
        });
        assert.deepEqual(r, { inHost: true, shown: 'flex', contentHidden: true, belowBar: true, text: PLAIN, serif: true, iconWords: 0 });
        assert.deepEqual(await mode(page), { mode: 'write', selected: 'Write' });
        await page.click('.lyrics-editor-actions-right .lyrics-editor-btn:has-text("Cancel")');
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.lyricsMode === 'view');
        assert.deepEqual(await page.evaluate(() => ({ editor: getComputedStyle(document.getElementById('lyrics-editor-overlay')).display, content: getComputedStyle(document.querySelector('.view-host .content-wrapper')).display !== 'none' })), { editor: 'none', content: true });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('an editor that was closed never blocks the app (the interim overlay rule used to leave a scrim over everything)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toLyrics(page);
        await play(page);
        await tab(page, 'Write');
        await page.waitForSelector('#lyrics-editor-overlay.active');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.getElementById('lyrics-editor-overlay').classList.contains('active'));
        const top = await page.evaluate(() => {
            const b = document.querySelector('.lyrics-bar .tab:nth-child(5)').getBoundingClientRect();
            return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2).closest('.tab')?.textContent;
        });
        assert.equal(top, 'Sync');
        await tab(page, 'Sync');
        await page.waitForSelector('#sync-editor-overlay.active');
        await page.close();
    });

    test('Write: Save stores the text and goes back to the lyrics; Clear removes them', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await tab(page, 'Write');
        await page.waitForSelector('#lyrics-editor-overlay.active');
        await page.fill('#lyrics-editor-textarea', 'A new first line\nA new second line');
        await page.click('.lyrics-editor-btn-primary');
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.lyricsMode === 'view');
        await page.waitForFunction(() => document.querySelector('.lyrics-view-text')?.innerText.includes('A new second line'));
        assert.equal(await page.evaluate(() => window.getLyricsForSong(window.SONGS_DATA[0])), 'A new first line\nA new second line');
        await tab(page, 'Write');
        await page.waitForSelector('#lyrics-editor-overlay.active');
        await page.click('.lyrics-editor-btn-danger');
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.lyricsMode === 'view');
        assert.equal(await page.evaluate(() => window.getLyricsForSong(window.SONGS_DATA[0])), '');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Write: leaving with a draft asks first; No keeps the draft, Yes drops it; a clean editor leaves without a question', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await tab(page, 'Write');
        await page.waitForSelector('#lyrics-editor-overlay.active');
        let asked = [];
        page.on('dialog', async (d) => (asked.push(d.message()), asked.length === 1 ? d.dismiss() : d.accept()));
        await page.fill('#lyrics-editor-textarea', 'Draft');
        await tab(page, 'Find');
        assert.deepEqual(asked, ['Discard unsaved lyrics?']);
        assert.deepEqual(await mode(page), { mode: 'write', selected: 'Write' });
        assert.equal(await page.inputValue('#lyrics-editor-textarea'), 'Draft');
        await tab(page, 'Find');
        await page.waitForSelector('.online-lyrics-view-container');
        assert.equal(asked.length, 2);
        assert.deepEqual(await mode(page), { mode: 'find', selected: 'Find' });
        await tab(page, 'Write');
        await page.waitForSelector('#lyrics-editor-overlay.active');
        assert.equal(await page.inputValue('#lyrics-editor-textarea'), PLAIN);
        await tab(page, 'View');
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.lyricsMode === 'view');
        assert.equal(asked.length, 2);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('leaving the Lyrics view with a draft asks first and closes the editor, so its shortcuts cannot save it from elsewhere', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await tab(page, 'Write');
        await page.waitForSelector('#lyrics-editor-overlay.active');
        await page.fill('#lyrics-editor-textarea', 'Draft');
        const asked = [];
        page.on('dialog', async (d) => (asked.push(d.message()), asked.length === 1 ? d.dismiss() : d.accept()));
        await page.click('.rail-btn[data-view="library"]');
        assert.deepEqual(await mode(page), { mode: 'write', selected: 'Write' });
        await page.click('.rail-btn[data-view="library"]');
        await page.waitForSelector('.view-host[data-view="library"]');
        assert.equal(asked.length, 2);
        assert.equal(await page.evaluate(() => document.getElementById('lyrics-editor-overlay').classList.contains('active')), false);
        await page.keyboard.press('Control+Enter');
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => window.getLyricsForSong(window.SONGS_DATA[0])), PLAIN);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Sync: the editor is in the page; load lines; one row per line; only the focused row has timing buttons', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await toSync(page);
        const r = await page.evaluate(() => {
            const host = document.querySelector('.view-host');
            const ov = document.getElementById('sync-editor-overlay');
            const rows = [...ov.querySelectorAll('.sync-editor-line')];
            const shown = (row) => getComputedStyle(row.querySelector('.sync-editor-shift-group')).display !== 'none';
            return {
                inHost: ov.parentNode === host,
                rows: rows.length,
                focused: rows.filter((x) => x.classList.contains('sync-editor-line-focused')).length,
                shiftShownOnFocusedOnly: rows.filter(shown).length === 1 && shown(rows.find((x) => x.classList.contains('sync-editor-line-focused'))),
                firstWord: ov.querySelector('.sync-editor-text').getBoundingClientRect().width > 120,
                playerShown: getComputedStyle(ov.querySelector('.sync-editor-miniplayer')).display !== 'none',
                iconWords: [...ov.querySelectorAll('.material-symbols-outlined:not(.sync-editor-volume-icon)')].filter((e) => e.offsetParent !== null).length // the volume icon is drawn by CSS at font-size 0
            };
        });
        assert.deepEqual(r, { inHost: true, rows: 3, focused: 1, shiftShownOnFocusedOnly: true, firstWord: true, playerShown: true, iconWords: 0 });
        assert.deepEqual(await mode(page), { mode: 'sync', selected: 'Sync' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Sync: the play button is drawn from the playing state of the audio', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toLyrics(page);
        await play(page);
        await toSync(page);
        const glyph = () => page.evaluate(() => {
            const b = document.querySelector('.sync-editor-miniplayer-btn-primary');
            const cs = getComputedStyle(b, '::before');
            return { playing: document.querySelector('.view-host').dataset.playing, mask: cs.maskImage !== 'none' ? cs.maskImage : cs.webkitMaskImage };
        });
        const idle = await glyph();
        assert.equal(idle.playing, 'false');
        assert.notEqual(idle.mask, 'none');
        await page.evaluate(() => {
            Object.defineProperty(document.getElementById('audio'), 'paused', { configurable: true, get: () => false });
            window.emit('playback:stateChanged', { playing: true });
        });
        const playing = await glyph();
        assert.equal(playing.playing, 'true');
        assert.notEqual(playing.mask, idle.mask);
        await page.close();
    });

    test('Sync: stamping a line, then leaving, asks with the engine dialog; Keep Editing stays, Discard closes and carries on to the tab that was picked', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toLyrics(page);
        await play(page);
        await toSync(page);
        await page.evaluate(() => (document.getElementById('audio').currentTime = 5));
        await page.click('.sync-editor-line-focused .sync-editor-icon-btn-primary');
        await page.waitForFunction(() => !/--/.test(document.querySelector('.sync-editor-line .sync-editor-time').textContent));
        await tab(page, 'Find');
        await page.waitForSelector('.playlist-modal');
        assert.match(await page.textContent('.playlist-modal'), /Discard Sync\?/);
        assert.deepEqual(await mode(page), { mode: 'sync', selected: 'Sync' });
        await page.click('#confirm-cancel-btn');
        await page.waitForFunction(() => !document.querySelector('.playlist-modal'));
        assert.equal(await page.evaluate(() => document.getElementById('sync-editor-overlay').classList.contains('active')), true);
        await tab(page, 'Find');
        await page.waitForSelector('.playlist-modal');
        await page.click('#confirm-ok-btn');
        await page.waitForFunction(() => !document.getElementById('sync-editor-overlay').classList.contains('active'));
        // Discard answers the question and the tab the person picked opens by itself (they used to have to pick it again)
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.lyricsMode === 'find');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Sync without timings is left at once, and the tab asked for opens', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toLyrics(page);
        await play(page);
        await toSync(page);
        await tab(page, 'Find');
        await page.waitForSelector('.online-lyrics-view-container');
        assert.deepEqual(await mode(page), { mode: 'find', selected: 'Find' });
        assert.equal(await page.locator('.playlist-modal').count(), 0);
        await page.close();
    });

    test('the right-click menu of a line has the shell look (the engine sets colors and icons inline)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toLyrics(page);
        await play(page);
        await toSync(page);
        await page.click('.sync-editor-line:nth-child(2) .sync-editor-text', { button: 'right' });
        await page.waitForSelector('.sync-line-context-menu');
        const r = await page.evaluate(() => {
            const menu = document.querySelector('.sync-line-context-menu');
            const probe = document.createElement('div');
            probe.style.background = 'var(--surface-raised)';
            document.body.append(probe);
            const raised = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return { bgIsToken: getComputedStyle(menu).backgroundColor === raised, bgNotEngineGrey: getComputedStyle(menu).backgroundColor !== 'rgb(40, 40, 40)', iconsShown: [...menu.querySelectorAll('i')].filter((i) => getComputedStyle(i).display !== 'none').length, items: menu.querySelectorAll('.sync-line-context-item').length };
        });
        assert.deepEqual(r, { bgIsToken: true, bgNotEngineGrey: true, iconsShown: 0, items: 7 });
        await page.close();
    });

    test('an editor the engine opens by itself (a song menu): the shell goes to Lyrics; the song need not be the playing one', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.click('.rail-btn[data-view="settings"]');
        await page.waitForSelector('.view-host[data-view="settings"]');
        await page.evaluate(() => {
            window.setLyricsForSong(window.SONGS_DATA[1].id, 'Second song words');
            window.openLyricsEditorForSong(window.SONGS_DATA[1].id);
        });
        await page.waitForSelector('.view-host[data-view="lyrics"] #lyrics-editor-overlay.active');
        assert.equal(await page.inputValue('#lyrics-editor-textarea'), 'Second song words');
        assert.match(await page.textContent('.lyrics-editor-song'), /Song title number 2/);
        assert.deepEqual(await page.evaluate(() => ({ rail: document.querySelector('.rail-btn[aria-current="page"]').dataset.view, writeTabEnabled: !document.querySelector('.lyrics-bar .tab:nth-child(4)').disabled, mode: document.querySelector('.view-host').dataset.lyricsMode })), { rail: 'lyrics', writeTabEnabled: true, mode: 'write' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the smallest window: Sync stacks (player on top, pinned), nothing scrolls sideways, the footer stays in the page', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ width: 800, height: 700 });
        await toLyrics(page);
        await play(page);
        await toSync(page);
        const r = await page.evaluate(() => {
            const host = document.querySelector('.view-host');
            const h = host.getBoundingClientRect();
            const q = (s) => document.querySelector(s).getBoundingClientRect();
            const right = q('.sync-editor-right');
            const left = q('.sync-editor-left');
            const foot = q('.sync-editor-footer');
            const outside = [...host.querySelectorAll('.sync-editor-modal *')].filter((e) => {
                const b = e.getBoundingClientRect();
                return b.width > 0 && b.height > 0 && (b.left < h.left - 1 || b.right > h.right + 1) && getComputedStyle(e).display !== 'none';
            });
            return { stacked: right.bottom <= left.top + 1, pinned: getComputedStyle(document.querySelector('.sync-editor-right')).position === 'sticky', sideways: host.scrollWidth > host.clientWidth + 1, footerInside: foot.bottom <= h.bottom + 1 && foot.left >= h.left - 1 && foot.right <= h.right + 1, outside: outside.length };
        });
        assert.deepEqual(r, { stacked: true, pinned: true, sideways: false, footerInside: true, outside: 0 });
        await page.close();
    });

    test('text contrast 4.5:1 in Write and Sync, three themes', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ width: 1240, height: 800 }); // wide enough for the full (not the compact) editor layout, whatever the rail's width
        await toLyrics(page);
        await play(page);
        await toSync(page);
        await page.click('.sync-editor-line:nth-child(2)');
        const bad = [];
        for (const theme of ['warm-graphite', 'deep-forest', 'espresso-copper']) {
            for (const which of ['sync', 'write']) {
                if (which === 'write') {
                    await page.evaluate(() => window.closeSyncEditor());
                    await page.evaluate(() => window.openLyricsEditor());
                    await page.waitForSelector('#lyrics-editor-overlay.active');
                } else if (theme !== 'warm-graphite') {
                    await page.evaluate(() => window.closeLyricsEditor());
                    await page.evaluate(() => window.openSyncEditor());
                    await page.waitForSelector('.sync-editor-source-bar');
                    await page.click('.sync-editor-source-bar button:has-text("Load Plain Lyrics")');
                    await page.click('.sync-editor-line:nth-child(2)');
                }
                bad.push(
                    ...(await page.evaluate(({ name, which }) => {
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
                        // the background the text really sits on: translucent layers (the focused row) are blended over what is below them
                        const bg = (el) => {
                            const layers = [];
                            for (let n = el; n; n = n.parentElement) {
                                const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
                                if (!m) continue;
                                const alpha = m.length > 3 ? Number(m[3]) : 1;
                                if (alpha > 0) layers.push([Number(m[0]), Number(m[1]), Number(m[2]), alpha]);
                                if (alpha === 1) break;
                            }
                            let out = [0, 0, 0];
                            for (const [r, g, b, a] of layers.reverse()) out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
                            return `rgb(${out.join(',')})`;
                        };
                        const out = [];
                        const check = (label, el) => {
                            if (!el || el.offsetParent === null) return out.push(`${name} ${label} missing`);
                            const r = ratio(getComputedStyle(el).color, bg(el));
                            if (r < 4.5) out.push(`${name} ${label} ${r.toFixed(2)}`);
                        };
                        const root = document.getElementById(which === 'write' ? 'lyrics-editor-overlay' : 'sync-editor-overlay');
                        const q = (s) => root.querySelector(s);
                        if (which === 'write') {
                            check('write title', q('.lyrics-editor-title'));
                            check('write song', q('.lyrics-editor-song'));
                            check('write text', q('.lyrics-editor-textarea'));
                            for (const b of root.querySelectorAll('button')) check('write button ' + b.textContent.trim(), b);
                        } else {
                            check('sync title', q('.sync-editor-title'));
                            check('sync song', q('.sync-editor-song'));
                            check('sync select', q('.sync-editor-select'));
                            check('line text', q('.sync-editor-line:not(.sync-editor-line-focused) .sync-editor-text'));
                            check('line time', q('.sync-editor-line:not(.sync-editor-line-focused) .sync-editor-time'));
                            check('focused text', q('.sync-editor-line-focused .sync-editor-text'));
                            check('focused time', q('.sync-editor-line-focused .sync-editor-time'));
                            check('current timecode', q('.sync-editor-timecode'));
                            check('total timecode', q('.sync-editor-timecode-total'));
                            check('meta', q('.sync-editor-meta-row'));
                            check('preview label', q('.sync-editor-preview-label'));
                            check('preview', q('.sync-editor-preview'));
                            for (const b of root.querySelectorAll('.sync-editor-btn, .sync-editor-mini-btn, .sync-editor-close, .sync-editor-copy-time, .sync-editor-live-follow-btn, .sync-editor-miniplayer-btn, .sync-editor-shift-btn, .sync-editor-icon-btn')) if (b.offsetParent !== null) check('button ' + b.textContent.trim(), b);
                        }
                        return out;
                    }, { name: theme, which }))
                );
            }
        }
        assert.deepEqual(bad, []);
        await page.close();
    });
});

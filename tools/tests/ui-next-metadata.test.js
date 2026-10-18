'use strict';

// D-04: the engine's metadata editor shown in the new shell. The engine builds the form (js/library/20-metadata-editor.js) in its
// right panel; adapter/engine-view.js moves that tab into the view host; views/tools/metadata.css skins it; views/tools/metadata.js
// adds the empty state, following the song and the unsaved-changes guard. Real browser, real engine; only electronAPI is a stub.
//
// Run: node --test tools/tests/ui-next-metadata.test.js

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

describe('metadata.css, metadata.js and the bridge', () => {
    const css = strip(read('views', 'tools', 'metadata.css'));

    test('every var() is a token, no raw colors, no --c-*', () => {
        const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
        const missing = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => !defined.has(n));
        assert.deepEqual([...new Set(missing)], []);
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
        assert.doesNotMatch(css, /\brgba?\(|\bhsla?\(/);
        assert.doesNotMatch(css, /--c-[a-z]/);
    });

    test('index.html links metadata.css after lyrics.css', () => {
        const html = read('index.html');
        const a = html.indexOf('href="views/tools/lyrics.css"');
        const b = html.indexOf('href="views/tools/metadata.css"');
        assert.ok(a > 0 && b > a);
    });

    test('the view never reaches into engine globals or elements itself (gate 13)', () => {
        const js = read('views', 'tools', 'metadata.js');
        assert.doesNotMatch(js, /\bwindow\b|document\.|getElementById|querySelector\(['"]#/);
        assert.match(js, /from '..\/..\/adapter\/engine-api\.js'/);
    });

    test('the engine-api allow-list has the tab event, and the adapter provides the container the engine renders into', () => {
        assert.match(read('adapter', 'engine-api.js'), /'rightPanel:tabChanged'/);
        assert.match(read('adapter', 'legacy-dom-adapter.js'), /div#metadata-editor-content\.metadata-editor-content/);
    });

    test('every metadata class the engine writes has a rule or is a known layout-only class', () => {
        const engine = fs.readFileSync(path.join(ROOT, 'src', 'js', 'library', '20-metadata-editor.js'), 'utf8');
        const used = new Set([...engine.matchAll(/class=\\?"([^"\\]+)\\?"/g)].flatMap((m) => m[1].split(' ')).filter((c) => /^metadata-/.test(c)));
        // styled through a parent selector (the actions bar's buttons, the grid section)
        const layoutOnly = new Set(['metadata-editor-content', 'metadata-multi-input', 'metadata-editor-cancel', 'metadata-other-section']);
        const missing = [...used].filter((c) => !css.includes('.' + c) && !layoutOnly.has(c));
        assert.deepEqual(missing, []);
    });
});

describe('Metadata in the new shell', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(window.__api&&window.__api[k])||((...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);}) });</script>\n`;
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    // What the main process would answer. Every call is logged in window.__calls.
    const API = () => {
        const calls = (window.__calls = []);
        const log = (name, fn) => async (arg) => (calls.push([name, JSON.parse(JSON.stringify(arg === undefined ? null : arg))]), fn(arg));
        window.__api = {
            getAudioMetadata: log('get', async (url) => {
                if (window.__failRead) throw new Error('disk on fire');
                const song = window.SONGS_DATA.find((s) => s.url === url) || {};
                return { success: true, metadata: { title: song.title, artist: ['Artist 0', 'Guest Artist'], album: 'Album 0', albumArtist: ['Artist 0'], genre: ['Rock'], year: '2019', track: '3', comment: 'one\ntwo', otherTags: [{ key: 'ENCODER', values: ['LAME 3.100'] }] } };
            }),
            saveAudioMetadata: log('save', async (o) => ({ success: true, metadata: o.metadata, skipped: [] })),
            searchOnlineMetadata: log('search', async () => ({ success: true, results: [{ id: 'rec1', title: 'Found it', artist: 'Artist 0', firstReleaseDate: '2019-05-01', releases: [{ id: 'r1', title: 'Album 0', date: '2019-05-01', country: 'US' }, { id: 'r2', title: 'Album 0 (Deluxe)', date: '2020-01-10', country: 'GB' }] }] })),
            getOnlineMetadata: log('online', async () => ({ success: true, metadata: { album: 'Album 0 (Deluxe)' } })),
            exportAudioMetadataJson: log('export', async () => ({ success: true })),
            importAudioMetadataJson: log('import', async () => ({ success: false, canceled: true })),
            chooseCoverImage: log('cover', async () => ({ success: false, canceled: true }))
        };
    };

    async function open(size = { width: 1100, height: 800 }) {
        const page = await browser.newPage({ viewport: size });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.addInitScript(`(${API.toString()})()`);
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        return { page, errors };
    }
    const play = (page, index = 0) => page.evaluate((i) => window.playSongFromList(window.SONGS_DATA[i].id), index);
    const toMetadata = async (page) => {
        await page.click('.rail-btn[data-view="metadata"]');
        await page.waitForSelector('.view-host[data-view="metadata"]');
    };
    const calls = (page, name) => page.evaluate((n) => window.__calls.filter((c) => c[0] === n).map((c) => c[1]), name);
    const state = (page) =>
        page.evaluate(() => ({
            rail: document.querySelector('.rail-btn[aria-current="page"]')?.dataset.view,
            host: document.querySelector('.view-host').dataset.view,
            panelInHost: document.querySelector('.view-host').contains(document.getElementById('metadata-content')),
            panelInLegacy: document.getElementById('legacy-host').contains(document.getElementById('metadata-content'))
        }));

    test('nothing playing: the panel is in the host but hidden, the empty state is shown; a song that starts opens the editor', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toMetadata(page);
        const r = await page.evaluate(() => {
            const host = document.querySelector('.view-host');
            return {
                mode: host.dataset.metadata,
                panelHidden: getComputedStyle(document.getElementById('metadata-content')).display === 'none',
                emptyShown: !host.querySelector('.empty-state').hidden && host.querySelector('.empty-state__title').textContent
            };
        });
        assert.deepEqual(r, { mode: 'empty', panelHidden: true, emptyShown: 'No song playing' });
        await play(page);
        await page.waitForSelector('.metadata-editor-fields input[data-metadata-key="title"]');
        assert.equal(await page.inputValue('input[data-metadata-key="title"]'), 'Song title number 1');
        assert.equal(await page.evaluate(() => document.querySelector('.view-host').dataset.metadata), 'editing');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a song is playing: the form is filled from the file, chips for several values, Save waits for a change', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await play(page);
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        const r = await page.evaluate(() => ({
            title: document.querySelector('input[data-metadata-key="title"]').value,
            artists: [...document.querySelectorAll('.metadata-multi[data-metadata-key="artist"] .metadata-multi-chip')].map((c) => c.firstChild.textContent),
            year: document.querySelector('input[data-metadata-key="year"]').value,
            saveDisabled: document.getElementById('metadata-editor-save').disabled,
            iconWordsVisible: [...document.querySelectorAll('.view-host .material-symbols-outlined')].filter((e) => e.offsetParent !== null).length,
            sameNode: document.getElementById('metadata-content').parentNode === document.querySelector('.view-host')
        }));
        assert.deepEqual(r, { title: 'Song title number 1', artists: ['Artist 0', 'Guest Artist'], year: '2019', saveDisabled: true, iconWordsVisible: 0, sameNode: true });
        await page.fill('input[data-metadata-key="title"]', 'A new title');
        assert.equal(await page.evaluate(() => document.getElementById('metadata-editor-save').disabled), false);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Save sends only what changed, then the shell goes back to the view the person came from and gives the panel back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await play(page);
        await page.click('.rail-btn[data-view="lyrics"]');
        await page.waitForSelector('.view-host .lyrics-bar');
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        await page.fill('input[data-metadata-key="title"]', 'A new title');
        await page.click('#metadata-editor-save');
        await page.waitForSelector('.view-host[data-view="lyrics"]');
        const saved = await calls(page, 'save');
        assert.equal(saved.length, 1);
        assert.deepEqual(saved[0].metadata, { title: 'A new title' });
        assert.deepEqual(await state(page), { rail: 'lyrics', host: 'lyrics', panelInHost: false, panelInLegacy: true });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Back and Cancel on a clean form return to the previous view', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await play(page);
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        await page.click('.metadata-editor-back');
        await page.waitForSelector('.view-host[data-view="library"]');
        assert.deepEqual(await state(page), { rail: 'library', host: 'library', panelInHost: false, panelInLegacy: true });
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        await page.click('.metadata-editor-cancel');
        await page.waitForSelector('.view-host[data-view="library"]');
        assert.equal((await state(page)).panelInLegacy, true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('leaving with unsaved changes asks first: No stays with the text, Yes leaves and closes the editor', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await play(page);
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        await page.fill('input[data-metadata-key="title"]', 'Draft');
        const asked = [];
        page.once('dialog', (d) => (asked.push(d.message()), d.dismiss()));
        await page.click('.rail-btn[data-view="library"]');
        assert.deepEqual(asked, ['Discard unsaved metadata changes?']);
        assert.deepEqual(await state(page), { rail: 'metadata', host: 'metadata', panelInHost: true, panelInLegacy: false });
        assert.equal(await page.inputValue('input[data-metadata-key="title"]'), 'Draft');
        page.once('dialog', (d) => d.accept());
        await page.click('.rail-btn[data-view="library"]');
        await page.waitForSelector('.view-host[data-view="library"]');
        assert.deepEqual(await state(page), { rail: 'library', host: 'library', panelInHost: false, panelInLegacy: true });
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        assert.equal(await page.inputValue('input[data-metadata-key="title"]'), 'Song title number 1');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('choosing Metadata again while on it keeps the unsaved text', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await play(page);
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        await page.fill('input[data-metadata-key="title"]', 'Draft');
        await page.click('.rail-btn[data-view="metadata"]');
        await page.waitForTimeout(300);
        assert.equal(await page.inputValue('input[data-metadata-key="title"]'), 'Draft');
        assert.equal((await calls(page, 'get')).length, 1);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a clean form is left without a question', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await play(page);
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        let asked = 0;
        page.on('dialog', (d) => (asked++, d.dismiss()));
        await page.click('.rail-btn[data-view="settings"]');
        await page.waitForSelector('.view-host[data-view="settings"]');
        assert.equal(asked, 0);
        await page.close();
    });

    test('the engine opens the editor by itself (a song menu does): the shell goes to Metadata once, without opening it twice', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await play(page);
        await page.evaluate(() => window.openMetadataEditor());
        await page.waitForSelector('.view-host[data-view="metadata"] input[data-metadata-key="title"]');
        assert.deepEqual(await state(page), { rail: 'metadata', host: 'metadata', panelInHost: true, panelInLegacy: false });
        assert.equal((await calls(page, 'get')).length, 1);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a new song reloads a clean form, but never replaces a form with unsaved changes', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await play(page, 0);
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        await play(page, 1);
        await page.waitForFunction(() => document.querySelector('input[data-metadata-key="title"]')?.value === 'Song title number 2');
        await page.fill('input[data-metadata-key="title"]', 'Draft');
        await play(page, 2);
        await page.waitForTimeout(400);
        assert.equal(await page.inputValue('input[data-metadata-key="title"]'), 'Draft');
        assert.equal((await calls(page, 'get')).length, 2);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('adding and removing a value in a multi-value field; Enter adds', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await play(page);
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        const input = '.metadata-multi[data-metadata-key="genre"] .metadata-multi-input';
        await page.fill(input, 'Indie');
        await page.press(input, 'Enter');
        const chips = () => page.evaluate(() => [...document.querySelectorAll('.metadata-multi[data-metadata-key="genre"] .metadata-multi-chip')].map((c) => c.firstChild.textContent));
        assert.deepEqual(await chips(), ['Rock', 'Indie']);
        assert.equal(await page.evaluate(() => document.getElementById('metadata-editor-save').disabled), false);
        await page.click('.metadata-multi[data-metadata-key="genre"] .metadata-multi-chip:first-child button');
        assert.deepEqual(await chips(), ['Indie']);
        await page.close();
    });

    test('online search lists the matches with their releases; using one fills the form and waits for Save', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await play(page);
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        await page.click('.metadata-editor-toolbar-actions button:has-text("Search")');
        await page.waitForSelector('.metadata-online-result-card');
        const r = await page.evaluate(() => ({ cards: document.querySelectorAll('.metadata-online-result-card').length, releases: [...document.querySelectorAll('.metadata-online-releases button')].length }));
        assert.deepEqual(r, { cards: 1, releases: 2 });
        await page.click('.metadata-online-releases button:has-text("Deluxe")');
        await page.waitForFunction(() => document.querySelector('input[data-metadata-key="album"]').value === 'Album 0 (Deluxe)');
        assert.equal(await page.evaluate(() => document.getElementById('metadata-editor-save').disabled), false);
        assert.equal((await calls(page, 'online')).length, 1);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a file the engine cannot read: the message says so and the form stays locked', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate(() => (window.__failRead = true));
        await play(page);
        await toMetadata(page);
        await page.waitForSelector('.metadata-editor-state');
        const r = await page.evaluate(() => ({ text: document.querySelector('.metadata-editor-state').textContent, border: getComputedStyle(document.querySelector('.metadata-editor-state')).borderInlineStartWidth, inputs: document.querySelectorAll('.metadata-editor-fields input').length }));
        assert.match(r.text, /Couldn't read the tags from this file/);
        assert.equal(r.border, '3px');
        assert.equal(r.inputs, 0);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the toolbar and the Save bar stay in view while a long form scrolls; the smallest window has no sideways scroll', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ width: 800, height: 600 });
        await play(page);
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        await page.click('.metadata-more-toggle');
        await page.waitForSelector('input[data-metadata-key="isrc"]');
        await page.evaluate(() => (document.querySelector('.view-host').scrollTop = 500));
        const r = await page.evaluate(() => {
            const host = document.querySelector('.view-host');
            const h = host.getBoundingClientRect();
            const tb = document.querySelector('.metadata-editor-toolbar').getBoundingClientRect();
            const ac = document.querySelector('.metadata-editor-actions').getBoundingClientRect();
            const outside = [...host.querySelectorAll('.metadata-editor-toolbar *, .metadata-editor-actions *')].filter((e) => {
                const b = e.getBoundingClientRect();
                return b.width > 0 && (b.left < h.left - 1 || b.right > h.right + 1);
            });
            return { scrolled: host.scrollTop > 0, toolbarAtTop: Math.abs(tb.top - h.top) < 2, actionsAtBottom: Math.abs(ac.bottom - h.bottom) < 2, sideways: host.scrollWidth > host.clientWidth + 1, outside: outside.length };
        });
        assert.deepEqual(r, { scrolled: true, toolbarAtTop: true, actionsAtBottom: true, sideways: false, outside: 0 });
        await page.close();
    });

    test('text contrast 4.5:1: labels, section titles, inputs, chips, buttons, results; three themes', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await play(page);
        await toMetadata(page);
        await page.waitForSelector('input[data-metadata-key="title"]');
        await page.click('.metadata-editor-toolbar-actions button:has-text("Search")');
        await page.waitForSelector('.metadata-online-result-card');
        const bad = [];
        for (const theme of ['warm-graphite', 'deep-forest', 'espresso-copper']) {
            bad.push(
                ...(await page.evaluate((name) => {
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
                    const check = (label, el) => {
                        const r = ratio(getComputedStyle(el).color, bg(el));
                        if (r < 4.5) out.push(`${name} ${label} ${r.toFixed(2)}`);
                    };
                    check('toolbar title', document.querySelector('.metadata-editor-toolbar-title'));
                    check('field label', document.querySelector('.metadata-editor-field > span'));
                    check('section title', document.querySelector('.metadata-editor-section-title'));
                    check('input', document.querySelector('input[data-metadata-key="title"]'));
                    check('multi input placeholder-free text', document.querySelector('.metadata-multi-input'));
                    check('chip', document.querySelector('.metadata-multi-chip'));
                    check('chip remove', document.querySelector('.metadata-multi-chip button'));
                    check('cover status', document.getElementById('metadata-cover-status'));
                    check('result title', document.querySelector('.metadata-online-result'));
                    check('result detail', document.querySelector('.metadata-online-result small'));
                    for (const b of document.querySelectorAll('.metadata-editor-toolbar button, .metadata-editor-actions button, .metadata-cover-info button, .metadata-online-releases button, .metadata-more-toggle')) if (!b.disabled) check('button ' + b.textContent.trim(), b);
                    return out;
                }, theme))
            );
        }
        assert.deepEqual(bad, []);
        await page.close();
    });
});

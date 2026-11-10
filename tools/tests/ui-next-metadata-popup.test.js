// The song metadata window ("Show metadata"): the engine builds it (js/ui/06b-modals.js), views/tools/metadata-popup.css gives it its design.
//
// Run:   node --test tools/tests/ui-next-metadata-popup.test.js
// Needs: npm i -D playwright

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('metadata window static rules', () => {
    const css = fs.readFileSync(path.join(NEXT_SRC, 'views', 'tools', 'metadata-popup.css'), 'utf8');
    const tokens = fs.readFileSync(path.join(NEXT_SRC, 'tokens.css'), 'utf8');

    test('tokens only: no raw colors, no primitive names, every var() is defined', () => {
        assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/);
        assert.doesNotMatch(css, /--c-[a-z]/);
        for (const name of new Set(css.match(/var\(--[a-z0-9-]+/g) || [])) assert.ok(tokens.includes(`${name.slice(4)}:`), `${name.slice(4)} is a defined token`);
    });

    test('index.html links it, and the interim overlay file no longer styles the window', () => {
        assert.ok(fs.readFileSync(path.join(NEXT_SRC, 'index.html'), 'utf8').includes('views/tools/metadata-popup.css'));
        assert.doesNotMatch(fs.readFileSync(path.join(NEXT_SRC, 'adapter', 'legacy-overlays.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), /song-metadata/);
    });

    test('B5: the text can be selected, the Copy button takes no room and has no motion, the old window does not show it', () => {
        const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
        const selectable = plain.match(/([^{}]*)\{[^}]*user-select:\s*text/)?.[1] || '';
        for (const part of ['.song-metadata-title', '.song-metadata-artist', '.song-metadata-label', '.song-metadata-value']) assert.ok(selectable.includes(part), `${part} can be selected`);
        const button = plain.match(/\.song-metadata-copy\s*\{[^}]*\}/)?.[0] || '';
        assert.match(button, /position:\s*absolute/, 'out of the layout');
        assert.match(button, /opacity:\s*0/, 'there when idle, only its opacity changes');
        assert.doesNotMatch(button, /transition|animation/, 'no motion of its own (C7)');
        const old = fs.readFileSync(path.join(ROOT, 'src', 'css', 'fullscreen-viewer.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        assert.match(old, /\.song-metadata-copy\s*\{\s*display:\s*none/, 'the old interface keeps its window as it was');
    });
});

describe('metadata window with the real engine', { concurrency: false }, () => {
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

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        return { page, errors };
    }

    test('the window has a hero with the title and artist, rows of label and value, and a round close button', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const song = await page.evaluate(() => {
            const first = SONGS_DATA[0];
            first.genre = '';
            showSongMetadataModal(first.id);
            return { title: first.title, artist: first.artist };
        });
        await page.waitForSelector('.song-metadata-modal');
        const r = await page.evaluate(() => {
            const box = (selector) => document.querySelector(selector).getBoundingClientRect();
            const style = (selector) => getComputedStyle(document.querySelector(selector));
            const close = box('.song-metadata-modal-close');
            const row = document.querySelector('.song-metadata-row');
            return {
                overlay: [box('.song-metadata-modal-overlay').width, box('.song-metadata-modal-overlay').height],
                modalWidth: Math.round(box('.song-metadata-modal').width),
                title: document.querySelector('.song-metadata-title').textContent,
                artist: document.querySelector('.song-metadata-artist').textContent,
                round: [Math.round(close.width), Math.round(close.height), style('.song-metadata-modal-close').borderRadius],
                columns: getComputedStyle(row).gridTemplateColumns.split(' ').length,
                rows: document.querySelectorAll('.song-metadata-row').length,
                empty: [...document.querySelectorAll('.song-metadata-row')].filter((n) => n.querySelector('.song-metadata-value--empty')).map((n) => n.querySelector('.song-metadata-label').textContent),
                emptyColor: style('.song-metadata-value--empty').color !== style('.song-metadata-value:not(.song-metadata-value--empty)').color,
                focused: document.activeElement && document.activeElement.className,
                dialog: document.querySelector('.song-metadata-modal').getAttribute('role')
            };
        });
        assert.deepEqual(r.overlay, [1400, 860], 'covers the window');
        assert.ok(r.modalWidth <= 440 && r.modalWidth >= 300, `a dialog-sized box (${r.modalWidth}px)`);
        assert.equal(r.title, song.title);
        assert.equal(r.artist, song.artist);
        assert.deepEqual(r.round, [32, 32, '999px']);
        assert.equal(r.columns, 2, 'label and value');
        assert.equal(r.rows, 8, 'the details are rows: title and artist are in the hero');
        assert.ok(r.empty.includes('Genre'), 'a field the song does not have is marked');
        assert.equal(r.emptyColor, true, 'and shown in the faint color');
        assert.equal(r.focused, 'song-metadata-modal-close', 'the close button has focus');
        assert.equal(r.dialog, 'dialog');
        await page.keyboard.press('Escape');
        await page.waitForSelector('.song-metadata-modal-overlay', { state: 'detached' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the close button and a click outside the window close it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate(() => showSongMetadataModal(SONGS_DATA[0].id));
        await page.click('.song-metadata-modal-close');
        await page.waitForSelector('.song-metadata-modal-overlay', { state: 'detached' });
        await page.evaluate(() => showSongMetadataModal(SONGS_DATA[0].id));
        await page.mouse.click(8, 8);
        await page.waitForSelector('.song-metadata-modal-overlay', { state: 'detached' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    // ---- B5: select and copy ----
    const openWindow = async (page) => {
        await page.evaluate(() => {
            SONGS_DATA[0].genre = '';
            showSongMetadataModal(SONGS_DATA[0].id);
        });
        await page.waitForSelector('.song-metadata-modal');
    };
    const stubClipboard = (page, fail) =>
        page.evaluate((fails) => {
            window.__copied = null;
            const writeText = fails ? () => Promise.reject(new Error('denied')) : (text) => ((window.__copied = text), Promise.resolve());
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        }, !!fail);

    test('B5: the text can be selected; a value that has text has a Copy button, a dash does not; the rows stay two columns', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await openWindow(page);
        const r = await page.evaluate(() => {
            const select = (selector) => getComputedStyle(document.querySelector(selector)).userSelect;
            const rows = [...document.querySelectorAll('.song-metadata-row')];
            const hasText = (row) => !row.querySelector('.song-metadata-value--empty');
            return {
                selectable: ['.song-metadata-title', '.song-metadata-artist', '.song-metadata-label', '.song-metadata-value'].map(select),
                button: select('.song-metadata-copy'),
                withText: rows.filter(hasText).length,
                buttons: document.querySelectorAll('.song-metadata-copy').length,
                onDashRows: rows.filter((row) => !hasText(row) && row.querySelector('.song-metadata-copy')).length,
                names: [...document.querySelectorAll('.song-metadata-copy')].map((b) => b.getAttribute('aria-label')),
                columns: getComputedStyle(rows[0]).gridTemplateColumns.split(' ').length
            };
        });
        assert.deepEqual(r.selectable, ['text', 'text', 'text', 'text']);
        assert.equal(r.button, 'none', 'the button itself is not selectable text');
        assert.ok(r.withText > 0 && r.buttons === r.withText, `a Copy button for each of the ${r.withText} values with text, found ${r.buttons}`);
        assert.equal(r.onDashRows, 0);
        assert.ok(r.names.every((name) => /^Copy \S/.test(name)), `each button names its field: ${r.names}`);
        assert.equal(r.columns, 2, 'the button is not a grid cell');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('B5: Copy puts exactly the shown value on the clipboard and says so for a moment; a refused copy says nothing is copied', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await openWindow(page);
        await stubClipboard(page);
        const expected = await page.evaluate(() => document.querySelector('.song-metadata-copy').closest('.song-metadata-row').querySelector('.song-metadata-value').textContent);
        await page.click('.song-metadata-copy');
        await page.waitForSelector('.song-metadata-copy[data-copied]');
        assert.equal(await page.evaluate(() => window.__copied), expected);
        assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('.song-metadata-copy-done')).display !== 'none'), 'the check mark shows');
        await page.waitForSelector('.song-metadata-copy[data-copied]', { state: 'detached', timeout: 4000 });
        await stubClipboard(page, true);
        await page.click('.song-metadata-copy');
        await page.waitForTimeout(250);
        assert.equal(await page.locator('.song-metadata-copy[data-copied]').count(), 0, 'a refused copy does not show the check mark');
        assert.equal(await page.locator('.song-metadata-modal').count(), 1, 'and the window stays');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('B5: hovering a row moves nothing, and a row with a Copy button is as tall as a row without one', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await openWindow(page);
        const measure = () =>
            page.evaluate(() =>
                [...document.querySelectorAll('.song-metadata-row')].map((row) => {
                    const box = row.getBoundingClientRect();
                    const value = row.querySelector('.song-metadata-value').getBoundingClientRect();
                    return { height: box.height, width: box.width, valueTop: value.top - box.top, valueWidth: value.width, single: value.height <= 24 };
                })
            );
        await page.mouse.move(2, 2);
        const idle = await measure();
        const count = idle.length;
        for (const index of [0, count - 1]) {
            await page.hover(`.song-metadata-list > .song-metadata-row:nth-child(${index + 1})`);
            assert.deepEqual(await measure(), idle, `row ${index + 1} hovered: sizes and text positions are the same as at rest`);
        }
        const singleHeights = new Set(idle.filter((row) => row.single).map((row) => Math.round(row.height * 10)));
        assert.equal(singleHeights.size, 1, `one-line rows are all the same height, with or without a button (${[...singleHeights]})`);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('B5: Tab goes from the close button to the Copy buttons and shows the one that has focus', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await openWindow(page);
        await page.mouse.move(2, 2);
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => ({ name: document.activeElement.className, opacity: getComputedStyle(document.activeElement).opacity }));
        assert.equal(focused.name, 'song-metadata-copy');
        assert.equal(focused.opacity, '1', 'a button that has focus is visible');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('B5: dragging to select text and letting go outside the window does not close it; a plain click outside still does', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await openWindow(page);
        const from = await page.evaluate(() => {
            const box = document.querySelector('.song-metadata-value:not(.song-metadata-value--empty)').getBoundingClientRect();
            return { x: box.left + 4, y: box.top + box.height / 2 };
        });
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(8, 8, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(150);
        assert.equal(await page.locator('.song-metadata-modal-overlay').count(), 1, 'the window is still open');
        assert.ok((await page.evaluate(() => String(window.getSelection()))).length > 0, 'and the drag selected text');
        await page.mouse.click(8, 8);
        await page.waitForSelector('.song-metadata-modal-overlay', { state: 'detached' });
        assert.deepEqual(errors, []);
        await page.close();
    });
});

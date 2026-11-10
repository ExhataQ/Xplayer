// Tasks C1-C3: the Play from URL dialog (a pasted link, what it would fetch) and "Open file location" on a saved download,
// in the real shell and the real, unchanged engine. The desktop calls are stand-ins that record what the page asked for.
//
// Run:   node --test tools/tests/ui-next-play-from-url.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('Play from URL (static rules)', () => {
    const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

    test('the preview is written as text, never as markup', () => {
        const source = read('src', 'js', 'ui', '06b-modals.js');
        const helpers = source.slice(source.indexOf('function setupLinkHelpers'), source.indexOf('export function playFromUrl'));
        assert.ok(helpers.length > 200, 'the helpers were found');
        assert.match(helpers, /preview\.textContent = linkPreviewText\(info\)/);
        assert.doesNotMatch(helpers, /innerHTML|insertAdjacentHTML/);
    });

    test('the probe is one named call in the preload, the desktop API table and the main process, and checks the link there', () => {
        assert.match(read('electron', 'preload.js'), /probeUrl: \(url\) => ipcRenderer\.invoke\('probe-url', url\)/);
        assert.match(read('src', 'js', 'api', 'desktop-api.js'), /probeUrl: 'invoke'/);
        const main = read('electron', 'main.js');
        assert.match(main, /ipcMain\.handle\('probe-url'[\s\S]{0,200}checks\.isHttpUrl\(url\)/);
    });

    test('the link preview style uses tokens only', () => {
        const css = read('src', 'ui-next', 'views', 'tools', 'dialogs.css');
        const block = css.slice(css.indexOf('.link-preview {'), css.indexOf('}', css.indexOf('.link-preview {')));
        assert.ok(block.length > 20, 'the rule exists');
        assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|--c-[a-z]/);
    });
});

describe('Play from URL and saved downloads in the new shell', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub =
            '<script>window.__calls = { probe: [], show: [] }; window.__probe = () => Promise.resolve({ success: false });' +
            'window.electronAPI = new Proxy({}, {get:(t,k)=>{ if (k==="then") return undefined;' +
            ' if (k==="probeUrl") return (u) => { window.__calls.probe.push(u); return window.__probe(u); };' +
            ' if (k==="showFileInExplorer") return (p) => { window.__calls.show.push(p); };' +
            ' return (...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null); }});</script>\n';
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
        await waitForAppSettled(page, 4000);
        return { page, errors };
    }

    // Puts the stand-in clipboard in place (a function that returns the text, possibly late), then opens the engine's dialog.
    async function openDialog(page, clip) {
        await page.evaluate((source) => {
            const read = new Function(`return (${source})`)();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: read } });
            window.showAddLinkDialog();
        }, clip.toString());
        await page.waitForSelector('#link-url-input');
    }
    const input = (page) => page.locator('#link-url-input');
    const preview = (page) => page.locator('#link-preview');
    const probes = (page) => page.evaluate(() => window.__calls.probe.slice());

    test('a link on the clipboard is pasted and selected when the dialog opens, and its details appear', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate(() => (window.__probe = () => Promise.resolve({ success: true, name: 'song.mp3', size: 4404019, type: 'audio/mpeg' })));
        await openDialog(page, () => Promise.resolve('  https://example.test/a/song.mp3  '));
        await page.waitForFunction(() => document.getElementById('link-url-input').value !== '');
        assert.equal(await input(page).inputValue(), 'https://example.test/a/song.mp3');
        const selection = await input(page).evaluate((n) => [n.selectionStart, n.selectionEnd, n.value.length]);
        assert.deepEqual(selection, [0, selection[2], selection[2]], 'all of it is selected, so typing replaces it');
        await page.waitForFunction(() => document.getElementById('link-preview').textContent !== '', null, { timeout: 3000 });
        assert.equal(await preview(page).innerText(), 'song.mp3 · 4.2 MB · audio/mpeg');
        assert.deepEqual(await probes(page), ['https://example.test/a/song.mp3']);
        assert.equal(await preview(page).getAttribute('aria-live'), 'polite');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('anything on the clipboard that is not an http(s) link is left alone, and nothing is asked of the network', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        for (const text of ['some words about a song', 'file:///C:/Music/a.mp3', 'javascript:alert(1)', 'https://a.test/has space.mp3', '', 'https://example.test/' + 'x'.repeat(2100)]) {
            await openDialog(page, new Function(`return () => Promise.resolve(${JSON.stringify(text)})`)());
            await page.waitForTimeout(150);
            assert.equal(await input(page).inputValue(), '', JSON.stringify(text.slice(0, 40)));
            await page.evaluate(() => window.closeAddLinkModal());
        }
        await openDialog(page, () => Promise.reject(new Error('denied')));
        await page.waitForTimeout(100);
        assert.equal(await input(page).inputValue(), '', 'a refused clipboard read is not an error');
        await page.waitForTimeout(700);
        assert.deepEqual(await probes(page), []);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('text the person typed while the clipboard was still being read is not replaced', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await openDialog(page, () => new Promise((resolve) => setTimeout(() => resolve('https://late.test/a.mp3'), 300)));
        await input(page).fill('my own text');
        await page.waitForTimeout(500);
        assert.equal(await input(page).inputValue(), 'my own text');
        await page.close();
    });

    test('typing asks once, after a pause, only for a link; a slow older answer never replaces a newer one', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => {
            window.__probe = (url) =>
                new Promise((resolve) => setTimeout(() => resolve({ success: true, name: url.includes('old') ? 'old.mp3' : 'new.mp3' }), url.includes('old') ? 900 : 20));
        });
        await openDialog(page, () => Promise.resolve(''));
        await input(page).fill('not a link');
        await input(page).fill('https://e.test/o');
        await input(page).fill('https://e.test/ol');
        await input(page).fill('https://e.test/old.mp3');
        await page.waitForTimeout(650);
        assert.deepEqual(await probes(page), ['https://e.test/old.mp3'], 'one request, for the last value');
        await input(page).fill('https://e.test/new.mp3');
        await page.waitForFunction(() => document.getElementById('link-preview').textContent === 'new.mp3', null, { timeout: 3000 });
        await page.waitForTimeout(1200);
        assert.equal(await preview(page).innerText(), 'new.mp3', 'the late answer for the old link was dropped');
        await input(page).fill('');
        assert.equal(await preview(page).innerText(), '', 'an emptied box clears the line');
        await page.close();
    });

    test('no answer, a refusal or a failed call leaves the line empty; the name is shown as text, not markup', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await openDialog(page, () => Promise.resolve(''));
        await page.evaluate(() => (window.__probe = () => Promise.reject(new Error('boom'))));
        await input(page).fill('https://e.test/a.mp3');
        await page.waitForTimeout(800);
        assert.equal(await preview(page).innerText(), '');
        await page.evaluate(() => (window.__probe = () => Promise.resolve({ success: false })));
        await input(page).fill('https://e.test/b.mp3');
        await page.waitForTimeout(800);
        assert.equal(await preview(page).innerText(), '');
        await page.evaluate(() => (window.__probe = () => Promise.resolve({ success: true, name: '<img src=x onerror=window.__hit=1>.mp3' })));
        await input(page).fill('https://e.test/c.mp3');
        await page.waitForFunction(() => document.getElementById('link-preview').textContent !== '', null, { timeout: 3000 });
        assert.equal(await preview(page).locator('img').count(), 0);
        assert.equal(await page.evaluate(() => window.__hit), undefined);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('closing the dialog while a request is out is quiet', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate(() => (window.__probe = () => new Promise((resolve) => setTimeout(() => resolve({ success: true, name: 'z.mp3' }), 300))));
        await openDialog(page, () => Promise.resolve(''));
        await input(page).fill('https://e.test/z.mp3');
        await page.waitForTimeout(650);
        await page.evaluate(() => window.closeAddLinkModal());
        await page.waitForTimeout(500);
        assert.equal(await page.locator('#link-preview').count(), 0);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a saved download is kept in the bell list with "Open file location", which shows that file; a stream and a plain "Saved" get no button', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const file = 'C:\\Users\\me\\Downloads\\Song.mp3';
        await page.evaluate((f) => {
            showNotification('Streaming: Temp Song', 'success', 2000);
            showNotification('Saved: Plain', 'success', 2000);
            showNotification('Saved: Song', 'success', 2000, { file: f });
        }, file);
        await page.locator('.toast', { hasText: 'Saved: Song' }).waitFor({ timeout: 2000 });
        await page.locator('.titlebar .icon-btn[aria-controls="notification-center"]').click();
        const rows = page.locator('#notification-center .notif');
        assert.equal(await rows.count(), 1, 'only the saved download is kept; the stream and the plain line are popups');
        assert.equal(await rows.first().locator('.notif__title').innerText(), 'Saved: Song');
        const button = rows.first().getByRole('button', { name: 'Open file location' });
        assert.equal(await button.count(), 1);
        await button.click();
        assert.deepEqual(await page.evaluate(() => window.__calls.show), [file]);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

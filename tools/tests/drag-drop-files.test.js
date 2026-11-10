// Audio files dragged in from Windows (src/js/ui/06m-drag-drop-files.js and ui/06l-drop-rules.js, polish A4/A5):
// the left panel dims what cannot take them, a drop on a playlist or Liked Songs puts the files there, a drop on the queue queues them,
// the queue drawer opens while they rest above its button, and a drop anywhere else does nothing.
//
// Run:   node --test tools/tests/drag-drop-files.test.js
// Needs: playwright and a browser (skips itself when missing). The pure rule is tested without a browser.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 60000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('what can take a drop (ui/06l-drop-rules.js)', () => {
    let rules;
    before(async () => {
        rules = await import(require('url').pathToFileURL(path.join(ROOT, 'src', 'js', 'ui', '06l-drop-rules.js')).href);
    });

    test('Liked Songs and playlists take songs and files', () => {
        for (const kind of ['song', 'files']) {
            assert.deepEqual(rules.dropTarget(kind, 'favorites', 'favorites'), { type: 'favorites' });
            assert.deepEqual(rules.dropTarget(kind, 'playlist-7', 'playlist-7'), { type: 'playlist', id: '7' });
            assert.equal(rules.acceptsDrop(kind, 'playlist-7', null), true);
            assert.equal(rules.acceptsDrop(kind, null, 'favorites'), true, 'either attribute is enough');
        }
    });

    test('All songs takes files only (they are imported); nothing else takes anything', () => {
        assert.deepEqual(rules.dropTarget('files', 'all-songs', 'all-songs'), { type: 'library' });
        assert.equal(rules.acceptsDrop('song', 'all-songs', 'all-songs'), false);
        for (const key of ['folder-ab', 'aUU6BIQ66UEIJ', 'history', 'recent', '', null, undefined]) {
            assert.equal(rules.acceptsDrop('song', key, key), false, String(key));
            assert.equal(rules.acceptsDrop('files', key, key), false, String(key));
        }
    });
});

describe('files dragged in from Windows, in the real page', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        // importDroppedFiles answers with window.__reply and records how it was called
        const stub =
            '<script>window.__reply = null; window.__calls = []; window.electronAPI = new Proxy({}, {get:(t,k)=>(k==="then"?undefined:k==="importDroppedFiles"?(...a)=>{window.__calls.push(a);return Promise.resolve(window.__reply)}:(...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null))});</script>\n';
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return { page, errors };
    }
    // one drag event of a file, fired at the element that matches `selector`
    const fire = (page, type, selector) =>
        page.evaluate(
            ({ ty, sel }) => {
                const target = document.querySelector(sel);
                const dt = new DataTransfer();
                const file = new File(['x'], 'a.mp3', { type: 'audio/mpeg' });
                Object.defineProperty(file, 'path', { value: 'C:/m/a.mp3' });
                dt.items.add(file);
                target.dispatchEvent(new DragEvent(ty, { bubbles: true, cancelable: true, dataTransfer: dt }));
            },
            { ty: type, sel: selector }
        );
    const PLAYLIST = (id) => `.left-panel-main-item[data-view="playlist-${id}"]`;
    const reply = (page, known) => page.evaluate((k) => { window.__reply = { success: true, songs: [], newSongs: [], known: k }; window.__calls.length = 0; }, known);

    test('over the window: what cannot take files is dimmed, what can is not; leaving clears it', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const { page, errors } = await open();
        await page.evaluate(() => { createPlaylist('Files target'); renderLeftPanelMainList(); });
        await page.waitForSelector('.left-panel-main-item[data-view^="playlist-"]');
        await fire(page, 'dragenter', 'body');
        const state = () =>
            page.evaluate(() => ({
                dragging: document.body.classList.contains('dragging-files'),
                invalid: [...document.querySelectorAll('.left-panel-main-item.drag-invalid')].map((e) => e.getAttribute('data-view')),
                valid: [...document.querySelectorAll('.left-panel-main-item:not(.drag-invalid)')].map((e) => e.getAttribute('data-view'))
            }));
        const s = await state();
        assert.equal(s.dragging, true);
        assert.ok(s.invalid.length > 0 && s.invalid.every((v) => v !== 'favorites' && v !== 'all-songs' && !v.startsWith('playlist-')), 'albums and the like are dimmed');
        assert.deepEqual(s.valid.filter((v) => v === 'favorites' || v === 'all-songs' || v.startsWith('playlist-')).length, s.valid.length, 'only Liked, All songs and playlists stay');
        assert.ok(s.valid.some((v) => v.startsWith('playlist-')));
        await fire(page, 'dragleave', 'body');
        const after = await state();
        assert.equal(after.dragging, false);
        assert.deepEqual(after.invalid, []);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a drop on a playlist puts the known song in it; a drop on Liked Songs likes it', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const { page, errors } = await open();
        const id = await page.evaluate(() => { createPlaylist('Files target'); renderLeftPanelMainList(); return getPlaylists()[0].id; });
        await page.waitForSelector(PLAYLIST(id));
        await reply(page, [{ id: 3, url: 'file:///C:/m/a.mp3' }]);
        await fire(page, 'dragenter', 'body');
        await fire(page, 'drop', PLAYLIST(id));
        await page.waitForFunction((pid) => getPlaylists().find((p) => String(p.id) === String(pid)).songs?.length > 0 || (getPlaylists().find((p) => String(p.id) === String(pid)).songIds || []).length > 0, id, { timeout: 3000 });
        assert.equal(await page.evaluate(() => window.__calls.length), 1);
        assert.deepEqual(await page.evaluate(() => window.__calls[0][0]), ['C:/m/a.mp3']);
        assert.equal(await page.evaluate(() => document.body.classList.contains('dragging-files')), false, 'the drag is over');
        await reply(page, [{ id: 3, url: 'file:///C:/m/a.mp3' }]);
        await fire(page, 'dragenter', 'body');
        await fire(page, 'drop', '.left-panel-main-item[data-view="favorites"]');
        await page.waitForFunction(() => isFavorite(3), null, { timeout: 3000 });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a drop on an album, or on the queue button, does nothing and does not import', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const { page, errors } = await open();
        await reply(page, [{ id: 3, url: 'file:///C:/m/a.mp3' }]);
        await fire(page, 'dragenter', 'body');
        await fire(page, 'drop', '.left-panel-main-item[data-view="aUU6BIQ66UEIJ"]');
        await fire(page, 'dragenter', 'body');
        await fire(page, 'drop', '.queue-btn');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => window.__calls.length), 0);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a drop on the queue queues the song after the ones added by hand; the drawer opens above the button', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const { page, errors } = await open();
        const button = await page.locator('.queue-btn').boundingBox();
        await fire(page, 'dragenter', 'body');
        await page.evaluate(({ x, y }) => {
            const dt = new DataTransfer();
            dt.items.add(new File(['x'], 'a.mp3', { type: 'audio/mpeg' }));
            document.elementFromPoint(x, y).dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
        }, { x: Math.round(button.x + button.width / 2), y: Math.round(button.y - 100) });
        await page.waitForSelector('.queue-panel:not([hidden])', { timeout: 2000 });
        await reply(page, [{ id: 5, url: 'file:///C:/m/a.mp3' }]);
        const before = await page.evaluate(() => playbackQueue.length);
        await fire(page, 'drop', '.queue-panel');
        await page.waitForFunction((n) => playbackQueue.length === n + 1, before, { timeout: 3000 });
        assert.equal(await page.evaluate(() => playbackQueue.some((q) => q.song.id === 5 && q.addedManually)), true);
        await page.waitForSelector('.queue-panel[hidden]', { state: 'attached', timeout: 2000 });
        assert.deepEqual(errors, []);
        await page.close();
    });
});

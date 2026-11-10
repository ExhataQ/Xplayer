// Polish A6: a dragged song or file resting on a rail item opens that item after a short delay (shell/rail-drag-hover.js).
//
// Run:   node --test tools/tests/ui-next-rail-drag-hover.test.js
// Needs: playwright and a browser for the second half (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('createRailDragHover (the rules)', () => {
    let createRailDragHover;
    before(async () => {
        ({ createRailDragHover } = await import(pathToFileURL(path.join(NEXT_SRC, 'shell', 'rail-drag-hover.js')).href));
    });

    // A clock the test moves by hand.
    function rig(isCurrent = () => false) {
        const chosen = [];
        let now = 0;
        const timers = [];
        const c = createRailDragHover({
            delay: 400,
            isCurrent,
            select: (id) => chosen.push(id),
            setTimer: (fn, ms) => { const t = { fn, at: now + ms, live: true }; timers.push(t); return t; },
            clearTimer: (t) => { t.live = false; }
        });
        const tick = (ms) => { now += ms; for (const t of timers) if (t.live && t.at <= now) { t.live = false; t.fn(); } };
        return { c, chosen, tick };
    }

    test('it opens the item after the delay, once', () => {
        const { c, chosen, tick } = rig();
        c.hover('settings');
        tick(399);
        assert.deepEqual(chosen, []);
        tick(1);
        assert.deepEqual(chosen, ['settings']);
        c.hover('settings');
        tick(2000);
        assert.deepEqual(chosen, ['settings']);
    });

    test('moving off before the delay, or ending the drag, cancels it', () => {
        const { c, chosen, tick } = rig();
        c.hover('lyrics');
        tick(300);
        c.hover(null);
        tick(1000);
        c.hover('metadata');
        tick(300);
        c.end();
        tick(1000);
        assert.deepEqual(chosen, []);
        assert.equal(c.pending(), false);
    });

    test('moving to another item restarts the wait for that item', () => {
        const { c, chosen, tick } = rig();
        c.hover('home');
        tick(300);
        c.hover('settings');
        tick(300);
        assert.deepEqual(chosen, []);
        tick(100);
        assert.deepEqual(chosen, ['settings']);
    });

    test('an item that is already showing is not chosen again', () => {
        const { c, chosen, tick } = rig((id) => id === 'library');
        c.hover('library');
        tick(5000);
        assert.deepEqual(chosen, []);
    });
});

describe('a dragged item over the rail, in the real shell', { concurrency: false }, () => {
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

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return { page, errors };
    }
    const view = (page) => page.evaluate(() => document.querySelector('.view-host').dataset.view);
    const overRail = async (page, id, type = 'mousemove') => {
        const box = await page.locator(`.rail-btn[data-view="${id}"]`).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        if (type !== 'mousemove') {
            await page.evaluate(({ x, y, type }) => document.elementFromPoint(x, y).dispatchEvent(new Event(type, { bubbles: true, cancelable: true })), { x: box.x + box.width / 2, y: box.y + box.height / 2, type });
        }
    };

    test('a song drag resting on Settings opens it; the item shows a ring while it waits', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const { page, errors } = await open();
        await page.evaluate(() => document.body.classList.add('dragging-song'));
        await overRail(page, 'settings');
        assert.equal(await page.locator('.rail-btn[data-view="settings"]').evaluate((n) => n.classList.contains('drag-over')), true);
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'settings', null, { timeout: 3000 });
        await page.evaluate(() => document.body.classList.remove('dragging-song'));
        await page.mouse.move(700, 400);
        assert.equal(await page.locator('.rail-btn.drag-over').count(), 0);
        assert.deepEqual(errors.filter((e) => !/reading 'enabled'/.test(e)), []);
        await page.close();
    });

    test('nothing happens when no drag is going on, or when the pointer leaves early', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const { page } = await open();
        await overRail(page, 'settings');
        await page.waitForTimeout(800);
        assert.notEqual(await view(page), 'settings');
        await page.evaluate(() => document.body.classList.add('dragging-song'));
        await overRail(page, 'lyrics');
        await page.waitForTimeout(150);
        await page.mouse.move(700, 400);
        await page.waitForTimeout(700);
        assert.notEqual(await view(page), 'lyrics');
        await page.close();
    });

    test('a file drag (dragover events) works the same', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const { page } = await open();
        await page.evaluate(() => document.body.classList.add('dragging-files'));
        await overRail(page, 'home', 'dragover');
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'home', null, { timeout: 3000 });
        await page.evaluate(() => document.body.classList.remove('dragging-files'));
        await page.close();
    });
});

// Task PA-19 (step 2, the replace rule): in a window too narrow for both panels, an open right panel replaces the left panel, so the
// song list keeps its room. When the window widens (or the right panel closes) the left panel comes back.
//
// Run:   node --test tools/tests/ui-next-narrow-replace.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 60000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('narrow window: the right panel replaces the left one', { concurrency: false }, () => {
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

    async function open(width) {
        const context = await browser.newContext({ viewport: { width, height: 760 } }); // its own storage: the saved right-panel choice must not carry over
        const page = await context.newPage();
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return page;
    }

    const state = (page) =>
        page.evaluate(() => {
            const list = document.querySelector('.view-host').getBoundingClientRect();
            const left = document.querySelector('.panel-host');
            const right = document.querySelector('.right-host');
            return {
                replaces: document.documentElement.hasAttribute('data-left-disabled'),
                leftShown: getComputedStyle(left).display !== 'none',
                rightShown: !right.hidden && getComputedStyle(right).display !== 'none',
                listWidth: Math.round(list.width),
                overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth
            };
        });

    test('at 900 px the open right panel takes the left panel\'s place, and the list keeps at least its minimum; wider brings the left panel back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const page = await open(1400);
        await page.locator('.right-panel-btn').first().click();
        await page.waitForTimeout(200);
        assert.equal((await state(page)).replaces, false, 'wide enough for both: nothing replaced');
        assert.equal((await state(page)).leftShown, true);
        await page.setViewportSize({ width: 900, height: 760 });
        await page.waitForTimeout(300);
        const narrow = await state(page);
        assert.equal(narrow.replaces, true, 'narrow: the right panel replaces the left one');
        assert.equal(narrow.leftShown, false);
        assert.equal(narrow.rightShown, true, 'the right panel is shown, not an overlay on the list');
        assert.ok(narrow.listWidth >= 420, `list keeps its minimum (${narrow.listWidth})`);
        assert.equal(narrow.overflowX, 0);
        await page.setViewportSize({ width: 1400, height: 760 });
        await page.waitForTimeout(300);
        const wide = await state(page);
        assert.equal(wide.replaces, false);
        assert.equal(wide.leftShown, true, 'the left panel is back when the window widens');
        await page.context().close();
    });

    test('PA-19: the left panel width follows a resize; a short window shrinks the hero cover; a narrow window folds the volume bar', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const page = await open(1400);
        const panelWidth = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-width')));
        assert.equal(await panelWidth(), 340);
        await page.setViewportSize({ width: 900, height: 760 });
        await page.waitForTimeout(200);
        assert.ok((await panelWidth()) <= 900 - 68 - 420, 'the panel shrinks with the window, before the list goes under its minimum');
        await page.setViewportSize({ width: 1400, height: 760 });
        await page.waitForTimeout(200);
        assert.equal(await panelWidth(), 340, 'widening brings the saved width back');
        const cover = () => page.evaluate(() => Math.round(document.querySelector('.songlist-bar__cover').getBoundingClientRect().width));
        const tall = await cover();
        await page.setViewportSize({ width: 1400, height: 640 });
        await page.waitForTimeout(200);
        assert.equal(await cover(), 96, 'a short window: the cover is 96 px');
        assert.ok(tall > 96);
        await page.setViewportSize({ width: 1400, height: 760 });
        await page.waitForTimeout(200);
        const volume = () => page.evaluate(() => getComputedStyle(document.querySelector('.player-host #volume-slider')).display);
        assert.notEqual(await volume(), 'none', 'a wide window keeps the volume bar');
        await page.setViewportSize({ width: 850, height: 760 });
        await page.waitForTimeout(200);
        assert.equal(await volume(), 'none', 'a narrow window folds the volume bar');
        await page.context().close();
    });

    test('closing the right panel at a narrow width brings the left panel back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const page = await open(900);
        await page.locator('.right-panel-btn').first().click();
        await page.waitForTimeout(200);
        assert.equal((await state(page)).replaces, true);
        await page.locator('.right-panel-btn').first().click();
        await page.waitForTimeout(200);
        const after = await state(page);
        assert.equal(after.replaces, false);
        assert.equal(after.leftShown, true);
        await page.context().close();
    });

    test('at the minimum the right panel stays; choosing the left panel replaces it, and the right button takes it back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const page = await open(800);
        await page.locator('.right-panel-btn').first().click();
        await page.waitForTimeout(200);
        let now = await state(page);
        assert.equal(now.rightShown, true, 'the right panel is open');
        assert.equal(now.leftShown, false, 'the left panel stepped aside by default');
        await page.locator('.rail-btn[data-view="library"]').click(); // the person chooses the left panel
        await page.waitForTimeout(250);
        now = await state(page);
        assert.equal(now.leftShown, true, 'the left panel takes the right panel\'s place');
        assert.equal(now.rightShown, false);
        assert.ok(now.listWidth >= 420 - 2, `the list keeps its minimum (${now.listWidth})`);
        assert.equal(now.overflowX, 0);
        await page.locator('.right-panel-btn').first().click(); // and the right button brings it back
        await page.waitForTimeout(250);
        now = await state(page);
        assert.equal(now.rightShown, true);
        assert.equal(now.leftShown, false);
        await page.setViewportSize({ width: 1400, height: 760 });
        await page.waitForTimeout(250);
        now = await state(page);
        assert.equal(now.leftShown && now.rightShown, true, 'both come back when the window widens');
        await page.context().close();
    });
});

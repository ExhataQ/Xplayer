// Task PA-13: mouse back and forward (shell/nav-history.js, wired in shell/shell.js), in the real shell and engine.
//
// Run:   node --test tools/tests/ui-next-nav-history.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('createNavHistory (the matrix of back and forward sequences)', () => {
    let createNavHistory;
    before(async () => {
        ({ createNavHistory } = await import(pathToFileURL(path.join(NEXT_SRC, 'shell', 'nav-history.js')).href));
    });

    // A fake shell: `now` is where the person is; restore moves it there.
    function shell(refuse = () => false) {
        const log = [];
        const state = { now: { view: 'library', engine: 'all-songs' } };
        const nav = createNavHistory({
            read: () => ({ ...state.now }),
            restore: (entry) => {
                if (refuse(entry)) return false;
                state.now = { ...entry };
                log.push(entry.view + (entry.engine ? ':' + entry.engine : ''));
            }
        });
        const go = (view, engine = null) => { state.now = { view, engine }; nav.record(); };
        nav.record();
        return { nav, state, go, log };
    }

    test('back and forward walk the places in order, and a new place after going back drops the forward ones', () => {
        const { nav, go, state } = shell();
        go('settings'); go('lyrics'); go('home');
        assert.equal(nav.back() && nav.back(), true);
        assert.equal(state.now.view, 'settings');
        assert.equal(nav.forward(), true);
        assert.equal(state.now.view, 'lyrics');
        go('metadata');
        assert.equal(nav.canForward(), false);
        nav.back();
        assert.equal(state.now.view, 'lyrics');
    });

    test('nothing happens past either end, and going to the place you are on adds nothing', () => {
        const { nav, go } = shell();
        assert.equal(nav.back(), false);
        assert.equal(nav.forward(), false);
        go('library', 'all-songs'); go('library', 'all-songs');
        assert.equal(nav.canBack(), false);
    });

    test('an engine switch right after a view change replaces that entry (Home card: Library, then the playlist)', () => {
        const { nav, state, log } = shell();
        state.now = { view: 'home', engine: null }; nav.record();
        state.now = { view: 'library', engine: 'all-songs' }; nav.record(true);
        state.now = { view: 'library', engine: 'playlist-p1' }; nav.change();
        nav.back();
        assert.deepEqual(log, ['home']);
        nav.forward();
        assert.deepEqual(log, ['home', 'library:playlist-p1']);
    });

    test('engine switches later, inside the same view, are steps of their own; back to the earlier one is one step', async () => {
        const { nav, state, log } = shell();
        await Promise.resolve();
        state.now = { view: 'library', engine: 'favorites' }; nav.change();
        state.now = { view: 'library', engine: 'playlist-p1' }; nav.change();
        nav.back(); nav.back();
        assert.deepEqual(log, ['library:favorites', 'library:all-songs']);
    });

    test('a view that refuses to be left (unsaved text) keeps the position, and restoring does not record itself', () => {
        const { nav, go, state } = shell((e) => e.view === 'library' && state.now.view === 'metadata');
        go('metadata');
        assert.equal(nav.back(), false);
        assert.equal(nav.canForward(), false);
        assert.equal(state.now.view, 'metadata');
    });

    test('it keeps at most 100 places', () => {
        const { nav, go } = shell();
        for (let i = 0; i < 150; i++) go('v' + i);
        let steps = 0;
        while (nav.back()) steps++;
        assert.equal(steps, 99);
    });
});

describe('mouse back and forward in the new shell', { concurrency: false }, () => {
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
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return { page, errors };
    }

    const rail = (page, view) => page.locator(`.rail-btn[data-view="${view}"]`).click();
    const mouse = (page, button) => page.evaluate((b) => {
        const down = new MouseEvent('mousedown', { button: b, bubbles: true, cancelable: true });
        document.body.dispatchEvent(down);
        document.body.dispatchEvent(new MouseEvent('mouseup', { button: b, bubbles: true, cancelable: true }));
        return down.defaultPrevented;
    }, button);
    const where = (page) => page.evaluate(() => ({
        view: document.querySelector('.view-host').dataset.view,
        current: document.querySelector('.rail-btn[aria-current="page"]')?.dataset.view || null,
        engine: window.currentView
    }));

    test('Library, Settings, Lyrics: button 3 goes back through them, button 4 forward, and the rail follows', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await rail(page, 'settings');
        await rail(page, 'lyrics');
        assert.equal((await where(page)).view, 'lyrics');
        assert.equal(await mouse(page, 3), true, 'the browser must not get the button');
        assert.deepEqual([(await where(page)).view, (await where(page)).current], ['settings', 'settings']);
        await mouse(page, 3);
        assert.deepEqual([(await where(page)).view, (await where(page)).current], ['library', 'library']);
        await mouse(page, 3);
        assert.equal((await where(page)).view, 'library');
        await mouse(page, 4);
        assert.equal((await where(page)).view, 'settings');
        await mouse(page, 4);
        assert.equal((await where(page)).view, 'lyrics');
        await mouse(page, 4);
        assert.equal((await where(page)).view, 'lyrics');
        assert.deepEqual(errors.filter((e) => !/reading 'enabled'/.test(e)), []); // the AI bar reads a status the stubbed electronAPI never returns
        await page.close();
    });

    test('Home is part of the history, and the engine\'s own handler no longer runs', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => { window.__engineBack = 0; const orig = window.goBack; window.goBack = () => { window.__engineBack++; return orig && orig(); }; });
        await rail(page, 'home');
        await rail(page, 'library');
        await mouse(page, 3);
        assert.deepEqual([(await where(page)).view, (await where(page)).current], ['home', 'home']);
        await mouse(page, 4);
        assert.equal((await where(page)).view, 'library');
        assert.equal(await page.evaluate(() => window.__engineBack), 0);
        await page.close();
    });

    test('the engine\'s Favorites list, then Metadata: back returns to Favorites, not to All songs', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => window.switchView('favorites'));
        await rail(page, 'metadata');
        assert.equal((await where(page)).view, 'metadata');
        await mouse(page, 3);
        const now = await where(page);
        assert.equal(now.view, 'library');
        assert.equal(await page.evaluate(() => window.currentView), 'favorites');
        await mouse(page, 3);
        assert.equal(await page.evaluate(() => window.currentView), 'all-songs');
        await page.close();
    });

    test('the other mouse buttons and the middle click are left alone', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await rail(page, 'settings');
        const prevented = await page.evaluate(() => {
            const e = new MouseEvent('mousedown', { button: 1, bubbles: true, cancelable: true });
            document.body.dispatchEvent(e);
            return e.defaultPrevented;
        });
        assert.equal(prevented, false);
        assert.equal((await where(page)).view, 'settings');
        await page.close();
    });
});

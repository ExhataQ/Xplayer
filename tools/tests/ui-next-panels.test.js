// Task PA-04: the panel slot API (shell/panels.js) and the rail structure, in the real shell with the real engine.
//
// Run:   node --test tools/tests/ui-next-panels.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('panel slots', { concurrency: false }, () => {
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

    const rail = (page, id) => page.locator(`.rail-btn[data-view="${id}"]`);
    const collapse = (page) => page.getByRole('button', { name: 'Collapse panel' });

    test('Lyrics, Metadata and Settings form the bottom group; Home, Library, Search and Recents the top group', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const tops = await page.locator('.rail-btn').evaluateAll((b) => b.map((n) => [n.dataset.view, Math.round(n.getBoundingClientRect().top)]));
        assert.deepEqual(tops.map((x) => x[0]), ['home', 'library', 'search', 'recent', 'lyrics', 'metadata', 'settings']);
        const gap = (a, b) => tops.find((x) => x[0] === b)[1] - tops.find((x) => x[0] === a)[1];
        assert.ok(gap('recent', 'lyrics') > 200, 'a clear space between the two groups');
        assert.ok(gap('lyrics', 'metadata') < 60 && gap('metadata', 'settings') < 60, 'the bottom group is tight');
        await page.close();
    });

    test('an unregistered panel item shows its title and note, and no collapse arrow', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        assert.equal(await collapse(page).isVisible(), true, 'Library collapses');
        await rail(page, 'recent').click();
        assert.equal(await page.locator('.panel-host__title').innerText(), 'Recently played');
        assert.match(await page.locator('.panel-note').innerText(), /songs you played/i);
        assert.equal(await collapse(page).isVisible(), false);
        assert.equal(await page.locator('.panel-host').getAttribute('data-panel'), 'expanded');
        await rail(page, 'library').click();
        assert.equal(await collapse(page).isVisible(), true);
        await page.close();
    });

    test('a panel that registers itself gets mount once, then show and hide, and fills the slot', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(async () => {
            const { registerPanel } = await import(new URL('shell/panels.js', location.href).href);
            window.calls = [];
            registerPanel('search', {
                mount(body) {
                    window.calls.push('mount');
                    const node = Object.assign(document.createElement('div'), { id: 'fake-search-panel', textContent: 'Search panel' });
                    body.append(node);
                    return { show: () => ((node.hidden = false), window.calls.push('show')), hide: () => ((node.hidden = true), window.calls.push('hide')) };
                }
            });
        });
        await rail(page, 'search').click();
        assert.equal(await page.locator('#fake-search-panel').isVisible(), true);
        assert.equal(await page.locator('.panel-note').isHidden(), true, 'the placeholder note is gone');
        assert.equal(await page.locator('.library-panel').isHidden(), true, 'Library was hidden when the slot switched');
        await rail(page, 'library').click();
        await rail(page, 'search').click();
        assert.deepEqual(await page.evaluate(() => window.calls), ['mount', 'hide', 'show']);
        await page.close();
    });

    test('a main-view item (Lyrics, Settings, Home) leaves the panel as it is', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        for (const id of ['lyrics', 'settings', 'home']) {
            await rail(page, id).click();
            assert.equal(await page.locator('.library-panel').isVisible(), true, `${id} keeps the Library panel`);
            assert.equal(await page.locator('.panel-host__title').innerText(), 'Library');
        }
        await page.close();
    });

    test('choosing the panel item that is showing closes its panel; choosing it again opens it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const closed = () => page.locator('.panel-host').evaluate((n) => n.hasAttribute('data-closed'));
        await rail(page, 'library').click();
        assert.equal(await closed(), true);
        assert.equal(await page.locator('.panel-host').isVisible(), false);
        await rail(page, 'library').click();
        assert.equal(await closed(), false);
        assert.equal(await page.locator('.panel-host').isVisible(), true);
        await rail(page, 'recent').click(); // another panel item opens it too
        await rail(page, 'recent').click();
        assert.equal(await closed(), true);
        await rail(page, 'library').click();
        assert.equal(await closed(), false);
        await page.close();
    });

    test('registerPanel rejects a missing id or mount', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const result = await page.evaluate(async () => {
            const { registerPanel } = await import(new URL('shell/panels.js', location.href).href);
            const fail = (fn) => { try { fn(); return false; } catch (_) { return true; } };
            return [fail(() => registerPanel('', { mount() {} })), fail(() => registerPanel('x', {})), fail(() => registerPanel('x'))];
        });
        assert.deepEqual(result, [true, true, true]);
        await page.close();
    });
});

// PB-07 in the new shell: static icons in the engine's context menus, the shuffle mode as a floating menu, the default cover on Home.
// Real browser, real engine, new shell.
//
// Run:   node --test tools/tests/ui-next-menu-icons.test.js
// Needs: playwright and a browser (skips itself if missing; see scroll.test.js).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };

function buildNextApp(songs) {
    const dir = buildApp(songs);
    fs.cpSync(path.join(ROOT, 'src', 'ui-next'), path.join(dir, 'ui-next'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'src', 'assets'), path.join(dir, 'assets'), { recursive: true });
    const file = path.join(dir, 'ui-next', 'index.html');
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    return dir;
}

describe('menus: icons, shuffle menu, default cover', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildNextApp(60);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html'));
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        await page.waitForFunction(() => typeof window.selectShuffleMode === 'function');
        return { page, errors };
    }

    test('every item of the song row menu and the library item menu has a drawn icon', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const icons = () => page.evaluate(() => [...document.querySelectorAll('.context-menu .context-menu-item')].filter((e) => e.querySelector('i')).map((e) => { const i = e.querySelector('i'); const s = getComputedStyle(i); return [e.innerText.trim(), s.display !== 'none', s.width, s.maskImage !== 'none' || s.webkitMaskImage !== 'none']; }));
        await page.locator('.view-host .song-item').nth(2).click({ button: 'right' });
        const song = await icons();
        assert.ok(song.length >= 6, 'the song menu has items with icons');
        for (const [label, display, width, masked] of song) assert.deepEqual([display, width, masked], [true, '16px', true], label);
        await page.keyboard.press('Escape');
        await page.locator('.library-panel .left-panel-main-item').nth(2).click({ button: 'right' });
        const library = await icons();
        assert.ok(library.length >= 3);
        for (const [label, display, width, masked] of library) assert.deepEqual([display, width, masked], [true, '16px', true], label);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the player shuffle button opens a floating menu above it, with the modes, and no engine dialog', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.locator('#shuffle-btn').click();
        assert.deepEqual(await page.locator('.menu .menu__item').allInnerTexts(), ['Normal shuffle', 'Smart shuffle']);
        assert.equal(await page.locator('.shuffle-mode-overlay').count(), 0, 'not the engine dialog');
        const [menu, button] = [await page.locator('.menu').boundingBox(), await page.locator('#shuffle-btn').boundingBox()];
        assert.ok(menu.y + menu.height <= button.y, 'the menu opens above the player bar button');
        await page.getByRole('menuitemradio', { name: 'Smart shuffle' }).click();
        await page.waitForFunction(() => isShuffled === true && shuffleMode === 'smart');
        await page.locator('#shuffle-btn').click();
        assert.deepEqual(await page.locator('.menu [aria-checked="true"]').allInnerTexts(), ['Smart shuffle']);
        await page.getByRole('menuitem', { name: 'Turn shuffle off' }).click();
        await page.waitForFunction(() => isShuffled === false);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the list toolbar shuffle and the S key open the same menu; Smart is off for a short list', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => (window.getSongsForList = () => SONGS_DATA.slice(0, 10)));
        await page.locator('.list-toolbar > .icon-btn').nth(1).click();
        assert.equal(await page.getByRole('menuitemradio', { name: /Smart shuffle/ }).getAttribute('aria-disabled'), 'true');
        await page.keyboard.press('Escape');
        await page.keyboard.press('s');
        await page.locator('.menu').waitFor();
        assert.equal(await page.locator('.menu .menu__item').count(), 2);
        await page.close();
    });

    test('a Home card with no cover shows the app default cover, not a letter (artists keep the letter)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => {
            createPlaylist('No cover list');
            saveToRecentlyPlayed(SONGS_DATA[3]);
        });
        await page.locator('.rail-btn[data-view="home"]').click();
        await page.waitForSelector('.shelf-card');
        const defaults = await page.evaluate(() => [...document.querySelectorAll('.shelf-card--playlist .shelf-card__cover img, .shelf-card--song .shelf-card__cover img')].filter((i) => i.src.includes('default-cover')).length);
        assert.ok(defaults >= 1);
        assert.equal(await page.locator('.shelf-card--playlist .shelf-card__letter, .shelf-card--song .shelf-card__letter').count(), 0);
        await page.close();
    });
});

// Task PA-11: the Settings layout (shell/settings-layout.js): a menu bar of tabs, one group of sections per tab, in the real shell and engine.
//
// Run:   node --test tools/tests/ui-next-settings-layout.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('settings layout', { concurrency: false }, () => {
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

    async function openSettings(page) {
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.waitForSelector('.settings-menu');
    }
    const openGroup = async (page, id) => {
        await openSettings(page);
        await page.locator(`.settings-menu [data-page="${id}"]`).click();
    };
    const tabNames = (page) => page.locator('.settings-menu .tab').allInnerTexts();
    const pageId = (page) => page.locator('.settings-panel-content').getAttribute('data-settings-page');
    // The visible section titles on the open page ("Music Library Folders" is the engine's folder list, drawn as its own block).
    const titles = (page) => page.locator('.settings-section-title:visible, .library-locations-title:visible').allInnerTexts();

    test('Settings opens on General with a menu bar of tabs, in order, and no hub, cards or back button', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await openSettings(page);
        assert.equal(await pageId(page), 'general');
        assert.deepEqual(await tabNames(page), ['General', 'Playback', 'Library', 'AI', 'Data']); // Agent E registers its AI section at start-up
        assert.equal(await page.locator('.settings-menu [role="tablist"]').getAttribute('aria-label'), 'Settings sections');
        assert.equal(await page.locator('.settings-menu .tab[aria-selected="true"]').innerText(), 'General');
        assert.equal(await page.locator('.settings-panel-title').innerText(), 'Settings');
        assert.match(await page.locator('.settings-panel-sub').innerText(), /Appearance/);
        assert.deepEqual(await titles(page), ['Appearance', 'Window', 'Startup screen']);
        assert.equal(await page.locator('.settings-hub, .settings-card, .settings-back').count(), 0, 'the hub of cards and the back button are gone');
        assert.equal(await page.locator('.settings-nav').count(), 0, 'the old scroll bar is gone');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('an AI section registered by Agent E gets its own tab and page', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(async () => {
            const slots = await import(new URL('shell/ai-slots.js', location.href).href);
            slots.registerAiSettings({ mount(c) { c.textContent = 'ai body'; } });
        });
        await openSettings(page);
        assert.deepEqual(await tabNames(page), ['General', 'Playback', 'Library', 'AI', 'Data']);
        await page.locator('.settings-menu [data-page="ai"]').click();
        assert.deepEqual(await titles(page), ['AI']);
        assert.equal(await page.locator('.ai-settings__body').innerText(), 'ai body');
        await page.close();
    });

    test('a tab shows only its own sections; the panel is labelled by the tab; the arrow keys move between tabs', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const expected = {
            general: ['Appearance', 'Window', 'Startup screen'],
            playback: ['Player bar', 'Playback & Audio', 'Smart Shuffle'], // the engine's order
            library: ['Music Library Folders', 'Play from URL — Save Location'],
            data: ['Backup & Restore', 'Advanced']
        };
        await openSettings(page);
        for (const [id, list] of Object.entries(expected)) {
            await page.locator(`.settings-menu [data-page="${id}"]`).click();
            assert.equal(await pageId(page), id);
            assert.deepEqual(await titles(page), list, id);
            assert.equal(await page.locator(`.settings-menu [data-page="${id}"]`).getAttribute('aria-selected'), 'true');
            assert.equal(await page.locator('.settings-panel-actions').getAttribute('role'), 'tabpanel');
            assert.equal(await page.locator('.settings-panel-actions').getAttribute('aria-labelledby'), await page.locator(`.settings-menu [data-page="${id}"]`).getAttribute('id'));
        }
        await page.locator('.settings-menu [data-page="general"]').click();
        await page.locator('.settings-menu [data-page="general"]').focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await pageId(page), 'playback', 'the arrow key selects the next tab and shows its page');
        await page.keyboard.press('End');
        assert.equal(await pageId(page), 'data');
        await page.close();
    });

    test('nothing from the previous interface is on any page', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const old = /Change Music Folder|Legacy|View Play History|Search History|Theme Color|Switch to the new interface|Current interface|Smart Shuffle v1|new interface/;
        await openSettings(page);
        const seen = [];
        for (const id of ['general', 'playback', 'library', 'data']) {
            await page.locator(`.settings-menu [data-page="${id}"]`).click();
            seen.push(await page.locator('.settings-panel-content').innerText());
        }
        for (const text of seen) assert.doesNotMatch(text, old);
        // the new interface keeps its own switch row, and the renamed labels read without the old wording
        await openGroup(page, 'general');
        assert.equal(await page.locator('.appearance .appearance__title', { hasText: 'Interface' }).count(), 1);
        assert.match(await page.locator('.settings-panel-content').innerText(), /Background/);
        await openGroup(page, 'playback');
        assert.ok((await titles(page)).includes('Smart Shuffle'));
        await page.close();
    });

    test('engine settings still work on their page', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await openGroup(page, 'general');
        const row = page.locator('.settings-toggle-row', { hasText: 'Minimize to taskbar' });
        const before = await row.locator('input').isChecked();
        await row.click();
        assert.equal(await row.locator('input').isChecked(), !before);
        await page.close();
    });

    test('Advanced Settings and Back return to the Data tab; leaving Settings and coming back starts on General', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await openGroup(page, 'data');
        await page.locator('.settings-action-btn', { hasText: 'Advanced Settings' }).click();
        await page.waitForSelector('.settings-advanced-header');
        await page.click('.settings-advanced-back-btn');
        await page.waitForSelector('.settings-panel-content[data-settings-page]');
        assert.equal(await pageId(page), 'data');
        assert.deepEqual(await titles(page), ['Backup & Restore', 'Advanced']);
        await page.locator('.rail-btn[data-view="library"]').click();
        await openSettings(page);
        assert.equal(await pageId(page), 'general');
        assert.equal(await page.locator('.settings-menu').count(), 1);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Help > Keyboard shortcuts opens the list; with AI registered it also lists the AI keys', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const openIt = async () => {
            await page.getByRole('button', { name: 'Application menu' }).click();
            await page.locator('.menu[data-depth="0"] [role="menuitem"]', { hasText: 'Help' }).click();
            await page.locator('.menu[data-depth="1"] [role="menuitem"]', { hasText: 'Keyboard shortcuts' }).click();
            await page.locator('dialog.dialog', { hasText: 'Keyboard shortcuts' }).waitFor({ timeout: 3000 });
        };
        await openIt();
        const dlg = page.locator('dialog.dialog');
        assert.deepEqual(await dlg.locator('.shortcuts__title').allInnerTexts(), ['Playback', 'Views and lists', 'Application']);
        assert.equal(await dlg.locator('dt', { hasText: 'Play or pause' }).count(), 1);
        await page.keyboard.press('Escape');
        await page.evaluate(async () => {
            const slots = await import(new URL('shell/ai-slots.js', location.href).href);
            slots.registerAiChat({ mount() {} });
            slots.registerAiCommands({ undo() {}, shuffle() {} });
        });
        await openIt();
        assert.deepEqual(await page.locator('dialog.dialog .shortcuts__title').allInnerTexts(), ['Playback', 'Views and lists', 'Application', 'AI']);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Ctrl+Shift+S runs AI shuffle only: the engine S key (plain shuffle) does not also fire', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(async () => {
            const slots = await import(new URL('shell/ai-slots.js', location.href).href);
            window.__aiShuffle = 0;
            slots.registerAiChat({ mount() {} });
            slots.registerAiCommands({ shuffle: () => window.__aiShuffle++ });
            slots.setAiStatus({ enabled: true, privacyAccepted: true });
        });
        const state = () => page.evaluate(() => (typeof isShuffled !== 'undefined' ? isShuffled : 'n/a'));
        const before = await state();
        assert.notEqual(before, 'n/a', 'the test can see the engine shuffle state');
        await page.keyboard.press('Control+Shift+S');
        assert.equal(await page.evaluate(() => window.__aiShuffle), 1);
        assert.equal(await state(), before);
        await page.close();
    });
});

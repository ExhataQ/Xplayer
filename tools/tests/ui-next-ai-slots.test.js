// Tasks PA-17 and the notification contract E relies on: the AI slots in shell/ai-slots.js (settings section, chat view, top bar
// button, menu entries, hotkeys) and notify() with an Undo action.
//
// Run:   node --test tools/tests/ui-next-ai-slots.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('AI slots', { concurrency: false }, () => {
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

    const button = (page) => page.locator('button[aria-label="AI chat"], button[aria-label="Turn on AI in Settings"]');
    const view = (page) => page.evaluate(() => document.querySelector('.view-host').dataset.view);
    const register = (page, status) =>
        page.evaluate(async (initial) => {
            const slots = await import(new URL('shell/ai-slots.js', location.href).href);
            window.__ai = { undo: 0, shuffle: 0, destroyed: 0, seen: [] };
            slots.registerAiChat({
                mount(host, ctx) {
                    host.textContent = 'chat body';
                    ctx.onStatus((s) => window.__ai.seen.push(s.enabled));
                    return { destroy: () => window.__ai.destroyed++ };
                }
            });
            slots.registerAiPopup(null); // these tests cover the big-view path (used when there is no pop-up); the pop-up is tested in ui-next-ai.test.js
            slots.registerAiSettings({ mount(container, ctx) { container.textContent = 'ai settings body, enabled=' + ctx.getStatus().enabled; } });
            slots.registerAiCommands({ undo: () => window.__ai.undo++, shuffle: () => window.__ai.shuffle++ });
            slots.setAiStatus(initial);
        }, status);
    const setStatus = (page, status) =>
        page.evaluate(async (s) => (await import(new URL('shell/ai-slots.js', location.href).href)).setAiStatus(s), status);
    // Opens the logo menu and one group's submenu; returns the submenu's entries.
    const openGroup = async (page, group) => {
        if ((await page.locator('.menu').count()) === 0) await page.getByRole('button', { name: 'Application menu' }).click();
        await page.locator('.menu[data-depth="0"] [role="menuitem"]', { hasText: group }).click();
        return page.locator('.menu[data-depth="1"]');
    };
    const menuTexts = async (page, group) => (await (await openGroup(page, group)).locator('[role="menuitem"]').allInnerTexts());

    // Agent E's views/ai/register.js is called by the shell at start-up, so the AI parts exist from the first frame. The slots were
    // first tested with nothing registered (before register.js did anything); the other tests below register their own stand-ins.
    test('at start-up the real AI screens are registered: a disabled chat button, no rail item, and the AI menu entries', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await button(page).waitFor({ state: 'visible', timeout: 3000 });
        assert.equal(await button(page).getAttribute('aria-disabled'), 'true');
        assert.equal(await page.locator('.rail-btn[data-view="ai-chat"]').count(), 0);
        const texts = [...(await menuTexts(page, 'Edit')), ...(await menuTexts(page, 'Tools')), ...(await menuTexts(page, 'Playback'))].join('|');
        assert.match(texts, /AI chat/);
        assert.match(texts, /AI shuffle/);
        assert.match(texts, /Undo/);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('AI off: the button is announced as "Turn on AI in Settings" and leads to Settings', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await register(page, { enabled: false });
        const b = page.locator('button[aria-label="Turn on AI in Settings"]');
        assert.equal(await b.isVisible(), true);
        assert.equal(await b.getAttribute('aria-disabled'), 'true');
        await b.hover();
        await page.locator('.tooltip', { hasText: 'Turn on AI in Settings' }).waitFor({ timeout: 2000 });
        await b.click({ force: true }); // aria-disabled: Playwright treats it as not enabled, a person can still press it
        assert.equal(await view(page), 'settings');
        await page.close();
    });

    test('AI on: the button opens the chat as a main view with no rail item, and a second press goes back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await register(page, { enabled: true, privacyAccepted: true, hasKey: true });
        const b = page.locator('button[aria-label="AI chat"]');
        assert.equal(await b.getAttribute('aria-disabled'), 'false');
        await b.click({ force: true }); // aria-disabled: Playwright treats it as not enabled, a person can still press it
        assert.equal(await view(page), 'ai-chat');
        assert.equal(await page.locator('.view-host').innerText(), 'chat body');
        assert.equal(await b.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.rail-btn[aria-current="page"]').count(), 0);
        await b.click({ force: true }); // aria-disabled: Playwright treats it as not enabled, a person can still press it
        assert.equal(await view(page), 'library');
        assert.equal(await page.evaluate(() => window.__ai.destroyed), 1);
        await setStatus(page, { enabled: false });
        await page.locator('button[aria-label="Turn on AI in Settings"]').waitFor({ timeout: 2000 });
        await page.close();
    });

    test('the Settings section appears after the engine draws Settings and follows the status', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await register(page, { enabled: false });
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.locator('.settings-menu [data-page="ai"]').click(); // Settings opens on General; the AI tab opens the AI page
        const section = page.locator('.ai-settings');
        await section.waitFor({ timeout: 4000 });
        assert.equal(await section.locator('.settings-section-title').innerText(), 'AI');
        assert.match(await section.locator('.ai-settings__body').innerText(), /enabled=false/);
        assert.equal(await page.locator('.ai-settings').count(), 1);
        await page.close();
    });

    test('menu entries and hotkeys: Undo works while AI is off; chat and shuffle need AI on', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await register(page, { enabled: false });
        assert.match((await menuTexts(page, 'Tools')).join('|'), /AI chat/);
        assert.match((await menuTexts(page, 'Playback')).join('|'), /AI shuffle/);
        assert.equal(await page.locator('.menu[data-depth="1"] [role="menuitem"]', { hasText: 'AI shuffle' }).getAttribute('aria-disabled'), 'true');
        await page.keyboard.press('Escape');
        assert.match((await menuTexts(page, 'Edit')).join('|'), /Undo/);
        await page.locator('.menu[data-depth="1"] [role="menuitem"]', { hasText: 'Undo' }).click();
        assert.equal(await page.evaluate(() => window.__ai.undo), 1);
        await page.keyboard.press('Control+Shift+U');
        assert.equal(await page.evaluate(() => window.__ai.undo), 2);
        await page.keyboard.press('Control+Shift+S');
        await page.keyboard.press('Control+Shift+A');
        assert.deepEqual(await page.evaluate(() => [window.__ai.shuffle, document.querySelector('.view-host').dataset.view]), [0, 'library']);
        await setStatus(page, { enabled: true, privacyAccepted: true });
        await page.keyboard.press('Control+Shift+S');
        await page.keyboard.press('Control+Shift+A');
        assert.deepEqual(await page.evaluate(() => [window.__ai.shuffle, document.querySelector('.view-host').dataset.view]), [1, 'ai-chat']);
        await page.close();
    });

    test('notify contract E relies on: update() changes only title, detail, target and action', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const seen = await page.evaluate(async () => {
            const n = await import(new URL('shell/notify.js', location.href).href);
            const h = n.notify({ title: 'Plan applied', kind: 'success', where: 'center', action: { label: 'Undo', onClick() {} } });
            let list = [];
            n.watchShellNotifications((l) => (list = l));
            h.update({ title: 'Plan applied (3)', detail: 'd', kind: 'error', where: 'toast', important: true, id: 'x' });
            const e = list.find((x) => x.id === h.id);
            const after = { title: e.title, detail: e.detail, type: e.type, id: e.id, hasAction: Boolean(e.action) };
            h.update({ action: null });
            return { after, cleared: !list.find((x) => x.id === h.id).action };
        });
        assert.deepEqual(seen.after, { title: 'Plan applied (3)', detail: 'd', type: 'success', id: seen.after.id, hasAction: true });
        assert.notEqual(seen.after.id, 'x');
        assert.equal(seen.cleared, true);
        await page.close();
    });

    test('notify contract: an entry with an action stays in the center after its toast is dismissed; dismissing in its own click is safe', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate(async () => {
            const n = await import(new URL('shell/notify.js', location.href).href);
            window.undone = 0;
            const h = n.notify({ title: 'Reordered 12 songs', action: { label: 'Undo', onClick: () => { window.undone++; h.dismiss(); h.update({ action: null }); } } });
            n.notify({ title: 'Kept entry', action: { label: 'Undo', onClick() {} } });
        });
        const toast = page.locator('.toast', { hasText: 'Kept entry' });
        await toast.waitFor({ timeout: 2000 });
        await toast.getByRole('button', { name: 'Dismiss' }).click();
        await toast.waitFor({ state: 'detached', timeout: 2000 });
        await page.locator('button[aria-label^="Notifications"]').click();
        const kept = page.locator('.notif', { hasText: 'Kept entry' });
        await kept.waitFor({ timeout: 2000 });
        assert.equal(await kept.getByRole('button', { name: 'Undo' }).count(), 1);
        await page.locator('.notif', { hasText: 'Reordered 12 songs' }).getByRole('button', { name: 'Undo' }).click();
        assert.equal(await page.evaluate(() => window.undone), 1);
        assert.equal(await page.locator('.notif', { hasText: 'Reordered 12 songs' }).count(), 0);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

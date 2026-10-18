// Task A-07: toasts and the notification center behind the title bar bell, driven by the real, unchanged engine.
// The engine's own showNotification() and progress functions are called exactly as the app calls them.
//
// Run:   node --test tools/tests/ui-next-notifications.test.js
// Needs: npm i -D playwright

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('A-07 static rules', () => {
    const read = (...parts) => fs.readFileSync(path.join(NEXT_SRC, ...parts), 'utf8');

    test('the notification styles use tokens only', () => {
        const css = read('shell', 'notifications.css');
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, 'no raw color');
        assert.doesNotMatch(css, /--c-[a-z]/, 'no primitive color names');
        for (const name of new Set(css.match(/var\(--[a-z0-9-]+/g) || [])) {
            assert.ok(read('tokens.css').includes(`${name.slice(4)}:`), `${name.slice(4)} is a defined token`);
        }
    });

    test('the center reads the engine only through the bridge and the components', () => {
        const source = read('shell', 'notification-center.js');
        const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
        assert.deepEqual(imports.sort(), ['../adapter/notifications-bridge.js', '../components/index.js']);
        assert.doesNotMatch(source, /\bwindow\s*\.\s*(?:notificationHistory|showNotification|removeNotificationItem|clearAllNotifications)/);
    });

    test('the bridge stays small (counts toward the adapter budget, D18)', () => {
        const lines = read('adapter', 'notifications-bridge.js')
            .split(/\r?\n/)
            .filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l)).length;
        assert.ok(lines <= 60, `notifications-bridge.js uses ${lines} code lines (maximum 60)`);
    });
});

describe('A-07 notification center with the real engine', { concurrency: false }, () => {
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

    async function open(viewport = { width: 1400, height: 860 }) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        return { page, errors };
    }

    const bell = (page) => page.locator('.titlebar .icon-btn[aria-controls="notification-center"]');
    const center = (page) => page.locator('#notification-center');
    const notify = (page, ...args) => page.evaluate((a) => showNotification(...a), args);

    test('the bell exists, is a labelled button and the center starts closed', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        assert.equal(await bell(page).count(), 1);
        assert.equal(await bell(page).getAttribute('aria-label'), 'Notifications');
        assert.equal(await bell(page).getAttribute('aria-expanded'), 'false');
        assert.equal(await center(page).isVisible(), false);
        assert.equal(await bell(page).getAttribute('data-dot'), null, 'no dot with nothing to read');
        assert.equal(await page.evaluate(() => document.getElementById('notification-panel-list').hidden), true, 'the engine draws into a hidden element');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('an engine notification becomes a toast and puts a dot on the bell; opening the center clears the dot', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await notify(page, 'Playlist saved', 'success');
        const toast = page.locator('.toast', { hasText: 'Playlist saved' });
        await toast.waitFor({ timeout: 2000 });
        assert.equal(await toast.getAttribute('role'), 'status');
        assert.equal(await toast.getAttribute('data-kind'), 'success');
        assert.equal(await bell(page).getAttribute('data-dot'), 'unread');
        assert.equal(await bell(page).getAttribute('aria-label'), 'Notifications, 1 unread');

        await bell(page).click();
        assert.equal(await center(page).isVisible(), true);
        assert.equal(await bell(page).getAttribute('aria-expanded'), 'true');
        assert.equal(await bell(page).getAttribute('data-dot'), null, 'read once the center was open');
        assert.equal(await center(page).locator('.notif-section[aria-label="Earlier"] .notif__title').innerText(), 'Playlist saved');
        assert.equal(await center(page).locator('.notif-section[aria-label="In progress"]').count(), 0);
        await page.close();
    });

    test('only wording that says a failure is shown as an error; removals the engine calls errors are plain information', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await notify(page, 'Failed to save', 'error');
        await notify(page, 'Playlist "Road" deleted', 'error');
        await notify(page, 'No song playing', 'warning');
        const role = async (text) => page.locator('.toast', { hasText: text }).getAttribute('role');
        assert.equal(await role('Failed to save'), 'alert');
        assert.equal(await role('Playlist "Road" deleted'), 'status');
        assert.equal(await page.locator('.toast', { hasText: 'No song playing' }).getAttribute('data-kind'), 'info');
        await bell(page).click();
        const kinds = await center(page).locator('.notif').evaluateAll((rows) => rows.map((r) => [r.querySelector('.notif__title').textContent, r.dataset.kind]));
        assert.deepEqual(kinds, [['No song playing', 'warning'], ['Playlist "Road" deleted', 'info'], ['Failed to save', 'error']]);
        await page.close();
    });

    test('at most three toasts at once; every notification is still in the center', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        for (let i = 1; i <= 5; i++) await notify(page, `Added ${i}`, 'success');
        assert.equal(await page.locator('.toast').count(), 3);
        await bell(page).click();
        assert.equal(await center(page).locator('.notif').count(), 5);
        assert.equal(await center(page).locator('.notif-section__count').innerText(), '5');
        await page.close();
    });

    test('notifications that arrive in one burst keep the newest toast on screen', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => ['a', 'b', 'c', 'd', 'e'].forEach((x) => showNotification(`Burst ${x}`, 'success')));
        const shown = await page.locator('.toast .toast__title').allInnerTexts();
        assert.deepEqual(shown, ['Burst c', 'Burst d', 'Burst e']);
        await page.close();
    });

    test('dismiss removes one entry from the engine; Clear all empties it and shows the empty state', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await notify(page, 'One', 'success');
        await notify(page, 'Two', 'success');
        await bell(page).click();
        await center(page).locator('.notif', { hasText: 'One' }).getByRole('button', { name: 'Dismiss' }).click();
        assert.deepEqual(await page.evaluate(() => notificationHistory.map((n) => n.message)), ['Two']);
        assert.equal(await center(page).locator('.notif').count(), 1);
        await center(page).getByRole('button', { name: 'Clear all' }).click();
        assert.equal(await page.evaluate(() => notificationHistory.length), 0);
        assert.equal(await center(page).locator('.empty-state__title').innerText(), 'Nothing new');
        assert.equal(await center(page).getByRole('button', { name: 'Clear all' }).isDisabled(), true);
        await page.close();
    });

    test('running work: the bar moves in place, the dot says running, and finishing moves it to Earlier with a toast', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => showCoverProgressNotification(5, 10, 2));
        assert.equal(await bell(page).getAttribute('data-dot'), 'running');
        assert.match(await bell(page).getAttribute('aria-label'), /1 in progress/);
        assert.equal(await page.locator('.toast').count(), 0, 'progress is not a toast');
        await bell(page).click();
        const row = center(page).locator('.notif-section[aria-label="In progress"] .notif');
        assert.equal(await row.locator('.notif__title').innerText(), 'Finding album art');
        assert.equal(await row.locator('[role="progressbar"]').getAttribute('aria-valuenow'), '50');
        assert.match(await row.locator('.notif__detail').innerText(), /2 found/);
        const handle = await row.elementHandle();

        await page.evaluate(() => showCoverProgressNotification(8, 10, 4));
        assert.equal(await row.locator('[role="progressbar"]').getAttribute('aria-valuenow'), '80');
        assert.equal(await handle.evaluate((n) => n.isConnected), true, 'the same row was updated, not rebuilt');
        assert.equal(await row.locator('.notif__percent').innerText(), '80%');
        assert.equal(await row.getByRole('button').count(), 0, 'there is no cancel or dismiss on running work the engine cannot stop');

        await page.evaluate(() => completeCoverProgressNotification());
        assert.equal(await center(page).locator('.notif-section[aria-label="In progress"]').count(), 0);
        assert.equal(await center(page).locator('.notif-section[aria-label="Earlier"] .notif__title').innerText(), 'Album art finished loading');
        assert.equal(await page.locator('.toast').count(), 0, 'no toast while the center is open: the person is looking at it');
        await page.close();
    });

    test('finishing while the center is closed gives a toast', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => showCoverProgressNotification(1, 2, 1));
        await page.evaluate(() => completeCoverProgressNotification());
        await page.locator('.toast', { hasText: 'Album art finished loading' }).waitFor({ timeout: 2000 });
        assert.equal(await bell(page).getAttribute('data-dot'), 'unread');
        await page.close();
    });

    test('keyboard and pointer: Escape closes and returns focus to the bell; a press outside closes', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await notify(page, 'Saved', 'success');
        await bell(page).focus();
        await page.keyboard.press('Enter');
        assert.equal(await center(page).isVisible(), true);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'notification-center', 'focus moves into the center');
        await page.keyboard.press('Escape');
        assert.equal(await center(page).isVisible(), false);
        assert.equal(await bell(page).evaluate((n) => n === document.activeElement), true);
        await bell(page).click();
        await page.mouse.click(300, 400);
        assert.equal(await center(page).isVisible(), false);
        assert.equal(await bell(page).getAttribute('aria-expanded'), 'false');
        await page.close();
    });

    test('the center sits fully inside a small window, below the title bar, above the toasts', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ width: 800, height: 600 });
        for (let i = 0; i < 12; i++) await notify(page, `A longer notification text number ${i} that has to wrap inside the narrow card`, 'success');
        await bell(page).click();
        const box = await center(page).boundingBox();
        assert.ok(box.x >= 0 && box.y >= 36 && box.x + box.width <= 800 && box.y + box.height <= 600, `inside the window: ${JSON.stringify(box)}`);
        assert.equal(await center(page).locator('.notif-center__body').evaluate((n) => n.scrollWidth <= n.clientWidth), true, 'no sideways scroll');
        assert.equal(await center(page).evaluate((n) => getComputedStyle(n).zIndex), '60');
        assert.equal(await page.evaluate(() => scrollX === 0 && document.documentElement.scrollWidth <= innerWidth), true);
        await page.close();
    });

    test('right-to-left text: titles use dir=auto; text is not injected as markup', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await notify(page, 'تم حفظ القائمة', 'success');
        await notify(page, '<img src=x onerror="window.__xss=1"> done', 'success');
        await bell(page).click();
        assert.equal(await center(page).locator('.notif__title').first().getAttribute('dir'), 'auto');
        assert.equal(await page.evaluate(() => window.__xss), undefined);
        assert.equal(await center(page).locator('.notif img').count(), 0);
        assert.match(await center(page).locator('.notif__title').first().innerText(), /<img/);
        await page.close();
    });

    test('the engine\'s own bell, badge and panel are not used: no old notification element is on screen', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await notify(page, 'Saved', 'success');
        const visible = await page.evaluate(() => ['notification-badge', 'notification-panel', 'notification-panel-btn'].filter((id) => document.getElementById(id)?.offsetParent !== null && document.getElementById(id)));
        assert.deepEqual(visible, []);
        await page.close();
    });
});

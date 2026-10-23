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
        assert.deepEqual(imports.sort(), ['../adapter/notifications-bridge.js', '../components/index.js', './notify.js']);
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
        await notify(page, 'Playlist "Road" deleted', 'error');
        await notify(page, 'No song playing', 'warning');
        const role = async (text) => page.locator('.toast', { hasText: text }).getAttribute('role');
        assert.equal(await role('Playlist "Road" deleted'), 'status');
        assert.equal(await page.locator('.toast', { hasText: 'No song playing' }).getAttribute('data-kind'), 'info');
        await notify(page, 'Failed to save', 'error'); // the first failure opens the center by itself (PA-06), so it has no toast
        assert.equal(await center(page).isVisible(), true, 'a failure opens the center');
        assert.equal(await page.locator('.toast', { hasText: 'Failed to save' }).count(), 0);
        const kinds = await center(page).locator('.notif').evaluateAll((rows) => rows.map((r) => [r.querySelector('.notif__title').textContent, r.dataset.kind]));
        assert.deepEqual(kinds, [['Failed to save', 'error'], ['No song playing', 'warning'], ['Playlist "Road" deleted', 'info']]);
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
        assert.deepEqual(await row.getByRole('button').allInnerTexts(), ['Cancel'], 'running work has Cancel (D41) and no Dismiss');

        await page.evaluate(() => completeCoverProgressNotification());
        assert.equal(await center(page).locator('.notif-section[aria-label="In progress"]').count(), 0);
        assert.equal(await center(page).locator('.notif-section[aria-label="Earlier"] .notif__title').innerText(), 'Album art finished loading');
        assert.equal(await page.locator('.toast').count(), 0, 'no toast while the center is open: the person is looking at it');
        await page.close();
    });

    // The page's desktop bridge as the real app has it for D41: a recording stand-in with a download that stays open until cancelled.
    const withCancelBridge = (page) =>
        page.evaluate(() => {
            window.__calls = [];
            window.__resolveDownload = null;
            window.electronAPI = new Proxy({}, {
                get: (t, k) => {
                    if (k === 'then') return undefined;
                    if (k === 'downloadAndScan') return () => new Promise((resolve) => (window.__resolveDownload = resolve));
                    if (k === 'cancelDownload') return () => (window.__calls.push('download'), window.__resolveDownload({ success: false, cancelled: true, error: 'Download cancelled' }), Promise.resolve({ cancelled: true }));
                    if (k === 'cancelCoverSearch') return () => (window.__calls.push('cover'), Promise.resolve({ cancelled: true }));
                    return (...a) => (/^on[A-Z]/.test(String(k)) ? () => {} : Promise.resolve(null));
                }
            });
        });

    test('Cancel on the album art search asks the main process to stop, says so, and ends as "stopped" (D41)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await withCancelBridge(page);
        await page.evaluate(() => showCoverProgressNotification(5, 10, 2));
        await bell(page).click();
        const row = center(page).locator('.notif-section[aria-label="In progress"] .notif');
        await row.getByRole('button', { name: 'Cancel album art search' }).click();
        assert.deepEqual(await page.evaluate(() => window.__calls), ['cover']);
        assert.equal(await row.locator('.notif__title').innerText(), 'Stopping album art search');
        await page.evaluate(() => completeCoverProgressNotification({ cancelled: true })); // what the main process sends once the scan has wound down
        assert.equal(await center(page).locator('.notif-section[aria-label="In progress"]').count(), 0);
        assert.equal(await center(page).locator('.notif-section[aria-label="Earlier"] .notif__title').innerText(), 'Album art search stopped');
        assert.equal(await page.evaluate(() => notificationHistory[0].type), 'info', 'stopping is not a failure');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Cancel on a download stops it, removes its row, says "Download cancelled", and a new download can start (D41)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await withCancelBridge(page);
        const start = () =>
            page.evaluate(() => {
                document.getElementById('link-url-input')?.remove();
                const input = document.createElement('input');
                input.id = 'link-url-input';
                input.value = 'http://example.test/song.mp3';
                document.body.append(input);
                playFromUrl(false);
            });
        await start();
        await bell(page).click();
        const row = center(page).locator('.notif-section[aria-label="In progress"] .notif');
        assert.equal(await row.locator('.notif__title').innerText(), 'Downloading');
        await row.getByRole('button', { name: 'Cancel download' }).click();
        await page.waitForFunction(() => window.__calls.length === 1 && !document.querySelector('#notification-center .notif-section[aria-label="In progress"]'));
        assert.deepEqual(await page.evaluate(() => window.__calls), ['download']);
        assert.equal(await center(page).locator('.notif-section[aria-label="Earlier"] .notif__title').first().innerText(), 'Download cancelled');
        assert.equal(await page.evaluate(() => notificationHistory.some((n) => n.isDownloadProgress)), false, 'no progress entry is left behind');
        await start();
        await page.waitForFunction(() => notificationHistory.some((n) => n.isDownloadProgress));
        assert.deepEqual(errors, []);
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

    // ---------------------------------------------------------------- PA-06: the notification API

        test('PA-06: the first important entry opens the center without taking focus, and only the first one does', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.locator('.rail-btn[data-view="search"]').focus();
        await notify(page, 'Playlist saved', 'success');
        assert.equal(await center(page).isVisible(), false, 'an ordinary entry does not open it');
        await notify(page, 'Could not read file', 'error');
        assert.equal(await center(page).isVisible(), true);
        assert.equal(await page.evaluate(() => document.activeElement?.closest('#notification-center') === null), true, 'focus stays where it was');
        await page.keyboard.press('Escape');
        await notify(page, 'Download failed', 'error');
        assert.equal(await center(page).isVisible(), false, 'it opens once per session');
        assert.ok(await page.locator('.toast', { hasText: 'Download failed' }).count(), 'later failures are toasts');
        await page.close();
    });

    test('PA-06: an entry with a target is clickable; it closes the center and opens the view', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(async () => {
            const { notify } = await import(new URL('shell/notify.js', location.href).href);
            notify({ title: 'LRC found', kind: 'success', where: 'center', target: { label: 'Open lyrics', view: 'lyrics' } });
        });
        assert.equal(await page.locator('.toast', { hasText: 'LRC found' }).count(), 0, 'a quiet entry has no toast');
        assert.equal(await bell(page).getAttribute('data-dot'), 'unread', 'but the bell has its dot');
        await bell(page).click();
        await center(page).locator('.notif', { hasText: 'LRC found' }).getByRole('button', { name: 'Open lyrics' }).click();
        assert.equal(await center(page).isVisible(), false);
        assert.equal(await page.evaluate(() => document.querySelector('.view-host').dataset.view), 'lyrics');
        await page.close();
    });

    test('PA-06: an action button (Undo) shows on the toast and in the center, and runs once', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(async () => {
            const { notify } = await import(new URL('shell/notify.js', location.href).href);
            window.undone = 0;
            notify({ title: 'Moved 3 songs', action: { label: 'Undo', onClick: () => (window.undone += 1) } });
        });
        const toast = page.locator('.toast', { hasText: 'Moved 3 songs' });
        await toast.waitFor({ timeout: 2000 });
        await toast.getByRole('button', { name: 'Undo' }).click();
        assert.equal(await page.evaluate(() => window.undone), 1);
        await bell(page).click();
        await center(page).locator('.notif', { hasText: 'Moved 3 songs' }).getByRole('button', { name: 'Undo' }).click();
        assert.equal(await page.evaluate(() => window.undone), 2);
        await page.close();
    });

    test('PA-06: where "toast" leaves no entry and where "both" is a toast and an entry', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(async () => {
            const { notify } = await import(new URL('shell/notify.js', location.href).href);
            notify({ title: 'Only a toast', where: 'toast' });
            notify({ title: 'Both places', where: 'both' });
        });
        await page.locator('.toast', { hasText: 'Only a toast' }).waitFor({ timeout: 2000 });
        await page.locator('.toast', { hasText: 'Both places' }).waitFor({ timeout: 2000 });
        await bell(page).click();
        assert.deepEqual(await center(page).locator('.notif__title').allInnerTexts(), ['Both places']);
        await page.close();
    });

    test('PA-06: notifyProgress shows a bar that moves, can be cancelled, and done() moves it to Earlier with a toast', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(async () => {
            const { notifyProgress } = await import(new URL('shell/notify.js', location.href).href);
            window.cancelled = 0;
            window.job = notifyProgress({ title: 'Finding lyrics', kind: 'job', onCancel: () => (window.cancelled += 1), target: { view: 'lyrics' } });
            window.job.update({ percent: 40, status: '4 of 10' });
        });
        assert.equal(await bell(page).getAttribute('data-dot'), 'running');
        await bell(page).click();
        const row = center(page).locator('.notif-section[aria-label="In progress"] .notif', { hasText: 'Finding lyrics' });
        assert.match(await row.innerText(), /4 of 10/);
        assert.match(await row.innerText(), /40%/);
        await row.getByRole('button', { name: 'Cancel task' }).click();
        assert.equal(await page.evaluate(() => window.cancelled), 1);
        await page.evaluate(() => window.job.done({ title: 'Found lyrics for 8 of 10', target: { label: 'Open results', view: 'lyrics' } }));
        assert.equal(await center(page).locator('.notif-section[aria-label="In progress"]').count(), 0);
        assert.equal(await center(page).locator('.notif-section[aria-label="Earlier"] .notif__title').innerText(), 'Found lyrics for 8 of 10');
        await page.close();
    });

    test('PA-06: the bell swings when something new arrives and the attribute clears itself', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await notify(page, 'Playlist saved', 'success');
        assert.equal(await bell(page).evaluate((b) => b.hasAttribute('data-ring')), true);
        await page.waitForFunction(() => !document.querySelector('.titlebar [aria-controls="notification-center"]').hasAttribute('data-ring'), null, { timeout: 3000 });
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

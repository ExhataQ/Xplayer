'use strict';

// Agent D, step D-09b: 06c, 06d, 06e, 06h and 06j are ES modules (see "modules" in src/manifest.json).
// Browser checks (Playwright, skipped if it is missing): in the real page everything the classic
// scripts used from these files is still on window, and the behavior the files add still works.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'manifest.json'), 'utf8'));
const FILES = ['06c-scrollbar-widget.js', '06d-tooltip-system.js', '06e-tooltip-titles.js', '06h-fullscreen-viewer.js', '06j-notification-system.js'];

describe('D-09b: manifest', () => {
    test('the five files are modules and no longer classic scripts', () => {
        for (const f of FILES) {
            assert.ok(manifest.modules.includes(f), `${f} should be under modules`);
            assert.ok(!manifest.js.includes(f), `${f} should not be a classic script`);
        }
    });
    test('they keep their relative order (their document listeners register in this order)', () => {
        const idx = FILES.map((f) => manifest.modules.indexOf(f));
        assert.deepEqual([...idx].sort((a, b) => a - b), idx);
    });
    test('ui/player-bar.js does not pass openImageViewer to addEventListener while loading', () => {
        const source = fs.readFileSync(path.join(ROOT, 'src/js/ui/player-bar.js'), 'utf8');
        assert.ok(!/addEventListener\('click',\s*openImageViewer\)/.test(source));
    });
});

describe('D-09b: real page', () => {
    let pw, browser, dir, skip;
    before(async () => {
        pw = loadPlaywright();
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    async function openPage() {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto('file://' + path.join(dir, 'index.html'));
        await page.waitForTimeout(600);
        return { page, errors };
    }

    test('registered names are on window, and the implicit global is now a window property', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(() => {
            const names = ['updateScrollbarById', 'initExternalScrollbar', 'temporarilySuppressTooltip', 'openImageViewer', 'closeImageViewer', 'showNotification',
                'showCoverProgressNotification', 'completeCoverProgressNotification', 'toggleNotificationPanel', 'closeNotificationPanel', 'clearAllNotifications',
                'removeNotificationItem', 'renderNotificationPanel'];
            return { missing: names.filter((n) => typeof window[n] !== 'function'), external: typeof window.updateExternalScrollbar };
        });
        assert.deepEqual(result.missing, []);
        assert.equal(result.external, 'function', 'the main-content scrollbar publishes updateExternalScrollbar');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the shared variables still work from classic code and the setters (mouse position, notifications)', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(() => {
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 123, clientY: 45, bubbles: true }));
            const out = { x: lastMouseX, y: lastMouseY };
            setLastMouseX(7);
            out.setter = lastMouseX;
            showNotification('probe message', 'info', 5000);
            out.history = notificationHistory.some((n) => n.message === 'probe message');
            out.badgeToast = !!document.querySelector('.notification-toast, .notification-toast-container, [class*="toast"]');
            return out;
        });
        assert.deepEqual({ x: result.x, y: result.y, setter: result.setter, history: result.history }, { x: 123, y: 45, setter: 7, history: true });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('album art click opens the image viewer and the viewer closes again', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const img = document.getElementById('album-art-image');
            const viewer = document.getElementById('image-viewer');
            const out = { hasImg: !!img };
            img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
            img.click();
            await sleep(100);
            out.opened = viewer.classList.contains('active');
            closeImageViewer();
            await sleep(400);
            out.closed = !viewer.classList.contains('active');
            return out;
        });
        assert.equal(result.hasImg, true);
        assert.equal(result.opened, true);
        assert.equal(result.closed, true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('titles become data-original-title and a hover shows the tooltip', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await page.evaluate(() => ({
            tip: document.getElementById('shuffle-btn').getAttribute('data-original-title'),
            leftTitles: document.querySelectorAll('#shuffle-btn[title]').length
        }));
        assert.equal(result.tip, 'Shuffle');
        assert.equal(result.leftTitles, 0);
        await page.hover('#shuffle-btn');
        await page.waitForTimeout(1200);
        const shown = await page.evaluate(() => [...document.querySelectorAll('.custom-tooltip')].some((e) => e.textContent.trim() === 'Shuffle' && e.style.opacity === '1'));
        assert.equal(shown, true);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

// Names the Electron main process calls inside the page by bare name (webContents.executeJavaScript in
// electron/main.js and electron/window-manager.js). They only work if the name is a global function once the page has
// loaded, which for a function that lives in an ES module means it has to be registered with registerLegacyGlobals.
// A missing name fails silently (the injected code is guarded by typeof, or throws inside Electron where nobody
// sees it), so this runs the injected snippets the way Electron does, in the page's global scope.
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const ELECTRON = path.resolve(__dirname, '..', '..', 'electron');
// name -> the snippet Electron runs (copied from the electron/ sources).
const INJECTED = {
    updateDownloadNotification: "if (typeof updateDownloadNotification === 'function') { updateDownloadNotification(50, 'Downloading...'); }",
    showWelcomeDialog: 'showWelcomeDialog();',
    recalcLayoutWidths: "if (typeof recalcLayoutWidths === 'function') { recalcLayoutWidths(); }"
};

describe('names called by the Electron main process', () => {
    test('every name in this test is still referenced by the electron/ sources', () => {
        const source = fs
            .readdirSync(ELECTRON)
            .filter((f) => f.endsWith('.js'))
            .map((f) => fs.readFileSync(path.join(ELECTRON, f), 'utf8'))
            .join('\n');
        for (const name of Object.keys(INJECTED)) assert.ok(source.includes(name), `${name} is no longer used by electron/; remove it here`);
    });
});

describe('names called by the Electron main process (real page)', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(5);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await gotoApp(page, dir);
        return { page, errors };
    }

    test('each name is a global function after start-up', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            for (const name of Object.keys(INJECTED)) {
                assert.equal(await page.evaluate(`typeof ${name}`), 'function', name);
            }
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('download progress: with no download notification showing, the update does nothing', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            const before = await page.evaluate('notificationHistory.length');
            await page.evaluate(INJECTED.updateDownloadNotification);
            assert.equal(await page.evaluate('notificationHistory.length'), before);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('welcome dialog: opens only when there are no songs, and "Continue Empty" closes it', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            const overlays = () => page.evaluate(() => document.querySelectorAll('.playlist-modal-overlay').length);
            await page.evaluate(INJECTED.showWelcomeDialog);
            assert.equal(await overlays(), 0, 'with songs in the library it stays closed');
            await page.evaluate('SONGS_DATA.length = 0');
            await page.evaluate(INJECTED.showWelcomeDialog);
            assert.equal(await overlays(), 1);
            await page.evaluate(() => document.getElementById('welcome-continue-empty').click());
            assert.equal(await overlays(), 0);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('layout recalculation runs without error', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            await page.evaluate(INJECTED.recalcLayoutWidths);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
});

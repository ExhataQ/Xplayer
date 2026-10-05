// whenAppReady (core/legacy.js): a message from the main process that arrives while the page is
// still starting up must wait until start-up has finished. Before the gate, the cover-scan
// callbacks ran at once and failed with "X is not defined" (a function that lives in an ES module,
// or SONGS_DATA from player.js, did not exist yet).
//
// The page is loaded with an electronAPI whose onScanCoverBatch / onScanCoversComplete call their
// callback the moment they are subscribed, which is as early as a message can possibly arrive.
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

describe('start-up gate for messages from the main process', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(10);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    async function openWithEarlyMessages(batches) {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        const consoleErrors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
        await page.addInitScript((list) => {
            window.__order = [];
            const fake = new Proxy({}, {
                get: (target, key) => {
                    if (key === 'then') return undefined;
                    if (key === 'onScanCoverBatch') return (cb) => list.forEach((b) => cb(b));
                    if (key === 'onScanCoversComplete') return (cb) => cb();
                    if (/^on[A-Z]/.test(String(key))) return () => {};
                    return () => Promise.resolve(null);
                }
            });
            // The test fixture installs its own stub later; this getter keeps ours in place.
            Object.defineProperty(window, 'electronAPI', { get: () => fake, set: () => {}, configurable: true });
        }, batches);
        await page.goto('file://' + path.join(dir, 'index.html').replace(/\\/g, '/'));
        await page.waitForTimeout(1200);
        return { page, errors, consoleErrors };
    }

    test('cover-scan messages that arrive during start-up are applied afterwards, without errors', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openWithEarlyMessages([
            { processed: 1, total: 2, found: 1, updates: [{ id: 0, cover: 'data:,first', largeCover: 'data:,first-large' }] },
            { processed: 2, total: 2, found: 2, updates: [{ id: 0, cover: 'data:,second', largeCover: 'data:,second-large' }] }
        ]);
        const cover = await page.evaluate(() => SONGS_DATA[0].cover);
        assert.equal(cover, 'data:,second', 'both batches applied, in the order they arrived');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a callback that throws is reported and does not stop the ones queued after it', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors, consoleErrors } = await openWithEarlyMessages([
            { processed: 1, total: 2, found: 0, updates: 5 },
            { processed: 2, total: 2, found: 1, updates: [{ id: 1, cover: 'data:,ok', largeCover: 'data:,ok-large' }] }
        ]);
        assert.equal(await page.evaluate(() => SONGS_DATA[1].cover), 'data:,ok');
        assert.ok(consoleErrors.some((m) => m.includes('[whenAppReady] callback failed')), 'the failure is logged');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('after start-up, whenAppReady runs its function at once', { timeout: 30000 }, async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openWithEarlyMessages([]);
        const ran = await page.evaluate(() => { let n = 0; whenAppReady(() => { n++; }); return n; });
        assert.equal(ran, 1);
        await assert.rejects(page.evaluate(() => whenAppReady('nope')), /expected a function/);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

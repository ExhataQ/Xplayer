// Tests for the shared browser fixture itself (helpers/app-fixture.js): the browser fallback and the
// "start-up has settled" wait that replaced the fixed waitForTimeout calls. Uses a fake Playwright object for
// the fallback tests, so only the last test needs a real browser (skipped if none is found).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPlaywright, launch, gotoApp, launchCacheFile } = require('./helpers/app-fixture');

function fakePlaywright(workingIndex) {
    const calls = [];
    return {
        calls,
        chromium: {
            async launch(opts) {
                calls.push(opts.channel || 'bundled');
                const order = [undefined, 'msedge', 'chrome'];
                if (workingIndex === -1 || order[workingIndex] !== opts.channel) throw new Error('no such browser');
                return { fake: true, channel: opts.channel || 'bundled' };
            }
        }
    };
}

describe('browser launch fallback', { concurrency: false }, () => {
    let savedId;
    before(() => {
        savedId = process.env.XPLAYER_TEST_RUN_ID;
        delete process.env.XPLAYER_TEST_RUN_ID;
    });
    after(() => {
        if (savedId === undefined) delete process.env.XPLAYER_TEST_RUN_ID;
        else process.env.XPLAYER_TEST_RUN_ID = savedId;
    });

    test('tries bundled Chromium, then Edge, then Chrome, and returns the first that starts', async () => {
        const pw = fakePlaywright(2);
        const browser = await launch(pw);
        assert.equal(browser.channel, 'chrome');
        assert.deepEqual(pw.calls, ['bundled', 'msedge', 'chrome']);
    });

    test('returns null (callers then skip) when no browser starts, and without Playwright', async () => {
        const pw = fakePlaywright(-1);
        assert.equal(await launch(pw), null);
        assert.equal(pw.calls.length, 3);
        assert.equal(await launch(null), null);
    });

    test('without a run id nothing is cached: every launch starts the fallback from the beginning', async () => {
        assert.equal(launchCacheFile(), null);
        const pw = fakePlaywright(1);
        await launch(pw);
        await launch(pw);
        assert.deepEqual(pw.calls, ['bundled', 'msedge', 'bundled', 'msedge']);
    });

    test('with a run id the working option is tried first by the next launch (and a total failure is never cached)', async () => {
        process.env.XPLAYER_TEST_RUN_ID = `unit-${process.pid}-${Date.now()}`;
        const cacheFile = launchCacheFile();
        try {
            const first = fakePlaywright(1);
            await launch(first);
            assert.deepEqual(first.calls, ['bundled', 'msedge']);
            const second = fakePlaywright(1);
            await launch(second);
            assert.deepEqual(second.calls, ['msedge'], 'a later file starts with the option that worked');

            fs.rmSync(cacheFile, { force: true });
            await launch(fakePlaywright(-1));
            assert.equal(fs.existsSync(cacheFile), false, 'a failure must not be remembered');
        } finally {
            fs.rmSync(cacheFile, { force: true });
            delete process.env.XPLAYER_TEST_RUN_ID;
        }
    });
});

describe('gotoApp settle wait (real browser)', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        const pw = loadPlaywright();
        if (!pw) return void (skip = 'playwright not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settle-test-'));
        fs.writeFileSync(
            path.join(dir, 'index.html'),
            `<!doctype html><script>
                window.shortFired = false;
                setTimeout(() => { window.shortFired = true; }, 300);
                clearTimeout(setTimeout(() => {}, 800));   // cleared: must not be waited for
                setTimeout(() => {}, 20000);                // longer than the old fixed waits: must not be waited for
            </script>`
        );
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('waits for a short app timer, but not for a cleared timer or a very long one', async (t) => {
        if (skip) return void t.skip(skip);
        const page = await browser.newPage();
        try {
            const started = Date.now();
            await gotoApp(page, dir);
            const elapsed = Date.now() - started;
            assert.equal(await page.evaluate('window.shortFired'), true, 'the 300 ms timer has fired when gotoApp returns');
            assert.ok(elapsed < 2500, `did not run into the 3 s ceiling (took ${elapsed} ms)`);
        } finally {
            await page.close();
        }
    });
});

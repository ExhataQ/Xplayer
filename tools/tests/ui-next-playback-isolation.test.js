// The player's parts are independent (views/playback/playback.js): a missing or broken right panel content file must not stop the app.
// Found 2026-10-26: playback.js imported ./right-panel-content.js, the file was not in the owner's tree, and no content loaded.
//
// Run:   node --test tools/tests/ui-next-playback-isolation.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('playback.js', () => {
    test('loads the right panel content with a dynamic import, never a static one', () => {
        const source = fs.readFileSync(path.join(NEXT_SRC, 'views', 'playback', 'playback.js'), 'utf8');
        assert.doesNotMatch(source, /^import .*right-panel-content/m);
        assert.match(source, /import\('\.\/right-panel-content\.js'\)/);
    });
});

describe('the app without the right panel content file', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        fs.rmSync(path.join(dir, 'ui-next', 'views', 'playback', 'right-panel-content.js'), { force: true }); // the file that was missing
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = '<script>window.electronAPI = new Proxy({}, {get:(t,k)=>(k==="then"?undefined:(...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null))});</script>\n';
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('the library and the player still load, and the problem is reported in the console', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const logs = [];
        page.on('console', (m) => logs.push(m.text()));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        assert.ok(logs.some((l) => /mountRightPanelContent could not start/.test(l)), logs.join('\n'));
        await page.close();
    });
});

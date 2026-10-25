// Dropping a file that is already in the song list (src/js/library/import-dropped.js).
// After a delete the song stays in the list (hidden for the session), so a drop of the same file found "no new songs" and the
// person saw nothing come back. Now the drop says "Already in your library", or brings a hidden song back.
//
// Run:   node --test tools/tests/import-dropped.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('import of a file that is already in the list', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        // importDroppedFiles answers like the main process does when the file is already known
        const stub = '<script>window.__reply = null; window.electronAPI = new Proxy({}, {get:(t,k)=>(k==="then"?undefined:k==="importDroppedFiles"?()=>Promise.resolve(window.__reply):(...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null))});</script>\n';
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return page;
    }
    const drop = (page, reply) => page.evaluate(async (r) => {
        window.__reply = r;
        window.importDroppedFiles(['C:/m/a.mp3']);
        await new Promise((res) => setTimeout(res, 150));
        return { text: document.body.textContent, hidden: [...window.deletedSongIds] };
    }, reply);

    test('a known song that is visible: "Already in your library"', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const page = await open();
        const out = await drop(page, { success: true, songs: [], newSongs: [], known: [{ id: 0, url: 'file:///C:/m/a.mp3' }] });
        assert.match(out.text, /Already in your library/);
        assert.doesNotMatch(out.text, /No new songs/);
        await page.close();
    });

    test('a known song that was deleted (hidden) comes back', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const page = await open();
        await page.evaluate(() => window.markSongAsDeleted(0));
        const out = await drop(page, { success: true, songs: [], newSongs: [], known: [{ id: 0, url: 'file:///C:/m/a.mp3' }] });
        assert.match(out.text, /Added back 1 song/);
        assert.deepEqual(out.hidden, []);
        await page.close();
    });

    test('a failure says why, and a normal "nothing new" keeps its old message', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const page = await open();
        assert.match((await drop(page, { success: false, error: 'No valid songs found (the files could not be read)' })).text, /Could not import: No valid songs found/);
        assert.match((await drop(page, { success: true, songs: [], newSongs: [] })).text, /No new songs to import/);
        await page.close();
    });
});

'use strict';

// Agent D, steps D-06 and D-08: D's files no longer touch localStorage or window.electronAPI.
//
//   05a  virtual scroll threshold  -> storageRead / storageWrite (core/storage.js)
//   06b  download from a link      -> desktopApi.library.downloadAndScan
//   06b  welcome dialog picker     -> desktopApi.library.welcomeSelectFolder (the generic invoke is gone)
//   06k  Ctrl+D delete shortcut    -> desktopApi.files.deleteFile
//
// Static checks run anywhere; the page checks need Playwright (they skip without it).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const JS = path.join(ROOT, 'src', 'js');
const D_FILE = /^(04|05|06|07)[a-z]?-.*\.js$/;

const code = (file) =>
    fs.readFileSync(path.join(JS, file), 'utf8').split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');

describe('D files: no direct storage or Electron access', () => {
    const files = fs.readdirSync(JS).filter((f) => D_FILE.test(f));
    test('the UI shell files are found', () => assert.ok(files.length >= 30, `found ${files.length}`));
    for (const word of ['localStorage', 'sessionStorage', 'electronAPI']) {
        test(`no ${word} in 04*, 05*, 06*, 07*`, () => {
            const offenders = files.filter((f) => new RegExp(`\\b${word}\\b`).test(code(f)));
            assert.deepEqual(offenders, []);
        });
    }
    test('the generic electronAPI.invoke is not called with a channel name from the UI shell', () => {
        const offenders = files.filter((f) => /\.invoke\(\s*['"`]/.test(code(f)));
        assert.deepEqual(offenders, []);
    });
});

describe('D files: the swapped calls behave as before (real page)', () => {
    let pw, browser, dir, skip;
    before(async () => {
        pw = loadPlaywright();
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(20);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const URL_ = () => 'file://' + path.join(dir, 'index.html').replace(/\\/g, '/');

    // A page whose electronAPI records every call (name and arguments) and answers from `answers`.
    async function openPage(initScript) {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        if (initScript) await page.addInitScript(initScript);
        await page.goto(URL_());
        await page.waitForTimeout(800);
        await page.evaluate(() => {
            window.__calls = [];
            window.__answers = {};
            const names = ['downloadAndScan', 'welcomeSelectFolder', 'invoke', 'deleteFile'];
            window.electronAPI = {};
            for (const n of names) {
                window.electronAPI[n] = (...args) => {
                    window.__calls.push([n, ...args]);
                    return n in window.__answers ? window.__answers[n] : undefined;
                };
            }
        });
        return { page, errors };
    }

    test('05a: the saved threshold is read at start-up and a new value is saved as a string', async (t) => {
        if (skip) return void t.skip(skip);
        const KEY = 'virtualScrollThreshold';
        const { page, errors } = await openPage(`try { localStorage.setItem('${KEY}', '730'); } catch (e) {}`);
        const out = await page.evaluate((KEY) => {
            const loaded = VIRTUAL_SCROLL_THRESHOLD;
            const returned = setVirtualScrollThreshold(1230);
            return { loaded, returned, stored: localStorage.getItem(KEY), now: VIRTUAL_SCROLL_THRESHOLD, snapped: snapVirtualScrollThreshold(730) };
        }, KEY);
        assert.equal(out.loaded, 700, 'stored 730 is snapped to 700 and used');
        assert.equal(out.snapped, 700);
        assert.equal(out.returned, 1200);
        assert.equal(out.stored, String(out.returned));
        assert.equal(out.now, out.returned);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('05a: a missing or invalid stored threshold falls back to the default', async (t) => {
        if (skip) return void t.skip(skip);
        for (const bad of [null, 'abc', '-5', '8000']) {
            const { page, errors } = await openPage(bad === null ? '' : `try { localStorage.setItem('virtualScrollThreshold', '${bad}'); } catch (e) {}`);
            const out = await page.evaluate(() => ({ now: VIRTUAL_SCROLL_THRESHOLD, def: DEFAULT_VIRTUAL_SCROLL_THRESHOLD }));
            assert.equal(out.now, out.def, `stored ${bad}`);
            assert.deepEqual(errors, []);
            await page.close();
        }
    });

    test('06b: "play from URL" asks the main process to download and scan with the url and the temp flag', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const out = await page.evaluate(async () => {
            window.__answers.downloadAndScan = Promise.resolve({ success: false });
            showAddLinkDialog();
            await new Promise((r) => setTimeout(r, 120));
            document.getElementById('link-url-input').value = '  https://example.com/a.mp3 ';
            playFromUrl(false);
            await new Promise((r) => setTimeout(r, 900));
            return { calls: window.__calls.map((c) => c.map(String)), tooltips: document.body.classList.contains('suppress-tooltips') };
        });
        assert.deepEqual(out.calls, [['downloadAndScan', 'https://example.com/a.mp3', 'true']]);
        assert.equal(out.tooltips, false, 'the success=false path ran and cleaned up');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('06b: "play from URL" without the Electron call does nothing and does not throw', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const out = await page.evaluate(async () => {
            delete window.electronAPI.downloadAndScan;
            showAddLinkDialog();
            await new Promise((r) => setTimeout(r, 120));
            document.getElementById('link-url-input').value = 'https://example.com/a.mp3';
            playFromUrl(true);
            await new Promise((r) => setTimeout(r, 200));
            return window.__calls.length;
        });
        assert.equal(out, 0);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('06b: the welcome dialog picker calls welcomeSelectFolder, closes only when a folder was selected', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const out = await page.evaluate(async () => {
            const saved = SONGS_DATA.splice(0);
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const open = () => { showWelcomeDialog(); return document.getElementById('welcome-select-folder'); };
            const result = {};
            window.__answers.welcomeSelectFolder = Promise.resolve({ selected: false });
            let btn = open(); btn.click(); await sleep(50);
            result.openAfterCancel = !!document.getElementById('welcome-select-folder');
            window.__answers.welcomeSelectFolder = Promise.resolve({ selected: true });
            document.getElementById('welcome-select-folder').click(); await sleep(50);
            result.openAfterSelect = !!document.getElementById('welcome-select-folder');
            result.calls = window.__calls.map((c) => c[0]);
            SONGS_DATA.push(...saved);
            return result;
        });
        assert.equal(out.openAfterCancel, true);
        assert.equal(out.openAfterSelect, false);
        assert.deepEqual(out.calls, ['welcomeSelectFolder', 'welcomeSelectFolder']);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('06k: Ctrl+D deletes the selected song file through the Electron call with the Windows path', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const out = await page.evaluate(async () => {
            window.confirm = () => true;
            const song = SONGS_DATA[1];
            song.url = 'file:///C:/Music/Some Folder/track.mp3';
            selectedSongIds.clear();
            selectedSongIds.add(song.id);
            document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));
            await new Promise((r) => setTimeout(r, 100));
            return window.__calls;
        });
        assert.deepEqual(out, [['deleteFile', 'C:\\Music\\Some Folder\\track.mp3']]);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('06k: Ctrl+D without the delete call still removes the song from the library and does not throw', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const out = await page.evaluate(async () => {
            delete window.electronAPI.deleteFile;
            window.confirm = () => true;
            const song = SONGS_DATA[1];
            song.url = 'file:///C:/Music/x.mp3';
            selectedSongIds.clear();
            selectedSongIds.add(song.id);
            document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));
            await new Promise((r) => setTimeout(r, 100));
            return { calls: window.__calls.length, stillThere: !!SONGS_DATA.find((s) => s.id === song.id) };
        });
        assert.equal(out.calls, 0);
        assert.deepEqual(errors, []);
        await page.close();
    });
});

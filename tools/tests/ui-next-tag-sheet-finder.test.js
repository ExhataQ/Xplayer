'use strict';

// The tag sheet's "Find tags online" (task PD-05, decision DP12 option A) in the real new shell: the button, the sure matches that are
// staged, the queue of unsure ones, Accept and Skip, Cancel, the message when the tag backend is missing, and that nothing is written.
// Skips itself when Playwright or a browser is not there. Run: node --test tools/tests/ui-next-tag-sheet-finder.test.js

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const OPTIONS = { timeout: 60000 };
const MISSING = 'Tags cannot be read or saved yet: the Python package "mutagen" is not installed. Install it with: python -m pip install mutagen';

describe('Find tags online in the tag sheet', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(window.__api&&window.__api[k])||((...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);}) });</script>\n`;
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    // What the main process would answer. Every call is logged in window.__calls; window.__hold delays the search until released.
    const API = (backendMissing) => {
        const calls = (window.__calls = []);
        const log = (name, fn) => async (arg) => (calls.push([name, JSON.parse(JSON.stringify(arg === undefined ? null : arg))]), fn(arg));
        const found = (id, decision, patch) => ({ id, fileUrl: '', decision, confidence: decision === 'auto' ? 0.9 : 0.68, reasons: [], release: { id: 'r', title: 'The Album', date: '1999-04-01', releaseGroupId: 'g' }, patch, changes: Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, { from: '', to: v }])) });
        window.__api = {
            getAudioMetadata: log('get', async () => (backendMissing ? { success: false, reason: 'no-mutagen', error: window.__missing } : { success: true, metadata: { title: 'T', artist: ['A'], album: '', albumArtist: [], genre: [], year: '', label: '' } })),
            saveAudioMetadata: log('save', async (o) => ({ success: true, metadata: o.metadata })),
            saveAudioMetadataMany: log('saveMany', async () => []),
            cancelFindTags: log('cancel', async () => ({ cancelled: true })),
            findTagsMany: log('find', async (request) => {
                if (window.__hold) await window.__hold;
                const [a, b, c] = request.songs;
                return { success: true, cancelled: false, stopped: null, message: '', summary: {}, results: [found(a.id, 'auto', { album: 'The Album', year: '1999' }), found(b.id, 'review', { album: 'Maybe Album' }), found(c.id, 'none', {})] };
            })
        };
    };

    async function open(backendMissing = false) {
        const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.addInitScript(`window.__missing = ${JSON.stringify(MISSING)}; (${API.toString()})(${backendMissing})`);
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        await page.click('.rail-btn[data-view="metadata"]');
        await page.waitForSelector('.view-host[data-view="metadata"]');
        await page.evaluate(() => window.playSongFromList(window.SONGS_DATA[0].id));
        await page.click('.metadata-mode button:has-text("Many songs")');
        await page.waitForSelector('.tag-sheet');
        await page.selectOption('select[aria-label="Add songs from"]', 'all-songs');
        await page.waitForSelector('.tag-sheet tbody tr');
        return { page, errors };
    }
    const checkFirst = async (page, n) => {
        const boxes = page.locator('.tag-sheet tbody input[type="checkbox"]');
        for (let i = 0; i < n; i += 1) await boxes.nth(i).check();
    };
    const status = (page) => page.evaluate(() => document.querySelector('.tag-sheet__footer .tag-sheet__status')?.textContent || '');
    const calls = (page, name) => page.evaluate((n) => window.__calls.filter((c) => c[0] === n).map((c) => c[1]), name);
    const finderText = (page) => page.evaluate(() => document.querySelector('.tag-sheet__finder')?.textContent.replace(/\s+/g, ' ') || '');

    test('the button needs checked rows; a search stages the sure match, queues the unsure one, and writes nothing', OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const find = page.locator('.tag-sheet__finder button', { hasText: 'Find tags online' });
        assert.equal(await find.isDisabled(), true, 'nothing checked');
        await checkFirst(page, 3);
        assert.equal(await find.isDisabled(), false);
        await find.click();
        await page.waitForSelector('.tag-sheet__findings');

        const request = (await calls(page, 'find'))[0];
        assert.equal(request.songs.length, 3);
        assert.deepEqual(request.options.fields, ['album', 'albumArtist', 'year', 'genre', 'label']);
        assert.equal(request.options.rule, 'original');

        const text = await finderText(page);
        assert.match(text, /Last search: 1 staged, 1 to review, 1 nothing to change\./);
        assert.match(text, /1 song needs your review/);
        assert.match(text, /The Album \(1999\), 68% sure\. Album: \(empty\) → Maybe Album/);
        assert.match(await status(page), /30 songs, 3 checked, 2 changes\./, 'the sure match is staged as album and year; the unsure one is not');

        assert.equal((await calls(page, 'save')).length + (await calls(page, 'saveMany')).length, 0, 'a search never writes');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Accept stages the queued match and clears the queue; Skip drops it', OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await checkFirst(page, 3);
        await page.click('.tag-sheet__finder button:has-text("Find tags online")');
        await page.waitForSelector('.tag-sheet__findings');
        await page.click('.tag-sheet__finding button:has-text("Accept")');
        await page.waitForFunction(() => !document.querySelector('.tag-sheet__findings'));
        assert.match(await status(page), /3 changes\./, 'album and year plus the accepted album');
        assert.equal((await calls(page, 'saveMany')).length, 0);

        await page.click('.tag-sheet__button:has-text("Discard changes")');
        await page.click('.tag-sheet__finder button:has-text("Find tags online")');
        await page.waitForSelector('.tag-sheet__findings');
        await page.click('.tag-sheet__finding button:has-text("Skip")');
        await page.waitForFunction(() => !document.querySelector('.tag-sheet__findings'));
        assert.match(await status(page), /2 changes\./, 'only the sure match is staged; the skipped one never is');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('while a search runs the button is off and Cancel reaches the main process', OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await checkFirst(page, 3);
        await page.evaluate(() => { window.__hold = new Promise((resolve) => { window.__release = resolve; }); });
        await page.click('.tag-sheet__finder button:has-text("Find tags online")');
        await page.waitForSelector('.tag-sheet__finder button:has-text("Cancel search")');
        assert.equal(await page.locator('.tag-sheet__finder button', { hasText: 'Find tags online' }).isDisabled(), true);
        assert.match(await finderText(page), /Looking songs up, about 3 to 4 seconds each/);
        await page.click('.tag-sheet__finder button:has-text("Cancel search")');
        assert.equal((await calls(page, 'cancel')).length, 1);
        await page.evaluate(() => window.__release());
        await page.waitForSelector('.tag-sheet__finder button:has-text("Find tags online"):not([disabled])');
        assert.equal(await page.locator('.tag-sheet__finder button:has-text("Cancel search")').count(), 0);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('with no tag backend the sheet says why, in words, instead of a wall of "unreadable"', OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(true);
        await checkFirst(page, 2);
        await page.click('.tag-sheet__finder button:has-text("Find tags online")');
        await page.waitForFunction((m) => document.querySelector('.tag-sheet__footer .tag-sheet__status')?.textContent.includes(m), 'mutagen');
        assert.match(await status(page), /None of those songs could be read: Tags cannot be read or saved yet: the Python package "mutagen" is not installed\. Install it with: python -m pip install mutagen/);
        assert.equal((await calls(page, 'find')).length, 0, 'no lookup was started without tags to compare');
        assert.deepEqual(errors, []);
        await page.close();
    });
});
